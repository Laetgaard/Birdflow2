import { describe, it, expect } from 'vitest';
import * as esbuild from 'esbuild';
import { generateBookingApiRoute, generateBookingForm, generateAvailabilityApiRoute } from '../server/publisher/templates';
import { PUBLISHED_SITE_STRINGS } from '../shared/siteLanguage';

/** Run the emitted Next.js booking route in-process, as the deployed site would. */
function loadBookingRoute(env: Record<string, string> = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    ...env,
  });
  try {
    const { code } = esbuild.transformSync(generateBookingApiRoute('fixture-site'), { loader: 'ts', format: 'cjs' });
    const module = { exports: {} as { POST: (request: any) => Promise<any> } };
    const lookup = (name: string) => {
      if (name !== 'next/server') throw new Error(`Unexpected import: ${name}`);
      return { NextResponse: { json: (body: any, init: any) => ({ body, status: init?.status ?? 200 }) } };
    };
    new Function('require', 'module', 'exports', code)(lookup, module, module.exports);
    return module.exports;
  } finally {
    process.env = previous;
  }
}

const request = (body: Record<string, unknown>) => ({
  json: async () => body,
  headers: { get: () => 'localhost' },
});

const complete = {
  customerName: 'Fictional Test',
  customerEmail: 'test@example.com',
  service: 'Therapy',
  serviceId: 'service-1',
  date: '2028-02-29',
  time: '10:00',
};

describe('the emitted booking route names why it refused', () => {
  it('reports a genuinely incomplete submission as missing fields', async () => {
    const route = loadBookingRoute();
    const result = await route.POST(request({ ...complete, customerEmail: '' }));
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('MISSING_FIELDS');
  });

  it('reports an unusable time as such, not as a missing field', async () => {
    const route = loadBookingRoute();
    const result = await route.POST(request({ ...complete, time: '25:00' }));
    expect(result.status).toBe(400);
    expect(result.body.code).toBe('INVALID_BOOKING_TIME');
  });

  it('reports an unconfigured deployment against a quotable reference', async () => {
    const route = loadBookingRoute({ SUPABASE_SERVICE_ROLE_KEY: '' });
    const result = await route.POST(request(complete));
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('NOT_CONFIGURED');
    expect(typeof result.body.requestId).toBe('string');
    expect(result.body.requestId.length).toBeGreaterThan(3);
  });

  it('never blames a complete submission for a server-side failure', async () => {
    const route = loadBookingRoute();
    // No Supabase reachable from here, so the request fails inside the handler.
    const result = await route.POST(request(complete));
    expect(result.status).toBe(500);
    expect(result.body.code).toBe('SERVER_ERROR');
    expect(result.body.code).not.toBe('MISSING_FIELDS');
  });
});

describe('the emitted booking form maps codes to honest copy', () => {
  it.each(['da', 'en'] as const)('does not reuse the required-fields message for a server failure (%s)', language => {
    const source = generateBookingForm(language);
    const strings = PUBLISHED_SITE_STRINGS[language];

    // The required-fields copy may only be reached by the local pre-submit
    // check and by the server's own MISSING_FIELDS answer.
    const start = source.indexOf('if (!res.ok)');
    const ladder = source.slice(start, source.indexOf("setStatus('error');", start));
    expect(ladder).toContain("code === 'MISSING_FIELDS'");
    expect(ladder).toContain("code === 'NOT_CONFIGURED'");
    expect(ladder).toContain("code === 'INVALID_BOOKING_TIME'");
    // Status is only a fallback for a server old enough to send no code.
    expect(ladder).toContain('payload?.code ||');

    // The required-fields copy appears exactly once in the ladder, under the
    // server's own MISSING_FIELDS answer — and nowhere near the final else.
    const required = JSON.stringify(strings.bookingErrorRequired);
    expect(ladder.split(required)).toHaveLength(2);
    const missingFieldsBranch = ladder.slice(ladder.indexOf("code === 'MISSING_FIELDS'"));
    expect(missingFieldsBranch.indexOf(required)).toBeGreaterThan(-1);
    expect(ladder.slice(ladder.lastIndexOf('} else {'))).not.toContain(required);

    for (const copy of [strings.bookingErrorServer, strings.bookingErrorNotConfigured, strings.bookingErrorInvalidTime]) {
      expect(ladder).toContain(JSON.stringify(copy));
    }
    // A request that never reached the server is its own failure, not a
    // rejection of anything the visitor typed.
    expect(source).toContain(JSON.stringify(strings.bookingErrorNetwork));
  });

  it.each(['da', 'en'] as const)('clears a stale error when the visitor moves between steps (%s)', language => {
    const source = generateBookingForm(language);
    expect(source).toContain('const clearError = ');
    for (const handler of ['onService=', 'onDate=', 'onTime=', 'onNext=', 'onBack=']) {
      const at = source.indexOf(handler);
      expect(at).toBeGreaterThan(-1);
      expect(source.slice(at, at + 120)).toContain('clearError()');
    }
  });

  it('books against the service row that owns the chosen time', () => {
    const source = generateBookingForm('da');
    expect(source).toContain('const submitServiceId = chosenSlot?.serviceId || selectedService;');
    expect(source).toContain('serviceId: submitServiceId,');
  });

  it('sends the appointment day as a calendar day, not an invented instant', () => {
    const source = generateBookingForm('da');
    expect(source).not.toContain("selectedDate + 'T00:00:00.000Z'");
    expect(generateBookingApiRoute('x')).toContain("const requestedDay = String(date).slice(0, 10);");
  });
});

describe('availability is only claimed where it exists', () => {
  it('no longer treats a service with no opening hours as open every day', () => {
    // Both hosts computed this independently; neither may keep the old
    // "empty schedule means every day" shortcut.
    expect(generateAvailabilityApiRoute('x')).not.toContain('weeklySchedule.length === 0 ||');
  });

  it('answers for every service id a deduplicated card stands for', () => {
    const source = generateAvailabilityApiRoute('x');
    expect(source).toContain("searchParams.get('serviceIds')");
    expect(source).toContain('unionAvailable');
  });
});
