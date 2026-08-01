import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, serial, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { CustomComponentEntry, BrandGuide } from "./customComponents";

export type { CustomComponentEntry, BrandGuide } from "./customComponents";

// Platform subscription plans
export type PlatformPlanSlug = 'basic' | 'starter' | 'professional';

export const PLATFORM_PLANS = {
  basic: {
    slug: 'basic' as const,
    name: 'Basic',
    priceMonthlyDKK: 69,
    stripePriceAmount: 6900, // DKK minor units
    maxWebsites: 1,
    maxPagesPerWebsite: 4,
    storageGB: 2,
    features: {
      customDomain: true,
      automaticEmail: true,
      booking: false,
      webshop: false,
    },
    trialDays: 0,
  },
  starter: {
    slug: 'starter' as const,
    name: 'Starter',
    priceMonthlyDKK: 149,
    stripePriceAmount: 14900,
    maxWebsites: 1,
    maxPagesPerWebsite: 5,
    storageGB: 4,
    features: {
      customDomain: true,
      automaticEmail: true,
      booking: true,
      webshop: false,
    },
    trialDays: 30,
  },
  professional: {
    slug: 'professional' as const,
    name: 'Professional',
    priceMonthlyDKK: 249,
    stripePriceAmount: 24900,
    maxWebsites: 5,
    maxPagesPerWebsite: 20,
    storageGB: 15,
    features: {
      customDomain: true,
      automaticEmail: true,
      booking: true,
      webshop: true,
    },
    trialDays: 30,
  },
} as const;

export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  verifiedOnboardingSubscriptionId: text("verified_onboarding_subscription_id"),
  // Platform subscription fields
  planSlug: text("plan_slug").$type<PlatformPlanSlug>(),
  subscriptionId: text("subscription_id"),
  subscriptionStatus: text("subscription_status"), // active, canceled, past_due, trialing, incomplete, manual
  subscriptionPriceId: text("subscription_price_id"),
  subscriptionStartedAt: timestamp("subscription_started_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  currentPeriodEnd: timestamp("current_period_end"),
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

// Fields a user is allowed to change on their own profile via PATCH /api/profile/:id.
// Deliberately narrow allowlist: isAdmin, planSlug, subscriptionId, subscriptionStatus,
// subscriptionPriceId, stripeCustomerId, verifiedOnboardingSubscriptionId and
// onboardingCompleted are privilege/billing state and must only be set server-side
// (admin tooling, Stripe webhooks, onboarding routes). Email is owned by Supabase Auth -
// changing it here would desync the two. id comes from the authenticated route param,
// never from the body. strict() rejects any unknown or excluded key outright instead
// of silently stripping it.
export const updateProfileSchema = z
  .object({
    fullName: z.string().max(200),
    phoneNumber: z.string().max(50),
  })
  .partial()
  .strict();

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

// User invoices for billing history
export const userInvoices = pgTable("user_invoices", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  stripeInvoiceId: text("stripe_invoice_id").notNull().unique(),
  amountDue: integer("amount_due").notNull(), // in minor units (øre)
  amountPaid: integer("amount_paid").notNull(),
  currency: text("currency").default("dkk").notNull(),
  status: text("status").notNull(), // draft, open, paid, uncollectible, void
  invoiceUrl: text("invoice_url"),
  invoicePdf: text("invoice_pdf"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserInvoiceSchema = createInsertSchema(userInvoices).omit({
  id: true,
  createdAt: true,
});

export type InsertUserInvoice = z.infer<typeof insertUserInvoiceSchema>;
export type UserInvoice = typeof userInvoices.$inferSelect;

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
  // The website's own trading currency, used by every money figure the
  // owner sees in /manage. Orders and products carry their own currency
  // for historical rows; this is the default and the display fallback.
  currency: text("currency").notNull().default("DKK"),
  deploymentUrl: text("deployment_url"),
  deploymentId: text("deployment_id"),
  lastPublishedAt: timestamp("last_published_at"),
  // Billing fields
  plan: text("plan").default("free").notNull(), // free, starter, professional, enterprise
  planExpiresAt: timestamp("plan_expires_at"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  subscriptionStatus: text("subscription_status"), // active, canceled, past_due, trialing
  trialEnd: timestamp("trial_end"),
  currentPeriodEnd: timestamp("current_period_end"),
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

// Present on GET /api/websites/:id responses ONLY when the requester is
// an administrator editing someone else's website. Narrow on purpose:
// just enough for the "editing as administrator" banner - no email, no
// billing state, no credentials. UI state only; authorization always
// happens server-side.
export type WebsiteAdminContext = {
  ownerId: string;
  ownerDisplayName: string;
};

export type WebsiteWithAccess = Website & {
  adminContext?: WebsiteAdminContext;
};

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

// One chat message in the onboarding walkthrough, as stored/restored.
export type OnboardingChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Inline tool cards (palettes, font pairs, upload requests...). */
  displays?: Array<{ kind: string; value: unknown; chosenId?: string }>;
};

// Structured answers the onboarding agent collects. Everything is
// optional until build time; deterministic fields (palette, fontPair,
// uploads) are written by the client via /api/onboarding/session/record,
// never round-tripped through the model.
export type OnboardingAnswers = {
  path?: "ai" | "diy";
  businessName?: string;
  industry?: string;
  description?: string;
  goals?: string[];
  notes?: string;
  feeling?: string;
  palette?: { id: string; name: string; description: string; colors: Record<string, string> };
  fontPair?: { id: string; name: string; heading: string; body: string; scale: string; description: string };
  logoUrl?: string;
  logoMediaId?: string;
  /** True when the logo came from the AI generator, not an upload. */
  logoGenerated?: boolean;
  ownImageUrls?: string[];
  inspirationUrls?: string[];
  /** WebsitePlan the user approved in the design preview (built as-is). */
  plan?: unknown;
  /** Domain the user wants; connected from /manage after payment. */
  desiredDomain?: string;
};

// The onboarding walkthrough's server-side home. The old wizard kept
// everything in localStorage — clear the browser or switch device and
// the answers were gone — and generation status lived in an in-memory
// Map that a redeploy wiped. Both now live here.
export const onboardingSessions = pgTable("onboarding_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  websiteId: varchar("website_id"),
  transcript: jsonb("transcript").$type<OnboardingChatMessage[]>().notNull().default(sql`'[]'::jsonb`),
  answers: jsonb("answers").$type<OnboardingAnswers>().notNull().default(sql`'{}'::jsonb`),
  /** Mirror of the generation job status, written through on each phase. */
  genStatus: jsonb("gen_status").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type OnboardingSession = typeof onboardingSessions.$inferSelect;

// Phased build state for AI Website Architect
export const phasedBuildState = pgTable("phased_build_state", {
  id: serial("id").primaryKey(),
  websiteId: varchar("website_id").notNull().unique(),
  currentPhase: text("current_phase").notNull().default("structure"), // structure, content, styling, polish, complete
  structureData: jsonb("structure_data"),
  contentData: jsonb("content_data"),
  stylingData: jsonb("styling_data"),
  polishData: jsonb("polish_data"),
  designSystem: jsonb("design_system"),
  siteDescription: text("site_description"),
  siteType: text("site_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPhasedBuildStateSchema = createInsertSchema(phasedBuildState).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPhasedBuildState = z.infer<typeof insertPhasedBuildStateSchema>;
export type PhasedBuildState = typeof phasedBuildState.$inferSelect;

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
  hidden?: boolean; // Hidden pages are not shown in navigation but still published
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

export type StylePreset = 'modern' | 'luxury' | 'playful' | 'corporate' | 'minimal' | 'custom';

export type DesignTokens = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  fontFamily: string;
  textColor?: string;
  fontPair?: { heading: string; body: string };
  borderRadius?: string;
  spacingScale?: 'compact' | 'comfortable' | 'spacious';
  sectionGap?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
};

export type BuilderStateData = {
  pages: BuilderPage[];
  activePage: string;
  globalStyles: DesignTokens;
  stylePreset?: StylePreset;
  media?: MediaReference[];
  bookingConfig?: BookingConfig;
  checkoutConfig?: CheckoutConfig;
  productGridConfig?: ProductGridConfig;
  /** Per-website library of reusable components ("Mine komponenter"). */
  customComponents?: CustomComponentEntry[];
  /** Per-website brand guide (drives the Brand tab and AI grounding). */
  brandGuide?: BrandGuide;
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
  // Fulfilment fields set by the owner from the order detail dialog
  deliveryDate: timestamp("delivery_date"), // promised delivery date
  trackingNumber: text("tracking_number"),
  trackingCarrier: text("tracking_carrier"), // e.g. GLS, PostNord, UPS
  shippedEmailSentAt: timestamp("shipped_email_sent_at"),
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
  teamMemberId: varchar("team_member_id"),
  place: text("place"),
  sendReminder: boolean("send_reminder").notNull().default(true),
  reminderSentAt: timestamp("reminder_sent_at"),
  followupSentAt: timestamp("followup_sent_at"),
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

// Customers table. A row is the *identity* of a shopper on one website,
// upserted (websiteId, lower(email)) whenever an order or booking comes
// in. Totals are NOT stored here - the legacy text columns below are
// kept for migration safety but never read or written; real order
// counts and lifetime spend are aggregated from `orders` at read time
// (storage.getCustomersWithStats), so webhook retries and refunds can
// never make a stored counter drift.
export const customers = pgTable(
  "customers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    websiteId: varchar("website_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    /** @deprecated legacy text counter - unused, kept for rollback safety */
    totalOrders: text("total_orders").notNull().default("0"),
    /** @deprecated legacy text counter - unused, kept for rollback safety */
    totalSpent: text("total_spent").notNull().default("0"),
    metadata: jsonb("metadata").$type<Record<string, any>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Backs the identity upsert; lower() so Anna@x.dk and anna@x.dk are
    // one customer.
    uniqueIndex("customers_website_email_idx").on(
      table.websiteId,
      sql`lower(${table.email})`
    ),
  ]
);

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// What the manage Customers section renders: identity plus live
// aggregates computed from orders/bookings at read time.
export type CustomerWithStats = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  /** Paid orders only. */
  ordersCount: number;
  /** Lifetime paid-order revenue, minor units. */
  totalSpentCents: number;
  bookingsCount: number;
  lastActivityAt: string | null;
};

// Product variant types
export type ProductVariantOption = {
  id: string;
  name: string;
  priceAdjustment: number; // Can be positive or negative
  stockQuantity?: number;
  sku?: string;
};

export type ProductVariant = {
  id: string;
  name: string; // e.g., "Size", "Color"
  options: ProductVariantOption[];
};

// Products table (for product catalog)
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  productDetails: text("product_details"),
  careInstructions: text("care_instructions"),
  sizeGuide: text("size_guide"),
  shippingInfo: text("shipping_info"),
  price: text("price").notNull().default("0"),
  compareAtPrice: text("compare_at_price"),
  currency: text("currency").notNull().default("USD"),
  imageUrl: text("image_url"),
  images: text("images").array(),
  status: text("status").notNull().default("active"),
  inventory: text("inventory"),
  category: text("category"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  trackInventory: boolean("track_inventory").notNull().default(false),
  variants: jsonb("variants").$type<ProductVariant[]>(),
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

// Product reviews table
export const productReviews = pgTable("product_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  rating: integer("rating").notNull(),
  text: text("text"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProductReviewSchema = createInsertSchema(productReviews).omit({
  id: true,
  createdAt: true,
});

export type InsertProductReview = z.infer<typeof insertProductReviewSchema>;
export type ProductReview = typeof productReviews.$inferSelect;

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

// Service availability - defines available time slots per service
export const serviceAvailability = pgTable("service_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull(),
  websiteId: varchar("website_id").notNull(),
  dayOfWeek: integer("day_of_week"), // 0 = Sunday, 1 = Monday, etc. (null for specific date)
  specificDate: text("specific_date"), // YYYY-MM-DD format for specific date availability
  startTime: text("start_time").notNull(), // HH:MM format (e.g., "09:00")
  endTime: text("end_time").notNull(), // HH:MM format (e.g., "17:00")
  slotDurationMinutes: integer("slot_duration_minutes"), // Override service duration if set
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceAvailabilitySchema = createInsertSchema(serviceAvailability).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceAvailability = z.infer<typeof insertServiceAvailabilitySchema>;
export type ServiceAvailability = typeof serviceAvailability.$inferSelect;

// Blocked dates for booking services - specific dates when service is unavailable
export const serviceBlockedDates = pgTable("service_blocked_dates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull(),
  websiteId: varchar("website_id").notNull(),
  blockedDate: text("blocked_date").notNull(), // YYYY-MM-DD format
  reason: text("reason"), // Optional reason (e.g., "Holiday", "Vacation", "Fully booked")
  isRecurringYearly: boolean("is_recurring_yearly").notNull().default(false), // If true, blocks same date every year
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceBlockedDateSchema = createInsertSchema(serviceBlockedDates).omit({
  id: true,
  createdAt: true,
});

export type InsertServiceBlockedDate = z.infer<typeof insertServiceBlockedDateSchema>;
export type ServiceBlockedDate = typeof serviceBlockedDates.$inferSelect;

// Service date ranges - when a service is available (overall active period)
export const serviceDateRanges = pgTable("service_date_ranges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull(),
  websiteId: varchar("website_id").notNull(),
  startDate: text("start_date").notNull(), // YYYY-MM-DD format - service available from
  endDate: text("end_date"), // YYYY-MM-DD format - service available until (null = no end)
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceDateRangeSchema = createInsertSchema(serviceDateRanges).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertServiceDateRange = z.infer<typeof insertServiceDateRangeSchema>;
export type ServiceDateRange = typeof serviceDateRanges.$inferSelect;

// Weekly availability window for a team member (kept in jsonb)
export type TeamMemberAvailabilityWindow = {
  dayOfWeek: number; // 0 = Sunday ... 6 = Saturday
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
};

// Booking team members - people who perform booking services
export const bookingTeamMembers = pgTable("booking_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  name: text("name").notNull(),
  role: text("role"), // e.g. "Frisør", "Massør"
  email: text("email"),
  phone: text("phone"),
  color: text("color").notNull().default("#6366f1"), // calendar color
  // Service ids this member performs; empty array = performs all services
  serviceIds: jsonb("service_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // Weekly availability windows; empty array = always available (follows service availability)
  availability: jsonb("availability").$type<TeamMemberAvailabilityWindow[]>().notNull().default(sql`'[]'::jsonb`),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingTeamMemberSchema = createInsertSchema(bookingTeamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBookingTeamMember = z.infer<typeof insertBookingTeamMemberSchema>;
export type BookingTeamMember = typeof bookingTeamMembers.$inferSelect;

// Open slots - owner-placed bookable time slots that visitors can claim
export const bookingOpenSlots = pgTable("booking_open_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  serviceId: varchar("service_id"), // null = any service may claim the slot
  teamMemberId: varchar("team_member_id"), // null = no specific person
  date: text("date").notNull(), // YYYY-MM-DD
  time: text("time").notNull(), // HH:MM
  durationMinutes: integer("duration_minutes").notNull().default(30),
  status: text("status").notNull().default("open"), // open | booked
  bookingId: varchar("booking_id"), // set when claimed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBookingOpenSlotSchema = createInsertSchema(bookingOpenSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBookingOpenSlot = z.infer<typeof insertBookingOpenSlotSchema>;
export type BookingOpenSlot = typeof bookingOpenSlots.$inferSelect;

// A single DNS record the user must (or should) create at their DNS
// provider to connect a custom domain. Always sourced from Vercel's API,
// never invented locally.
export type DnsInstruction = {
  type: string; // A | CNAME | TXT
  name: string; // record host, e.g. "@", "www", "_vercel"
  value: string;
  // routing = points the host at Vercel; ownership = TXT challenge required
  // because the domain is claimed by another Vercel account; counterpart =
  // record for the automatically attached www/apex twin (recommended).
  purpose: "routing" | "ownership" | "counterpart";
  required: boolean;
};

// Custom domains table - status must always reflect Vercel truth:
//   pending   = waiting for the user's DNS changes (or ownership TXT)
//   verifying = Vercel sees correct DNS; certificate/edge activation pending
//   active    = domain actually serves the site (verified end to end)
//   error     = Vercel rejected the domain
export const customDomains = pgTable("custom_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull(),
  domain: text("domain").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | verifying | active | error
  vercelProjectId: text("vercel_project_id"),
  // Legacy single-record fields (kept for older rows/clients); the full,
  // Vercel-sourced list lives in dnsRecords.
  dnsType: text("dns_type"), // CNAME or A
  dnsName: text("dns_name"), // the record name (e.g., "www" or "@")
  dnsValue: text("dns_value"), // the target (e.g., "cname.vercel-dns.com")
  // All DNS records Vercel currently requires/recommends for this domain.
  dnsRecords: jsonb("dns_records").$type<DnsInstruction[]>(),
  errorMessage: text("error_message"),
  verifiedAt: timestamp("verified_at"),
  // When the server-side verification loop last checked this domain.
  lastCheckedAt: timestamp("last_checked_at"),
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
  stripeAccountId: text("stripe_account_id"), // Connected Stripe account ID (acct_xxx)
  stripeConnectStatus: text("stripe_connect_status").notNull().default("not_connected"), // 'not_connected' | 'connected'
  stripePublishableKey: text("stripe_publishable_key"), // Keep for backwards compatibility, will be deprecated
  stripeSecretKey: text("stripe_secret_key"), // Keep for backwards compatibility, will be deprecated
  stripeWebhookSecret: text("stripe_webhook_secret"), // Keep for backwards compatibility, will be deprecated
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
  shippingConfirmationEnabled: boolean("shipping_confirmation_enabled").default(true).notNull(),
  welcomeEmailEnabled: boolean("welcome_email_enabled").default(true).notNull(),
  abandonedCartEnabled: boolean("abandoned_cart_enabled").default(true).notNull(),
  newSubmissionEnabled: boolean("new_submission_enabled").default(true).notNull(),
  refundConfirmationEnabled: boolean("refund_confirmation_enabled").default(true).notNull(),
  // Booking automation emails
  bookingReminderEnabled: boolean("booking_reminder_enabled").default(true).notNull(),
  bookingReminderLeadHours: integer("booking_reminder_lead_hours").default(48).notNull(),
  bookingFollowupEnabled: boolean("booking_followup_enabled").default(false).notNull(),
  bookingFollowupDelayHours: integer("booking_followup_delay_hours").default(24).notNull(),
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
export type EmailTemplateType = 'order_confirmation' | 'order_shipped' | 'booking_confirmation' | 'booking_updated' | 'booking_cancelled' | 'booking_reminder' | 'booking_followup';

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
  'utm_campaign',
  // Time-on-page beacon payload (seconds, clamped server-side)
  'durationSeconds'
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
  | 'page_time'
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
  // Average visit duration in seconds ("besøgstid"), from page_time beacons.
  // 0 when no beacons exist yet (older deployed sites don't send them).
  avgVisitDurationSeconds: number;
  // The website's trading currency (websites.currency) so revenue KPIs
  // render with the right symbol instead of a hardcoded one.
  currency: string;
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
  // Mean page_time beacon for this path, seconds. 0 = no beacons yet.
  avgTimeOnPage: number;
};

// Daily visits series point (dates are YYYY-MM-DD in Europe/Copenhagen)
export type AnalyticsTimeseriesPoint = {
  date: string;
  pageViews: number;
  visitors: number;
};

// Visitors per country over a period (country = ISO 3166-1 alpha-2 or null/unknown)
export type CountryVisitors = {
  country: string | null;
  visitors: number;
  pageViews: number;
};

// Visitors per device class (deviceType is set on every tracked event:
// desktop | mobile | tablet, null on very old rows)
export type DeviceBreakdown = {
  device: string | null;
  visitors: number;
  pageViews: number;
};

// Live visitors = distinct sessions with events in the last few minutes
export type LiveVisitorStats = {
  activeVisitors: number;
  byCountry: Array<{ country: string | null; visitors: number }>;
};

// Aggregated numbers for the manage Overview home
export type ManageOverview = {
  todayBookings: number;
  upcomingBookings: Array<{
    id: string;
    customerName: string;
    service: string;
    date: string;
    time: string | null;
    status: string;
  }>;
  newOrdersToday: number;
  pendingOrders: number;
  revenueTodayCents: number;
  revenue30dCents: number;
  currency: string;
  unreadSubmissions: number;
  totalCustomers: number;
  activeVisitors: number;
  visitors7d: number;
  pageViews7d: number;
  recentOrders: Array<{
    id: string;
    customerName: string;
    totalAmountCents: number;
    currency: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
};

export type CustomerJourney = {
  entryPage: string;
  exitPage: string;
  journeyLength: number;
  converted: boolean;
  count: number;
};

// Admin dashboard types
export type AdminOverviewStats = {
  totalUsers: number;
  verifiedUsers: number;
  totalWebsites: number;
  publishedWebsites: number;
  totalOrders: number;
  totalBookings: number;
  potentialRevenue: number;
};

export type AdminGrowthData = {
  date: string;
  signups: number;
  websitesCreated: number;
  publishes: number;
  orders: number;
  bookings: number;
};

export type AdminFunnelStep = {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
};

export type AdminUserWithStats = {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: Date;
  websiteCount: number;
  publishedCount: number;
  totalOrders: number;
  totalBookings: number;
};

export type AdminWebsiteWithOwner = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  deploymentUrl: string | null;
  lastPublishedAt: Date | null;
  createdAt: Date;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  orderCount: number;
  bookingCount: number;
};

// Admin platform-wide analytics types
export type AdminAnalyticsOverview = {
  totalPageViews: number;
  uniqueSessions: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  avgOrderValue: number;
  activeWebsites: number;
};

export type AdminTrafficSource = {
  source: string;
  visitors: number;
  pageViews: number;
  percentage: number;
};

export type AdminDailyVisitors = {
  date: string;
  visitors: number;
  pageViews: number;
};

// Admin billing/subscription types
export type AdminUserSubscription = {
  id: string;
  email: string;
  fullName: string;
  planSlug: string | null;
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  subscriptionStartedAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
  createdAt: Date;
  websiteCount: number;
};

// Legal settings for websites (Terms of Service, Privacy Policy placeholders)
export const legalSettings = pgTable("legal_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  websiteId: varchar("website_id").notNull().unique(),
  websiteName: text("website_name"),
  companyName: text("company_name"),
  contactEmail: text("contact_email"),
  businessAddress: text("business_address"),
  termsCustomContent: text("terms_custom_content"), // Optional custom terms text
  privacyCustomContent: text("privacy_custom_content"), // Optional custom privacy text
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLegalSettingsSchema = createInsertSchema(legalSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLegalSettings = z.infer<typeof insertLegalSettingsSchema>;
export type LegalSettings = typeof legalSettings.$inferSelect;

// Support tickets table (for user feedback, bugs, and feature requests)
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  type: text("type").notNull(), // bug, problem, improvement
  message: text("message").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, closed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;

export type SupportTicketType = 'bug' | 'problem' | 'improvement';
export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';

// OAuth state tokens for replay prevention (persisted for multi-instance deployments)
export const oauthStateTokens = pgTable("oauth_state_tokens", {
  jti: varchar("jti").primaryKey(), // Unique token ID
  websiteId: varchar("website_id").notNull(),
  userId: varchar("user_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"), // NULL if not yet used
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OAuthStateToken = typeof oauthStateTokens.$inferSelect;

// ============================================================
// Admin audit log - append-only record of administrator actions
// on client resources (cross-tenant edits). The application only
// ever inserts and selects; there are deliberately no update or
// delete storage methods, and the SQL migration adds no update or
// delete RLS policies.
// Never store complete builder state, tokens, passwords, customer
// submissions or full order contents here - changedSummary carries
// field names and counts, not values.
// ============================================================
export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  actorAdminUserId: varchar("actor_admin_user_id").notNull(),
  targetUserId: varchar("target_user_id").notNull(),
  websiteId: varchar("website_id"),
  // Client-generated UUID grouping one admin editing session (metadata only)
  adminSessionId: varchar("admin_session_id"),
  // Server-generated UUID correlating entries from one HTTP request
  requestId: varchar("request_id").notNull(),
  action: text("action").notNull(), // e.g. "builder.update", "media.upload"
  resourceType: text("resource_type").notNull(), // e.g. "builderState", "media"
  resourceId: text("resource_id"),
  httpMethod: text("http_method").notNull(),
  route: text("route").notNull(), // route pattern, e.g. /api/websites/:id/builder
  changedSummary: jsonb("changed_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLog).omit({
  id: true,
  createdAt: true,
});

export type InsertAdminAuditEntry = z.infer<typeof insertAdminAuditLogSchema>;
export type AdminAuditEntry = typeof adminAuditLog.$inferSelect;

export * from "./models/chat";
