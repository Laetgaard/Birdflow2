import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProfileSchema, insertWebsiteSchema, insertWebsiteInputsSchema, type BuilderStateData, type BuilderComponent } from "@shared/schema";
import { createClient } from "@supabase/supabase-js";
import { publishWebsite } from "./publisher";
import { getUncachableStripeClient, getStripePublishableKey, getStripeSecretKey } from "./stripeClient";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
      const { name, setupType, templateId } = req.body;

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

      // If a template is specified, apply it to the builder state
      if (templateId) {
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

      const booking = await storage.updateBooking(req.params.bookingId, req.params.id, req.body);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
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
      const { items, customerEmail, customerName } = req.body;
      
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

      const lineItems = validatedItems.map(item => ({
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

      // Create order with pending payment status
      await storage.createOrder({
        websiteId,
        customerName: customerName || customerEmail?.split('@')[0] || 'Customer',
        customerEmail: customerEmail || 'guest@checkout.com',
        status: 'pending',
        paymentStatus: 'pending',
        stripeSessionId: session.id,
        total: total.toFixed(2),
        currency: primaryCurrency,
        items: validatedItems.map(item => ({
          id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Public checkout error:', error);
      res.status(500).json({ message: error.message });
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

      // Fetch Stripe secret key from Replit connector
      let stripeSecretKey: string | undefined;
      let stripeWarning: string | undefined;
      try {
        stripeSecretKey = await getStripeSecretKey();
      } catch (err) {
        console.log('Stripe not configured - checkout will not work on published site');
        stripeWarning = 'Stripe is not configured. Product checkout will not work on your published site. Configure Stripe in the integrations panel to enable payments.';
      }

      const result = await publishWebsite({
        websiteId: req.params.id,
        siteName: website.name,
        builderState: builderState.state as BuilderStateData,
        supabaseUrl,
        supabaseAnonKey,
        supabaseServiceRoleKey: supabaseServiceRoleKey || '',
        stripeSecretKey,
        vercelToken,
        vercelTeamId: process.env.VERCEL_TEAM_ID,
      });

      if (result.success) {
        await storage.updateWebsite(req.params.id, user.id, {
          status: 'published',
          deploymentUrl: result.deploymentUrl,
          deploymentId: result.deploymentId,
        } as any);

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

      res.status(201).json(booking);
    } catch (error: any) {
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

  return httpServer;
}
