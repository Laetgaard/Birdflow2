import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { runMeterFor } from "./aiSpend";
import { isSpendLimitError } from "./aiCall";
import { respondSpendLimit } from "./spendLimitResponse";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { saveBuilderStateGuarded } from "./builderStateWriter";
import { createSvgAssetSafe } from "./svgAssetStore";
import { collectReferencedSvgAssetIds } from "@shared/svgAssets";
import { migrateSiteStructure } from "@shared/siteStructure";
import { insertProfileSchema, updateProfileSchema, insertWebsiteSchema, insertWebsiteInputsSchema, type BuilderStateData, type BuilderComponent, sanitizeAnalyticsEventData, websites, builderState, profiles, publicStats, bookings as bookingsTable, orders as ordersTable, invoices as invoicesTable, customers as customersTable, formSubmissions as formSubmissionsTable, PLATFORM_CALENDAR_TIMEZONE, type Profile, type WebsiteAdminContext, type WebsiteWithAccess } from "@shared/schema";
import { getPlatformCalendar } from "./platformCalendar";
import { requireWebsitePermission, getWebsiteAccess, getAuthedUser, resolveWebsiteAccess } from "./websiteAccess";
import { classifyTrafficSource, extractUtmSource, getClientIp, lookupCountry, copenhagenDayStart } from "./analytics";
import { recordAdminAudit, summarizeBuilderStateChange, auditManageMutation } from "./adminAudit";
import { isAllowedMediaStoragePath } from "./mediaPaths";
import { eq, sql, and as andOp, eq as eqOp, ne as neOp, gte as gteOp, lt as ltOp } from "drizzle-orm";
import { z, ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";
import { publishWebsite } from "./publisher";
import { resolvePlatformUrl } from "./publisher/platformUrl";
import {
  createPublishJobWithSnapshot,
  getPublishJob,
  getActivePublishJob,
  getPublishJobByDeploymentId,
  getLatestPublishedVercelProjectId,
  completePublishJob,
  failPublishJob,
} from "./publisher/publishJobs";
import { migrateSiteStateToCurrent, PublishCompatibilityError } from "./publisher/migrations";
import { isPublishJobSchemaReady } from "./publisher/publishJobSchema";
import { isInvoiceSchemaReady } from "./invoiceSchema";
import { runPublishJob } from "./publisher/worker";
import type { WorkerConfig } from "./publisher/worker";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSecretKey } from "./stripeClient";
import { syncStripeConnectStatus, resolveAppOrigin } from "./stripeConnect";
import { 
  createSubscriptionCheckoutSession, 
  createBillingPortalSession, 
  handleCheckoutSessionCompleted,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentFailed,
  PLAN_DETAILS,
  getSubscriptionStatusInfo,
  handleUserSubscriptionCreated,
  handleUserSubscriptionUpdated,
  handleUserSubscriptionDeleted,
  handleUserInvoicePaymentFailed,
  createUserSubscriptionCheckoutSession,
  getUserSubscriptionStatus,
  checkWebsiteLimit,
  checkPageLimit,
  checkFeatureAccess,
  getUserPlanFeatures,
  type PlanId
} from "./subscriptionService";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import {
  checkDomainAvailability,
  purchaseDomain,
  recoverVerifiedProjectForLiveUrl,
} from "./publisher/vercel";
import {
  getVercelConfig,
  projectNameForWebsite,
  attachDomainPair,
  detachDomainPair,
  twinHostOf,
  resolveTwinHost,
  refreshDomainState,
  restoreDeploymentUrlAfterDelete,
} from "./domainConnection";
import { applyMutations, assertSaneJsonDepth } from "./aiBuilder";
import { resolveAiImageMarkers } from "./aiImages";
import { runSelfCheck } from "./selfCheck";
import { completeSelfReview } from "./selfReview";
import { checkMutationClaims, scrubStateClaims } from "./claimRules";
import { buildReport } from "./aiReport";
import { BuilderMutationSchema } from "@shared/aiBuilderSchema";
import { sanitizeBuilderStateCustomContent, brandGuideToDesignTokens, buildBrandContext } from "@shared/customComponents";
import { emailService } from "./email/service";
import { getUncachableResendClient } from "./replit_integrations/resendClient";
import { parseBookingPriceCents } from "./parseBookingPrice";
import { handleOnboardingStripeEvent, shouldProcessStripeEvent } from "./onboardingWebhooks";
import { registerOnboardingDecisionRoutes } from "./onboardingDecisionRoutes";
import { updateDecisionByUser, bumpSiteRevision, markGenerationComplete } from "./onboardingDecision";
import { consumeAgentRun } from "./aiRateLimit";
import { registerAssistantPlanRoutes } from "./assistantPlanRoutes";

// Helper to migrate legacy element-based state to component-based state
import { SITE_LANGUAGES, normalizeSiteLanguage } from "@shared/siteLanguage";
function migrateBuilderState(state: any): BuilderStateData {
  // If already in component format, return as-is
  if (state.pages?.[0]?.components !== undefined) {
    return state as BuilderStateData;
  }
  
  // Migrate from legacy element-based format to component-based format
  const migratedPages = (state.pages || []).map((page: any) => {
    const components: BuilderComponent[] = [];
    
    // Convert elements to components
    const elements = page.elements || [];
    for (const element of elements) {
      const component = elementToComponent(element);
      if (component) {
        components.push(component);
      }
    }
    
    // If no components were created, add default ones
    if (components.length === 0) {
      components.push({
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Welcome to Your Website',
          subtitle: 'Build something amazing with our website builder.',
          buttonText: 'Get Started',
          buttonLink: '#features',
          alignment: 'center'
        },
        styles: {
          backgroundColor: '#f8fafc',
          textColor: '#1a1a1a',
          padding: '80px 24px'
        }
      });
    }
    
    return {
      id: page.id,
      name: page.name,
      path: page.path,
      components
    };
  });
  
  return {
    pages: migratedPages.length > 0 ? migratedPages : [{
      id: 'home',
      name: 'Home',
      path: '/',
      components: [{
        id: 'hero-1',
        type: 'hero',
        props: {
          title: 'Welcome to Your Website',
          subtitle: 'Build something amazing with our website builder.',
          buttonText: 'Get Started',
          buttonLink: '#features',
          alignment: 'center'
        },
        styles: {
          backgroundColor: '#f8fafc',
          textColor: '#1a1a1a',
          padding: '80px 24px'
        }
      }]
    }],
    activePage: state.activePage || 'home',
    globalStyles: {
      primaryColor: state.globalStyles?.primaryColor || '#3b82f6',
      secondaryColor: state.globalStyles?.secondaryColor || '#10b981',
      fontFamily: state.globalStyles?.fontFamily || 'Inter, sans-serif',
      backgroundColor: state.globalStyles?.backgroundColor || '#ffffff'
    }
  };
}

// Convert a legacy element to a component
function elementToComponent(element: any): BuilderComponent | null {
  const type = element.type;
  
  // Map element types to component types
  switch (type) {
    case 'header':
      return {
        id: element.id,
        type: 'header',
        props: {
          title: element.children?.[0]?.content || 'Your Brand',
          buttonText: 'Contact',
          buttonLink: '/contact'
        },
        styles: {
          backgroundColor: element.styles?.backgroundColor || '#ffffff',
          textColor: element.styles?.color || '#1a1a1a',
          padding: element.styles?.padding || '16px 24px'
        }
      };
    
    case 'section':
      // Determine if it's a hero or features section based on content
      const hasButton = element.children?.some((c: any) => c.type === 'button');
      const hasGrid = element.children?.some((c: any) => c.type === 'grid');
      
      if (hasGrid) {
        // Features section
        const gridItems = element.children?.find((c: any) => c.type === 'grid')?.children || [];
        return {
          id: element.id,
          type: 'features',
          props: {
            title: element.children?.find((c: any) => c.type === 'text')?.content || 'Features',
            items: gridItems.map((item: any, idx: number) => ({
              id: String(idx + 1),
              title: item.content || `Feature ${idx + 1}`,
              description: '',
              icon: 'star'
            })),
            alignment: 'center'
          },
          styles: {
            backgroundColor: element.styles?.backgroundColor || '#ffffff',
            textColor: element.styles?.color || '#1a1a1a',
            padding: element.styles?.padding || '80px 24px'
          }
        };
      }
      
      // Hero section
      const texts = element.children?.filter((c: any) => c.type === 'text') || [];
      const button = element.children?.find((c: any) => c.type === 'button');
      return {
        id: element.id,
        type: 'hero',
        props: {
          title: texts[0]?.content || 'Welcome',
          subtitle: texts[1]?.content || '',
          buttonText: button?.content || 'Get Started',
          buttonLink: '#',
          alignment: 'center'
        },
        styles: {
          backgroundColor: element.styles?.backgroundColor || '#f8fafc',
          textColor: element.styles?.color || '#1a1a1a',
          padding: element.styles?.padding || '80px 24px'
        }
      };
    
    case 'footer':
      return {
        id: element.id,
        type: 'footer',
        props: {
          title: element.children?.[0]?.content || '© 2025 Your Company'
        },
        styles: {
          backgroundColor: element.styles?.backgroundColor || '#1a1a1a',
          textColor: element.styles?.color || '#ffffff',
          padding: element.styles?.padding || '32px 24px'
        }
      };
    
    default:
      return null;
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Warning: SUPABASE_URL and SUPABASE_ANON_KEY not set. Auth will not work.");
}

// Middleware to verify Supabase session and ensure profile exists
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "No authorization token provided" });
    }

    const token = authHeader.split(' ')[1];
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ message: "Supabase not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    // Check if email is confirmed
    if (!user.email_confirmed_at) {
      return res.status(403).json({ message: "Email not confirmed" });
    }

    // Auto-create profile if missing (user has confirmed email at this point)
    let profile = await storage.getProfile(user.id);
    if (!profile && user.email) {
      console.log(`[RequireAuth] Creating profile for user ${user.id}`);
      try {
        profile = await storage.createProfile({
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email.split('@')[0] || '',
          phoneNumber: user.user_metadata?.phone_number || '',
        });
        console.log(`[RequireAuth] Profile created for user ${user.id}`);
      } catch (createError: any) {
        if (createError.code === '23505') {
          profile = await storage.getProfile(user.id);
        }
        // Continue even if creation fails - getOrCreateProfile in endpoints will retry
      }
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Authentication failed" });
  }
}

// Helper function to get or create a profile for authenticated user
/**
 * The website's trading currency, for checkout paths whose products
 * carry no currency of their own. Falls back to DKK (the platform
 * default) only when the website row itself is missing.
 */
async function websiteCurrency(websiteId: string): Promise<string> {
  try {
    const website = await storage.getWebsite(websiteId);
    return website?.currency || "DKK";
  } catch {
    return "DKK";
  }
}

async function getOrCreateProfile(userId: string, authUser: any): Promise<{ profile: Profile | null; error: string | null }> {
  // Try to get existing profile
  let profile = await storage.getProfile(userId);
  if (profile) {
    return { profile, error: null };
  }
  
  // Validate required fields for new profile
  const email = authUser?.email;
  if (!email) {
    console.error(`[getOrCreateProfile] Cannot create profile: no email for user ${userId}`);
    return { profile: null, error: "Email mangler. Prøv at logge ud og ind igen." };
  }
  
  console.log(`[getOrCreateProfile] Creating profile for user ${userId} with email ${email}`);
  
  const fullName = authUser?.user_metadata?.full_name || email.split('@')[0] || 'User';
  const phoneNumber = authUser?.user_metadata?.phone_number || '';
  
  try {
    profile = await storage.createProfile({
      id: userId,
      email,
      fullName,
      phoneNumber,
    });
    console.log(`[getOrCreateProfile] Profile created successfully for user ${userId}`);
    return { profile, error: null };
  } catch (createError: any) {
    console.error(`[getOrCreateProfile] Profile creation error:`, createError.message, createError.code);
    
    // Handle race condition - profile already exists
    if (createError.code === '23505') {
      console.log(`[getOrCreateProfile] Profile already exists (race condition), fetching...`);
      profile = await storage.getProfile(userId);
      if (profile) {
        return { profile, error: null };
      }
    }
    
    return { profile: null, error: "Kunne ikke oprette brugerprofil. Prøv at logge ud og ind igen." };
  }
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register object storage routes for file uploads
  registerObjectStorageRoutes(app, requireAuth);
  
  // Inject Supabase config into HTML for client (anon key only - safe for client)
  app.get("/api/config", (req, res) => {
    res.json({
      supabaseUrl: supabaseUrl || "",
      supabaseAnonKey: supabaseAnonKey || "",
    });
  });

  // Public stats endpoint (no auth required)
  app.get("/api/public/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching public stats:", error);
      res.json({ totalCreators: 0 }); // Fallback to 0 for real user count
    }
  });

  // Onboarding - Create website and complete onboarding in one atomic transaction
  // Prevents duplicate AI drafts from double-submits (read-then-insert race)
  const aiOnboardingCreateLock = new Set<string>();
  app.post("/api/onboarding/create-website", requireAuth, async (req, res) => {
    let lockedUserId: string | null = null;
    try {
      const user = (req as any).user;
      const { name, slug, templateId, websiteType, mode } = req.body;
      const isAiMode = mode === "ai";

      if (!name || (!templateId && !isAiMode)) {
        return res.status(400).json({ message: "Name and template are required" });
      }

      if (isAiMode) {
        if (aiOnboardingCreateLock.has(user.id)) {
          return res.status(429).json({ message: "Dit projekt er ved at blive oprettet — vent et øjeblik." });
        }
        aiOnboardingCreateLock.add(user.id);
        lockedUserId = user.id;
      }

      // Check if user already completed onboarding (outside transaction for early exit)
      const profile = await storage.getProfile(user.id);
      if (profile?.onboardingCompleted) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }

      // AI onboarding is resume-safe: if the user refreshed mid-flow, reuse
      // their existing draft instead of piling up duplicate websites.
      if (isAiMode) {
        const existing = (await storage.getWebsitesByOwner(user.id)).find(
          (w) => w.setupType === "ai" && w.status === "draft"
        );
        if (existing) {
          return res.status(200).json({
            websiteId: existing.id,
            slug: existing.slug,
            reused: true,
            message: "Existing draft website reused",
          });
        }
      }

      // Note: We no longer require payment before website creation
      // Users can create their website first and pay in the final onboarding step

      // Generate unique slug
      const baseSlug = (slug || name).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'website';
      const timestamp = Date.now().toString(36);
      const uniqueSlug = `${baseSlug}-${timestamp}`;

      // The language step comes right after the AI/DIY fork, which is before
      // the draft website exists — so the choice is already sitting in the
      // session answers and has to be carried onto the new row here. Absent
      // means Danish, exactly as the column default.
      const onboardingSession = await storage.getOnboardingSession(user.id);
      const chosenLanguage = normalizeSiteLanguage(
        (onboardingSession?.answers as any)?.language
      );

      // Load template data before transaction (AI mode starts blank; the
      // generation pipeline fills it in afterwards)
      const { getTemplateById, cloneTemplateState } = await import("@shared/websiteTemplates");
      const template = !isAiMode && templateId ? getTemplateById(templateId) : null;
      const stateData = template ? cloneTemplateState(template) : null;

      // Execute all database operations atomically in a transaction
      const result = await db.transaction(async (tx) => {
        // 1. Create website
        const [website] = await tx.insert(websites).values({
          ownerId: user.id,
          name,
          slug: uniqueSlug,
          setupType: isAiMode ? "ai" : (websiteType || "template"),
          status: "draft",
          language: chosenLanguage,
        }).returning();

        // 2. Create builder state
        await tx.insert(builderState).values({
          websiteId: website.id,
          state: stateData || {
            pages: [{
              id: 'home',
              name: 'Home',
              path: '/',
              components: []
            }],
            activePage: 'home',
            globalStyles: {
              primaryColor: '#3b82f6',
              secondaryColor: '#8b5cf6',
              fontFamily: 'Inter',
              backgroundColor: '#ffffff'
            }
          }
        });

        // 3. Onboarding completion is now handled in the checkout endpoint
        // when user clicks subscribe and goes to Stripe

        // 4. Increment total creators (upsert)
        await tx.execute(sql`
          INSERT INTO public_stats (id, total_creators, updated_at)
          VALUES (1, 1, NOW())
          ON CONFLICT (id) DO UPDATE SET
            total_creators = public_stats.total_creators + 1,
            updated_at = NOW()
        `);

        return website;
      });

      // Link the draft into the walkthrough session so uploads and the
      // agent have a website to attach to from the next turn on.
      try {
        await storage.upsertOnboardingSession(user.id, { websiteId: result.id, answers: { path: "ai" } });
        // A template site is finished the moment it is cloned, so the
        // "build yourself" path goes straight to the preview-and-decision
        // screen. The AI path is marked complete by the generator instead.
        if (!isAiMode) {
          await markGenerationComplete(result.id);
        }
      } catch (sessionErr) {
        console.error("Onboarding session link failed (non-fatal):", sessionErr);
      }

      res.status(201).json({
        websiteId: result.id,
        slug: uniqueSlug,
        message: "Website created successfully"
      });
    } catch (error: any) {
      console.error("Onboarding error:", error);
      res.status(500).json({ message: error.message });
    } finally {
      if (lockedUserId) aiOnboardingCreateLock.delete(lockedUserId);
    }
  });

  // Save selected plan during onboarding (before payment)
  app.post("/api/onboarding/select-plan", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }
      
      // Save the selected plan to profile (plan_slug field)
      await db.update(profiles)
        .set({ planSlug: planId })
        .where(eq(profiles.id, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Select plan error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Complete onboarding (called when user skips payment or after successful payment)
  app.post("/api/onboarding/complete", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const authUser = (req as any).user;
      
      // Get or create profile
      const { profile, error } = await getOrCreateProfile(userId, authUser);
      if (!profile) {
        return res.status(500).json({ message: error || "Kunne ikke finde brugerprofil." });
      }
      
      if (profile.onboardingCompleted) {
        return res.json({ success: true, message: "Onboarding already completed" });
      }
      
      // Mark onboarding as complete
      await db.update(profiles)
        .set({ onboardingCompleted: true })
        .where(eq(profiles.id, userId));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Complete onboarding error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============ ONBOARDING WALKTHROUGH (AI agent) ============
  // The session (transcript + answers + generation status) lives in
  // onboarding_sessions, so the walkthrough survives cleared browsers,
  // device switches and server restarts.

  // Resume point for the client.
  app.get("/api/onboarding/session", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const session = await storage.getOnboardingSession(userId);
      res.json({
        websiteId: session?.websiteId ?? null,
        transcript: session?.transcript ?? [],
        answers: session?.answers ?? {},
        genStatus: session?.genStatus ?? null,
      });
    } catch (error: any) {
      console.error("Onboarding session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Deterministic writes: palette/font choices, uploads and the DIY
  // fork are recorded by the CLIENT the moment the user clicks — they
  // never round-trip through the model, so a hex code or URL can't get
  // mangled in conversation.
  const recordHex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
  const recordBodySchema = z
    .object({
      path: z.enum(["ai", "diy"]).optional(),
      language: z.enum(SITE_LANGUAGES).optional(),
      websiteId: z.string().max(64).optional(),
      palette: z
        .object({
          id: z.string().max(64),
          name: z.string().max(120),
          description: z.string().max(600).default(""),
          colors: z.object({
            primary: recordHex,
            secondary: recordHex,
            accent: recordHex,
            background: recordHex,
            surface: recordHex,
            text: recordHex,
          }),
        })
        .optional(),
      fontPair: z
        .object({
          id: z.string().max(64),
          name: z.string().max(120),
          heading: z.string().max(80),
          body: z.string().max(80),
          scale: z.enum(["modern", "editorial", "classic", "bold"]),
          description: z.string().max(600).default(""),
        })
        .optional(),
      logo: z.object({ url: z.string().max(512), mediaId: z.string().max(64) }).optional(),
      ownImageUrls: z.array(z.string().max(512)).max(4).optional(),
      inspirationUrls: z.array(z.string().max(512)).max(3).optional(),
      desiredDomain: z
        .string()
        .trim()
        .toLowerCase()
        .max(253)
        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Ugyldigt domænenavn")
        .optional(),
    })
    .strict();

  app.post("/api/onboarding/session/record", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const parsed = recordBodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ugyldige felter" });
      }
      const body = parsed.data;

      const session = await storage.getOnboardingSession(userId);
      const patch: Record<string, unknown> = {};
      let websiteId = session?.websiteId ?? null;

      if (body.websiteId) {
        // The session may only point at a website this user owns.
        const website = await storage.getWebsite(body.websiteId);
        if (!website || website.ownerId !== userId) {
          return res.status(403).json({ message: "Ikke din hjemmeside." });
        }
        websiteId = body.websiteId;
      }

      if (body.path) patch.path = body.path;
      if (body.desiredDomain) patch.desiredDomain = body.desiredDomain;

      // The language choice is mirrored straight onto the website row, not
      // just kept in the session answers: everything downstream that needs it
      // (generation, publishing, the builder agent, transactional email) has
      // a websiteId but no onboarding session to read from.
      if (body.language) {
        patch.language = body.language;
        if (websiteId) {
          await storage.updateWebsite(websiteId, userId, { language: body.language });
        }
      }
      if (body.palette) patch.palette = body.palette;
      if (body.fontPair) patch.fontPair = body.fontPair;

      // Upload URLs must be media registered to the session's website —
      // the same ownership rule as the design-interview and the builder
      // agent's analyze_reference_image.
      if (body.logo || body.ownImageUrls || body.inspirationUrls) {
        if (!websiteId) {
          return res.status(400).json({ message: "Opret hjemmesiden før du uploader." });
        }
        const assets = await storage.getMediaAssets(websiteId);
        const owned = new Set(assets.map((a) => a.storagePath));
        const keepOwned = (urls: string[]) => urls.filter((u) => owned.has(u));
        if (body.logo) {
          if (!owned.has(body.logo.url)) {
            return res.status(403).json({ message: "Logoet tilhører ikke denne hjemmeside." });
          }
          patch.logoUrl = body.logo.url;
          patch.logoMediaId = body.logo.mediaId;
        }
        if (body.ownImageUrls) patch.ownImageUrls = keepOwned(body.ownImageUrls);
        if (body.inspirationUrls) patch.inspirationUrls = keepOwned(body.inspirationUrls);
      }

      const updated = await storage.upsertOnboardingSession(userId, {
        ...(body.websiteId ? { websiteId: body.websiteId } : {}),
        answers: patch as any,
      });
      res.json({ success: true, answers: updated.answers });
    } catch (error: any) {
      console.error("Onboarding record error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // One turn of the walkthrough agent (SSE, same event shape and client
  // transport as the builder agent).
  const onboardingAgentHits = new Map<string, number[]>();
  app.post("/api/onboarding/agent", requireAuth, async (req, res) => {
    const userId = (req as any).user?.id;
    const now = Date.now();
    const recentRuns = (onboardingAgentHits.get(userId) ?? []).filter((t) => now - t < 10 * 60 * 1000);
    if (recentRuns.length >= 20) {
      onboardingAgentHits.set(userId, recentRuns);
      return res.status(429).json({
        message: "For mange beskeder på kort tid. Vent et øjeblik og prøv igen.",
      });
    }
    recentRuns.push(now);
    onboardingAgentHits.set(userId, recentRuns);

    const bodySchema = z.object({ message: z.string().trim().min(1).max(4000) });
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ugyldig besked" });
    }

    try {
      const session = await storage.getOnboardingSession(userId);
      const transcript = [...(session?.transcript ?? [])];
      transcript.push({ role: "user", content: parsed.data.message });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      const send = (payload: unknown) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      };

      // Once a draft website exists its row is the source of truth for the
      // language - the session answers can be stale, or missing entirely on a
      // resumed or reused draft.
      const agentSiteId = session?.websiteId ?? null;
      const agentSite = agentSiteId ? await storage.getWebsite(agentSiteId) : undefined;

      const { runOnboardingAgent } = await import("./onboardingAgent");
      const outcome = await runOnboardingAgent({
        userId,
        websiteId: agentSiteId,
        transcript,
        answers: session?.answers ?? {},
        language: agentSite ? normalizeSiteLanguage(agentSite.language) : undefined,
        onEvent: send,
      });

      if (outcome.status === "spend_limit") {
        // A cost stop, not an outage: say so, and do not invite a retry that
        // cannot succeed.
        send({
          type: "error",
          message: outcome.message ?? "Samtalen nåede sit omkostningsloft.",
          reason: "spend_limit",
          canRetry: false,
        });
        return res.end();
      }

      if (outcome.status === "failed") {
        send({ type: "error", message: outcome.message ?? "Agenten fejlede" });
        return res.end();
      }

      transcript.push({
        role: "assistant",
        content: outcome.reply,
        ...(outcome.displays.length > 0 ? { displays: outcome.displays } : {}),
      });
      await storage.upsertOnboardingSession(userId, { transcript });

      send({
        type: "result",
        status: "completed",
        reply: outcome.reply,
        displays: outcome.displays,
        answers: outcome.answers,
        buildStarted: outcome.buildStarted,
      });
      res.end();
    } catch (error: any) {
      console.error("Onboarding agent error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: error?.message ?? "Agenten fejlede" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: error?.message ?? "Agenten fejlede" });
      }
    }
  });

  // Sign Up - Creates Supabase auth user with metadata and profile in our DB
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, fullName, phoneNumber } = req.body;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ message: "Supabase not configured" });
      }

      if (!email || !password || !fullName || !phoneNumber) {
        return res.status(400).json({ message: "All fields are required" });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Create auth user in Supabase with user metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone_number: phoneNumber,
          },
          emailRedirectTo: `${req.protocol}://${req.get('host')}/auth/callback`,
        },
      });

      if (authError) {
        return res.status(400).json({ message: authError.message });
      }

      if (!authData.user) {
        return res.status(400).json({ message: "Failed to create user" });
      }

      // Create profile in our database
      try {
        console.log(`[Signup] Creating profile for user ${authData.user.id} with email ${email}`);
        await storage.createProfile({
          id: authData.user.id,
          email,
          fullName,
          phoneNumber,
        });
        console.log(`[Signup] Profile created successfully for user ${authData.user.id}`);
      } catch (profileError: any) {
        // If profile already exists (e.g., user re-signing up), update it
        if (profileError.code === '23505') {
          console.log(`[Signup] Profile already exists for user ${authData.user.id}, updating...`);
          await storage.updateProfile(authData.user.id, { fullName, phoneNumber });
        } else {
          console.error("[Signup] Profile creation error:", profileError);
          console.error("[Signup] Profile creation error details:", {
            code: profileError.code,
            message: profileError.message,
            detail: profileError.detail
          });
        }
      }

      // If email confirmation is required, session will be null
      const needsEmailConfirmation = !authData.session;

      res.json({ 
        user: authData.user, 
        session: authData.session,
        needsEmailConfirmation,
        message: needsEmailConfirmation 
          ? "Please check your email to confirm your account" 
          : "Account created successfully"
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Sign In - Authenticates with Supabase
  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ message: "Supabase not configured" });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(401).json({ message: error.message });
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        return res.status(403).json({ 
          message: "Please confirm your email before signing in",
          needsEmailConfirmation: true 
        });
      }

      // Get profile from our database
      let profile = await storage.getProfile(data.user.id);
      console.log(`[Signin] Profile lookup for user ${data.user.id}: ${profile ? 'found' : 'not found'}`);

      // If profile doesn't exist, create it (regardless of user_metadata)
      if (!profile) {
        console.log(`[Signin] Creating profile for user ${data.user.id}...`);
        try {
          const userEmail = data.user.email;
          if (!userEmail) {
            console.error(`[Signin] Cannot create profile - no email for user ${data.user.id}`);
          } else {
            const fullName = data.user.user_metadata?.full_name || userEmail.split('@')[0] || '';
            const phoneNumber = data.user.user_metadata?.phone_number || '';
            
            profile = await storage.createProfile({
              id: data.user.id,
              email: userEmail,
              fullName,
              phoneNumber,
            });
            console.log(`[Signin] Profile created successfully for user ${data.user.id}`);
          }
        } catch (createError: any) {
          if (createError.code === '23505') {
            console.log(`[Signin] Profile already exists, fetching again...`);
            profile = await storage.getProfile(data.user.id);
          } else {
            console.error("[Signin] Error creating profile:", createError);
            console.error("[Signin] Error details:", {
              code: createError.code,
              message: createError.message,
              detail: createError.detail
            });
          }
        }
      }

      res.json({ 
        user: data.user, 
        profile,
        session: data.session 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verify session and get user data
  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { accessToken, refreshToken } = req.body;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(500).json({ message: "Supabase not configured" });
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error || !data.user) {
        return res.status(401).json({ message: "Invalid session" });
      }

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        return res.status(403).json({ 
          message: "Email not confirmed",
          needsEmailConfirmation: true 
        });
      }

      // Get or create profile
      let profile = await storage.getProfile(data.user.id);
      console.log(`[Verify] Profile lookup for user ${data.user.id}: ${profile ? 'found' : 'not found'}`);

      if (!profile) {
        console.log(`[Verify] Creating profile for user ${data.user.id}...`);
        try {
          const fullName = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '';
          const phoneNumber = data.user.user_metadata?.phone_number || '';
          
          profile = await storage.createProfile({
            id: data.user.id,
            email: data.user.email!,
            fullName,
            phoneNumber,
          });
          console.log(`[Verify] Profile created successfully for user ${data.user.id}`);
        } catch (createError: any) {
          // If profile already exists (race condition), try to fetch it again
          if (createError.code === '23505') {
            console.log(`[Verify] Profile already exists, fetching again...`);
            profile = await storage.getProfile(data.user.id);
          } else {
            console.error("[Verify] Error creating profile:", createError);
            console.error("[Verify] Error details:", {
              code: createError.code,
              message: createError.message,
              detail: createError.detail
            });
          }
        }
      }

      res.json({ 
        user: data.user, 
        profile,
        session: data.session 
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Profile - Protected route, user can only access their own profile
  app.get("/api/profile/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // User can only access their own profile
      if (user.id !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const profile = await storage.getProfile(req.params.id);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update Profile - Protected route, user can only update their own profile
  app.patch("/api/profile/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      
      // User can only update their own profile
      if (user.id !== req.params.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Strict allowlist: only self-service fields (fullName, phoneNumber).
      // Privileged fields (isAdmin, plan/subscription state, stripeCustomerId, ...)
      // are rejected outright - see updateProfileSchema in shared/schema.ts.
      const validatedData = updateProfileSchema.parse(req.body);
      const profile = await storage.updateProfile(req.params.id, validatedData);

      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(profile);
    } catch (error: any) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid profile update", issues: error.issues });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // ============ WEBSITE ROUTES ============

  // Get all websites for authenticated user
  app.get("/api/websites", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const websites = await storage.getWebsitesByOwner(user.id);
      res.json(websites);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single website - owner, or an administrator (read-only metadata).
  // Admin responses carry a narrow adminContext (owner id + display name)
  // so the builder can show the "editing as administrator" banner without
  // opening cross-user profile access.
  app.get("/api/websites/:id", requireAuth, requireWebsitePermission("readBuilder"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);

      if (access.mode === "admin") {
        const ownerProfile = await storage.getProfile(access.ownerUserId);
        const adminContext: WebsiteAdminContext = {
          ownerId: access.ownerUserId,
          ownerDisplayName:
            ownerProfile?.fullName?.trim() || ownerProfile?.email || "Unknown owner",
        };
        const payload: WebsiteWithAccess = { ...access.website, adminContext };
        return res.json(payload);
      }

      res.json(access.website);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create website
  app.post("/api/websites", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, setupType, templateId, templateCustomization } = req.body;

      if (!name || !setupType) {
        return res.status(400).json({ message: "Name and setup type are required" });
      }

      const limitCheck = await checkWebsiteLimit(user.id);
      if (!limitCheck.allowed) {
        return res.status(403).json({ 
          message: limitCheck.reason,
          code: 'PLAN_LIMIT_EXCEEDED',
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit,
          planSlug: limitCheck.planSlug
        });
      }

      // Generate a URL-friendly slug from the name
      const baseSlug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'website';
      const timestamp = Date.now().toString(36);
      const slug = `${baseSlug}-${timestamp}`;

      const website = await storage.createWebsite({
        ownerId: user.id,
        name,
        slug,
        setupType,
        status: "draft",
      });

      // If customized setup, create empty inputs record
      if (setupType === "customized") {
        await storage.createWebsiteInputs({
          websiteId: website.id,
        });
      }

      // If template customization is provided, apply it server-side (secure)
      if (templateCustomization && templateCustomization.templateId) {
        const { applyCustomizationById } = await import("@shared/websiteTemplates");
        const builderState = applyCustomizationById(templateCustomization.templateId, {
          businessName: templateCustomization.businessName,
          colorPresetId: templateCustomization.colorPresetId,
          fontPresetId: templateCustomization.fontPresetId,
        });
        
        if (builderState) {
          await storage.createBuilderState(website.id, builderState);
        }
      }
      // Otherwise, if a template is specified, apply it to the builder state
      else if (templateId) {
        const { getTemplateById, cloneTemplateState } = await import("@shared/websiteTemplates");
        const template = getTemplateById(templateId);
        
        if (template) {
          const builderState = cloneTemplateState(template);
          await storage.createBuilderState(website.id, builderState);
        }
      }

      res.status(201).json(website);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update website
  // Owner-editable fields ONLY. This used to pass req.body straight to
  // the update, which would have let an owner rewrite billing fields
  // (plan, subscription ids) on their own row.
  const updateWebsiteBodySchema = z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code")
        .optional(),
    })
    .strict();

  app.patch("/api/websites/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const parsed = updateWebsiteBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid fields", errors: parsed.error.flatten().fieldErrors });
      }
      const website = await storage.updateWebsite(req.params.id, user.id, parsed.data);

      if (!website) {
        return res.status(404).json({ message: "Website not found or access denied" });
      }

      res.json(website);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete website
  app.delete("/api/websites/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const deleted = await storage.deleteWebsite(req.params.id, user.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Website not found or access denied" });
      }

      res.json({ message: "Website deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ WEBSITE INPUTS ROUTES ============

  // Get website inputs
  app.get("/api/websites/:id/inputs", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website || website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const inputs = await storage.getWebsiteInputs(req.params.id);
      res.json(inputs || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update website inputs
  app.patch("/api/websites/:id/inputs", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website || website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      let inputs = await storage.getWebsiteInputs(req.params.id);
      
      if (!inputs) {
        inputs = await storage.createWebsiteInputs({
          websiteId: req.params.id,
          ...req.body,
        });
      } else {
        inputs = await storage.updateWebsiteInputs(req.params.id, req.body);
      }

      res.json(inputs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ BUILDER STATE ROUTES ============

  // Get builder state (creates default if none exists).
  // Owner or administrator (readBuilder permission).
  app.get("/api/websites/:id/builder", requireAuth, requireWebsitePermission("readBuilder"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      let builderState = await storage.getBuilderState(req.params.id);

      // Create default builder state if none exists. This is a write, so an
      // admin opening a never-opened client site must leave an audit trail.
      if (!builderState) {
        builderState = await storage.createBuilderState(req.params.id);
        await recordAdminAudit(access, {
          action: "builder.create-default",
          resourceType: "builderState",
          resourceId: req.params.id,
          httpMethod: "GET",
          route: "/api/websites/:id/builder",
        });
      }

      // Migrate legacy element-based state to component-based state, then
      // bring the structure up to date (stored navigation, shared chrome,
      // page roles). Server-side readers - the agent, /ai/apply, the
      // architect build - work on exactly what this route persisted, so a
      // website must never leave here in the pre-structure shape.
      const migratedState = migrateSiteStructure(migrateBuilderState(builderState.state));

      // If migration changed the state, persist it. Guarded on the revision
      // we just read: opening the editor must never roll back a save that
      // landed in between. The migration is a pure function of the stored
      // state, so on a collision the response below still serves the
      // migrated copy and the next reader persists it.
      if (JSON.stringify(migratedState) !== JSON.stringify(builderState.state)) {
        const savedMigration = await saveBuilderStateGuarded(
          req.params.id,
          migratedState,
          builderState.revision
        );
        if (savedMigration.ok) {
          builderState = { ...builderState, state: migratedState, revision: savedMigration.revision };
        }
        // Also a write triggered merely by opening the builder.
        await recordAdminAudit(access, {
          action: "builder.migrate-legacy-state",
          resourceType: "builderState",
          resourceId: req.params.id,
          httpMethod: "GET",
          route: "/api/websites/:id/builder",
        });
      }

      res.json({
        ...builderState,
        state: migratedState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update builder state. Owner or administrator (updateBuilder permission).
  // Successful admin saves are recorded in the append-only audit log with a
  // structural summary (page ids / counts), never the state content itself.
  app.patch("/api/websites/:id/builder", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      const { state, expectedRevision } = req.body;

      if (!state) {
        return res.status(400).json({ message: "State is required" });
      }

      // Strip unsafe SVG markup and enforce node limits inside custom
      // components before anything is persisted. (Inline illustration markup
      // is then moved into the SVG asset store by the persistence layer
      // itself — storage.create/updateBuilderState — so every save path
      // shares the same extraction.)
      sanitizeBuilderStateCustomContent(state);

      const previous = await storage.getBuilderState(req.params.id);

      let builderState;
      if (!previous) {
        builderState = await storage.createBuilderState(req.params.id, state);
      } else {
        // Compare-and-swap when the client tells us what it was editing.
        // A running build saves between every step; without this an autosave
        // holding a two-second-old copy of the canvas would quietly undo the
        // step that just landed. Clients that send no revision keep the old
        // last-write-wins behaviour.
        const expected =
          typeof expectedRevision === "number" && Number.isFinite(expectedRevision)
            ? expectedRevision
            : undefined;
        builderState = await storage.updateBuilderState(req.params.id, state, expected);
        if (!builderState) {
          return res.status(409).json({
            message:
              "Websitet er ændret et andet sted — måske af en AI-bygning. Genindlæs siden, " +
              "så du arbejder videre på den nyeste version.",
            revision: previous.revision,
            state: previous.state,
          });
        }
      }

      // An explicit save changes the site under any pending onboarding
      // decision: bump the revision so an unpaid approval has to be renewed.
      await bumpSiteRevision(req.params.id).catch(() => {});

      // Supersede any pending design-direction proposals so stale experimental
      // directions cannot be applied on top of a site that has moved on.
      const { supersedePendingProposals } = await import("./proposalStore");
      supersedePendingProposals(req.params.id);

      // Mutation succeeded - record it if this was an admin editing a
      // client's website (no-op for owners).
      await recordAdminAudit(access, {
        action: "builder.update",
        resourceType: "builderState",
        resourceId: req.params.id,
        httpMethod: "PATCH",
        route: "/api/websites/:id/builder",
        // Thunk: only computed in admin mode, so owner autosaves (every 2s)
        // never pay for a diff that would be discarded.
        changedSummary: () =>
          summarizeBuilderStateChange(
            (previous?.state ?? null) as Partial<BuilderStateData> | null,
            state
          ),
      });

      res.json(builderState);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ MANAGEMENT ROUTES (Orders, Bookings, Submissions, Customers) ============

  // Get orders for a website
  app.get("/api/websites/:id/orders", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const orders = await storage.getOrders(req.params.id);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get bookings for a website
  app.get("/api/websites/:id/bookings", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const bookings = await storage.getBookings(req.params.id);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a booking as the website owner (from the manage calendar)
  app.post("/api/websites/:id/bookings", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("booking.create", "booking"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const {
        serviceId, service, customerName, customerEmail, customerPhone,
        date, time, durationMinutes, teamMemberId, place, notes, status,
        sendReminder, price, currency, sendConfirmationEmail,
      } = req.body || {};

      if (!customerName || !service || !date || !time) {
        return res.status(400).json({ message: "Kundenavn, ydelse, dato og tidspunkt er påkrævet" });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Ugyldig dato. Brug formatet ÅÅÅÅ-MM-DD" });
      }
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ message: "Ugyldigt tidspunkt. Brug formatet TT:MM" });
      }

      // Resolve duration: explicit > service default > 60
      let duration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 0;
      if (!duration && serviceId) {
        const svc = await storage.getBookingService(serviceId, req.params.id);
        if (svc) duration = svc.durationMinutes || 0;
      }
      if (!duration) duration = 60;

      if (teamMemberId) {
        const member = await storage.getTeamMember(teamMemberId, req.params.id);
        if (!member) {
          return res.status(400).json({ message: "Teammedlemmet findes ikke" });
        }
        const conflict = await storage.findMemberConflict(req.params.id, teamMemberId, date, time, duration);
        if (conflict) {
          return res.status(409).json({
            message: `${member.name} er optaget på dette tidspunkt`,
            code: "MEMBER_CONFLICT",
            conflictBookingId: conflict.id,
          });
        }
      }

      if (serviceId) {
        const conflict = await storage.findServiceConflict(req.params.id, serviceId, date, time, duration);
        if (conflict) {
          return res.status(409).json({
            message: "Tidspunktet er allerede booket for denne ydelse",
            code: "SLOT_UNAVAILABLE",
            conflictBookingId: conflict.id,
          });
        }
      }

      const booking = await storage.createBooking({
        websiteId: req.params.id,
        serviceId: serviceId || null,
        service,
        customerName,
        customerEmail: customerEmail || '',
        customerPhone: customerPhone || null,
        date: new Date(date + 'T00:00:00'),
        time,
        durationMinutes: duration,
        teamMemberId: teamMemberId || null,
        place: place || null,
        notes: notes || null,
        status: status || 'confirmed',
        sendReminder: sendReminder !== false,
        price: price || null,
        currency: currency || null,
      });

      // Optimistic post-insert verification (closes the create race window)
      const raceConflict = await storage.findPlacementConflict(req.params.id, booking.id);
      if (raceConflict) {
        await storage.deleteBooking(booking.id, req.params.id);
        return res.status(409).json({
          message: "Tidspunktet blev optaget af en anden booking i mellemtiden",
          code: "SLOT_UNAVAILABLE",
          conflictBookingId: raceConflict.id,
        });
      }

      // An owner booking on top of a matching open slot claims the slot so it
      // stops being offered as bookable. Compatibility mirrors how slots are
      // offered publicly: a slot bound to a specific service/person only
      // matches bookings for that service/person (unbound = matches any).
      try {
        const timeKey = time.slice(0, 5);
        const daySlots = await storage.getOpenSlots(req.params.id, date, date);
        const matching = daySlots
          .filter(s => s.status === 'open' && (s.time || '').slice(0, 5) === timeKey)
          // Unrestricted slot (no serviceId/teamMemberId) matches any booking.
          // Restricted slot only matches when the booking explicitly carries the same ID.
          .filter(s => !s.serviceId || s.serviceId === serviceId)
          .filter(s => !s.teamMemberId || s.teamMemberId === teamMemberId)
          .sort((a, b) => {
            // Prefer the most specific slot when several match the same time
            const score = (s: typeof daySlots[number]) =>
              (s.serviceId && s.serviceId === serviceId ? 2 : 0) +
              (s.teamMemberId && s.teamMemberId === teamMemberId ? 1 : 0);
            return score(b) - score(a);
          });
        for (const slot of matching) {
          const claimed = await storage.claimOpenSlot(slot.id, req.params.id);
          if (claimed) {
            await storage.linkOpenSlotBooking(slot.id, booking.id);
            break;
          }
        }
      } catch (slotErr) {
        console.error('[Booking] Kunne ikke reservere matchende ledigt tidspunkt:', slotErr);
      }

      if (booking.customerEmail && sendConfirmationEmail !== false) {
        try {
          const websiteUrl = website.deploymentUrl || undefined;
          await emailService.sendBookingConfirmation(booking, booking.customerEmail, booking.service, websiteUrl);
        } catch (emailErr) {
          console.error(`[Booking] Failed to send owner-created confirmation email:`, emailErr);
        }
      }

      res.status(201).json(booking);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ TEAM MEMBERS ROUTES ============

  const sanitizeMemberAvailability = (value: unknown): { dayOfWeek: number; startTime: string; endTime: string }[] => {
    if (!Array.isArray(value)) return [];
    const windows: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
    for (const w of value) {
      if (!w || typeof w !== 'object') continue;
      const dayOfWeek = (w as any).dayOfWeek;
      const startTime = (w as any).startTime;
      const endTime = (w as any).endTime;
      if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) continue;
      if (typeof startTime !== 'string' || !/^\d{2}:\d{2}$/.test(startTime)) continue;
      if (typeof endTime !== 'string' || !/^\d{2}:\d{2}$/.test(endTime)) continue;
      if (startTime >= endTime) continue;
      windows.push({ dayOfWeek, startTime, endTime });
    }
    return windows;
  };

  app.get("/api/websites/:id/team-members", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const members = await storage.getTeamMembers(req.params.id);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/websites/:id/team-members", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("teamMember.create", "teamMember"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { name, role, email, phone, color, serviceIds, availability, active, sortOrder } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: "Navn er påkrævet" });
      }

      const member = await storage.createTeamMember({
        websiteId: req.params.id,
        name: name.trim(),
        role: role || null,
        email: email || null,
        phone: phone || null,
        color: typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#6366f1',
        serviceIds: Array.isArray(serviceIds) ? serviceIds.filter((s: unknown) => typeof s === 'string') : [],
        availability: sanitizeMemberAvailability(availability),
        active: active !== false,
        sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      });
      res.status(201).json(member);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/websites/:id/team-members/:memberId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("teamMember.update", "teamMember", "memberId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { name, role, email, phone, color, serviceIds, availability, active, sortOrder } = req.body || {};
      const data: Record<string, unknown> = {};
      if (name !== undefined) {
        if (typeof name !== 'string' || !name.trim()) {
          return res.status(400).json({ message: "Navn er påkrævet" });
        }
        data.name = name.trim();
      }
      if (role !== undefined) data.role = role || null;
      if (email !== undefined) data.email = email || null;
      if (phone !== undefined) data.phone = phone || null;
      if (color !== undefined && typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) data.color = color;
      if (serviceIds !== undefined) data.serviceIds = Array.isArray(serviceIds) ? serviceIds.filter((s: unknown) => typeof s === 'string') : [];
      if (availability !== undefined) data.availability = sanitizeMemberAvailability(availability);
      if (active !== undefined) data.active = active === true;
      if (sortOrder !== undefined && typeof sortOrder === 'number') data.sortOrder = sortOrder;

      const member = await storage.updateTeamMember(req.params.memberId, req.params.id, data);
      if (!member) return res.status(404).json({ message: "Teammedlemmet findes ikke" });
      res.json(member);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/websites/:id/team-members/:memberId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("teamMember.delete", "teamMember", "memberId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const member = await storage.getTeamMember(req.params.memberId, req.params.id);
      if (!member) return res.status(404).json({ message: "Teammedlemmet findes ikke" });

      await storage.deleteTeamMember(req.params.memberId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ OPEN SLOTS ROUTES ============

  app.get("/api/websites/:id/open-slots", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { from, to } = req.query;
      const slots = await storage.getOpenSlots(
        req.params.id,
        typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
        typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
      );
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/websites/:id/open-slots", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("openSlot.create", "openSlot"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { date, time, durationMinutes, serviceId, teamMemberId, notes } = req.body || {};
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Ugyldig dato. Brug formatet ÅÅÅÅ-MM-DD" });
      }
      if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ message: "Ugyldigt tidspunkt. Brug formatet TT:MM" });
      }
      if (teamMemberId) {
        const member = await storage.getTeamMember(teamMemberId, req.params.id);
        if (!member) return res.status(400).json({ message: "Teammedlemmet findes ikke" });
      }

      const slot = await storage.createOpenSlot({
        websiteId: req.params.id,
        serviceId: serviceId || null,
        teamMemberId: teamMemberId || null,
        date,
        time,
        durationMinutes: typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 30,
        status: 'open',
        notes: notes || null,
      });
      res.status(201).json(slot);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/websites/:id/open-slots/:slotId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("openSlot.update", "openSlot", "slotId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const existing = await storage.getOpenSlot(req.params.slotId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Ledig tid ikke fundet" });
      if (existing.status === 'booked') {
        return res.status(409).json({ message: "Tiden er allerede booket og kan ikke ændres" });
      }

      const { date, time, durationMinutes, serviceId, teamMemberId, notes } = req.body || {};
      const data: Record<string, unknown> = {};
      if (date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ message: "Ugyldig dato" });
        data.date = date;
      }
      if (time !== undefined) {
        if (!/^\d{2}:\d{2}$/.test(time)) return res.status(400).json({ message: "Ugyldigt tidspunkt" });
        data.time = time;
      }
      if (durationMinutes !== undefined) {
        if (typeof durationMinutes !== 'number' || durationMinutes <= 0) return res.status(400).json({ message: "Ugyldig varighed" });
        data.durationMinutes = durationMinutes;
      }
      if (serviceId !== undefined) data.serviceId = serviceId || null;
      if (teamMemberId !== undefined) {
        if (teamMemberId) {
          const member = await storage.getTeamMember(teamMemberId, req.params.id);
          if (!member) return res.status(400).json({ message: "Teammedlemmet findes ikke" });
        }
        data.teamMemberId = teamMemberId || null;
      }
      if (notes !== undefined) data.notes = notes || null;

      const slot = await storage.updateOpenSlot(req.params.slotId, req.params.id, data);
      res.json(slot);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/websites/:id/open-slots/:slotId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("openSlot.delete", "openSlot", "slotId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const existing = await storage.getOpenSlot(req.params.slotId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Ledig tid ikke fundet" });

      await storage.deleteOpenSlot(req.params.slotId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get form submissions for a website
  app.get("/api/websites/:id/submissions", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const submissions = await storage.getFormSubmissions(req.params.id);
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get customers for a website — identity rows plus live aggregates
  // (paid-order count, lifetime spend, bookings) computed from orders
  // and bookings at read time.
  app.get("/api/websites/:id/customers", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const customers = await storage.getCustomersWithStats(req.params.id);
      res.json({ customers, currency: website.currency });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Client detail view: bookings, submissions, and internal note ──────────

  // Returns one customer row (with internalNote from metadata), their
  // customer-site bookings matched by email, and form submissions whose data
  // contains a matching email value.
  app.get(
    "/api/websites/:id/customers/:customerId",
    requireAuth,
    requireWebsitePermission("readManage"),
    async (req, res) => {
      try {
        const websiteId  = req.params.id;
        const customerId = req.params.customerId;

        const [customer] = await db.select().from(customersTable).where(
          andOp(eq(customersTable.id, customerId), eq(customersTable.websiteId, websiteId))
        );
        if (!customer) return res.status(404).json({ message: "Kunde ikke fundet" });

        // Customer-site bookings filtered at the DB level:
        //   – website scoped
        //   – context = customer_site (excludes platform-onboarding bookings)
        //   – email case-insensitive match
        const emailLower = customer.email.toLowerCase();
        const customerBookings = (await db.select().from(bookingsTable).where(
          andOp(
            eq(bookingsTable.websiteId, websiteId),
            eq(bookingsTable.context, "customer_site"),
            sql`lower(${bookingsTable.customerEmail}) = ${emailLower}`,
          )
        )).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Form submissions: match email against any top-level string value in data.
        // Submissions lack a dedicated email column so this JS filter is intentional;
        // the set is bounded to one website and is typically small.
        const allSubmissions = await db.select().from(formSubmissionsTable).where(
          eq(formSubmissionsTable.websiteId, websiteId)
        );
        const customerSubmissions = allSubmissions
          .filter(s => {
            const data = (s.data ?? {}) as Record<string, any>;
            return Object.values(data).some(
              v => typeof v === "string" && v.toLowerCase() === emailLower
            );
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        res.json({
          customer: {
            ...customer,
            internalNote: ((customer.metadata as any)?.internalNote as string) ?? null,
          },
          bookings:     customerBookings,
          submissions:  customerSubmissions,
        });
      } catch (err: any) {
        console.error("Customer detail error:", err);
        res.status(500).json({ message: "Kunne ikke hente kundedata" });
      }
    }
  );

  // Save an internal admin note for a customer (stored in metadata.internalNote,
  // max 5000 chars). Clearly not a clinical journal: no audit retention policy.
  //
  // Write ordering — the client sends `clientTs: Date.now()` with every PATCH.
  // The server stores that timestamp as `noteTs` in metadata.
  //
  // Race safety: the noteTs comparison lives entirely inside the SQL UPDATE
  // WHERE clause.  PostgreSQL evaluates it atomically at the row level, so two
  // concurrent PATCH requests cannot both pass — only the one with the higher
  // clientTs can commit; the other sees 0 rows updated and gets superseded:true.
  // A separate application-level read-then-compare would be a TOCTOU race.
  app.patch(
    "/api/websites/:id/customers/:customerId/note",
    requireAuth,
    requireWebsitePermission("updateManage"),
    auditManageMutation("customer.note", "customer", "customerId"),
    async (req, res) => {
      try {
        const websiteId  = req.params.id;
        const customerId = req.params.customerId;
        const { note, clientTs } = req.body;

        if (typeof note !== "string") {
          return res.status(400).json({ message: "note skal være en tekststreng" });
        }

        // Read once to verify the customer exists and to merge existing metadata
        // fields.  The timestamp guard itself is in the UPDATE WHERE — not here.
        const [customer] = await db.select().from(customersTable).where(
          andOp(eq(customersTable.id, customerId), eq(customersTable.websiteId, websiteId))
        );
        if (!customer) return res.status(404).json({ message: "Kunde ikke fundet" });

        const existingMeta = ((customer.metadata as Record<string, any>) ?? {});
        const trimmed = note.trim().slice(0, 5000);
        const ts = typeof clientTs === "number" ? clientTs : Date.now();

        const updatedMeta = {
          ...existingMeta,
          internalNote: trimmed || null,
          // Store the winning timestamp so subsequent PATCHes can be compared.
          noteTs: ts,
        };

        // Atomic compare-and-set: the WHERE predicate `noteTs IS NULL OR noteTs < ts`
        // is evaluated inside a single DB statement, so two concurrent PATCHes cannot
        // both win — whichever arrives first with the higher ts wins; the other sees
        // 0 rows in RETURNING and receives superseded:true.
        const updated = await db.update(customersTable)
          .set({ metadata: updatedMeta, updatedAt: new Date() })
          .where(andOp(
            eq(customersTable.id, customerId),
            eq(customersTable.websiteId, websiteId),
            sql`(${customersTable.metadata}->>'noteTs' IS NULL
                 OR (${customersTable.metadata}->>'noteTs')::bigint < ${ts})`
          ))
          .returning({ id: customersTable.id });

        if (updated.length === 0) {
          // A later-timestamped write already committed — this write is a no-op.
          return res.json({ ok: true, superseded: true });
        }

        res.json({ ok: true });
      } catch (err: any) {
        console.error("Customer note error:", err);
        res.status(500).json({ message: "Kunne ikke gemme notat" });
      }
    }
  );

  // Update order status
  app.patch("/api/websites/:id/orders/:orderId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("order.update", "order", "orderId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      // Whitelist (the previous raw req.body passthrough let any column
      // through, including payment state). sendShippedEmail is an action
      // flag, not a column.
      const patchSchema = z.object({
        status: z.string().max(50).optional(),
        deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        trackingNumber: z.string().max(120).nullable().optional(),
        trackingCarrier: z.string().max(60).nullable().optional(),
        sendShippedEmail: z.boolean().optional(),
      });
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid order update" });
      }
      const { sendShippedEmail, deliveryDate, ...rest } = parsed.data;

      const order = await storage.updateOrder(req.params.orderId, req.params.id, {
        ...rest,
        ...(deliveryDate !== undefined
          ? { deliveryDate: deliveryDate ? new Date(`${deliveryDate}T00:00:00`) : null }
          : {}),
      });
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Optional shipping-confirmation email with delivery date + tracking.
      // Gated by emailSettings.shippingConfirmationEnabled inside the service.
      if (sendShippedEmail && order.customerEmail) {
        const sent = await emailService.sendOrderShipped(
          order,
          order.customerEmail,
          website.deploymentUrl || undefined
        );
        if (sent) {
          await storage.updateOrder(req.params.orderId, req.params.id, {
            shippedEmailSentAt: new Date(),
          });
          order.shippedEmailSentAt = new Date();
        }
      }

      res.json(order);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a booking (status, reschedule, reassign, details)
  app.patch("/api/websites/:id/bookings/:bookingId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("booking.update", "booking", "bookingId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      // Get the original booking to check for status changes
      const originalBooking = await storage.getBooking(req.params.bookingId, req.params.id);
      if (!originalBooking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const body = req.body || {};
      const data: Record<string, unknown> = {};

      // Whitelisted updatable fields
      if (body.status !== undefined) data.status = body.status;
      if (body.notes !== undefined) data.notes = body.notes || null;
      if (body.place !== undefined) data.place = body.place || null;
      if (body.sendReminder !== undefined) data.sendReminder = body.sendReminder === true;
      if (body.customerName !== undefined) data.customerName = body.customerName;
      if (body.customerEmail !== undefined) data.customerEmail = body.customerEmail;
      if (body.customerPhone !== undefined) data.customerPhone = body.customerPhone || null;
      if (body.service !== undefined) data.service = body.service;
      if (body.serviceId !== undefined) data.serviceId = body.serviceId || null;
      if (body.price !== undefined) data.price = body.price || null;
      if (body.currency !== undefined) data.currency = body.currency || null;

      // Reschedule fields
      let newDateStr: string | undefined;
      if (body.date !== undefined) {
        if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
          newDateStr = body.date;
          data.date = new Date(body.date + 'T00:00:00');
        } else {
          const parsed = new Date(body.date);
          if (isNaN(parsed.getTime())) {
            return res.status(400).json({ message: "Ugyldig dato" });
          }
          newDateStr = parsed.toISOString().slice(0, 10);
          data.date = parsed;
        }
      }
      if (body.time !== undefined) {
        if (typeof body.time !== 'string' || !/^\d{2}:\d{2}$/.test(body.time)) {
          return res.status(400).json({ message: "Ugyldigt tidspunkt. Brug formatet TT:MM" });
        }
        data.time = body.time;
      }
      if (body.durationMinutes !== undefined) {
        if (typeof body.durationMinutes !== 'number' || body.durationMinutes <= 0) {
          return res.status(400).json({ message: "Ugyldig varighed" });
        }
        data.durationMinutes = body.durationMinutes;
      }
      if (body.teamMemberId !== undefined) {
        if (body.teamMemberId) {
          const member = await storage.getTeamMember(body.teamMemberId, req.params.id);
          if (!member) return res.status(400).json({ message: "Teammedlemmet findes ikke" });
        }
        data.teamMemberId = body.teamMemberId || null;
      }

      // Conflict checks when the effective time/assignee changes, or when a
      // cancelled booking is reactivated (its old time may have been retaken)
      const timingChanged = body.date !== undefined || body.time !== undefined
        || body.durationMinutes !== undefined || body.teamMemberId !== undefined;
      const reactivating = body.status !== undefined && body.status !== 'cancelled'
        && originalBooking.status === 'cancelled';
      if (timingChanged || reactivating) {
        const effDate = newDateStr ?? new Date(originalBooking.date).toISOString().slice(0, 10);
        const effTime = (body.time !== undefined ? body.time : originalBooking.time) as string | null;
        const effDuration = (body.durationMinutes !== undefined ? body.durationMinutes : originalBooking.durationMinutes) || 60;
        const effMember = body.teamMemberId !== undefined ? (body.teamMemberId || null) : originalBooking.teamMemberId;
        const effServiceId = body.serviceId !== undefined ? (body.serviceId || null) : originalBooking.serviceId;

        if (effTime && /^\d{2}:\d{2}$/.test(effTime)) {
          if (effMember) {
            const conflict = await storage.findMemberConflict(req.params.id, effMember, effDate, effTime, effDuration, originalBooking.id);
            if (conflict) {
              return res.status(409).json({
                message: "Teammedlemmet er optaget på dette tidspunkt",
                code: "MEMBER_CONFLICT",
                conflictBookingId: conflict.id,
              });
            }
          }
          if (effServiceId) {
            const conflict = await storage.findServiceConflict(req.params.id, effServiceId, effDate, effTime, effDuration, originalBooking.id);
            if (conflict) {
              return res.status(409).json({
                message: "Tidspunktet er allerede booket for denne ydelse",
                code: "SLOT_UNAVAILABLE",
                conflictBookingId: conflict.id,
              });
            }
          }
        }
      }

      const booking = await storage.updateBooking(req.params.bookingId, req.params.id, data);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Send email on status change or reschedule
      const rescheduled = (body.date !== undefined || body.time !== undefined)
        && (new Date(booking.date).getTime() !== new Date(originalBooking.date).getTime() || booking.time !== originalBooking.time);

      // A cancelled or rescheduled booking that claimed an open slot reopens it
      // (the slot's time is offered again; the booking no longer occupies it)
      if ((body.status === 'cancelled' && originalBooking.status !== 'cancelled') || rescheduled) {
        try {
          await storage.releaseOpenSlotByBooking(req.params.id, booking.id);
        } catch (slotErr) {
          console.error(`Failed to release open slot for cancelled/moved booking:`, slotErr);
        }
      }
      if (booking.customerEmail) {
        const websiteUrl = website.deploymentUrl || undefined;
        try {
          if (body.status === 'cancelled' && originalBooking.status !== 'cancelled') {
            await emailService.sendBookingCancelled(
              booking,
              booking.customerEmail,
              booking.service
            );
            console.log(`Booking cancelled email sent to ${booking.customerEmail}`);
          } else if (body.status === 'completed' && !rescheduled) {
            // Marking a past appointment as held is bookkeeping, not a change
            // the customer needs an email about.
          } else if ((body.status && originalBooking.status !== body.status) || rescheduled) {
            await emailService.sendBookingUpdated(
              booking,
              booking.customerEmail,
              booking.service,
              websiteUrl
            );
            console.log(`Booking updated email sent to ${booking.customerEmail}`);
          }
        } catch (emailErr) {
          console.error(`Failed to send booking update email:`, emailErr);
        }
      }

      res.json(booking);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ PRODUCTS ROUTES ============

  // Get products for a website
  app.get("/api/websites/:id/products", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const products = await storage.getProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a product
  app.post("/api/websites/:id/products", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("product.create", "product"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      // Sanitize images array - remove empty strings
      const images = (req.body.images || []).map((img: string) => img?.trim()).filter((img: string) => img);
      
      const product = await storage.createProduct({
        websiteId: req.params.id,
        name: req.body.name,
        description: req.body.description,
        longDescription: req.body.longDescription,
        price: req.body.price || "0",
        currency: req.body.currency || "USD",
        imageUrl: req.body.imageUrl,
        images,
        status: req.body.status || "active",
        inventory: req.body.inventory,
        category: req.body.category,
      });
      res.status(201).json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a product
  app.patch("/api/websites/:id/products/:productId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("product.update", "product", "productId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const product = await storage.updateProduct(req.params.productId, req.params.id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a product
  app.delete("/api/websites/:id/products/:productId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("product.delete", "product", "productId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const deleted = await storage.deleteProduct(req.params.productId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PRODUCT REVIEWS MANAGEMENT
  // ============================================

  // Get all reviews for a product (authenticated)
  app.get("/api/websites/:id/products/:productId/reviews", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { productReviews } = await import("@shared/schema");
      const reviews = await db.select().from(productReviews)
        .where(eq(productReviews.productId, req.params.productId));
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new review
  app.post("/api/websites/:id/products/:productId/reviews", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("productReview.create", "productReview", "productId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { name, rating, text, verified } = req.body;
      
      if (!name || typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Name and rating (1-5) are required" });
      }

      const { productReviews } = await import("@shared/schema");
      const [review] = await db.insert(productReviews).values({
        productId: req.params.productId,
        websiteId: req.params.id,
        name,
        rating,
        text: text || null,
        verified: verified || false,
      }).returning();
      
      res.json(review);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a review
  app.patch("/api/websites/:id/products/:productId/reviews/:reviewId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("productReview.update", "productReview", "reviewId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { name, rating, text, verified } = req.body;
      const { productReviews } = await import("@shared/schema");
      
      const [updated] = await db.update(productReviews)
        .set({
          ...(name !== undefined && { name }),
          ...(rating !== undefined && { rating }),
          ...(text !== undefined && { text }),
          ...(verified !== undefined && { verified }),
        })
        .where(eq(productReviews.id, req.params.reviewId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a review
  app.delete("/api/websites/:id/products/:productId/reviews/:reviewId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("productReview.delete", "productReview", "reviewId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { productReviews } = await import("@shared/schema");
      const [deleted] = await db.delete(productReviews)
        .where(eq(productReviews.id, req.params.reviewId))
        .returning();
      
      if (!deleted) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get active products (for published sites)
  app.get("/api/public/websites/:id/products", async (req, res) => {
    try {
      const products = await storage.getActiveProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get a single product by ID (for product detail pages)
  app.get("/api/public/websites/:id/products/:productId", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.productId);
      if (!product || product.websiteId !== req.params.id || product.status !== 'active') {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get product reviews
  app.get("/api/public/websites/:id/products/:productId/reviews", async (req, res) => {
    try {
      const { productReviews: reviewsTable } = await import("@shared/schema");
      const reviews = await db.select().from(reviewsTable)
        .where(eq(reviewsTable.productId, req.params.productId))
        .orderBy(reviewsTable.createdAt);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public checkout endpoint for published sites
  app.post("/api/public/websites/:id/checkout", async (req, res) => {
    try {
      const websiteId = req.params.id;
      const { items, customerEmail, customerName, shippingMethodId, shippingName, shippingPrice } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }

      if (!customerEmail) {
        return res.status(400).json({ message: "Email is required for checkout" });
      }

      // Validate items against database products
      const validatedItems: Array<{ productId: string; name: string; price: number; quantity: number; currency: string }> = [];
      let primaryCurrency: string | null = null;
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
        if (product.websiteId !== websiteId) {
          return res.status(400).json({ message: "Invalid product" });
        }
        if (product.status !== 'active') {
          return res.status(400).json({ message: `Product not available: ${product.name}` });
        }
        
        const productCurrency = product.currency || 'USD';
        
        // Validate all items share the same currency
        if (primaryCurrency === null) {
          primaryCurrency = productCurrency;
        } else if (primaryCurrency !== productCurrency) {
          return res.status(400).json({ 
            message: `Cannot checkout products with different currencies. Cart contains ${primaryCurrency} and ${productCurrency} items.` 
          });
        }
        
        validatedItems.push({
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: Math.max(1, Math.floor(item.quantity || 1)),
          currency: productCurrency,
        });
      }
      
      // Products without a currency inherit the website's trading currency
      if (!primaryCurrency) {
        primaryCurrency = await websiteCurrency(websiteId);
      }

      const stripe = await getUncachableStripeClient();
      const total = validatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Convert currency code to lowercase for Stripe
      const stripeCurrency = primaryCurrency.toLowerCase();

      const lineItems: Array<{
        price_data: {
          currency: string;
          product_data: { name: string; metadata?: Record<string, string> };
          unit_amount: number;
        };
        quantity: number;
      }> = validatedItems.map(item => ({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: item.name,
            metadata: { productId: item.productId },
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      // Add shipping as a line item if present
      if (shippingName && typeof shippingPrice === 'number' && shippingPrice > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Shipping: ${shippingName}`,
            },
            unit_amount: shippingPrice,
          },
          quantity: 1,
        });
      }

      // Calculate total including shipping
      const shippingAmount = typeof shippingPrice === 'number' ? shippingPrice / 100 : 0;
      const totalWithShipping = total + shippingAmount;

      // Determine URLs based on request origin
      const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';
      
      // Check if website has connected Stripe account for destination charges
      const paymentSettings = await storage.getPaymentSettings(websiteId);
      const connectedAccountId = paymentSettings?.stripeAccountId;
      const isStripeConnected = paymentSettings?.stripeConnectStatus === 'connected' && connectedAccountId;
      
      // Build checkout session params
      const sessionParams: any = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&website=${websiteId}`,
        cancel_url: `${origin}/checkout/cancel?website=${websiteId}`,
        customer_email: customerEmail,
        metadata: {
          websiteId,
          itemsJson: JSON.stringify(validatedItems),
        },
      };
      
      // If website has connected Stripe account with active status, use destination charges
      if (isStripeConnected) {
        const totalCents = Math.round(totalWithShipping * 100);
        // Platform fee: 2% of total (adjust as needed)
        const applicationFee = Math.round(totalCents * 0.02);
        
        sessionParams.payment_intent_data = {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: connectedAccountId,
          },
        };
      }
      
      const session = await stripe.checkout.sessions.create(sessionParams);

      // Create order with pending payment status (including shipping snapshot)
      await storage.createOrder({
        websiteId,
        customerName: customerName || customerEmail?.split('@')[0] || 'Customer',
        customerEmail: customerEmail || 'guest@checkout.com',
        status: 'pending',
        paymentStatus: 'pending',
        stripeSessionId: session.id,
        total: totalWithShipping.toFixed(2),
        currency: primaryCurrency,
        items: validatedItems.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          priceCents: Math.round(item.price * 100),
          quantity: item.quantity,
        })),
        shippingMethodId: shippingMethodId || null,
        shippingName: shippingName || null,
        shippingPrice: typeof shippingPrice === 'number' ? String(shippingPrice) : null,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Public checkout error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Multi-step checkout: Step 1 - Validate cart and customer info
  app.post("/api/public/websites/:id/checkout/validate", async (req, res) => {
    try {
      const websiteId = req.params.id;
      const { items, customerEmail, customerName, customerPhone, shippingAddress } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }

      if (!customerEmail || !customerEmail.includes('@')) {
        return res.status(400).json({ success: false, message: "Valid email is required", field: "customerEmail" });
      }

      if (!customerName || customerName.trim().length < 2) {
        return res.status(400).json({ success: false, message: "Name is required", field: "customerName" });
      }

      const validatedItems: Array<{
        productId: string;
        name: string;
        price: number;
        priceCents: number;
        quantity: number;
        currency: string;
        trackInventory: boolean;
        stockQuantity: number;
      }> = [];
      let primaryCurrency: string | null = null;

      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
        }
        if (product.websiteId !== websiteId) {
          return res.status(400).json({ success: false, message: "Invalid product" });
        }
        if (product.status !== 'active') {
          return res.status(400).json({ success: false, message: `Product not available: ${product.name}` });
        }

        const productCurrency = product.currency || 'USD';
        if (primaryCurrency === null) {
          primaryCurrency = productCurrency;
        } else if (primaryCurrency !== productCurrency) {
          return res.status(400).json({
            success: false,
            message: `Cannot checkout products with different currencies`
          });
        }

        const priceNum = parseFloat(product.price);
        validatedItems.push({
          productId: product.id,
          name: product.name,
          price: priceNum,
          priceCents: Math.round(priceNum * 100),
          quantity: Math.max(1, Math.floor(item.quantity || 1)),
          currency: productCurrency,
          trackInventory: product.trackInventory,
          stockQuantity: product.stockQuantity,
        });
      }

      const stockCheck = await storage.checkStockAvailability(
        websiteId,
        validatedItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
      );

      if (!stockCheck.available) {
        return res.status(400).json({
          success: false,
          message: "Some items are out of stock",
          outOfStock: stockCheck.outOfStock,
        });
      }

      const subtotalCents = validatedItems.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);

      res.json({
        success: true,
        validatedItems,
        subtotalCents,
        currency: primaryCurrency || (await websiteCurrency(websiteId)),
        customer: { email: customerEmail, name: customerName, phone: customerPhone },
        shippingAddress,
      });
    } catch (error: any) {
      console.error('Checkout validate error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Multi-step checkout: Step 2 - Get shipping options
  app.post("/api/public/websites/:id/checkout/shipping-options", async (req, res) => {
    try {
      const websiteId = req.params.id;
      const { subtotalCents, shippingAddress } = req.body;

      const shippingMethods = await storage.getActiveShippingMethods(websiteId);
      const shippingConfig = await storage.getShippingConfig(websiteId);

      const shippingOptions = shippingMethods.map(method => ({
        id: method.id,
        name: method.name,
        description: method.description,
        priceCents: method.priceAmount,
        deliveryTime: method.deliveryTime,
      }));

      res.json({
        success: true,
        shippingOptions,
        shippingMode: shippingConfig?.mode || 'manual',
      });
    } catch (error: any) {
      console.error('Shipping options error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Multi-step checkout: Step 3 - Confirm order and redirect to payment
  app.post("/api/public/websites/:id/checkout/confirm", async (req, res) => {
    try {
      const websiteId = req.params.id;
      const {
        items,
        customerEmail,
        customerName,
        customerPhone,
        shippingAddress,
        shippingMethodId,
      } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, message: "Cart is empty" });
      }

      if (!customerEmail) {
        return res.status(400).json({ success: false, message: "Email is required" });
      }

      const validatedItems: Array<{
        productId: string;
        name: string;
        price: number;
        priceCents: number;
        quantity: number;
        currency: string;
      }> = [];
      let primaryCurrency: string | null = null;

      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product || product.websiteId !== websiteId || product.status !== 'active') {
          return res.status(400).json({ success: false, message: `Invalid product: ${item.productId}` });
        }

        const productCurrency = product.currency || 'USD';
        if (primaryCurrency === null) {
          primaryCurrency = productCurrency;
        } else if (primaryCurrency !== productCurrency) {
          return res.status(400).json({ success: false, message: "Currency mismatch" });
        }

        const priceNum = parseFloat(product.price);
        validatedItems.push({
          productId: product.id,
          name: product.name,
          price: priceNum,
          priceCents: Math.round(priceNum * 100),
          quantity: Math.max(1, Math.floor(item.quantity || 1)),
          currency: productCurrency,
        });
      }

      const stockCheck = await storage.checkStockAvailability(
        websiteId,
        validatedItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
      );

      if (!stockCheck.available) {
        return res.status(400).json({
          success: false,
          message: "Some items are out of stock",
          outOfStock: stockCheck.outOfStock,
        });
      }

      let shippingMethod = null;
      let shippingCostCents = 0;
      if (shippingMethodId) {
        shippingMethod = await storage.getShippingMethod(shippingMethodId, websiteId);
        if (shippingMethod) {
          shippingCostCents = shippingMethod.priceAmount;
        }
      }

      const subtotalCents = validatedItems.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);
      const totalAmountCents = subtotalCents + shippingCostCents;

      const stripe = await getUncachableStripeClient();
      if (!primaryCurrency) {
        primaryCurrency = await websiteCurrency(websiteId);
      }
      const stripeCurrency = primaryCurrency.toLowerCase();

      const lineItems = validatedItems.map(item => ({
        price_data: {
          currency: stripeCurrency,
          product_data: {
            name: item.name,
            metadata: { productId: item.productId },
          },
          unit_amount: item.priceCents,
        },
        quantity: item.quantity,
      }));

      if (shippingMethod && shippingCostCents > 0) {
        lineItems.push({
          price_data: {
            currency: stripeCurrency,
            product_data: {
              name: `Shipping: ${shippingMethod.name}`,
              metadata: { productId: 'shipping' },
            },
            unit_amount: shippingCostCents,
          },
          quantity: 1,
        });
      }

      const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || '';

      // Check if website has connected Stripe account for destination charges
      const paymentSettings = await storage.getPaymentSettings(websiteId);
      const connectedAccountId = paymentSettings?.stripeAccountId;
      const isStripeConnected = paymentSettings?.stripeConnectStatus === 'connected' && connectedAccountId;
      
      // Build checkout session params
      const sessionParams: any = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&website=${websiteId}`,
        cancel_url: `${origin}/checkout/cancel?website=${websiteId}`,
        customer_email: customerEmail,
        metadata: {
          websiteId,
          itemsJson: JSON.stringify(validatedItems),
        },
      };
      
      // If website has connected Stripe account with active status, use destination charges
      if (isStripeConnected) {
        // Platform fee: 2% of total (adjust as needed)
        const applicationFee = Math.round(totalAmountCents * 0.02);
        
        sessionParams.payment_intent_data = {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: connectedAccountId,
          },
        };
      }
      
      const session = await stripe.checkout.sessions.create(sessionParams);

      const stockResult = await storage.decrementStock(
        websiteId,
        validatedItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
      );

      if (!stockResult.success) {
        console.warn('Stock decrement warnings:', stockResult.errors);
      }

      await storage.createOrder({
        websiteId,
        customerName: customerName || customerEmail?.split('@')[0] || 'Customer',
        customerEmail,
        customerPhone: customerPhone || null,
        status: 'pending',
        paymentStatus: 'pending',
        stripeSessionId: session.id,
        total: (totalAmountCents / 100).toFixed(2),
        totalAmountCents,
        subtotalCents,
        shippingCostCents,
        currency: primaryCurrency,
        items: validatedItems.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          priceCents: item.priceCents,
          quantity: item.quantity,
        })),
        shippingAddress: shippingAddress || null,
        shippingMethodId: shippingMethodId || null,
        shippingName: shippingMethod?.name || null,
        shippingPrice: shippingMethod ? String(shippingCostCents) : null,
      });

      res.json({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        totalAmountCents,
      });
    } catch (error: any) {
      console.error('Checkout confirm error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Get Stripe publishable key
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create Stripe checkout session for cart
  app.post("/api/checkout/create-session", async (req, res) => {
    try {
      const { websiteId, items, customerEmail, successUrl, cancelUrl } = req.body;
      
      if (!websiteId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "Invalid request" });
      }

      if (!customerEmail) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Validate items against database products to prevent price tampering
      const validatedItems: Array<{ productId: string; name: string; price: number; quantity: number }> = [];
      
      for (const item of items) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${item.productId}` });
        }
        if (product.websiteId !== websiteId) {
          return res.status(400).json({ message: "Invalid product for this website" });
        }
        if (product.status !== 'active') {
          return res.status(400).json({ message: `Product not available: ${product.name}` });
        }
        
        // Use database price, not client-provided price
        validatedItems.push({
          productId: product.id,
          name: product.name,
          price: parseFloat(product.price),
          quantity: Math.max(1, Math.floor(item.quantity || 1)),
        });
      }

      const stripe = await getUncachableStripeClient();

      // Calculate total from validated items
      const total = validatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Charge in the website's trading currency (was hardcoded 'usd')
      const checkoutCurrency = await websiteCurrency(websiteId);

      // Create line items from validated cart
      const lineItems = validatedItems.map(item => ({
        price_data: {
          currency: checkoutCurrency.toLowerCase(),
          product_data: {
            name: item.name,
            metadata: { productId: item.productId },
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      // Check if website has connected Stripe account for destination charges
      const paymentSettings = await storage.getPaymentSettings(websiteId);
      const connectedAccountId = paymentSettings?.stripeAccountId;
      const isStripeConnected = paymentSettings?.stripeConnectStatus === 'connected' && connectedAccountId;
      
      // Build checkout session params
      const sessionParams: any = {
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl || `${req.headers.origin}?success=true`,
        cancel_url: cancelUrl || `${req.headers.origin}?canceled=true`,
        customer_email: customerEmail,
        metadata: {
          websiteId,
          itemsJson: JSON.stringify(validatedItems),
        },
      };
      
      // If website has connected Stripe account with active status, use destination charges
      if (isStripeConnected) {
        const totalCents = Math.round(total * 100);
        // Platform fee: 2% of total (adjust as needed)
        const applicationFee = Math.round(totalCents * 0.02);
        
        sessionParams.payment_intent_data = {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: connectedAccountId,
          },
        };
      }
      
      const session = await stripe.checkout.sessions.create(sessionParams);

      // Create order with pending payment status
      await storage.createOrder({
        websiteId,
        customerName: customerEmail.split('@')[0] || 'Customer',
        customerEmail,
        status: 'pending',
        paymentStatus: 'pending',
        stripeSessionId: session.id,
        total: total.toFixed(2),
        currency: checkoutCurrency,
        items: validatedItems.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          priceCents: Math.round(item.price * 100),
          quantity: item.quantity,
        })),
      });

      res.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============ PUBLISH ROUTE ============

  // Publish a website to Vercel
  // ── Publish (async) ──────────────────────────────────────────────────────
  // Returns 202 immediately with a jobId; the real Vercel pipeline runs in a
  // background worker. The builder polls GET /api/publish-jobs/:jobId for status.
  //
  // Publishing no longer depends on REPLIT_DEPLOYMENT or a live Replit
  // production deployment — it works from the dev workspace, locally, and
  // from any future host, as long as BIRDFLOW_PUBLIC_PLATFORM_URL is set.
  app.post("/api/websites/:id/publish", requireAuth, requireWebsitePermission("publish"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      const website = access.website;

      if (!isPublishJobSchemaReady()) {
        return res.status(503).json({ message: "Publish system is starting up. Please try again in a moment." });
      }

      const builderState = await storage.getBuilderState(req.params.id);
      if (!builderState) return res.status(400).json({ message: "No builder state found" });

      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.status(400).json({ message: "Vercel token not configured. Please add VERCEL_TOKEN to secrets." });
      }
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
        return res.status(400).json({ message: "Supabase not configured" });
      }

      // BIRDFLOW_PUBLIC_PLATFORM_URL (or legacy BIRDFLOW_API_URL) must be set so
      // the published site's analytics tracker and email callbacks point at the
      // correct platform — not a dev/preview domain that rotates or sleeps.
      const platformUrl = resolvePlatformUrl();
      if (!platformUrl) {
        return res.status(500).json({
          message:
            "BirdFlow platform URL is not configured. Set BIRDFLOW_PUBLIC_PLATFORM_URL (e.g. https://bird-flow.app) so published sites can deliver analytics and emails.",
        });
      }

      // Upgrade historical data before the immutable snapshot is created.
      // This gives the worker a single canonical state shape and, crucially,
      // means a migration failure cannot disturb the currently live site.
      const compatibility = migrateSiteStateToCurrent(builderState.state);
      const canonicalState = compatibility.state;
      console.log("[Publish] state_migrated", {
        websiteId: req.params.id,
        sourceVersion: compatibility.report.sourceVersion,
        targetVersion: compatibility.report.targetVersion,
        migrationsApplied: compatibility.report.migrationsApplied,
      });

      // Idempotency: check for an already-running job before inserting.
      // createPublishJob will still throw a unique-constraint error (23505) if
      // two requests race through this check simultaneously — that is caught
      // below and converted to 409.
      const idempotencyKey: string | undefined = req.body?.idempotencyKey;
      const existingActive = await getActivePublishJob(req.params.id);
      if (existingActive) {
        // Same idempotency key → return the existing job (not an error)
        if (idempotencyKey && existingActive.idempotencyKey === idempotencyKey) {
          return res.status(202).json({ jobId: existingActive.id, status: existingActive.status });
        }
        return res.status(409).json({
          message: "A publish is already in progress. Please wait for it to complete before publishing again.",
          jobId: existingActive.id,
        });
      }

      // Collect Stripe credentials (optional; warning only when absent)
      let stripeSecretKey: string | undefined;
      let stripePublishableKey: string | undefined;
      let stripeWebhookSecret: string | undefined;
      let stripeWarning: string | undefined;

      const paymentSettings = await storage.getPaymentSettings(req.params.id);
      if (paymentSettings?.isConnected && paymentSettings.stripeSecretKey) {
        stripeSecretKey = paymentSettings.stripeSecretKey;
        stripePublishableKey = paymentSettings.stripePublishableKey || undefined;
        stripeWebhookSecret = paymentSettings.stripeWebhookSecret || undefined;
        if (paymentSettings.testMode) {
          stripeWarning = 'Your Stripe account is connected with test mode keys.';
        }
      } else {
        stripeWarning = 'Stripe is not configured. Product checkout will not work on your published site.';
      }

      // Active custom domain (if any) — passed to the worker so it can attach it.
      let activeCustomDomain: string | undefined;
      let recoveredVercelProjectId: string | undefined =
        (await getLatestPublishedVercelProjectId(req.params.id)) ?? undefined;
      try {
        const customDomains = await storage.getCustomDomains(req.params.id);
        const activeDomain = customDomains.find(d => d.status === 'active');
        if (activeDomain) {
          activeCustomDomain = activeDomain.domain;
          // Older sites sometimes only have the project reference on their
          // connected domain row. It is a recovery hint after the successful
          // publish-job record, never a generated name.
          recoveredVercelProjectId ??= activeDomain.vercelProjectId || undefined;
        }
      } catch (domainErr) {
        console.error('[Publish] Failed to fetch custom domains:', domainErr);
      }
      if (!recoveredVercelProjectId && website.deploymentUrl) {
        recoveredVercelProjectId =
          (await recoverVerifiedProjectForLiveUrl(
            projectNameForWebsite(req.params.id),
            website.deploymentUrl,
            { token: vercelToken, teamId: process.env.VERCEL_TEAM_ID },
          )) ?? undefined;
        if (!recoveredVercelProjectId) {
          return res.status(409).json({
            code: "VERCEL_PROJECT_RECOVERY_REQUIRED",
            message:
              "This older live website has no verified Vercel project record. Publishing was stopped to avoid creating a duplicate project. Reconnect the original Vercel project before publishing again.",
          });
        }
      }

      // Create the publish job and its immutable content snapshot atomically.
      // Both rows are created in a single transaction so a snapshot-insert failure
      // never leaves an orphaned queued job that would block future publishes.
      const { job } = await createPublishJobWithSnapshot({
        websiteId: req.params.id,
        requestedBy: access.actorUserId,
        idempotencyKey,
        content: canonicalState,
      });

      console.log('[Publish] snapshot_created', { websiteId: req.params.id, publishJobId: job.id });

      // Return 202 immediately so the UI can start polling.
      res.status(202).json({
        jobId: job.id,
        status: 'queued',
        warning: stripeWarning,
      });

      // Fire-and-forget: the worker runs the full Vercel pipeline independently
      // of this HTTP response. If the server restarts, the job stays in its
      // last status and the customer can republish.
      const workerCfg: WorkerConfig = {
        jobId: job.id,
        websiteId: req.params.id,
        siteName: website.name,
        snapshotContent: canonicalState,
        snapshotHash: job.snapshotHash!,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey,
        stripeSecretKey,
        stripePublishableKey,
        stripeWebhookSecret,
        vercelToken,
        vercelTeamId: process.env.VERCEL_TEAM_ID,
        existingVercelProjectId: recoveredVercelProjectId ?? undefined,
        customDomain: activeCustomDomain,
        platformUrl,
        language: normalizeSiteLanguage(website.language),
        requestedBy: access.actorUserId,
      };
      setImmediate(() => { void runPublishJob(workerCfg); });
    } catch (error: any) {
      // Unique-constraint violation on the one-active-per-site index means two
      // simultaneous requests raced through the pre-check and both tried to insert.
      // The second insert loses with code 23505 → return 409 instead of 500.
      if (error instanceof PublishCompatibilityError) {
        return res.status(400).json({
          code: error.code,
          message: error.message,
          failureDetails: { stage: error.stage, ...error.details },
        });
      }
      if (error?.code === '23505' || /unique.*publish_jobs_one_active/i.test(error?.message ?? '')) {
        return res.status(409).json({ message: "A publish is already in progress for this site." });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // ── Poll publish job status ───────────────────────────────────────────────
  app.get("/api/publish-jobs/:jobId", requireAuth, async (req, res) => {
    try {
      if (!isPublishJobSchemaReady()) {
        return res.status(503).json({ message: "Publish system is starting up." });
      }
      const job = await getPublishJob(req.params.jobId);
      if (!job) return res.status(404).json({ message: "Publish job not found" });
      const access = await resolveWebsiteAccess(req, job.websiteId, "publish");
      if ("failure" in access) {
        return res.status(access.failure.status).json({ message: access.failure.message });
      }
      res.json({
        jobId: job.id,
        status: job.status,
        productionUrl: job.productionUrl,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
        failureDetails: job.failureDetails ?? null,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Vercel deployment webhook ─────────────────────────────────────────────
  // Registered in server/index.ts BEFORE express.json() so it receives the
  // raw body needed for HMAC-SHA1 signature verification. This stub satisfies
  // any router-level discovery tools that scan registered routes, but the
  // actual handler is in index.ts.
  // (No route registered here — already live in index.ts)

  // ============ MEDIA ASSETS ROUTES ============

  // ---- SVG assets: reusable illustrations referenced by svgAssetId ----
  // Same permission as saving the builder state (updateBuilder): the asset
  // store is part of the document being edited, not media management.

  app.get("/api/websites/:id/svg-assets", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const assets = await storage.getSvgAssets(req.params.id);
      res.json(assets);
    } catch (error: any) {
      // A missing table (store not ready yet) is an empty library, not an
      // error — the builder then falls back to inline markup everywhere.
      console.warn("[SvgAssets] list failed:", error?.message || error);
      res.json([]);
    }
  });

  app.post("/api/websites/:id/svg-assets", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const { name, svg } = req.body ?? {};
      if (typeof svg !== "string" || !svg.trim()) {
        return res.status(400).json({ message: "SVG-markup mangler." });
      }
      const result = await createSvgAssetSafe({
        websiteId: req.params.id,
        name: typeof name === "string" ? name : undefined,
        svg,
        origin: "customer",
      });
      if (!result.ok) {
        return res.status(result.status).json({ message: result.message });
      }
      res.status(201).json(result.asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/websites/:id/svg-assets/:assetId", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      // Refuse to delete an illustration a page still points at — the node
      // would silently render nothing in the builder and the published site.
      const builderState = await storage.getBuilderState(req.params.id);
      if (builderState?.state) {
        const referenced = collectReferencedSvgAssetIds(
          builderState.state as Parameters<typeof collectReferencedSvgAssetIds>[0]
        );
        if (referenced.has(req.params.assetId)) {
          return res.status(409).json({
            message: "Grafikken bruges stadig på websitet. Fjern den fra siderne, før den slettes.",
          });
        }
      }
      const deleted = await storage.deleteSvgAsset(req.params.assetId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Grafikken findes ikke." });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all media assets for a website. Owner or administrator
  // (manageMedia permission - media is part of builder editing).
  app.get("/api/websites/:id/media", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const assets = await storage.getMediaAssets(req.params.id);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a signed upload URL for Supabase Storage
  app.post("/api/websites/:id/media/upload-url", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const { filename, contentType } = req.body;
      if (!filename || !contentType) {
        return res.status(400).json({ message: "Filename and content type are required" });
      }

      const uniqueFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const storagePath = `${req.params.id}/${uniqueFilename}`;

      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseServiceRoleKey || !supabaseUrl) {
        return res.status(500).json({ message: "Supabase service role key not configured" });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
      
      // Ensure the media bucket exists
      const { data: buckets } = await adminClient.storage.listBuckets();
      const mediaBucketExists = buckets?.some(b => b.name === 'media');
      
      if (!mediaBucketExists) {
        const { error: createBucketError } = await adminClient.storage.createBucket('media', {
          public: true,
          fileSizeLimit: 10485760, // 10MB
        });
        if (createBucketError && !createBucketError.message.includes('already exists')) {
          console.error('Failed to create media bucket:', createBucketError);
          return res.status(500).json({ message: "Failed to create storage bucket" });
        }
      }
      
      const { data, error } = await adminClient.storage
        .from('media')
        .createSignedUploadUrl(storagePath);

      if (error) {
        console.error('Supabase storage error:', error);
        return res.status(500).json({ message: "Failed to create upload URL" });
      }

      res.json({
        uploadUrl: data.signedUrl,
        token: data.token,
        storagePath,
        filename: uniqueFilename,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a media asset record after upload
  app.post("/api/websites/:id/media", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      const { filename, originalFilename, storagePath, mimeType, size, width, height, crop, altText } = req.body;

      if (!filename || !originalFilename || !storagePath || !mimeType || size === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // storagePath is client-supplied but is later handed to the Supabase
      // SERVICE-ROLE client for deletion, so it must be constrained to paths
      // this website legitimately owns. Without this an authenticated user
      // could register an asset pointing at another tenant's object and then
      // delete it via DELETE /media/:mediaId.
      if (!isAllowedMediaStoragePath(storagePath, req.params.id)) {
        return res.status(400).json({ message: "Invalid storage path" });
      }

      const asset = await storage.createMediaAsset({
        websiteId: req.params.id,
        filename,
        originalFilename,
        storagePath,
        mimeType,
        size,
        width,
        height,
        crop,
        altText,
      });

      await recordAdminAudit(access, {
        action: "media.create",
        resourceType: "media",
        resourceId: asset.id,
        httpMethod: "POST",
        route: "/api/websites/:id/media",
        changedSummary: { mimeType, size },
      });

      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a media asset (for cropping, alt text, etc.)
  app.patch("/api/websites/:id/media/:mediaId", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      const asset = await storage.updateMediaAsset(req.params.mediaId, req.params.id, req.body);
      if (!asset) {
        return res.status(404).json({ message: "Media asset not found" });
      }

      await recordAdminAudit(access, {
        action: "media.update",
        resourceType: "media",
        resourceId: req.params.mediaId,
        httpMethod: "PATCH",
        route: "/api/websites/:id/media/:mediaId",
        changedSummary: { changedFields: Object.keys(req.body ?? {}).sort() },
      });

      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a media asset
  app.delete("/api/websites/:id/media/:mediaId", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const access = getWebsiteAccess(req);
      // Also delete from Supabase Storage. Only remove paths this website
      // legitimately owns - legacy rows predating path validation could
      // otherwise point at another tenant's object.
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const asset = await storage.getMediaAsset(req.params.mediaId, req.params.id);
      if (supabaseServiceRoleKey && supabaseUrl && asset) {
        if (isAllowedMediaStoragePath(asset.storagePath, req.params.id)) {
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
          await adminClient.storage.from('media').remove([asset.storagePath]);
        } else {
          console.warn(
            `[Media] Refusing to delete out-of-scope storage path for website ${req.params.id}, asset ${req.params.mediaId}`
          );
        }
      }

      const deleted = await storage.deleteMediaAsset(req.params.mediaId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Media asset not found" });
      }

      await recordAdminAudit(access, {
        action: "media.delete",
        resourceType: "media",
        resourceId: req.params.mediaId,
        httpMethod: "DELETE",
        route: "/api/websites/:id/media/:mediaId",
        // Record WHICH object was destroyed, not just the row id.
        changedSummary: { storagePath: asset?.storagePath ?? null },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get public URL for a media asset
  app.get("/api/websites/:id/media/:mediaId/url", requireAuth, requireWebsitePermission("manageMedia"), async (req, res) => {
    try {
      const asset = await storage.getMediaAsset(req.params.mediaId, req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Media asset not found" });
      }

      // Check if the file is stored in Replit Object Storage (path starts with /objects/)
      if (asset.storagePath.startsWith('/objects/')) {
        // Return the Replit Object Storage URL directly
        res.json({ url: asset.storagePath, asset });
        return;
      }

      // Fall back to Supabase storage for legacy files
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseServiceRoleKey || !supabaseUrl) {
        return res.status(500).json({ message: "Storage not configured" });
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
      const { data } = adminClient.storage.from('media').getPublicUrl(asset.storagePath);
      
      res.json({ url: data.publicUrl, asset });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ BOOKING SERVICES ROUTES ============

  // Get all booking services for a website
  app.get("/api/websites/:id/booking-services", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const services = await storage.getBookingServices(req.params.id);
      // Convert 'active' string to 'isActive' boolean for frontend
      const servicesWithIsActive = services.map(s => ({
        ...s,
        isActive: s.active === 'true',
      }));
      res.json(servicesWithIsActive);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a booking service
  app.post("/api/websites/:id/booking-services", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("bookingService.create", "bookingService"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const { name, description, durationMinutes, price, currency, isActive } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Service name is required" });
      }

      const service = await storage.createBookingService({
        websiteId: req.params.id,
        name,
        description,
        durationMinutes: durationMinutes || 30,
        price: price || '0',
        currency: currency || 'USD',
        active: isActive !== false ? 'true' : 'false',
      });

      // Return with isActive boolean for frontend
      res.status(201).json({ ...service, isActive: service.active === 'true' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a booking service
  app.patch("/api/websites/:id/booking-services/:serviceId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("bookingService.update", "bookingService", "serviceId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      // Convert isActive boolean to active string for database
      const { isActive, ...rest } = req.body;
      const updateData = {
        ...rest,
        ...(isActive !== undefined ? { active: isActive ? 'true' : 'false' } : {}),
      };

      const service = await storage.updateBookingService(req.params.serviceId, req.params.id, updateData);
      if (!service) {
        return res.status(404).json({ message: "Booking service not found" });
      }
      // Return with isActive boolean for frontend
      res.json({ ...service, isActive: service.active === 'true' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a booking service
  app.delete("/api/websites/:id/booking-services/:serviceId", requireAuth, requireWebsitePermission("updateManage"), auditManageMutation("bookingService.delete", "bookingService", "serviceId"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const deleted = await storage.deleteBookingService(req.params.serviceId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Booking service not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get active booking services (for published sites)
  app.get("/api/public/websites/:id/booking-services", async (req, res) => {
    try {
      const services = await storage.getActiveBookingServices(req.params.id);
      res.json(services);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ SERVICE AVAILABILITY ROUTES ============
  
  // Get availability rules for a service
  app.get("/api/websites/:id/services/:serviceId/availability", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const availability = await storage.getServiceAvailability(req.params.serviceId);
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create availability rule
  app.post("/api/websites/:id/services/:serviceId/availability", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { dayOfWeek, specificDate, startTime, endTime, slotDurationMinutes, isActive } = req.body;

      if (!startTime || !endTime) {
        return res.status(400).json({ message: "Start time and end time are required" });
      }

      if (dayOfWeek === undefined && !specificDate) {
        return res.status(400).json({ message: "Day of week or specific date is required" });
      }

      const availability = await storage.createServiceAvailability({
        serviceId: req.params.serviceId,
        websiteId: req.params.id,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        specificDate: specificDate || null,
        startTime,
        endTime,
        slotDurationMinutes: slotDurationMinutes || null,
        isActive: isActive !== undefined ? isActive : true,
      });

      res.status(201).json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update availability rule
  app.put("/api/websites/:id/services/:serviceId/availability/:availabilityId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { dayOfWeek, specificDate, startTime, endTime, slotDurationMinutes, isActive } = req.body;

      const availability = await storage.updateServiceAvailability(req.params.availabilityId, {
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : undefined,
        specificDate: specificDate !== undefined ? specificDate : undefined,
        startTime,
        endTime,
        slotDurationMinutes: slotDurationMinutes !== undefined ? slotDurationMinutes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      });

      if (!availability) {
        return res.status(404).json({ message: "Availability rule not found" });
      }

      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete availability rule
  app.delete("/api/websites/:id/services/:serviceId/availability/:availabilityId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteServiceAvailability(req.params.availabilityId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ BLOCKED DATES ROUTES ============

  // Get blocked dates for a service
  app.get("/api/websites/:id/services/:serviceId/blocked-dates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const blockedDates = await storage.getServiceBlockedDates(req.params.serviceId);
      res.json(blockedDates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create blocked date
  app.post("/api/websites/:id/services/:serviceId/blocked-dates", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { blockedDate, reason, isRecurringYearly } = req.body;
      
      if (!blockedDate) {
        return res.status(400).json({ message: "Blocked date is required (YYYY-MM-DD format)" });
      }

      const blocked = await storage.createServiceBlockedDate({
        serviceId: req.params.serviceId,
        websiteId: req.params.id,
        blockedDate,
        reason: reason || null,
        isRecurringYearly: isRecurringYearly || false,
      });

      res.status(201).json(blocked);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete blocked date
  app.delete("/api/websites/:id/services/:serviceId/blocked-dates/:blockedDateId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteServiceBlockedDate(req.params.blockedDateId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ DATE RANGE ROUTES ============

  // Get date ranges for a service
  app.get("/api/websites/:id/services/:serviceId/date-ranges", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const dateRanges = await storage.getServiceDateRanges(req.params.serviceId);
      res.json(dateRanges);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create date range
  app.post("/api/websites/:id/services/:serviceId/date-ranges", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { startDate, endDate } = req.body;
      
      if (!startDate) {
        return res.status(400).json({ message: "Start date is required (YYYY-MM-DD format)" });
      }

      const dateRange = await storage.createServiceDateRange({
        serviceId: req.params.serviceId,
        websiteId: req.params.id,
        startDate,
        endDate: endDate || null,
        isActive: true,
      });

      res.status(201).json(dateRange);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update date range
  app.put("/api/websites/:id/services/:serviceId/date-ranges/:dateRangeId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { startDate, endDate, isActive } = req.body;
      
      const dateRange = await storage.updateServiceDateRange(req.params.dateRangeId, {
        startDate,
        endDate,
        isActive,
      });

      if (!dateRange) {
        return res.status(404).json({ message: "Date range not found" });
      }

      res.json(dateRange);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete date range
  app.delete("/api/websites/:id/services/:serviceId/date-ranges/:dateRangeId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteServiceDateRange(req.params.dateRangeId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get full service availability (combined check for a month)
  app.get("/api/websites/:id/services/:serviceId/full-availability", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { month, year } = req.query;
      const m = parseInt(month as string) || new Date().getMonth() + 1;
      const y = parseInt(year as string) || new Date().getFullYear();

      const availability = await storage.getFullServiceAvailability(
        req.params.serviceId,
        req.params.id,
        m,
        y
      );

      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint for full availability (for published sites)
  app.get("/api/public/websites/:websiteId/services/:serviceId/full-availability", async (req, res) => {
    try {
      const { month, year } = req.query;
      const m = parseInt(month as string) || new Date().getMonth() + 1;
      const y = parseInt(year as string) || new Date().getFullYear();

      const availability = await storage.getFullServiceAvailability(
        req.params.serviceId,
        req.params.websiteId,
        m,
        y
      );

      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get active team members (for "choose person" step)
  app.get("/api/public/websites/:id/team-members", async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      const members = await storage.getTeamMembers(req.params.id);
      res.json(
        members
          .filter(m => m.active)
          .map(m => ({
            id: m.id,
            name: m.name,
            role: m.role,
            color: m.color,
            serviceIds: Array.isArray(m.serviceIds) ? m.serviceIds : [],
          }))
      );
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get available time slots for a date
  app.get("/api/public/websites/:websiteId/services/:serviceId/slots", async (req, res) => {
    try {
      const { date, teamMemberId } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "Date query parameter is required (YYYY-MM-DD format)" });
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      const slots = await storage.getAvailableSlotsForDate(
        req.params.serviceId,
        req.params.websiteId,
        date,
        typeof teamMemberId === 'string' && teamMemberId ? teamMemberId : undefined
      );

      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ PUBLIC API ROUTES (for published websites) ============
  // These routes will be used by published websites to submit data

  // Submit a form (public - no auth required)
  app.post("/api/public/websites/:id/forms", async (req, res) => {
    try {
      const { formName, data } = req.body;
      
      if (!formName || !data) {
        return res.status(400).json({ message: "Form name and data are required" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      const submission = await storage.createFormSubmission({
        websiteId: req.params.id,
        formName,
        data,
      });

      res.status(201).json(submission);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a booking (public - no auth required)
  app.post("/api/public/websites/:id/bookings", async (req, res) => {
    const websiteId = req.params.id;
    console.log(`[Booking] Received booking request for website ${websiteId}`);
    
    try {
      const { customerName, customerEmail, customerPhone, service, serviceId, date, time, notes, teamMemberId, openSlotId, place } = req.body;
      console.log(`[Booking] Request details:`, { customerName, customerEmail, service, serviceId, date, time, teamMemberId, openSlotId });
      
      if (!customerName || !customerEmail || !service || !date) {
        console.log(`[Booking] REJECTED: Missing required fields`);
        return res.status(400).json({ message: "Customer name, email, service, and date are required" });
      }

      const website = await storage.getWebsite(websiteId);
      if (!website) {
        console.log(`[Booking] REJECTED: Website not found: ${websiteId}`);
        return res.status(404).json({ message: "Website not found" });
      }
      console.log(`[Booking] Website found: ${website.name}`);

      // Validate the requested team member (if any) belongs to this website
      let requestedMemberId: string | null = null;
      if (teamMemberId && typeof teamMemberId === 'string') {
        const member = await storage.getTeamMember(teamMemberId, websiteId);
        if (!member || !member.active) {
          console.log(`[Booking] REJECTED: Unknown team member ${teamMemberId}`);
          return res.status(400).json({ message: "Selected team member is not available" });
        }
        requestedMemberId = member.id;
      }

      let booking;

      if (openSlotId && typeof openSlotId === 'string') {
        // Owner-placed open slot: claim it atomically, then create the booking from it
        const claimed = await storage.claimOpenSlot(openSlotId, websiteId);
        if (!claimed) {
          console.log(`[Booking] CONFLICT: Open slot ${openSlotId} already taken`);
          return res.status(409).json({
            message: "This time slot is no longer available. Please select a different time.",
            code: "SLOT_UNAVAILABLE"
          });
        }

        try {
          // Slot settings win over request values
          let slotServiceId = claimed.serviceId || serviceId || null;
          let serviceName = service;
          if (claimed.serviceId && claimed.serviceId !== serviceId) {
            const svc = await storage.getBookingService(claimed.serviceId, websiteId);
            if (svc) serviceName = svc.name;
          }

          booking = await storage.createBooking({
            websiteId,
            customerName,
            customerEmail,
            customerPhone,
            service: serviceName,
            serviceId: slotServiceId,
            date: new Date(claimed.date + 'T00:00:00'),
            time: claimed.time,
            durationMinutes: claimed.durationMinutes || null,
            teamMemberId: claimed.teamMemberId || requestedMemberId,
            place: typeof place === 'string' && place ? place : null,
            notes,
          });
          await storage.linkOpenSlotBooking(claimed.id, booking.id);
        } catch (createErr) {
          // Revert the claim so the slot is not lost
          await storage.releaseOpenSlot(claimed.id).catch(() => {});
          throw createErr;
        }
        console.log(`[Booking] SUCCESS: Created booking ${booking.id} from open slot ${claimed.id}`);
      } else {
        // Resolve the service duration once — used for conflict checks and
        // stored on the booking so calendar and emails know the real length
        let durationMinutes: number | null = null;
        if (serviceId) {
          const svc = await storage.getBookingService(serviceId, websiteId);
          if (svc?.durationMinutes) durationMinutes = svc.durationMinutes;
        }

        // Double-booking prevention: Check if slot is still available
        let dateStr: string | null = null;
        if (serviceId && time) {
          // Parse date string to YYYY-MM-DD format
          const dateObj = new Date(date);
          dateStr = dateObj.toISOString().split('T')[0];
          
          console.log(`[Booking] Checking availability for service ${serviceId} on ${dateStr} at ${time}`);
          const isAvailable = await storage.checkSlotAvailable(serviceId, websiteId, dateStr, time, requestedMemberId || undefined);
          if (!isAvailable) {
            console.log(`[Booking] CONFLICT: Slot ${time} on ${dateStr} is already booked for service ${serviceId}`);
            return res.status(409).json({ 
              message: "This time slot is no longer available. Please select a different time.",
              code: "SLOT_UNAVAILABLE"
            });
          }
          // Interval-based check catches overlaps at offset times (e.g. an
          // owner-placed 10:15 booking blocking the 10:00 grid slot)
          if (/^\d{1,2}:\d{2}/.test(time)) {
            const overlapConflict = await storage.findServiceConflict(websiteId, serviceId, dateStr, time, durationMinutes || 60);
            if (overlapConflict) {
              console.log(`[Booking] CONFLICT: ${time} on ${dateStr} overlaps booking ${overlapConflict.id}`);
              return res.status(409).json({
                message: "This time slot is no longer available. Please select a different time.",
                code: "SLOT_UNAVAILABLE"
              });
            }
          }
          console.log(`[Booking] Slot is available, proceeding with booking`);
        }

        // Member double-booking prevention across all services
        if (requestedMemberId && time && /^\d{2}:\d{2}$/.test(time)) {
          const memberDateStr = dateStr || new Date(date).toISOString().split('T')[0];
          const conflict = await storage.findMemberConflict(websiteId, requestedMemberId, memberDateStr, time, durationMinutes || 60);
          if (conflict) {
            console.log(`[Booking] CONFLICT: Member ${requestedMemberId} busy on ${memberDateStr} at ${time}`);
            return res.status(409).json({
              message: "The selected person is not available at this time. Please select a different time.",
              code: "MEMBER_CONFLICT"
            });
          }
        }

        booking = await storage.createBooking({
          websiteId,
          customerName,
          customerEmail,
          customerPhone,
          service,
          serviceId: serviceId || null,
          date: new Date(date),
          time: time || null,
          durationMinutes,
          teamMemberId: requestedMemberId,
          place: typeof place === 'string' && place ? place : null,
          notes,
        });

        // Optimistic post-insert verification: two concurrent requests can
        // both pass the pre-checks above; the later-created booking loses
        // and is rolled back.
        const raceConflict = await storage.findPlacementConflict(websiteId, booking.id);
        if (raceConflict) {
          await storage.deleteBooking(booking.id, websiteId);
          console.log(`[Booking] RACE: booking rolled back, lost to earlier booking ${raceConflict.id}`);
          return res.status(409).json({
            message: "This time slot is no longer available. Please select a different time.",
            code: "SLOT_UNAVAILABLE"
          });
        }
      }
      console.log(`[Booking] SUCCESS: Created booking ${booking.id} for ${customerName} (${customerEmail})`);

      // Send booking confirmation email
      try {
        const websiteUrl = website.deploymentUrl || undefined;
        console.log(`[Booking] Sending confirmation email to ${customerEmail}`);
        await emailService.sendBookingConfirmation(
          booking,
          customerEmail,
          service,
          websiteUrl
        );
        console.log(`[Booking] Email sent successfully to ${customerEmail}`);
      } catch (emailErr) {
        console.error(`[Booking] FAILED to send confirmation email to ${customerEmail}:`, emailErr);
      }

      res.status(201).json(booking);
    } catch (error: any) {
      console.error(`[Booking] ERROR: Failed to create booking for website ${websiteId}:`, error.message);
      res.status(500).json({ message: error.message });
    }
  });

  // Send booking confirmation email (public - called by published sites after creating booking in Supabase)
  app.post("/api/public/websites/:id/bookings/send-email", async (req, res) => {
    console.log(`[Email API] Received booking email request for website ${req.params.id}`);
    try {
      const { bookingId, customerName, customerEmail, service, date, time } = req.body;
      console.log(`[Email API] Request body:`, { bookingId, customerName, customerEmail, service, date, time });
      
      if (!customerEmail || !service) {
        console.log(`[Email API] Missing required fields - customerEmail: ${customerEmail}, service: ${service}`);
        return res.status(400).json({ message: "Customer email and service are required" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        console.log(`[Email API] Website not found: ${req.params.id}`);
        return res.status(404).json({ message: "Website not found" });
      }
      console.log(`[Email API] Found website: ${website.name} (${website.id})`);

      // Create a booking-like object for the email service
      const bookingForEmail = {
        id: bookingId || 'N/A',
        websiteId: req.params.id,
        customerName: customerName || 'Customer',
        customerEmail,
        service,
        date: date ? new Date(date) : new Date(),
        time: time || null,
      };

      try {
        const websiteUrl = website.deploymentUrl || undefined;
        console.log(`[Email API] Sending booking confirmation email to ${customerEmail} for service "${service}"`);
        await emailService.sendBookingConfirmation(
          bookingForEmail as any,
          customerEmail,
          service,
          websiteUrl
        );
        console.log(`[Email API] Booking confirmation email sent successfully to ${customerEmail}`);
        res.json({ success: true, message: "Email sent" });
      } catch (emailErr) {
        console.error(`[Email API] Failed to send booking confirmation email:`, emailErr);
        res.status(500).json({ success: false, message: "Failed to send email" });
      }
    } catch (error: any) {
      console.error("[Email API] Send booking email error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create an order (public - no auth required)
  app.post("/api/public/websites/:id/orders", async (req, res) => {
    try {
      const { customerName, customerEmail, shippingAddress, items, total } = req.body;
      
      if (!customerName || !customerEmail || !items || !total) {
        return res.status(400).json({ message: "Customer name, email, items, and total are required" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      const order = await storage.createOrder({
        websiteId: req.params.id,
        customerName,
        customerEmail,
        shippingAddress,
        items,
        total,
        status: 'pending',
      });

      res.status(201).json(order);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ CUSTOM DOMAINS ROUTES ============
  // Simplified flow: Add to Vercel immediately, show single CNAME record
  
  // List custom domains for a website
  app.get("/api/websites/:id/domains", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const domains = await storage.getCustomDomains(req.params.id);
      res.json(domains);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add a custom domain — attaches it (plus its www/apex twin) to the Vercel
  // project and stores the truthful state with the DNS records Vercel
  // actually requires. Status starts at whatever is really true: a domain
  // whose DNS already points correctly can be active right away, everything
  // else starts pending.
  app.post("/api/websites/:id/domains", requireAuth, async (req, res) => {
    try {
      const { domain } = req.body;
      
      if (!domain) {
        return res.status(400).json({ message: "Domain is required" });
      }

      const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/;
      if (!domainRegex.test(domain)) {
        return res.status(400).json({ message: "Invalid domain format" });
      }
      const normalized = domain.toLowerCase();

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const vercelConfig = getVercelConfig();
      if (!vercelConfig) {
        return res.status(400).json({ message: "Custom domains require Vercel integration. Please contact support." });
      }

      // Require website to be published first
      if (!website.deploymentUrl) {
        return res.status(400).json({ message: "Please publish your website first before adding a custom domain." });
      }

      // Use the canonical project name format: site-{websiteId}
      // Must match the format used in publisher/index.ts when creating the project
      const projectName = projectNameForWebsite(req.params.id);

      const existing = await storage.getCustomDomainByDomain(normalized);
      if (existing) {
        // A purchased-but-not-connected domain on this same website gets
        // connected here instead of being rejected.
        if (existing.websiteId === req.params.id && !existing.vercelProjectId) {
          const attach = await attachDomainPair(projectName, normalized, vercelConfig);
          if (!attach.success) {
            return res.status(400).json({ message: attach.error || "Failed to add domain to hosting service" });
          }
          const connected = await storage.updateCustomDomain(existing.id, req.params.id, { vercelProjectId: projectName });
          const { row } = await refreshDomainState(connected ?? { ...existing, vercelProjectId: projectName }, vercelConfig);
          return res.status(200).json(row);
        }
        return res.status(400).json({ message: "Domain is already in use" });
      }

      // Attach the domain (and its www/apex counterpart) to Vercel
      const attach = await attachDomainPair(projectName, normalized, vercelConfig);
      if (!attach.success) {
        return res.status(400).json({ message: attach.error || "Failed to add domain to hosting service" });
      }

      // Create the row, then run a real verification pass to fill in status
      // and the exact DNS records Vercel requires right now.
      const created = await storage.createCustomDomain({
        websiteId: req.params.id,
        domain: normalized,
        status: 'pending',
        vercelProjectId: projectName,
      });
      const { row } = await refreshDomainState(created, vercelConfig);

      res.status(201).json(row);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check domain verification status — runs a full truthful check against
  // Vercel (ownership + DNS config + a real HTTPS probe) and persists the
  // outcome. Also re-checks already-"active" domains so a stale active state
  // corrects itself instead of being echoed back.
  app.post("/api/websites/:id/domains/:domainId/verify", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const domains = await storage.getCustomDomains(req.params.id);
      const domain = domains.find(d => d.id === req.params.domainId);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      const vercelConfig = getVercelConfig();
      if (!vercelConfig) {
        return res.status(400).json({ message: "Vercel is not configured" });
      }

      const { row, check } = await refreshDomainState(domain, vercelConfig);

      const verified = row.status === 'active';
      let message: string;
      if (verified) {
        message = 'Dit domæne er live!';
      } else if (row.status === 'verifying') {
        message = 'DNS er på plads — certifikatet aktiveres hos Vercel. Det tager normalt få minutter.';
      } else if (row.status === 'error') {
        message = row.errorMessage || 'Domænet kunne ikke forbindes.';
      } else if (!check.ownershipVerified && (row.dnsRecords || []).some(r => r.purpose === 'ownership')) {
        message = 'Domænet skal først bekræftes med TXT-posten nedenfor (det er registreret hos en anden Vercel-konto).';
      } else {
        message = 'DNS-ændringerne er ikke slået igennem endnu. Det kan tage op til 48 timer.';
      }

      res.json({
        verified,
        status: row.status,
        message,
        domain: row,
        error: row.status === 'error' ? row.errorMessage : undefined,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a custom domain
  app.delete("/api/websites/:id/domains/:domainId", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const domains = await storage.getCustomDomains(req.params.id);
      const domain = domains.find(d => d.id === req.params.domainId);
      if (!domain) {
        return res.status(404).json({ message: "Domain not found" });
      }

      // Decide twin protection BEFORE mutating anything: the auto-attached
      // www/apex twin is only detached from Vercel when no other stored row
      // owns that hostname. Twin identity comes from Vercel's apexName when
      // reachable (exact), else a conservative heuristic.
      const vercelConfig = getVercelConfig();
      const twinHost = vercelConfig && domain.vercelProjectId
        ? await resolveTwinHost(domain.vercelProjectId, domain.domain, vercelConfig)
        : twinHostOf(domain.domain);
      let twinRowExists = false;
      if (twinHost) {
        try {
          twinRowExists = !!(await storage.getCustomDomainByDomain(twinHost));
        } catch {
          twinRowExists = true; // fail safe: never remove the twin on lookup failure
        }
      }

      // Detach from Vercel first (best-effort), then delete the row.
      if (vercelConfig && domain.vercelProjectId) {
        await detachDomainPair(domain.vercelProjectId, domain.domain, vercelConfig, { twinHost, twinRowExists });
      }
      await storage.deleteCustomDomain(req.params.domainId, req.params.id);

      // If the website's deployment URL pointed at this domain, point it
      // back at the stable *.vercel.app alias so the site stays reachable.
      await restoreDeploymentUrlAfterDelete(req.params.id, domain.domain, domain.vercelProjectId, vercelConfig);

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ DOMAIN PURCHASE ROUTES ============

  // Pre-check: verify Vercel token works and has domain capabilities
  app.get("/api/domains/config-status", requireAuth, async (req, res) => {
    try {
      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.json({
          configured: false,
          canPurchase: false,
          error: 'VERCEL_TOKEN is not set. Domain purchasing requires a Vercel API token.',
        });
      }

      const vercelConfig = {
        token: vercelToken,
        teamId: process.env.VERCEL_TEAM_ID,
      };

      // Test the token by checking a known domain's availability
      const { checkDomainAvailability: checkAvail } = await import('./publisher/vercel');
      try {
        await checkAvail('example.com', vercelConfig);
        return res.json({
          configured: true,
          canPurchase: true,
        });
      } catch (err: any) {
        const msg = err.message || '';
        if (msg.includes('not properly configured') || msg.includes('forbidden') || msg.includes('unauthorized')) {
          return res.json({
            configured: true,
            canPurchase: false,
            error: 'Vercel token does not have domain management permissions. Ensure the token has the correct scopes and the Vercel account has billing enabled.',
          });
        }
        return res.json({
          configured: true,
          canPurchase: true,
        });
      }
    } catch (error: any) {
      console.error('Domain config status check error:', error);
      res.json({
        configured: false,
        canPurchase: false,
        error: 'Failed to verify domain service configuration.',
      });
    }
  });

  // Check domain availability and pricing
  app.get("/api/websites/:id/domains/check-availability", requireAuth, async (req, res) => {
    try {
      const { domain } = req.query;
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Domain name is required" });
      }

      // Basic domain format validation
      const domainStr = domain.trim().toLowerCase();
      if (!domainStr.includes('.') || domainStr.length < 4) {
        return res.status(400).json({ message: "Please enter a valid domain name (e.g., example.com)" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.status(400).json({ message: "Domain service is not configured. A Vercel token is required for domain registration. Please add VERCEL_TOKEN to your environment variables." });
      }

      const vercelConfig = {
        token: vercelToken,
        teamId: process.env.VERCEL_TEAM_ID,
      };

      const availability = await checkDomainAvailability(domainStr, vercelConfig);
      res.json(availability);
    } catch (error: any) {
      console.error('Domain availability check error:', error);
      const message = error.message || 'Failed to check domain availability';
      res.status(500).json({ message });
    }
  });

  // Purchase a domain and optionally connect it to the website
  app.post("/api/websites/:id/domains/purchase", requireAuth, async (req, res) => {
    try {
      const { domain, connectToWebsite } = req.body;
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Domain name is required" });
      }

      const domainStr = domain.trim().toLowerCase();
      if (!domainStr.includes('.') || domainStr.length < 4) {
        return res.status(400).json({ message: "Please enter a valid domain name" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.status(400).json({
          message: "Domain purchase requires a VERCEL_TOKEN. Please add it to your environment variables.",
          actionRequired: 'vercel_token',
        });
      }

      const vercelConfig = {
        token: vercelToken,
        teamId: process.env.VERCEL_TEAM_ID,
      };

      // Check if domain is already in our database
      const existingDomain = await storage.getCustomDomainByDomain(domainStr);
      if (existingDomain) {
        return res.status(400).json({ message: "This domain is already registered in the system." });
      }

      // Step 1: Purchase the domain through Vercel
      const purchaseResult = await purchaseDomain(domainStr, vercelConfig);
      if (!purchaseResult.success) {
        const isBillingIssue = purchaseResult.error?.toLowerCase().includes('billing') ||
          purchaseResult.error?.toLowerCase().includes('payment');
        return res.status(400).json({
          message: purchaseResult.error || "Failed to purchase domain",
          actionRequired: isBillingIssue ? 'vercel_billing' : undefined,
          help: isBillingIssue
            ? 'Please add a payment method to your Vercel account at vercel.com/account/billing and ensure you are on a Pro or Enterprise plan.'
            : undefined,
        });
      }

      // Step 2: If connectToWebsite is true, attach it to the website's
      // Vercel project through the same flow as manually added domains
      // (apex + www twin, truthful status, real DNS records).
      const shouldConnect = connectToWebsite && website.deploymentUrl;
      let connectSuccess = false;
      let projectName: string | undefined;

      if (shouldConnect) {
        projectName = projectNameForWebsite(req.params.id);
        try {
          const attach = await attachDomainPair(projectName, domainStr, vercelConfig);
          connectSuccess = attach.success;
          if (!attach.success) {
            console.error('Failed to auto-connect domain to project:', attach.error);
          }
        } catch (addErr: any) {
          console.error('Failed to auto-connect domain to project:', addErr);
        }
      }

      // Step 3: Always create a domain record, then (when connected) run a
      // real verification pass — the same state machine as manual adds. The
      // server-side loop keeps re-checking until it is actually live.
      let customDomain = await storage.createCustomDomain({
        websiteId: req.params.id,
        domain: domainStr,
        status: 'pending',
        vercelProjectId: connectSuccess ? projectName : null,
      });
      if (connectSuccess) {
        try {
          const { row } = await refreshDomainState(customDomain, vercelConfig);
          customDomain = row;
        } catch (refreshErr) {
          console.error('Initial verification of purchased domain failed:', refreshErr);
        }
      }

      res.status(201).json({
        success: true,
        purchased: true,
        alreadyOwned: purchaseResult.alreadyOwned || false,
        connected: connectSuccess,
        domain: customDomain,
        message: customDomain.status === 'active'
          ? "Domænet er købt og live!"
          : connectSuccess
            ? "Domænet er købt og forbundet til din hjemmeside. Vi bekræfter DNS-opsætningen automatisk — status opdateres under 'Egne domæner'."
            : purchaseResult.alreadyOwned
              ? "Domænet ligger allerede på din Vercel-konto. Forbind det under 'Egne domæner'."
              : "Domænet er købt! Forbind det til din hjemmeside under 'Egne domæner'.",
      });
    } catch (error: any) {
      console.error('Domain purchase error:', error);
      const message = error.message || 'Failed to purchase domain';
      res.status(500).json({ message });
    }
  });

  // ============ SHIPPING METHODS ROUTES ============

  // List all shipping methods for a website
  app.get("/api/websites/:id/shipping-methods", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const methods = await storage.getShippingMethods(req.params.id);
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new shipping method
  app.post("/api/websites/:id/shipping-methods", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { name, description, priceAmount, currency, deliveryTime, isActive, sortOrder } = req.body;
      if (!name) {
        return res.status(400).json({ message: "Name is required" });
      }

      const method = await storage.createShippingMethod({
        websiteId: req.params.id,
        name,
        description: description || null,
        priceAmount: priceAmount ?? 0,
        currency: currency || "USD",
        deliveryTime: deliveryTime || null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0
      });

      res.status(201).json(method);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a shipping method
  app.patch("/api/websites/:id/shipping-methods/:methodId", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getShippingMethod(req.params.methodId, req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Shipping method not found" });
      }

      const { name, description, priceAmount, currency, deliveryTime, isActive, sortOrder } = req.body;
      const updated = await storage.updateShippingMethod(req.params.methodId, req.params.id, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(priceAmount !== undefined && { priceAmount }),
        ...(currency !== undefined && { currency }),
        ...(deliveryTime !== undefined && { deliveryTime }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder })
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a shipping method
  app.delete("/api/websites/:id/shipping-methods/:methodId", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getShippingMethod(req.params.methodId, req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Shipping method not found" });
      }

      await storage.deleteShippingMethod(req.params.methodId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint: Get active shipping methods for checkout
  app.get("/api/public/websites/:id/shipping-methods", async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      const methods = await storage.getActiveShippingMethods(req.params.id);
      res.json(methods);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Shipping config routes
  app.get("/api/websites/:id/shipping-config", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const config = await storage.getShippingConfig(req.params.id);
      res.json(config || { mode: 'manual', websiteId: req.params.id });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/websites/:id/shipping-config", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { mode } = req.body;
      
      if (mode === 'live') {
        const credentials = await storage.getCarrierCredentials(req.params.id);
        const activeCredentials = credentials.filter(c => c.isActive);
        if (activeCredentials.length === 0) {
          return res.status(400).json({ 
            message: "Cannot enable live carrier rates without at least one connected carrier. Please add and validate carrier credentials first." 
          });
        }
      }

      const config = await storage.createOrUpdateShippingConfig({
        websiteId: req.params.id,
        ...req.body,
      });
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Shipping carrier credentials routes
  app.get("/api/websites/:id/carrier-credentials", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const credentials = await storage.getCarrierCredentials(req.params.id);
      const masked = credentials.map(c => ({
        ...c,
        credentials: Object.fromEntries(
          Object.entries(c.credentials).map(([k, v]) => [k, '••••••••'])
        ),
      }));
      res.json(masked);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/websites/:id/carrier-credentials", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { carrier, credentials, testMode = true } = req.body;
      if (!carrier || !credentials) {
        return res.status(400).json({ message: "Carrier and credentials are required" });
      }

      const { ShippingService } = await import('./shipping');
      const isValid = await ShippingService.validateCredentials(carrier, credentials, testMode);
      
      const newCredential = await storage.createCarrierCredential({
        websiteId: req.params.id,
        carrier,
        credentials,
        testMode,
        isActive: isValid,
      });

      res.json({
        ...newCredential,
        credentials: Object.fromEntries(
          Object.entries(newCredential.credentials).map(([k, v]) => [k, '••••••••'])
        ),
        validated: isValid,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/websites/:id/carrier-credentials/:credentialId", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getCarrierCredential(req.params.credentialId, req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Credential not found" });
      }

      const updated = await storage.updateCarrierCredential(req.params.credentialId, req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Update failed" });
      }

      res.json({
        ...updated,
        credentials: Object.fromEntries(
          Object.entries(updated.credentials).map(([k, v]) => [k, '••••••••'])
        ),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/websites/:id/carrier-credentials/:credentialId", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteCarrierCredential(req.params.credentialId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get available carriers info
  app.get("/api/carriers", requireAuth, async (req, res) => {
    try {
      const { CARRIER_INFO, ShippingService } = await import('./shipping');
      const carriers = Object.values(CARRIER_INFO).map(carrier => ({
        ...carrier,
        requiredCredentials: ShippingService.getRequiredCredentials(carrier.id),
      }));
      res.json(carriers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Payment settings routes
  app.get("/api/websites/:id/payment-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Re-check non-connected accounts against Stripe so a finished
      // onboarding is detected even when the return redirect was lost
      // (tab closed, link expired, opened on another device...).
      const sync = await syncStripeConnectStatus(req.params.id);
      const settings = sync.settings;
      if (!settings) {
        return res.json({ 
          websiteId: req.params.id,
          isConnected: false,
          stripeConnectStatus: 'not_connected',
          stripeAccountId: null,
          testMode: true 
        });
      }

      // Return settings with Stripe Connect info, mask any legacy keys
      res.json({
        ...settings,
        stripeAccountId: settings.stripeAccountId || null,
        stripeConnectStatus: settings.stripeConnectStatus || 'not_connected',
        stripePublishableKey: settings.stripePublishableKey ? `${settings.stripePublishableKey.substring(0, 12)}...` : null,
        stripeSecretKey: settings.stripeSecretKey ? '••••••••••••••••••••' : null,
        stripeWebhookSecret: settings.stripeWebhookSecret ? '••••••••••••••••••••' : null,
        // Live Stripe detail (never persisted) so the UI can explain a pending state
        stripeDetailsSubmitted: sync.live?.detailsSubmitted ?? null,
        stripeChargesEnabled: sync.live?.chargesEnabled ?? null,
        stripeRequirementsDue: sync.live?.requirementsDue ?? null,
        stripeStatusCheckFailed: sync.checkFailed ?? false,
        stripeAccountMissing: sync.accountMissing ?? false,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/websites/:id/payment-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { stripePublishableKey, stripeSecretKey, stripeWebhookSecret, testMode } = req.body;
      
      if (!stripePublishableKey || !stripeSecretKey) {
        return res.status(400).json({ message: "Stripe publishable and secret keys are required" });
      }

      // Validate the keys format
      const isTestKey = stripeSecretKey.startsWith('sk_test_');
      const isLiveKey = stripeSecretKey.startsWith('sk_live_');
      if (!isTestKey && !isLiveKey) {
        return res.status(400).json({ message: "Invalid Stripe secret key format" });
      }

      const publishableIsTest = stripePublishableKey.startsWith('pk_test_');
      const publishableIsLive = stripePublishableKey.startsWith('pk_live_');
      if (!publishableIsTest && !publishableIsLive) {
        return res.status(400).json({ message: "Invalid Stripe publishable key format" });
      }

      // Check key modes match
      if ((isTestKey && publishableIsLive) || (isLiveKey && publishableIsTest)) {
        return res.status(400).json({ message: "Stripe keys must be from the same mode (both test or both live)" });
      }

      // Verify keys by making a test request to Stripe
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(stripeSecretKey);
      
      try {
        await stripe.balance.retrieve();
      } catch (stripeError: any) {
        return res.status(400).json({ 
          message: "Invalid Stripe credentials. Please check your API keys.",
          details: stripeError.message 
        });
      }

      const existing = await storage.getPaymentSettings(req.params.id);
      
      if (existing) {
        const updated = await storage.updatePaymentSettings(req.params.id, {
          stripePublishableKey,
          stripeSecretKey,
          stripeWebhookSecret: stripeWebhookSecret || null,
          testMode: isTestKey,
          isConnected: true,
        });
        res.json({
          ...updated,
          stripePublishableKey: stripePublishableKey ? `${stripePublishableKey.substring(0, 12)}...` : null,
          stripeSecretKey: '••••••••••••••••••••',
          stripeWebhookSecret: stripeWebhookSecret ? '••••••••••••••••••••' : null,
        });
      } else {
        const created = await storage.createPaymentSettings({
          websiteId: req.params.id,
          stripePublishableKey,
          stripeSecretKey,
          stripeWebhookSecret: stripeWebhookSecret || null,
          testMode: isTestKey,
          isConnected: true,
        });
        res.json({
          ...created,
          stripePublishableKey: stripePublishableKey ? `${stripePublishableKey.substring(0, 12)}...` : null,
          stripeSecretKey: '••••••••••••••••••••',
          stripeWebhookSecret: stripeWebhookSecret ? '••••••••••••••••••••' : null,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/websites/:id/payment-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getPaymentSettings(req.params.id);
      if (existing) {
        await storage.updatePaymentSettings(req.params.id, {
          stripePublishableKey: null,
          stripeSecretKey: null,
          stripeWebhookSecret: null,
          isConnected: false,
        });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Helper to get OAuth signing secret (derived from STRIPE_CONNECT_CLIENT_ID)
  const getOAuthSigningSecret = async (): Promise<string> => {
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      throw new Error('STRIPE_CONNECT_CLIENT_ID ikke konfigureret');
    }
    // Derive a secure signing key from client ID + a static salt
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(`oauth_state_${clientId}_birdflow`).digest('hex');
  };

  // Helper to create signed JWT state token for OAuth (with DB persistence)
  const createOAuthStateToken = async (websiteId: string, userId: string): Promise<string> => {
    const crypto = await import('crypto');
    const { oauthStateTokens } = await import('@shared/schema');
    
    // Use derived signing secret from STRIPE_CONNECT_CLIENT_ID
    const signingSecret = await getOAuthSigningSecret();
    
    const jti = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Persist state token to database for multi-instance replay protection
    await db.insert(oauthStateTokens).values({
      jti,
      websiteId,
      userId,
      expiresAt,
    });
    
    const payload = {
      websiteId,
      userId,
      exp: Math.floor(expiresAt.getTime() / 1000),
      jti,
    };
    
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', signingSecret).update(payloadStr).digest('base64url');
    
    return `${payloadStr}.${signature}`;
  };
  
  // Helper to atomically verify and consume OAuth state token
  // Returns token data if valid and unused, marks as used atomically to prevent race conditions
  const verifyAndConsumeOAuthStateToken = async (token: string): Promise<{ websiteId: string; userId: string } | null> => {
    try {
      const crypto = await import('crypto');
      const { oauthStateTokens } = await import('@shared/schema');
      const { isNull, and } = await import('drizzle-orm');
      const [payloadStr, signature] = token.split('.');
      
      if (!payloadStr || !signature) return null;
      
      // Use derived signing secret from STRIPE_CONNECT_CLIENT_ID
      const signingSecret = await getOAuthSigningSecret();
      
      // Verify signature first (cheap check before DB query)
      const expectedSignature = crypto.createHmac('sha256', signingSecret).update(payloadStr).digest('base64url');
      if (signature !== expectedSignature) {
        console.error('OAuth state token signature verification failed');
        return null;
      }
      
      // Parse and validate payload
      const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());
      
      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        console.error('OAuth state token expired');
        return null;
      }
      
      // ATOMIC: Update token to mark as used WHERE it exists AND usedAt is NULL
      // This prevents race conditions - only one concurrent request can succeed
      const updateResult = await db.update(oauthStateTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(oauthStateTokens.jti, payload.jti),
            isNull(oauthStateTokens.usedAt)
          )
        )
        .returning({ jti: oauthStateTokens.jti });
      
      if (updateResult.length === 0) {
        // Either token doesn't exist or was already used
        console.error('OAuth state token not found or already used (replay attack prevented)');
        return null;
      }
      
      return { websiteId: payload.websiteId, userId: payload.userId };
    } catch (error) {
      console.error('OAuth state token verification error:', error);
      return null;
    }
  };
  
  // Cleanup expired OAuth state tokens periodically (every 5 minutes)
  setInterval(async () => {
    try {
      const { oauthStateTokens } = await import('@shared/schema');
      const { lt } = await import('drizzle-orm');
      await db.delete(oauthStateTokens)
        .where(lt(oauthStateTokens.expiresAt, new Date()));
    } catch (error) {
      console.error('OAuth token cleanup error:', error);
    }
  }, 5 * 60 * 1000);

  // Stripe Connect - Initiate connection using Account Links API (Express accounts)
  app.post("/api/stripe/connect/:websiteId", requireAuth, async (req, res) => {
    try {
      const { websiteId } = req.params;
      const userId = (req as any).user.id;
      
      const website = await storage.getWebsite(websiteId);
      if (!website) {
        return res.status(404).json({ message: "Website ikke fundet" });
      }
      if (website.ownerId !== userId) {
        return res.status(403).json({ message: "Ikke autoriseret" });
      }

      // Get platform Stripe secret key
      const platformStripeSecretKey = await getStripeSecretKey();
      if (!platformStripeSecretKey) {
        return res.status(500).json({ message: "Stripe er ikke konfigureret" });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(platformStripeSecretKey);

      // Check if we already have an account for this website
      const existingSettings = await storage.getPaymentSettings(websiteId);
      let stripeAccountId = existingSettings?.stripeAccountId;

      // Create new Express account if none exists
      if (!stripeAccountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'DK',
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: 'individual',
          metadata: {
            websiteId: websiteId,
            userId: userId,
          },
        });
        stripeAccountId = account.id;

        // Store the account ID
        if (existingSettings) {
          await storage.updatePaymentSettings(websiteId, {
            stripeAccountId: stripeAccountId,
            stripeConnectStatus: 'pending',
          });
        } else {
          await storage.createPaymentSettings({
            websiteId: websiteId,
            stripeAccountId: stripeAccountId,
            stripeConnectStatus: 'pending',
            isConnected: false,
            testMode: true,
          });
        }
      }

      // Generate signed state token for secure return
      const stateToken = await createOAuthStateToken(websiteId, userId);

      // Generate account link for onboarding.
      // Origin comes from the request host validated against this app's own
      // domains (falling back to the canonical deployment domain) - never a
      // hand-configured BASE_URL (goes stale) and never a raw Host header
      // (spoofable).
      const baseUrl = resolveAppOrigin(req.headers.host);
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${baseUrl}/api/stripe/connect/refresh/${websiteId}?state=${encodeURIComponent(stateToken)}`,
        return_url: `${baseUrl}/api/stripe/connect/return/${websiteId}?state=${encodeURIComponent(stateToken)}`,
        type: 'account_onboarding',
      });

      console.log(`Stripe Connect account link created for website ${websiteId}: ${stripeAccountId}`);
      res.json({ url: accountLink.url });
    } catch (error: any) {
      console.error('Stripe Connect initiation error:', error);
      
      // Provide user-friendly error messages in Danish
      let userMessage = error.message;
      if (error.message?.includes("signed up for Connect")) {
        userMessage = "Stripe Connect er ikke aktiveret på din platform-konto. Gå til dashboard.stripe.com/connect for at aktivere det.";
      } else if (error.message?.includes("production")) {
        userMessage = "Stripe produktion er ikke konfigureret. Kontakt support.";
      }
      
      res.status(500).json({ message: userMessage });
    }
  });

  // Stripe Connect - Return handler (user completed or exited onboarding)
  app.get("/api/stripe/connect/return/:websiteId", async (req, res) => {
    try {
      const { websiteId } = req.params;
      const { state: stateToken } = req.query;

      // Verify signed state token for security
      const stateData = await verifyAndConsumeOAuthStateToken(stateToken as string);
      if (!stateData) {
        console.error('Invalid or expired state token in return handler');
        return res.redirect(`/dashboard?stripe_error=${encodeURIComponent('Session udløbet. Prøv venligst igen.')}`);
      }

      // Verify websiteId matches state
      if (stateData.websiteId !== websiteId) {
        console.error(`Website ID mismatch: ${websiteId} vs ${stateData.websiteId}`);
        return res.redirect(`/dashboard?stripe_error=${encodeURIComponent('Ugyldig anmodning.')}`);
      }

      const website = await storage.getWebsite(websiteId);
      if (!website) {
        return res.redirect(`/dashboard?stripe_error=${encodeURIComponent('Website ikke fundet')}`);
      }

      // Verify ownership
      if (website.ownerId !== stateData.userId) {
        console.error(`Ownership mismatch for website ${websiteId}`);
        return res.redirect(`/dashboard?stripe_error=${encodeURIComponent('Ikke autoriseret.')}`);
      }

      const settings = await storage.getPaymentSettings(websiteId);
      if (!settings?.stripeAccountId) {
        return res.redirect(`/manage/${websiteId}?section=settings&stripe_error=${encodeURIComponent('Stripe konto ikke fundet')}`);
      }

      // Sync stored status from Stripe (shared with the payment-settings
      // endpoint, so the status also converges without this redirect).
      const sync = await syncStripeConnectStatus(websiteId);

      if (sync.accountMissing) {
        return res.redirect(`/manage/${websiteId}?section=settings&stripe_error=${encodeURIComponent('Din Stripe-konto kunne ikke findes. Prøv at forbinde igen.')}`);
      }
      if (sync.checkFailed) {
        return res.redirect(`/manage/${websiteId}?section=settings&stripe_error=${encodeURIComponent('Status hos Stripe kunne ikke bekræftes. Prøv igen om et øjeblik.')}`);
      }
      if (sync.settings?.stripeConnectStatus === 'connected') {
        console.log(`Stripe Connect completed for website ${websiteId}: ${settings.stripeAccountId}`);
        return res.redirect(`/manage/${websiteId}?section=settings&stripe_connected=true`);
      }
      // Onboarding not complete yet - land on settings with a visible pending state
      return res.redirect(`/manage/${websiteId}?section=settings&stripe_pending=true`);
    } catch (error: any) {
      console.error('Stripe Connect return error:', error);
      res.redirect(`/dashboard?stripe_error=${encodeURIComponent(error.message)}`);
    }
  });

  // Stripe Connect - Refresh handler (user needs to restart onboarding)
  app.get("/api/stripe/connect/refresh/:websiteId", async (req, res) => {
    const { websiteId } = req.params;
    const { state: stateToken } = req.query;

    // Verify state token (but don't consume - user will restart)
    // For refresh, we just validate format and redirect
    if (!stateToken) {
      return res.redirect(`/manage/${websiteId}?section=settings&stripe_refresh=true&error=session_expired`);
    }
    
    res.redirect(`/manage/${websiteId}?section=settings&stripe_refresh=true`);
  });

  // Stripe Connect - Disconnect account
  app.post("/api/stripe/disconnect/:websiteId", requireAuth, async (req, res) => {
    try {
      const { websiteId } = req.params;
      
      const website = await storage.getWebsite(websiteId);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getPaymentSettings(websiteId);
      if (existing) {
        await storage.updatePaymentSettings(websiteId, {
          stripeAccountId: null,
          stripeConnectStatus: 'not_connected',
          isConnected: false,
        });
      }

      res.json({ success: true, message: "Stripe account disconnected" });
    } catch (error: any) {
      console.error('Stripe disconnect error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Build mode (directly applies changes)
  /**
   * The tool-using builder agent, streamed over SSE.
   *
   * The agent works on an in-memory copy and never persists; this route
   * owns the load-bearing tail exactly once, in order:
   *   self-check -> sanitize custom content -> save -> Danish report.
   * (ai:// markers are resolved inside the agent's tools, before each
   * mutation applies, so the "markers before apply" rule still holds.)
   *
   * On a large change the agent stops and returns what it has; the
   * client shows an approval card and POSTs those mutations to
   * /ai/apply, which runs the same tail.
   */
  app.post("/api/websites/:id/ai/agent", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    // Per-user budget: one message can be a dozen model calls. Shared with
    // Plan mode and Build mode (server/aiRateLimit.ts) so the three surfaces
    // draw on one budget rather than three.
    const userId = (req as any).user?.id ?? req.params.id;
    const budget = consumeAgentRun(userId);
    if (!budget.ok) {
      return res.status(429).json({ message: budget.message });
    }

    const bodySchema = z.object({
      prompt: z.string().trim().min(1).max(4000),
      approvedLargeChanges: z.boolean().optional(),
    });
    const parsed = bodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Ugyldig forespørgsel" });
    }

    const builderData = await storage.getBuilderState(req.params.id);
    if (!builderData) {
      return res.status(404).json({ message: "Builder state not found" });
    }
    const currentState = builderData.state as BuilderStateData;
    // The website's own language: every word the agent writes onto the site
    // follows the customer's onboarding choice, run after run.
    const agentWebsite = await storage.getWebsite(req.params.id);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // don't let a proxy buffer the stream
    const send = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const { runBuilderAgent } = await import("./aiAgent");
      const outcome = await runBuilderAgent({
        websiteId: req.params.id,
        ownerId: userId,
        prompt: parsed.data.prompt,
        state: currentState,
        approvedLargeChanges: parsed.data.approvedLargeChanges === true,
        language: normalizeSiteLanguage(agentWebsite?.language),
        onEvent: send,
      });

      if (outcome.status === "failed") {
        send({ type: "error", message: outcome.message });
        return res.end();
      }

      if (outcome.status === "needs_approval") {
        // Nothing was saved. The client asks the user, then replays the
        // mutations through /ai/apply.
        send({
          type: "result",
          status: "needs_approval",
          reason: outcome.reason,
          summary: outcome.summary,
          mutations: outcome.mutations,
        });
        return res.end();
      }

      if (outcome.mutations.length === 0) {
        send({ type: "result", status: "no_changes", summary: outcome.summary });
        return res.end();
      }

      // ---- the load-bearing tail, once, in order ----
      let newState = outcome.state;
      const check = runSelfCheck(newState);
      newState = check.state;
      sanitizeBuilderStateCustomContent(newState);
      // Final deterministic claims guard before anything is persisted.
      // Tool-level gates already judged each mutation, but materialization
      // (registry defaults, self-check rewrites) happens after them — so the
      // finished state is judged once more. Evidence = business facts + the
      // site as it stood BEFORE the run: what already stood survives, what
      // the run invented does not.
      const claimScrub = scrubStateClaims(newState, newState.businessContext, currentState);
      newState = claimScrub.state;
      // An agent run takes minutes; the canvas autosaves every two seconds.
      // The run started from the state read at `builderData.revision`, so
      // writing it back unconditionally would undo everything the customer
      // did while it was thinking - including a page reorder or a menu edit,
      // which leaves no visible trace on the section they were looking at.
      const savedAgent = await saveBuilderStateGuarded(
        req.params.id,
        newState,
        builderData.revision
      );
      if (!savedAgent.ok) {
        send({
          type: "error",
          message: savedAgent.message,
          conflict: true,
          revision: savedAgent.revision,
          state: savedAgent.state,
        });
        return res.end();
      }
      // The site the customer is deciding about just changed - new revision,
      // and any approval that has not been paid for is void.
      await bumpSiteRevision(req.params.id).catch(() => {});

      // Design-direction post-processing — runs for ALL deviation levels, only
      // AFTER the CAS save succeeds. Ordering is critical:
      //   1. Persist mutations on the proposal (for guide/site-wide API paths)
      //   2. Mark the proposal as applied (prevents replay by the approve API)
      //   3. Supersede all OTHER pending proposals (they targeted the old state)
      //   4. Emit brand_evolution_offer ONLY for high-deviation (experimental) directions
      if (outcome.appliedDirectionProposalId) {
        const { getProposal, updateProposalMutations, markProposalApplied, supersedePendingProposals } =
          await import("./proposalStore");
        const evtProposal = getProposal(outcome.appliedDirectionProposalId);
        if (evtProposal) {
          updateProposalMutations(outcome.appliedDirectionProposalId, outcome.mutations);
          markProposalApplied(outcome.appliedDirectionProposalId);
          // Invalidate sibling directions generated against the now-changed state.
          supersedePendingProposals(req.params.id);
          // Only experimental (high-deviation) directions get the post-apply card.
          if (outcome.appliedDirectionDeviationLevel === "high") {
            send({
              type: "brand_evolution_offer",
              proposalId: outcome.appliedDirectionProposalId,
              directionName: evtProposal.direction.name,
              designIntent: evtProposal.direction.designIntent,
              brandDeviation: evtProposal.direction.brandDeviation,
            });
          }
        }
      }

      // The three-level self-review, on the state the customer actually
      // keeps (post-repair, post-scrub, post-save). Level A findings were
      // collected by the runSelfCheck above; this adds publish parity and
      // the AI recommendation/proposal levels. Advisory by construction:
      // the save above stands whatever the review finds — but a parity
      // failure leads the report, so the run is never PRESENTED as clean
      // while the published site would diverge.
      const review = await completeSelfReview(newState, {
        findings: check.findings,
        language: normalizeSiteLanguage(agentWebsite?.language),
      });

      const report = buildReport(
        outcome.mutations,
        newState,
        [...outcome.notes, ...check.notes, ...claimScrub.notes],
        outcome.createdImages,
        review
      );

      send({
        type: "result",
        status: "completed",
        summary: outcome.summary,
        steps: outcome.steps,
        newState,
        report,
        // The client adopts this so its next autosave is not judged stale.
        revision: savedAgent.revision,
      });
      res.end();
    } catch (error: any) {
      console.error("AI agent error:", error);
      if (res.headersSent) {
        send({ type: "error", message: error?.message ?? "Agenten fejlede" });
        res.end();
      } else {
        res.status(500).json({ message: error?.message ?? "Agenten fejlede" });
      }
    }
  });

  // AI Builder - Apply mutations (replays an approval-gated agent run).
  // requireWebsitePermission, not a raw owner check: team members and
  // administrators with builder access use the same assistant.
  app.post("/api/websites/:id/ai/apply", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const { mutations } = req.body;
      if (!mutations || !Array.isArray(mutations)) {
        return res.status(400).json({ message: "Mutations array is required" });
      }

      // Depth-guard raw client JSON before the recursive z.lazy schema walks it.
      assertSaneJsonDepth(mutations);
      const validatedMutations = mutations.map(m => BuilderMutationSchema.parse(m));

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }

      const currentState = builderData.state as BuilderStateData;

      // Invented-claims gate for replayed mutations. The agent run that
      // proposed them was gated when it ran, but this endpoint persists
      // them against TODAY's state — so they are judged against today's
      // business facts too, not waved through on age.
      const claimErrors = validatedMutations.flatMap((m) =>
        checkMutationClaims(m as Record<string, any>, currentState).map((f) => f.message)
      );
      if (claimErrors.length > 0) {
        return res.status(422).json({
          message: Array.from(new Set(claimErrors)).join(" "),
        });
      }

      // Generate any "ai://" images and swap markers for hosted URLs
      const resolved = await resolveAiImageMarkers(
        req.params.id,
        validatedMutations,
        currentState.brandGuide,
        // One image budget per editing session for this website. Per request
        // it would refill on every save, which is no budget at all.
        runMeterFor("image", `mutations:${req.params.id}`, { ttlMs: 60 * 60 * 1000 })
      );

      let newState = applyMutations(currentState, resolved.mutations);

      // Deterministic self-check: links, WCAG contrast, responsive hazards
      const check = runSelfCheck(newState);
      newState = check.state;
      sanitizeBuilderStateCustomContent(newState);

      // The mutations were applied to the state read above. If anything else
      // has written since - an autosave, a build step - they were applied to
      // a site that no longer exists, so the write is refused rather than
      // silently rolling the other writer back.
      const savedApply = await saveBuilderStateGuarded(
        req.params.id,
        newState,
        builderData.revision
      );
      if (!savedApply.ok) {
        return res.status(409).json({
          message: savedApply.message,
          revision: savedApply.revision,
          state: savedApply.state,
        });
      }
      await bumpSiteRevision(req.params.id).catch(() => {});

      const report = buildReport(
        resolved.mutations,
        newState,
        [...resolved.notes, ...check.notes],
        resolved.created
      );

      res.json({
        success: true,
        newState,
        report,
        revision: savedApply.revision,
      });
    } catch (error: any) {
      if (isSpendLimitError(error)) return respondSpendLimit(res, error);
      console.error("AI Apply error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Design interview (guided brand-guide wizard)
  const designInterviewHits = new Map<string, number[]>();
  const diHex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
  const diPaletteSchema = z.object({
    id: z.string().max(64),
    name: z.string().max(120),
    description: z.string().max(600),
    colors: z.object({
      primary: diHex,
      secondary: diHex,
      accent: diHex,
      background: diHex,
      surface: diHex,
      text: diHex,
    }),
  });
  const diFontPairSchema = z.object({
    id: z.string().max(64),
    name: z.string().max(120),
    heading: z.string().max(80),
    body: z.string().max(80),
    scale: z.enum(["modern", "editorial", "classic", "bold"]),
    description: z.string().max(600),
  });
  const diBodySchema = z.discriminatedUnion("step", [
    z.object({ step: z.literal("palettes"), feeling: z.string().min(1).max(200) }),
    z.object({ step: z.literal("typography"), feeling: z.string().min(1).max(200), palette: diPaletteSchema }),
    z.object({
      step: z.literal("finalize"),
      feeling: z.string().min(1).max(200),
      palette: diPaletteSchema,
      fontPair: diFontPairSchema,
      imageUrls: z.array(z.string().max(512)).max(5).optional(),
      notes: z.string().max(1000).optional(),
      applyToGlobalStyles: z.boolean().optional(),
    }),
  ]);

  app.post("/api/websites/:id/ai/design-interview", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      // Lightweight per-user rate limit: each step is a model call.
      const userId = (req as any).user?.id ?? req.params.id;
      const now = Date.now();
      const recentHits = (designInterviewHits.get(userId) ?? []).filter((t) => now - t < 10 * 60 * 1000);
      if (recentHits.length >= 30) {
        designInterviewHits.set(userId, recentHits);
        return res.status(429).json({ message: "For mange design-interview-forespørgsler. Vent et par minutter og prøv igen." });
      }
      recentHits.push(now);
      designInterviewHits.set(userId, recentHits);

      const parsedBody = diBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: "Ugyldigt input til design-interviewet" });
      }
      const body = parsedBody.data;

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }
      const currentState = builderData.state as BuilderStateData;

      const { proposePalettes, proposeFontPairs, finalizeBrandGuide, CURATED_GOOGLE_FONTS } = await import("./designInterview");

      // Palette names, font-pair rationales and the brand guide's tone notes
      // are written in the website's own language.
      const interviewWebsite = await storage.getWebsite(req.params.id);
      const interviewLanguage = normalizeSiteLanguage(interviewWebsite?.language);

      // Palettes, fonts and the finalize pass are three requests but one
      // interview, so they share one ceiling.
      const interviewMeter = runMeterFor("designInterview", `interview:${req.params.id}`);

      if (body.step === "palettes") {
        const palettes = await proposePalettes(
          body.feeling,
          currentState,
          interviewLanguage,
          interviewMeter
        );
        return res.json({ success: true, palettes });
      }

      if (body.step === "typography") {
        const fontPairs = await proposeFontPairs(
          body.feeling,
          body.palette,
          currentState,
          interviewLanguage,
          interviewMeter
        );
        return res.json({ success: true, fontPairs });
      }

      // finalize
      const fontAllowlist = new Set<string>(CURATED_GOOGLE_FONTS);
      if (!fontAllowlist.has(body.fontPair.heading) || !fontAllowlist.has(body.fontPair.body)) {
        return res.status(400).json({ message: "Ugyldig skrifttype" });
      }

      // Only analyze images registered in THIS website's media library —
      // prevents reading other tenants' objects via guessed /objects/ paths.
      let safeImageUrls: string[] = [];
      if (body.imageUrls && body.imageUrls.length > 0) {
        const assets = await storage.getMediaAssets(req.params.id);
        const owned = new Set(assets.map((a) => a.storagePath));
        safeImageUrls = body.imageUrls.filter((u) => owned.has(u)).slice(0, 5);
      }

      const { guide, analyzedImages, summary } = await finalizeBrandGuide(
        {
          feeling: body.feeling,
          palette: body.palette,
          fontPair: body.fontPair,
          imageUrls: safeImageUrls,
          notes: body.notes,
          language: interviewLanguage,
        },
        currentState,
        interviewMeter
      );

      const newState = structuredClone(currentState);
      newState.brandGuide = guide;
      if (body.applyToGlobalStyles !== false) {
        newState.globalStyles = { ...newState.globalStyles, ...brandGuideToDesignTokens(guide) };
      }
      // The interview took several model calls on a copy of the site; write
      // it back only if that copy is still current.
      const savedGuide = await saveBuilderStateGuarded(
        req.params.id,
        newState,
        builderData.revision
      );
      if (!savedGuide.ok) {
        return res.status(409).json({
          message: savedGuide.message,
          revision: savedGuide.revision,
          state: savedGuide.state,
        });
      }

      const report = {
        oprettet: ["Brand guide oprettet ud fra design-interviewet."],
        aendret: body.applyToGlobalStyles !== false
          ? ["Farver og typografi anvendt på hele sitet."]
          : [],
        tjek: analyzedImages > 0
          ? [`${analyzedImages} inspirationsbillede(r) analyseret og omsat til billedstil og stemning.`]
          : ["Ingen inspirationsbilleder — brand guiden bygger på dine valg i interviewet."],
      };

      return res.json({ success: true, brandGuide: guide, newState, report, summary, revision: savedGuide.revision });
    } catch (error: any) {
      if (isSpendLimitError(error)) return respondSpendLimit(res, error);
      console.error("Design interview error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI onboarding — background generation of brand guide + first website,
  // with polled progress. One full generation per (empty) website.
  const onboardingGenStarts = new Map<string, number[]>();
  const onboardingGenBodySchema = z.object({
    business: z.object({
      name: z.string().min(1).max(80),
      industry: z.string().max(80).default(""),
      description: z.string().max(2000).default(""),
    }),
    wishes: z.object({
      goals: z.array(z.string().max(40)).max(8).default([]),
      notes: z.string().max(2000).default(""),
    }),
    feeling: z.string().min(1).max(200),
    palette: diPaletteSchema,
    fontPair: diFontPairSchema,
    logoUrl: z.string().max(512).optional(),
    logoMediaId: z.string().max(128).optional(),
    inspirationUrls: z.array(z.string().max(512)).max(5).default([]),
    ownImageUrls: z.array(z.string().max(512)).max(6).default([]),
  });

  app.post("/api/websites/:id/onboarding/generate", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const { getOnboardingGenStatus, isOnboardingGenRunning, startOnboardingGeneration } = await import("./onboardingGenerator");

      // Already running → return live status (makes the client restart-safe)
      if (isOnboardingGenRunning(req.params.id)) {
        return res.json({ success: true, status: getOnboardingGenStatus(req.params.id) });
      }

      const parsedBody = onboardingGenBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        return res.status(400).json({ message: "Ugyldigt input til AI-opbygningen" });
      }
      const body = parsedBody.data;

      // Same font allowlist guard as the design interview
      const { CURATED_GOOGLE_FONTS } = await import("./designInterview");
      const fontAllowlist = new Set<string>(CURATED_GOOGLE_FONTS);
      if (!fontAllowlist.has(body.fontPair.heading) || !fontAllowlist.has(body.fontPair.body)) {
        return res.status(400).json({ message: "Ugyldig skrifttype" });
      }

      // Only generate onto an empty site — a finished build is never overwritten.
      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }
      const currentState = builderData.state as BuilderStateData;
      const componentCount = currentState.pages.reduce((sum, p) => sum + (p.components?.length ?? 0), 0);
      if (componentCount > 0) {
        const finished = getOnboardingGenStatus(req.params.id);
        return res.status(409).json({
          message: "Websitet er allerede bygget.",
          alreadyBuilt: true,
          status: finished?.done ? finished : undefined,
        });
      }

      // Each start is a full multi-model pipeline — cap retries per website.
      const now = Date.now();
      const starts = (onboardingGenStarts.get(req.params.id) ?? []).filter((t) => now - t < 6 * 60 * 60 * 1000);
      if (starts.length >= 3) {
        return res.status(429).json({ message: "For mange forsøg på kort tid. Fortsæt til editoren og byg videre med AI-assistenten der." });
      }
      starts.push(now);
      onboardingGenStarts.set(req.params.id, starts);

      // Media ownership: only accept /objects/ paths registered to THIS website.
      const assets = await storage.getMediaAssets(req.params.id);
      const owned = new Set(assets.map((a) => a.storagePath));
      const ownedIds = new Set(assets.map((a) => a.id));
      const logoUrl = body.logoUrl && owned.has(body.logoUrl) ? body.logoUrl : undefined;
      const logoMediaId = logoUrl && body.logoMediaId && ownedIds.has(body.logoMediaId) ? body.logoMediaId : undefined;

      // The durable language lives on the website row, not on the request or
      // the onboarding session: a restart mid-build must rebuild the site in
      // the same language the customer chose.
      const genWebsite = await storage.getWebsite(req.params.id);

      const status = startOnboardingGeneration(req.params.id, {
        language: normalizeSiteLanguage(genWebsite?.language),
        business: body.business,
        wishes: body.wishes,
        feeling: body.feeling,
        palette: body.palette,
        fontPair: body.fontPair,
        logoUrl,
        logoMediaId,
        inspirationUrls: body.inspirationUrls.filter((u) => owned.has(u)).slice(0, 5),
        ownImageUrls: body.ownImageUrls.filter((u) => owned.has(u)).slice(0, 6),
      });

      res.json({ success: true, status });
    } catch (error: any) {
      console.error("Onboarding generate error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/websites/:id/onboarding/generate/status", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const { getOnboardingGenStatus, isOnboardingGenRunning } = await import("./onboardingGenerator");
      const status = getOnboardingGenStatus(req.params.id);
      if (status) {
        return res.json({ success: true, active: isOnboardingGenRunning(req.params.id), status });
      }
      // No job in memory (e.g. server restarted mid-flow). The generator
      // write-throughs every phase to onboarding_sessions.gen_status, so
      // serve the persisted snapshot — a finished/failed run keeps its
      // report and fallback flag across restarts.
      const session = await storage.getOnboardingSessionByWebsiteId(req.params.id);
      if (session?.genStatus) {
        return res.json({ success: true, active: false, status: session.genStatus });
      }
      // Nothing persisted either — report whether the site already has
      // content so the client can move on instead of hanging.
      const builderData = await storage.getBuilderState(req.params.id);
      const state = builderData?.state as BuilderStateData | undefined;
      const built = !!state && state.pages.reduce((sum, p) => sum + (p.components?.length ?? 0), 0) > 0;
      res.json({ success: true, active: false, status: null, built });
    } catch (error: any) {
      console.error("Onboarding generate status error:", error);
      res.status(500).json({ message: error.message });
    }
  });


  // AI Architect - Build from Plan - executes plan and creates builder_state
  app.post("/api/websites/:id/ai/architect-build", requireAuth, requireWebsitePermission("updateBuilder"), async (req, res) => {
    try {
      const { plan } = req.body;
      if (!plan) {
        return res.status(400).json({ message: "Plan is required" });
      }

      // Read first: the build replaces the whole site, so it must not land
      // on top of edits made while the plan was being executed.
      const existingBuilderState = await storage.getBuilderState(req.params.id);
      const existingState = existingBuilderState?.state as BuilderStateData | undefined;

      const { buildFromPlan } = await import("./websiteArchitect");
      const result = await buildFromPlan(
        plan,
        runMeterFor("architectBuild", `architect:${req.params.id}`),
        existingState?.businessContext
      );

      if (!result.success || !result.builderState) {
        return res.status(500).json({
          message: result.error || "Failed to build website from plan",
        });
      }

      // A rebuild replaces the pages, not what the customer told us about
      // their business: the context survives, and the fresh machine output
      // is scrubbed against it (it must not vouch for itself as evidence).
      if (existingState?.businessContext) {
        result.builderState.businessContext = existingState.businessContext;
      }
      const claimScrub = scrubStateClaims(result.builderState, existingState?.businessContext);
      result.builderState = claimScrub.state;

      // Deterministic self-check on the freshly built site
      const check = runSelfCheck(result.builderState);
      const newState = check.state;
      sanitizeBuilderStateCustomContent(newState);

      // Save the new builder state
      const savedBuild = await saveBuilderStateGuarded(
        req.params.id,
        newState,
        existingBuilderState?.revision
      );
      if (!savedBuild.ok) {
        return res.status(409).json({
          message: savedBuild.message,
          revision: savedBuild.revision,
          state: savedBuild.state,
        });
      }
      await bumpSiteRevision(req.params.id).catch(() => {});

      const report = buildReport(
        [],
        newState,
        [...claimScrub.notes, ...check.notes],
        newState.pages.map((p: any) => `Side "${p.name}" bygget med ${p.components.length} sektioner.`)
      );

      res.json({
        success: true,
        newState,
        phasesCompleted: result.phasesCompleted,
        report,
        revision: savedBuild.revision,
      });
    } catch (error: any) {
      if (isSpendLimitError(error)) return respondSpendLimit(res, error);
      console.error("AI Architect Build error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics - Track event (public endpoint for published sites)
  // Handle CORS preflight for analytics tracking from custom domains
  app.options("/api/public/analytics/track", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(204).end();
  });

  app.post("/api/public/analytics/track", async (req, res) => {
    // Allow CORS from any origin (published sites on custom domains)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    
    try {
      let { websiteId, sessionId, eventType, pageUrl, trafficSource, deviceType, country, eventData, referrer } = req.body;
      
      // If websiteId is missing, try to resolve from referer/origin header
      if (!websiteId) {
        const referer = req.headers.referer || req.headers.origin;
        if (referer) {
          try {
            const refererUrl = new URL(referer as string);
            const protocol = refererUrl.protocol; // 'https:' or 'http:'
            const hostname = refererUrl.hostname.toLowerCase().replace(/\.$/, '');
            const port = refererUrl.port;
            const hostWithPort = port ? `${hostname}:${port}` : hostname;
            const strippedHost = hostname.replace(/^www\./, '');
            const strippedHostWithPort = port ? `${strippedHost}:${port}` : strippedHost;
            
            // Try to find website by deployment URL - try exact match first, then variations
            let resolvedWebsite: any = null;
            const urlsToTry = [
              // Exact match with original protocol and port
              `${protocol}//${hostWithPort}`,
              `${protocol}//${strippedHostWithPort}`,
              // Standard https variations (with and without port)
              `https://${strippedHost}`,
              `https://www.${strippedHost}`,
              `https://${strippedHostWithPort}`,
              `https://www.${strippedHostWithPort}`,
              // http variations for local/dev environments (with and without port)
              `http://${strippedHost}`,
              `http://www.${strippedHost}`,
              `http://${strippedHostWithPort}`,
              `http://www.${strippedHostWithPort}`,
            ];
            
            for (const url of urlsToTry) {
              if (!resolvedWebsite) {
                resolvedWebsite = await storage.getWebsiteByDeploymentUrl(url);
              }
            }
            
            // Try custom domain if not found by deployment URL (with and without port)
            const domainsToTry = [strippedHost, hostname, strippedHostWithPort, hostWithPort].filter((v, i, a) => a.indexOf(v) === i);
            for (const domain of domainsToTry) {
              if (!resolvedWebsite) {
                resolvedWebsite = await storage.getWebsiteByCustomDomain(domain);
              }
            }
            if (resolvedWebsite) {
              websiteId = resolvedWebsite.id;
              console.log(`[Analytics] Resolved websiteId ${websiteId} from referer ${hostWithPort}`);
            }
          } catch (e) {
            console.log(`[Analytics] Could not parse referer: ${referer}`);
          }
        }
      }
      
      if (!websiteId || !sessionId || !eventType) {
        console.log(`[Analytics] Missing required fields - websiteId: ${websiteId}, sessionId: ${sessionId}, eventType: ${eventType}`);
        return res.status(400).json({ message: "websiteId, sessionId, and eventType are required" });
      }

      const validEventTypes = ['page_view', 'page_time', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_success', 'order_created', 'booking_submit', 'booking_created'];
      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({ message: "Invalid event type" });
      }

      const website = await storage.getWebsite(websiteId);
      if (!website) {
        console.log(`[Analytics] Website not found for id: ${websiteId}`);
        return res.status(404).json({ message: "Website not found" });
      }

      // Privacy-first: Use centralized sanitization from shared schema
      const sanitizedEventData = sanitizeAnalyticsEventData(eventData);

      // page_time beacons: durationSeconds must be a finite number in
      // [1, 3600] - anything else is dropped so a hostile client cannot
      // inflate averages or store junk.
      if (eventType === 'page_time') {
        const raw = sanitizedEventData?.durationSeconds;
        const numeric = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(numeric) || numeric < 1) {
          return res.status(400).json({ message: "Invalid durationSeconds" });
        }
        sanitizedEventData!.durationSeconds = Math.min(Math.round(numeric), 3600);
      } else if (sanitizedEventData && 'durationSeconds' in sanitizedEventData) {
        delete sanitizedEventData.durationSeconds;
      }

      // Classify the traffic source server-side. New trackers send the raw
      // document.referrer (possibly empty = direct); older ones only send a
      // precomputed trafficSource, which we keep as-is.
      let pageHost: string | null = null;
      try {
        const originHeader = (req.headers.origin || req.headers.referer) as string | undefined;
        if (originHeader) pageHost = new URL(originHeader).hostname;
      } catch {
        pageHost = null;
      }
      const utmSource =
        (typeof sanitizedEventData?.utm_source === "string" ? sanitizedEventData.utm_source : null) ||
        extractUtmSource(typeof pageUrl === "string" ? pageUrl : null);
      if (typeof referrer === "string" || utmSource) {
        trafficSource = classifyTrafficSource({
          referrer: typeof referrer === "string" ? referrer : null,
          utmSource,
          pageHost,
        });
      }

      // GDPR: resolve country from the request IP in-process and store only
      // the ISO 3166-1 alpha-2 code. The IP itself is never persisted.
      if (typeof country === "string" && country) {
        country = /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : null;
      }
      if (!country) {
        country = await lookupCountry(getClientIp(req));
      }

      await storage.createAnalyticsEvent({
        websiteId,
        sessionId,
        eventType,
        pageUrl: pageUrl || null,
        trafficSource: trafficSource || null,
        deviceType: deviceType || null,
        country: country || null,
        eventData: sanitizedEventData,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Analytics track error:", error);
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  // Analytics - Get overview (authenticated, owner only)
  app.get("/api/websites/:id/analytics/overview", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const overview = await storage.getAnalyticsOverview(req.params.id, startDate, endDate);
      res.json(overview);
    } catch (error: any) {
      console.error("Analytics overview error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics - Get funnel data
  app.get("/api/websites/:id/analytics/funnel", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const funnel = await storage.getAnalyticsFunnel(req.params.id, startDate, endDate);
      res.json(funnel);
    } catch (error: any) {
      console.error("Analytics funnel error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics - Get traffic sources
  app.get("/api/websites/:id/analytics/traffic", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const traffic = await storage.getTrafficSources(req.params.id, startDate, endDate);
      res.json(traffic);
    } catch (error: any) {
      console.error("Analytics traffic error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics - Get top pages
  app.get("/api/websites/:id/analytics/pages", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const website = getWebsiteAccess(req).website;

      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pages = await storage.getTopPages(req.params.id, startDate, endDate);
      res.json(pages);
    } catch (error: any) {
      console.error("Analytics pages error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Analytics - Daily visits series for the line chart
  app.get("/api/websites/:id/analytics/timeseries", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const endDate = new Date();
      // Align the window start to a Copenhagen calendar day so the first
      // bucket of the chart is a complete local day.
      const startDate = copenhagenDayStart(new Date(endDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000));

      const points = await storage.getAnalyticsTimeseries(req.params.id, startDate, endDate);
      res.json({ points });
    } catch (error: any) {
      console.error("Analytics timeseries error:", error);
      res.status(500).json({ message: "Kunne ikke hente besøgsdata" });
    }
  });

  // Analytics - Live visitors right now (distinct sessions, last 5 minutes)
  app.get("/api/websites/:id/analytics/live", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const live = await storage.getLiveVisitors(req.params.id);
      res.json(live);
    } catch (error: any) {
      console.error("Analytics live error:", error);
      res.status(500).json({ message: "Kunne ikke hente live-besøgende" });
    }
  });

  // Analytics - Visitors by country for the world map
  app.get("/api/websites/:id/analytics/countries", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const countries = await storage.getCountryBreakdown(req.params.id, startDate, endDate);
      res.json({ countries });
    } catch (error: any) {
      console.error("Analytics countries error:", error);
      res.status(500).json({ message: "Kunne ikke hente lande-statistik" });
    }
  });

  // Analytics - Visitors by device class (desktop / mobile / tablet).
  // deviceType has been captured on every event since launch; this is
  // the first place it is surfaced.
  app.get("/api/websites/:id/analytics/devices", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 365);
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const devices = await storage.getDeviceBreakdown(req.params.id, startDate, endDate);
      res.json({ devices });
    } catch (error: any) {
      console.error("Analytics devices error:", error);
      res.status(500).json({ message: "Kunne ikke hente enheds-statistik" });
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Economics tab — revenue from bookings + orders, session invoices
  // ──────────────────────────────────────────────────────────────────────────

  // parseBookingPriceCents is imported from server/parseBookingPrice.ts for testability.

  app.get("/api/websites/:id/economics", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const websiteId = req.params.id;
      const website = getWebsiteAccess(req).website;
      const currency = (website as any).currency || "DKK";

      const now = new Date();
      // Overdue = sent invoice whose due_date is at least 7 days in the past.
      const sevenDaysAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const currentYear   = now.getFullYear();
      const year = Math.max(2020, Math.min(currentYear + 1,
        parseInt(req.query.year as string) || currentYear));
      const yearStart = new Date(year, 0, 1);
      const yearEnd   = new Date(year + 1, 0, 1);
      // KPI cards always reflect the actual current month, not the selected year's month.
      const monthStart = new Date(currentYear, now.getMonth(), 1);
      const monthEnd   = new Date(currentYear, now.getMonth() + 1, 1);

      // ── bookings + orders for the selected year (bar chart + session list) ──
      const [yearBookings, yearOrders] = await Promise.all([
        // Customer-site bookings only (excludes platform_onboarding meetings)
        db.select().from(bookingsTable).where(
          andOp(
            eq(bookingsTable.websiteId, websiteId),
            eq(bookingsTable.context, "customer_site"),
            gteOp(bookingsTable.date, yearStart),
            ltOp(bookingsTable.date, yearEnd),
          )
        ),
        db.select().from(ordersTable).where(
          andOp(
            eq(ordersTable.websiteId, websiteId),
            gteOp(ordersTable.createdAt, yearStart),
            ltOp(ordersTable.createdAt, yearEnd),
          )
        ),
      ]);

      // ── current-month data for KPI cards ──────────────────────────────────
      // When year === currentYear, yearBookings/yearOrders already span the current
      // month; reuse them. For a past year, fetch the current month separately so
      // the KPI cards always reflect today's month rather than reporting zero.
      let cmBookings: Array<typeof bookingsTable.$inferSelect>;
      let cmOrders:   Array<typeof ordersTable.$inferSelect>;
      if (year === currentYear) {
        cmBookings = yearBookings;
        cmOrders   = yearOrders;
      } else {
        [cmBookings, cmOrders] = await Promise.all([
          db.select().from(bookingsTable).where(
            andOp(
              eq(bookingsTable.websiteId, websiteId),
              eq(bookingsTable.context, "customer_site"),
              gteOp(bookingsTable.date, monthStart),
              ltOp(bookingsTable.date, monthEnd),
            )
          ),
          db.select().from(ordersTable).where(
            andOp(
              eq(ordersTable.websiteId, websiteId),
              gteOp(ordersTable.createdAt, monthStart),
              ltOp(ordersTable.createdAt, monthEnd),
            )
          ),
        ]);
      }

      // ── invoices — all for this site (for booking→invoice map + overdue) ──
      // Gracefully degrade if the table hasn't been created yet on this DB.
      let allInvoices: Array<typeof invoicesTable.$inferSelect> = [];
      let overdueInvoices: Array<typeof invoicesTable.$inferSelect> = [];

      if (isInvoiceSchemaReady()) {
        [allInvoices, overdueInvoices] = await Promise.all([
          db.select().from(invoicesTable)
            .where(eq(invoicesTable.websiteId, websiteId)),
          // Overdue = status='sent' AND due_date ≤ 7 days ago
          db.select().from(invoicesTable).where(
            andOp(
              eq(invoicesTable.websiteId, websiteId),
              eq(invoicesTable.status, "sent"),
              ltOp(invoicesTable.dueDate, sevenDaysAgo),
            )
          ),
        ]);
      } else {
        // Schema init in progress; try anyway and silently swallow table-not-found.
        try {
          [allInvoices, overdueInvoices] = await Promise.all([
            db.select().from(invoicesTable)
              .where(eq(invoicesTable.websiteId, websiteId)),
            db.select().from(invoicesTable).where(
              andOp(
                eq(invoicesTable.websiteId, websiteId),
                eq(invoicesTable.status, "sent"),
                ltOp(invoicesTable.dueDate, sevenDaysAgo),
              )
            ),
          ]);
        } catch {
          // Table not yet created; degrade to empty — no invoice data yet.
        }
      }

      // booking_id → invoice lookup map
      const invoiceByBookingId = new Map(
        allInvoices
          .filter(inv => inv.bookingId)
          .map(inv => [inv.bookingId!, inv])
      );

      // ── monthly aggregates — completed sessions only ───────────────────────
      const monthly = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: new Intl.DateTimeFormat("da-DK", { month: "short" })
          .format(new Date(year, i, 1)),
        bookingRevenueCents: 0,
        orderRevenueCents: 0,
        totalCents: 0,
      }));

      for (const b of yearBookings) {
        if (b.status !== "completed") continue;  // only count completed sessions
        const cents = parseBookingPriceCents(b.price);
        if (!cents) continue;
        const m = new Date(b.date).getMonth();
        monthly[m].bookingRevenueCents += cents;
        monthly[m].totalCents += cents;
      }

      for (const o of yearOrders) {
        if (o.status === "cancelled" || o.paymentStatus === "refunded") continue;
        const m = new Date(o.createdAt).getMonth();
        monthly[m].orderRevenueCents += o.totalAmountCents;
        monthly[m].totalCents += o.totalAmountCents;
      }

      // ── this-month summary (always the actual current month) ───────────────
      const thisMonthBookings = cmBookings.filter(b => {
        const d = new Date(b.date);
        return d >= monthStart && d < monthEnd && b.status === "completed";
      });
      const thisMonthOrders = cmOrders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= monthStart && d < monthEnd
          && o.status !== "cancelled" && o.paymentStatus !== "refunded";
      });

      const thisMonthBookingCents = thisMonthBookings
        .reduce((s, b) => s + parseBookingPriceCents(b.price), 0);
      const thisMonthOrderCents = thisMonthOrders
        .reduce((s, o) => s + o.totalAmountCents, 0);
      const thisMonthPaidOrderCents = thisMonthOrders
        .filter(o => o.paymentStatus === "paid")
        .reduce((s, o) => s + o.totalAmountCents, 0);
      // Paid invoices this month — money actually received from session invoices.
      // These are NOT double-counted with bookingRevenueCents (which reflects billing
      // amounts from booking.price, not invoice payment receipts).
      const thisMonthPaidInvoiceCents = allInvoices
        .filter(inv => {
          if (inv.status !== "paid" || !inv.paidAt) return false;
          const d = new Date(inv.paidAt);
          return d >= monthStart && d < monthEnd;
        })
        .reduce((s, inv) => s + inv.amountCents, 0);
      // Outstanding = ALL sent (unpaid) invoices for this site, regardless of age.
      // The 7-day age cutoff applies only to the overdue-list shown for reminders.
      const outstandingInvoicesCents = allInvoices
        .filter(inv => inv.status === "sent")
        .reduce((s, inv) => s + inv.amountCents, 0);
      // Keep overdueInvoicesCents for the overdue-list section total.
      const overdueInvoicesCents = overdueInvoices
        .reduce((s, inv) => s + inv.amountCents, 0);

      // ── per-session list: completed bookings with price + invoice status ────
      // Show all completed sessions — including those without a price so practitioners
      // can see which sessions still need an invoice or have no price set.
      const recentBookings = [...yearBookings]
        .filter(b => b.status === "completed")
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 25)
        .map(b => {
          const inv = invoiceByBookingId.get(b.id);
          return {
            id: b.id,
            date: b.date,
            customerName: b.customerName,
            customerEmail: b.customerEmail,
            service: b.service,
            status: b.status,
            price: b.price,
            currency: b.currency || currency,
            priceCents: parseBookingPriceCents(b.price),
            // null when no invoice has been issued for this session yet
            invoiceId:      inv?.id         ?? null,
            invoiceStatus:  inv?.status     ?? null,
            invoiceDueDate: inv?.dueDate    ?? null,
          };
        });

      // ── overdue invoices (status=sent, due_date ≥ 7 days ago) ─────────────
      const overdueList = [...overdueInvoices]
        .sort((a, b) =>
          new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime()
        )
        .slice(0, 20)
        .map(inv => ({
          id:            inv.id,
          bookingId:     inv.bookingId,
          customerName:  inv.customerName,
          customerEmail: inv.customerEmail,
          amountCents:   inv.amountCents,
          currency:      inv.currency || currency,
          dueDate:       inv.dueDate,
          sentAt:        inv.sentAt,
          reminderSentAt: inv.reminderSentAt,
          description:   inv.description,
        }));

      res.json({
        currency,
        year,
        monthly,
        thisMonth: {
          totalCents:              thisMonthBookingCents + thisMonthOrderCents,
          bookingRevenueCents:     thisMonthBookingCents,
          orderRevenueCents:       thisMonthOrderCents,
          paidOrdersCents:         thisMonthPaidOrderCents,
          paidInvoicesCents:       thisMonthPaidInvoiceCents,
          // receivedCents = money actually collected: paid invoices + paid orders
          receivedCents:           thisMonthPaidInvoiceCents + thisMonthPaidOrderCents,
          outstandingInvoicesCents,
          overdueInvoicesCents,
          bookingsCount:           thisMonthBookings.length,
          completedBookingsCount:  thisMonthBookings.filter(b => b.status === "completed").length,
        },
        recentBookings,
        overdueInvoices: overdueList,
      });
    } catch (error: any) {
      console.error("Economics error:", error);
      res.status(500).json({ message: "Kunne ikke hente økonomidata" });
    }
  });

  // Send a payment reminder for an invoice that is at least 7 days overdue.
  // Eligibility: status='sent' AND due_date ≤ 7 days ago (matches GET query).
  // Returns 422 for ineligible invoices, 503 when Resend is unconfigured,
  // 502 when delivery fails. reminderSentAt is stamped only after confirmed delivery.
  app.post("/api/websites/:id/economics/remind-invoice/:invoiceId",
    requireAuth,
    requireWebsitePermission("updateManage"),
    auditManageMutation("invoice.remind", "invoice", "invoiceId"),
    async (req, res) => {
      const websiteId = req.params.id;
      const invoiceId = req.params.invoiceId;
      const website   = getWebsiteAccess(req).website;

      // 7-day overdue cutoff — matches the GET endpoint query.
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      /** Escape customer-supplied text before interpolating into email HTML. */
      function escapeHtml(str: string | null | undefined): string {
        if (!str) return "";
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#x27;");
      }

      // ── look up invoice ──────────────────────────────────────────────────
      let invoice: typeof invoicesTable.$inferSelect | undefined;
      try {
        [invoice] = await db.select().from(invoicesTable).where(
          andOp(
            eq(invoicesTable.websiteId, websiteId),
            eq(invoicesTable.id, invoiceId),
          )
        ).limit(1);
      } catch (dbErr: any) {
        console.error("Remind-invoice DB error:", dbErr);
        return res.status(503).json({ message: "Databasen er ikke klar endnu. Prøv igen om lidt." });
      }

      if (!invoice) {
        return res.status(404).json({ message: "Faktura ikke fundet" });
      }

      // ── eligibility: sent + at least 7 days past due_date ───────────────
      if (invoice.status !== "sent") {
        return res.status(422).json({
          message: invoice.status === "paid"
            ? "Fakturaen er allerede betalt"
            : "Fakturaen er ikke sendt endnu og kan ikke minde om betaling",
        });
      }
      if (!invoice.dueDate || new Date(invoice.dueDate) > sevenDaysAgo) {
        return res.status(422).json({
          message: "Fakturaen er ikke mindst 7 dage forfalden endnu",
        });
      }

      // ── send via the project's Resend integration (connector or env var) ──
      let resendClient: Awaited<ReturnType<typeof getUncachableResendClient>> | null = null;
      try {
        resendClient = await getUncachableResendClient();
      } catch {
        // getUncachableResendClient throws when neither connector nor env var is set
      }
      if (!resendClient) {
        return res.status(503).json({
          message: "E-mailafsendelse er ikke konfigureret på denne konto. Kontakt support.",
        });
      }

      const amountStr = new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: invoice.currency || "DKK",
        minimumFractionDigits: 0,
      }).format(invoice.amountCents / 100);

      const dueDateStr = invoice.dueDate
        ? new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric" })
            .format(new Date(invoice.dueDate))
        : "ukendt forfaldsdato";

      try {
        const { error: sendError } = await resendClient.client.emails.send({
          from: resendClient.fromEmail,
          to: invoice.customerEmail,
          subject: `Betalingspåmindelse – ${amountStr}`,
          // All customer-supplied values are HTML-escaped to prevent injection.
          html: `<p>Hej ${escapeHtml(invoice.customerName)},</p>
<p>Vi sender dig en venlig påmindelse om en ubetalt faktura på <strong>${amountStr}</strong>, der var forfalden den ${dueDateStr}.</p>
${invoice.description ? `<p><em>${escapeHtml(invoice.description)}</em></p>` : ""}
<p>Kontakt os, hvis du har spørgsmål, eller allerede har betalt.</p>
<p>Med venlig hilsen<br>${escapeHtml((website as any).name)}</p>`,
        });

        if (sendError) {
          console.error("Remind-invoice Resend error:", sendError);
          return res.status(502).json({
            message: "Påmindelsen kunne ikke sendes. Prøv igen senere.",
          });
        }
      } catch (sendErr: any) {
        console.error("Remind-invoice send exception:", sendErr);
        return res.status(502).json({
          message: "Påmindelsen kunne ikke sendes. Prøv igen senere.",
        });
      }

      // ── stamp only after confirmed delivery ───────────────────────────────
      const nowTs = new Date();
      await db.update(invoicesTable)
        .set({ reminderSentAt: nowTs, updatedAt: nowTs })
        .where(andOp(
          eq(invoicesTable.websiteId, websiteId),
          eq(invoicesTable.id, invoiceId),
        ));

      res.json({ ok: true, sentAt: nowTs.toISOString() });
    }
  );

  // Manage dashboard - aggregated overview numbers for the home section
  app.get("/api/websites/:id/manage/overview", requireAuth, requireWebsitePermission("readManage"), async (req, res) => {
    try {
      const overview = await storage.getManageOverview(req.params.id);
      res.json(overview);
    } catch (error: any) {
      console.error("Manage overview error:", error);
      res.status(500).json({ message: "Kunne ikke hente overblik" });
    }
  });

  // Billing - Submit contact/upgrade request
  app.post("/api/billing/contact", async (req, res) => {
    try {
      const { name, email, company, message, plan, userId } = req.body;

      if (!email || !plan) {
        return res.status(400).json({ message: "Email and plan are required" });
      }

      const lead = await storage.createBillingLead({
        userId: userId || 'anonymous',
        email,
        name: name || null,
        company: company || null,
        plan,
        message: message || null,
        status: 'pending',
      });

      res.json({ success: true, id: lead.id });
    } catch (error: any) {
      console.error("Billing contact error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email Settings - Get email settings for a website
  app.get("/api/websites/:id/email-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      let settings = await storage.getEmailSettings(req.params.id);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createEmailSettings({
          websiteId: req.params.id,
          orderConfirmationEnabled: true,
          bookingConfirmationEnabled: true,
          bookingUpdatedEnabled: true,
          bookingCancelledEnabled: true,
          shippingConfirmationEnabled: true,
          welcomeEmailEnabled: true,
          abandonedCartEnabled: true,
          newSubmissionEnabled: true,
          refundConfirmationEnabled: true,
        });
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Get email settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email Settings - Update email settings for a website
  app.patch("/api/websites/:id/email-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Get or create settings first
      let settings = await storage.getEmailSettings(req.params.id);
      if (!settings) {
        settings = await storage.createEmailSettings({
          websiteId: req.params.id,
          orderConfirmationEnabled: true,
          bookingConfirmationEnabled: true,
          bookingUpdatedEnabled: true,
          bookingCancelledEnabled: true,
          shippingConfirmationEnabled: true,
          welcomeEmailEnabled: true,
          abandonedCartEnabled: true,
          newSubmissionEnabled: true,
          refundConfirmationEnabled: true,
        });
      }

      const updatedSettings = await storage.updateEmailSettings(req.params.id, req.body);
      res.json(updatedSettings);
    } catch (error: any) {
      console.error("Update email settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email Templates - Get all templates for a website
  app.get("/api/websites/:id/email-templates", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Ensure default templates exist before fetching
      await storage.ensureEmailTemplatesConfigured(req.params.id);
      const templates = await storage.getEmailTemplates(req.params.id);
      res.json(templates);
    } catch (error: any) {
      console.error("Get email templates error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email Templates - Get a specific template
  app.get("/api/websites/:id/email-templates/:type", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Ensure default templates exist before fetching
      await storage.ensureEmailTemplatesConfigured(req.params.id);
      const template = await storage.getEmailTemplate(req.params.id, req.params.type);
      res.json(template || null);
    } catch (error: any) {
      console.error("Get email template error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email Templates - Create or update a template
  app.put("/api/websites/:id/email-templates/:type", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { subject, heading, bodyText, buttonText } = req.body;
      const existingTemplate = await storage.getEmailTemplate(req.params.id, req.params.type);

      if (existingTemplate) {
        const updated = await storage.updateEmailTemplate(existingTemplate.id, req.params.id, {
          subject,
          heading,
          bodyText,
          buttonText,
        });
        res.json(updated);
      } else {
        const created = await storage.createEmailTemplate({
          websiteId: req.params.id,
          templateType: req.params.type,
          subject,
          heading,
          bodyText,
          buttonText,
        });
        res.json(created);
      }
    } catch (error: any) {
      console.error("Update email template error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Legal Settings - Get legal settings for a website
  app.get("/api/websites/:id/legal-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      let settings = await storage.getLegalSettings(req.params.id);
      
      // Create default settings if they don't exist
      if (!settings) {
        settings = await storage.createLegalSettings({
          websiteId: req.params.id,
          websiteName: website.name,
          companyName: null,
          contactEmail: null,
          businessAddress: null,
        });
      }

      res.json(settings);
    } catch (error: any) {
      console.error("Get legal settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Legal Settings - Update legal settings for a website
  app.patch("/api/websites/:id/legal-settings", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Get or create settings first
      let settings = await storage.getLegalSettings(req.params.id);
      if (!settings) {
        settings = await storage.createLegalSettings({
          websiteId: req.params.id,
          websiteName: website.name,
          companyName: null,
          contactEmail: null,
          businessAddress: null,
        });
      }

      const { websiteName, companyName, contactEmail, businessAddress, termsCustomContent, privacyCustomContent } = req.body;
      const updatedSettings = await storage.updateLegalSettings(req.params.id, {
        websiteName,
        companyName,
        contactEmail,
        businessAddress,
        termsCustomContent,
        privacyCustomContent,
      });
      res.json(updatedSettings);
    } catch (error: any) {
      console.error("Update legal settings error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin middleware - requires both auth and admin role
  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const isAdmin = await storage.isUserAdmin(userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // ============ END OF ONBOARDING: PREVIEW, APPROVE, PAY ============
  //
  // Preview, brand guide, brand-guide PDF, pricing, approval, card checkout,
  // invoice billing and the admin review handover. Kept in its own module
  // (server/onboardingDecisionRoutes.ts) rather than inlined here.
  registerOnboardingDecisionRoutes(app, { requireAuth, requireAdmin });

  // ============ BUILDER ASSISTANT: PLAN MODE AND BUILD MODE ============
  //
  // Plan mode reads the site and proposes a numbered checklist the customer
  // edits and approves; Build mode executes the approved plan step by step.
  // In its own module (server/assistantPlanRoutes.ts).
  registerAssistantPlanRoutes(app, { requireAuth });

  // ============ BIRDFLOW PLATFORM CALENDAR ============
  //
  // BirdFlow's own bookable calendar for the free 30-minute improvement
  // meeting. It reuses the whole booking engine (availability rules, slot
  // generation, open slots, atomic claim, conflict checks, confirmation
  // emails) against a websites row with kind = 'platform' - see
  // server/platformCalendar.ts.
  //
  // Two audiences, two levels of access:
  //   * signed-in customers may LIST free slots and CLAIM one (below);
  //   * everything that reads or changes the calendar itself goes through
  //     requireAdmin here, or through requireWebsitePermission on the normal
  //     /api/websites/:id/... manage routes, which only ever resolves a
  //     platform website for a verified administrator.

  /** Copenhagen wall-clock "now", as the calendar's own timezone sees it. */
  function copenhagenNow(): { date: string; minutes: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: PLATFORM_CALENDAR_TIMEZONE,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00';
    // ICU can report hour "24" at local midnight for some locales/versions.
    const hour = get('hour') === '24' ? 0 : Number(get('hour'));
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      minutes: hour * 60 + Number(get('minute')),
    };
  }

  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // How far ahead customers may book, and how much notice BirdFlow needs.
  const PLATFORM_SLOTS_HORIZON_DAYS = 28;
  const PLATFORM_BOOKING_LEAD_MINUTES = 60;

  /** The signed-in user's own upcoming meeting, if they already have one. */
  async function findUpcomingPlatformMeeting(platformWebsiteId: string, userId: string) {
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(
        andOp(
          eqOp(bookingsTable.websiteId, platformWebsiteId),
          eqOp(bookingsTable.context, 'platform_onboarding'),
          eqOp(bookingsTable.customerUserId, userId),
          neOp(bookingsTable.status, 'cancelled'),
          gteOp(bookingsTable.date, new Date(Date.now() - 24 * 3600 * 1000))
        )
      )
      .orderBy(bookingsTable.date)
      .limit(1);
    return rows[0];
  }

  // What the meeting is, and whether this customer already has one booked.
  app.get("/api/platform-calendar", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const { website, service } = await getPlatformCalendar();
      const existing = await findUpcomingPlatformMeeting(website.id, user.id);

      res.json({
        service: {
          id: service.id,
          name: service.name,
          description: service.description,
          durationMinutes: service.durationMinutes,
        },
        timezone: PLATFORM_CALENDAR_TIMEZONE,
        myMeeting: existing ?? null,
      });
    } catch (error: any) {
      console.error("[PlatformCalendar] meeting lookup failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Free 30-minute slots for the coming weeks, in Europe/Copenhagen.
  app.get("/api/platform-calendar/slots", requireAuth, async (req, res) => {
    try {
      const { website, service } = await getPlatformCalendar();

      const requestedDays = parseInt(String(req.query.days ?? ''), 10);
      const days = Number.isFinite(requestedDays)
        ? Math.min(Math.max(requestedDays, 1), PLATFORM_SLOTS_HORIZON_DAYS)
        : PLATFORM_SLOTS_HORIZON_DAYS;

      const { date: today, minutes: nowMinutes } = copenhagenNow();
      const earliestToday = nowMinutes + PLATFORM_BOOKING_LEAD_MINUTES;

      const dates = Array.from({ length: days }, (_, i) => addDays(today, i));

      const days_ = await Promise.all(
        dates.map(async (date) => {
          const [blocked, inRange] = await Promise.all([
            storage.isDateBlocked(service.id, date),
            storage.isDateInActiveRange(service.id, date),
          ]);
          if (blocked || !inRange) return { date, slots: [] };

          const slots = await storage.getAvailableSlotsForDate(service.id, website.id, date);
          return {
            date,
            slots: slots
              .filter(slot => slot.available)
              .filter(slot => {
                if (date !== today) return true;
                const [h, m] = slot.time.split(':').map(Number);
                return h * 60 + m >= earliestToday;
              })
              .map(slot => ({ time: slot.time, openSlotId: slot.openSlotId })),
          };
        })
      );

      res.json({
        timezone: PLATFORM_CALENDAR_TIMEZONE,
        durationMinutes: service.durationMinutes,
        days: days_.filter(day => day.slots.length > 0),
      });
    } catch (error: any) {
      console.error("[PlatformCalendar] slot lookup failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Claim a slot. Same conflict checking and atomic open-slot claim the
  // public booking route uses, so two customers clicking at the same moment
  // cannot both take the same time.
  app.post("/api/platform-calendar/bookings", requireAuth, async (req, res) => {
    try {
      const user = getAuthedUser(req);
      const { website, service } = await getPlatformCalendar();
      const { date, time, openSlotId, websiteId, notes, customerPhone } = req.body || {};

      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Ugyldig dato. Brug formatet ÅÅÅÅ-MM-DD" });
      }
      if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ message: "Ugyldigt tidspunkt. Brug formatet TT:MM" });
      }

      // Not in the past, and not inside the notice window.
      const nowCph = copenhagenNow();
      const [hh, mm] = time.split(':').map(Number);
      if (date < nowCph.date || (date === nowCph.date && hh * 60 + mm < nowCph.minutes + PLATFORM_BOOKING_LEAD_MINUTES)) {
        return res.status(400).json({ message: "Vælg venligst et tidspunkt længere ude i fremtiden" });
      }

      const existing = await findUpcomingPlatformMeeting(website.id, user.id);
      if (existing) {
        return res.status(409).json({
          message: "Du har allerede et møde booket. Flyt eller aflys det først.",
          code: "MEETING_ALREADY_BOOKED",
          booking: existing,
        });
      }

      const profile = await storage.getProfile(user.id);
      const customerEmail = profile?.email || user.email;
      if (!customerEmail) {
        return res.status(400).json({ message: "Din konto mangler en e-mailadresse" });
      }
      const customerName = profile?.fullName?.trim() || customerEmail.split('@')[0];

      // The meeting is about one of the customer's own websites - verify the
      // claim rather than trusting the body.
      let customerWebsiteId: string | null = null;
      let customerWebsiteName: string | null = null;
      if (typeof websiteId === 'string' && websiteId) {
        const customerWebsite = await storage.getWebsite(websiteId);
        if (!customerWebsite || customerWebsite.ownerId !== user.id) {
          return res.status(403).json({ message: "Ukendt hjemmeside" });
        }
        customerWebsiteId = customerWebsite.id;
        customerWebsiteName = customerWebsite.name;
      }

      const onboardingSession = await storage.getOnboardingSession(user.id);

      let booking;
      if (typeof openSlotId === 'string' && openSlotId) {
        // Owner-placed slot: claim atomically first, then build from it.
        const claimed = await storage.claimOpenSlot(openSlotId, website.id);
        if (!claimed) {
          return res.status(409).json({
            message: "Tidspunktet er desværre lige blevet taget. Vælg venligst et andet.",
            code: "SLOT_UNAVAILABLE",
          });
        }
        try {
          booking = await storage.createBooking({
            websiteId: website.id,
            context: 'platform_onboarding',
            customerUserId: user.id,
            customerWebsiteId,
            onboardingSessionId: onboardingSession?.id ? String(onboardingSession.id) : null,
            customerName,
            customerEmail,
            customerPhone: typeof customerPhone === 'string' ? customerPhone : (profile?.phoneNumber || null),
            service: service.name,
            serviceId: service.id,
            date: new Date(claimed.date + 'T00:00:00'),
            time: claimed.time,
            durationMinutes: claimed.durationMinutes || service.durationMinutes,
            status: 'confirmed',
            notes: typeof notes === 'string' && notes ? notes : null,
          });
          await storage.linkOpenSlotBooking(claimed.id, booking.id);
        } catch (createErr) {
          await storage.releaseOpenSlot(claimed.id).catch(() => {});
          throw createErr;
        }
      } else {
        const isAvailable = await storage.checkSlotAvailable(service.id, website.id, date, time);
        if (!isAvailable) {
          return res.status(409).json({
            message: "Tidspunktet er desværre ikke længere ledigt. Vælg venligst et andet.",
            code: "SLOT_UNAVAILABLE",
          });
        }
        const overlap = await storage.findServiceConflict(
          website.id, service.id, date, time, service.durationMinutes
        );
        if (overlap) {
          return res.status(409).json({
            message: "Tidspunktet er desværre ikke længere ledigt. Vælg venligst et andet.",
            code: "SLOT_UNAVAILABLE",
          });
        }

        booking = await storage.createBooking({
          websiteId: website.id,
          context: 'platform_onboarding',
          customerUserId: user.id,
          customerWebsiteId,
          onboardingSessionId: onboardingSession?.id ? String(onboardingSession.id) : null,
          customerName,
          customerEmail,
          customerPhone: typeof customerPhone === 'string' ? customerPhone : (profile?.phoneNumber || null),
          service: service.name,
          serviceId: service.id,
          date: new Date(date + 'T00:00:00'),
          time,
          durationMinutes: service.durationMinutes,
          status: 'confirmed',
          notes: typeof notes === 'string' && notes ? notes : null,
        });

        // Two requests can both clear the pre-checks; the later insert loses.
        const race = await storage.findPlacementConflict(website.id, booking.id);
        if (race) {
          await storage.deleteBooking(booking.id, website.id);
          return res.status(409).json({
            message: "Tidspunktet er desværre lige blevet taget. Vælg venligst et andet.",
            code: "SLOT_UNAVAILABLE",
          });
        }
      }

      // An improvement meeting booked from the onboarding decision screen
      // moves that flow to "meeting booked". Payment is deliberately left
      // untouched: this path creates no Stripe object at all.
      if (customerWebsiteId && onboardingSession?.websiteId === customerWebsiteId) {
        try {
          await updateDecisionByUser(user.id, {
            decisionState: "meeting_booked",
            meetingBookingId: booking.id,
            decidedAt: new Date(),
          });
        } catch (stateErr) {
          console.error(`[PlatformCalendar] onboarding state update failed for ${booking.id}:`, stateErr);
        }
      }

      // Confirmation with calendar invite to the customer, notification to
      // BirdFlow. Neither may turn a booked meeting into an error.
      try {
        await emailService.sendBookingConfirmation(booking, customerEmail, service.name);
      } catch (emailErr) {
        console.error(`[PlatformCalendar] confirmation email failed for booking ${booking.id}:`, emailErr);
      }
      try {
        const adminEmails = await storage.getAdminNotificationEmails();
        const adminUrl = `${resolveAppOrigin(req.headers.host)}/admin`;
        for (const adminEmail of adminEmails) {
          await emailService.sendPlatformMeetingNotification(booking, adminEmail, service.name, {
            customerWebsiteName,
            adminUrl,
          });
        }
      } catch (notifyErr) {
        console.error(`[PlatformCalendar] admin notification failed for booking ${booking.id}:`, notifyErr);
      }

      res.status(201).json({
        booking,
        timezone: PLATFORM_CALENDAR_TIMEZONE,
        service: { id: service.id, name: service.name, durationMinutes: service.durationMinutes },
      });
    } catch (error: any) {
      console.error("[PlatformCalendar] booking failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // --- Admin side of the calendar (the "Bookinger" tab) ---

  // Everything the tab needs to render: which website row is the calendar,
  // the meeting service, the weekly hours and who each meeting is with.
  app.get("/api/admin/platform-calendar", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { website, service } = await getPlatformCalendar();
      const [availability, meetings] = await Promise.all([
        storage.getServiceAvailability(service.id),
        storage.getPlatformMeetingLinks(website.id),
      ]);
      res.json({ website, service, availability, meetings, timezone: PLATFORM_CALENDAR_TIMEZONE });
    } catch (error: any) {
      console.error("[PlatformCalendar] admin load failed:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // BirdFlow's available meeting times, through the existing availability
  // functions - admin only, never reachable from a customer's manage view.
  app.post("/api/admin/platform-calendar/availability", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { website, service } = await getPlatformCalendar();
      const { dayOfWeek, specificDate, startTime, endTime, slotDurationMinutes, isActive } = req.body || {};

      if (typeof startTime !== 'string' || typeof endTime !== 'string') {
        return res.status(400).json({ message: "Start- og sluttidspunkt er påkrævet" });
      }
      if (dayOfWeek === undefined && !specificDate) {
        return res.status(400).json({ message: "Ugedag eller dato er påkrævet" });
      }

      const availability = await storage.createServiceAvailability({
        serviceId: service.id,
        websiteId: website.id,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        specificDate: specificDate || null,
        startTime,
        endTime,
        slotDurationMinutes: slotDurationMinutes || service.durationMinutes,
        isActive: isActive !== undefined ? isActive : true,
      });
      res.status(201).json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/platform-calendar/availability/:availabilityId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { service } = await getPlatformCalendar();
      const rules = await storage.getServiceAvailability(service.id);
      if (!rules.some(rule => rule.id === req.params.availabilityId)) {
        return res.status(404).json({ message: "Reglen findes ikke" });
      }

      const { dayOfWeek, specificDate, startTime, endTime, slotDurationMinutes, isActive } = req.body || {};
      const availability = await storage.updateServiceAvailability(req.params.availabilityId, {
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : undefined,
        specificDate: specificDate !== undefined ? specificDate : undefined,
        startTime,
        endTime,
        slotDurationMinutes: slotDurationMinutes !== undefined ? slotDurationMinutes : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
      });
      if (!availability) {
        return res.status(404).json({ message: "Reglen findes ikke" });
      }
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/platform-calendar/availability/:availabilityId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { service } = await getPlatformCalendar();
      const rules = await storage.getServiceAvailability(service.id);
      if (!rules.some(rule => rule.id === req.params.availabilityId)) {
        return res.status(404).json({ message: "Reglen findes ikke" });
      }
      await storage.deleteServiceAvailability(req.params.availabilityId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin Dashboard Routes
  app.get("/api/admin/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getAdminOverviewStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Admin overview error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/growth", requireAuth, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAdminGrowthData(days);
      res.json(data);
    } catch (error: any) {
      console.error("Admin growth error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/funnel", requireAuth, requireAdmin, async (req, res) => {
    try {
      const funnel = await storage.getAdminFunnel();
      res.json(funnel);
    } catch (error: any) {
      console.error("Admin funnel error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsersWithStats();
      res.json(users);
    } catch (error: any) {
      console.error("Admin users error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/websites", requireAuth, requireAdmin, async (req, res) => {
    try {
      const websites = await storage.getAllWebsitesWithOwners();
      res.json(websites);
    } catch (error: any) {
      console.error("Admin websites error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin audit log - append-only record of administrator actions on
  // client resources. Read-only endpoint; there is no update or delete.
  app.get("/api/admin/audit-log", requireAuth, requireAdmin, async (req, res) => {
    try {
      // parseInt("abc") is NaN, which survives ?? and Math.min/max and would
      // reach the SQL layer as .limit(NaN). Fall back to the default instead.
      const numericParam = (value: unknown): number | undefined => {
        if (typeof value !== "string") return undefined;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      const entries = await storage.getAdminAuditEntries({
        websiteId: typeof req.query.websiteId === "string" ? req.query.websiteId : undefined,
        actorAdminUserId: typeof req.query.actorAdminUserId === "string" ? req.query.actorAdminUserId : undefined,
        adminSessionId: typeof req.query.adminSessionId === "string" ? req.query.adminSessionId : undefined,
        limit: numericParam(req.query.limit),
        offset: numericParam(req.query.offset),
      });
      res.json(entries);
    } catch (error: any) {
      console.error("Admin audit log error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin billing - user subscriptions
  app.get("/api/admin/billing/subscriptions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const subscriptions = await storage.getAllUsersWithSubscriptions();
      res.json(subscriptions);
    } catch (error: any) {
      console.error("Admin billing subscriptions error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin analytics - platform-wide visitor and traffic analytics
  app.get("/api/admin/analytics/overview", requireAuth, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const overview = await storage.getAdminAnalyticsOverview(startDate, endDate);
      res.json(overview);
    } catch (error: any) {
      console.error("Admin analytics overview error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/analytics/traffic", requireAuth, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const trafficSources = await storage.getAdminTrafficSources(startDate, endDate);
      res.json(trafficSources);
    } catch (error: any) {
      console.error("Admin traffic sources error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/analytics/visitors", requireAuth, requireAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      const dailyVisitors = await storage.getAdminDailyVisitors(startDate, endDate);
      res.json(dailyVisitors);
    } catch (error: any) {
      console.error("Admin daily visitors error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // NOTE: the former admin impersonation stub route was removed.
  // Administrators edit client websites through the website access
  // service (server/websiteAccess.ts) with audit logging - never by
  // impersonating the client's session.

  // Check if current user is admin
  app.get("/api/admin/check", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const isAdmin = await storage.isUserAdmin(userId);
      res.json({ isAdmin });
    } catch (error: any) {
      console.error("Admin check error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============ SUPPORT TICKET ROUTES ============

  // Create a new support ticket (authenticated users)
  app.post("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { type, message } = req.body;

      if (!type || !message) {
        return res.status(400).json({ message: "Type and message are required" });
      }

      const validTypes = ['bug', 'problem', 'improvement'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({ message: "Invalid ticket type" });
      }

      const profile = await storage.getProfile(user.id);
      const ticket = await storage.createSupportTicket({
        userId: user.id,
        email: profile?.email || user.email || '',
        type,
        message,
        status: 'open',
      });

      res.status(201).json(ticket);
    } catch (error: any) {
      console.error("Create support ticket error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's own support tickets
  app.get("/api/support/tickets", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const tickets = await storage.getUserTickets(user.id);
      res.json(tickets);
    } catch (error: any) {
      console.error("Get user tickets error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all support tickets
  app.get("/api/admin/support/tickets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getSupportTickets();
      res.json(tickets);
    } catch (error: any) {
      console.error("Admin get tickets error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update ticket status
  app.patch("/api/admin/support/tickets/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['open', 'in_progress', 'closed'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const ticket = await storage.updateTicketStatus(id, status);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error: any) {
      console.error("Admin update ticket error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============ SUBSCRIPTION BILLING ROUTES ============

  // Get available subscription plans
  app.get("/api/subscriptions/plans", async (_req, res) => {
    try {
      const plans = Object.entries(PLAN_DETAILS)
        .filter(([id]) => id !== 'free')
        .map(([id, details]) => ({
          id,
          name: details.name,
          description: details.description,
          priceMonthly: details.priceMonthly,
          priceDisplay: details.priceDisplay,
          trialDays: details.trialDays,
          popular: details.popular,
          features: details.features,
          featureList: details.featureList,
        }));
      res.json(plans);
    } catch (error: any) {
      console.error("Get plans error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user subscription status (platform-level)
  app.get("/api/subscriptions/current", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const subscriptionStatus = await getUserSubscriptionStatus(userId);
      res.json(subscriptionStatus);
    } catch (error: any) {
      console.error("Get user subscription error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Check plan limits for various resources
  app.get("/api/subscriptions/limits", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { websiteId } = req.query;
      
      const websiteLimitCheck = await checkWebsiteLimit(userId);
      const planFeatures = await getUserPlanFeatures(userId);
      
      let pageLimitCheck = null;
      if (websiteId && typeof websiteId === 'string') {
        const website = await storage.getWebsite(websiteId);
        if (website && website.ownerId === userId) {
          pageLimitCheck = await checkPageLimit(userId, websiteId);
        }
      }
      
      res.json({
        websites: {
          canCreate: websiteLimitCheck.allowed,
          current: websiteLimitCheck.currentCount,
          limit: websiteLimitCheck.limit,
          reason: websiteLimitCheck.reason
        },
        pages: pageLimitCheck ? {
          canCreate: pageLimitCheck.allowed,
          current: pageLimitCheck.currentCount,
          limit: pageLimitCheck.limit,
          reason: pageLimitCheck.reason
        } : null,
        features: {
          hasBooking: planFeatures.bookingSystem,
          hasWebshop: planFeatures.ecommerce,
          hasCustomDomain: planFeatures.customDomain,
          hasAnalytics: planFeatures.analytics,
          hasAdvancedAnalytics: planFeatures.advancedAnalytics,
          hasPrioritySupport: planFeatures.prioritySupport,
          storageGB: planFeatures.storageGB,
          maxWebsites: planFeatures.maxWebsites,
          maxPages: planFeatures.maxPagesPerWebsite
        },
        planSlug: planFeatures.planSlug,
        isActive: planFeatures.isActive
      });
    } catch (error: any) {
      console.error("Get plan limits error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create checkout session for user subscription
  app.post("/api/subscriptions/user-checkout", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { planId: rawPlanId } = req.body;
      
      if (!rawPlanId) {
        return res.status(400).json({ message: "Missing plan selection" });
      }
      
      const planId = rawPlanId.toLowerCase() as PlanId;
      
      if (!PLAN_DETAILS[planId]) {
        return res.status(400).json({ message: "Invalid plan selected" });
      }
      
      if (planId === 'free') {
        return res.status(400).json({ message: "Cannot checkout for free plan" });
      }
      
      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const origin = req.headers.origin || 'https://birdflow.dk';
      
      const result = await createUserSubscriptionCheckoutSession(
        userId,
        profile.email,
        profile.fullName || profile.email,
        planId,
        `${origin}/dashboard?subscription=success`,
        `${origin}/pricing?subscription=cancelled`
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Create user checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current subscription status for a website
  app.get("/api/subscriptions/website/:websiteId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { websiteId } = req.params;
      
      const website = await storage.getWebsite(websiteId);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      if (website.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const planDetails = PLAN_DETAILS[website.plan as PlanId] || PLAN_DETAILS.free;
      
      res.json({
        plan: website.plan || 'free',
        planName: planDetails.name,
        planPrice: planDetails.priceDisplay,
        subscriptionStatus: website.subscriptionStatus || null,
        stripeSubscriptionId: website.stripeSubscriptionId,
        trialEnd: (website as any).trialEnd,
        currentPeriodEnd: website.currentPeriodEnd,
        features: planDetails.features,
        featureList: planDetails.featureList,
      });
    } catch (error: any) {
      console.error("Get subscription status error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create checkout session for subscription
  app.post("/api/subscriptions/checkout", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { websiteId, planId: rawPlanId, successUrl, cancelUrl } = req.body;
      
      if (!websiteId || !rawPlanId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const planId = rawPlanId.toLowerCase() as PlanId;
      
      if (!PLAN_DETAILS[planId]) {
        return res.status(400).json({ message: "Invalid plan selected" });
      }
      
      if (planId === 'free') {
        return res.status(400).json({ message: "Cannot checkout for free plan" });
      }
      
      const website = await storage.getWebsite(websiteId);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      
      if (website.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const result = await createSubscriptionCheckoutSession(
        userId,
        profile.email,
        profile.fullName || profile.email,
        websiteId,
        planId,
        successUrl || `${req.headers.origin}/dashboard?upgrade=success`,
        cancelUrl || `${req.headers.origin}/pricing?upgrade=cancelled`
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Create checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Verify onboarding checkout session and persist verification
  app.post("/api/subscriptions/verify-onboarding", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Missing session ID" });
      }
      
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Verify session belongs to this user
      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }
      
      // Verify session was completed (check payment_status for paid sessions, or that it's not open/expired)
      const isComplete = session.payment_status === 'paid' || 
                         session.payment_status === 'no_payment_required' ||
                         (session.status !== 'open' && session.status !== 'expired');
      
      if (!isComplete) {
        return res.status(400).json({ message: "Payment not completed" });
      }
      
      const planId = session.metadata?.planId as PlanId;
      const subscriptionId = session.subscription as string;
      
      // Store the verified subscription ID in the profile (persistent storage)
      if (subscriptionId) {
        await db.update(profiles)
          .set({ verifiedOnboardingSubscriptionId: subscriptionId })
          .where(eq(profiles.id, userId));
      }
      
      res.json({ 
        success: true, 
        planId,
        verified: true,
      });
    } catch (error: any) {
      console.error("Verify onboarding session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create checkout session for onboarding (no website yet)
  app.post("/api/subscriptions/onboarding-checkout", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const authUser = (req as any).user;
      const { planId: rawPlanId, successUrl, cancelUrl } = req.body;
      
      if (!rawPlanId) {
        return res.status(400).json({ message: "Missing plan selection" });
      }
      
      const planId = rawPlanId.toLowerCase() as PlanId;
      
      if (!PLAN_DETAILS[planId]) {
        return res.status(400).json({ message: "Invalid plan selected" });
      }
      
      if (planId === 'free') {
        return res.status(400).json({ message: "Cannot checkout for free plan" });
      }
      
      // Get or create profile using shared helper
      const { profile, error } = await getOrCreateProfile(userId, authUser);
      if (!profile) {
        return res.status(500).json({ 
          message: error || "Kunne ikke finde eller oprette brugerprofil. Prøv at logge ud og ind igen." 
        });
      }
      
      // Create or get Stripe customer
      let stripeCustomerId = profile.stripeCustomerId;
      const stripe = await getUncachableStripeClient();
      
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: profile.email,
          name: profile.fullName || profile.email,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await storage.updateProfile(userId, { stripeCustomerId });
      }
      
      const plan = PLAN_DETAILS[planId];
      if (!plan.stripePriceId) {
        return res.status(400).json({ message: "Plan pricing not configured" });
      }
      
      // Create checkout session with subscription_data for trial
      const origin = req.headers.origin || 'https://bird-flow.replit.app';
      const sessionParams: any = {
        customer: stripeCustomerId,
        mode: 'subscription',
        payment_method_collection: 'always',
        line_items: [{
          price: plan.stripePriceId,
          quantity: 1,
        }],
        success_url: successUrl || `${origin}/dashboard?subscription_success=true`,
        cancel_url: cancelUrl || `${origin}/onboarding?step=payment`,
        metadata: {
          userId,
          planId,
          type: 'onboarding',
        },
      };
      
      // Add trial if plan has trial days
      if (plan.trialDays > 0) {
        sessionParams.subscription_data = {
          trial_period_days: plan.trialDays,
        };
      }
      
      const session = await stripe.checkout.sessions.create(sessionParams);

      // NOTE deliberately no onboardingCompleted here. It used to be set
      // at this point — BEFORE the Stripe redirect — which permanently
      // marked users who abandoned checkout as onboarded, locking them
      // out of /onboarding forever. The flag is now set when the session
      // actually completes: in the checkout.session.completed webhook,
      // and belt-and-braces in verify-session after the success redirect.
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Create onboarding checkout session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Verify Stripe checkout session (used after successful payment redirect)
  app.post("/api/subscriptions/verify-session", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { sessionId } = req.body;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      const stripe = await getUncachableStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Verify the session belongs to this user and is complete
      if (session.metadata?.userId !== userId) {
        return res.status(403).json({ message: "Session does not belong to this user" });
      }
      
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      // Verified completion of an onboarding checkout finishes onboarding.
      // (The webhook does the same; this covers webhook lag on redirect.)
      if (session.metadata?.type === 'onboarding') {
        await db.update(profiles)
          .set({ onboardingCompleted: true })
          .where(eq(profiles.id, userId));
      }

      res.json({
        success: true,
        planId: session.metadata?.planId,
        subscriptionId: session.subscription
      });
    } catch (error: any) {
      console.error("Verify session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create billing portal session
  app.post("/api/subscriptions/billing-portal", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const { returnUrl } = req.body;
      
      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      if (!profile.stripeCustomerId) {
        return res.status(400).json({ 
          message: "Ingen faktureringskonto fundet. Opgrader venligst til et betalt abonnement først.",
          code: "NO_BILLING_ACCOUNT"
        });
      }
      
      const url = await createBillingPortalSession(
        profile.stripeCustomerId,
        returnUrl || `${req.headers.origin}/dashboard`
      );
      
      res.json({ url });
    } catch (error: any) {
      console.error("Create billing portal session error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Cancel user subscription
  app.post("/api/subscriptions/cancel", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      
      const profile = await storage.getProfile(userId);
      if (!profile) {
        return res.status(404).json({ message: "Profil ikke fundet" });
      }
      
      if (!profile.subscriptionId) {
        return res.status(400).json({ 
          message: "Intet aktivt abonnement fundet.",
          code: "NO_SUBSCRIPTION"
        });
      }
      
      const stripe = await getUncachableStripeClient();
      
      // Cancel at period end so user keeps access until the end of their billing period
      const subscription = await stripe.subscriptions.update(profile.subscriptionId, {
        cancel_at_period_end: true,
      });
      
      // Don't change subscriptionStatus - Stripe webhooks will handle that when it actually cancels
      // Just update a flag or leave it as-is since user still has access
      console.log(`[Subscription] User ${userId} set subscription ${profile.subscriptionId} to cancel at period end`);
      
      // Stripe's newer typings moved current_period_end off the Subscription
      // root; the runtime response on this account's API version still carries
      // it. Read defensively without changing behavior.
      const currentPeriodEnd = (subscription as unknown as { current_period_end?: number | null }).current_period_end;
      const periodEnd = currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null;
      
      res.json({ 
        success: true,
        message: "Dit abonnement er opsagt og vil udløbe ved slutningen af din nuværende periode.",
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: error.message || "Kunne ikke opsige abonnement" });
    }
  });

  // Get user invoices from Stripe
  app.get("/api/subscriptions/invoices", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const profile = await storage.getProfile(userId);
      
      if (!profile?.stripeCustomerId) {
        return res.json({ invoices: [] });
      }
      
      const stripe = await getUncachableStripeClient();
      const invoices = await stripe.invoices.list({
        customer: profile.stripeCustomerId,
        limit: 10,
      });
      
      const formattedInvoices = invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: inv.created,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        hostedInvoiceUrl: inv.hosted_invoice_url,
        invoicePdf: inv.invoice_pdf,
      }));
      
      res.json({ invoices: formattedInvoices });
    } catch (error: any) {
      console.error("Get invoices error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Stripe webhook for subscription events
  app.post("/api/subscriptions/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error("Stripe subscription webhook secret not configured");
      return res.status(500).json({ message: "Webhook not configured" });
    }
    
    let event: any;
    
    try {
      const stripe = await getUncachableStripeClient();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }
    
    try {
      const subscription = event.data.object;
      const isUserSubscription = subscription?.metadata?.type === 'user_subscription' || 
                                 subscription?.metadata?.type === 'onboarding';

      // End-of-onboarding payment state, deduplicated by event id.
      await handleOnboardingStripeEvent(event);

      // Everything below is the pre-existing subscription bookkeeping; it
      // also only makes sense once per delivered event.
      const firstDelivery = await shouldProcessStripeEvent(event);
      if (!firstDelivery) {
        console.log(`[Webhook] Duplicate delivery of ${event.id} ignored`);
        return res.json({ received: true, duplicate: true });
      }

      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
          if (isUserSubscription) {
            await handleUserSubscriptionCreated(event.data.object);
          } else {
            await handleSubscriptionCreated(event.data.object);
          }
          break;
        case 'customer.subscription.updated':
          if (isUserSubscription) {
            await handleUserSubscriptionUpdated(event.data.object);
          } else {
            await handleSubscriptionUpdated(event.data.object);
          }
          break;
        case 'customer.subscription.deleted':
          if (isUserSubscription) {
            await handleUserSubscriptionDeleted(event.data.object);
          } else {
            await handleSubscriptionDeleted(event.data.object);
          }
          break;
        case 'invoice.payment_failed':
          // Try user subscription first, then fall back to website
          await handleUserInvoicePaymentFailed(event.data.object);
          await handleInvoicePaymentFailed(event.data.object);
          break;
        case 'invoice.paid':
          // Handle successful invoice payments
          console.log(`[Webhook] Invoice paid: ${event.data.object.id}`);
          break;
        default:
          console.log(`Unhandled subscription event type: ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (error: any) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ── Account Component Library ────────────────────────────────────────────
  // Cross-site reusable component store. All routes require a logged-in user;
  // ownership is enforced per-method (ownerId = authenticated user's id).

  /** List all account-level components for the authenticated user. */
  app.get("/api/account/components", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const components = await storage.listAccountComponents(userId);
      res.json(components);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Create a new account-level component (customer-saved from builder). */
  app.post("/api/account/components", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const body = req.body ?? {};
      if (!body.name?.trim() || !body.tree) {
        return res.status(400).json({ message: "name og tree er påkrævet" });
      }
      const comp = await storage.createAccountComponent({
        ownerId: userId,
        name: body.name.trim(),
        description: body.description ?? null,
        category: body.category ?? null,
        tags: Array.isArray(body.tags) ? body.tags : null,
        tree: body.tree,
        schema: body.schema ?? null,
        designMetadata: body.designMetadata ?? null,
        origin: body.origin ?? "customer",
        createdFromWebsiteId: body.createdFromWebsiteId ?? null,
        version: 1,
      });
      res.status(201).json(comp);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Get a single account-level component (owner only). */
  app.get("/api/account/components/:componentId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const comp = await storage.getAccountComponent(req.params.componentId, userId);
      if (!comp) return res.status(404).json({ message: "Komponenten findes ikke" });
      res.json(comp);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Rename or update metadata of an account-level component. */
  app.patch("/api/account/components/:componentId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const body = req.body ?? {};
      const updated = await storage.updateAccountComponent(
        req.params.componentId,
        userId,
        {
          name: body.name ?? undefined,
          description: body.description ?? undefined,
          category: body.category ?? undefined,
          tags: body.tags ?? undefined,
          designMetadata: body.designMetadata ?? undefined,
        }
      );
      if (!updated) return res.status(404).json({ message: "Komponenten findes ikke" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Delete an account-level component (owner only). */
  app.delete("/api/account/components/:componentId", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const deleted = await storage.deleteAccountComponent(req.params.componentId, userId);
      if (!deleted) return res.status(404).json({ message: "Komponenten findes ikke" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Create a new version of an account-level component (update master). */
  app.post("/api/account/components/:componentId/new-version", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const body = req.body ?? {};
      if (!body.tree) return res.status(400).json({ message: "tree er påkrævet" });
      const updated = await storage.createNewAccountComponentVersion(
        req.params.componentId,
        userId,
        body.tree,
        body.schema ?? null
      );
      if (!updated) return res.status(404).json({ message: "Komponenten findes ikke" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /** Propagate the latest master version to all linked instances across all websites. */
  app.post("/api/account/components/:componentId/update-instances", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const result = await storage.updateAllLinkedInstances(req.params.componentId, userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /**
   * Adapt a component from the account library to a target website's brand.
   * Calls the AI to recolour / restyle the component tree without mutating the master.
   */
  app.post("/api/account/components/:componentId/adapt", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const { targetWebsiteId } = req.body ?? {};
      if (!targetWebsiteId) {
        return res.status(400).json({ message: "targetWebsiteId er påkrævet" });
      }

      const comp = await storage.getAccountComponent(req.params.componentId, userId);
      if (!comp) return res.status(404).json({ message: "Komponenten findes ikke" });

      // Verify ownership of the target website.
      const targetSite = await storage.getWebsite(targetWebsiteId);
      if (!targetSite || targetSite.ownerId !== userId) {
        return res.status(403).json({ message: "Ingen adgang til dette website" });
      }

      const targetBuilder = await storage.getBuilderState(targetWebsiteId);
      const targetBrand = (targetBuilder?.state as any)?.brandGuide ?? null;

      const adaptPrompt = [
        "You are a visual design adapter. You receive a component tree (JSON) and a target brand guide.",
        "Return ONLY the adapted component tree as valid JSON, with no explanation.",
        "Rules:",
        "1. Replace color hex values with the target brand's palette equivalents.",
        "2. Replace font families with the target brand's heading/body fonts.",
        "3. Keep the structure, layout and content identical.",
        "4. Do not add or remove nodes.",
        `Target brand guide: ${JSON.stringify(targetBrand ?? {})}`,
        `Component tree: ${JSON.stringify(comp.tree)}`,
      ].join("\n");

      let adaptedTree = comp.tree;
      try {
        const { meteredChat } = await import("./aiCall");
        const { createSpendMeter } = await import("./aiSpend");
        const adaptMeter = createSpendMeter("assistant");
        const result = await meteredChat(
          "assistant",
          { messages: [{ role: "user", content: adaptPrompt }], temperature: 0.3 },
          adaptMeter
        );
        const text = (result.choices[0]?.message?.content ?? "").trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          adaptedTree = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Fallback to the original tree if AI fails
      }

      res.json({
        adaptedTree,
        originalId: comp.id,
        name: comp.name,
        schema: comp.schema,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  /* ─── Contact form endpoint ─── */
  app.post("/api/contact", async (req, res) => {
    const { name, contact } = req.body || {};
    if (!name?.trim() || !contact?.trim()) {
      return res.status(400).json({ error: "Navn og kontaktinfo er påkrævet" });
    }
    const adminEmail = process.env.CONTACT_EMAIL || process.env.RESEND_FROM_EMAIL;
    if (adminEmail && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "BirdFlow <noreply@bird-flow.app>",
          to: adminEmail,
          subject: `Ny henvendelse fra ${name.trim()}`,
          html: `<p><strong>Navn:</strong> ${name.trim()}</p><p><strong>Kontakt:</strong> ${contact.trim()}</p>`,
        });
      } catch (e) {
        console.error("Contact email failed:", e);
      }
    }
    res.json({ ok: true });
  });

  return httpServer;
}
