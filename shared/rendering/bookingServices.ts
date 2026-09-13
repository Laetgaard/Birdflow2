/** Collapsing duplicate booking services into one visitor-facing choice.
 *
 * An owner who saves the same service twice ends up with several
 * `booking_services` rows describing one real offering, and each row carries
 * its own availability rules and open slots. A visitor then sees three
 * identical cards where only one of them happens to have times behind it.
 *
 * Grouping is read-side only: every underlying id stays valid, and the booking
 * is submitted against the id that actually owns the chosen time.
 *
 * Self-contained on purpose — these functions are `.toString()`-inlined into
 * the generated site's BookingForm, so they must not close over module scope.
 */

export type BookableService = {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency: string;
  durationMinutes?: number;
  duration_minutes?: number;
};

export type ServiceGroup<T extends BookableService = BookableService> = {
  /** Identity of the offering, not of any one row. */
  key: string;
  /** The id shown to the view and used when no slot names a better one. */
  primaryId: string;
  /** Every underlying booking_services id describing this same offering. */
  ids: string[];
  /** The row whose details are displayed. */
  service: T;
};

export type GroupableSlot = {
  time: string;
  available: boolean;
  serviceId?: string;
  openSlotId?: string;
  teamMemberId?: string | null;
};

/** Group services that describe the same offering, preserving source order. */
export function groupBookingServices<T extends BookableService>(services: T[]): ServiceGroup<T>[] {
  const groups: ServiceGroup<T>[] = [];
  // A Map, not an object literal: this function's source is inlined into the
  // generated site with its type annotations stripped, and a bare `{}` then
  // fails strict-mode indexing there.
  const byKey = new Map<string, ServiceGroup<T>>();
  for (const service of services || []) {
    if (!service || !service.id) continue;
    const duration = service.durationMinutes ?? service.duration_minutes ?? '';
    // Numeric comparison so "1000" and "1000.00" describe one price.
    const amount = Number(service.price);
    const price = Number.isFinite(amount) ? String(amount) : String(service.price ?? '');
    const key = [
      String(service.name ?? '').trim().toLowerCase(),
      String(duration),
      price,
      String(service.currency ?? '').trim().toUpperCase(),
    ].join('|');
    const existing = byKey.get(key);
    if (existing) {
      existing.ids.push(service.id);
      continue;
    }
    const group: ServiceGroup<T> = { key, primaryId: service.id, ids: [service.id], service };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

/** Every id behind the group the given id belongs to. */
export function groupServiceIds(groups: ServiceGroup[], serviceId: string): string[] {
  for (const group of groups) {
    if (group.ids.indexOf(serviceId) >= 0) return group.ids.slice();
  }
  return serviceId ? [serviceId] : [];
}

/** Union of the times a group offers, remembering which id owns each one.
 *
 * A time is available when ANY id in the group can serve it; the entry that
 * can is the one kept, so submit sends that id and its open slot. */
export function mergeServiceSlots(
  sets: Array<{ serviceId: string; slots: GroupableSlot[] }>,
): GroupableSlot[] {
  const byTime = new Map<string, GroupableSlot>();
  const order: string[] = [];
  for (const set of sets || []) {
    for (const slot of set.slots || []) {
      if (!slot || typeof slot.time !== 'string') continue;
      const tagged: GroupableSlot = {
        time: slot.time,
        available: !!slot.available,
        serviceId: slot.serviceId || set.serviceId,
        openSlotId: slot.openSlotId,
        teamMemberId: slot.teamMemberId ?? null,
      };
      const current = byTime.get(slot.time);
      if (!current) {
        byTime.set(slot.time, tagged);
        order.push(slot.time);
        continue;
      }
      // An offerable time beats an already-taken one at the same clock time.
      if (!current.available && tagged.available) byTime.set(slot.time, tagged);
    }
  }
  return order.map(time => byTime.get(time) as GroupableSlot).sort((a, b) => a.time.localeCompare(b.time));
}
