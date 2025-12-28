import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and } from "drizzle-orm";
import { 
  profiles, type Profile, type InsertProfile,
  websites, type Website, type InsertWebsite,
  websiteInputs, type WebsiteInputs, type InsertWebsiteInputs,
  builderState, type BuilderState, type InsertBuilderState, type BuilderStateData,
  orders, type Order, type InsertOrder,
  bookings, type Booking, type InsertBooking,
  formSubmissions, type FormSubmission, type InsertFormSubmission,
  customers, type Customer, type InsertCustomer,
  products, type Product, type InsertProduct,
  mediaAssets, type MediaAsset, type InsertMediaAsset,
  bookingServices, type BookingService, type InsertBookingService
} from "@shared/schema";

// Use Supabase database as primary storage
// Try SUPABASE_DB_URL first (pooled), then fallback to SUPABASE_DATABASE_URL
const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;

if (!supabaseDbUrl) {
  console.error("SUPABASE_DB_URL or SUPABASE_DATABASE_URL is not set. Database operations will fail.");
}

const pool = new Pool({
  connectionString: supabaseDbUrl,
  ssl: { rejectUnauthorized: false },
});

const db = drizzle(pool);

// Default builder state for new websites (component-based structure)
const defaultBuilderState: BuilderStateData = {
  pages: [
    {
      id: 'home',
      name: 'Home',
      path: '/',
      components: [
        {
          id: 'header-1',
          type: 'header',
          props: {
            title: 'Your Brand',
            buttonText: 'Contact',
            buttonLink: '/contact'
          },
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#1a1a1a',
            padding: '16px 24px'
          }
        },
        {
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
        },
        {
          id: 'features-1',
          type: 'features',
          props: {
            title: 'Features',
            items: [
              { id: '1', title: 'Feature One', description: 'Description for feature one', icon: 'star' },
              { id: '2', title: 'Feature Two', description: 'Description for feature two', icon: 'zap' },
              { id: '3', title: 'Feature Three', description: 'Description for feature three', icon: 'shield' }
            ],
            alignment: 'center'
          },
          styles: {
            backgroundColor: '#ffffff',
            textColor: '#1a1a1a',
            padding: '80px 24px'
          }
        },
        {
          id: 'footer-1',
          type: 'footer',
          props: {
            title: '© 2025 Your Company. All rights reserved.'
          },
          styles: {
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff',
            padding: '32px 24px'
          }
        }
      ]
    }
  ],
  activePage: 'home',
  globalStyles: {
    primaryColor: '#3b82f6',
    secondaryColor: '#10b981',
    fontFamily: 'Inter, sans-serif',
    backgroundColor: '#ffffff'
  }
};

export interface IStorage {
  // Profile methods
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile & { id: string }): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Website methods
  getWebsite(id: string): Promise<Website | undefined>;
  getWebsitesByOwner(ownerId: string): Promise<Website[]>;
  createWebsite(website: InsertWebsite): Promise<Website>;
  updateWebsite(id: string, ownerId: string, data: Partial<InsertWebsite>): Promise<Website | undefined>;
  deleteWebsite(id: string, ownerId: string): Promise<boolean>;
  
  // Website inputs methods
  getWebsiteInputs(websiteId: string): Promise<WebsiteInputs | undefined>;
  createWebsiteInputs(inputs: InsertWebsiteInputs): Promise<WebsiteInputs>;
  updateWebsiteInputs(websiteId: string, data: Partial<InsertWebsiteInputs>): Promise<WebsiteInputs | undefined>;
  
  // Builder state methods
  getBuilderState(websiteId: string): Promise<BuilderState | undefined>;
  createBuilderState(websiteId: string, state?: BuilderStateData): Promise<BuilderState>;
  updateBuilderState(websiteId: string, state: BuilderStateData): Promise<BuilderState | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Profile methods
  async getProfile(id: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    return result[0];
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const result = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
    return result[0];
  }

  async createProfile(profile: InsertProfile & { id: string }): Promise<Profile> {
    const result = await db.insert(profiles).values(profile).returning();
    return result[0];
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const result = await db.update(profiles).set(data).where(eq(profiles.id, id)).returning();
    return result[0];
  }

  // Website methods
  async getWebsite(id: string): Promise<Website | undefined> {
    const result = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return result[0];
  }

  async getWebsitesByOwner(ownerId: string): Promise<Website[]> {
    return await db.select().from(websites).where(eq(websites.ownerId, ownerId));
  }

  async createWebsite(website: InsertWebsite): Promise<Website> {
    const result = await db.insert(websites).values(website).returning();
    return result[0];
  }

  async updateWebsite(id: string, ownerId: string, data: Partial<InsertWebsite>): Promise<Website | undefined> {
    const result = await db
      .update(websites)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(websites.id, id), eq(websites.ownerId, ownerId)))
      .returning();
    return result[0];
  }

  async deleteWebsite(id: string, ownerId: string): Promise<boolean> {
    const result = await db
      .delete(websites)
      .where(and(eq(websites.id, id), eq(websites.ownerId, ownerId)))
      .returning();
    return result.length > 0;
  }

  // Website inputs methods
  async getWebsiteInputs(websiteId: string): Promise<WebsiteInputs | undefined> {
    const result = await db
      .select()
      .from(websiteInputs)
      .where(eq(websiteInputs.websiteId, websiteId))
      .limit(1);
    return result[0];
  }

  async createWebsiteInputs(inputs: InsertWebsiteInputs): Promise<WebsiteInputs> {
    const result = await db.insert(websiteInputs).values(inputs as any).returning();
    return result[0];
  }

  async updateWebsiteInputs(websiteId: string, data: Partial<InsertWebsiteInputs>): Promise<WebsiteInputs | undefined> {
    const result = await db
      .update(websiteInputs)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(websiteInputs.websiteId, websiteId))
      .returning();
    return result[0];
  }

  // Builder state methods
  async getBuilderState(websiteId: string): Promise<BuilderState | undefined> {
    const result = await db
      .select()
      .from(builderState)
      .where(eq(builderState.websiteId, websiteId))
      .limit(1);
    return result[0] as BuilderState | undefined;
  }

  async createBuilderState(websiteId: string, state?: BuilderStateData): Promise<BuilderState> {
    const result = await db
      .insert(builderState)
      .values({
        websiteId,
        state: state || defaultBuilderState,
      } as any)
      .returning();
    return result[0] as BuilderState;
  }

  async updateBuilderState(websiteId: string, state: BuilderStateData): Promise<BuilderState | undefined> {
    const result = await db
      .update(builderState)
      .set({ state, updatedAt: new Date() } as any)
      .where(eq(builderState.websiteId, websiteId))
      .returning();
    return result[0] as BuilderState | undefined;
  }

  // Orders methods
  async getOrders(websiteId: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.websiteId, websiteId));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await db.insert(orders).values(order as any).returning();
    return result[0];
  }

  async updateOrder(orderId: string, websiteId: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(orders.id, orderId), eq(orders.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async getOrderByStripeSessionId(sessionId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.stripeSessionId, sessionId));
    return result[0];
  }

  async updateOrderByStripeSessionId(sessionId: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(orders.stripeSessionId, sessionId))
      .returning();
    return result[0];
  }

  // Bookings methods
  async getBookings(websiteId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.websiteId, websiteId));
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const result = await db.insert(bookings).values(booking as any).returning();
    return result[0];
  }

  async updateBooking(bookingId: string, websiteId: string, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const result = await db
      .update(bookings)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(bookings.id, bookingId), eq(bookings.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  // Form submissions methods
  async getFormSubmissions(websiteId: string): Promise<FormSubmission[]> {
    return db.select().from(formSubmissions).where(eq(formSubmissions.websiteId, websiteId));
  }

  async createFormSubmission(submission: InsertFormSubmission): Promise<FormSubmission> {
    const result = await db.insert(formSubmissions).values(submission as any).returning();
    return result[0];
  }

  // Customers methods
  async getCustomers(websiteId: string): Promise<Customer[]> {
    return db.select().from(customers).where(eq(customers.websiteId, websiteId));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer as any).returning();
    return result[0];
  }

  async updateCustomer(customerId: string, websiteId: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(customers.id, customerId), eq(customers.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  // Products methods
  async getProducts(websiteId: string): Promise<Product[]> {
    return db.select().from(products).where(eq(products.websiteId, websiteId));
  }

  async getActiveProducts(websiteId: string): Promise<Product[]> {
    return db.select().from(products).where(
      and(eq(products.websiteId, websiteId), eq(products.status, 'active'))
    );
  }

  async getProduct(productId: string, websiteId?: string): Promise<Product | undefined> {
    if (websiteId) {
      const result = await db.select().from(products).where(
        and(eq(products.id, productId), eq(products.websiteId, websiteId))
      ).limit(1);
      return result[0];
    }
    const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product as any).returning();
    return result[0];
  }

  async updateProduct(productId: string, websiteId: string, data: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(products.id, productId), eq(products.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteProduct(productId: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(products)
      .where(and(eq(products.id, productId), eq(products.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }

  // Media assets methods
  async getMediaAssets(websiteId: string): Promise<MediaAsset[]> {
    return db.select().from(mediaAssets).where(eq(mediaAssets.websiteId, websiteId));
  }

  async getMediaAsset(mediaId: string, websiteId?: string): Promise<MediaAsset | undefined> {
    if (websiteId) {
      const result = await db.select().from(mediaAssets).where(
        and(eq(mediaAssets.id, mediaId), eq(mediaAssets.websiteId, websiteId))
      ).limit(1);
      return result[0];
    }
    const result = await db.select().from(mediaAssets).where(eq(mediaAssets.id, mediaId)).limit(1);
    return result[0];
  }

  async createMediaAsset(asset: InsertMediaAsset): Promise<MediaAsset> {
    const result = await db.insert(mediaAssets).values(asset as any).returning();
    return result[0];
  }

  async updateMediaAsset(mediaId: string, websiteId: string, data: Partial<InsertMediaAsset>): Promise<MediaAsset | undefined> {
    const result = await db
      .update(mediaAssets)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteMediaAsset(mediaId: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(mediaAssets)
      .where(and(eq(mediaAssets.id, mediaId), eq(mediaAssets.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }

  // Booking services methods
  async getBookingServices(websiteId: string): Promise<BookingService[]> {
    return db.select().from(bookingServices).where(eq(bookingServices.websiteId, websiteId));
  }

  async getActiveBookingServices(websiteId: string): Promise<BookingService[]> {
    return db.select().from(bookingServices).where(
      and(eq(bookingServices.websiteId, websiteId), eq(bookingServices.active, 'true'))
    );
  }

  async getBookingService(serviceId: string, websiteId?: string): Promise<BookingService | undefined> {
    if (websiteId) {
      const result = await db.select().from(bookingServices).where(
        and(eq(bookingServices.id, serviceId), eq(bookingServices.websiteId, websiteId))
      ).limit(1);
      return result[0];
    }
    const result = await db.select().from(bookingServices).where(eq(bookingServices.id, serviceId)).limit(1);
    return result[0];
  }

  async createBookingService(service: InsertBookingService): Promise<BookingService> {
    const result = await db.insert(bookingServices).values(service as any).returning();
    return result[0];
  }

  async updateBookingService(serviceId: string, websiteId: string, data: Partial<InsertBookingService>): Promise<BookingService | undefined> {
    const result = await db
      .update(bookingServices)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(bookingServices.id, serviceId), eq(bookingServices.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteBookingService(serviceId: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(bookingServices)
      .where(and(eq(bookingServices.id, serviceId), eq(bookingServices.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
