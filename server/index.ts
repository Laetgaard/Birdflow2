import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { startBookingEmailScheduler } from "./email/bookingScheduler";
import { startDomainVerificationScheduler } from "./domainVerificationScheduler";
import { ensurePlatformCalendar } from "./platformCalendar";
import { startOnboardingDecisionSchema } from "./onboardingDecisionSchema";
import { startAssistantPlanSchema } from "./assistantPlanDbSchema";
import { startAccountComponentSchema } from "./accountComponentDbSchema";
import { db } from "./storage";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { startWebsiteLanguageSchema } from "./websiteLanguageSchema";
import { startSvgAssetSchema } from "./svgAssetSchema";
import { startInvoiceSchema } from "./invoiceSchema";
import { startPublishJobSchema } from "./publisher/publishJobSchema";
import { failStalePublishJobs, getPublishJobByDeploymentId, completePublishJob, failPublishJob } from "./publisher/publishJobs";
import { startPublishActivationReconciler } from "./publisher/worker";
import { resumeOrphanedBuilds } from "./buildWorker";
import { storage as appStorage } from "./storage";
import { registerSeoRoutes } from "./seo";
import { ensureBookingSchema } from "./bookingSchema";

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

// Register Vercel deployment webhook BEFORE express.json() so we get raw bytes
// for HMAC-SHA1 signature verification. (Same reason as the Stripe webhook below.)
app.post(
  '/api/webhooks/vercel',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // VERCEL_WEBHOOK_SECRET is required. Without it any caller who knows a
      // deployment ID could forge events and update website URLs to attacker-
      // controlled values. If the secret is not configured, refuse all events.
      const webhookSecret = process.env.VERCEL_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.warn(
          '[Vercel webhook] VERCEL_WEBHOOK_SECRET is not set — webhook endpoint is disabled.' +
          ' Configure this secret to enable event-driven publish completion.'
        );
        return res.status(200).json({ ok: true }); // return 200 so Vercel does not retry
      }

      const sig = req.headers['x-vercel-signature'] as string | undefined;
      if (!sig) return res.status(400).json({ message: 'Missing x-vercel-signature' });

      // Timing-safe comparison — prevents timing side-channel leaks.
      const { createHmac, timingSafeEqual } = await import('crypto');
      const expectedBuf = createHmac('sha1', webhookSecret)
        .update(req.body as Buffer)
        .digest();
      const actualBuf = Buffer.from(sig, 'hex');
      if (
        expectedBuf.length !== actualBuf.length ||
        !timingSafeEqual(expectedBuf, actualBuf)
      ) {
        return res.status(401).json({ message: 'Invalid signature' });
      }

      let body: Record<string, any>;
      try {
        body = JSON.parse((req.body as Buffer).toString('utf-8'));
      } catch {
        return res.status(200).json({ ok: true }); // malformed — ignore
      }

      const type: string = body.type ?? '';
      const deploymentId: string = body.payload?.deployment?.id ?? '';
      if (!deploymentId || !['deployment.succeeded', 'deployment.error'].includes(type)) {
        return res.status(200).json({ ok: true });
      }

      const job = await getPublishJobByDeploymentId(deploymentId);
      if (!job || job.status === 'published' || job.status === 'failed') {
        return res.status(200).json({ ok: true }); // terminal — idempotent no-op
      }

      if (type === 'deployment.succeeded') {
        const productionUrl: string | undefined = body.payload?.links?.deployment;
        if (productionUrl && !productionUrl.includes('-projects-')) {
          await completePublishJob(job.id, {
            productionUrl,
            deploymentUrl: body.payload?.deployment?.url
              ? `https://${body.payload.deployment.url}`
              : productionUrl,
            vercelProjectId: job.vercelProjectId ?? '',
            vercelDeploymentId: deploymentId,
          });
          await appStorage.updateWebsite(job.websiteId, job.requestedBy, {
            status: 'published',
            deploymentUrl: productionUrl,
            deploymentId,
          } as any);
        }
      } else {
        // deployment.error — already guarded by terminal check above
        await failPublishJob(job.id, {
          errorCode: 'VERCEL_DEPLOYMENT_ERROR',
          errorMessage: body.payload?.deployment?.errorMessage ?? 'Vercel deployment failed',
        });
      }

      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('[Vercel webhook] error:', err?.message);
      res.status(200).json({ ok: true }); // always 200 to Vercel
    }
  }
);

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
  startAssistantPlanSchema(db).then((ready) => {
    if (ready) {
      // Resume any builds that were interrupted by the previous server process.
      void resumeOrphanedBuilds().catch((err) =>
        console.error("[BuildWorker] Orphan recovery failed:", err)
      );
    }
  });

  // The per-website language choice made in onboarding. Same idempotent-DDL
  // reasoning again; the column defaults to Danish so a database that has not
  // caught up yet still behaves exactly as it did before the choice existed.
  void startWebsiteLanguageSchema(db);

  // The SVG asset store (reusable illustrations referenced from primitive
  // trees). Same pattern once more: until the table is ready, svg markup
  // simply stays inline in the builder state, which both renderers render
  // exactly as before.
  void startSvgAssetSchema(db);
  void startAccountComponentSchema(db);
  void startInvoiceSchema(db);
  // Booking extensions are idempotent because deployments do not run db:push.
  void ensureBookingSchema(db).catch(err => console.warn("[BookingSchema] setup skipped:", err?.message || err));
  startPublishJobSchema(db).then(ready => {
    if (ready) {
      void failStalePublishJobs().catch(err =>
        console.error('[PublishJobs] Stale job recovery failed:', err)
      );
      const vercelToken = process.env.VERCEL_TOKEN;
      if (vercelToken) {
        startPublishActivationReconciler({
          token: vercelToken,
          teamId: process.env.VERCEL_TEAM_ID,
        });
      }
    }
  });

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
