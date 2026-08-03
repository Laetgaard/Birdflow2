// Platform-side polling scheduler for booking reminder and follow-up emails.
// Published sites write bookings directly to Supabase, so there is no
// in-request hook — this poller is the single place automation emails fire.
// Claim-based marking (UPDATE ... WHERE sent_at IS NULL RETURNING) keeps
// sends at-most-once even if dev and prod run against the same database.

import { and, eq, gte, inArray, isNull, isNotNull, lte } from 'drizzle-orm';
import { bookings, emailSettings } from '@shared/schema';
import { db } from '../storage';
import { emailService } from './service';
import { bookingStartUtc, bookingEndUtc } from './bookingTime';

const TICK_MS = 60_000;
const MAX_SENDS_PER_TICK = 25;
// Don't blast follow-ups/reminders for bookings that were already old when
// the feature shipped (or when the app was down for a long stretch).
const FOLLOWUP_MAX_AGE_MS = 72 * 3600 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startBookingEmailScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  if (typeof timer.unref === 'function') timer.unref();
  console.log('[BookingScheduler] Started (60s interval)');
}

export function stopBookingEmailScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Exported for tests
export async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await processReminders();
    await processFollowups();
  } catch (err) {
    console.error('[BookingScheduler] Tick failed:', err);
  } finally {
    running = false;
  }
}

async function claimReminder(bookingId: string): Promise<boolean> {
  const result = await db
    .update(bookings)
    .set({ reminderSentAt: new Date() })
    .where(and(eq(bookings.id, bookingId), isNull(bookings.reminderSentAt)))
    .returning({ id: bookings.id });
  return result.length > 0;
}

async function claimFollowup(bookingId: string): Promise<boolean> {
  const result = await db
    .update(bookings)
    .set({ followupSentAt: new Date() })
    .where(and(eq(bookings.id, bookingId), isNull(bookings.followupSentAt)))
    .returning({ id: bookings.id });
  return result.length > 0;
}

async function processReminders(): Promise<void> {
  const now = Date.now();
  const floor = new Date(now - 24 * 3600 * 1000);
  const horizon = new Date(now + 14 * 24 * 3600 * 1000);

  const rows = await db
    .select({ booking: bookings, settings: emailSettings })
    .from(bookings)
    .leftJoin(emailSettings, eq(emailSettings.websiteId, bookings.websiteId))
    .where(
      and(
        isNull(bookings.reminderSentAt),
        // Deliberately context-agnostic: a reminder before a booked meeting is
        // just as useful for BirdFlow's own onboarding meetings, and they carry
        // their own templates and lead time via the platform calendar's
        // email settings. Follow-ups below are customer-site only.
        eq(bookings.sendReminder, true),
        inArray(bookings.status, ['pending', 'confirmed']),
        isNotNull(bookings.customerEmail),
        gte(bookings.date, floor),
        lte(bookings.date, horizon)
      )
    )
    .limit(200);

  let sends = 0;
  for (const { booking, settings } of rows) {
    if (sends >= MAX_SENDS_PER_TICK) break;
    // Missing settings row falls back to defaults (reminder enabled, 48h lead)
    if (settings && !settings.bookingReminderEnabled) continue;
    if (!booking.customerEmail) continue;

    const start = bookingStartUtc(booking);
    if (!start) continue;
    const leadHours = settings?.bookingReminderLeadHours ?? 48;
    const dueAt = start.getTime() - leadHours * 3600 * 1000;

    if (now < dueAt) continue; // not due yet

    if (now >= start.getTime()) {
      // Appointment already started/past — expire silently instead of sending late
      await claimReminder(booking.id);
      continue;
    }

    const createdAtMs = booking.createdAt
      ? new Date(booking.createdAt).getTime()
      : 0;
    if (createdAtMs > dueAt) {
      // Booked inside the reminder window — the confirmation email just went
      // out, a reminder minutes later would be noise
      await claimReminder(booking.id);
      continue;
    }

    const claimed = await claimReminder(booking.id);
    if (!claimed) continue; // another instance got it
    sends++;
    try {
      const ok = await emailService.sendBookingReminder(
        booking,
        booking.customerEmail,
        booking.service
      );
      console.log(
        `[BookingScheduler] Reminder for booking ${booking.id}: ${ok ? 'sent' : 'skipped or failed'}`
      );
    } catch (err) {
      console.error(
        `[BookingScheduler] Reminder send crashed for booking ${booking.id}:`,
        err
      );
    }
  }
}

async function processFollowups(): Promise<void> {
  const now = Date.now();
  // Window must cover the maximum configurable delay (720h = 30d) plus the
  // 72h overdue grace, otherwise long delays never fire.
  const floor = new Date(now - 35 * 24 * 3600 * 1000);
  const ceiling = new Date(now);

  const rows = await db
    .select({ booking: bookings, settings: emailSettings })
    .from(bookings)
    .innerJoin(emailSettings, eq(emailSettings.websiteId, bookings.websiteId))
    .where(
      and(
        isNull(bookings.followupSentAt),
        // Customer appointments only. A "thank you for your visit, book again"
        // mail makes no sense after one of BirdFlow's own onboarding meetings.
        eq(bookings.context, 'customer_site'),
        eq(emailSettings.bookingFollowupEnabled, true),
        inArray(bookings.status, ['pending', 'confirmed']),
        isNotNull(bookings.customerEmail),
        gte(bookings.date, floor),
        lte(bookings.date, ceiling)
      )
    )
    .limit(200);

  let sends = 0;
  for (const { booking, settings } of rows) {
    if (sends >= MAX_SENDS_PER_TICK) break;
    if (!booking.customerEmail) continue;

    const end = bookingEndUtc(booking);
    if (!end) continue;
    const delayHours = settings.bookingFollowupDelayHours ?? 24;
    const dueAt = end.getTime() + delayHours * 3600 * 1000;

    if (now < dueAt) continue; // appointment not finished + delay not elapsed

    if (now - dueAt > FOLLOWUP_MAX_AGE_MS) {
      // Too old — expire silently (avoids blasting historical bookings)
      await claimFollowup(booking.id);
      continue;
    }

    const claimed = await claimFollowup(booking.id);
    if (!claimed) continue;
    sends++;
    try {
      const ok = await emailService.sendBookingFollowup(
        booking,
        booking.customerEmail,
        booking.service
      );
      console.log(
        `[BookingScheduler] Follow-up for booking ${booking.id}: ${ok ? 'sent' : 'skipped or failed'}`
      );
    } catch (err) {
      console.error(
        `[BookingScheduler] Follow-up send crashed for booking ${booking.id}:`,
        err
      );
    }
  }
}
