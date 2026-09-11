import { describe, it, expect } from 'vitest';
import { bookingTimeError } from '../shared/bookingRequest';
import { generateBookingApiRoute } from '../server/publisher/templates';
import * as esbuild from 'esbuild';

describe('booking day and time validation', () => {
  it.each([undefined, null, '', '9:00', '24:00', '12:60', 900])('rejects a missing or malformed ordinary appointment time: %s', time => {
    expect(bookingTimeError('2028-02-29', time)).toMatch(/time/);
  });
  it.each(['2027-02-29', '2028-02-30', '2028-13-01', 'tomorrow', '2028-01-01Tgarbage'])('rejects invalid dates: %s', date => {
    expect(bookingTimeError(date, '09:00')).toMatch(/date/);
  });
  it('accepts an explicit local calendar day and a trusted open-slot identity', () => {
    expect(bookingTimeError('2028-02-29', '09:00')).toBeNull();
    expect(bookingTimeError('2028-02-29T00:00:00.000Z', '09:00')).toBeNull();
    expect(bookingTimeError('2028-02-29', undefined, 'slot-id')).toBeNull();
    expect(bookingTimeError('2028-02-29', undefined, '   ')).toMatch(/time/);
  });
  it('the emitted endpoint rejects missing time before configuration or storage access', async () => {
    const { code } = esbuild.transformSync(generateBookingApiRoute('fixture-site'), { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { POST: (request: any) => Promise<any> } };
    const lookup = (name: string) => {
      if (name !== 'next/server') throw new Error(`Unexpected import: ${name}`);
      return { NextResponse: { json: (body: unknown, init: any) => ({ body, status: init?.status ?? 200 }) } };
    };
    new Function('require', 'module', 'exports', code)(lookup, module, module.exports);
    const result = await module.exports.POST({ json: async () => ({ customerName: 'Fictional Test', customerEmail: 'test@example.com', service: 'Therapy', date: '2028-02-29' }) });
    expect(result.status).toBe(400);
    expect(result.body.message).toMatch(/time/);
  });
});
