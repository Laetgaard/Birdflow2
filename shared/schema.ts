import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const publicStats = pgTable("public_stats", {
  id: serial("id").primaryKey(),
  totalCreators: integer("total_creators").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PublicStats = typeof publicStats.$inferSelect;

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  onboardingCompleted: true,
  createdAt: true,
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// Website plans
export type WebsitePlan = 'free' | 'starter' | 'professional' | 'enterprise';

// Websites table
export const websites = pgTable("websites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  status: text("status").notNull().default("draft"),
  setupType: text("setup_type").notNull(),
  deploymentUrl: text("deployment_url"),
  deploymentId: text("deployment_id"),
  lastPublishedAt: timestamp("last_published_at"),
  // Billing fields
  plan: text("plan").default("free").notNull(), // free, starter, professional, enterprise
  planExpiresAt: timestamp("plan_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsiteSchema = createInsertSchema(websites).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsite = z.infer<typeof insertWebsiteSchema>;
export type Website = typeof websites.$inferSelect;

// Website inputs table (for customized setup data)
export const websiteInputs = pgTable("website_inputs", {
  id: serial("id").primaryKey(),
  websiteId: varchar("website_id").notNull(),
  businessDescription: text("business_description"),
  pages: jsonb("pages").$type<Array<{ name: string; description: string; images: string[] }>>(),
  features: jsonb("features").$type<string[]>(),
  designPreset: text("design_preset"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsiteInputsSchema = createInsertSchema(websiteInputs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsiteInputs = z.infer<typeof insertWebsiteInputsSchema>;
export type WebsiteInputs = typeof websiteInputs.$inferSelect;

// Builder component types - re-exported from componentRegistry for consistency
export type { 
  ComponentType,
  BuilderComponentData as BuilderComponent,
  ComponentProps,
  ComponentStyles,
  ComponentItem,
} from './componentRegistry';

export type BuilderPage = {
  id: string;
  name: string;
  path: string;
  components: import('./componentRegistry').BuilderComponentData[];
};

export type MediaReference = {
  mediaId: string;
  cropOverride?: { x: number; y: number; width: number; height: number };
};

export type BookingAvailability = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type BookingConfig = {
  enabled: boolean;
  timezone?: string;
  services: Array<{
    id: string;
    name: string;
    description?: string;
    durationMinutes: number;
    price: string;
    currency: string;
  }>;
  availability: BookingAvailability[];
  formFields?: Array<{
    id: string;
    label: string;
    type: 'text' | 'email' | 'phone' | 'textarea';
    required: boolean;
  }>;
};

export type CheckoutConfig = {
  enabled: boolean;
  defaultCurrency: 'USD' | 'EUR' | 'DKK';
  successUrl?: string;
  cancelUrl?: string;
  collectShipping?: boolean;
  collectPhone?: boolean;
};

export type ProductGridConfig = {
  mode: 'all' | 'curated';
  curatedProductIds?: string[];
  columns?: number;
  limit?: number;
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    backgroundColor: string;
  };
  media?: MediaReference[];
  bookingConfig?: BookingConfig;
  checkoutConfig?: CheckoutConfig;
  productGridConfig?: ProductGridConfig;
};

// Builder state table
export const builderState = pgTable("builder_state", {
  id: serial("id").primaryKey(),
  websiteId: varchar("website_id").notNull().unique(),
  state: jsonb("state").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Manual insert schema to avoid circular reference issues with nested types
export const insertBuilderStateSchema = z.object({
  websiteId: z.string(),
  state: z.any(),
});

export type InsertBuilderState = {
  websiteId: string;
  state: BuilderStateData;
};

export type BuilderState = {
  id: number;
  websiteId: string;
  state: BuilderStateData;
  createdAt: Date;
  updatedAt: Date;
};

// Orders table (for ecommerce)
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  total: text("total").notNull().default("0"),
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  subtotalCents: integer("subtotal_cents").notNull().default(0),
  shippingCostCents: integer("shipping_cost_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  items: jsonb("items").$type<Array<{ id: string; name: string; quantity: number; price: number; priceCents: number }>>(),
  shippingAddress: jsonb("shipping_address").$type<{ street: string; city: string; state: string; zip: string; country: string }>(),
  shippingMethodId: varchar("shipping_method_id"),
  shippingName: text("shipping_name"),
  shippingPrice: text("shipping_price"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

// Order items table (normalized order line items)
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  websiteId: varchar("website_id").notNull(),
  productId: varchar("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceAtPurchase: text("price_at_purchase").notNull(),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
  createdAt: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Bookings table (for appointments/services)
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  serviceId: varchar("service_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  service: text("service").notNull(),
  date: timestamp("date").notNull(),
  time: text("time"),
  duration: text("duration"),
  durationMinutes: integer("duration_minutes"),
  price: text("price"),
  currency: text("currency").default("USD"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookings.$inferSelect;

// Form submissions table
export const formSubmissions = pgTable("form_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  formName: text("form_name").notNull(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  read: text("read").notNull().default("false"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFormSubmissionSchema = createInsertSchema(formSubmissions).omit({
  id: true,
  createdAt: true,
});

export type InsertFormSubmission = z.infer<typeof insertFormSubmissionSchema>;
export type FormSubmission = typeof formSubmissions.$inferSelect;

// Customers table
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  totalOrders: text("total_orders").notNull().default("0"),
  totalSpent: text("total_spent").notNull().default("0"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Products table (for product catalog)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  price: text("price").notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  imageUrl: text("image_url"),
  images: text("images").array(),
  status: text("status").notNull().default("active"),
  inventory: text("inventory"),
  category: text("category"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  trackInventory: boolean("track_inventory").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Media assets table
export const mediaAssets = pgTable("media_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  crop: jsonb("crop").$type<{ x: number; y: number; width: number; height: number } | null>(),
  altText: text("alt_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMediaAssetSchema = createInsertSchema(mediaAssets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertMediaAsset = z.infer<typeof insertMediaAssetSchema>;
export type MediaAsset = typeof mediaAssets.$inferSelect;

// Booking services table
export const bookingServices = pgTable("booking_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  price: text("price").notNull().default("0"),
  currency: text("currency").notNull().default("USD"),
  active: text("active").notNull().default("true"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingServiceSchema = createInsertSchema(bookingServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBookingService = z.infer<typeof insertBookingServiceSchema>;
export type BookingService = typeof bookingServices.$inferSelect;

// Custom domains table - simplified flow using Vercel for verification
export const customDomains = pgTable("custom_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  domain: text("domain").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | verifying | active | error
  vercelProjectId: text("vercel_project_id"),
  // Store the single DNS record users need to add (from Vercel response)
  dnsType: text("dns_type"), // CNAME or A
  dnsName: text("dns_name"), // the record name (e.g., "www" or "@")
  dnsValue: text("dns_value"), // the target (e.g., "cname.vercel-dns.com")
  errorMessage: text("error_message"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomDomainSchema = createInsertSchema(customDomains).omit({
  id: true,
  verifiedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomDomain = z.infer<typeof insertCustomDomainSchema>;
export type CustomDomain = typeof customDomains.$inferSelect;

export type DomainStatus = 'pending' | 'verifying' | 'active' | 'error';

// Shipping methods table (for ecommerce delivery options)
export const shippingMethods = pgTable("shipping_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceAmount: integer("price_amount").notNull().default(0), // Price in minor units (cents)
  currency: text("currency").notNull().default("USD"),
  deliveryTime: text("delivery_time"), // e.g., "3-5 business days"
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShippingMethodSchema = createInsertSchema(shippingMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShippingMethod = z.infer<typeof insertShippingMethodSchema>;
export type ShippingMethod = typeof shippingMethods.$inferSelect;

// Shipping carrier credentials table (for live carrier rate integrations)
export const shippingCarrierCredentials = pgTable("shipping_carrier_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  carrier: text("carrier").notNull(), // 'ups', 'gls', 'postnord'
  credentials: jsonb("credentials").$type<Record<string, string>>().notNull(), // Encrypted credentials
  isActive: boolean("is_active").notNull().default(true),
  testMode: boolean("test_mode").notNull().default(true), // Use sandbox/test API
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShippingCarrierCredentialsSchema = createInsertSchema(shippingCarrierCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShippingCarrierCredentials = z.infer<typeof insertShippingCarrierCredentialsSchema>;
export type ShippingCarrierCredentials = typeof shippingCarrierCredentials.$inferSelect;

// Shipping configuration for a website
export const shippingConfig = pgTable("shipping_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull().unique(),
  mode: text("mode").notNull().default("manual"), // 'manual' or 'live'
  defaultWeight: integer("default_weight").default(1000), // Default package weight in grams
  defaultDimensions: jsonb("default_dimensions").$type<{ length: number; width: number; height: number }>(),
  originAddress: jsonb("origin_address").$type<{
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertShippingConfigSchema = createInsertSchema(shippingConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertShippingConfig = z.infer<typeof insertShippingConfigSchema>;
export type ShippingConfig = typeof shippingConfig.$inferSelect;

// Carrier types
export type CarrierType = 'ups' | 'gls' | 'postnord';

// Website payment settings (Stripe integration)
export const websitePaymentSettings = pgTable("website_payment_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull().unique(),
  stripePublishableKey: text("stripe_publishable_key"),
  stripeSecretKey: text("stripe_secret_key"), // Stored encrypted
  stripeWebhookSecret: text("stripe_webhook_secret"), // Stored encrypted
  testMode: boolean("test_mode").notNull().default(true),
  isConnected: boolean("is_connected").notNull().default(false),
  connectedAt: timestamp("connected_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWebsitePaymentSettingsSchema = createInsertSchema(websitePaymentSettings).omit({
  id: true,
  connectedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWebsitePaymentSettings = z.infer<typeof insertWebsitePaymentSettingsSchema>;
export type WebsitePaymentSettings = typeof websitePaymentSettings.$inferSelect;

export type ShippingRateRequest = {
  destinationAddress: {
    street?: string;
    city?: string;
    postalCode: string;
    country: string;
  };
  packages: Array<{
    weight: number; // grams
    dimensions?: { length: number; width: number; height: number }; // cm
  }>;
};

export type ShippingRate = {
  carrierId: string;
  carrierName: string;
  serviceName: string;
  serviceCode: string;
  price: number; // cents
  currency: string;
  deliveryTime?: string;
  estimatedDeliveryDate?: string;
};

// Email settings table (per website)
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull().unique(),
  // Toggle for each email type
  orderConfirmationEnabled: boolean("order_confirmation_enabled").default(true).notNull(),
  bookingConfirmationEnabled: boolean("booking_confirmation_enabled").default(true).notNull(),
  bookingUpdatedEnabled: boolean("booking_updated_enabled").default(true).notNull(),
  bookingCancelledEnabled: boolean("booking_cancelled_enabled").default(true).notNull(),
  // Branding
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#6366f1"),
  footerText: text("footer_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// Email templates table (per website, per email type)
export type EmailTemplateType = 'order_confirmation' | 'booking_confirmation' | 'booking_updated' | 'booking_cancelled';

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  templateType: text("template_type").notNull(), // order_confirmation, booking_confirmation, etc
  subject: text("subject").notNull(),
  heading: text("heading").notNull(),
  bodyText: text("body_text").notNull(),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Cookie consent settings (per website)
export const cookieSettings = pgTable("cookie_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull().unique(),
  enabled: boolean("enabled").default(true).notNull(),
  bannerText: text("banner_text").default("We use cookies to improve your experience and analyze site traffic."),
  privacyPolicyUrl: text("privacy_policy_url"),
  acceptButtonText: text("accept_button_text").default("Accept"),
  rejectButtonText: text("reject_button_text").default("Reject"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCookieSettingsSchema = createInsertSchema(cookieSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCookieSettings = z.infer<typeof insertCookieSettingsSchema>;
export type CookieSettings = typeof cookieSettings.$inferSelect;

// Billing leads (contact requests for upgrades)
export const billingLeads = pgTable("billing_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  company: text("company"),
  plan: text("plan").notNull(), // starter, professional, enterprise
  message: text("message"),
  status: text("status").default("pending").notNull(), // pending, contacted, converted
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBillingLeadSchema = createInsertSchema(billingLeads).omit({
  id: true,
  createdAt: true,
});

export type InsertBillingLead = z.infer<typeof insertBillingLeadSchema>;
export type BillingLead = typeof billingLeads.$inferSelect;

// Analytics events table - privacy-first design (no personal data stored)
// IMPORTANT: Only anonymous, non-PII data is stored. No emails, names, phones, or IPs.
export const analyticsEvents = pgTable("analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  sessionId: varchar("session_id").notNull(), // Anonymous session identifier (not user ID)
  eventType: text("event_type").notNull(), // page_view, product_view, add_to_cart, checkout_start, order_created, booking_created
  eventData: jsonb("event_data").$type<{
    // Only non-PII fields allowed - server validates and sanitizes input
    path?: string;
    productId?: string;
    orderId?: string;
    orderTotal?: number; // Cents, no customer info
    bookingId?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  }>(),
  pageUrl: text("page_url"),
  trafficSource: text("traffic_source"), // direct, google, facebook, etc (not full referrer URL)
  deviceType: text("device_type"), // desktop, mobile, tablet
  country: text("country"), // ISO country code only, derived from IP but IP not stored
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({
  id: true,
  timestamp: true,
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;

// Centralized whitelist of allowed eventData fields for privacy compliance
// Used by both API route and storage layer to ensure no PII reaches the database
export const ANALYTICS_ALLOWED_EVENT_DATA_FIELDS = [
  'path',
  'productId', 
  'orderId',
  'orderTotal',
  'bookingId',
  'utm_source',
  'utm_medium',
  'utm_campaign'
] as const;

export type AnalyticsEventDataField = typeof ANALYTICS_ALLOWED_EVENT_DATA_FIELDS[number];

// Helper function to sanitize eventData - used by both routes and storage
export function sanitizeAnalyticsEventData(eventData: unknown): Record<string, unknown> | null {
  if (!eventData || typeof eventData !== 'object') {
    return null;
  }
  
  const sanitized: Record<string, unknown> = {};
  for (const field of ANALYTICS_ALLOWED_EVENT_DATA_FIELDS) {
    const value = (eventData as Record<string, unknown>)[field];
    if (value !== undefined) {
      sanitized[field] = value;
    }
  }
  
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// Analytics event types
export type AnalyticsEventType = 
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'order_created'
  | 'booking_created';

// Analytics aggregated data types
export type AnalyticsOverview = {
  totalPageViews: number;
  uniqueSessions: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  totalBookings: number;
};

export type FunnelStep = {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
};

export type TrafficSource = {
  source: string;
  sessions: number;
  pageViews: number;
  conversions: number;
  conversionRate: number;
};

export type TopPage = {
  path: string;
  pageViews: number;
  uniqueVisitors: number;
  avgTimeOnPage?: number;
  bounceRate?: number;
};

export type CustomerJourney = {
  entryPage: string;
  exitPage: string;
  journeyLength: number;
  converted: boolean;
  count: number;
};

export * from "./models/chat";
