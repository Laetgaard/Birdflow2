import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// Encryption helpers for sensitive data
// ENCRYPTION_KEY must be a 64-character hex string (32 bytes)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

const hasValidEncryptionKey = ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 64;

if (!hasValidEncryptionKey) {
  console.warn('WARNING: ENCRYPTION_KEY not set or invalid. Payment settings encryption will not work properly. Please set a 64-character hex string in environment variables.');
}

function encrypt(text: string): string {
  if (!hasValidEncryptionKey || !ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured. Cannot store encrypted data.');
  }
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string {
  if (!hasValidEncryptionKey || !ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured. Cannot decrypt data.');
  }
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data. The encryption key may have changed.');
  }
}
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
  bookingServices, type BookingService, type InsertBookingService,
  customDomains, type CustomDomain, type InsertCustomDomain,
  shippingMethods, type ShippingMethod, type InsertShippingMethod,
  shippingCarrierCredentials, type ShippingCarrierCredentials, type InsertShippingCarrierCredentials,
  shippingConfig, type ShippingConfig, type InsertShippingConfig,
  websitePaymentSettings, type WebsitePaymentSettings, type InsertWebsitePaymentSettings,
  analyticsEvents, type AnalyticsEvent, type InsertAnalyticsEvent,
  type AnalyticsOverview, type FunnelStep, type TrafficSource, type TopPage,
  sanitizeAnalyticsEventData,
  billingLeads, type BillingLead, type InsertBillingLead,
  emailSettings, type EmailSettings, type InsertEmailSettings,
  emailTemplates, type EmailTemplate, type InsertEmailTemplate,
  publicStats
} from "@shared/schema";
import { sql, gte, desc, count, countDistinct } from "drizzle-orm";

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

export const db = drizzle(pool);

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
  
  // Custom domain methods
  getCustomDomains(websiteId: string): Promise<CustomDomain[]>;
  getCustomDomainByDomain(domain: string): Promise<CustomDomain | undefined>;
  createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain>;
  updateCustomDomain(domainId: string, websiteId: string, data: Partial<InsertCustomDomain>): Promise<CustomDomain | undefined>;
  deleteCustomDomain(domainId: string, websiteId: string): Promise<boolean>;
  getWebsiteByCustomDomain(domain: string): Promise<Website | undefined>;
  
  // Shipping methods
  getShippingMethods(websiteId: string): Promise<ShippingMethod[]>;
  getActiveShippingMethods(websiteId: string): Promise<ShippingMethod[]>;
  getShippingMethod(id: string, websiteId: string): Promise<ShippingMethod | undefined>;
  createShippingMethod(method: InsertShippingMethod): Promise<ShippingMethod>;
  updateShippingMethod(id: string, websiteId: string, data: Partial<InsertShippingMethod>): Promise<ShippingMethod | undefined>;
  deleteShippingMethod(id: string, websiteId: string): Promise<boolean>;

  // Shipping carrier credentials
  getCarrierCredentials(websiteId: string): Promise<ShippingCarrierCredentials[]>;
  getCarrierCredential(id: string, websiteId: string): Promise<ShippingCarrierCredentials | undefined>;
  createCarrierCredential(credential: InsertShippingCarrierCredentials): Promise<ShippingCarrierCredentials>;
  updateCarrierCredential(id: string, websiteId: string, data: Partial<InsertShippingCarrierCredentials>): Promise<ShippingCarrierCredentials | undefined>;
  deleteCarrierCredential(id: string, websiteId: string): Promise<boolean>;

  // Shipping config
  getShippingConfig(websiteId: string): Promise<ShippingConfig | undefined>;
  createOrUpdateShippingConfig(config: InsertShippingConfig): Promise<ShippingConfig>;

  // Inventory methods
  updateProductStock(productId: string, websiteId: string, quantity: number): Promise<Product | undefined>;
  decrementStock(websiteId: string, items: Array<{ productId: string; quantity: number }>): Promise<{ success: boolean; errors?: string[] }>;
  checkStockAvailability(websiteId: string, items: Array<{ productId: string; quantity: number }>): Promise<{ available: boolean; outOfStock: Array<{ productId: string; name: string; requested: number; available: number }> }>;
  decrementProductStock(productId: string, quantity: number): Promise<void>;

  // Payment settings methods
  getPaymentSettings(websiteId: string): Promise<WebsitePaymentSettings | undefined>;
  createPaymentSettings(settings: InsertWebsitePaymentSettings): Promise<WebsitePaymentSettings>;
  updatePaymentSettings(websiteId: string, data: Partial<InsertWebsitePaymentSettings>): Promise<WebsitePaymentSettings | undefined>;

  // Analytics methods
  createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsOverview(websiteId: string, startDate: Date, endDate: Date): Promise<AnalyticsOverview>;
  getAnalyticsFunnel(websiteId: string, startDate: Date, endDate: Date): Promise<FunnelStep[]>;
  getTrafficSources(websiteId: string, startDate: Date, endDate: Date): Promise<TrafficSource[]>;
  getTopPages(websiteId: string, startDate: Date, endDate: Date): Promise<TopPage[]>;

  // Billing methods
  createBillingLead(lead: InsertBillingLead): Promise<BillingLead>;

  // Email settings methods
  getEmailSettings(websiteId: string): Promise<EmailSettings | undefined>;
  createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  updateEmailSettings(websiteId: string, data: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined>;

  // Email templates methods
  getEmailTemplates(websiteId: string): Promise<EmailTemplate[]>;
  getEmailTemplate(websiteId: string, templateType: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, websiteId: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;

  // Public stats methods
  getPublicStats(): Promise<{ totalCreators: number }>;
  incrementTotalCreators(): Promise<void>;

  // Profile onboarding methods
  completeOnboarding(userId: string): Promise<Profile | undefined>;
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

  async getBooking(bookingId: string, websiteId: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.websiteId, websiteId)))
      .limit(1);
    return result[0];
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

  // Custom domain methods
  async getCustomDomains(websiteId: string): Promise<CustomDomain[]> {
    return db.select().from(customDomains).where(eq(customDomains.websiteId, websiteId));
  }

  async getCustomDomainByDomain(domain: string): Promise<CustomDomain | undefined> {
    const result = await db.select().from(customDomains).where(eq(customDomains.domain, domain.toLowerCase())).limit(1);
    return result[0];
  }

  async createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain> {
    const result = await db.insert(customDomains).values({
      ...domain,
      domain: domain.domain.toLowerCase(),
    } as any).returning();
    return result[0];
  }

  async updateCustomDomain(domainId: string, websiteId: string, data: Partial<InsertCustomDomain>): Promise<CustomDomain | undefined> {
    const result = await db
      .update(customDomains)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(customDomains.id, domainId), eq(customDomains.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteCustomDomain(domainId: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(customDomains)
      .where(and(eq(customDomains.id, domainId), eq(customDomains.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }

  async getWebsiteByCustomDomain(domain: string): Promise<Website | undefined> {
    const customDomain = await this.getCustomDomainByDomain(domain);
    if (!customDomain || customDomain.status !== 'active') {
      return undefined;
    }
    return this.getWebsite(customDomain.websiteId);
  }

  // Shipping methods
  async getShippingMethods(websiteId: string): Promise<ShippingMethod[]> {
    return db.select().from(shippingMethods).where(eq(shippingMethods.websiteId, websiteId));
  }

  async getActiveShippingMethods(websiteId: string): Promise<ShippingMethod[]> {
    return db.select().from(shippingMethods).where(
      and(eq(shippingMethods.websiteId, websiteId), eq(shippingMethods.isActive, true))
    );
  }

  async getShippingMethod(id: string, websiteId: string): Promise<ShippingMethod | undefined> {
    const result = await db.select().from(shippingMethods)
      .where(and(eq(shippingMethods.id, id), eq(shippingMethods.websiteId, websiteId)))
      .limit(1);
    return result[0];
  }

  async createShippingMethod(method: InsertShippingMethod): Promise<ShippingMethod> {
    const result = await db.insert(shippingMethods).values(method as any).returning();
    return result[0];
  }

  async updateShippingMethod(id: string, websiteId: string, data: Partial<InsertShippingMethod>): Promise<ShippingMethod | undefined> {
    const result = await db
      .update(shippingMethods)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(shippingMethods.id, id), eq(shippingMethods.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteShippingMethod(id: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(shippingMethods)
      .where(and(eq(shippingMethods.id, id), eq(shippingMethods.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }

  // Shipping carrier credentials methods
  async getCarrierCredentials(websiteId: string): Promise<ShippingCarrierCredentials[]> {
    return db.select().from(shippingCarrierCredentials).where(eq(shippingCarrierCredentials.websiteId, websiteId));
  }

  async getCarrierCredential(id: string, websiteId: string): Promise<ShippingCarrierCredentials | undefined> {
    const result = await db.select().from(shippingCarrierCredentials)
      .where(and(eq(shippingCarrierCredentials.id, id), eq(shippingCarrierCredentials.websiteId, websiteId)))
      .limit(1);
    return result[0];
  }

  async createCarrierCredential(credential: InsertShippingCarrierCredentials): Promise<ShippingCarrierCredentials> {
    const result = await db.insert(shippingCarrierCredentials).values(credential as any).returning();
    return result[0];
  }

  async updateCarrierCredential(id: string, websiteId: string, data: Partial<InsertShippingCarrierCredentials>): Promise<ShippingCarrierCredentials | undefined> {
    const result = await db
      .update(shippingCarrierCredentials)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(shippingCarrierCredentials.id, id), eq(shippingCarrierCredentials.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteCarrierCredential(id: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(shippingCarrierCredentials)
      .where(and(eq(shippingCarrierCredentials.id, id), eq(shippingCarrierCredentials.websiteId, websiteId)))
      .returning();
    return result.length > 0;
  }

  // Shipping config methods
  async getShippingConfig(websiteId: string): Promise<ShippingConfig | undefined> {
    const result = await db.select().from(shippingConfig).where(eq(shippingConfig.websiteId, websiteId)).limit(1);
    return result[0];
  }

  async createOrUpdateShippingConfig(config: InsertShippingConfig): Promise<ShippingConfig> {
    const existing = await this.getShippingConfig(config.websiteId);
    if (existing) {
      const result = await db
        .update(shippingConfig)
        .set({ ...config, updatedAt: new Date() } as any)
        .where(eq(shippingConfig.websiteId, config.websiteId))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(shippingConfig).values(config as any).returning();
      return result[0];
    }
  }

  // Inventory methods
  async updateProductStock(productId: string, websiteId: string, quantity: number): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set({ stockQuantity: quantity, updatedAt: new Date() } as any)
      .where(and(eq(products.id, productId), eq(products.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async decrementStock(websiteId: string, items: Array<{ productId: string; quantity: number }>): Promise<{ success: boolean; errors?: string[] }> {
    const errors: string[] = [];
    
    for (const item of items) {
      const product = await this.getProduct(item.productId, websiteId);
      if (!product) {
        errors.push(`Product ${item.productId} not found`);
        continue;
      }
      
      if (!product.trackInventory) {
        continue;
      }
      
      if (product.stockQuantity < item.quantity) {
        errors.push(`Insufficient stock for ${product.name}: requested ${item.quantity}, available ${product.stockQuantity}`);
        continue;
      }
      
      await db
        .update(products)
        .set({ 
          stockQuantity: product.stockQuantity - item.quantity,
          updatedAt: new Date() 
        } as any)
        .where(and(eq(products.id, item.productId), eq(products.websiteId, websiteId)));
    }
    
    return { success: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  async checkStockAvailability(websiteId: string, items: Array<{ productId: string; quantity: number }>): Promise<{ available: boolean; outOfStock: Array<{ productId: string; name: string; requested: number; available: number }> }> {
    const outOfStock: Array<{ productId: string; name: string; requested: number; available: number }> = [];
    
    for (const item of items) {
      const product = await this.getProduct(item.productId, websiteId);
      if (!product) {
        outOfStock.push({ productId: item.productId, name: 'Unknown product', requested: item.quantity, available: 0 });
        continue;
      }
      
      if (!product.trackInventory) {
        continue;
      }
      
      if (product.stockQuantity < item.quantity) {
        outOfStock.push({ 
          productId: item.productId, 
          name: product.name, 
          requested: item.quantity, 
          available: product.stockQuantity 
        });
      }
    }
    
    return { available: outOfStock.length === 0, outOfStock };
  }

  async decrementProductStock(productId: string, quantity: number): Promise<void> {
    const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    const product = result[0];
    
    if (!product) {
      console.warn(`Product ${productId} not found for stock decrement`);
      return;
    }
    
    if (!product.trackInventory) {
      return;
    }
    
    const newQuantity = Math.max(0, product.stockQuantity - quantity);
    await db
      .update(products)
      .set({ stockQuantity: newQuantity, updatedAt: new Date() } as any)
      .where(eq(products.id, productId));
  }

  // Payment settings methods
  async getPaymentSettings(websiteId: string): Promise<WebsitePaymentSettings | undefined> {
    const result = await db.select().from(websitePaymentSettings).where(eq(websitePaymentSettings.websiteId, websiteId)).limit(1);
    if (!result[0]) return undefined;
    
    // Decrypt sensitive fields
    const settings = result[0];
    return {
      ...settings,
      stripeSecretKey: settings.stripeSecretKey ? decrypt(settings.stripeSecretKey) : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? decrypt(settings.stripeWebhookSecret) : null,
    };
  }

  async createPaymentSettings(settings: InsertWebsitePaymentSettings): Promise<WebsitePaymentSettings> {
    // Encrypt sensitive fields before storing
    const encryptedSettings = {
      ...settings,
      stripeSecretKey: settings.stripeSecretKey ? encrypt(settings.stripeSecretKey) : null,
      stripeWebhookSecret: settings.stripeWebhookSecret ? encrypt(settings.stripeWebhookSecret) : null,
    };
    const result = await db.insert(websitePaymentSettings).values(encryptedSettings).returning();
    return {
      ...result[0],
      stripeSecretKey: settings.stripeSecretKey || null,
      stripeWebhookSecret: settings.stripeWebhookSecret || null,
    };
  }

  async updatePaymentSettings(websiteId: string, data: Partial<InsertWebsitePaymentSettings>): Promise<WebsitePaymentSettings | undefined> {
    // Encrypt sensitive fields if provided
    const encryptedData: Partial<InsertWebsitePaymentSettings> = { ...data };
    if (data.stripeSecretKey !== undefined) {
      encryptedData.stripeSecretKey = data.stripeSecretKey ? encrypt(data.stripeSecretKey) : null;
    }
    if (data.stripeWebhookSecret !== undefined) {
      encryptedData.stripeWebhookSecret = data.stripeWebhookSecret ? encrypt(data.stripeWebhookSecret) : null;
    }
    
    const result = await db
      .update(websitePaymentSettings)
      .set({ ...encryptedData, updatedAt: new Date() })
      .where(eq(websitePaymentSettings.websiteId, websiteId))
      .returning();
    
    if (!result[0]) return undefined;
    
    return {
      ...result[0],
      stripeSecretKey: data.stripeSecretKey !== undefined ? data.stripeSecretKey : (result[0].stripeSecretKey ? decrypt(result[0].stripeSecretKey) : null),
      stripeWebhookSecret: data.stripeWebhookSecret !== undefined ? data.stripeWebhookSecret : (result[0].stripeWebhookSecret ? decrypt(result[0].stripeWebhookSecret) : null),
    };
  }

  // Analytics methods
  // Storage-level PII sanitization ensures no personal data reaches the database
  // Uses centralized sanitizeAnalyticsEventData from shared schema
  async createAnalyticsEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const sanitizedEvent = {
      ...event,
      eventData: sanitizeAnalyticsEventData(event.eventData),
    };
    
    const result = await db.insert(analyticsEvents).values(sanitizedEvent as any).returning();
    return result[0];
  }

  async getAnalyticsOverview(websiteId: string, startDate: Date, endDate: Date): Promise<AnalyticsOverview> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          sql`${analyticsEvents.timestamp} <= ${endDate}`
        )
      );

    const pageViews = events.filter(e => e.eventType === 'page_view').length;
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
    const orderEvents = events.filter(e => e.eventType === 'order_created');
    const totalOrders = orderEvents.length;
    const totalRevenue = orderEvents.reduce((sum, e) => sum + (e.eventData?.orderTotal || 0), 0);
    const bookingEvents = events.filter(e => e.eventType === 'booking_created');
    const totalBookings = bookingEvents.length;

    const sessionsWithPageView = new Set(events.filter(e => e.eventType === 'page_view').map(e => e.sessionId)).size;
    const sessionsWithOrder = new Set(orderEvents.map(e => e.sessionId)).size;
    const conversionRate = sessionsWithPageView > 0 ? (sessionsWithOrder / sessionsWithPageView) * 100 : 0;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalPageViews: pageViews,
      uniqueSessions,
      totalOrders,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue),
      totalBookings,
    };
  }

  async getAnalyticsFunnel(websiteId: string, startDate: Date, endDate: Date): Promise<FunnelStep[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          sql`${analyticsEvents.timestamp} <= ${endDate}`
        )
      );

    const funnelSteps = ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'order_created'];
    const stepNames = ['Page Views', 'Product Views', 'Add to Cart', 'Checkout Started', 'Orders Completed'];

    const sessionsByStep: Record<string, Set<string>> = {};
    funnelSteps.forEach(step => {
      sessionsByStep[step] = new Set(
        events.filter(e => e.eventType === step).map(e => e.sessionId)
      );
    });

    const baseCount = sessionsByStep['page_view'].size || 1;
    
    return funnelSteps.map((step, index) => {
      const currentCount = sessionsByStep[step].size;
      const previousCount = index > 0 ? sessionsByStep[funnelSteps[index - 1]].size : currentCount;
      const dropoff = previousCount > 0 ? Math.round(((previousCount - currentCount) / previousCount) * 100) : 0;
      
      return {
        name: stepNames[index],
        count: currentCount,
        percentage: Math.round((currentCount / baseCount) * 100),
        dropoff: index === 0 ? 0 : dropoff,
      };
    });
  }

  async getTrafficSources(websiteId: string, startDate: Date, endDate: Date): Promise<TrafficSource[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          sql`${analyticsEvents.timestamp} <= ${endDate}`
        )
      );

    const sourceMap: Record<string, { sessions: Set<string>; pageViews: number; conversions: number }> = {};
    
    events.forEach(event => {
      const source = event.trafficSource || 'direct';
      if (!sourceMap[source]) {
        sourceMap[source] = { sessions: new Set(), pageViews: 0, conversions: 0 };
      }
      sourceMap[source].sessions.add(event.sessionId);
      if (event.eventType === 'page_view') {
        sourceMap[source].pageViews++;
      }
      if (event.eventType === 'order_created' || event.eventType === 'booking_created') {
        sourceMap[source].conversions++;
      }
    });

    return Object.entries(sourceMap).map(([source, data]) => ({
      source,
      sessions: data.sessions.size,
      pageViews: data.pageViews,
      conversions: data.conversions,
      conversionRate: data.sessions.size > 0 ? Math.round((data.conversions / data.sessions.size) * 10000) / 100 : 0,
    })).sort((a, b) => b.sessions - a.sessions);
  }

  async getTopPages(websiteId: string, startDate: Date, endDate: Date): Promise<TopPage[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          eq(analyticsEvents.eventType, 'page_view'),
          gte(analyticsEvents.timestamp, startDate),
          sql`${analyticsEvents.timestamp} <= ${endDate}`
        )
      );

    const pageMap: Record<string, { views: number; sessions: Set<string> }> = {};
    
    events.forEach(event => {
      const path = event.eventData?.path || event.pageUrl || '/';
      if (!pageMap[path]) {
        pageMap[path] = { views: 0, sessions: new Set() };
      }
      pageMap[path].views++;
      pageMap[path].sessions.add(event.sessionId);
    });

    return Object.entries(pageMap)
      .map(([path, data]) => ({
        path,
        pageViews: data.views,
        uniqueVisitors: data.sessions.size,
      }))
      .sort((a, b) => b.pageViews - a.pageViews)
      .slice(0, 10);
  }

  // Billing methods
  async createBillingLead(lead: InsertBillingLead): Promise<BillingLead> {
    const result = await db.insert(billingLeads).values(lead).returning();
    return result[0];
  }

  // Email settings methods
  async getEmailSettings(websiteId: string): Promise<EmailSettings | undefined> {
    const result = await db.select().from(emailSettings).where(eq(emailSettings.websiteId, websiteId)).limit(1);
    return result[0];
  }

  async createEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const result = await db.insert(emailSettings).values(settings).returning();
    return result[0];
  }

  async updateEmailSettings(websiteId: string, data: Partial<InsertEmailSettings>): Promise<EmailSettings | undefined> {
    const result = await db.update(emailSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailSettings.websiteId, websiteId))
      .returning();
    return result[0];
  }

  // Email templates methods
  async getEmailTemplates(websiteId: string): Promise<EmailTemplate[]> {
    return await db.select().from(emailTemplates).where(eq(emailTemplates.websiteId, websiteId));
  }

  async getEmailTemplate(websiteId: string, templateType: string): Promise<EmailTemplate | undefined> {
    const result = await db.select().from(emailTemplates)
      .where(and(eq(emailTemplates.websiteId, websiteId), eq(emailTemplates.templateType, templateType)))
      .limit(1);
    return result[0];
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const result = await db.insert(emailTemplates).values(template).returning();
    return result[0];
  }

  async updateEmailTemplate(id: string, websiteId: string, data: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const result = await db.update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  // Public stats methods
  async getPublicStats(): Promise<{ totalCreators: number }> {
    const result = await db.select().from(publicStats).limit(1);
    if (result.length === 0) {
      return { totalCreators: 0 };
    }
    return { totalCreators: result[0].totalCreators };
  }

  async incrementTotalCreators(): Promise<void> {
    // Upsert: if row exists, increment; if not, insert with initial value of 1
    await db.execute(sql`
      INSERT INTO public_stats (id, total_creators, updated_at)
      VALUES (1, 1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        total_creators = public_stats.total_creators + 1,
        updated_at = NOW()
    `);
  }

  // Profile onboarding methods
  async completeOnboarding(userId: string): Promise<Profile | undefined> {
    const result = await db.update(profiles)
      .set({ onboardingCompleted: true })
      .where(eq(profiles.id, userId))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
