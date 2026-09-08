import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { performSvgExtraction } from "./svgExtraction";
import { svgAssetSchemaReady } from "./svgAssetSchema";
import { isReservedQaFixtureEmail } from "@shared/qaFixturePolicy";
import { onboardingStateFingerprint } from "./onboardingQuality";

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
  bookings, type Booking, type InsertBooking, type BookingContext,
  formSubmissions, type FormSubmission, type InsertFormSubmission,
  customers, type Customer, type InsertCustomer,
  products, type Product, type InsertProduct,
  mediaAssets, type MediaAsset, type InsertMediaAsset,
  svgAssets, type SvgAsset, type InsertSvgAsset,
  bookingServices, type BookingService, type InsertBookingService,
  bookingTeamMembers, type BookingTeamMember, type InsertBookingTeamMember,
  bookingOpenSlots, type BookingOpenSlot, type InsertBookingOpenSlot,
  customDomains, type CustomDomain, type InsertCustomDomain,
  shippingMethods, type ShippingMethod, type InsertShippingMethod,
  shippingCarrierCredentials, type ShippingCarrierCredentials, type InsertShippingCarrierCredentials,
  shippingConfig, type ShippingConfig, type InsertShippingConfig,
  websitePaymentSettings, type WebsitePaymentSettings, type InsertWebsitePaymentSettings,
  analyticsEvents, type AnalyticsEvent, type InsertAnalyticsEvent,
  type AnalyticsOverview, type FunnelStep, type TrafficSource, type TopPage,
  type AnalyticsTimeseriesPoint, type CountryVisitors, type LiveVisitorStats, type ManageOverview,
  type CustomerWithStats, type DeviceBreakdown,
  onboardingSessions, type OnboardingSession, type OnboardingChatMessage, type OnboardingAnswers,
  sanitizeAnalyticsEventData,
  billingLeads, type BillingLead, type InsertBillingLead,
  emailSettings, type EmailSettings, type InsertEmailSettings,
  emailTemplates, type EmailTemplate, type InsertEmailTemplate,
  legalSettings, type LegalSettings, type InsertLegalSettings,
  serviceAvailability, type ServiceAvailability, type InsertServiceAvailability,
  serviceBlockedDates, type ServiceBlockedDate, type InsertServiceBlockedDate,
  serviceDateRanges, type ServiceDateRange, type InsertServiceDateRange,
  supportTickets, type SupportTicket, type InsertSupportTicket,
  accountComponents, type AccountComponent, type InsertAccountComponent,
  adminAuditLog, type AdminAuditEntry, type InsertAdminAuditEntry,
  publicStats,
  type AdminOverviewStats, type AdminGrowthData, type AdminFunnelStep,
  type AdminUserWithStats, type AdminWebsiteWithOwner, type PlatformMeetingLink,
  type AdminAnalyticsOverview, type AdminTrafficSource, type AdminDailyVisitors,
  type AdminUserSubscription
} from "@shared/schema";
import { sql, gte, lte, desc, asc, ne, count, countDistinct, and, or, inArray, isNull, isNotNull, lt } from "drizzle-orm";
import { copenhagenDayRange, fillDailySeries } from "./analytics";

// A bookable time slot; openSlotId is set when the time comes from an
// owner-placed open slot rather than the regular availability rules.
export type AvailableSlot = {
  time: string;
  available: boolean;
  openSlotId?: string;
  teamMemberId?: string | null;
};

import { timeToMinutes, intervalsOverlap, TIME_RE } from "./bookingOverlap";
import { normalizeSiteLanguage } from "@shared/siteLanguage";
import { SEEDED_TEMPLATE_TYPES, defaultEmailTemplates } from "./email/defaultTemplates";

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

export type AdminAuditFilters = {
  websiteId?: string;
  actorAdminUserId?: string;
  adminSessionId?: string;
  limit?: number;
  offset?: number;
};

export interface IStorage {
  // Profile methods
  getProfile(id: string): Promise<Profile | undefined>;
  getProfileByEmail(email: string): Promise<Profile | undefined>;
  getProfileBySubscriptionId(subscriptionId: string): Promise<Profile | undefined>;
  getProfileByStripeCustomerId(customerId: string): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile & { id: string }): Promise<Profile>;
  updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined>;
  
  // Website methods
  getWebsite(id: string): Promise<Website | undefined>;
  /** Customer sites only - BirdFlow's platform calendar is never included. */
  getWebsitesByOwner(ownerId: string): Promise<Website[]>;
  getWebsiteByDeploymentUrl(url: string): Promise<Website | undefined>;
  createWebsite(website: InsertWebsite): Promise<Website>;
  updateWebsite(id: string, ownerId: string, data: Partial<InsertWebsite>): Promise<Website | undefined>;
  deleteWebsite(id: string, ownerId: string): Promise<boolean>;
  
  // Website inputs methods
  getWebsiteInputs(websiteId: string): Promise<WebsiteInputs | undefined>;
  createWebsiteInputs(inputs: InsertWebsiteInputs): Promise<WebsiteInputs>;
  updateWebsiteInputs(websiteId: string, data: Partial<InsertWebsiteInputs>): Promise<WebsiteInputs | undefined>;
  
  // Builder state methods
  getBuilderState(websiteId: string): Promise<BuilderState | undefined>;
  createBuilderState(
    websiteId: string,
    state?: BuilderStateData,
    opts?: { svgAssetOrigin?: "ai" | "customer" }
  ): Promise<BuilderState>;
  /**
   * Persist builder state and bump its revision.
   *
   * Pass `expectedRevision` to make the write a compare-and-swap: the row is
   * only updated when it still carries that revision, and `undefined` comes
   * back when someone else wrote first. Callers that hold the state for a
   * long time (the AI assistant, a multi-step build) MUST pass it — omitting
   * it means "last write wins", which is only correct for the canvas's own
   * immediate save.
   *
   * Both write methods run inline-SVG extraction on the state first (this is
   * the persistence choke point no writer can bypass); AI writers pass
   * `opts.svgAssetOrigin: "ai"` so extracted assets are labelled correctly.
   */
  updateBuilderState(
    websiteId: string,
    state: BuilderStateData,
    expectedRevision?: number,
    opts?: { svgAssetOrigin?: "ai" | "customer" }
  ): Promise<BuilderState | undefined>;
  
  // Custom domain methods
  getCustomDomains(websiteId: string): Promise<CustomDomain[]>;
  getCustomDomainByDomain(domain: string): Promise<CustomDomain | undefined>;
  createCustomDomain(domain: InsertCustomDomain): Promise<CustomDomain>;
  updateCustomDomain(domainId: string, websiteId: string, data: Partial<InsertCustomDomain> & { verifiedAt?: Date | null; lastCheckedAt?: Date | null }): Promise<CustomDomain | undefined>;
  deleteCustomDomain(domainId: string, websiteId: string): Promise<boolean>;
  getWebsiteByCustomDomain(domain: string): Promise<Website | undefined>;
  getDomainsNeedingCheck(createdAfter: Date, limit: number): Promise<CustomDomain[]>;
  claimDomainCheck(domainId: string, notCheckedSince: Date): Promise<boolean>;
  setWebsiteDeploymentUrl(websiteId: string, deploymentUrl: string): Promise<void>;
  
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
  ensureEmailTemplatesConfigured(websiteId: string): Promise<void>;

  // Public stats methods
  getPublicStats(): Promise<{ totalCreators: number }>;
  incrementTotalCreators(): Promise<void>;

  // Profile onboarding methods
  completeOnboarding(userId: string): Promise<Profile | undefined>;

  // Onboarding walkthrough sessions
  getOnboardingSession(userId: string): Promise<OnboardingSession | undefined>;
  getOnboardingSessionByWebsiteId(websiteId: string): Promise<OnboardingSession | undefined>;
  upsertOnboardingSession(
    userId: string,
    patch: {
      websiteId?: string;
      transcript?: OnboardingChatMessage[];
      answers?: Partial<OnboardingAnswers>;
      genStatus?: Record<string, unknown> | null;
    }
  ): Promise<OnboardingSession>;
  persistOnboardingGenStatus(websiteId: string, status: Record<string, unknown>): Promise<void>;
  claimOnboardingGeneration(
    websiteId: string,
    status: Record<string, unknown>,
    mode: "initial" | "retry" | "recover"
  ): Promise<boolean>;
  finishOnboardingGeneration(
    websiteId: string,
    status: Record<string, unknown>,
    publishable: boolean
  ): Promise<boolean>;

  // Admin methods
  getAdminOverviewStats(): Promise<AdminOverviewStats>;
  getAdminGrowthData(days: number): Promise<AdminGrowthData[]>;
  getAdminFunnel(): Promise<AdminFunnelStep[]>;
  getAllUsersWithStats(): Promise<AdminUserWithStats[]>;
  getAllUsersWithSubscriptions(): Promise<AdminUserSubscription[]>;
  getAllWebsitesWithOwners(): Promise<AdminWebsiteWithOwner[]>;
  isUserAdmin(userId: string): Promise<boolean>;

  // Admin audit log methods (append-only: insert + select, nothing else)
  createAdminAuditEntry(entry: InsertAdminAuditEntry): Promise<AdminAuditEntry>;
  getAdminAuditEntries(filters: AdminAuditFilters): Promise<AdminAuditEntry[]>;

  // Admin analytics methods
  getAdminAnalyticsOverview(startDate: Date, endDate: Date): Promise<AdminAnalyticsOverview>;
  getAdminTrafficSources(startDate: Date, endDate: Date): Promise<AdminTrafficSource[]>;
  getAdminDailyVisitors(startDate: Date, endDate: Date): Promise<AdminDailyVisitors[]>;

  // Website analytics (manage dashboard) methods
  getAnalyticsTimeseries(websiteId: string, startDate: Date, endDate: Date): Promise<AnalyticsTimeseriesPoint[]>;
  getLiveVisitors(websiteId: string, windowMinutes?: number): Promise<LiveVisitorStats>;
  getCountryBreakdown(websiteId: string, startDate: Date, endDate: Date): Promise<CountryVisitors[]>;
  getManageOverview(websiteId: string): Promise<ManageOverview>;
  
  // Subscription methods
  updateWebsiteAdmin(id: string, data: Partial<InsertWebsite>): Promise<Website | undefined>;
  getWebsiteByStripeSubscriptionId(subscriptionId: string): Promise<Website | undefined>;
  updateProfileStripeCustomerId(userId: string, customerId: string): Promise<void>;

  // Legal settings methods
  getLegalSettings(websiteId: string): Promise<LegalSettings | undefined>;
  createLegalSettings(settings: InsertLegalSettings): Promise<LegalSettings>;
  updateLegalSettings(websiteId: string, data: Partial<InsertLegalSettings>): Promise<LegalSettings | undefined>;

  // Service availability methods
  getServiceAvailability(serviceId: string): Promise<ServiceAvailability[]>;
  createServiceAvailability(availability: InsertServiceAvailability): Promise<ServiceAvailability>;
  updateServiceAvailability(id: string, data: Partial<InsertServiceAvailability>): Promise<ServiceAvailability | undefined>;
  deleteServiceAvailability(id: string): Promise<void>;
  getAvailableSlotsForDate(serviceId: string, websiteId: string, date: string, teamMemberId?: string): Promise<AvailableSlot[]>;
  checkSlotAvailable(serviceId: string, websiteId: string, date: string, time: string, teamMemberId?: string): Promise<boolean>;

  // Booking team member methods
  getTeamMembers(websiteId: string): Promise<BookingTeamMember[]>;
  getTeamMember(id: string, websiteId: string): Promise<BookingTeamMember | undefined>;
  createTeamMember(member: InsertBookingTeamMember): Promise<BookingTeamMember>;
  updateTeamMember(id: string, websiteId: string, data: Partial<InsertBookingTeamMember>): Promise<BookingTeamMember | undefined>;
  deleteTeamMember(id: string, websiteId: string): Promise<void>;

  // Open slot methods
  getOpenSlots(websiteId: string, from?: string, to?: string): Promise<BookingOpenSlot[]>;
  getOpenSlot(id: string, websiteId: string): Promise<BookingOpenSlot | undefined>;
  createOpenSlot(slot: InsertBookingOpenSlot): Promise<BookingOpenSlot>;
  updateOpenSlot(id: string, websiteId: string, data: Partial<InsertBookingOpenSlot>): Promise<BookingOpenSlot | undefined>;
  deleteOpenSlot(id: string, websiteId: string): Promise<void>;
  claimOpenSlot(id: string, websiteId: string): Promise<BookingOpenSlot | undefined>;
  releaseOpenSlot(id: string): Promise<void>;
  releaseOpenSlotByBooking(websiteId: string, bookingId: string): Promise<void>;
  linkOpenSlotBooking(id: string, bookingId: string): Promise<void>;

  // Booking conflict checks (interval overlap within one day)
  findMemberConflict(websiteId: string, teamMemberId: string, date: string, time: string, durationMinutes: number, excludeBookingId?: string): Promise<Booking | undefined>;
  findServiceConflict(websiteId: string, serviceId: string, date: string, time: string, durationMinutes: number, excludeBookingId?: string): Promise<Booking | undefined>;
  findPlacementConflict(websiteId: string, bookingId: string): Promise<Booking | undefined>;
  deleteBooking(bookingId: string, websiteId: string): Promise<boolean>;

  // Service blocked dates methods
  getServiceBlockedDates(serviceId: string): Promise<ServiceBlockedDate[]>;
  createServiceBlockedDate(blockedDate: InsertServiceBlockedDate): Promise<ServiceBlockedDate>;
  deleteServiceBlockedDate(id: string): Promise<void>;
  isDateBlocked(serviceId: string, date: string): Promise<boolean>;

  // Service date ranges methods
  getServiceDateRanges(serviceId: string): Promise<ServiceDateRange[]>;
  createServiceDateRange(dateRange: InsertServiceDateRange): Promise<ServiceDateRange>;
  updateServiceDateRange(id: string, data: Partial<InsertServiceDateRange>): Promise<ServiceDateRange | undefined>;
  deleteServiceDateRange(id: string): Promise<void>;
  isDateInActiveRange(serviceId: string, date: string): Promise<boolean>;

  // Full availability check (combines all rules)
  getFullServiceAvailability(serviceId: string, websiteId: string, month: number, year: number): Promise<{
    availableDates: string[];
    blockedDates: { date: string; reason?: string }[];
    dateRange: { startDate: string; endDate: string | null } | null;
    weeklySchedule: { dayOfWeek: number; startTime: string; endTime: string }[];
  }>;

  // Support ticket methods
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getSupportTickets(): Promise<SupportTicket[]>;
  getUserTickets(userId: string): Promise<SupportTicket[]>;
  updateTicketStatus(ticketId: string, status: string): Promise<SupportTicket | undefined>;

  // Account component library methods
  createAccountComponent(data: InsertAccountComponent): Promise<AccountComponent>;
  getAccountComponent(id: string, ownerId: string): Promise<AccountComponent | undefined>;
  listAccountComponents(ownerId: string): Promise<AccountComponent[]>;
  updateAccountComponent(id: string, ownerId: string, data: Partial<InsertAccountComponent>): Promise<AccountComponent | undefined>;
  deleteAccountComponent(id: string, ownerId: string): Promise<boolean>;
  /** Create a new version of an existing component (bumps `version`, new row keeps same id).
   *  Actually updates in-place and increments version — master/instance semantics. */
  createNewAccountComponentVersion(id: string, ownerId: string, tree: unknown, schema: unknown): Promise<AccountComponent | undefined>;
  /** Scan all builder states owned by this user and update instances whose
   *  `libraryRef.accountComponentId === componentId` to the latest tree/schema. */
  updateAllLinkedInstances(componentId: string, ownerId: string): Promise<{ updatedWebsites: string[] }>;
}

export class DatabaseStorage implements IStorage {
  // Profile methods - use explicit column selection to handle missing is_admin column gracefully
  private profileColumns = {
    id: profiles.id,
    email: profiles.email,
    fullName: profiles.fullName,
    phoneNumber: profiles.phoneNumber,
    onboardingCompleted: profiles.onboardingCompleted,
    createdAt: profiles.createdAt,
  };

  async getProfile(id: string): Promise<Profile | undefined> {
    console.log('[Storage] getProfile called with id:', id);
    try {
      const result = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
      console.log('[Storage] getProfile result:', result[0] ? 'found' : 'not found');
      return result[0];
    } catch (error: any) {
      console.error('[Storage] getProfile error:', error.message);
      // Handle missing columns gracefully - fall back to basic columns
      if (error.message?.includes("does not exist")) {
        const result = await db.select(this.profileColumns).from(profiles).where(eq(profiles.id, id)).limit(1);
        return result[0] ? { 
          ...result[0], 
          isAdmin: false, 
          stripeCustomerId: null,
          planSlug: null,
          subscriptionId: null,
          subscriptionStatus: null,
          subscriptionPriceId: null,
          subscriptionStartedAt: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
        } as any : undefined;
      }
      throw error;
    }
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
      return result[0];
    } catch (error: any) {
      if (error.message?.includes("does not exist")) {
        const result = await db.select(this.profileColumns).from(profiles).where(eq(profiles.email, email)).limit(1);
        return result[0] ? { 
          ...result[0], 
          isAdmin: false, 
          stripeCustomerId: null,
          planSlug: null,
          subscriptionId: null,
          subscriptionStatus: null,
          subscriptionPriceId: null,
          subscriptionStartedAt: null,
          trialEndsAt: null,
          currentPeriodEnd: null,
        } as any : undefined;
      }
      throw error;
    }
  }

  async getProfileBySubscriptionId(subscriptionId: string): Promise<Profile | undefined> {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.subscriptionId, subscriptionId)).limit(1);
      return result[0];
    } catch (error: any) {
      console.error('[Storage] getProfileBySubscriptionId error:', error.message);
      return undefined;
    }
  }

  async getProfileByStripeCustomerId(customerId: string): Promise<Profile | undefined> {
    try {
      const result = await db.select().from(profiles).where(eq(profiles.stripeCustomerId, customerId)).limit(1);
      return result[0];
    } catch (error: any) {
      console.error('[Storage] getProfileByStripeCustomerId error:', error.message);
      return undefined;
    }
  }

  async createProfile(profile: InsertProfile & { id: string }): Promise<Profile> {
    console.log('[Storage] createProfile called with:', JSON.stringify(profile));
    try {
      const result = await db.insert(profiles).values(profile as any).returning();
      console.log('[Storage] createProfile success via Drizzle, created profile id:', result[0]?.id);
      return result[0];
    } catch (error: any) {
      console.error('[Storage] createProfile Drizzle error:', error.message);
      console.error('[Storage] createProfile error code:', error.code);
      
      // Try raw SQL as fallback
      console.log('[Storage] Attempting raw SQL INSERT as fallback...');
      try {
        const rawResult = await pool.query(
          `INSERT INTO profiles (id, email, full_name, phone_number, onboarding_completed, created_at)
           VALUES ($1, $2, $3, $4, false, NOW())
           ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
           RETURNING *`,
          [profile.id, profile.email, profile.fullName || '', profile.phoneNumber || '']
        );
        
        if (rawResult.rows[0]) {
          console.log('[Storage] createProfile success via raw SQL, created profile id:', rawResult.rows[0].id);
          // Map snake_case to camelCase
          const row = rawResult.rows[0];
          return {
            id: row.id,
            email: row.email,
            fullName: row.full_name,
            phoneNumber: row.phone_number,
            isAdmin: row.is_admin || false,
            stripeCustomerId: row.stripe_customer_id,
            planSlug: row.plan_slug,
            subscriptionId: row.subscription_id,
            subscriptionStatus: row.subscription_status,
            subscriptionPriceId: row.subscription_price_id,
            subscriptionStartedAt: row.subscription_started_at,
            trialEndsAt: row.trial_ends_at,
            currentPeriodEnd: row.current_period_end,
            onboardingCompleted: row.onboarding_completed,
            createdAt: row.created_at,
          } as Profile;
        }
        throw new Error('Raw SQL INSERT returned no rows');
      } catch (rawError: any) {
        console.error('[Storage] createProfile raw SQL error:', rawError.message);
        throw rawError;
      }
    }
  }

  async updateProfile(id: string, data: Partial<InsertProfile>): Promise<Profile | undefined> {
    const result = await db.update(profiles).set(data as any).where(eq(profiles.id, id)).returning();
    return result[0];
  }

  // Website methods
  async getWebsite(id: string): Promise<Website | undefined> {
    const result = await db.select().from(websites).where(eq(websites.id, id)).limit(1);
    return result[0];
  }

  async getWebsitesByOwner(ownerId: string): Promise<Website[]> {
    // BirdFlow's own platform calendar is a websites row too. It must never
    // surface in a user's site list, site count or plan limit, so it is
    // filtered here rather than at each of the dozen call sites.
    return await db
      .select()
      .from(websites)
      .where(and(eq(websites.ownerId, ownerId), ne(websites.kind, "platform")));
  }

  async getWebsiteByDeploymentUrl(url: string): Promise<Website | undefined> {
    const result = await db.select().from(websites).where(eq(websites.deploymentUrl, url)).limit(1);
    return result[0];
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

  /**
   * Move inline illustration markup into the svg_assets store before a
   * builder-state write lands. This lives INSIDE the persistence layer on
   * purpose: every writer — canvas autosave, AI builds, onboarding
   * generation, Plan/Byg steps, undo restores, future callers — goes through
   * createBuilderState/updateBuilderState, so none of them can forget it.
   * Never throws; when the store is not ready the markup stays inline and
   * the next save tries again.
   */
  private async extractSvgAssetsBeforeSave(
    websiteId: string,
    state: BuilderStateData,
    origin?: "ai" | "customer"
  ): Promise<void> {
    await performSvgExtraction(state, origin ?? "customer", {
      schemaReady: () => svgAssetSchemaReady(db),
      createAsset: (input) => this.createSvgAsset({ websiteId, ...input }),
    });
  }

  async createBuilderState(
    websiteId: string,
    state?: BuilderStateData,
    opts?: { svgAssetOrigin?: "ai" | "customer" }
  ): Promise<BuilderState> {
    if (state) await this.extractSvgAssetsBeforeSave(websiteId, state, opts?.svgAssetOrigin);
    const result = await db
      .insert(builderState)
      .values({
        websiteId,
        state: state || defaultBuilderState,
      } as any)
      .returning();
    return result[0] as BuilderState;
  }

  async updateBuilderState(
    websiteId: string,
    state: BuilderStateData,
    expectedRevision?: number,
    opts?: { svgAssetOrigin?: "ai" | "customer" }
  ): Promise<BuilderState | undefined> {
    await this.extractSvgAssetsBeforeSave(websiteId, state, opts?.svgAssetOrigin);
    const where =
      typeof expectedRevision === "number"
        ? and(eq(builderState.websiteId, websiteId), eq(builderState.revision, expectedRevision))
        : eq(builderState.websiteId, websiteId);

    const result = await db
      .update(builderState)
      // The bump happens in SQL, not in JS: two writers that both read
      // revision 7 must not both write revision 8.
      .set({ state, revision: sql`${builderState.revision} + 1`, updatedAt: new Date() } as any)
      .where(where)
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
  async getBookings(websiteId: string, context?: BookingContext): Promise<Booking[]> {
    const where = context
      ? and(eq(bookings.websiteId, websiteId), eq(bookings.context, context))
      : eq(bookings.websiteId, websiteId);
    return db.select().from(bookings).where(where);
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

  // Booking team member methods
  async getTeamMembers(websiteId: string): Promise<BookingTeamMember[]> {
    return db.select().from(bookingTeamMembers)
      .where(eq(bookingTeamMembers.websiteId, websiteId))
      .orderBy(asc(bookingTeamMembers.sortOrder), asc(bookingTeamMembers.name));
  }

  async getTeamMember(id: string, websiteId: string): Promise<BookingTeamMember | undefined> {
    const result = await db.select().from(bookingTeamMembers)
      .where(and(eq(bookingTeamMembers.id, id), eq(bookingTeamMembers.websiteId, websiteId)))
      .limit(1);
    return result[0];
  }

  async createTeamMember(member: InsertBookingTeamMember): Promise<BookingTeamMember> {
    const result = await db.insert(bookingTeamMembers).values(member as any).returning();
    return result[0];
  }

  async updateTeamMember(id: string, websiteId: string, data: Partial<InsertBookingTeamMember>): Promise<BookingTeamMember | undefined> {
    const result = await db.update(bookingTeamMembers)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(bookingTeamMembers.id, id), eq(bookingTeamMembers.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteTeamMember(id: string, websiteId: string): Promise<void> {
    // Detach from bookings and open slots first so nothing dangles
    await db.update(bookings)
      .set({ teamMemberId: null })
      .where(and(eq(bookings.websiteId, websiteId), eq(bookings.teamMemberId, id)));
    await db.update(bookingOpenSlots)
      .set({ teamMemberId: null, updatedAt: new Date() })
      .where(and(eq(bookingOpenSlots.websiteId, websiteId), eq(bookingOpenSlots.teamMemberId, id)));
    await db.delete(bookingTeamMembers)
      .where(and(eq(bookingTeamMembers.id, id), eq(bookingTeamMembers.websiteId, websiteId)));
  }

  // Open slot methods
  async getOpenSlots(websiteId: string, from?: string, to?: string): Promise<BookingOpenSlot[]> {
    const conditions = [eq(bookingOpenSlots.websiteId, websiteId)];
    if (from) conditions.push(gte(bookingOpenSlots.date, from));
    if (to) conditions.push(lte(bookingOpenSlots.date, to));
    return db.select().from(bookingOpenSlots)
      .where(and(...conditions))
      .orderBy(asc(bookingOpenSlots.date), asc(bookingOpenSlots.time));
  }

  async getOpenSlot(id: string, websiteId: string): Promise<BookingOpenSlot | undefined> {
    const result = await db.select().from(bookingOpenSlots)
      .where(and(eq(bookingOpenSlots.id, id), eq(bookingOpenSlots.websiteId, websiteId)))
      .limit(1);
    return result[0];
  }

  async createOpenSlot(slot: InsertBookingOpenSlot): Promise<BookingOpenSlot> {
    const result = await db.insert(bookingOpenSlots).values(slot as any).returning();
    return result[0];
  }

  async updateOpenSlot(id: string, websiteId: string, data: Partial<InsertBookingOpenSlot>): Promise<BookingOpenSlot | undefined> {
    const result = await db.update(bookingOpenSlots)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(and(eq(bookingOpenSlots.id, id), eq(bookingOpenSlots.websiteId, websiteId)))
      .returning();
    return result[0];
  }

  async deleteOpenSlot(id: string, websiteId: string): Promise<void> {
    await db.delete(bookingOpenSlots)
      .where(and(eq(bookingOpenSlots.id, id), eq(bookingOpenSlots.websiteId, websiteId)));
  }

  // Atomically claim an open slot (open -> booked). Returns the slot when the
  // claim succeeded; undefined means someone else already took it.
  async claimOpenSlot(id: string, websiteId: string): Promise<BookingOpenSlot | undefined> {
    const result = await db.update(bookingOpenSlots)
      .set({ status: 'booked', updatedAt: new Date() })
      .where(and(
        eq(bookingOpenSlots.id, id),
        eq(bookingOpenSlots.websiteId, websiteId),
        eq(bookingOpenSlots.status, 'open')
      ))
      .returning();
    return result[0];
  }

  async releaseOpenSlot(id: string): Promise<void> {
    await db.update(bookingOpenSlots)
      .set({ status: 'open', bookingId: null, updatedAt: new Date() })
      .where(eq(bookingOpenSlots.id, id));
  }

  // When a booking that claimed an open slot is cancelled, reopen the slot
  async releaseOpenSlotByBooking(websiteId: string, bookingId: string): Promise<void> {
    await db.update(bookingOpenSlots)
      .set({ status: 'open', bookingId: null, updatedAt: new Date() })
      .where(and(
        eq(bookingOpenSlots.websiteId, websiteId),
        eq(bookingOpenSlots.bookingId, bookingId),
        eq(bookingOpenSlots.status, 'booked')
      ));
  }

  async linkOpenSlotBooking(id: string, bookingId: string): Promise<void> {
    await db.update(bookingOpenSlots)
      .set({ bookingId, updatedAt: new Date() })
      .where(eq(bookingOpenSlots.id, id));
  }

  // Booking conflict checks
  private async getDayBookings(websiteId: string, date: string, excludeBookingId?: string): Promise<Booking[]> {
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');
    const rows = await db.select().from(bookings)
      .where(and(
        eq(bookings.websiteId, websiteId),
        gte(bookings.date, startOfDay),
        lte(bookings.date, endOfDay),
        ne(bookings.status, 'cancelled')
      ));
    return excludeBookingId ? rows.filter(b => b.id !== excludeBookingId) : rows;
  }

  async findMemberConflict(websiteId: string, teamMemberId: string, date: string, time: string, durationMinutes: number, excludeBookingId?: string): Promise<Booking | undefined> {
    const dayBookings = await this.getDayBookings(websiteId, date, excludeBookingId);
    const start = timeToMinutes(time);
    return dayBookings.find(b =>
      b.teamMemberId === teamMemberId &&
      b.time && TIME_RE.test(b.time) &&
      intervalsOverlap(start, durationMinutes, timeToMinutes(b.time.slice(0, 5)), b.durationMinutes || 60)
    );
  }

  async findServiceConflict(websiteId: string, serviceId: string, date: string, time: string, durationMinutes: number, excludeBookingId?: string): Promise<Booking | undefined> {
    const dayBookings = await this.getDayBookings(websiteId, date, excludeBookingId);
    const start = timeToMinutes(time);
    return dayBookings.find(b =>
      b.serviceId === serviceId &&
      b.time && TIME_RE.test(b.time) &&
      intervalsOverlap(start, durationMinutes, timeToMinutes(b.time.slice(0, 5)), b.durationMinutes || 60)
    );
  }

  // Optimistic post-insert race check: after creating a booking, look for an
  // overlapping same-service or same-member booking that was created EARLIER
  // (id as tiebreak on identical timestamps). Two concurrent requests can both
  // pass the pre-insert checks; exactly one of them loses this verification
  // and rolls its booking back.
  async findPlacementConflict(websiteId: string, bookingId: string): Promise<Booking | undefined> {
    const own = await this.getBooking(bookingId, websiteId);
    if (!own || !own.time || !TIME_RE.test(own.time)) return undefined;
    const d = new Date(own.date);
    if (isNaN(d.getTime())) return undefined;
    const dateStr = d.toISOString().split('T')[0];
    const start = timeToMinutes(own.time.slice(0, 5));
    const dur = own.durationMinutes || 60;
    const ownCreated = own.createdAt ? new Date(own.createdAt).getTime() : 0;
    const dayBookings = await this.getDayBookings(websiteId, dateStr, bookingId);
    return dayBookings.find(b => {
      if (!b.time || !TIME_RE.test(b.time)) return false;
      if (!intervalsOverlap(start, dur, timeToMinutes(b.time.slice(0, 5)), b.durationMinutes || 60)) return false;
      const sharedService = !!own.serviceId && b.serviceId === own.serviceId;
      const sharedMember = !!own.teamMemberId && b.teamMemberId === own.teamMemberId;
      if (!sharedService && !sharedMember) return false;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated < ownCreated || (bCreated === ownCreated && b.id < bookingId);
    });
  }

  async deleteBooking(bookingId: string, websiteId: string): Promise<boolean> {
    const result = await db.delete(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.websiteId, websiteId)))
      .returning({ id: bookings.id });
    return result.length > 0;
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

  /**
   * Customers with live aggregates. A customer row is pure identity —
   * it is written by the sync_customer_from_order/_booking DB triggers
   * (see supabase migration m12_customer_identity_triggers), which is
   * the only mechanism that also catches published sites inserting
   * orders/bookings straight into Supabase without touching this
   * server. Totals are computed from orders and bookings here rather
   * than stored on the row, so they are always consistent with what the
   * Orders/Bookings tabs show — a replayed webhook or a refund can
   * never leave a stale counter behind. Spend counts paid orders only,
   * matching every revenue KPI.
   */
  async getCustomersWithStats(websiteId: string): Promise<CustomerWithStats[]> {
    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        createdAt: customers.createdAt,
        ordersCount: sql<number>`coalesce(o.orders_count, 0)`,
        totalSpentCents: sql<number>`coalesce(o.spent_cents, 0)`,
        bookingsCount: sql<number>`coalesce(b.bookings_count, 0)`,
        lastActivityAt: sql<string | null>`greatest(o.last_order_at, b.last_booking_at)`,
      })
      .from(customers)
      .leftJoin(
        sql`lateral (
          select count(*) filter (where ${orders.paymentStatus} = 'paid') as orders_count,
                 coalesce(sum(${orders.totalAmountCents}) filter (where ${orders.paymentStatus} = 'paid'), 0) as spent_cents,
                 max(${orders.createdAt}) as last_order_at
          from ${orders}
          where ${orders.websiteId} = ${customers.websiteId}
            and lower(${orders.customerEmail}) = lower(${customers.email})
        ) o`,
        sql`true`
      )
      .leftJoin(
        sql`lateral (
          select count(*) as bookings_count,
                 max(${bookings.createdAt}) as last_booking_at
          from ${bookings}
          where ${bookings.websiteId} = ${customers.websiteId}
            and ${bookings.context} = 'customer_site'
            and lower(${bookings.customerEmail}) = lower(${customers.email})
        ) b`,
        sql`true`
      )
      .where(eq(customers.websiteId, websiteId))
      .orderBy(desc(customers.createdAt));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      ordersCount: Number(r.ordersCount),
      totalSpentCents: Number(r.totalSpentCents),
      bookingsCount: Number(r.bookingsCount),
      lastActivityAt: r.lastActivityAt ? new Date(r.lastActivityAt).toISOString() : null,
    }));
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

  // SVG assets methods (reusable illustrations referenced by svgAssetId)
  async getSvgAssets(websiteId: string): Promise<SvgAsset[]> {
    return db.select().from(svgAssets).where(eq(svgAssets.websiteId, websiteId));
  }

  async getSvgAsset(assetId: string, websiteId: string): Promise<SvgAsset | undefined> {
    const result = await db.select().from(svgAssets).where(
      and(eq(svgAssets.id, assetId), eq(svgAssets.websiteId, websiteId))
    ).limit(1);
    return result[0];
  }

  /**
   * Insert-or-return-existing, keyed on (website_id, content_hash): saving
   * the same illustration twice must reuse the row, so extraction and
   * re-uploads stay idempotent. The no-op update makes RETURNING yield the
   * existing row on conflict.
   */
  async createSvgAsset(asset: InsertSvgAsset): Promise<SvgAsset> {
    const result = await db
      .insert(svgAssets)
      .values(asset as any)
      .onConflictDoUpdate({
        target: [svgAssets.websiteId, svgAssets.contentHash],
        set: { updatedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  async deleteSvgAsset(assetId: string, websiteId: string): Promise<boolean> {
    const result = await db
      .delete(svgAssets)
      .where(and(eq(svgAssets.id, assetId), eq(svgAssets.websiteId, websiteId)))
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

  async updateCustomDomain(domainId: string, websiteId: string, data: Partial<InsertCustomDomain> & { verifiedAt?: Date | null; lastCheckedAt?: Date | null }): Promise<CustomDomain | undefined> {
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
    const normalized = domain.toLowerCase();
    let customDomain = await this.getCustomDomainByDomain(normalized);
    if (!customDomain) {
      // Cover the automatically attached www/apex twin so both hosts route
      // to the website even though only one row is stored.
      const twin = normalized.startsWith('www.') ? normalized.slice(4) : `www.${normalized}`;
      customDomain = await this.getCustomDomainByDomain(twin);
    }
    if (!customDomain || customDomain.status !== 'active') {
      return undefined;
    }
    return this.getWebsite(customDomain.websiteId);
  }

  // Domains the server-side verification loop should re-check: still waiting
  // on DNS/activation, attached to a Vercel project, and not so old that the
  // setup was clearly abandoned (manual "check now" keeps working forever).
  async getDomainsNeedingCheck(createdAfter: Date, limit: number): Promise<CustomDomain[]> {
    return db
      .select()
      .from(customDomains)
      .where(and(
        inArray(customDomains.status, ['pending', 'verifying']),
        isNotNull(customDomains.vercelProjectId),
        gte(customDomains.createdAt, createdAfter),
      ))
      .orderBy(sql`${customDomains.lastCheckedAt} ASC NULLS FIRST`)
      .limit(limit);
  }

  // Soft claim so dev and prod (which share one database) don't hammer
  // Vercel for the same domain at the same time.
  async claimDomainCheck(domainId: string, notCheckedSince: Date): Promise<boolean> {
    const result = await db
      .update(customDomains)
      .set({ lastCheckedAt: new Date() })
      .where(and(
        eq(customDomains.id, domainId),
        or(isNull(customDomains.lastCheckedAt), lt(customDomains.lastCheckedAt, notCheckedSince)),
      ))
      .returning({ id: customDomains.id });
    return result.length > 0;
  }

  // Internal setter (no owner check) used when a custom domain goes live or
  // is deleted — callers have already authorized the operation.
  async setWebsiteDeploymentUrl(websiteId: string, deploymentUrl: string): Promise<void> {
    await db
      .update(websites)
      .set({ deploymentUrl, updatedAt: new Date() } as any)
      .where(eq(websites.id, websiteId));
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

  // The four period aggregates below used to select every event row in
  // the window and reduce in JS - fine at launch, linear memory as sites
  // grow. Each is now a single SQL aggregate, following the pattern of
  // getAnalyticsTimeseries/getLiveVisitors further down.

  async getAnalyticsOverview(websiteId: string, startDate: Date, endDate: Date): Promise<AnalyticsOverview> {
    const scope = and(
      eq(analyticsEvents.websiteId, websiteId),
      gte(analyticsEvents.timestamp, startDate),
      lte(analyticsEvents.timestamp, endDate)
    );

    const [totalsRows, durationRows, websiteRows] = await Promise.all([
      db
        .select({
          pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
          uniqueSessions: countDistinct(analyticsEvents.sessionId),
          totalOrders: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'order_created')`,
          totalRevenue: sql<number>`coalesce(sum((${analyticsEvents.eventData} ->> 'orderTotal')::numeric) filter (where ${analyticsEvents.eventType} = 'order_created'), 0)`,
          totalBookings: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'booking_created')`,
          sessionsWithPageView: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.eventType} = 'page_view')`,
          sessionsWithOrder: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.eventType} = 'order_created')`,
        })
        .from(analyticsEvents)
        .where(scope),
      // Visit duration: sum each session's page_time beacons (clamped on
      // ingest; re-clamped here so a legacy oversized row can't skew the
      // mean), then average per session.
      db
        .select({
          avgSeconds: sql<number>`coalesce(avg(session_seconds), 0)`,
        })
        .from(
          sql`(
            select sum(least((${analyticsEvents.eventData} ->> 'durationSeconds')::numeric, 3600)) as session_seconds
            from ${analyticsEvents}
            where ${scope}
              and ${analyticsEvents.eventType} = 'page_time'
              and (${analyticsEvents.eventData} ->> 'durationSeconds') ~ '^[0-9.]+$'
            group by ${analyticsEvents.sessionId}
          ) per_session`
        ),
      db
        .select({ currency: websites.currency })
        .from(websites)
        .where(eq(websites.id, websiteId)),
    ]);

    const t = totalsRows[0];
    const totalOrders = Number(t?.totalOrders) || 0;
    const totalRevenue = Number(t?.totalRevenue) || 0;
    const sessionsWithPageView = Number(t?.sessionsWithPageView) || 0;
    const sessionsWithOrder = Number(t?.sessionsWithOrder) || 0;
    const conversionRate = sessionsWithPageView > 0 ? (sessionsWithOrder / sessionsWithPageView) * 100 : 0;

    return {
      totalPageViews: Number(t?.pageViews) || 0,
      uniqueSessions: Number(t?.uniqueSessions) || 0,
      totalOrders,
      totalRevenue,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      totalBookings: Number(t?.totalBookings) || 0,
      avgVisitDurationSeconds: Math.round(Number(durationRows[0]?.avgSeconds) || 0),
      currency: websiteRows[0]?.currency || "DKK",
    };
  }

  async getAnalyticsFunnel(websiteId: string, startDate: Date, endDate: Date): Promise<FunnelStep[]> {
    const funnelSteps = ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'order_created'];
    const stepNames = ['Page Views', 'Product Views', 'Add to Cart', 'Checkout Started', 'Orders Completed'];

    const rows = await db
      .select({
        eventType: analyticsEvents.eventType,
        sessions: countDistinct(analyticsEvents.sessionId),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate),
          sql`${analyticsEvents.eventType} in ('page_view','product_view','add_to_cart','checkout_start','order_created')`
        )
      )
      .groupBy(analyticsEvents.eventType);

    const countByStep = new Map(rows.map(r => [r.eventType, Number(r.sessions) || 0]));
    const baseCount = countByStep.get('page_view') || 1;

    return funnelSteps.map((step, index) => {
      const currentCount = countByStep.get(step) || 0;
      const previousCount = index > 0 ? (countByStep.get(funnelSteps[index - 1]) || 0) : currentCount;
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
    const sourceExpr = sql<string>`coalesce(${analyticsEvents.trafficSource}, 'direct')`;
    const rows = await db
      .select({
        source: sourceExpr,
        sessions: countDistinct(analyticsEvents.sessionId),
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
        conversions: sql<number>`count(*) filter (where ${analyticsEvents.eventType} in ('order_created','booking_created'))`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .groupBy(sourceExpr);

    return rows
      .map(r => {
        const sessions = Number(r.sessions) || 0;
        const conversions = Number(r.conversions) || 0;
        return {
          source: r.source,
          sessions,
          pageViews: Number(r.pageViews) || 0,
          conversions,
          conversionRate: sessions > 0 ? Math.round((conversions / sessions) * 10000) / 100 : 0,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);
  }

  async getTopPages(websiteId: string, startDate: Date, endDate: Date): Promise<TopPage[]> {
    // page_view and page_time beacons carry the same path key, so one
    // grouped pass produces views, distinct visitors AND the mean time
    // on page (which the old implementation typed but never computed).
    const pathExpr = sql<string>`coalesce(${analyticsEvents.eventData} ->> 'path', ${analyticsEvents.pageUrl}, '/')`;
    const rows = await db
      .select({
        path: pathExpr,
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
        uniqueVisitors: sql<number>`count(distinct ${analyticsEvents.sessionId}) filter (where ${analyticsEvents.eventType} = 'page_view')`,
        avgTimeOnPage: sql<number>`coalesce(avg(least((${analyticsEvents.eventData} ->> 'durationSeconds')::numeric, 3600)) filter (where ${analyticsEvents.eventType} = 'page_time' and (${analyticsEvents.eventData} ->> 'durationSeconds') ~ '^[0-9.]+$'), 0)`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          sql`${analyticsEvents.eventType} in ('page_view','page_time')`,
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .groupBy(pathExpr)
      .orderBy(sql`count(*) filter (where ${analyticsEvents.eventType} = 'page_view') desc`)
      .limit(10);

    return rows
      .map(r => ({
        path: r.path,
        pageViews: Number(r.pageViews) || 0,
        uniqueVisitors: Number(r.uniqueVisitors) || 0,
        avgTimeOnPage: Math.round(Number(r.avgTimeOnPage) || 0),
      }))
      // a path with only page_time beacons and zero views is noise
      .filter(r => r.pageViews > 0);
  }

  async getDeviceBreakdown(websiteId: string, startDate: Date, endDate: Date): Promise<DeviceBreakdown[]> {
    const rows = await db
      .select({
        device: analyticsEvents.deviceType,
        visitors: countDistinct(analyticsEvents.sessionId),
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .groupBy(analyticsEvents.deviceType);

    return rows
      .map(r => ({
        device: r.device,
        visitors: Number(r.visitors) || 0,
        pageViews: Number(r.pageViews) || 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);
  }

  // Website analytics (manage dashboard) methods

  async getAnalyticsTimeseries(websiteId: string, startDate: Date, endDate: Date): Promise<AnalyticsTimeseriesPoint[]> {
    // Bucket by Copenhagen-local day in SQL so a visit at 00:30 local lands
    // on the right day. Column is timestamp-without-tz holding UTC instants.
    const dayExpr = sql<string>`to_char(timezone('Europe/Copenhagen', timezone('UTC', ${analyticsEvents.timestamp})), 'YYYY-MM-DD')`;
    const rows = await db
      .select({
        date: dayExpr,
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
        visitors: countDistinct(analyticsEvents.sessionId),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .groupBy(dayExpr);

    const normalized = rows.map(r => ({
      date: r.date,
      pageViews: Number(r.pageViews) || 0,
      visitors: Number(r.visitors) || 0,
    }));
    return fillDailySeries(normalized, startDate, endDate);
  }

  async getLiveVisitors(websiteId: string, windowMinutes: number = 5): Promise<LiveVisitorStats> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);
    const rows = await db
      .select({
        country: analyticsEvents.country,
        visitors: countDistinct(analyticsEvents.sessionId),
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, since)
        )
      )
      .groupBy(analyticsEvents.country);

    // A session that sent events with and without a country would be counted
    // twice across groups; the distinct total below avoids that inflation.
    const totalRows = await db
      .select({ total: countDistinct(analyticsEvents.sessionId) })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, since)
        )
      );

    const byCountry = rows
      .map(r => ({ country: r.country, visitors: Number(r.visitors) || 0 }))
      .sort((a, b) => b.visitors - a.visitors);

    return {
      activeVisitors: Number(totalRows[0]?.total) || 0,
      byCountry,
    };
  }

  async getCountryBreakdown(websiteId: string, startDate: Date, endDate: Date): Promise<CountryVisitors[]> {
    const rows = await db
      .select({
        country: analyticsEvents.country,
        visitors: countDistinct(analyticsEvents.sessionId),
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.websiteId, websiteId),
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      )
      .groupBy(analyticsEvents.country);

    return rows
      .map(r => ({
        country: r.country,
        visitors: Number(r.visitors) || 0,
        pageViews: Number(r.pageViews) || 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);
  }

  async getManageOverview(websiteId: string): Promise<ManageOverview> {
    const now = new Date();
    const { start: todayStart, end: todayEnd } = copenhagenDayRange(now);
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      todayBookingRows,
      upcomingRows,
      orderTodayRows,
      pendingOrderRows,
      revenue30Rows,
      websiteCurrencyRows,
      unreadRows,
      customerRows,
      traffic7Rows,
      recentOrderRows,
      live,
    ] = await Promise.all([
      // A customer's overview only ever counts appointments made through
      // their own site, never BirdFlow's internal onboarding meetings.
      db.select({ n: count() }).from(bookings).where(and(
        eq(bookings.websiteId, websiteId),
        eq(bookings.context, 'customer_site'),
        gte(bookings.date, todayStart),
        sql`${bookings.date} < ${todayEnd}`,
        sql`${bookings.status} != 'cancelled'`
      )),
      db.select().from(bookings).where(and(
        eq(bookings.websiteId, websiteId),
        eq(bookings.context, 'customer_site'),
        gte(bookings.date, todayStart),
        sql`${bookings.status} != 'cancelled'`
      )).orderBy(bookings.date).limit(5),
      db.select({
        n: count(),
        revenue: sql<number>`coalesce(sum(${orders.totalAmountCents}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
      }).from(orders).where(and(
        eq(orders.websiteId, websiteId),
        gte(orders.createdAt, todayStart),
        sql`${orders.createdAt} < ${todayEnd}`
      )),
      db.select({ n: count() }).from(orders).where(and(
        eq(orders.websiteId, websiteId),
        eq(orders.status, 'pending')
      )),
      db.select({
        revenue: sql<number>`coalesce(sum(${orders.totalAmountCents}) filter (where ${orders.paymentStatus} = 'paid'), 0)`,
      }).from(orders).where(and(
        eq(orders.websiteId, websiteId),
        gte(orders.createdAt, days30)
      )),
      db.select({ currency: websites.currency }).from(websites).where(eq(websites.id, websiteId)),
      db.select({ n: count() }).from(formSubmissions).where(and(
        eq(formSubmissions.websiteId, websiteId),
        eq(formSubmissions.read, 'false')
      )),
      db.select({ n: count() }).from(customers).where(eq(customers.websiteId, websiteId)),
      db.select({
        visitors: countDistinct(analyticsEvents.sessionId),
        pageViews: sql<number>`count(*) filter (where ${analyticsEvents.eventType} = 'page_view')`,
      }).from(analyticsEvents).where(and(
        eq(analyticsEvents.websiteId, websiteId),
        gte(analyticsEvents.timestamp, days7)
      )),
      db.select().from(orders).where(eq(orders.websiteId, websiteId)).orderBy(desc(orders.createdAt)).limit(5),
      this.getLiveVisitors(websiteId),
    ]);

    return {
      todayBookings: Number(todayBookingRows[0]?.n) || 0,
      upcomingBookings: upcomingRows.map(b => ({
        id: b.id,
        customerName: b.customerName,
        service: b.service,
        date: b.date instanceof Date ? b.date.toISOString() : String(b.date),
        time: b.time,
        status: b.status,
      })),
      newOrdersToday: Number(orderTodayRows[0]?.n) || 0,
      pendingOrders: Number(pendingOrderRows[0]?.n) || 0,
      revenueTodayCents: Number(orderTodayRows[0]?.revenue) || 0,
      revenue30dCents: Number(revenue30Rows[0]?.revenue) || 0,
      currency: websiteCurrencyRows[0]?.currency || 'DKK',
      unreadSubmissions: Number(unreadRows[0]?.n) || 0,
      totalCustomers: Number(customerRows[0]?.n) || 0,
      activeVisitors: live.activeVisitors,
      visitors7d: Number(traffic7Rows[0]?.visitors) || 0,
      pageViews7d: Number(traffic7Rows[0]?.pageViews) || 0,
      recentOrders: recentOrderRows.map(o => ({
        id: o.id,
        customerName: o.customerName,
        totalAmountCents: o.totalAmountCents,
        currency: o.currency,
        status: o.status,
        paymentStatus: o.paymentStatus,
        createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : String(o.createdAt),
      })),
    };
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

  async ensureEmailTemplatesConfigured(websiteId: string): Promise<void> {
    // Seed in the website's own language. Existing rows are never touched, so
    // a customer who edited a template keeps their wording.
    const website = await this.getWebsite(websiteId);
    const templates = defaultEmailTemplates(normalizeSiteLanguage(website?.language));
    const DEFAULT_TEMPLATES: Record<string, { subject: string; heading: string; bodyText: string; buttonText?: string }> =
      Object.fromEntries(
        SEEDED_TEMPLATE_TYPES.filter(type => templates[type]).map(type => [type, templates[type]])
      );

    const existingTemplates = await this.getEmailTemplates(websiteId);
    const existingTypes = new Set(existingTemplates.map(t => t.templateType));

    const missingTypes = Object.keys(DEFAULT_TEMPLATES).filter(type => !existingTypes.has(type));

    if (missingTypes.length > 0) {
      const insertValues = missingTypes.map(type => ({
        websiteId,
        templateType: type,
        subject: DEFAULT_TEMPLATES[type].subject,
        heading: DEFAULT_TEMPLATES[type].heading,
        bodyText: DEFAULT_TEMPLATES[type].bodyText,
        buttonText: DEFAULT_TEMPLATES[type].buttonText || null,
      }));

      try {
        await db.insert(emailTemplates).values(insertValues).onConflictDoNothing();
        console.log(`[Email] Created ${missingTypes.length} default email templates for website ${websiteId}: ${missingTypes.join(', ')}`);
      } catch (error: any) {
        // Handle race condition - if another request already inserted, that's fine
        if (error.code === '23505') {
          console.log(`[Email] Templates already exist for website ${websiteId} (concurrent insert)`);
        } else {
          throw error;
        }
      }
    }
  }

  // Public stats methods
  async getPublicStats(): Promise<{ totalCreators: number }> {
    // Count real users from profiles table
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(profiles);
    return { totalCreators: result[0]?.count || 0 };
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

  // ---- Onboarding walkthrough sessions ----
  // Transcript + structured answers used to live only in localStorage,
  // and generation status only in an in-memory Map. Both persist here
  // so the walkthrough survives device switches and server restarts.

  async getOnboardingSession(userId: string): Promise<OnboardingSession | undefined> {
    const result = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, userId));
    return result[0];
  }

  async getOnboardingSessionByWebsiteId(websiteId: string): Promise<OnboardingSession | undefined> {
    const result = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.websiteId, websiteId));
    return result[0];
  }

  /**
   * Merge-write the user's onboarding session. `answers` merges shallowly
   * over what is stored; `transcript` and `genStatus` replace wholesale
   * (the caller always holds the full transcript for its turn).
   */
  async upsertOnboardingSession(
    userId: string,
    patch: {
      websiteId?: string;
      transcript?: OnboardingChatMessage[];
      answers?: Partial<OnboardingAnswers>;
      genStatus?: Record<string, unknown> | null;
    }
  ): Promise<OnboardingSession> {
    const existing = await this.getOnboardingSession(userId);
    if (!existing) {
      const result = await db
        .insert(onboardingSessions)
        .values({
          userId,
          websiteId: patch.websiteId ?? null,
          transcript: patch.transcript ?? [],
          answers: (patch.answers ?? {}) as OnboardingAnswers,
          genStatus: patch.genStatus ?? null,
        } as any)
        .onConflictDoNothing({ target: onboardingSessions.userId })
        .returning();
      if (result[0]) return result[0];
      // Lost a concurrent-insert race: fall through to the update path.
    }

    const merged: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.websiteId !== undefined) merged.websiteId = patch.websiteId;
    if (patch.transcript !== undefined) merged.transcript = patch.transcript;
    if (patch.genStatus !== undefined) merged.genStatus = patch.genStatus;
    if (patch.answers !== undefined) {
      const current = (await this.getOnboardingSession(userId))?.answers ?? {};
      merged.answers = { ...current, ...patch.answers };
    }
    const result = await db
      .update(onboardingSessions)
      .set(merged as any)
      .where(eq(onboardingSessions.userId, userId))
      .returning();
    return result[0];
  }

  /** Fire-and-forget mirror of a generation status, keyed by website. */
  async persistOnboardingGenStatus(websiteId: string, status: Record<string, unknown>): Promise<void> {
    const attempt = Number(status.attempt ?? 0);
    await db
      .update(onboardingSessions)
      .set({ genStatus: status, updatedAt: new Date() } as any)
      .where(and(
        eq(onboardingSessions.websiteId, websiteId),
        eq(onboardingSessions.generationState, "generating"),
        sql`COALESCE((${onboardingSessions.genStatus} ->> 'attempt')::int, 0) = ${attempt}`
      ));
  }

  /**
   * Claim the right to launch one onboarding generation before any background
   * work starts. The generation state and initial status move together in one
   * database write, so a lost SSE response or reload can always discover the
   * run. Recovery is only allowed after the persisted heartbeat is stale.
   */
  async claimOnboardingGeneration(
    websiteId: string,
    status: Record<string, unknown>,
    mode: "initial" | "retry" | "recover"
  ): Promise<boolean> {
    const staleBefore = Date.now() - 30_000;
    const allowed =
      mode === "initial"
        ? sql`${onboardingSessions.generationState} = 'not_started'`
        : mode === "retry"
          ? sql`${onboardingSessions.generationState} = 'failed'`
          : sql`${onboardingSessions.generationState} = 'generating'
              AND COALESCE((${onboardingSessions.genStatus} ->> 'updatedAt')::bigint, 0) < ${staleBefore}`;
    const rows = await db
      .update(onboardingSessions)
      .set({
        generationState: "generating",
        genStatus: status,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(onboardingSessions.websiteId, websiteId), allowed))
      .returning({ id: onboardingSessions.id });
    return rows.length === 1;
  }

  /** Atomically persist the terminal status and the decision-state outcome. */
  async finishOnboardingGeneration(
    websiteId: string,
    status: Record<string, unknown>,
    publishable: boolean
  ): Promise<boolean> {
    const attempt = Number(status.attempt ?? 0);
    return db.transaction(async (tx) => {
      // Lock in the same order as explicit builder saves: builder, then
      // onboarding session. This makes certification one serializable moment.
      const [builder] = await tx
        .select()
        .from(builderState)
        .where(eq(builderState.websiteId, websiteId))
        .for("update");
      const [session] = await tx
        .select()
        .from(onboardingSessions)
        .where(eq(onboardingSessions.websiteId, websiteId))
        .for("update");
      if (
        !session ||
        Number((session.genStatus as Record<string, unknown> | null)?.attempt ?? 0) !== attempt
      ) {
        return false;
      }
      if (publishable) {
        const certifiedRevision = Number(status.qualityBuilderRevision);
        if (
          !builder ||
          !Number.isFinite(certifiedRevision) ||
          builder.revision !== certifiedRevision ||
          status.qualityFingerprint !== onboardingStateFingerprint(builder.state as BuilderStateData)
        ) {
          return false;
        }
        status.qualitySiteRevision = session.siteRevision + 1;
      }
      const terminalValues = publishable
        ? {
            generationState: "complete",
            genStatus: status,
            siteRevision: sql`${onboardingSessions.siteRevision} + 1`,
            approvedRevision: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
              THEN ${onboardingSessions.approvedRevision} ELSE NULL END`,
            approvedAt: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
              THEN ${onboardingSessions.approvedAt} ELSE NULL END`,
            decisionState: sql`CASE WHEN ${onboardingSessions.paymentState} = 'paid'
              THEN ${onboardingSessions.decisionState}
              WHEN ${onboardingSessions.decisionState} = 'approved' THEN 'awaiting_decision'
              ELSE ${onboardingSessions.decisionState} END`,
            updatedAt: new Date(),
          }
        : {
            generationState: "failed",
            genStatus: status,
            updatedAt: new Date(),
          };
      const rows = await tx
        .update(onboardingSessions)
        .set(terminalValues as any)
        .where(eq(onboardingSessions.id, session.id))
        .returning({ id: onboardingSessions.id });
      return rows.length === 1;
    });
  }

  /**
   * Everyone BirdFlow should notify about a new internal meeting. Derived from
   * the admin flag rather than configuration, so a fresh environment needs no
   * extra setup.
   */
  async getAdminNotificationEmails(): Promise<string[]> {
    try {
      const rows = await db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.isAdmin, true));
      return rows.map(r => r.email).filter((email): email is string => !!email);
    } catch (error: any) {
      if (error.message?.includes("is_admin")) return [];
      throw error;
    }
  }

  /**
   * Customer, website and onboarding session behind each of BirdFlow's own
   * onboarding meetings, for the admin Bookinger tab's link-through.
   */
  async getPlatformMeetingLinks(platformWebsiteId: string): Promise<PlatformMeetingLink[]> {
    const rows = await db
      .select({
        bookingId: bookings.id,
        customerUserId: bookings.customerUserId,
        customerWebsiteId: bookings.customerWebsiteId,
        onboardingSessionId: bookings.onboardingSessionId,
        customerName: profiles.fullName,
        customerEmail: profiles.email,
        customerWebsiteName: websites.name,
      })
      .from(bookings)
      .leftJoin(profiles, eq(profiles.id, bookings.customerUserId))
      .leftJoin(websites, eq(websites.id, bookings.customerWebsiteId))
      .where(
        and(
          eq(bookings.websiteId, platformWebsiteId),
          eq(bookings.context, "platform_onboarding")
        )
      );

    return rows.map(row => ({
      bookingId: row.bookingId,
      customerUserId: row.customerUserId ?? null,
      customerName: row.customerName ?? null,
      customerEmail: row.customerEmail ?? null,
      customerWebsiteId: row.customerWebsiteId ?? null,
      customerWebsiteName: row.customerWebsiteName ?? null,
      onboardingSessionId: row.onboardingSessionId ?? null,
    }));
  }

  // Admin methods
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const result = await db.select({ isAdmin: profiles.isAdmin }).from(profiles).where(eq(profiles.id, userId)).limit(1);
      return result[0]?.isAdmin ?? false;
    } catch (error: any) {
      // If is_admin column doesn't exist, return false
      if (error.message?.includes("is_admin")) {
        console.log("Note: is_admin column not found in database. To enable admin features, run: ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;");
        return false;
      }
      throw error;
    }
  }

  // Append-only admin audit log: insert + select only. Do not add
  // update or delete methods for this table.
  async createAdminAuditEntry(entry: InsertAdminAuditEntry): Promise<AdminAuditEntry> {
    const result = await db.insert(adminAuditLog).values(entry).returning();
    return result[0];
  }

  async getAdminAuditEntries(filters: AdminAuditFilters): Promise<AdminAuditEntry[]> {
    const conditions = [];
    if (filters.websiteId) {
      conditions.push(eq(adminAuditLog.websiteId, filters.websiteId));
    }
    if (filters.actorAdminUserId) {
      conditions.push(eq(adminAuditLog.actorAdminUserId, filters.actorAdminUserId));
    }
    if (filters.adminSessionId) {
      conditions.push(eq(adminAuditLog.adminSessionId, filters.adminSessionId));
    }

    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const offset = Math.max(filters.offset ?? 0, 0);

    const base = db.select().from(adminAuditLog);
    const query = conditions.length > 0 ? base.where(and(...conditions)) : base;

    return await query
      .orderBy(desc(adminAuditLog.createdAt), desc(adminAuditLog.id))
      .limit(limit)
      .offset(offset);
  }

  async getAdminOverviewStats(): Promise<AdminOverviewStats> {
    // Customer data only: BirdFlow's own platform calendar and the internal
    // onboarding meetings on it are not customer activity and must not move
    // these numbers.
    const [usersResult, websitesResult, ordersResult, bookingsResult] = await Promise.all([
      db.select({ count: count() }).from(profiles),
      db.select().from(websites).where(ne(websites.kind, "platform")),
      db.select().from(orders),
      db.select().from(bookings).where(eq(bookings.context, "customer_site")),
    ]);

    const totalUsers = usersResult[0]?.count ?? 0;
    const verifiedUsers = totalUsers; // All profiles are verified (created after email verification)
    const allWebsites = websitesResult;
    const totalWebsites = allWebsites.length;
    const publishedWebsites = allWebsites.filter(w => w.status === 'published').length;
    const totalOrders = ordersResult.length;
    const totalBookings = bookingsResult.length;
    
    // Calculate potential revenue from orders (sum of all order totals)
    const potentialRevenue = ordersResult.reduce((sum, order) => {
      return sum + (order.totalAmountCents || parseFloat(order.total || '0') * 100);
    }, 0);

    return {
      totalUsers,
      verifiedUsers,
      totalWebsites,
      publishedWebsites,
      totalOrders,
      totalBookings,
      potentialRevenue,
    };
  }

  async getAdminGrowthData(days: number): Promise<AdminGrowthData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    let allProfiles: any[];
    try {
      allProfiles = await db.select().from(profiles).where(gte(profiles.createdAt, startDate));
    } catch (error: any) {
      if (error.message?.includes("is_admin")) {
        allProfiles = await db.select(this.profileColumns).from(profiles).where(gte(profiles.createdAt, startDate));
      } else {
        throw error;
      }
    }

    const [allWebsites, allOrders, allBookings] = await Promise.all([
      db.select().from(websites).where(and(gte(websites.createdAt, startDate), ne(websites.kind, "platform"))),
      db.select().from(orders).where(gte(orders.createdAt, startDate)),
      db.select().from(bookings).where(and(gte(bookings.createdAt, startDate), eq(bookings.context, "customer_site"))),
    ]);

    // Helper to safely parse date (handles both Date objects and strings)
    const toDateStr = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(d);
      return date.toISOString().split('T')[0];
    };

    // Group by date
    const dateMap: Record<string, AdminGrowthData> = {};
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dateMap[dateStr] = {
        date: dateStr,
        signups: 0,
        websitesCreated: 0,
        publishes: 0,
        orders: 0,
        bookings: 0,
      };
    }

    allProfiles.forEach(p => {
      const dateStr = toDateStr(p.createdAt);
      if (dateStr && dateMap[dateStr]) dateMap[dateStr].signups++;
    });

    allWebsites.forEach(w => {
      const dateStr = toDateStr(w.createdAt);
      if (dateStr && dateMap[dateStr]) dateMap[dateStr].websitesCreated++;
      if (w.lastPublishedAt) {
        const publishDateStr = toDateStr(w.lastPublishedAt);
        if (publishDateStr && dateMap[publishDateStr]) dateMap[publishDateStr].publishes++;
      }
    });

    allOrders.forEach(o => {
      const dateStr = toDateStr(o.createdAt);
      if (dateStr && dateMap[dateStr]) dateMap[dateStr].orders++;
    });

    allBookings.forEach(b => {
      const dateStr = toDateStr(b.createdAt);
      if (dateStr && dateMap[dateStr]) dateMap[dateStr].bookings++;
    });

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getAdminFunnel(): Promise<AdminFunnelStep[]> {
    let allProfiles: any[];
    try {
      allProfiles = await db.select().from(profiles);
    } catch (error: any) {
      if (error.message?.includes("is_admin")) {
        allProfiles = await db.select(this.profileColumns).from(profiles);
      } else {
        throw error;
      }
    }

    const [allWebsites, allOrders, allBookings] = await Promise.all([
      db.select().from(websites).where(ne(websites.kind, "platform")),
      db.select().from(orders),
      db.select().from(bookings).where(eq(bookings.context, "customer_site")),
    ]);

    const totalSignups = allProfiles.length;
    const verifiedUsers = allProfiles.filter(p => p.onboardingCompleted).length;
    const usersWithWebsites = new Set(allWebsites.map(w => w.ownerId)).size;
    const usersWithPublished = new Set(allWebsites.filter(w => w.status === 'published').map(w => w.ownerId)).size;
    const usersWithConversion = new Set([
      ...allOrders.map(o => {
        const website = allWebsites.find(w => w.id === o.websiteId);
        return website?.ownerId;
      }),
      ...allBookings.map(b => {
        const website = allWebsites.find(w => w.id === b.websiteId);
        return website?.ownerId;
      }),
    ].filter(Boolean)).size;

    const steps = [
      { name: 'Signups', count: totalSignups },
      { name: 'Verified', count: verifiedUsers },
      { name: 'Created Website', count: usersWithWebsites },
      { name: 'Published', count: usersWithPublished },
      { name: 'First Conversion', count: usersWithConversion },
    ];

    return steps.map((step, index) => ({
      name: step.name,
      count: step.count,
      percentage: totalSignups > 0 ? Math.round((step.count / totalSignups) * 100) : 0,
      dropoff: index > 0 ? Math.round(((steps[index - 1].count - step.count) / (steps[index - 1].count || 1)) * 100) : 0,
    }));
  }

  async getAllUsersWithStats(): Promise<AdminUserWithStats[]> {
    let allProfiles: any[];
    try {
      allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    } catch (error: any) {
      if (error.message?.includes("is_admin")) {
        allProfiles = await db.select(this.profileColumns).from(profiles).orderBy(desc(profiles.createdAt));
      } else {
        throw error;
      }
    }

    const [allWebsites, allOrders, allBookings] = await Promise.all([
      db.select().from(websites).where(ne(websites.kind, "platform")),
      db.select().from(orders),
      db.select().from(bookings).where(eq(bookings.context, "customer_site")),
    ]);

    return allProfiles.map(profile => {
      const userWebsites = allWebsites.filter(w => w.ownerId === profile.id);
      const websiteIds = userWebsites.map(w => w.id);
      const userOrders = allOrders.filter(o => websiteIds.includes(o.websiteId));
      const userBookings = allBookings.filter(b => websiteIds.includes(b.websiteId));

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        isAdmin: profile.isAdmin ?? false,
        isQa: isReservedQaFixtureEmail(profile.email),
        onboardingCompleted: profile.onboardingCompleted,
        createdAt: profile.createdAt,
        websiteCount: userWebsites.length,
        publishedCount: userWebsites.filter(w => w.status === 'published').length,
        totalOrders: userOrders.length,
        totalBookings: userBookings.length,
      };
    });
  }

  async getAllUsersWithSubscriptions(): Promise<AdminUserSubscription[]> {
    let allProfiles: any[];
    try {
      allProfiles = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    } catch (error: any) {
      if (error.message?.includes("is_admin")) {
        allProfiles = await db.select(this.profileColumns).from(profiles).orderBy(desc(profiles.createdAt));
      } else {
        throw error;
      }
    }

    const allWebsites = await db.select().from(websites).where(ne(websites.kind, "platform"));

    return allProfiles.map(profile => {
      const userWebsites = allWebsites.filter(w => w.ownerId === profile.id);

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        planSlug: profile.planSlug || null,
        subscriptionId: profile.subscriptionId || null,
        subscriptionStatus: profile.subscriptionStatus || null,
        subscriptionStartedAt: profile.subscriptionStartedAt || null,
        trialEndsAt: profile.trialEndsAt || null,
        currentPeriodEnd: profile.currentPeriodEnd || null,
        stripeCustomerId: profile.stripeCustomerId || null,
        createdAt: profile.createdAt,
        websiteCount: userWebsites.length,
      };
    });
  }

  async getAllWebsitesWithOwners(): Promise<AdminWebsiteWithOwner[]> {
    let allProfiles: any[];
    try {
      allProfiles = await db.select().from(profiles);
    } catch (error: any) {
      if (error.message?.includes("is_admin")) {
        allProfiles = await db.select(this.profileColumns).from(profiles);
      } else {
        throw error;
      }
    }

    const [allWebsites, allOrders, allBookings] = await Promise.all([
      db.select().from(websites).where(ne(websites.kind, "platform")).orderBy(desc(websites.createdAt)),
      db.select().from(orders),
      db.select().from(bookings).where(eq(bookings.context, "customer_site")),
    ]);

    const profileMap = new Map(allProfiles.map(p => [p.id, p]));

    return allWebsites.map(website => {
      const owner = profileMap.get(website.ownerId);
      const websiteOrders = allOrders.filter(o => o.websiteId === website.id);
      const websiteBookings = allBookings.filter(b => b.websiteId === website.id);

      return {
        id: website.id,
        name: website.name,
        slug: website.slug,
        status: website.status,
        plan: website.plan,
        deploymentUrl: website.deploymentUrl,
        lastPublishedAt: website.lastPublishedAt,
        createdAt: website.createdAt,
        ownerId: website.ownerId,
        ownerEmail: owner?.email ?? 'Unknown',
        ownerName: owner?.fullName ?? 'Unknown',
        isQa: isReservedQaFixtureEmail(owner?.email),
        orderCount: websiteOrders.length,
        bookingCount: websiteBookings.length,
      };
    });
  }

  // Admin analytics methods
  async getAdminAnalyticsOverview(startDate: Date, endDate: Date): Promise<AdminAnalyticsOverview> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      );

    const pageViews = events.filter(e => e.eventType === 'page_view');
    const orderEvents = events.filter(e => e.eventType === 'order_created');
    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;
    const activeWebsites = new Set(events.map(e => e.websiteId)).size;

    const totalRevenue = orderEvents.reduce((sum, e) => {
      const orderTotal = (e.eventData as any)?.orderTotal || 0;
      return sum + orderTotal;
    }, 0);

    const conversionRate = uniqueSessions > 0 
      ? (orderEvents.length / uniqueSessions) * 100 
      : 0;

    const avgOrderValue = orderEvents.length > 0 
      ? totalRevenue / orderEvents.length 
      : 0;

    return {
      totalPageViews: pageViews.length,
      uniqueSessions,
      totalOrders: orderEvents.length,
      totalRevenue: Math.round(totalRevenue) / 100, // Convert cents to dollars
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue) / 100,
      activeWebsites,
    };
  }

  async getAdminTrafficSources(startDate: Date, endDate: Date): Promise<AdminTrafficSource[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      );

    const sourceMap: Record<string, { visitors: Set<string>; pageViews: number }> = {};

    events.forEach(event => {
      const source = (event.eventData as any)?.utm_source || 'direct';
      if (!sourceMap[source]) {
        sourceMap[source] = { visitors: new Set(), pageViews: 0 };
      }
      sourceMap[source].visitors.add(event.sessionId);
      if (event.eventType === 'page_view') {
        sourceMap[source].pageViews++;
      }
    });

    const totalVisitors = new Set(events.map(e => e.sessionId)).size;

    const sources = Object.entries(sourceMap)
      .map(([source, data]) => ({
        source,
        visitors: data.visitors.size,
        pageViews: data.pageViews,
        percentage: totalVisitors > 0 
          ? Math.round((data.visitors.size / totalVisitors) * 10000) / 100 
          : 0,
      }))
      .sort((a, b) => b.visitors - a.visitors);

    return sources;
  }

  async getAdminDailyVisitors(startDate: Date, endDate: Date): Promise<AdminDailyVisitors[]> {
    const events = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.timestamp, startDate),
          lte(analyticsEvents.timestamp, endDate)
        )
      );

    // Helper to safely parse date
    const toDateStr = (d: Date | string | null | undefined): string | null => {
      if (!d) return null;
      const date = d instanceof Date ? d : new Date(d);
      return date.toISOString().split('T')[0];
    };

    // Group by date
    const dateMap: Record<string, { visitors: Set<string>; pageViews: number }> = {};

    events.forEach(event => {
      const dateStr = toDateStr(event.timestamp);
      if (!dateStr) return;
      
      if (!dateMap[dateStr]) {
        dateMap[dateStr] = { visitors: new Set(), pageViews: 0 };
      }
      dateMap[dateStr].visitors.add(event.sessionId);
      if (event.eventType === 'page_view') {
        dateMap[dateStr].pageViews++;
      }
    });

    return Object.entries(dateMap)
      .map(([date, data]) => ({
        date,
        visitors: data.visitors.size,
        pageViews: data.pageViews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async updateWebsiteAdmin(id: string, data: Partial<InsertWebsite>): Promise<Website | undefined> {
    const result = await db
      .update(websites)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(websites.id, id))
      .returning();
    return result[0];
  }

  async getWebsiteByStripeSubscriptionId(subscriptionId: string): Promise<Website | undefined> {
    const result = await db
      .select()
      .from(websites)
      .where(eq(websites.stripeSubscriptionId, subscriptionId))
      .limit(1);
    return result[0];
  }

  async updateProfileStripeCustomerId(userId: string, customerId: string): Promise<void> {
    await db
      .update(profiles)
      .set({ stripeCustomerId: customerId })
      .where(eq(profiles.id, userId));
  }

  async getLegalSettings(websiteId: string): Promise<LegalSettings | undefined> {
    const result = await db
      .select()
      .from(legalSettings)
      .where(eq(legalSettings.websiteId, websiteId))
      .limit(1);
    return result[0];
  }

  async createLegalSettings(settings: InsertLegalSettings): Promise<LegalSettings> {
    const result = await db
      .insert(legalSettings)
      .values(settings)
      .returning();
    return result[0];
  }

  async updateLegalSettings(websiteId: string, data: Partial<InsertLegalSettings>): Promise<LegalSettings | undefined> {
    const result = await db
      .update(legalSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(legalSettings.websiteId, websiteId))
      .returning();
    return result[0];
  }

  // Service availability methods
  async getServiceAvailability(serviceId: string): Promise<ServiceAvailability[]> {
    return db.select().from(serviceAvailability).where(eq(serviceAvailability.serviceId, serviceId));
  }

  async createServiceAvailability(availability: InsertServiceAvailability): Promise<ServiceAvailability> {
    const result = await db.insert(serviceAvailability).values(availability as any).returning();
    return result[0];
  }

  async updateServiceAvailability(id: string, data: Partial<InsertServiceAvailability>): Promise<ServiceAvailability | undefined> {
    const result = await db
      .update(serviceAvailability)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(serviceAvailability.id, id))
      .returning();
    return result[0];
  }

  async deleteServiceAvailability(id: string): Promise<void> {
    await db.delete(serviceAvailability).where(eq(serviceAvailability.id, id));
  }

  async getAvailableSlotsForDate(serviceId: string, websiteId: string, date: string, teamMemberId?: string): Promise<AvailableSlot[]> {
    // Get the service to know the duration
    const service = await db.select().from(bookingServices)
      .where(and(eq(bookingServices.id, serviceId), eq(bookingServices.websiteId, websiteId)))
      .limit(1);
    
    if (!service[0]) return [];
    
    const durationMinutes = service[0].durationMinutes || 30;

    // Optional team member filter
    let member: BookingTeamMember | undefined;
    if (teamMemberId) {
      member = await this.getTeamMember(teamMemberId, websiteId);
      if (!member || !member.active) return [];
    }
    const memberServiceIds = Array.isArray(member?.serviceIds) ? member!.serviceIds : [];
    const memberWindows = Array.isArray(member?.availability) ? member!.availability : [];
    const memberPerformsService = !member || memberServiceIds.length === 0 || memberServiceIds.includes(serviceId);
    
    // Parse the date to get day of week (0 = Sunday, 1 = Monday, etc.)
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();
    
    // Get availability rules for this service and day
    const availabilityRules = await db.select().from(serviceAvailability)
      .where(
        and(
          eq(serviceAvailability.serviceId, serviceId),
          eq(serviceAvailability.isActive, true),
          sql`(${serviceAvailability.dayOfWeek} = ${dayOfWeek} OR ${serviceAvailability.specificDate} = ${date})`
        )
      );
    
    // Existing bookings for this date - all services, needed for member overlap checks
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');
    
    const dayBookings = await db.select().from(bookings)
      .where(
        and(
          eq(bookings.websiteId, websiteId),
          gte(bookings.date, startOfDay),
          lte(bookings.date, endOfDay),
          sql`${bookings.status} != 'cancelled'`
        )
      );
    
    // Same-service exact-time collisions (original behavior)
    const bookedTimes = new Set(
      dayBookings.filter(b => b.serviceId === serviceId).map(b => b.time).filter(Boolean)
    );

    // Member busy check: interval overlap against ALL of the member's bookings that day
    const memberBusy = (startMin: number, slotDur: number): boolean => {
      if (!member) return false;
      return dayBookings.some(b =>
        b.teamMemberId === member!.id &&
        b.time && TIME_RE.test(b.time) &&
        intervalsOverlap(startMin, slotDur, timeToMinutes(b.time.slice(0, 5)), b.durationMinutes || 60)
      );
    };

    // Member weekly windows: empty = always available
    const memberWindowOk = (startMin: number, slotDur: number): boolean => {
      if (!member || memberWindows.length === 0) return true;
      return memberWindows.some(w =>
        w.dayOfWeek === dayOfWeek &&
        timeToMinutes(w.startTime) <= startMin &&
        startMin + slotDur <= timeToMinutes(w.endTime)
      );
    };
    
    // Generate all possible slots from the service availability rules
    const slots: AvailableSlot[] = [];
    
    if (memberPerformsService) {
      for (const rule of availabilityRules) {
        const slotDuration = rule.slotDurationMinutes || durationMinutes;
        const [startHour, startMin] = rule.startTime.split(':').map(Number);
        const [endHour, endMin] = rule.endTime.split(':').map(Number);
        
        let currentTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        while (currentTime + slotDuration <= endTime) {
          const hours = Math.floor(currentTime / 60);
          const mins = currentTime % 60;
          const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          
          if (memberWindowOk(currentTime, slotDuration)) {
            // Check if this slot is already added (from another rule)
            const existingSlot = slots.find(s => s.time === timeStr);
            if (!existingSlot) {
              slots.push({
                time: timeStr,
                available: !bookedTimes.has(timeStr) && !memberBusy(currentTime, slotDuration)
              });
            }
          }
          
          currentTime += slotDuration;
        }
      }
    }

    // Merge owner-placed open slots - offered even outside the regular rules
    const openSlotRows = await db.select().from(bookingOpenSlots)
      .where(
        and(
          eq(bookingOpenSlots.websiteId, websiteId),
          eq(bookingOpenSlots.date, date),
          eq(bookingOpenSlots.status, 'open')
        )
      );

    for (const openSlot of openSlotRows) {
      if (openSlot.serviceId && openSlot.serviceId !== serviceId) continue;
      if (teamMemberId && openSlot.teamMemberId && openSlot.teamMemberId !== teamMemberId) continue;
      if (!TIME_RE.test(openSlot.time)) continue;
      // Selected member must actually be free at the open slot's time
      if (member && memberBusy(timeToMinutes(openSlot.time.slice(0, 5)), openSlot.durationMinutes || durationMinutes)) continue;
      // Keep regular slots as-is; only add times not already offered
      if (slots.find(s => s.time === openSlot.time)) continue;
      slots.push({
        time: openSlot.time,
        available: true,
        openSlotId: openSlot.id,
        teamMemberId: openSlot.teamMemberId,
      });
    }
    
    // Sort by time
    slots.sort((a, b) => a.time.localeCompare(b.time));
    
    return slots;
  }

  async checkSlotAvailable(serviceId: string, websiteId: string, date: string, time: string, teamMemberId?: string): Promise<boolean> {
    // First check if this slot is within availability rules
    const slots = await this.getAvailableSlotsForDate(serviceId, websiteId, date, teamMemberId);
    const slot = slots.find(s => s.time === time);
    return slot?.available ?? false;
  }

  // Service blocked dates methods
  async getServiceBlockedDates(serviceId: string): Promise<ServiceBlockedDate[]> {
    return db.select().from(serviceBlockedDates)
      .where(eq(serviceBlockedDates.serviceId, serviceId))
      .orderBy(serviceBlockedDates.blockedDate);
  }

  async createServiceBlockedDate(blockedDate: InsertServiceBlockedDate): Promise<ServiceBlockedDate> {
    const result = await db.insert(serviceBlockedDates).values(blockedDate as any).returning();
    return result[0];
  }

  async deleteServiceBlockedDate(id: string): Promise<void> {
    await db.delete(serviceBlockedDates).where(eq(serviceBlockedDates.id, id));
  }

  async isDateBlocked(serviceId: string, date: string): Promise<boolean> {
    // Parse the date to check for yearly recurring blocks
    const [year, month, day] = date.split('-');
    const monthDay = `${month}-${day}`;
    
    const blocked = await db.select().from(serviceBlockedDates)
      .where(
        and(
          eq(serviceBlockedDates.serviceId, serviceId),
          sql`(${serviceBlockedDates.blockedDate} = ${date} OR (${serviceBlockedDates.isRecurringYearly} = true AND SUBSTRING(${serviceBlockedDates.blockedDate}, 6) = ${monthDay}))`
        )
      )
      .limit(1);
    
    return blocked.length > 0;
  }

  // Service date ranges methods
  async getServiceDateRanges(serviceId: string): Promise<ServiceDateRange[]> {
    return db.select().from(serviceDateRanges)
      .where(eq(serviceDateRanges.serviceId, serviceId))
      .orderBy(serviceDateRanges.startDate);
  }

  async createServiceDateRange(dateRange: InsertServiceDateRange): Promise<ServiceDateRange> {
    const result = await db.insert(serviceDateRanges).values(dateRange as any).returning();
    return result[0];
  }

  async updateServiceDateRange(id: string, data: Partial<InsertServiceDateRange>): Promise<ServiceDateRange | undefined> {
    const result = await db.update(serviceDateRanges)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(serviceDateRanges.id, id))
      .returning();
    return result[0];
  }

  async deleteServiceDateRange(id: string): Promise<void> {
    await db.delete(serviceDateRanges).where(eq(serviceDateRanges.id, id));
  }

  async isDateInActiveRange(serviceId: string, date: string): Promise<boolean> {
    // Get all active date ranges for this service
    const ranges = await db.select().from(serviceDateRanges)
      .where(
        and(
          eq(serviceDateRanges.serviceId, serviceId),
          eq(serviceDateRanges.isActive, true)
        )
      );
    
    // If no ranges defined, the service is always available (default behavior)
    if (ranges.length === 0) return true;
    
    // Check if date falls within any active range
    for (const range of ranges) {
      if (date >= range.startDate && (!range.endDate || date <= range.endDate)) {
        return true;
      }
    }
    
    return false;
  }

  // Full availability check (combines all rules)
  async getFullServiceAvailability(serviceId: string, websiteId: string, month: number, year: number): Promise<{
    availableDates: string[];
    blockedDates: { date: string; reason?: string }[];
    dateRange: { startDate: string; endDate: string | null } | null;
    weeklySchedule: { dayOfWeek: number; startTime: string; endTime: string }[];
  }> {
    // Get the service
    const service = await db.select().from(bookingServices)
      .where(and(eq(bookingServices.id, serviceId), eq(bookingServices.websiteId, websiteId)))
      .limit(1);
    
    if (!service[0]) {
      return { availableDates: [], blockedDates: [], dateRange: null, weeklySchedule: [] };
    }

    // Get weekly schedule
    const weeklyRules = await db.select().from(serviceAvailability)
      .where(
        and(
          eq(serviceAvailability.serviceId, serviceId),
          eq(serviceAvailability.isActive, true),
          sql`${serviceAvailability.dayOfWeek} IS NOT NULL`
        )
      );
    
    const weeklySchedule = weeklyRules.map(rule => ({
      dayOfWeek: rule.dayOfWeek!,
      startTime: rule.startTime,
      endTime: rule.endTime
    }));

    // Get active date range (use first active one)
    const ranges = await db.select().from(serviceDateRanges)
      .where(
        and(
          eq(serviceDateRanges.serviceId, serviceId),
          eq(serviceDateRanges.isActive, true)
        )
      )
      .limit(1);
    
    const dateRange = ranges[0] ? {
      startDate: ranges[0].startDate,
      endDate: ranges[0].endDate
    } : null;

    // Get all blocked dates for this service
    const blockedDateRecords = await this.getServiceBlockedDates(serviceId);
    
    // Calculate available dates for the month
    const availableDates: string[] = [];
    const blockedDates: { date: string; reason?: string }[] = [];
    
    // Get number of days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    // Set of available day of week numbers
    const availableDays = new Set(weeklySchedule.map(s => s.dayOfWeek));
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dateObj = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = dateObj.getDay();
      
      // Check if date is in active range
      const inRange = !dateRange || (dateStr >= dateRange.startDate && (!dateRange.endDate || dateStr <= dateRange.endDate));
      
      // Check if day of week is available
      const dayAvailable = weeklySchedule.length === 0 || availableDays.has(dayOfWeek);
      
      // Check if date is blocked
      const blockedRecord = blockedDateRecords.find(b => {
        if (b.blockedDate === dateStr) return true;
        if (b.isRecurringYearly) {
          const [, bMonth, bDay] = b.blockedDate.split('-');
          const [, currentMonth, currentDay] = dateStr.split('-');
          return bMonth === currentMonth && bDay === currentDay;
        }
        return false;
      });
      
      if (blockedRecord) {
        blockedDates.push({ date: dateStr, reason: blockedRecord.reason || undefined });
      } else if (inRange && dayAvailable) {
        // Only add future dates as available
        if (dateObj >= new Date(new Date().setHours(0, 0, 0, 0))) {
          availableDates.push(dateStr);
        }
      }
    }

    // Owner-placed open slots make their dates bookable even outside weekly rules
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
    const openSlotRows = await db.select().from(bookingOpenSlots)
      .where(
        and(
          eq(bookingOpenSlots.websiteId, websiteId),
          eq(bookingOpenSlots.status, 'open'),
          sql`${bookingOpenSlots.date} LIKE ${monthPrefix + '%'}`
        )
      );
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
    const availableSet = new Set(availableDates);
    for (const slot of openSlotRows) {
      if (slot.serviceId && slot.serviceId !== serviceId) continue;
      if (new Date(slot.date + 'T00:00:00') < todayStart) continue;
      if (!availableSet.has(slot.date)) {
        availableSet.add(slot.date);
        availableDates.push(slot.date);
      }
    }
    availableDates.sort();
    
    return { availableDates, blockedDates, dateRange, weeklySchedule };
  }

  // Support ticket methods
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const result = await db.insert(supportTickets).values(ticket).returning();
    return result[0];
  }

  async getSupportTickets(): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<SupportTicket | undefined> {
    const result = await db.update(supportTickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId))
      .returning();
    return result[0];
  }

  // ── Account component library ─────────────────────────────────────────────

  async createAccountComponent(data: InsertAccountComponent): Promise<AccountComponent> {
    const result = await db.insert(accountComponents).values({
      ownerId: data.ownerId,
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      tags: data.tags ?? null,
      tree: data.tree as any,
      schema: (data.schema ?? null) as any,
      designMetadata: (data.designMetadata ?? null) as any,
      origin: data.origin ?? "customer",
      createdFromWebsiteId: data.createdFromWebsiteId ?? null,
      version: data.version ?? 1,
    }).returning();
    return result[0]!;
  }

  async getAccountComponent(id: string, ownerId: string): Promise<AccountComponent | undefined> {
    const result = await db
      .select()
      .from(accountComponents)
      .where(and(eq(accountComponents.id, id), eq(accountComponents.ownerId, ownerId)));
    return result[0];
  }

  async listAccountComponents(ownerId: string): Promise<AccountComponent[]> {
    return db
      .select()
      .from(accountComponents)
      .where(eq(accountComponents.ownerId, ownerId))
      .orderBy(desc(accountComponents.createdAt));
  }

  async updateAccountComponent(
    id: string,
    ownerId: string,
    data: Partial<InsertAccountComponent>
  ): Promise<AccountComponent | undefined> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags as any;
    if (data.tree !== undefined) updateData.tree = data.tree as any;
    if (data.schema !== undefined) updateData.schema = data.schema as any;
    if (data.designMetadata !== undefined) updateData.designMetadata = data.designMetadata as any;
    const result = await db
      .update(accountComponents)
      .set(updateData as any)
      .where(and(eq(accountComponents.id, id), eq(accountComponents.ownerId, ownerId)))
      .returning();
    return result[0];
  }

  async deleteAccountComponent(id: string, ownerId: string): Promise<boolean> {
    const result = await db
      .delete(accountComponents)
      .where(and(eq(accountComponents.id, id), eq(accountComponents.ownerId, ownerId)))
      .returning();
    return result.length > 0;
  }

  async createNewAccountComponentVersion(
    id: string,
    ownerId: string,
    tree: unknown,
    schema: unknown
  ): Promise<AccountComponent | undefined> {
    const result = await db
      .update(accountComponents)
      .set({
        tree: tree as any,
        schema: schema as any,
        version: sql`${accountComponents.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(accountComponents.id, id), eq(accountComponents.ownerId, ownerId)))
      .returning();
    return result[0];
  }

  async updateAllLinkedInstances(
    componentId: string,
    ownerId: string
  ): Promise<{ updatedWebsites: string[] }> {
    // 1. Get the latest version of the component.
    const comp = await this.getAccountComponent(componentId, ownerId);
    if (!comp) return { updatedWebsites: [] };

    // 2. Find all websites owned by this user that reference this component
    //    in their builder state (LIKE scan over JSONB text — acceptable for
    //    the few websites a typical user has).
    const rows = await db.execute(sql`
      SELECT bs.website_id, bs.state, bs.revision
      FROM builder_state bs
      JOIN websites w ON w.id = bs.website_id
      WHERE w.owner_id = ${ownerId}
        AND bs.state::text LIKE ${'%"accountComponentId":"' + componentId + '"%'}
    `);

    const updated: string[] = [];
    for (const row of rows.rows as any[]) {
      try {
        const state = row.state as import("@shared/schema").BuilderStateData;
        let changed = false;
        for (const page of state.pages ?? []) {
          for (const component of page.components ?? []) {
            const props = (component as any).props ?? {};
            if (props?.libraryRef?.accountComponentId === componentId) {
              props.customTree = comp.tree;
              if (comp.schema != null) props.customSchema = comp.schema;
              props.libraryRef = {
                ...props.libraryRef,
                version: comp.version,
              };
              changed = true;
            }
          }
        }
        if (changed) {
          // Increment the revision so any open builder client sees a conflict
          // signal on its next guarded save rather than silently overwriting
          // the newly propagated tree. This mirrors the same revision-bump
          // that updateBuilderState applies on every normal save.
          await db
            .update(builderState)
            .set({
              state: state as any,
              updatedAt: new Date(),
              revision: sql`${builderState.revision} + 1`,
            })
            .where(eq(builderState.websiteId, row.website_id));
          updated.push(row.website_id);
        }
      } catch {
        // Skip websites we can't update — non-fatal
      }
    }
    return { updatedWebsites: updated };
  }
}

export const storage = new DatabaseStorage();
