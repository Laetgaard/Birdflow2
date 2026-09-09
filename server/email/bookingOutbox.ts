import { and, asc, eq, isNull, lte, or, lt } from "drizzle-orm";
import crypto from "node:crypto";
import { bookingNotificationOutbox, bookings } from "@shared/schema";
import { db, storage } from "../storage";
import { emailService } from "./service";

/** Delivers transactional booking notifications without making HTTP requests wait on SMTP. */
export async function processBookingNotificationOutbox(limit = 25): Promise<void> {
  const rows = await db.select({ event: bookingNotificationOutbox, booking: bookings })
    .from(bookingNotificationOutbox)
    .innerJoin(bookings, eq(bookings.id, bookingNotificationOutbox.bookingId))
    .where(and(isNull(bookingNotificationOutbox.sentAt), lte(bookingNotificationOutbox.availableAt, new Date()),
      or(isNull(bookingNotificationOutbox.processingStartedAt), lt(bookingNotificationOutbox.processingStartedAt, new Date(Date.now() - 10 * 60_000)))))
    .orderBy(asc(bookingNotificationOutbox.createdAt)).limit(limit);
  for (const row of rows) {
    const token = crypto.randomUUID();
    const claimed = await db.update(bookingNotificationOutbox)
      .set({ attempts: row.event.attempts + 1, processingStartedAt: new Date(), claimToken: token })
      .where(and(eq(bookingNotificationOutbox.id, row.event.id), isNull(bookingNotificationOutbox.sentAt),
        or(isNull(bookingNotificationOutbox.processingStartedAt), lt(bookingNotificationOutbox.processingStartedAt, new Date(Date.now() - 10 * 60_000)))))
      .returning({ id: bookingNotificationOutbox.id });
    if (!claimed.length) continue;
    try {
      const email = row.booking.customerEmail;
      if (!email) throw new Error("Booking has no customer email");
      const payload = row.event.payload || {};
      const service = String(payload.serviceName || row.booking.service);
      const settings = await storage.getEmailSettings(row.event.websiteId);
      const enabled = row.event.eventType === "booking_confirmation"
        ? settings?.bookingConfirmationEnabled !== false
        : row.event.eventType === "booking_cancelled"
          ? settings?.bookingCancelledEnabled !== false
          : settings?.bookingUpdatedEnabled !== false;
      if (!enabled) {
        await db.update(bookingNotificationOutbox)
          .set({ sentAt: new Date(), lastError: "disabled_by_owner", processingStartedAt: null, claimToken: null })
          .where(and(eq(bookingNotificationOutbox.id, row.event.id), eq(bookingNotificationOutbox.claimToken, token)));
        continue;
      }
      let delivered: boolean;
      if (row.event.eventType === "booking_confirmation")
        delivered = await emailService.sendBookingConfirmation(row.booking, email, service, payload.websiteUrl as string | undefined, row.event.idempotencyKey);
      else if (row.event.eventType === "booking_cancelled")
        delivered = await emailService.sendBookingCancelled(row.booking, email, service, row.event.idempotencyKey);
      else delivered = await emailService.sendBookingUpdated(row.booking, email, service, payload.websiteUrl as string | undefined, row.event.idempotencyKey);
      if (!delivered) throw new Error("Email provider did not confirm delivery");
      await db.update(bookingNotificationOutbox).set({ sentAt: new Date(), lastError: null, processingStartedAt: null, claimToken: null })
        .where(and(eq(bookingNotificationOutbox.id, row.event.id), eq(bookingNotificationOutbox.claimToken, token)));
    } catch (error: any) {
      await db.update(bookingNotificationOutbox).set({ lastError: String(error?.message || error), processingStartedAt: null, claimToken: null, availableAt: new Date(Date.now() + Math.min(3600_000, 2 ** row.event.attempts * 1000)) })
        .where(and(eq(bookingNotificationOutbox.id, row.event.id), eq(bookingNotificationOutbox.claimToken, token)));
    }
  }
}