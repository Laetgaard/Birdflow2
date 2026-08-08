import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startBookingEmailScheduler } from "./email/bookingScheduler";
import { startDomainVerificationScheduler } from "./domainVerificationScheduler";
import { ensurePlatformCalendar } from "./platformCalendar";
import { startOnboardingDecisionSchema } from "./onboardingDecisionSchema";
import { startAssistantPlanSchema } from "./assistantPlanDbSchema";
import { db } from "./storage";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { startWebsiteLanguageSchema } from "./websiteLanguageSchema";
import { startSvgAssetSchema } from "./svgAssetSchema";
import { startPublishJobSchema } from "./publisher/publishJobSchema";
import { registerSeoRoutes } from "./seo";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Initialize Stripe integration
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set, skipping Stripe initialization');
    return;
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    console.log('Setting up managed webhook...');
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    try {
      const result = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      if (result?.webhook?.url) {
        console.log(`Webhook configured: ${result.webhook.url}`);
      } else {
        console.log('Webhook setup returned without URL - may need manual configuration');
      }
    } catch (webhookError: any) {
      console.log('Webhook setup skipped:', webhookError.message);
    }

    // Sync all existing Stripe data in background
    stripeSync.syncBackfill()
      .then(() => console.log('Stripe data synced'))
      .catch((err: any) => console.error('Error syncing Stripe data:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
  }
}

// Initialize Stripe on startup
initStripe();

// Register Stripe webhook route BEFORE express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Now apply JSON middleware for all other routes
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Sitemap + robots for BirdFlow's own marketing pages. Registered before
  // everything else so the SPA catch-alls can never shadow them.
  registerSeoRoutes(app);

  await registerRoutes(httpServer, app);

  // Poll-based booking reminder/follow-up emails (published sites write
  // bookings directly to Supabase, so there is no in-request hook)
  startBookingEmailScheduler();

  // Server-side re-check of pending custom domains so they verify (and go
  // truly live) even when the manage tab is closed
  startDomainVerificationScheduler();

  // BirdFlow's own booking calendar (the free improvement meeting). Created
  // idempotently at boot so a fresh environment works without hand-editing
  // the database. A database that is briefly unreachable must not stop the
  // server from coming up - the next boot will retry.
  ensurePlatformCalendar().catch((err) => {
    console.warn("[PlatformCalendar] setup skipped:", err?.message || err);
  });

  // The end-of-onboarding decision state (preview → approve → pay) and the
  // Stripe event-dedup table. Same reasoning as the calendar above: this
  // project has no migration runner, so the idempotent DDL runs at boot.
  // It retries with backoff, and everything that touches these columns waits
  // on the same readiness promise, so no request can run against a schema
  // that is not there yet - whether boot won the race or not.
  void startOnboardingDecisionSchema(db);

  // Plan mode / Build mode: builder_state.revision plus the assistant_plans
  // and assistant_builds tables. Same idempotent-DDL-at-boot pattern, and the
  // same readiness promise guards every read and write in server/planStore.ts.
  void startAssistantPlanSchema(db);

  // The per-website language choice made in onboarding. Same idempotent-DDL
  // reasoning again; the column defaults to Danish so a database that has not
  // caught up yet still behaves exactly as it did before the choice existed.
  void startWebsiteLanguageSchema(db);

  // The SVG asset store (reusable illustrations referenced from primitive
  // trees). Same pattern once more: until the table is ready, svg markup
  // simply stays inline in the builder state, which both renderers render
  // exactly as before.
  void startSvgAssetSchema(db);
  void startPublishJobSchema(db);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
