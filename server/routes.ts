import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertProfileSchema, insertWebsiteSchema, insertWebsiteInputsSchema, type BuilderStateData, type BuilderComponent, sanitizeAnalyticsEventData, websites, builderState, profiles, publicStats, phasedBuildState, type Profile } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { createClient } from "@supabase/supabase-js";
import { publishWebsite } from "./publisher";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSecretKey } from "./stripeClient";
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
import { addCustomDomain, removeCustomDomain, verifyDomainConfig, getDomainConfig, checkDomainAvailability, purchaseDomain } from "./publisher/vercel";
import { processAIBuildRequest, processAIThinkingRequest, applyMutations, type CreativeMode } from "./aiBuilder";
import { BuilderMutationSchema } from "@shared/aiBuilderSchema";
import { emailService } from "./email/service";

// Helper to migrate legacy element-based state to component-based state
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
async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
  registerObjectStorageRoutes(app);
  
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
  app.post("/api/onboarding/create-website", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { name, slug, templateId, websiteType } = req.body;

      if (!name || !templateId) {
        return res.status(400).json({ message: "Name and template are required" });
      }

      // Check if user already completed onboarding (outside transaction for early exit)
      const profile = await storage.getProfile(user.id);
      if (profile?.onboardingCompleted) {
        return res.status(400).json({ message: "Onboarding already completed" });
      }
      
      // Note: We no longer require payment before website creation
      // Users can create their website first and pay in the final onboarding step

      // Generate unique slug
      const baseSlug = (slug || name).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'website';
      const timestamp = Date.now().toString(36);
      const uniqueSlug = `${baseSlug}-${timestamp}`;

      // Load template data before transaction
      const { getTemplateById, cloneTemplateState } = await import("@shared/websiteTemplates");
      const template = getTemplateById(templateId);
      const stateData = template ? cloneTemplateState(template) : null;

      // Execute all database operations atomically in a transaction
      const result = await db.transaction(async (tx) => {
        // 1. Create website
        const [website] = await tx.insert(websites).values({
          ownerId: user.id,
          name,
          slug: uniqueSlug,
          setupType: websiteType || "template",
          status: "draft",
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

      res.status(201).json({ 
        websiteId: result.id,
        slug: uniqueSlug,
        message: "Website created successfully" 
      });
    } catch (error: any) {
      console.error("Onboarding error:", error);
      res.status(500).json({ message: error.message });
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

      const validatedData = insertProfileSchema.partial().parse(req.body);
      const profile = await storage.updateProfile(req.params.id, validatedData);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json(profile);
    } catch (error: any) {
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

  // Get single website - user can only access their own
  app.get("/api/websites/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      // User can only access their own websites
      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(website);
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
  app.patch("/api/websites/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.updateWebsite(req.params.id, user.id, req.body);
      
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

  // Get builder state (creates default if none exists)
  app.get("/api/websites/:id/builder", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      let builderState = await storage.getBuilderState(req.params.id);
      
      // Create default builder state if none exists
      if (!builderState) {
        builderState = await storage.createBuilderState(req.params.id);
      }

      // Migrate legacy element-based state to component-based state
      const migratedState = migrateBuilderState(builderState.state);
      
      // If migration changed the state, persist it
      if (JSON.stringify(migratedState) !== JSON.stringify(builderState.state)) {
        builderState = await storage.updateBuilderState(req.params.id, migratedState);
      }

      res.json({
        ...builderState,
        state: migratedState
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update builder state
  app.patch("/api/websites/:id/builder", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { state } = req.body;
      
      if (!state) {
        return res.status(400).json({ message: "State is required" });
      }

      let builderState = await storage.getBuilderState(req.params.id);
      
      if (!builderState) {
        builderState = await storage.createBuilderState(req.params.id, state);
      } else {
        builderState = await storage.updateBuilderState(req.params.id, state);
      }

      res.json(builderState);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ MANAGEMENT ROUTES (Orders, Bookings, Submissions, Customers) ============

  // Get orders for a website
  app.get("/api/websites/:id/orders", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const orders = await storage.getOrders(req.params.id);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get bookings for a website
  app.get("/api/websites/:id/bookings", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const bookings = await storage.getBookings(req.params.id);
      res.json(bookings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get form submissions for a website
  app.get("/api/websites/:id/submissions", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const submissions = await storage.getFormSubmissions(req.params.id);
      res.json(submissions);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get customers for a website
  app.get("/api/websites/:id/customers", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const customers = await storage.getCustomers(req.params.id);
      res.json(customers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update order status
  app.patch("/api/websites/:id/orders/:orderId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const order = await storage.updateOrder(req.params.orderId, req.params.id, req.body);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update booking status
  app.patch("/api/websites/:id/bookings/:bookingId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get the original booking to check for status changes
      const originalBooking = await storage.getBooking(req.params.bookingId, req.params.id);

      const booking = await storage.updateBooking(req.params.bookingId, req.params.id, req.body);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Send email if status changed
      if (originalBooking && booking.customerEmail && req.body.status) {
        const websiteUrl = website.deploymentUrl || undefined;
        try {
          if (req.body.status === 'cancelled') {
            await emailService.sendBookingCancelled(
              booking,
              booking.customerEmail,
              booking.service
            );
            console.log(`Booking cancelled email sent to ${booking.customerEmail}`);
          } else if (originalBooking.status !== req.body.status) {
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
  app.get("/api/websites/:id/products", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const products = await storage.getProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a product
  app.post("/api/websites/:id/products", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.patch("/api/websites/:id/products/:productId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.delete("/api/websites/:id/products/:productId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.get("/api/websites/:id/products/:productId/reviews", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { productReviews } = await import("@shared/schema");
      const reviews = await db.select().from(productReviews)
        .where(eq(productReviews.productId, req.params.productId));
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new review
  app.post("/api/websites/:id/products/:productId/reviews", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.patch("/api/websites/:id/products/:productId/reviews/:reviewId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.delete("/api/websites/:id/products/:productId/reviews/:reviewId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
      
      // Default to USD if no items (shouldn't happen due to earlier check)
      if (!primaryCurrency) {
        primaryCurrency = 'USD';
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
        currency: primaryCurrency || 'USD',
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
      const stripeCurrency = (primaryCurrency || 'USD').toLowerCase();

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
        currency: primaryCurrency || 'USD',
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

      // Create line items from validated cart
      const lineItems = validatedItems.map(item => ({
        price_data: {
          currency: 'usd',
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
        currency: 'USD',
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
  app.post("/api/websites/:id/publish", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const builderState = await storage.getBuilderState(req.params.id);
      if (!builderState) {
        return res.status(400).json({ message: "No builder state found" });
      }

      const vercelToken = process.env.VERCEL_TOKEN;
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!vercelToken) {
        return res.status(400).json({ message: "Vercel token not configured. Please add VERCEL_TOKEN to secrets." });
      }

      if (!supabaseUrl || !supabaseAnonKey) {
        return res.status(400).json({ message: "Supabase not configured" });
      }

      // Fetch payment settings for this website (owner's own Stripe credentials)
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
          stripeWarning = 'Your Stripe account is connected with test mode keys. Switch to live keys in Payment Settings to accept real payments.';
        }
      } else {
        console.log('No Stripe payment settings configured for website', req.params.id);
        stripeWarning = 'Stripe is not configured. Product checkout will not work on your published site. Connect your Stripe account in Payment Settings to enable payments.';
      }

      // Determine the BirdFlow API URL from environment or request
      // Priority: BIRDFLOW_API_URL env var > REPLIT_DOMAINS > request host
      let birdflowApiUrl = process.env.BIRDFLOW_API_URL;
      if (!birdflowApiUrl) {
        const replitDomains = process.env.REPLIT_DOMAINS;
        if (replitDomains) {
          // REPLIT_DOMAINS is comma-separated, use the first one
          const primaryDomain = replitDomains.split(',')[0].trim();
          birdflowApiUrl = `https://${primaryDomain}`;
        }
      }
      if (!birdflowApiUrl) {
        // Fallback to request host (for local development)
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const host = req.headers['host'] || 'localhost:5000';
        birdflowApiUrl = `${proto}://${host}`;
      }
      console.log('[Publish] Using BirdFlow API URL:', birdflowApiUrl);

      const result = await publishWebsite({
        websiteId: req.params.id,
        siteName: website.name,
        builderState: builderState.state as BuilderStateData,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey: supabaseServiceRoleKey || '',
        stripeSecretKey,
        stripePublishableKey,
        stripeWebhookSecret,
        vercelToken,
        vercelTeamId: process.env.VERCEL_TEAM_ID,
        birdflowApiUrl,
      });

      if (result.success) {
        await storage.updateWebsite(req.params.id, user.id, {
          status: 'published',
          deploymentUrl: result.deploymentUrl,
          deploymentId: result.deploymentId,
        } as any);

        // Send website published notification email
        try {
          const ownerProfile = await storage.getProfile(user.id);
          if (ownerProfile?.email && result.deploymentUrl) {
            await emailService.sendWebsitePublished(
              ownerProfile.email,
              req.params.id,
              website.name,
              result.deploymentUrl
            );
            console.log(`Website published email sent to ${ownerProfile.email}`);
          }
        } catch (emailErr) {
          console.error(`Failed to send website published email:`, emailErr);
        }

        res.json({
          success: true,
          deploymentUrl: result.deploymentUrl,
          message: stripeWarning ? `Website published successfully. Warning: ${stripeWarning}` : "Website published successfully",
          warning: stripeWarning,
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ MEDIA ASSETS ROUTES ============

  // Get all media assets for a website
  app.get("/api/websites/:id/media", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const assets = await storage.getMediaAssets(req.params.id);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a signed upload URL for Supabase Storage
  app.post("/api/websites/:id/media/upload-url", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.post("/api/websites/:id/media", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { filename, originalFilename, storagePath, mimeType, size, width, height, crop, altText } = req.body;
      
      if (!filename || !originalFilename || !storagePath || !mimeType || size === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
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

      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update a media asset (for cropping, alt text, etc.)
  app.patch("/api/websites/:id/media/:mediaId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const asset = await storage.updateMediaAsset(req.params.mediaId, req.params.id, req.body);
      if (!asset) {
        return res.status(404).json({ message: "Media asset not found" });
      }
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a media asset
  app.delete("/api/websites/:id/media/:mediaId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Also delete from Supabase Storage
      const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseServiceRoleKey && supabaseUrl) {
        const asset = await storage.getMediaAsset(req.params.mediaId, req.params.id);
        if (asset) {
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
          await adminClient.storage.from('media').remove([asset.storagePath]);
        }
      }

      const deleted = await storage.deleteMediaAsset(req.params.mediaId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Media asset not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get public URL for a media asset
  app.get("/api/websites/:id/media/:mediaId/url", async (req, res) => {
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
  app.get("/api/websites/:id/booking-services", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.post("/api/websites/:id/booking-services", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.patch("/api/websites/:id/booking-services/:serviceId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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
  app.delete("/api/websites/:id/booking-services/:serviceId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const website = await storage.getWebsite(req.params.id);
      
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      if (website.ownerId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

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

  // Public endpoint to get available time slots for a date
  app.get("/api/public/websites/:websiteId/services/:serviceId/slots", async (req, res) => {
    try {
      const { date } = req.query;
      
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
        date
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
      const { customerName, customerEmail, customerPhone, service, serviceId, date, time, notes } = req.body;
      console.log(`[Booking] Request details:`, { customerName, customerEmail, service, serviceId, date, time });
      
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

      // Double-booking prevention: Check if slot is still available
      if (serviceId && time) {
        // Parse date string to YYYY-MM-DD format
        const dateObj = new Date(date);
        const dateStr = dateObj.toISOString().split('T')[0];
        
        console.log(`[Booking] Checking availability for service ${serviceId} on ${dateStr} at ${time}`);
        const isAvailable = await storage.checkSlotAvailable(serviceId, websiteId, dateStr, time);
        if (!isAvailable) {
          console.log(`[Booking] CONFLICT: Slot ${time} on ${dateStr} is already booked for service ${serviceId}`);
          return res.status(409).json({ 
            message: "This time slot is no longer available. Please select a different time.",
            code: "SLOT_UNAVAILABLE"
          });
        }
        console.log(`[Booking] Slot is available, proceeding with booking`);
      }

      const booking = await storage.createBooking({
        websiteId,
        customerName,
        customerEmail,
        customerPhone,
        service,
        serviceId: serviceId || null,
        date: new Date(date),
        time: time || null,
        notes,
      });
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

  // Add a custom domain - immediately adds to Vercel and returns DNS config
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

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existing = await storage.getCustomDomainByDomain(domain);
      if (existing) {
        return res.status(400).json({ message: "Domain is already in use" });
      }

      // Check if Vercel is configured
      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.status(400).json({ message: "Custom domains require Vercel integration. Please contact support." });
      }

      // Require website to be published first
      if (!website.deploymentUrl) {
        return res.status(400).json({ message: "Please publish your website first before adding a custom domain." });
      }

      // Use the canonical project name format: site-{websiteId}
      // Must match the format used in publisher/index.ts when creating the project
      const projectName = `site-${req.params.id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      
      const vercelConfig = { 
        token: vercelToken, 
        teamId: process.env.VERCEL_TEAM_ID 
      };

      // Add domain to Vercel immediately
      const vercelResult = await addCustomDomain(projectName, domain.toLowerCase(), vercelConfig);
      
      if (!vercelResult.success) {
        return res.status(400).json({ message: vercelResult.error || "Failed to add domain to hosting service" });
      }

      // Determine DNS record type based on domain structure
      // Apex domains (example.com) need A record, subdomains (www.example.com) need CNAME
      const domainParts = domain.toLowerCase().split('.');
      const isSubdomain = domainParts.length > 2 || domainParts[0] === 'www';
      
      let dnsType: string;
      let dnsName: string;
      let dnsValue: string;

      // Check if Vercel returned specific verification requirements
      const vercelDomainConfig = vercelResult.domainConfig;
      if (vercelDomainConfig?.verification && vercelDomainConfig.verification.length > 0) {
        const verifyRecord = vercelDomainConfig.verification[0];
        dnsType = verifyRecord.type || (isSubdomain ? 'CNAME' : 'A');
        dnsValue = verifyRecord.value || (isSubdomain ? 'cname.vercel-dns.com' : '76.76.21.21');
        dnsName = isSubdomain ? domainParts[0] : '@';
      } else {
        // Default DNS configuration
        if (isSubdomain) {
          dnsType = 'CNAME';
          dnsName = domainParts[0]; // e.g., "www" or "shop"
          dnsValue = 'cname.vercel-dns.com';
        } else {
          dnsType = 'A';
          dnsName = '@';
          dnsValue = '76.76.21.21'; // Vercel's IP for apex domains
        }
      }

      // Create the domain record
      const customDomain = await storage.createCustomDomain({
        websiteId: req.params.id,
        domain: domain.toLowerCase(),
        status: 'pending',
        vercelProjectId: projectName,
        dnsType,
        dnsName,
        dnsValue,
      });

      res.status(201).json(customDomain);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Check domain verification status - polls Vercel for DNS verification
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

      if (domain.status === 'active') {
        return res.json({ verified: true, status: 'active' });
      }

      const vercelToken = process.env.VERCEL_TOKEN;
      if (!vercelToken) {
        return res.status(400).json({ message: "Vercel is not configured" });
      }

      const projectName = domain.vercelProjectId || `site-${req.params.id}`;
      const vercelConfig = { 
        token: vercelToken, 
        teamId: process.env.VERCEL_TEAM_ID 
      };

      // Check domain status on Vercel
      const domainConfigResult = await getDomainConfig(projectName, domain.domain, vercelConfig);
      
      if (!domainConfigResult) {
        // Domain might not be added to Vercel yet, try adding it
        const addResult = await addCustomDomain(projectName, domain.domain, vercelConfig);
        if (!addResult.success) {
          await storage.updateCustomDomain(domain.id, req.params.id, { 
            status: 'error',
            errorMessage: addResult.error
          });
          return res.json({ 
            verified: false, 
            status: 'error',
            error: addResult.error
          });
        }
      }

      // Trigger verification check on Vercel
      const verifyResult = await verifyDomainConfig(projectName, domain.domain, vercelConfig);
      
      if (verifyResult.configured) {
        await storage.updateCustomDomain(domain.id, req.params.id, { 
          status: 'active',
          errorMessage: null
        } as any);
        
        return res.json({ 
          verified: true, 
          status: 'active',
          message: 'Domain is now active!'
        });
      }

      // Still waiting for DNS propagation
      await storage.updateCustomDomain(domain.id, req.params.id, { 
        status: 'verifying'
      });

      res.json({ 
        verified: false, 
        status: 'verifying',
        message: 'DNS changes are still propagating. This can take up to 48 hours.',
        dnsType: domain.dnsType,
        dnsName: domain.dnsName,
        dnsValue: domain.dnsValue
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

      // Remove from Vercel if configured
      const vercelToken = process.env.VERCEL_TOKEN;
      if (vercelToken && domain.vercelProjectId) {
        const vercelConfig = { 
          token: vercelToken, 
          teamId: process.env.VERCEL_TEAM_ID 
        };
        await removeCustomDomain(domain.vercelProjectId, domain.domain, vercelConfig);
      }

      await storage.deleteCustomDomain(req.params.domainId, req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============ DOMAIN PURCHASE ROUTES ============

  // Check domain availability and pricing
  app.get("/api/websites/:id/domains/check-availability", requireAuth, async (req, res) => {
    try {
      const { domain } = req.query;
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Domain name is required" });
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
        return res.status(400).json({ message: "Domain registration requires Vercel integration. Please contact support." });
      }

      const vercelConfig = {
        token: vercelToken,
        teamId: process.env.VERCEL_TEAM_ID,
      };

      const availability = await checkDomainAvailability(domain.toLowerCase(), vercelConfig);
      res.json(availability);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Purchase a domain and optionally connect it to the website
  app.post("/api/websites/:id/domains/purchase", requireAuth, async (req, res) => {
    try {
      const { domain, connectToWebsite } = req.body;
      if (!domain) {
        return res.status(400).json({ message: "Domain is required" });
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
        return res.status(400).json({ message: "Domain purchase requires Vercel integration." });
      }

      const vercelConfig = {
        token: vercelToken,
        teamId: process.env.VERCEL_TEAM_ID,
      };

      // Step 1: Purchase the domain through Vercel
      const purchaseResult = await purchaseDomain(domain.toLowerCase(), vercelConfig);
      if (!purchaseResult.success) {
        return res.status(400).json({ message: purchaseResult.error || "Failed to purchase domain" });
      }

      // Step 2: If connectToWebsite is true, also add it to the website's Vercel project
      if (connectToWebsite && website.deploymentUrl) {
        const projectName = `site-${req.params.id}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

        // Add domain to the Vercel project
        const addResult = await addCustomDomain(projectName, domain.toLowerCase(), vercelConfig);

        // Determine DNS configuration
        const domainParts = domain.toLowerCase().split('.');
        const isSubdomain = domainParts.length > 2 || domainParts[0] === 'www';

        let dnsType: string;
        let dnsName: string;
        let dnsValue: string;

        if (isSubdomain) {
          dnsType = 'CNAME';
          dnsName = domainParts[0];
          dnsValue = 'cname.vercel-dns.com';
        } else {
          dnsType = 'A';
          dnsName = '@';
          dnsValue = '76.76.21.21';
        }

        // Create the domain record in our database
        const customDomain = await storage.createCustomDomain({
          websiteId: req.params.id,
          domain: domain.toLowerCase(),
          status: 'verifying', // Since we own the domain, DNS should auto-configure
          vercelProjectId: projectName,
          dnsType,
          dnsName,
          dnsValue,
        });

        return res.status(201).json({
          success: true,
          purchased: true,
          connected: true,
          domain: customDomain,
          message: "Domain purchased and connected! Since the domain is registered through Vercel, DNS will be configured automatically.",
        });
      }

      res.status(201).json({
        success: true,
        purchased: true,
        connected: false,
        domain: domain.toLowerCase(),
        message: "Domain purchased successfully! You can now connect it to your website.",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

      const settings = await storage.getPaymentSettings(req.params.id);
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

      // Generate account link for onboarding
      const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
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
        return res.redirect(`/manage/${websiteId}?stripe_error=${encodeURIComponent('Stripe konto ikke fundet')}`);
      }

      // Check account status
      const platformStripeSecretKey = await getStripeSecretKey();
      if (!platformStripeSecretKey) {
        return res.redirect(`/manage/${websiteId}?stripe_error=${encodeURIComponent('Stripe er ikke konfigureret')}`);
      }
      
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(platformStripeSecretKey);

      const account = await stripe.accounts.retrieve(settings.stripeAccountId);

      // Verify account metadata matches
      if (account.metadata?.websiteId !== websiteId) {
        console.error(`Account metadata websiteId mismatch`);
        return res.redirect(`/manage/${websiteId}?stripe_error=${encodeURIComponent('Konto verifikation fejlede')}`);
      }

      // Check if onboarding is complete
      if (account.details_submitted && account.charges_enabled) {
        await storage.updatePaymentSettings(websiteId, {
          stripeConnectStatus: 'connected',
          isConnected: true,
        });
        console.log(`Stripe Connect completed for website ${websiteId}: ${settings.stripeAccountId}`);
        res.redirect(`/manage/${websiteId}?stripe_connected=true`);
      } else {
        // Onboarding not complete yet
        await storage.updatePaymentSettings(websiteId, {
          stripeConnectStatus: 'pending',
          isConnected: false,
        });
        res.redirect(`/manage/${websiteId}?stripe_pending=true`);
      }
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
      return res.redirect(`/manage/${websiteId}?stripe_refresh=true&error=session_expired`);
    }
    
    res.redirect(`/manage/${websiteId}?stripe_refresh=true`);
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
  app.post("/api/websites/:id/ai/build", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { prompt, mode = 'creative' } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const creativeMode: CreativeMode = mode === 'safe' ? 'safe' : 'creative';

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }

      const currentState = builderData.state as BuilderStateData;
      const aiResponse = await processAIBuildRequest(prompt, currentState, creativeMode);
      const newState = applyMutations(currentState, aiResponse.mutations);
      
      await storage.updateBuilderState(req.params.id, newState);

      res.json({
        success: true,
        explanation: aiResponse.explanation,
        mutations: aiResponse.mutations,
        newState,
      });
    } catch (error: any) {
      console.error("AI Build error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Thinking mode (returns plan without applying)
  app.post("/api/websites/:id/ai/think", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { prompt, mode = 'creative' } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const creativeMode: CreativeMode = mode === 'safe' ? 'safe' : 'creative';

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }

      const currentState = builderData.state as BuilderStateData;
      const thinkingResponse = await processAIThinkingRequest(prompt, currentState, creativeMode);

      res.json({
        success: true,
        ...thinkingResponse,
      });
    } catch (error: any) {
      console.error("AI Think error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Apply plan (executes mutations from thinking mode)
  app.post("/api/websites/:id/ai/apply", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { mutations } = req.body;
      if (!mutations || !Array.isArray(mutations)) {
        return res.status(400).json({ message: "Mutations array is required" });
      }

      const validatedMutations = mutations.map(m => BuilderMutationSchema.parse(m));

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }

      const currentState = builderData.state as BuilderStateData;
      const newState = applyMutations(currentState, validatedMutations);
      
      await storage.updateBuilderState(req.params.id, newState);

      res.json({
        success: true,
        newState,
      });
    } catch (error: any) {
      console.error("AI Apply error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Design analysis mode (analyzes current design and provides recommendations)
  app.post("/api/websites/:id/ai/analyze", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const builderData = await storage.getBuilderState(req.params.id);
      if (!builderData) {
        return res.status(404).json({ message: "Builder state not found" });
      }

      const currentState = builderData.state as BuilderStateData;
      const { analyzeDesign } = await import("./aiBuilder");
      const analysis = await analyzeDesign(currentState);

      res.json(analysis);
    } catch (error: any) {
      console.error("AI Analyze error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Builder - Clone from URL (captures screenshot and generates builder_state)
  app.post("/api/websites/:id/ai/clone-from-url", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL format
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ message: "Invalid URL protocol" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      // Capture screenshot of the website
      const { captureWebsiteScreenshot } = await import("./screenshotService");
      const screenshotResult = await captureWebsiteScreenshot(url);
      
      if (!screenshotResult.success || !screenshotResult.imageBase64) {
        return res.status(500).json({ 
          message: screenshotResult.error || "Failed to capture screenshot" 
        });
      }

      // Analyze screenshot and generate builder state
      const { analyzeAndCloneWebsite } = await import("./aiVisionCloner");
      const cloneResult = await analyzeAndCloneWebsite(screenshotResult.imageBase64, url);
      
      if (!cloneResult.success || !cloneResult.builderState) {
        return res.status(500).json({ 
          message: cloneResult.error || "Failed to analyze website" 
        });
      }

      // Save the new builder state
      await storage.updateBuilderState(req.params.id, cloneResult.builderState);

      res.json({
        success: true,
        newState: cloneResult.builderState,
        analysis: cloneResult.analysis,
        sourceUrl: url,
      });
    } catch (error: any) {
      console.error("AI Clone from URL error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Architect - Analyze and Plan (Thinking Mode) - creates detailed plan WITHOUT modifying builder_state
  app.post("/api/websites/:id/ai/architect-plan", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { prompt, url, imageBase64 } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const { analyzeAndPlanWebsite } = await import("./websiteArchitect");
      const result = await analyzeAndPlanWebsite(prompt, imageBase64, url);

      if (!result.success || !result.plan) {
        return res.status(500).json({
          message: result.error || "Failed to create website plan",
        });
      }

      res.json({
        success: true,
        plan: result.plan,
      });
    } catch (error: any) {
      console.error("AI Architect Plan error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Architect - Build from Plan - executes plan and creates builder_state
  app.post("/api/websites/:id/ai/architect-build", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { plan } = req.body;
      if (!plan) {
        return res.status(400).json({ message: "Plan is required" });
      }

      const { buildFromPlan } = await import("./websiteArchitect");
      const result = await buildFromPlan(plan);

      if (!result.success || !result.builderState) {
        return res.status(500).json({
          message: result.error || "Failed to build website from plan",
        });
      }

      // Save the new builder state
      await storage.updateBuilderState(req.params.id, result.builderState);

      res.json({
        success: true,
        newState: result.builderState,
        phasesCompleted: result.phasesCompleted,
      });
    } catch (error: any) {
      console.error("AI Architect Build error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // AI Architect - Full flow with URL screenshot (combines screenshot + plan)
  app.post("/api/websites/:id/ai/architect-from-url", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { url, prompt } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL format
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return res.status(400).json({ message: "Invalid URL protocol" });
        }
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      // Capture screenshot of the website
      const { captureWebsiteScreenshot } = await import("./screenshotService");
      const screenshotResult = await captureWebsiteScreenshot(url);

      if (!screenshotResult.success || !screenshotResult.imageBase64) {
        return res.status(500).json({
          message: screenshotResult.error || "Failed to capture screenshot",
        });
      }

      // Analyze and create plan
      const { analyzeAndPlanWebsite } = await import("./websiteArchitect");
      const result = await analyzeAndPlanWebsite(
        prompt || `Clone and recreate the website from ${url}`,
        screenshotResult.imageBase64,
        url
      );

      if (!result.success || !result.plan) {
        return res.status(500).json({
          message: result.error || "Failed to analyze website",
        });
      }

      res.json({
        success: true,
        plan: result.plan,
        screenshotBase64: screenshotResult.imageBase64,
      });
    } catch (error: any) {
      console.error("AI Architect from URL error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // PHASED ARCHITECT API - Build in 4 phases
  // ============================================

  // Phase 1: Generate Structure (Wireframe)
  // Get saved phased build state
  app.get("/api/websites/:id/ai/phased/state", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [savedState] = await db.select().from(phasedBuildState).where(eq(phasedBuildState.websiteId, req.params.id));
      
      res.json({
        success: true,
        state: savedState || null,
      });
    } catch (error: any) {
      console.error("Get phased state error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reset/clear phased build state (go back to beginning)
  app.delete("/api/websites/:id/ai/phased/state", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await db.delete(phasedBuildState).where(eq(phasedBuildState.websiteId, req.params.id));
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete phased state error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Go back to a specific phase (keeps earlier phase data, clears later phases)
  app.post("/api/websites/:id/ai/phased/goto", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { phase } = req.body;
      if (!phase || !['structure', 'content', 'styling', 'polish'].includes(phase)) {
        return res.status(400).json({ message: "Valid phase is required" });
      }

      const [existing] = await db.select().from(phasedBuildState).where(eq(phasedBuildState.websiteId, req.params.id));
      if (!existing) {
        return res.status(404).json({ message: "No phased build in progress" });
      }

      // Clear later phases based on target phase
      const updates: any = { currentPhase: phase, updatedAt: new Date() };
      if (phase === 'structure') {
        updates.contentData = null;
        updates.stylingData = null;
        updates.polishData = null;
      } else if (phase === 'content') {
        updates.stylingData = null;
        updates.polishData = null;
      } else if (phase === 'styling') {
        updates.polishData = null;
      }

      await db.update(phasedBuildState)
        .set(updates)
        .where(eq(phasedBuildState.websiteId, req.params.id));

      const [updatedState] = await db.select().from(phasedBuildState).where(eq(phasedBuildState.websiteId, req.params.id));

      res.json({
        success: true,
        state: updatedState,
      });
    } catch (error: any) {
      console.error("Go to phase error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/websites/:id/ai/phased/structure", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { prompt, sourceUrl } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ message: "Prompt is required" });
      }

      const { generateStructure } = await import("./phasedArchitect");
      const result = await generateStructure(prompt, sourceUrl);

      if (!result.success || !result.plan) {
        return res.status(500).json({
          message: result.error || "Failed to generate structure",
        });
      }

      // Persist the structure phase data
      const [existing] = await db.select().from(phasedBuildState).where(eq(phasedBuildState.websiteId, req.params.id));
      if (existing) {
        await db.update(phasedBuildState)
          .set({
            currentPhase: 'content',
            structureData: result.plan,
            siteDescription: prompt,
            siteType: result.plan.siteType,
            contentData: null,
            stylingData: null,
            polishData: null,
            updatedAt: new Date(),
          })
          .where(eq(phasedBuildState.websiteId, req.params.id));
      } else {
        await db.insert(phasedBuildState).values({
          websiteId: req.params.id,
          currentPhase: 'content',
          structureData: result.plan,
          siteDescription: prompt,
          siteType: result.plan.siteType,
        });
      }

      res.json({
        success: true,
        phase: 'structure',
        plan: result.plan,
      });
    } catch (error: any) {
      console.error("Phased Architect Structure error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 2: Generate Content
  app.post("/api/websites/:id/ai/phased/content", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { plan } = req.body;
      if (!plan) {
        return res.status(400).json({ message: "Plan is required" });
      }

      const { generateContent } = await import("./phasedArchitect");
      const result = await generateContent(plan);

      if (!result.success || !result.content) {
        return res.status(500).json({
          message: result.error || "Failed to generate content",
        });
      }

      // Persist the content phase data
      await db.update(phasedBuildState)
        .set({
          currentPhase: 'styling',
          contentData: result.content,
          updatedAt: new Date(),
        })
        .where(eq(phasedBuildState.websiteId, req.params.id));

      res.json({
        success: true,
        phase: 'content',
        content: result.content,
      });
    } catch (error: any) {
      console.error("Phased Architect Content error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 3: Generate Styling
  app.post("/api/websites/:id/ai/phased/styling", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { plan, content } = req.body;
      if (!plan) {
        return res.status(400).json({ message: "Plan is required" });
      }

      const { generateStyling } = await import("./phasedArchitect");
      const result = await generateStyling(plan, content || {});

      if (!result.success) {
        return res.status(500).json({
          message: result.error || "Failed to generate styling",
        });
      }

      // Persist the styling phase data
      await db.update(phasedBuildState)
        .set({
          currentPhase: 'polish',
          stylingData: { designSystem: result.designSystem, sectionStyles: result.sectionStyles },
          designSystem: result.designSystem,
          updatedAt: new Date(),
        })
        .where(eq(phasedBuildState.websiteId, req.params.id));

      res.json({
        success: true,
        phase: 'styling',
        designSystem: result.designSystem,
        sectionStyles: result.sectionStyles,
      });
    } catch (error: any) {
      console.error("Phased Architect Styling error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Phase 4: Generate Polish (Animations)
  app.post("/api/websites/:id/ai/phased/polish", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { plan, designSystem } = req.body;
      if (!plan || !designSystem) {
        return res.status(400).json({ message: "Plan and designSystem are required" });
      }

      const { generatePolish } = await import("./phasedArchitect");
      const result = await generatePolish(plan, designSystem);

      if (!result.success) {
        return res.status(500).json({
          message: result.error || "Failed to generate polish",
        });
      }

      // Persist the polish phase data
      await db.update(phasedBuildState)
        .set({
          currentPhase: 'complete',
          polishData: { animations: result.animations, hoverEffects: result.hoverEffects },
          updatedAt: new Date(),
        })
        .where(eq(phasedBuildState.websiteId, req.params.id));

      res.json({
        success: true,
        phase: 'polish',
        animations: result.animations,
        hoverEffects: result.hoverEffects,
      });
    } catch (error: any) {
      console.error("Phased Architect Polish error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Build final website from all phases
  app.post("/api/websites/:id/ai/phased/build", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { plan, phasedState } = req.body;
      if (!plan || !phasedState) {
        return res.status(400).json({ message: "Plan and phasedState are required" });
      }

      const { buildFromPhasedState } = await import("./phasedArchitect");
      const result = await buildFromPhasedState(plan, phasedState);

      if (!result.success || !result.builderState) {
        return res.status(500).json({
          message: result.error || "Failed to build website",
        });
      }

      // Save the new builder state
      await storage.updateBuilderState(req.params.id, result.builderState);

      res.json({
        success: true,
        newState: result.builderState,
      });
    } catch (error: any) {
      console.error("Phased Architect Build error:", error);
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
      let { websiteId, sessionId, eventType, pageUrl, trafficSource, deviceType, country, eventData } = req.body;
      
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

      const validEventTypes = ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'checkout_success', 'order_created', 'booking_submit', 'booking_created'];
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
  app.get("/api/websites/:id/analytics/overview", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

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
  app.get("/api/websites/:id/analytics/funnel", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

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
  app.get("/api/websites/:id/analytics/traffic", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

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
  app.get("/api/websites/:id/analytics/pages", requireAuth, async (req, res) => {
    try {
      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }
      if (website.ownerId !== (req as any).user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

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

  // Admin impersonation - generates a session token for viewing as a user
  app.post("/api/admin/impersonate/:userId", requireAuth, requireAdmin, async (req, res) => {
    try {
      const targetUser = await storage.getProfile(req.params.userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      // Return user data for impersonation (frontend handles session swap)
      res.json({
        userId: targetUser.id,
        email: targetUser.email,
        fullName: targetUser.fullName,
      });
    } catch (error: any) {
      console.error("Admin impersonate error:", error);
      res.status(500).json({ message: error.message });
    }
  });

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
      
      // Mark onboarding as complete when user clicks subscribe and goes to Stripe checkout
      await db.update(profiles)
        .set({ onboardingCompleted: true })
        .where(eq(profiles.id, userId));
      
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
      
      const periodEnd = subscription.current_period_end 
        ? new Date(subscription.current_period_end * 1000) 
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

  return httpServer;
}
