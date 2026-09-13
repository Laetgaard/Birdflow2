import { describe, it, expect } from 'vitest';
import { renderBookingView } from './helpers/renderParity';

/** A month the fixture dates sit in, far enough out to always be future. */
const MONTH = '2030-06';
const dayButton = (html: string, day: number) => {
  // Each day cell is a button whose visible label is the day number.
  const parts = html.split('<button');
  return parts.find(part => part.includes(`>${day}<span`)) ?? '';
};

describe('the booking calendar shows which dates can be booked', () => {
  it('dims and disables a date the service cannot serve', () => {
    const html = renderBookingView('da', {
      step: 'datetime',
      visibleMonth: MONTH,
      availableDates: ['2030-06-11', '2030-06-13'],
    });
    const open = dayButton(html, 11);
    const closed = dayButton(html, 12);

    expect(open).not.toContain('disabled');
    expect(open).not.toContain('aria-disabled');
    expect(closed).toContain('disabled');
    expect(closed).toContain('aria-disabled="true"');
  });

  it('announces the state rather than relying on shading alone', () => {
    const html = renderBookingView('da', {
      step: 'datetime',
      visibleMonth: MONTH,
      availableDates: ['2030-06-11'],
    });
    expect(dayButton(html, 11)).toContain('ledig');
    expect(dayButton(html, 12)).toContain('ikke ledig');
  });

  it('says so in English too', () => {
    const html = renderBookingView('en', {
      step: 'datetime',
      visibleMonth: MONTH,
      availableDates: ['2030-06-11'],
    });
    expect(dayButton(html, 11)).toContain('available');
    expect(dayButton(html, 12)).toContain('not available');
  });

  it('leaves every future day selectable when availability is not known', () => {
    // An already-published site, or a failed lookup: unknown must never read
    // as "closed", or a bookable site would look shut.
    const html = renderBookingView('da', { step: 'datetime', visibleMonth: MONTH });
    expect(dayButton(html, 11)).not.toContain('aria-disabled');
    expect(dayButton(html, 12)).not.toContain('aria-disabled');
  });

  it('disables every day when the service can serve none of them', () => {
    const html = renderBookingView('da', { step: 'datetime', visibleMonth: MONTH, availableDates: [] });
    for (const day of [11, 12, 13]) {
      expect(dayButton(html, day)).toContain('aria-disabled="true"');
    }
  });

  it('renders the month it was told to show', () => {
    const html = renderBookingView('da', { step: 'datetime', visibleMonth: '2030-02', availableDates: [] });
    expect(html).toContain('februar 2030');
    // February 2030 has 28 days, so a 30th cell must not exist.
    expect(dayButton(html, 30)).toBe('');
  });

  it('reports while the dates are being fetched', () => {
    const html = renderBookingView('da', { step: 'datetime', visibleMonth: MONTH, loadingDates: true });
    expect(html).toContain('Henter ledige datoer');
  });
});
