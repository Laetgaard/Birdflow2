import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertProfileSchema, insertWebsiteSchema, insertWebsiteInputsSchema, type BuilderStateData, type BuilderComponent, sanitizeAnalyticsEventData, websites, builderState, profiles, publicStats } from "@shared/schema";
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
  type PlanId
} from "./subscriptionService";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { addCustomDomain, removeCustomDomain, verifyDomainConfig, getDomainConfig } from "./publisher/vercel";
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

// Middleware to verify Supabase session
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

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Authentication failed" });
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
      res.json({ totalCreators: 1247 }); // Fallback
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

        // 3. Mark onboarding as complete
        await tx.update(profiles)
          .set({ onboardingCompleted: true })
          .where(eq(profiles.id, user.id));

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
        await storage.createProfile({
          id: authData.user.id,
          email,
          fullName,
          phoneNumber,
        });
      } catch (profileError: any) {
        // If profile already exists (e.g., user re-signing up), update it
        if (profileError.code === '23505') {
          await storage.updateProfile(authData.user.id, { fullName, phoneNumber });
        } else {
          console.error("Profile creation error:", profileError);
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

      // If profile doesn't exist, create it from user metadata
      if (!profile && data.user.user_metadata) {
        try {
          profile = await storage.createProfile({
            id: data.user.id,
            email: data.user.email!,
            fullName: data.user.user_metadata.full_name || "",
            phoneNumber: data.user.user_metadata.phone_number || "",
          });
        } catch (e) {
          console.error("Error creating profile on signin:", e);
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

      if (!profile && data.user.user_metadata) {
        try {
          profile = await storage.createProfile({
            id: data.user.id,
            email: data.user.email!,
            fullName: data.user.user_metadata.full_name || "",
            phoneNumber: data.user.user_metadata.phone_number || "",
          });
        } catch (e) {
          console.error("Error creating profile:", e);
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
      
      const session = await stripe.checkout.sessions.create({
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
      });

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

      const session = await stripe.checkout.sessions.create({
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
      });

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

      const session = await stripe.checkout.sessions.create({
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
      });

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
    try {
      const { customerName, customerEmail, customerPhone, service, date, notes } = req.body;
      
      if (!customerName || !customerEmail || !service || !date) {
        return res.status(400).json({ message: "Customer name, email, service, and date are required" });
      }

      const website = await storage.getWebsite(req.params.id);
      if (!website) {
        return res.status(404).json({ message: "Website not found" });
      }

      const booking = await storage.createBooking({
        websiteId: req.params.id,
        customerName,
        customerEmail,
        customerPhone,
        service,
        date: new Date(date),
        notes,
      });

      // Send booking confirmation email
      try {
        const websiteUrl = website.deploymentUrl || undefined;
        await emailService.sendBookingConfirmation(
          booking,
          customerEmail,
          service,
          websiteUrl
        );
        console.log(`Booking confirmation email sent to ${customerEmail}`);
      } catch (emailErr) {
        console.error(`Failed to send booking confirmation email:`, emailErr);
      }

      res.status(201).json(booking);
    } catch (error: any) {
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
          testMode: true 
        });
      }

      // Mask sensitive keys
      res.json({
        ...settings,
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
          message: "No billing account found. Please upgrade to a paid plan first.",
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
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(event.data.object);
          break;
        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object);
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
