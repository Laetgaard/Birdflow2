import { describe, it, expect } from 'vitest';
import { groupBookingServices, groupServiceIds, mergeServiceSlots } from '../shared/rendering/bookingServices';

const service = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, name: 'you', price: '1000', currency: 'DKK', durationMinutes: 60, ...overrides,
}) as any;

describe('collapsing duplicate booking services', () => {
  it('shows one card for rows describing the same offering, keeping every id', () => {
    const groups = groupBookingServices([service('a'), service('b'), service('c')]);
    expect(groups).toHaveLength(1);
    expect(groups[0].primaryId).toBe('a');
    expect(groups[0].ids).toEqual(['a', 'b', 'c']);
    expect(groups[0].service.id).toBe('a');
  });

  it('treats the same price written differently as one offering', () => {
    const groups = groupBookingServices([service('a'), service('b', { price: '1000.00' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual(['a', 'b']);
  });

  it('ignores case and surrounding space in the name', () => {
    const groups = groupBookingServices([service('a'), service('b', { name: '  You ' })]);
    expect(groups[0].ids).toEqual(['a', 'b']);
  });

  it('keeps genuinely different offerings apart', () => {
    const groups = groupBookingServices([
      service('a'),
      service('b', { price: '750' }),
      service('c', { durationMinutes: 30 }),
      service('d', { currency: 'EUR' }),
      service('e', { name: 'other' }),
    ]);
    expect(groups.map(group => group.ids)).toEqual([['a'], ['b'], ['c'], ['d'], ['e']]);
  });

  it('accepts the snake_case duration the published host receives', () => {
    const groups = groupBookingServices([
      service('a', { durationMinutes: undefined, duration_minutes: 60 }),
      service('b', { durationMinutes: undefined, duration_minutes: 60 }),
    ]);
    expect(groups[0].ids).toEqual(['a', 'b']);
  });

  it('preserves source order and skips rows with no id', () => {
    const groups = groupBookingServices([service('a', { name: 'b' }), service('', { name: 'x' }), service('c', { name: 'a' })]);
    expect(groups.map(group => group.primaryId)).toEqual(['a', 'c']);
  });

  it('resolves any id in a group back to the whole group', () => {
    const groups = groupBookingServices([service('a'), service('b')]);
    expect(groupServiceIds(groups, 'b')).toEqual(['a', 'b']);
    // An id we have never seen still books against itself rather than nothing.
    expect(groupServiceIds(groups, 'unknown')).toEqual(['unknown']);
    expect(groupServiceIds(groups, '')).toEqual([]);
  });
});

describe('merging the times a group offers', () => {
  it('offers a time any duplicate can serve, and remembers which one owns it', () => {
    const merged = mergeServiceSlots([
      { serviceId: 'a', slots: [{ time: '10:00', available: false }] },
      { serviceId: 'b', slots: [{ time: '10:00', available: true, openSlotId: 'slot-1' }] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ time: '10:00', available: true, serviceId: 'b', openSlotId: 'slot-1' });
  });

  it('keeps a time taken when no duplicate can serve it', () => {
    const merged = mergeServiceSlots([
      { serviceId: 'a', slots: [{ time: '10:00', available: false }] },
      { serviceId: 'b', slots: [{ time: '10:00', available: false }] },
    ]);
    expect(merged[0]).toMatchObject({ time: '10:00', available: false });
  });

  it('unions distinct times and returns them in clock order', () => {
    const merged = mergeServiceSlots([
      { serviceId: 'a', slots: [{ time: '11:30', available: true }] },
      { serviceId: 'b', slots: [{ time: '09:00', available: true }, { time: '10:00', available: true }] },
    ]);
    expect(merged.map(slot => slot.time)).toEqual(['09:00', '10:00', '11:30']);
    expect(merged.map(slot => slot.serviceId)).toEqual(['b', 'b', 'a']);
  });

  it('survives empty and malformed input', () => {
    expect(mergeServiceSlots([])).toEqual([]);
    expect(mergeServiceSlots([{ serviceId: 'a', slots: [] }])).toEqual([]);
    expect(mergeServiceSlots([{ serviceId: 'a', slots: [{ time: null } as any] }])).toEqual([]);
  });

  it('does not overwrite a slot\'s own service id with the set it arrived in', () => {
    const merged = mergeServiceSlots([{ serviceId: 'a', slots: [{ time: '10:00', available: true, serviceId: 'z' }] }]);
    expect(merged[0].serviceId).toBe('z');
  });
});
