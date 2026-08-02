/**
 * BirdFlow's own booking calendar.
 *
 * The booking engine (services, weekly availability, open slots, atomic slot
 * claim, conflict checks, confirmation emails) is built around a `websites`
 * row. To host BirdFlow's own 30-minute improvement meetings we give the
 * platform a first-class calendar of its own: a `websites` row with
 * `kind = 'platform'`, owned by the PLATFORM_CALENDAR_OWNER_ID sentinel rather
 * than a fake customer account. Everything else - the service, the weekly
 * hours, the bookings - is ordinary booking-engine data hanging off that row.
 *
 * The row is created idempotently at boot (and lazily on first use), so a
 * fresh environment ends up with a working calendar without anyone touching
 * the database by hand. Development and production share one Supabase
 * database, so creation is serialised behind a Postgres advisory lock and
 * backed by a partial unique index (see
 * scripts/applyPlatformCalendarSchema.ts).
 */
import { and, eq, sql } from "drizzle-orm";
import {
  bookingServices,
  emailSettings,
  emailTemplates,
  serviceAvailability,
  websites,
  PLATFORM_CALENDAR_NAME,
  PLATFORM_CALENDAR_OWNER_ID,
  PLATFORM_CALENDAR_SLUG,
  PLATFORM_MEETING_DURATION_MINUTES,
  PLATFORM_MEETING_SERVICE_NAME,
  type BookingService,
  type ServiceAvailability,
  type Website,
} from "@shared/schema";
import { db } from "./storage";
import { ensurePlatformCalendarSchema } from "./platformCalendarSchema";

export type PlatformCalendar = {
  website: Website;
  service: BookingService;
};

/**
 * Default weekly hours for the improvement meeting, as Europe/Copenhagen wall
 * clock. Only the seed: the hours are editable from the admin Bookinger tab
 * afterwards, and re-seeding never overwrites what is already there.
 */
export const PLATFORM_MEETING_DEFAULT_HOURS: Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}> = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "16:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "16:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "16:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "16:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "14:00" },
];

const PLATFORM_MEETING_DESCRIPTION =
  "Et gratis 30-minutters møde hvor vi gennemgår din hjemmeside og finpudser den sammen.";

/**
 * Danish, BirdFlow-branded copy for the mails this calendar sends. Seeded once;
 * editing a template afterwards sticks.
 */
const PLATFORM_EMAIL_TEMPLATES: Record<
  string,
  { subject: string; heading: string; bodyText: string; buttonText?: string }
> = {
  booking_confirmation: {
    subject: "Din tid er booket - {{serviceName}}",
    heading: "Vi glæder os til at tale med dig",
    bodyText:
      "Dit gratis forbedringsmøde med BirdFlow er bekræftet. Vi ringer dig op på det aftalte tidspunkt og gennemgår din hjemmeside sammen. Kalenderinvitationen er vedhæftet.",
  },
  booking_updated: {
    subject: "Dit møde er flyttet - {{serviceName}}",
    heading: "Dit møde har fået et nyt tidspunkt",
    bodyText:
      "Tidspunktet for dit forbedringsmøde med BirdFlow er ændret. Den opdaterede kalenderinvitation er vedhæftet.",
  },
  booking_cancelled: {
    subject: "Dit møde er aflyst - {{serviceName}}",
    heading: "Dit møde er aflyst",
    bodyText:
      "Dit forbedringsmøde med BirdFlow er aflyst. Du er altid velkommen til at booke et nyt tidspunkt.",
  },
  booking_reminder: {
    subject: "Husk dit møde {{date}} - {{serviceName}}",
    heading: "Vi ses snart",
    bodyText:
      "Dette er en venlig påmindelse om dit kommende forbedringsmøde med BirdFlow.",
  },
  platform_meeting_notification: {
    subject: "Nyt forbedringsmøde booket - {{date}} {{time}}",
    heading: "Der er booket et nyt møde",
    bodyText: "En kunde har booket et forbedringsmøde. Detaljerne står nedenfor.",
  },
};

// Stable, arbitrary key. Serialises calendar creation across the processes
// that share this database (dev and prod both boot against it).
const ENSURE_ADVISORY_LOCK_KEY = 815_2367;

let cached: PlatformCalendar | null = null;
let inflight: Promise<PlatformCalendar> | null = null;

/** Test seam - drops the in-process cache. */
export function resetPlatformCalendarCache(): void {
  cached = null;
  inflight = null;
}

export function isPlatformCalendarWebsite(
  website: Pick<Website, "kind"> | undefined | null
): boolean {
  return website?.kind === "platform";
}

/**
 * Resolve BirdFlow's calendar, creating it (and its meeting service, weekly
 * hours and email defaults) if this environment has never had one. Safe to
 * call concurrently and on every request.
 */
export async function getPlatformCalendar(): Promise<PlatformCalendar> {
  if (cached) return cached;
  if (!inflight) {
    inflight = ensurePlatformCalendar().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export async function ensurePlatformCalendar(): Promise<PlatformCalendar> {
  const calendar = await db.transaction(async (tx) => {
    // Transaction-scoped: released automatically on commit or rollback.
    await tx.execute(sql`select pg_advisory_xact_lock(${ENSURE_ADVISORY_LOCK_KEY})`);

    // The columns this calendar depends on must exist before the first query
    // that reads them. This project has no migration runner, so the DDL is
    // applied here - idempotently, inside the same lock, so a deployment onto
    // the pre-feature schema migrates itself exactly once.
    await ensurePlatformCalendarSchema(tx);

    const website = await ensureWebsiteRow(tx);
    const service = await ensureMeetingService(tx, website.id);
    await ensureDefaultHours(tx, website.id, service.id);
    await ensureEmailDefaults(tx, website.id);

    return { website, service };
  });

  cached = calendar;
  return calendar;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureWebsiteRow(tx: Tx): Promise<Website> {
  const existing = await tx
    .select()
    .from(websites)
    .where(eq(websites.kind, "platform"))
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await tx
    .insert(websites)
    .values({
      ownerId: PLATFORM_CALENDAR_OWNER_ID,
      name: PLATFORM_CALENDAR_NAME,
      slug: PLATFORM_CALENDAR_SLUG,
      // Never published, never billed - it exists only to carry bookings.
      status: "draft",
      setupType: "platform",
      kind: "platform",
      currency: "DKK",
    })
    .returning();

  console.log(`[PlatformCalendar] created platform calendar ${inserted[0].id}`);
  return inserted[0];
}

async function ensureMeetingService(
  tx: Tx,
  websiteId: string
): Promise<BookingService> {
  const existing = await tx
    .select()
    .from(bookingServices)
    .where(
      and(
        eq(bookingServices.websiteId, websiteId),
        eq(bookingServices.name, PLATFORM_MEETING_SERVICE_NAME)
      )
    )
    .limit(1);
  if (existing[0]) return existing[0];

  const inserted = await tx
    .insert(bookingServices)
    .values({
      websiteId,
      name: PLATFORM_MEETING_SERVICE_NAME,
      description: PLATFORM_MEETING_DESCRIPTION,
      durationMinutes: PLATFORM_MEETING_DURATION_MINUTES,
      price: "0",
      currency: "DKK",
      // `active` is a text column on this table, not a boolean.
      active: "true",
      sortOrder: 0,
    })
    .returning();

  console.log(
    `[PlatformCalendar] created meeting service ${inserted[0].id} (${PLATFORM_MEETING_SERVICE_NAME})`
  );
  return inserted[0];
}

async function ensureDefaultHours(
  tx: Tx,
  websiteId: string,
  serviceId: string
): Promise<ServiceAvailability[]> {
  const existing = await tx
    .select()
    .from(serviceAvailability)
    .where(eq(serviceAvailability.serviceId, serviceId));

  // Seed once. If the admin has since deleted every rule on purpose we must
  // not silently put them back, so the presence of ANY rule is the signal.
  if (existing.length > 0) return existing;

  const inserted = await tx
    .insert(serviceAvailability)
    .values(
      PLATFORM_MEETING_DEFAULT_HOURS.map((hours) => ({
        serviceId,
        websiteId,
        dayOfWeek: hours.dayOfWeek,
        specificDate: null,
        startTime: hours.startTime,
        endTime: hours.endTime,
        slotDurationMinutes: PLATFORM_MEETING_DURATION_MINUTES,
        isActive: true,
      }))
    )
    .returning();

  console.log(
    `[PlatformCalendar] seeded ${inserted.length} default weekly availability rules`
  );
  return inserted;
}

async function ensureEmailDefaults(tx: Tx, websiteId: string): Promise<void> {
  const settings = await tx
    .select()
    .from(emailSettings)
    .where(eq(emailSettings.websiteId, websiteId))
    .limit(1);

  if (!settings[0]) {
    await tx.insert(emailSettings).values({
      websiteId,
      senderName: PLATFORM_CALENDAR_NAME,
      // A "thank you for visiting, book again" mail makes no sense for an
      // internal onboarding meeting.
      bookingFollowupEnabled: false,
      bookingReminderEnabled: true,
      bookingReminderLeadHours: 24,
    });
  }

  const existingTemplates = await tx
    .select({ templateType: emailTemplates.templateType })
    .from(emailTemplates)
    .where(eq(emailTemplates.websiteId, websiteId));
  const existingTypes = new Set(existingTemplates.map((t) => t.templateType));

  const missing = Object.entries(PLATFORM_EMAIL_TEMPLATES).filter(
    ([type]) => !existingTypes.has(type)
  );
  if (missing.length === 0) return;

  await tx.insert(emailTemplates).values(
    missing.map(([templateType, template]) => ({
      websiteId,
      templateType,
      subject: template.subject,
      heading: template.heading,
      bodyText: template.bodyText,
      buttonText: template.buttonText ?? null,
    }))
  );
}
