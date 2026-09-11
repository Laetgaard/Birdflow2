import type { ThemeConfig, PageData, BuilderComponentData } from '../../shared/rendering/types';
import { BREAKPOINTS, REDUCED_MOTION_QUERY } from '../../shared/rendering/contract';
import {
  MOTION_TABLES,
  computeMotion,
  motionPhaseStyle,
  sectionMotionSpec,
  staggerChildSpec,
} from '../../shared/motion';
import { APPROVED_FONTS, DEFAULT_FONT_STACK, googleFontsHref, resolveApprovedFontStack } from '../../shared/fonts';
import type { BusinessContext } from '../../shared/businessContext';
import { resolveDesignTokens } from '../../shared/designTokens';
// Lives in shared/ so the builder canvas can render against the same bytes the
// published site loads. Re-exported here because callers already import it
// from this module.
export { generateGlobalsCss } from '../../shared/rendering/globalsCss';
import {
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  DEFAULT_SITE_LANGUAGE,
  PUBLISHED_SITE_STRINGS,
  SITE_LOCALE,
  type SiteLanguage,
} from '../../shared/siteLanguage';

/**
 * Localized literals are emitted as JSX expressions - `{"Din kurv"}` rather
 * than bare text - so a quote or a brace in a translation can never break the
 * generated file.
 */
function jsx(value: string): string {
  return `{${JSON.stringify(value)}}`;
}

/** Same, for a string that lands inside generated JS/TS rather than JSX. */
function lit(value: string): string {
  return JSON.stringify(value);
}


export function generatePackageJson(siteName: string): string {
  // Sanitize siteName for npm package name requirements:
  // - Must be lowercase
  // - Can only contain letters, numbers, and hyphens
  // - Cannot start with a hyphen or number
  // - Must not be empty
  let packageName = (siteName || '')
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '') // Remove invalid characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');      // Trim leading/trailing hyphens
  
  // Ensure name doesn't start with a number
  if (/^[0-9]/.test(packageName)) {
    packageName = 'site-' + packageName;
  }
  
  // Fallback if empty
  if (!packageName) {
    packageName = 'my-website';
  }
  
  return JSON.stringify({
    name: packageName,
    version: '1.0.0',
    private: true,
    engines: {
      node: '>=18.0.0',
    },
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
    },
    dependencies: {
      next: '^14.0.0',
      react: '^18.0.0',
      'react-dom': '^18.0.0',
      '@supabase/supabase-js': '^2.0.0',
      stripe: '^14.0.0',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
      '@types/react': '^18.0.0',
      '@types/react-dom': '^18.0.0',
    },
  }, null, 2);
}

export function generateNvmrc(): string {
  return '20';
}

export function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2);
}

export function generateNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
`;
}

export function generateThemeJson(theme: ThemeConfig): string {
  return JSON.stringify(theme, null, 2);
}

export function generateEnvExample(): string {
  return `NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_WEBSITE_ID=your-website-id
STRIPE_SECRET_KEY=your-stripe-secret-key
`;
}

export function generateBookingApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BIRDFLOW_API_URL = process.env.NEXT_PUBLIC_BIRDFLOW_API_URL || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

// Look up website_id from deployment URL or slug stored in database
async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  // Handle localhost - use build-time ID (baked in at deploy time)
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  // Normalize host - strip www. prefix and port
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  // Strategy 1: Try exact deployment_url match (with and without www)
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();

  if (exactMatch) {
    return exactMatch.id;
  }

  // Strategy 2: Check custom_domains table
  try {
    const { data: domainMatch } = await supabase
      .from('custom_domains')
      .select('website_id')
      .eq('domain', normalizedHost)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (domainMatch?.website_id) {
      return domainMatch.website_id;
    }
  } catch (e) {
    // Continue to other strategies
  }

  // Strategy 3: Slug-based lookup for recognized domain patterns only
  // Only extract slug from known patterns to prevent cross-tenant routing
  const parts = normalizedHost.split('.');
  let slug: string | null = null;

  // Pattern 1: slug.bird-flow.com (legacy subdomain pattern)
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  }
  // Pattern 2: project-name.vercel.app (Vercel deployment)
  else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }

  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();

    if (slugMatch) {
      return slugMatch.id;
    }
  }

  // No match found - use build-time ID
  // This is safe because each deployed site has its own correct ID baked in
  console.log('No website match for host:', normalizedHost, 'using build-time ID');
  return BUILD_TIME_WEBSITE_ID;
}

// Convert 'HH:MM' to minutes since midnight. Returns null when not parseable.
function timeToMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\\d{1,2}):(\\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, customerPhone, serviceId, service, date, time, notes } = body;
    const teamMemberId = body.team_member_id || body.teamMemberId || null;
    const openSlotId = body.open_slot_id || body.openSlotId || null;
    const place = body.place || null;
    
    if (!customerName || !customerEmail || !service || !date) {
      return NextResponse.json({ message: 'Customer name, email, service, and date are required' }, { status: 400 });
    }

    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Derive websiteId from request host (secure - not from client body)
    const host = request.headers.get('host') || '';
    const effectiveWebsiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!effectiveWebsiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    // Get service details if serviceId provided
    let durationMinutes = null;
    let price = null;
    if (serviceId) {
      const { data: serviceData } = await supabase
        .from('booking_services')
        .select('duration_minutes, price')
        .eq('id', serviceId)
        .single();
      if (serviceData) {
        durationMinutes = serviceData.duration_minutes;
        price = serviceData.price;
      }
    }

    let data: any = null;
    let bookingDate = date;
    let bookingTime = time || null;

    if (openSlotId) {
      // Owner-placed open slot: claim it atomically before creating the booking
      const { data: claimedRows, error: claimError } = await supabase
        .from('booking_open_slots')
        .update({ status: 'booked' })
        .eq('id', openSlotId)
        .eq('website_id', effectiveWebsiteId)
        .eq('status', 'open')
        .select();

      if (claimError) {
        console.error('Open slot claim error:', claimError);
        return NextResponse.json({ message: 'Failed to create booking', error: 'Failed to create booking' }, { status: 500 });
      }

      const claimed = (claimedRows || [])[0];
      if (!claimed) {
        return NextResponse.json({
          message: 'This time slot is no longer available. Please select a different time.',
          error: 'This time slot is no longer available. Please select a different time.',
          code: 'SLOT_UNAVAILABLE',
        }, { status: 409 });
      }

      bookingDate = claimed.date;
      bookingTime = claimed.time;

      const slotServiceId = claimed.service_id || serviceId || null;
      let slotServiceName = service;
      if (claimed.service_id && claimed.service_id !== serviceId) {
        const { data: slotService } = await supabase
          .from('booking_services')
          .select('name, price')
          .eq('id', claimed.service_id)
          .eq('website_id', effectiveWebsiteId)
          .single();
        if (slotService) {
          slotServiceName = slotService.name;
          price = slotService.price;
        }
      }

      const insertResult = await supabase.from('bookings').insert({
        website_id: effectiveWebsiteId,
        service_id: slotServiceId,
        service: slotServiceName,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        date: new Date(claimed.date + 'T00:00:00').toISOString(),
        time: claimed.time || null,
        duration_minutes: claimed.duration_minutes || durationMinutes,
        team_member_id: claimed.team_member_id || teamMemberId || null,
        place: place || null,
        send_reminder: true,
        price: price,
        notes: notes || null,
        status: 'pending',
      }).select().single();

      if (insertResult.error || !insertResult.data) {
        console.error('Booking error:', insertResult.error);
        // Revert the claim so the slot is not lost
        await supabase
          .from('booking_open_slots')
          .update({ status: 'open' })
          .eq('id', claimed.id)
          .eq('website_id', effectiveWebsiteId);
        return NextResponse.json({ message: 'Failed to create booking', error: 'Failed to create booking' }, { status: 500 });
      }

      data = insertResult.data;

      await supabase
        .from('booking_open_slots')
        .update({ booking_id: data.id })
        .eq('id', claimed.id)
        .eq('website_id', effectiveWebsiteId);
    } else {
      const dateOnly = new Date(date).toISOString().split('T')[0];
      const startOfDay = \`\${dateOnly}T00:00:00\`;
      const endOfDay = \`\${dateOnly}T23:59:59\`;

      // Double-booking prevention for the same service.
      // Exact-time match is a cheap early exit; interval overlap catches
      // bookings of differing durations that still collide.
      const requestedServiceStart = timeToMinutes(time);
      if (serviceId && requestedServiceStart !== null) {
        const requestedServiceEnd = requestedServiceStart + (durationMinutes || 60);
        const { data: sameServiceBookings } = await supabase
          .from('bookings')
          .select('id, time, duration_minutes')
          .eq('website_id', effectiveWebsiteId)
          .eq('service_id', serviceId)
          .gte('date', startOfDay)
          .lte('date', endOfDay)
          .neq('status', 'cancelled');

        const serviceConflict = (sameServiceBookings || []).some((b: any) => {
          if (b.time === time) return true;
          const existingStart = timeToMinutes(b.time);
          if (existingStart === null) return false;
          const existingEnd = existingStart + (b.duration_minutes || 60);
          return requestedServiceStart < existingEnd && existingStart < requestedServiceEnd;
        });

        if (serviceConflict) {
          return NextResponse.json({
            message: 'This time slot is no longer available. Please select a different time.',
            error: 'This time slot is no longer available. Please select a different time.',
            code: 'SLOT_UNAVAILABLE',
          }, { status: 409 });
        }
      }

      // Member double-booking prevention across all services
      const requestedStart = timeToMinutes(time);
      if (teamMemberId && requestedStart !== null) {
        const requestedEnd = requestedStart + (durationMinutes || 60);
        const { data: memberBookings } = await supabase
          .from('bookings')
          .select('id, time, duration_minutes')
          .eq('website_id', effectiveWebsiteId)
          .eq('team_member_id', teamMemberId)
          .gte('date', startOfDay)
          .lte('date', endOfDay)
          .neq('status', 'cancelled');

        const conflict = (memberBookings || []).some((b: any) => {
          const existingStart = timeToMinutes(b.time);
          if (existingStart === null) return false;
          const existingEnd = existingStart + (b.duration_minutes || 60);
          return requestedStart < existingEnd && existingStart < requestedEnd;
        });

        if (conflict) {
          return NextResponse.json({
            message: 'The selected person is not available at this time. Please select a different time.',
            error: 'The selected person is not available at this time. Please select a different time.',
            code: 'MEMBER_CONFLICT',
          }, { status: 409 });
        }
      }

      const insertResult = await supabase.from('bookings').insert({
        website_id: effectiveWebsiteId,
        service_id: serviceId || null,
        service: service,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        date: new Date(date).toISOString(),
        time: time || null,
        duration_minutes: durationMinutes,
        team_member_id: teamMemberId || null,
        place: place || null,
        send_reminder: true,
        price: price,
        notes: notes || null,
        status: 'pending',
      }).select().single();

      if (insertResult.error || !insertResult.data) {
        console.error('Booking error:', insertResult.error);
        return NextResponse.json({ message: 'Failed to create booking', error: 'Failed to create booking' }, { status: 500 });
      }

      data = insertResult.data;

      // Optimistic post-insert race verification: two concurrent submissions can
      // both pass the pre-insert checks. Re-read same-day non-cancelled bookings
      // and look for an overlapping one (sharing service_id or team_member_id)
      // that was created EARLIER (created_at, id string compare as tiebreak). If
      // such an earlier winner exists, this request lost the race: delete our
      // just-inserted booking and return 409. Exactly one submission survives.
      const ownStart = timeToMinutes(data.time);
      if (ownStart !== null) {
        const ownEnd = ownStart + (data.duration_minutes || 60);
        const ownCreated = data.created_at ? new Date(data.created_at).getTime() : 0;
        const { data: dayBookings } = await supabase
          .from('bookings')
          .select('id, time, duration_minutes, service_id, team_member_id, created_at')
          .eq('website_id', effectiveWebsiteId)
          .gte('date', startOfDay)
          .lte('date', endOfDay)
          .neq('status', 'cancelled')
          .neq('id', data.id);

        const earlierWinner = (dayBookings || []).some((b: any) => {
          const existingStart = timeToMinutes(b.time);
          if (existingStart === null) return false;
          const existingEnd = existingStart + (b.duration_minutes || 60);
          if (!(ownStart < existingEnd && existingStart < ownEnd)) return false;
          const sharedService = !!data.service_id && b.service_id === data.service_id;
          const sharedMember = !!data.team_member_id && b.team_member_id === data.team_member_id;
          if (!sharedService && !sharedMember) return false;
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bCreated < ownCreated || (bCreated === ownCreated && String(b.id) < String(data.id));
        });

        if (earlierWinner) {
          await supabase
            .from('bookings')
            .delete()
            .eq('id', data.id)
            .eq('website_id', effectiveWebsiteId);
          return NextResponse.json({
            message: 'This time slot is no longer available. Please select a different time.',
            error: 'This time slot is no longer available. Please select a different time.',
            code: 'SLOT_UNAVAILABLE',
          }, { status: 409 });
        }
      }
    }

    // Send booking confirmation email via BirdFlow API
    if (!BIRDFLOW_API_URL) {
      console.error('[Email] NEXT_PUBLIC_BIRDFLOW_API_URL is not configured - cannot send booking confirmation email');
    } else {
      try {
        const emailUrl = \`\${BIRDFLOW_API_URL}/api/public/websites/\${effectiveWebsiteId}/bookings/send-email\`;
        console.log('[Email] Sending booking confirmation to:', emailUrl);
        const emailResponse = await fetch(emailUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: data.id,
            customerName,
            customerEmail,
            service,
            date: bookingDate,
            time: bookingTime,
          }),
        });
        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('[Email] Failed to send booking confirmation email:', emailResponse.status, errorText);
        } else {
          console.log('[Email] Booking confirmation email sent successfully to', customerEmail);
        }
      } catch (emailErr) {
        console.error('[Email] Error sending booking confirmation email:', emailErr);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error('Booking error:', err);
    return NextResponse.json({ message: 'Booking failed' }, { status: 500 });
  }
}
`;
}

export function generateBookingServicesApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

// Look up website_id from deployment URL or slug stored in database
async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch.id;
    }
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('booking_services')
      .select('id, name, description, duration_minutes, price, currency')
      .eq('website_id', websiteId)
      .eq('active', 'true')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Services fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch services' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Services error:', err);
    return NextResponse.json({ message: 'Failed to fetch services' }, { status: 500 });
  }
}
`;
}

export function generateFormSubmissionApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch.id;
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) return slugMatch.id;
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const body = await request.json();
    const { formType, data } = body;

    if (!formType || !data) {
      return NextResponse.json({ message: 'formType and data are required' }, { status: 400 });
    }

    const { data: submission, error } = await supabase
      .from('form_submissions')
      .insert({
        website_id: websiteId,
        form_name: formType,
        data: data,
      })
      .select()
      .single();

    if (error) {
      console.error('Form submission error:', error);
      return NextResponse.json({ message: 'Failed to submit form' }, { status: 500 });
    }

    return NextResponse.json(submission, { status: 201 });
  } catch (err) {
    console.error('Form submission error:', err);
    return NextResponse.json({ message: 'Failed to submit form' }, { status: 500 });
  }
}
`;
}

export function generateAvailabilityApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch.id;
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) return slugMatch.id;
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!serviceId) {
      return NextResponse.json({ message: 'serviceId is required' }, { status: 400 });
    }

    // Verify service belongs to this website (security: prevent cross-tenant access)
    const { data: serviceCheck } = await supabase
      .from('booking_services')
      .select('id')
      .eq('id', serviceId)
      .eq('website_id', websiteId)
      .single();

    if (!serviceCheck) {
      return NextResponse.json({ message: 'Service not found' }, { status: 404 });
    }

    // Get weekly schedule (scoped by websiteId via service ownership check above)
    const { data: weeklyRules } = await supabase
      .from('service_availability')
      .select('day_of_week, start_time, end_time')
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .not('day_of_week', 'is', null);

    const weeklySchedule = (weeklyRules || []).map((r: any) => ({
      dayOfWeek: r.day_of_week,
      startTime: r.start_time,
      endTime: r.end_time,
    }));

    // Get ALL date ranges (scoped by websiteId) - no limit, support multiple periods
    const { data: ranges } = await supabase
      .from('service_date_ranges')
      .select('start_date, end_date')
      .eq('service_id', serviceId)
      .eq('website_id', websiteId)
      .eq('is_active', true);

    const dateRanges = (ranges || []).map((r: any) => ({
      startDate: r.start_date,
      endDate: r.end_date,
    }));

    // Get blocked dates (scoped by websiteId)
    const { data: blockedRecords } = await supabase
      .from('service_blocked_dates')
      .select('blocked_date, reason, is_recurring_yearly')
      .eq('service_id', serviceId)
      .eq('website_id', websiteId);

    // Calculate available dates for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const availableDays = new Set((weeklySchedule || []).map((s: any) => s.dayOfWeek));
    const availableDates: string[] = [];
    const blockedDates: { date: string; reason?: string }[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = \`\${year}-\${String(month).padStart(2, '0')}-\${String(day).padStart(2, '0')}\`;
      const dateObj = new Date(\`\${dateStr}T00:00:00\`);
      const dayOfWeek = dateObj.getDay();
      
      // Check if date is in ANY active range (if no ranges defined, all dates are valid)
      const inRange = dateRanges.length === 0 || dateRanges.some((range: any) => 
        dateStr >= range.startDate && (!range.endDate || dateStr <= range.endDate)
      );
      
      // Check if day of week is available
      const dayAvailable = weeklySchedule.length === 0 || availableDays.has(dayOfWeek);
      
      // Check if date is blocked
      const blockedRecord = (blockedRecords || []).find((b: any) => {
        if (b.blocked_date === dateStr) return true;
        if (b.is_recurring_yearly) {
          const [, bMonth, bDay] = b.blocked_date.split('-');
          const [, currentMonth, currentDay] = dateStr.split('-');
          return bMonth === currentMonth && bDay === currentDay;
        }
        return false;
      });
      
      if (blockedRecord) {
        blockedDates.push({ date: dateStr, reason: blockedRecord.reason || undefined });
      } else if (inRange && dayAvailable && dateObj >= today) {
        availableDates.push(dateStr);
      }
    }

    // Owner-placed open slots make their date bookable even without a rule grid
    const todayStr = \`\${today.getFullYear()}-\${String(today.getMonth() + 1).padStart(2, '0')}-\${String(today.getDate()).padStart(2, '0')}\`;
    const monthStart = \`\${year}-\${String(month).padStart(2, '0')}-01\`;
    const monthEnd = \`\${year}-\${String(month).padStart(2, '0')}-\${String(daysInMonth).padStart(2, '0')}\`;

    const { data: openSlots } = await supabase
      .from('booking_open_slots')
      .select('date, service_id')
      .eq('website_id', websiteId)
      .eq('status', 'open')
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .or(\`service_id.is.null,service_id.eq.\${serviceId}\`);

    const blockedSet = new Set(blockedDates.map((b) => b.date));
    const availableSet = new Set(availableDates);

    for (const slot of openSlots || []) {
      const slotDate = String(slot.date || '').slice(0, 10);
      if (!slotDate) continue;
      if (slotDate < todayStr) continue;
      if (blockedSet.has(slotDate)) continue;
      if (availableSet.has(slotDate)) continue;
      availableSet.add(slotDate);
      availableDates.push(slotDate);
    }

    availableDates.sort();

    return NextResponse.json({ availableDates, blockedDates, dateRanges, weeklySchedule });
  } catch (err) {
    console.error('Availability error:', err);
    return NextResponse.json({ message: 'Failed to fetch availability' }, { status: 500 });
  }
}
`;
}

export function generateSlotsApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch.id;
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) return slugMatch.id;
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

// Convert 'HH:MM' to minutes since midnight. Returns null when not parseable.
function toMinutes(value: string | null | undefined): number | null {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\\d{1,2}):(\\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const date = searchParams.get('date');
    const teamMemberId = searchParams.get('teamMemberId') || null;

    if (!serviceId || !date) {
      return NextResponse.json({ message: 'serviceId and date are required' }, { status: 400 });
    }

    // Validate date format
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
      return NextResponse.json({ message: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // Get the service
    const { data: service } = await supabase
      .from('booking_services')
      .select('duration_minutes')
      .eq('id', serviceId)
      .eq('website_id', websiteId)
      .single();

    if (!service) {
      return NextResponse.json([]);
    }

    const durationMinutes = service.duration_minutes || 30;
    const dateObj = new Date(\`\${date}T00:00:00\`);
    const dayOfWeek = dateObj.getDay();
    const startOfDay = \`\${date}T00:00:00\`;
    const endOfDay = \`\${date}T23:59:59\`;

    // Optional team member filtering
    let member: any = null;
    if (teamMemberId) {
      const { data: memberRow } = await supabase
        .from('booking_team_members')
        .select('id, active, service_ids, availability')
        .eq('id', teamMemberId)
        .eq('website_id', websiteId)
        .single();

      if (!memberRow || memberRow.active === false) {
        return NextResponse.json([]);
      }
      member = memberRow;
    }

    const memberServiceIds: string[] = Array.isArray(member?.service_ids) ? member.service_ids : [];
    const memberDoesService = !member || memberServiceIds.length === 0 || memberServiceIds.includes(serviceId);
    const memberWindows: { dayOfWeek: number; startTime: string; endTime: string }[] =
      Array.isArray(member?.availability) ? member.availability : [];

    // Busy ranges for the selected member (any service) on this date
    const memberBusy: { start: number; end: number }[] = [];
    if (member) {
      const { data: memberBookings } = await supabase
        .from('bookings')
        .select('time, duration_minutes')
        .eq('website_id', websiteId)
        .eq('team_member_id', member.id)
        .gte('date', startOfDay)
        .lte('date', endOfDay)
        .neq('status', 'cancelled');

      for (const b of memberBookings || []) {
        const parsed = toMinutes(b.time);
        if (parsed === null) continue;
        memberBusy.push({ start: parsed, end: parsed + (b.duration_minutes || 60) });
      }
    }

    const isMemberFree = (startMinutes: number, length: number) =>
      !memberBusy.some((busy) => startMinutes < busy.end && busy.start < startMinutes + length);

    const inMemberWindow = (startMinutes: number, length: number) => {
      if (!member) return true;
      const windows = memberWindows.filter((w: any) => Number(w.dayOfWeek) === dayOfWeek);
      if (memberWindows.length === 0) return true;
      if (windows.length === 0) return false;
      return windows.some((w: any) => {
        const wStart = toMinutes(w.startTime);
        const wEnd = toMinutes(w.endTime);
        if (wStart === null || wEnd === null) return false;
        return startMinutes >= wStart && startMinutes + length <= wEnd;
      });
    };

    // Get availability rules for this day
    const { data: rules } = await supabase
      .from('service_availability')
      .select('start_time, end_time, slot_duration_minutes')
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .or(\`day_of_week.eq.\${dayOfWeek},specific_date.eq.\${date}\`);

    // Get existing bookings for this date
    const { data: bookings } = await supabase
      .from('bookings')
      .select('time')
      .eq('website_id', websiteId)
      .eq('service_id', serviceId)
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .neq('status', 'cancelled');

    const bookedTimes = new Set((bookings || []).map((b: any) => b.time).filter(Boolean));

    // Generate slots
    const slots: { time: string; available: boolean; openSlotId?: string; teamMemberId?: string | null }[] = [];
    const addedTimes = new Set<string>();

    if (memberDoesService) {
      for (const rule of rules || []) {
        const slotDuration = rule.slot_duration_minutes || durationMinutes;
        const [startHour, startMin] = rule.start_time.split(':').map(Number);
        const [endHour, endMin] = rule.end_time.split(':').map(Number);
        
        let currentTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        while (currentTime + slotDuration <= endTime) {
          const hours = Math.floor(currentTime / 60);
          const mins = currentTime % 60;
          const timeStr = \`\${String(hours).padStart(2, '0')}:\${String(mins).padStart(2, '0')}\`;
          
          if (!addedTimes.has(timeStr)) {
            const memberOk = !member || (inMemberWindow(currentTime, slotDuration) && isMemberFree(currentTime, slotDuration));
            if (memberOk) {
              addedTimes.add(timeStr);
              slots.push({
                time: timeStr,
                available: !bookedTimes.has(timeStr),
                teamMemberId: member ? member.id : null,
              });
            }
          }
          
          currentTime += slotDuration;
        }
      }
    }

    // Merge owner-placed open slots
    let openSlotQuery = supabase
      .from('booking_open_slots')
      .select('id, time, duration_minutes, team_member_id')
      .eq('website_id', websiteId)
      .eq('date', date)
      .eq('status', 'open')
      .or(\`service_id.is.null,service_id.eq.\${serviceId}\`);

    if (teamMemberId) {
      openSlotQuery = openSlotQuery.or(\`team_member_id.is.null,team_member_id.eq.\${teamMemberId}\`);
    }

    const { data: openSlots } = await openSlotQuery;

    for (const slot of openSlots || []) {
      const timeStr = String(slot.time || '').slice(0, 5);
      if (!timeStr || addedTimes.has(timeStr)) continue;
      const startMinutes = toMinutes(timeStr);
      if (startMinutes === null) continue;
      const length = slot.duration_minutes || durationMinutes;
      if (member && !isMemberFree(startMinutes, length)) continue;
      addedTimes.add(timeStr);
      slots.push({
        time: timeStr,
        available: true,
        openSlotId: slot.id,
        teamMemberId: slot.team_member_id || (member ? member.id : null),
      });
    }

    slots.sort((a, b) => a.time.localeCompare(b.time));
    return NextResponse.json(slots);
  } catch (err) {
    console.error('Slots error:', err);
    return NextResponse.json({ message: 'Failed to fetch slots' }, { status: 500 });
  }
}
`;
}

export function generateTeamMembersApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch.id;
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) return slugMatch.id;
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('booking_team_members')
      .select('id, name, role, color, service_ids')
      .eq('website_id', websiteId)
      .eq('active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Team members fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch team members' }, { status: 500 });
    }

    const members = (data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      role: m.role || null,
      color: m.color || null,
      serviceIds: Array.isArray(m.service_ids) ? m.service_ids : [],
    }));

    return NextResponse.json(members);
  } catch (err) {
    console.error('Team members error:', err);
    return NextResponse.json({ message: 'Failed to fetch team members' }, { status: 500 });
  }
}
`;
}

export function generateCheckoutApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = ${lit(websiteId)};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.items;
    const customerEmail = body.customerEmail;
    const successUrl = body.successUrl;
    const cancelUrl = body.cancelUrl;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ message: 'Invalid request: no items' }, { status: 400 });
    }

    if (!customerEmail) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ message: 'Stripe not configured' }, { status: 500 });
    }

    // Dynamically import Stripe and Supabase to avoid build issues
    const Stripe = (await import('stripe')).default;
    const { createClient } = await import('@supabase/supabase-js');
    
    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate items against database products
    const validatedItems: Array<{ productId: string; name: string; price: number; quantity: number }> = [];
    
    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();
      
      if (error || !product) {
        return NextResponse.json({ message: 'Product not found: ' + item.productId }, { status: 400 });
      }
      if (product.website_id !== WEBSITE_ID) {
        return NextResponse.json({ message: 'Invalid product for this website' }, { status: 400 });
      }
      if (product.status !== 'active') {
        return NextResponse.json({ message: 'Product not available: ' + product.name }, { status: 400 });
      }
      
      let priceNum = parseFloat(product.price);
      let variantInfo = '';
      
      // Handle variant price adjustments
      const productVariants = product.variants as Array<{ id: string; name: string; options: Array<{ id: string; name: string; priceAdjustment: number }> }> | null;
      if (productVariants && productVariants.length > 0) {
        if (!item.selectedVariants) {
          return NextResponse.json({ message: 'Please select options for ' + product.name }, { status: 400 });
        }
        const variantNames: string[] = [];
        for (const variant of productVariants) {
          const selectedOptionId = item.selectedVariants[variant.id];
          if (!selectedOptionId) {
            return NextResponse.json({ message: 'Please select ' + variant.name + ' for ' + product.name }, { status: 400 });
          }
          const option = variant.options.find((o: { id: string }) => o.id === selectedOptionId);
          if (option) {
            priceNum += option.priceAdjustment || 0;
            variantNames.push(variant.name + ': ' + option.name);
          }
        }
        if (variantNames.length > 0) {
          variantInfo = ' (' + variantNames.join(', ') + ')';
        }
      }
      
      validatedItems.push({
        productId: product.id,
        name: product.name + variantInfo,
        price: priceNum,
        quantity: Math.max(1, Math.floor(item.quantity || 1)),
      });
    }

    const total = validatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const lineItems = validatedItems.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const origin = request.headers.get('origin') || '';
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl || origin + '?success=true',
      cancel_url: cancelUrl || origin + '?canceled=true',
      customer_email: customerEmail,
      metadata: {
        websiteId: WEBSITE_ID,
      },
    });

    // Create order with pending payment status
    await supabase.from('orders').insert({
      website_id: WEBSITE_ID,
      customer_name: customerEmail.split('@')[0] || 'Customer',
      customer_email: customerEmail,
      status: 'pending',
      payment_status: 'pending',
      stripe_session_id: session.id,
      total: total.toFixed(2),
      currency: 'USD',
      items: validatedItems.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    return NextResponse.json({ message: 'Checkout failed' }, { status: 500 });
  }
}
`;
}

export function generateCheckoutValidateApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = ${lit(websiteId)};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerEmail, customerName, customerPhone, shippingAddress, shippingCity, shippingPostalCode } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Cart is empty' }, { status: 400 });
    }

    if (!customerEmail || !customerEmail.includes('@')) {
      return NextResponse.json({ success: false, message: 'Valid email is required', field: 'customerEmail' }, { status: 400 });
    }

    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json({ success: false, message: 'Name is required', field: 'customerName' }, { status: 400 });
    }

    if (!shippingAddress || shippingAddress.trim().length < 3) {
      return NextResponse.json({ success: false, message: 'Shipping address is required', field: 'shippingAddress' }, { status: 400 });
    }

    if (!shippingCity || shippingCity.trim().length < 2) {
      return NextResponse.json({ success: false, message: 'City is required', field: 'shippingCity' }, { status: 400 });
    }

    if (!shippingPostalCode || shippingPostalCode.trim().length < 2) {
      return NextResponse.json({ success: false, message: 'Postal code is required', field: 'shippingPostalCode' }, { status: 400 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const validatedItems: Array<{ productId: string; name: string; price: number; priceCents: number; quantity: number; currency: string; trackInventory: boolean; stockQuantity: number }> = [];
    let primaryCurrency: string | null = null;
    const outOfStock: Array<{ productId: string; name: string; requested: number; available: number }> = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (error || !product) {
        return NextResponse.json({ success: false, message: 'Product not found: ' + item.productId }, { status: 400 });
      }
      if (product.website_id !== WEBSITE_ID) {
        return NextResponse.json({ success: false, message: 'Invalid product' }, { status: 400 });
      }
      if (product.status !== 'active') {
        return NextResponse.json({ success: false, message: 'Product not available: ' + product.name }, { status: 400 });
      }

      const productCurrency = product.currency || 'USD';
      if (primaryCurrency === null) {
        primaryCurrency = productCurrency;
      } else if (primaryCurrency !== productCurrency) {
        return NextResponse.json({ success: false, message: 'Cannot checkout products with different currencies' }, { status: 400 });
      }

      let priceNum = parseFloat(product.price);
      const qty = Math.max(1, Math.floor(item.quantity || 1));
      const trackInventory = product.track_inventory || false;
      const stockQuantity = product.stock_quantity || 0;
      let variantInfo = '';
      
      // Handle variant price adjustments
      const productVariants = product.variants as Array<{ id: string; name: string; options: Array<{ id: string; name: string; priceAdjustment: number }> }> | null;
      if (productVariants && productVariants.length > 0) {
        if (!item.selectedVariants) {
          return NextResponse.json({ 
            success: false, 
            message: 'Please select options for ' + product.name,
            field: 'variants'
          }, { status: 400 });
        }
        const variantNames: string[] = [];
        for (const variant of productVariants) {
          const selectedOptionId = item.selectedVariants[variant.id];
          if (!selectedOptionId) {
            return NextResponse.json({ 
              success: false, 
              message: 'Please select ' + variant.name + ' for ' + product.name,
              field: 'variants'
            }, { status: 400 });
          }
          const option = variant.options.find((o: { id: string }) => o.id === selectedOptionId);
          if (option) {
            priceNum += option.priceAdjustment || 0;
            variantNames.push(variant.name + ': ' + option.name);
          }
        }
        if (variantNames.length > 0) {
          variantInfo = ' (' + variantNames.join(', ') + ')';
        }
      }

      if (trackInventory && stockQuantity < qty) {
        outOfStock.push({ productId: product.id, name: product.name, requested: qty, available: stockQuantity });
      }

      validatedItems.push({
        productId: product.id,
        name: product.name + variantInfo,
        price: priceNum,
        priceCents: Math.round(priceNum * 100),
        quantity: qty,
        currency: productCurrency,
        trackInventory,
        stockQuantity,
      });
    }

    if (outOfStock.length > 0) {
      return NextResponse.json({ success: false, message: 'Some items are out of stock', outOfStock }, { status: 400 });
    }

    const subtotalCents = validatedItems.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);

    return NextResponse.json({
      success: true,
      validatedItems,
      subtotalCents,
      currency: primaryCurrency || 'USD',
      customer: { email: customerEmail, name: customerName, phone: customerPhone },
      shippingAddress,
    });
  } catch (err) {
    console.error('Checkout validate error:', err);
    return NextResponse.json({ success: false, message: 'Validation failed' }, { status: 500 });
  }
}
`;
}

export function generateCheckoutConfirmApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = ${lit(websiteId)};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerEmail, customerName, customerPhone, shippingAddress, shippingCity, shippingPostalCode, shippingMethodId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Cart is empty' }, { status: 400 });
    }

    if (!customerEmail) {
      return NextResponse.json({ success: false, message: 'Email is required' }, { status: 400 });
    }

    if (!STRIPE_SECRET_KEY) {
      return NextResponse.json({ success: false, message: 'Stripe not configured' }, { status: 500 });
    }

    const Stripe = (await import('stripe')).default;
    const { createClient } = await import('@supabase/supabase-js');

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const validatedItems: Array<{ productId: string; name: string; price: number; priceCents: number; quantity: number; currency: string }> = [];
    let primaryCurrency: string | null = null;
    const outOfStock: Array<{ productId: string; name: string; requested: number; available: number }> = [];

    for (const item of items) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (error || !product || product.website_id !== WEBSITE_ID || product.status !== 'active') {
        return NextResponse.json({ success: false, message: 'Invalid product: ' + item.productId }, { status: 400 });
      }

      const productCurrency = product.currency || 'USD';
      if (primaryCurrency === null) {
        primaryCurrency = productCurrency;
      } else if (primaryCurrency !== productCurrency) {
        return NextResponse.json({ success: false, message: 'Currency mismatch' }, { status: 400 });
      }

      let priceNum = parseFloat(product.price);
      const qty = Math.max(1, Math.floor(item.quantity || 1));
      let variantInfo = '';
      
      // Handle variant price adjustments
      const productVariants = product.variants as Array<{ id: string; name: string; options: Array<{ id: string; name: string; priceAdjustment: number }> }> | null;
      if (productVariants && productVariants.length > 0) {
        if (!item.selectedVariants) {
          return NextResponse.json({ 
            success: false, 
            message: 'Please select options for ' + product.name 
          }, { status: 400 });
        }
        const variantNames: string[] = [];
        for (const variant of productVariants) {
          const selectedOptionId = item.selectedVariants[variant.id];
          if (!selectedOptionId) {
            return NextResponse.json({ 
              success: false, 
              message: 'Please select ' + variant.name + ' for ' + product.name 
            }, { status: 400 });
          }
          const option = variant.options.find((o: { id: string }) => o.id === selectedOptionId);
          if (option) {
            priceNum += option.priceAdjustment || 0;
            variantNames.push(variant.name + ': ' + option.name);
          }
        }
        if (variantNames.length > 0) {
          variantInfo = ' (' + variantNames.join(', ') + ')';
        }
      }

      if (product.track_inventory && product.stock_quantity < qty) {
        outOfStock.push({ productId: product.id, name: product.name, requested: qty, available: product.stock_quantity });
      }

      validatedItems.push({
        productId: product.id,
        name: product.name + variantInfo,
        price: priceNum,
        priceCents: Math.round(priceNum * 100),
        quantity: qty,
        currency: productCurrency,
      });
    }

    if (outOfStock.length > 0) {
      return NextResponse.json({ success: false, message: 'Some items are out of stock', outOfStock }, { status: 400 });
    }

    let shippingCostCents = 0;
    let shippingMethod = null;
    if (shippingMethodId) {
      const { data } = await supabase
        .from('shipping_methods')
        .select('*')
        .eq('id', shippingMethodId)
        .eq('website_id', WEBSITE_ID)
        .single();
      if (data) {
        shippingMethod = data;
        shippingCostCents = data.price_amount || 0;
      }
    }

    const subtotalCents = validatedItems.reduce((sum, item) => sum + (item.priceCents * item.quantity), 0);
    const totalAmountCents = subtotalCents + shippingCostCents;

    const stripeCurrency = (primaryCurrency || 'USD').toLowerCase();

    const lineItems = validatedItems.map(item => ({
      price_data: {
        currency: stripeCurrency,
        product_data: { name: item.name },
        unit_amount: item.priceCents,
      },
      quantity: item.quantity,
    }));

    if (shippingMethod && shippingCostCents > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Shipping: ' + shippingMethod.name },
          unit_amount: shippingCostCents,
        },
        quantity: 1,
      });
    }

    const origin = request.headers.get('origin') || '';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: origin + '/checkout/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/checkout/cancel',
      customer_email: customerEmail,
      metadata: { websiteId: WEBSITE_ID },
    });

    // Create order with pending status - stock decrement happens in webhook after payment success
    const fullAddress = [shippingAddress, shippingCity, shippingPostalCode].filter(Boolean).join(', ');
    await supabase.from('orders').insert({
      website_id: WEBSITE_ID,
      customer_name: customerName || customerEmail.split('@')[0] || 'Customer',
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      status: 'pending',
      payment_status: 'pending',
      stripe_session_id: session.id,
      total: (totalAmountCents / 100).toFixed(2),
      total_amount_cents: totalAmountCents,
      subtotal_cents: subtotalCents,
      shipping_cost_cents: shippingCostCents,
      currency: primaryCurrency || 'USD',
      items: validatedItems.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price,
        priceCents: item.priceCents,
        quantity: item.quantity,
      })),
      shipping_address: fullAddress || null,
      shipping_method_id: shippingMethodId || null,
      shipping_name: shippingMethod?.name || null,
      shipping_price: shippingMethod ? String(shippingCostCents) : null,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      totalAmountCents,
    });
  } catch (err) {
    console.error('Checkout confirm error:', err);
    return NextResponse.json({ success: false, message: 'Checkout failed' }, { status: 500 });
  }
}
`;
}

export function generateStripeWebhookApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = ${lit(websiteId)};

export async function POST(request: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ message: 'Stripe not configured' }, { status: 500 });
    }

    const Stripe = (await import('stripe')).default;
    const { createClient } = await import('@supabase/supabase-js');

    const stripe = new Stripe(STRIPE_SECRET_KEY);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await request.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature') || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ message: 'Invalid signature' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const sessionId = session.id;
      const paymentIntentId = session.payment_intent;

      // Find the order by Stripe session ID
      const { data: order } = await supabase
        .from('orders')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .single();

      if (order) {
        // Update order status to paid
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            stripe_payment_intent_id: paymentIntentId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', order.id);

        console.log('Order ' + order.id + ' marked as paid');

        // Decrement stock for tracked products
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items as Array<{ id: string; quantity: number }>) {
            if (item.id && item.quantity) {
              const { data: product } = await supabase
                .from('products')
                .select('track_inventory, stock_quantity')
                .eq('id', item.id)
                .single();

              if (product?.track_inventory) {
                const newQty = Math.max(0, product.stock_quantity - item.quantity);
                await supabase
                  .from('products')
                  .update({ 
                    stock_quantity: newQty,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.id);
                console.log('Decremented stock for product ' + item.id + ': ' + product.stock_quantity + ' -> ' + newQty);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ message: 'Webhook error' }, { status: 500 });
  }
}
`;
}

export function generateSupabaseClient(websiteId: string): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fallback website ID (hardcoded at build time)
export const fallbackWebsiteId = ${lit(websiteId)};

// Runtime website ID (will be set by WebsiteProvider)
let runtimeWebsiteId: string | null = null;

export function setRuntimeWebsiteId(id: string) {
  runtimeWebsiteId = id;
}

export function getWebsiteId(): string {
  return runtimeWebsiteId || fallbackWebsiteId;
}

// For backward compatibility
export const websiteId = ${lit(websiteId)};

// Fetch website by deployment URL or slug from Supabase
export async function fetchWebsiteByDeploymentUrl(hostname: string): Promise<{ id: string; name: string } | null> {
  // Normalize hostname - strip www. prefix and port
  const normalizedHost = hostname.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;

  // Strategy 1: Try exact deployment_url match (with and without www)
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id, name')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();

  if (exactMatch) {
    return exactMatch;
  }

  // Strategy 2: Check custom_domains table for this hostname
  try {
    const { data: domainMatch } = await supabase
      .from('custom_domains')
      .select('website_id')
      .eq('domain', normalizedHost)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (domainMatch?.website_id) {
      const { data: websiteData } = await supabase
        .from('websites')
        .select('id, name')
        .eq('id', domainMatch.website_id)
        .single();

      if (websiteData) {
        return websiteData;
      }
    }
  } catch (e) {
    // custom_domains table may not be accessible with anon key - continue to other strategies
  }

  // Strategy 3: Slug-based lookup for recognized domain patterns only
  const parts = normalizedHost.split('.');
  let slug: string | null = null;

  // Pattern 1: slug.bird-flow.com (legacy subdomain pattern)
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  }
  // Pattern 2: project-name.vercel.app (Vercel deployment)
  else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }

  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id, name')
      .eq('slug', slug)
      .limit(1)
      .single();

    if (slugMatch) {
      return slugMatch;
    }
  }

  console.log('No website found for host:', normalizedHost);
  return null;
}

// Check if we should use runtime detection (not localhost)
export function shouldDetectWebsite(hostname: string): boolean {
  return !hostname.includes('localhost') && !hostname.includes('127.0.0.1');
}
`;
}

export function generateServerSupabase(websiteId: string): string {
  return `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export const websiteId = ${lit(websiteId)};

// Fetch website ID by deployment URL using admin client
export async function getWebsiteIdByDeploymentUrl(url: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('websites')
    .select('id')
    .eq('deployment_url', url)
    .limit(1)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data.id;
}
`;
}

export function generateWebsiteProvider(): string {
  return `'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { fallbackWebsiteId, setRuntimeWebsiteId, fetchWebsiteByDeploymentUrl, shouldDetectWebsite } from '@/lib/supabase';

type WebsiteContextType = {
  websiteId: string;
  isLoading: boolean;
  websiteName: string | null;
};

const WebsiteContext = createContext<WebsiteContextType>({
  websiteId: '',
  isLoading: true,
  websiteName: null,
});

export function useWebsite() {
  return useContext(WebsiteContext);
}

export function WebsiteProvider({ children }: { children: ReactNode }) {
  const [websiteId, setWebsiteIdState] = useState<string>(fallbackWebsiteId);
  const [websiteName, setWebsiteName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function detectWebsite() {
      try {
        const hostname = window.location.hostname;

        if (shouldDetectWebsite(hostname)) {
          // Add timeout to prevent hanging if Supabase is unreachable
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
          const website = await Promise.race([
            fetchWebsiteByDeploymentUrl(hostname),
            timeoutPromise,
          ]);
          if (website && !cancelled) {
            setWebsiteIdState(website.id);
            setWebsiteName(website.name);
            setRuntimeWebsiteId(website.id);
          }
        }
      } catch (error) {
        console.error('Failed to detect website:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    detectWebsite();

    return () => { cancelled = true; };
  }, []);

  return (
    <WebsiteContext.Provider value={{ websiteId, isLoading, websiteName }}>
      {children}
    </WebsiteContext.Provider>
  );
}
`;
}

export function generateCartProvider(): string {
  return `'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useWebsite } from './WebsiteProvider';

export type CartProduct = {
  id: string;
  baseProductId?: string;
  name: string;
  description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  category?: string;
  selectedVariants?: Record<string, string>;
  variantInfo?: string;
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: CartProduct, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalAmount: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

function getStorageKey(websiteId: string): string {
  return 'cart_' + websiteId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { websiteId } = useWebsite();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!websiteId) return;
    try {
      const stored = localStorage.getItem(getStorageKey(websiteId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load cart:', e);
    }
    setIsHydrated(true);
  }, [websiteId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!websiteId || !isHydrated) return;
    try {
      localStorage.setItem(getStorageKey(websiteId), JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart:', e);
    }
  }, [items, websiteId, isHydrated]);

  const addItem = useCallback((product: CartProduct, quantity: number = 1) => {
    setItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(productId);
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen(prev => !prev), []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = items.reduce(
    (sum, item) => sum + parseFloat(item.product.price || '0') * item.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalAmount,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
`;
}

export function generateCartDrawer(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `'use client';

import React, { useEffect, useState } from 'react';
import { useCart, CartItem } from './CartProvider';
import { useWebsite } from './WebsiteProvider';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

export default function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity, totalAmount } = useCart();

  // Get currency from first item
  const currency = items.length > 0 ? items[0].product.currency || 'USD' : 'USD';

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCheckout = () => {
    closeCart();
    window.location.href = '/checkout';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeCart}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998,
          transition: 'opacity 0.3s',
        }}
      />
      
      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#fff',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111827' }}>
            ${jsx(t.cartTitle)}
          </h2>
          <button
            onClick={closeCart}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={${lit(t.cartClose)}}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
              <p style={{ fontSize: '16px', fontWeight: 500 }}>${jsx(t.cartEmpty)}</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>${jsx(t.cartEmptyHint)}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map((item: CartItem) => (
                <div
                  key={item.product.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '12px',
                  }}
                >
                  {/* Product Image */}
                  <div style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '8px', 
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: '#e5e7eb',
                  }}>
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ 
                        width: '100%', 
                        height: '100%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '32px',
                      }}>
                        📦
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      fontSize: '14px', 
                      fontWeight: 600, 
                      margin: 0, 
                      color: '#111827',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {item.product.name}
                    </h3>
                    <p style={{ 
                      fontSize: '13px', 
                      color: '#6b7280', 
                      margin: '4px 0 8px',
                    }}>
                      {formatCurrency(parseFloat(item.product.price || '0'), item.product.currency)}${jsx(t.cartEach)}
                    </p>

                    {/* Quantity Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        −
                      </button>
                      <span style={{ fontSize: '14px', fontWeight: 500, minWidth: '24px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: '1px solid #d1d5db',
                          backgroundColor: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        style={{
                          marginLeft: 'auto',
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        ${jsx(t.cartRemove)}
                      </button>
                    </div>
                  </div>

                  {/* Subtotal */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                      {formatCurrency(parseFloat(item.product.price || '0') * item.quantity, item.product.currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{ 
            padding: '24px', 
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <span style={{ fontSize: '16px', color: '#6b7280' }}>${jsx(t.cartTotal)}</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: '#111827' }}>
                {formatCurrency(totalAmount, currency)}
              </span>
            </div>
            
            <button
              onClick={handleCheckout}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              ${jsx(t.cartCheckout)}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5L12.5 10L7.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
`;
}

export function generateCartButton(): string {
  return `'use client';

import React from 'react';
import { useCart } from './CartProvider';

type CartButtonProps = {
  color?: string;
};

export default function CartButton({ color = '#1a1a1a' }: CartButtonProps) {
  const { totalItems, toggleCart } = useCart();

  return (
    <button
      onClick={toggleCart}
      style={{
        position: 'relative',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={'Open cart with ' + totalItems + ' items'}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
      </svg>
      {totalItems > 0 && (
        <span
          style={{
            position: 'absolute',
            top: '0',
            right: '0',
            backgroundColor: '#ef4444',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            minWidth: '18px',
            height: '18px',
            borderRadius: '9px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px',
          }}
        >
          {totalItems > 99 ? '99+' : totalItems}
        </span>
      )}
    </button>
  );
}
`;
}

export function generateComponentRenderer(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `// This file is auto-generated by the BirdFlow publisher. Do not edit manually.
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import theme from '@/theme.json';
import { useCart } from '@/components/CartProvider';
import BookingForm from '@/components/BookingForm';

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  hidden?: boolean;
};

/** One resolved navigation link, baked into the page by the publisher. */
type NavItem = {
  id: string;
  title: string;
  href: string;
};

type ImageValue = string | { url: string; mediaId?: string; crop?: { x: number; y: number; width: number; height: number } };

type ComponentItem = {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: ImageValue;
  price?: number;
  featured?: boolean;
  features?: string[];
};

type StatItem = {
  id: string;
  value: string;
  label: string;
  prefix?: string;
  suffix?: string;
};

type FormField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
};

type StyledText = {
  text: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string;
  // Widened to string so baked-in JSON literals don't widen to a type that
  // clashes with the strict union in the builder. The renderer only reads
  // these values at runtime (e.g. style.textAlign = styledProp.textAlign).
  textAlign?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: string;
};

type ComponentProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonText?: string;
  buttonLink?: string;
  imageUrl?: ImageValue;
  images?: ImageValue[];
  items?: ComponentItem[];
  stats?: StatItem[];
  formFields?: FormField[];
  // Widened to string: the renderer reads these at runtime only. Using strict
  // literal unions here ("left"|"center"|"right") would cause TypeScript to
  // reject baked-in JSON literals whose inferred type is widened to string.
  alignment?: string;
  imageSide?: string;
  columns?: number;
  productLimit?: number;
  autoPlay?: boolean;
  speed?: number;
  layout?: string;
  videoUrl?: string;
  videoProvider?: string;
  productMode?: string;
  showAddToCart?: boolean;
  height?: string;
  style?: string;
  styledTitle?: StyledText;
  styledSubtitle?: StyledText;
  styledDescription?: StyledText;
  content?: string;
  maxWidth?: string;
  variant?: string;
  grayscale?: boolean | string;
  logos?: ComponentItem[];
  separator?: string;
  direction?: string;
  beforeImage?: ImageValue;
  afterImage?: ImageValue;
  beforeLabel?: string;
  afterLabel?: string;
  sliderPosition?: number;
  placeholder?: string;
  successMessage?: string;
  members?: ComponentItem[];
  services?: ComponentItem[];
  tableColumns?: ComponentItem[];
  features?: ComponentItem[];
  bullets?: (string | { text: string })[];
  tabs?: ComponentItem[];
  showCart?: boolean | string;
  gap?: string;
  children?: string[];
  customTree?: any;
  [key: string]: any; // Allow additional properties
};

// Helper to resolve StyledText props - returns text and inline style overrides
function getStyledText(styledProp: StyledText | undefined, fallbackText: string | undefined): { text: string; style: React.CSSProperties } {
  if (styledProp && typeof styledProp === 'object' && styledProp.text) {
    const style: React.CSSProperties = {};
    if (styledProp.fontFamily) style.fontFamily = styledProp.fontFamily;
    if (styledProp.fontSize) style.fontSize = styledProp.fontSize;
    if (styledProp.fontWeight) style.fontWeight = parseInt(styledProp.fontWeight) || styledProp.fontWeight;
    if (styledProp.color) style.color = styledProp.color;
    if (styledProp.textAlign) style.textAlign = styledProp.textAlign;
    if (styledProp.letterSpacing) style.letterSpacing = styledProp.letterSpacing;
    if (styledProp.lineHeight) style.lineHeight = styledProp.lineHeight;
    if (styledProp.textTransform && styledProp.textTransform !== 'none') style.textTransform = styledProp.textTransform;
    return { text: styledProp.text, style };
  }
  return { text: fallbackText || '', style: {} };
}

function getImageUrl(image: ImageValue | undefined): string {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || '';
}

// Color utility functions (matching builder's ComponentRenderer)
function hexToRgba(hex: string, opacity: number): string {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + opacity + ')';
  }
  return hex;
}

function getContrastColor(hexColor: string): string {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hexColor);
  if (result) {
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
  return '#ffffff';
}

function resolveAccentColor(styles: ComponentStyles): string {
  return (styles.accentColor as string) || theme.primaryColor || '#4f46e5';
}

// The families this site actually loads (see the stylesheet in app/layout).
// A stack naming anything else would render as a browser default here while
// looking right in the builder, so it falls back to the same default the
// builder shows.
const APPROVED_FAMILIES = new Set(${JSON.stringify(APPROVED_FONTS.map((f) => f.name.toLowerCase()))});
const DEFAULT_FONT_STACK = ${JSON.stringify(DEFAULT_FONT_STACK)};

function approvedFontStack(stack?: string): string {
  if (!stack) return DEFAULT_FONT_STACK;
  const family = stack.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
  return APPROVED_FAMILIES.has(family) ? stack : DEFAULT_FONT_STACK;
}

function resolveFontFamily(styles: ComponentStyles): string {
  return approvedFontStack((styles.fontFamily as string) || theme.fontFamily);
}

function resolveButtonColor(styles: ComponentStyles): string {
  return (styles.buttonColor as string) || theme.primaryColor || '#4f46e5';
}

// Visitors who ask their system for less motion get the finished layout
// straight away, with no entrance animations - the same rule the builder
// preview follows, so the two still look alike.
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('${REDUCED_MOTION_QUERY}');
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return reduced;
}

// Stagger animation hook for scroll-triggered per-item animations
function useStaggerAnimation(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setIsVisible(true);
      return;
    }
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const getItemStyle = (index: number): React.CSSProperties =>
    reduceMotion
      ? { opacity: 1, transform: 'none' }
      : {
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ' + (index * 0.08) + 's, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ' + (index * 0.08) + 's',
        };

  return { containerRef, getItemStyle };
}

// Hover card component for features, testimonials, etc.
function HoverCard({ children, style, accentColor }: { children: React.ReactNode; style?: React.CSSProperties; accentColor?: string }) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverShadow = accentColor ? '0 12px 32px ' + hexToRgba(accentColor, 0.12) : '0 12px 32px rgba(0,0,0,0.12)';

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...style,
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered ? hoverShadow : (style?.boxShadow || 'none'),
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
      }}
    >
      {children}
    </div>
  );
}

// ============ Motion (shared model, baked from shared/motion.ts) ============
// The generated project cannot import @shared, so the vocabulary tables are
// baked in as JSON and the resolver functions as their compiled source —
// the SAME functions the builder preview imports. Motion is data (preset
// names); unknown names resolve to no motion, never to arbitrary CSS.
// tests/motion.test.ts holds the stringified sources equivalent to direct
// calls, and the parity suite renders both sides from them.
const MOTION_TABLES: any = ${JSON.stringify(MOTION_TABLES)};
// Explicit any type annotations on the holding constants give TypeScript
// the parameter types it needs to satisfy noImplicitAny without running the
// compiled function source through the TypeScript parser again. The function
// bodies come from shared/motion.ts via .toString() and are pure data (no
// TypeScript syntax) -- the annotations live on the const, not the body.
const computeMotion: (tables: any, spec: any, staggerIndex?: number) => any = ${computeMotion.toString()};
const motionPhaseStyle: (resolved: any, phase: any) => any = ${motionPhaseStyle.toString()};
const sectionMotionSpec: (styles: any) => any = ${sectionMotionSpec.toString()};
const staggerChildSpec: (parentSpec: any, childMotion: any) => any = ${staggerChildSpec.toString()};

// Drives one entrance through hidden → entering → done. 'done' clears the
// inline styles so classes and :hover rules win again; repeat 'every-view'
// swings back to 'hidden' when the element scrolls out. Server-side the
// phase starts 'hidden' (same initial markup as the builder preview);
// reduced-motion visitors are unhidden pre-hydration by the [data-motion]
// rule in globals.css and post-hydration by this hook.
function useMotionPhase(resolved: any, replayKey: string) {
  const ref = useRef<any>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<string>(resolved ? 'hidden' : 'done');
  const signature = resolved
    ? [resolved.effect, resolved.trigger, resolved.durationMs, resolved.delayMs, resolved.easing, resolved.hiddenTransform, resolved.once, replayKey].join('|')
    : 'none|' + replayKey;
  useEffect(() => {
    if (!resolved || reduceMotion) {
      setPhase('done');
      return;
    }
    setPhase('hidden');
    if (resolved.trigger === 'load') {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase('entering'));
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase('entering');
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setPhase('entering');
            if (resolved.once) observer.disconnect();
          } else if (!resolved.once) {
            setPhase('hidden');
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [signature, reduceMotion]);
  useEffect(() => {
    if (phase !== 'entering' || !resolved || !resolved.once) return;
    const timer = window.setTimeout(() => setPhase('done'), resolved.durationMs + resolved.delayMs + 80);
    return () => window.clearTimeout(timer);
  }, [phase, signature]);
  return {
    ref,
    style: motionPhaseStyle(resolved, reduceMotion ? 'done' : (phase as any)) as React.CSSProperties,
    active: !!resolved && !reduceMotion,
  };
}

// Resolves breakpoint-specific style overrides for the active viewport.
// SSR renders desktop styles; a client-side effect swaps in the right
// breakpoint once window.innerWidth is known.
function useResponsiveOverrides(responsive: any): Record<string, unknown> {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (!responsive) return;
    function update() {
      const w = window.innerWidth;
      if (w <= 640 && responsive.mobile) {
        setOverrides(responsive.mobile);
      } else if (w <= 1024 && responsive.tablet) {
        setOverrides(responsive.tablet);
      } else {
        setOverrides({});
      }
    }
    update();
    window.addEventListener('resize', update, { passive: true });
    return function() { window.removeEventListener('resize', update); };
  }, []);
  return overrides;
}

function AnimatedWrapper({ 
  children, 
  styles 
}: { 
  children: React.ReactNode; 
  styles: ComponentStyles;
}) {
  // Legacy animation* fields plus styles.motion, resolved through the same
  // shared model the builder preview uses.
  const spec = sectionMotionSpec(styles);
  const resolved = computeMotion(MOTION_TABLES, spec);
  const m = useMotionPhase(resolved, '');

  if (!m.active) {
    return <>{children}</>;
  }

  return (
    <div ref={m.ref} data-motion="" style={m.style}>
      {children}
    </div>
  );
}

// Wraps a section with a scroll-speed-reduced parallax effect.
// The section translates at (speed * 0.5) of the scroll delta, creating depth.
// Runs only on the client; SSR renders no transform, so initial markup is
// identical between builder and published (parity maintained).
function ParallaxWrapper({
  speed,
  children,
}: {
  speed: number;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    let rafId = 0;
    let visible = false;

    function update() {
      const rect = outer!.getBoundingClientRect();
      const viewH = window.innerHeight;
      const mid = rect.top + rect.height / 2 - viewH / 2;
      inner!.style.transform = 'translateY(' + String(Math.round(mid * speed * -0.5)) + 'px)';
    }

    function onScroll() {
      if (!visible) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        visible = entry.isIntersecting;
        if (visible) update();
      });
    }, { threshold: 0 });
    observer.observe(outer);

    window.addEventListener('scroll', onScroll, { passive: true });
    return function() {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, [speed, reduceMotion]);

  return (
    <div ref={outerRef} data-parallax="" style={{ overflow: 'hidden', position: 'relative' }}>
      <div ref={innerRef}>
        {children}
      </div>
    </div>
  );
}

type ComponentStyles = {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
  animationType?: string;
  animationTrigger?: string;
  animationDuration?: string;
  animationDelay?: string;
  motion?: any;
  boxShadow?: string;
  backgroundGradient?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  opacity?: string;
  transform?: string;
  transition?: string;
  animation?: string;
  gap?: string;
  maxWidth?: string;
  minHeight?: string;
  accentColor?: string;
  buttonStyle?: string;
  buttonRadius?: string;
  buttonColor?: string;
  buttonHoverColor?: string;
  cardStyle?: string;
  fontFamily?: string;
  titleFontSize?: string;
  bodyFontSize?: string;
  fontWeight?: string;
  letterSpacing?: string;
  lineHeight?: string;
  textTransform?: string;
  borderWidth?: string;
  borderColor?: string;
  borderStyle?: string;
  isTransparent?: boolean | string;
  overlayMode?: boolean | string;
  scrollBehavior?: string;
  scrolledBackgroundColor?: string;
  hoverColor?: string;
  responsive?: {
    tablet?: Record<string, string>;
    mobile?: Record<string, string>;
  };
  [key: string]: any;
};

// Exported so generated page files can import this type and annotate their
// baked-in component arrays, giving TypeScript a contextual type to check
// the data against without needing @ts-nocheck.
export type ComponentData = {
  id: string;
  type: string;
  props: ComponentProps;
  styles: ComponentStyles;
};

function getBaseStyle(styles: ComponentStyles): React.CSSProperties {
  return {
    backgroundColor: styles.backgroundGradient && styles.backgroundGradient !== 'none'
      ? undefined
      : (styles.backgroundColor || theme.backgroundColor),
    color: styles.textColor,
    padding: styles.padding || '0',
    position: 'relative' as const,
    fontFamily: styles.fontFamily ? approvedFontStack(styles.fontFamily as string) : undefined,
    ...(styles.backgroundGradient && styles.backgroundGradient !== 'none' && {
      background: styles.backgroundGradient,
    }),
    ...(styles.backgroundImage && {
      backgroundImage: styles.backgroundImage,
      backgroundSize: styles.backgroundSize || 'cover',
      backgroundPosition: styles.backgroundPosition || 'center',
    }),
    ...(styles.letterSpacing && { letterSpacing: styles.letterSpacing }),
    ...(styles.lineHeight && { lineHeight: styles.lineHeight }),
    ...(styles.textTransform && styles.textTransform !== 'none' && { textTransform: styles.textTransform }),
    ...(styles.borderStyle && styles.borderStyle !== 'none' && {
      borderStyle: styles.borderStyle,
      borderWidth: styles.borderWidth || '1px',
      borderColor: styles.borderColor || '#e5e7eb',
    }),
    ...(styles.borderRadius && { borderRadius: styles.borderRadius }),
    ...(styles.boxShadow && styles.boxShadow !== 'none' && { boxShadow: styles.boxShadow }),
    ...(styles.opacity && { opacity: parseFloat(styles.opacity) }),
    ...(styles.margin && { margin: styles.margin }),
    ...(styles.minHeight && { minHeight: styles.minHeight }),
    ...(styles.maxWidth && { maxWidth: styles.maxWidth }),
    ...(styles.gap && { gap: styles.gap }),
  };
}

function HoverButtonComponent({ 
  children, 
  backgroundColor, 
  hoverBackgroundColor, 
  textColor,
  href,
  onClick,
  style,
  type = 'button',
  disabled = false,
}: { 
  children: React.ReactNode; 
  backgroundColor: string; 
  hoverBackgroundColor: string;
  textColor?: string;
  href?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  
  const buttonStyle: React.CSSProperties = {
    padding: '14px 28px',
    backgroundColor: isHovered && !disabled ? hoverBackgroundColor : backgroundColor,
    color: textColor || '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.01em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    transform: isHovered && !disabled ? 'translateY(-2px)' : 'translateY(0)',
    boxShadow: isHovered && !disabled ? '0 8px 24px rgba(0,0,0,0.15)' : '0 2px 8px rgba(0,0,0,0.08)',
    textDecoration: 'none',
    display: 'inline-block',
    opacity: disabled ? 0.7 : 1,
    ...style,
  };
  
  if (href) {
    return (
      <a
        href={href}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={buttonStyle}
      >
        {children}
      </a>
    );
  }
  
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={buttonStyle}
    >
      {children}
    </button>
  );
}

function HeroSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  // Parse image value (could be string or object with url/crop)
  const imageValue = (() => {
    if (!props.imageUrl) return null;
    if (typeof props.imageUrl === 'object' && props.imageUrl?.url) {
      return { url: props.imageUrl.url, crop: props.imageUrl.crop };
    }
    return { url: props.imageUrl as string, crop: null };
  })();
  
  const imageUrl = imageValue?.url || '';
  const hasCrop = imageValue?.crop != null;
  // Builder always sets backgroundImage when url exists, then overlays CroppedImage when crop present
  const backgroundImage = imageUrl ? { backgroundImage: \`url(\${imageUrl})\`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  const fontFamily = resolveFontFamily(styles);
  const titleFontSize = styles.titleFontSize || '48px';
  const bodyFontSize = styles.bodyFontSize || '18px';
  const fontWeight = styles.fontWeight ? parseInt(styles.fontWeight as string) : 700;
  const buttonColor = resolveButtonColor(styles);
  const buttonHoverColor = (styles.buttonHoverColor as string) || '#4338ca';
  const backgroundOpacity = typeof styles.backgroundOpacity === 'number' ? styles.backgroundOpacity / 100 : 1;
  
  // Calculate contrasting text color for button (matches builder's getContrastColor exactly)
  const buttonTextColor = (() => {
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(buttonColor);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    }
    return '#ffffff';
  })();
  
  // Calculate background color with opacity (matches builder's hexToRgba exactly)
  const bgColorWithOpacity = (() => {
    const bgColor = styles.backgroundColor;
    if (!bgColor) return \`rgba(26, 26, 46, \${backgroundOpacity})\`;
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(bgColor);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return \`rgba(\${r}, \${g}, \${b}, \${backgroundOpacity})\`;
    }
    return bgColor; // Return original if can't parse (matches builder's hexToRgba fallback)
  })();
  
  const heroStyle: React.CSSProperties = {
    color: styles.textColor,
    padding: styles.padding || '0',
    minHeight: styles.minHeight || undefined,
    position: 'relative',
    overflow: 'hidden',
    fontFamily,
    ...backgroundImage,
  };
  
  // Calculate crop styles for objectPosition
  const getCropStyle = () => {
    if (!hasCrop || !imageValue?.crop) return {};
    const crop = imageValue.crop;
    const posX = crop.x + crop.width / 2;
    const posY = crop.y + crop.height / 2;
    return { objectPosition: \`\${posX}% \${posY}%\` };
  };
  
  return (
    <section style={heroStyle}>
      {/* Cropped background image layer */}
      {hasCrop && imageUrl && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <img 
            src={imageUrl} 
            alt={props.imageAlt || ''} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', ...getCropStyle() }}
          />
        </div>
      )}
      {/* Color overlay - sits on top of the background image */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: bgColorWithOpacity, zIndex: 1 }} />
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center', position: 'relative', zIndex: 2 }}>
        {(() => {
          const stTitle = getStyledText(props.styledTitle, props.title);
          return stTitle.text ? <h1 style={{ fontSize: titleFontSize, fontWeight, marginBottom: '16px', lineHeight: 1.1, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h1> : null;
        })()}
        {(() => {
          const stSub = getStyledText(props.styledSubtitle, props.subtitle);
          return stSub.text ? <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px', lineHeight: 1.3, ...stSub.style }}>{stSub.text}</p> : null;
        })()}
        {(() => {
          const stDesc = getStyledText(props.styledDescription, props.description);
          return stDesc.text ? <p style={{ fontSize: bodyFontSize, opacity: 0.8, marginBottom: '32px', lineHeight: 1.6, maxWidth: '600px', margin: props.alignment === 'center' ? '0 auto 32px' : '0 0 32px', ...stDesc.style }}>{stDesc.text}</p> : null;
        })()}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: props.alignment === 'left' ? 'flex-start' : props.alignment === 'right' ? 'flex-end' : 'center' }}>
          {props.buttonText && (
            <HoverButtonComponent
              backgroundColor={buttonColor}
              hoverBackgroundColor={buttonHoverColor}
              textColor={buttonTextColor}
              href={props.buttonLink || '#'}
              style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600 }}
            >
              {props.buttonText}
            </HoverButtonComponent>
          )}
          {(props as any).secondaryButtonText && (
            <a
              href={(props as any).secondaryButtonLink || '#'}
              style={{ padding: '15px 32px', fontSize: '16px', fontWeight: 600, borderRadius: '12px', border: '2px solid rgba(255,255,255,0.35)', color: 'inherit', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', letterSpacing: '0.01em' }}
            >
              {(props as any).secondaryButtonText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ImageSliderSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const images = (props.images || []).filter((img: any) => !!getImageUrl(img));
  const captions: string[] = (props as any).captions || [];
  const aspectRatio = (styles as any).aspectRatio || '16/9';
  const [currentIndex, setCurrentIndex] = useState(0);

  if (images.length === 0) return null;

  const prev = () => setCurrentIndex((i: number) => (i - 1 + images.length) % images.length);
  const next = () => setCurrentIndex((i: number) => (i + 1) % images.length);
  const caption = captions[currentIndex] || '';

  return (
    <section style={baseStyle}>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1200px', margin: '0 auto', borderRadius: styles.borderRadius || '16px', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ width: '100%', aspectRatio, position: 'relative', backgroundColor: '#0a0a0a' }}>
          <div key={currentIndex} style={{ position: 'absolute', inset: 0 }}>
            <img src={getImageUrl(images[currentIndex])} alt={'Slide ' + (currentIndex + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          {images.length > 1 && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)', zIndex: 1 }} />}
          {caption && (
            <div style={{ position: 'absolute', bottom: images.length > 1 ? '52px' : '20px', left: 0, right: 0, textAlign: 'center', zIndex: 2, padding: '0 48px' }}>
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.88)', fontStyle: 'italic', textShadow: '0 1px 4px rgba(0,0,0,0.4)', display: 'inline-block', maxWidth: '600px' }}>{caption}</span>
            </div>
          )}
          {images.length > 1 && (
            <>
              <button onClick={prev} aria-label="Previous" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button onClick={next} aria-label="Next" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
              <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px', zIndex: 2 }}>
                {images.map((_: any, i: number) => (
                  <button key={i} onClick={() => setCurrentIndex(i)} aria-label={'Slide ' + (i + 1)} style={{ width: i === currentIndex ? '24px' : '8px', height: '8px', borderRadius: '4px', backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)' }} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function TextImageSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const isImageLeft = props.imageSide === 'left';
  const imageUrl = getImageUrl(props.imageUrl);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stDesc = getStyledText(props.styledDescription, props.description);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
          {stDesc.text && <p style={{ fontSize: styles.bodyFontSize || '18px', lineHeight: 1.7, opacity: 0.8, ...stDesc.style }}>{stDesc.text}</p>}
          {props.buttonText && (
            <HoverButtonComponent
              backgroundColor={resolveButtonColor(styles)}
              hoverBackgroundColor={styles.buttonHoverColor as string || '#4338ca'}
              textColor={getContrastColor(resolveButtonColor(styles))}
              href={props.buttonLink || '#'}
              style={{ marginTop: '24px' }}
            >
              {props.buttonText}
            </HoverButtonComponent>
          )}
        </div>
        {imageUrl && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <img src={imageUrl} alt={props.imageAlt || props.title || ''} style={{ width: '100%', borderRadius: '12px' }} />
          </div>
        )}
      </div>
    </section>
  );
}

function CTASection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const buttonColor = resolveButtonColor(styles);
  const buttonHoverColor = (styles.buttonHoverColor as string) || '#e5e7eb';
  const buttonTextColor = getContrastColor(buttonColor);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stDesc = getStyledText(props.styledDescription, props.description);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stDesc.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.9, marginBottom: '32px', lineHeight: 1.6, ...stDesc.style }}>{stDesc.text}</p>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {props.buttonText && (
            <HoverButtonComponent
              backgroundColor={buttonColor}
              hoverBackgroundColor={buttonHoverColor}
              textColor={buttonTextColor}
              href={props.buttonLink || '#'}
              style={{ padding: '16px 32px', fontSize: '16px', fontWeight: 600 }}
            >
              {props.buttonText}
            </HoverButtonComponent>
          )}
          {(props as any).secondaryButtonText && (
            <a
              href={(props as any).secondaryButtonLink || '#'}
              style={{ padding: '15px 32px', fontSize: '16px', fontWeight: 600, borderRadius: '10px', border: '2px solid ' + hexToRgba(buttonColor, 0.35), color: buttonColor, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {(props as any).secondaryButtonText}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '1000px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.7, marginBottom: '48px', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          {props.items?.map((item, index) => (
            <HoverCard key={item.id} accentColor={accentColor} style={{
              padding: '32px 24px',
              backgroundColor: hexToRgba(accentColor, 0.04),
              borderRadius: '16px',
              border: '1px solid ' + hexToRgba(accentColor, 0.08),
              ...getItemStyle(index),
            }}>
              {item.icon && <div style={{ fontSize: '32px', marginBottom: '16px', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(accentColor, 0.1), borderRadius: '12px', margin: props.alignment === 'center' ? '0 auto 16px' : '0 0 16px' }}>{item.icon}</div>}
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.3 }}>{item.title}</h3>
              <p style={{ fontSize: '15px', opacity: 0.75, lineHeight: 1.6 }}>{item.description}</p>
            </HoverCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const { containerRef, getItemStyle } = useStaggerAnimation(props.items?.length || 0);

  // Detect if background is dark for card contrast
  const bgLuminance = (() => {
    const bg = styles.backgroundColor || '#ffffff';
    const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(bg);
    if (result) {
      const r = parseInt(result[1], 16); const g = parseInt(result[2], 16); const b = parseInt(result[3], 16);
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    return 1;
  })();
  const isDarkBg = bgLuminance < 0.5;
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)';
  const cardBorder = isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  const stTitle = getStyledText(props.styledTitle, props.title);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '48px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          {props.items?.map((item, index) => (
            <div key={item.id} style={{
              padding: '32px',
              backgroundColor: cardBg,
              borderRadius: '16px',
              border: '1px solid ' + cardBorder,
              textAlign: 'left',
              position: 'relative',
              ...getItemStyle(index),
            }}>
              <div style={{ fontSize: '72px', lineHeight: 0.8, color: accentColor, opacity: 0.15, marginBottom: '12px', fontFamily: 'Georgia, "Times New Roman", serif', userSelect: 'none' }}>&ldquo;</div>
              {(props as any).showStars !== false && (
                <div style={{ display: 'flex', gap: '3px', marginBottom: '14px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} width="16" height="16" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="0.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  ))}
                </div>
              )}
              <p style={{ fontSize: '15px', lineHeight: 1.75, marginBottom: '24px', color: styles.textColor, flex: 1 }}>{item.description}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {getImageUrl(item.imageUrl) ? (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid ' + hexToRgba(accentColor, 0.2) }}>
                    <img src={getImageUrl(item.imageUrl)} alt={item.title || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                ) : (
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: hexToRgba(accentColor, 0.12), border: '2px solid ' + hexToRgba(accentColor, 0.2), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px', fontWeight: 700, color: accentColor }}>
                    {(item.title || '?')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <span style={{ fontWeight: 700, fontSize: '14px', display: 'block', lineHeight: 1.3 }}>{item.title}</span>
                  {(item as any).role && <span style={{ fontSize: '12px', opacity: 0.55 }}>{(item as any).role}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NavLinkItem({ href, children, textColor, hoverColor, onClick, style, disableHover }: { 
  href: string; 
  children: React.ReactNode; 
  textColor: string; 
  hoverColor: string; 
  onClick?: () => void;
  style?: React.CSSProperties;
  disableHover?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const showHover = !disableHover && isHovered;
  return (
    <a
      href={href}
      onClick={onClick}
      onMouseEnter={() => !disableHover && setIsHovered(true)}
      onMouseLeave={() => !disableHover && setIsHovered(false)}
      style={{
        color: showHover ? hoverColor : textColor,
        textDecoration: 'none',
        transition: disableHover ? 'none' : 'color 0.2s ease',
        ...style,
      }}
    >
      {children}
    </a>
  );
}

function BurgerMenuButton({ isOpen, textColor, hoverColor, onClick }: {
  isOpen: boolean;
  textColor: string;
  hoverColor: string;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const currentColor = isHovered ? hoverColor : textColor;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '40px',
        height: '40px',
        position: 'relative',
      }}
      aria-label={${lit(t.navToggleMenu)}}
    >
      <span style={{
        display: 'block',
        width: '24px',
        height: '2px',
        backgroundColor: currentColor,
        borderRadius: '1px',
        transition: 'all 0.3s ease',
        transformOrigin: 'center center',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: isOpen
          ? 'translate(-50%, -50%) rotate(45deg)'
          : 'translate(-50%, calc(-50% - 6px))',
      }} />
      <span style={{
        display: 'block',
        width: '24px',
        height: '2px',
        backgroundColor: currentColor,
        borderRadius: '1px',
        transition: 'all 0.2s ease',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: isOpen ? 0 : 1,
      }} />
      <span style={{
        display: 'block',
        width: '24px',
        height: '2px',
        backgroundColor: currentColor,
        borderRadius: '1px',
        transition: 'all 0.3s ease',
        transformOrigin: 'center center',
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: isOpen
          ? 'translate(-50%, -50%) rotate(-45deg)'
          : 'translate(-50%, calc(-50% + 6px))',
      }} />
    </button>
  );
}

function HeaderSection({ props, styles, pages, navItems: providedNavItems }: { props: ComponentProps; styles: ComponentStyles; pages?: BuilderPage[]; navItems?: NavItem[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(72);
  const lastScrollYRef = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' });
  const { totalItems, toggleCart } = useCart();
  const showCart = props.showCart !== false && props.showCart !== 'false';
  
  const isTransparent = styles.isTransparent === true || styles.isTransparent === 'true';
  const overlayMode = styles.overlayMode === true || styles.overlayMode === 'true';
  const scrollBehavior = (styles.scrollBehavior as string) || 'static';
  const scrolledBackgroundColor = (styles.scrolledBackgroundColor as string) || styles.backgroundColor || '#ffffff';
  const hoverColor = (styles.hoverColor as string) || '#6366f1';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      if (height > 0) {
        setHeaderHeight(height);
      }
    }
  });
  
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsScrolled(currentScrollY > 50);
      
      if (scrollBehavior === 'show-on-scroll-up') {
        if (currentScrollY < lastScrollYRef.current || currentScrollY < 50) {
          setIsHeaderVisible(true);
        } else if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
          setIsHeaderVisible(false);
        }
      }
      lastScrollYRef.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollBehavior]);

  // The site navigation is resolved by the publisher at generation time, the
  // same way design tokens are, and handed in - and an empty menu stays
  // empty, because a customer who removed every link meant it. Deriving from
  // the page list is the pre-navigation fallback for pages generated before
  // navigation was stored, which hand in no menu at all.
  const navItems: NavItem[] = providedNavItems !== undefined
    ? providedNavItems
    : pages && pages.length > 0
      ? pages.filter(page => !page.hidden).map(page => ({ id: page.id, title: page.name, href: page.path }))
      : props.items?.map(item => ({ id: item.id, title: item.title, href: item.description || '#' })) || [];
  
  const getHeaderStyle = (): React.CSSProperties => {
    const shouldBeTransparent = isTransparent && !isScrolled;
    
    // Overlay mode: header floats over content with negative margin
    if (overlayMode) {
      if (scrollBehavior === 'sticky') {
        return {
          ...baseStyle,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          marginBottom: -headerHeight,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease',
          boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      if (scrollBehavior === 'show-on-scroll-up') {
        return {
          ...baseStyle,
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          marginBottom: -headerHeight,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease, transform 0.3s ease',
          transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-' + headerHeight + 'px)',
          boxShadow: isScrolled && isHeaderVisible ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      // Static overlay - absolute positioning
      return { 
        ...baseStyle, 
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease',
        boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    // Non-overlay modes (original behavior)
    if (scrollBehavior === 'static') {
      if (isTransparent) {
        return { 
          ...baseStyle, 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
          transition: 'background-color 0.3s ease',
          boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
        };
      }
      return { ...baseStyle, position: 'relative' };
    }
    
    if (scrollBehavior === 'sticky') {
      return {
        ...baseStyle,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease',
        boxShadow: isScrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    if (scrollBehavior === 'show-on-scroll-up') {
      return {
        ...baseStyle,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: shouldBeTransparent ? 'transparent' : scrolledBackgroundColor,
        transition: 'background-color 0.3s ease, transform 0.3s ease, margin-bottom 0.3s ease',
        transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-' + headerHeight + 'px)',
        marginBottom: isHeaderVisible ? 0 : -headerHeight,
        boxShadow: isScrolled && isHeaderVisible ? '0 2px 10px rgba(0,0,0,0.1)' : 'none',
      };
    }
    
    return { ...baseStyle, position: 'relative' };
  };
  
  return (
    <header ref={headerRef} style={getHeaderStyle()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
          {(() => {
            const logoUrl = typeof props.imageUrl === 'object' && props.imageUrl !== null 
              ? (props.imageUrl as any).url || (props.imageUrl as any).src 
              : props.imageUrl;
            return logoUrl ? (
              <img src={logoUrl} alt={props.imageAlt || props.title || 'Logo'} style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
            ) : null;
          })()}
          {props.title && <span>{props.title}</span>}
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {!isMobile && (
            <nav style={{ display: 'flex', gap: '24px' }}>
              {navItems.map(item => (
                <NavLinkItem 
                  key={item.id} 
                  href={item.href} 
                  textColor={styles.textColor || '#1a1a1a'}
                  hoverColor={hoverColor}
                >
                  {item.title}
                </NavLinkItem>
              ))}
            </nav>
          )}

          {/* Cart Button */}
          {showCart && (
            <button
              onClick={toggleCart}
              style={{
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={'Open cart with ' + totalItems + ' items'}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke={styles.textColor || '#1a1a1a'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" />
              </svg>
              {totalItems > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    minWidth: '18px',
                    height: '18px',
                    borderRadius: '9px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}
                >
                  {totalItems > 99 ? '99+' : totalItems}
                </span>
              )}
            </button>
          )}

          {isMobile && (
            <BurgerMenuButton
              isOpen={mobileMenuOpen}
              textColor={styles.textColor || '#1a1a1a'}
              hoverColor={hoverColor}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            />
          )}
        </div>
      </div>

      {isMobile && mobileMenuOpen && (
        <nav
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: styles.backgroundColor || '#ffffff',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 1000,
          }}
        >
          {navItems.map(item => (
            <NavLinkItem
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              textColor={styles.textColor || '#1a1a1a'}
              hoverColor={hoverColor}
              style={{ padding: '8px 0', fontSize: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
              {item.title}
            </NavLinkItem>
          ))}
        </nav>
      )}
    </header>
  );
}

function FooterSocialIcon({ platform }: { platform: string }) {
  const icons: Record<string, React.ReactNode> = {
    twitter: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
    instagram: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>,
    facebook: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
    linkedin: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></svg>,
    youtube: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.96-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" /></svg>,
  };
  return <>{icons[platform.toLowerCase()] || <span style={{ fontSize: '12px', fontWeight: 700 }}>{platform[0]}</span>}</>;
}

function FooterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '56px 24px 32px' });
  const fontFamily = resolveFontFamily(styles);
  const accentColor = resolveAccentColor(styles);
  const navItems = (props.items || []).map((item: any) => ({ title: item.title, href: item.description || '#' }));
  const columns: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = (props as any).footerColumns || [];
  const socialLinks: Array<{ platform: string; url: string }> = (props as any).socialLinks || [];
  const copyright = (props as any).copyright || '';
  const dividerColor = hexToRgba(styles.textColor || '#000', 0.07);

  return (
    <footer style={{ ...baseStyle, fontFamily, borderTop: '1px solid ' + hexToRgba(styles.textColor || '#000', 0.08) }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: columns.length > 0 ? '2fr ' + columns.map(() => '1fr').join(' ') : '1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            {props.title && <p style={{ fontWeight: 700, fontSize: '18px', marginBottom: '10px', letterSpacing: '-0.01em' }}>{props.title}</p>}
            {props.description && <p style={{ opacity: 0.55, fontSize: '14px', lineHeight: 1.65, maxWidth: '280px' }}>{props.description}</p>}
            {socialLinks.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                {socialLinks.map((social, i) => (
                  <a key={i} href={social.url} style={{ width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: hexToRgba(styles.textColor || '#000', 0.07), color: styles.textColor || 'inherit', textDecoration: 'none' }}>
                    <FooterSocialIcon platform={social.platform} />
                  </a>
                ))}
              </div>
            )}
            {navItems.length > 0 && columns.length === 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: '20px' }}>
                {navItems.map((item: any, i: number) => (
                  <a key={i} href={item.href} style={{ fontSize: '14px', opacity: 0.6, textDecoration: 'none', color: 'inherit' }}>{item.title}</a>
                ))}
              </div>
            )}
          </div>
          {columns.map((col, ci) => (
            <div key={ci}>
              <p style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.4, marginBottom: '14px' }}>{col.heading}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(col.links || []).map((link, li) => (
                  <a key={li} href={link.href} style={{ fontSize: '14px', opacity: 0.6, textDecoration: 'none', color: 'inherit' }}>{link.label}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid ' + dividerColor, paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          {copyright && <p style={{ fontSize: '13px', opacity: 0.45 }}>{copyright}</p>}
          <div style={{ display: 'flex', gap: '16px', marginLeft: 'auto' }}>
            <a href="/privacy" style={{ fontSize: '13px', opacity: 0.45, textDecoration: 'none', color: 'inherit' }}>${jsx(t.legalPrivacy)}</a>
            <a href="/terms" style={{ fontSize: '13px', opacity: 0.45, textDecoration: 'none', color: 'inherit' }}>${jsx(t.legalTerms)}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function ProductGridSection({ props, styles, products }: { props: ComponentProps; styles: ComponentStyles; products: any[] }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const columns = props.columns || 3;
  const limit = props.productLimit || 6;
  const displayProducts = products.slice(0, limit);
  
  const responsiveCSS = \`
    .product-grid-ssr {
      display: grid;
      grid-template-columns: 1fr;
      gap: 20px;
    }
    @media (min-width: 480px) {
      .product-grid-ssr {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
      }
    }
    @media (min-width: 768px) {
      .product-grid-ssr {
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }
    }
    @media (min-width: 1024px) {
      .product-grid-ssr {
        grid-template-columns: repeat(4, 1fr);
        gap: 24px;
      }
    }
    .product-card-ssr {
      background: rgba(255,255,255,0.98);
      border-radius: 16px;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.06);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      text-decoration: none;
      color: inherit;
      display: block;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .product-card-ssr:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
    }
    .product-image-ssr {
      position: relative;
      width: 100%;
      padding-top: 100%;
      overflow: hidden;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }
    @media (max-width: 479px) {
      .product-image-ssr {
        padding-top: 85%;
      }
    }
    .product-image-ssr img {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .product-placeholder-ssr {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 56px;
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    }
    .product-info-ssr {
      padding: 16px;
    }
    @media (max-width: 479px) {
      .product-info-ssr {
        padding: 20px;
      }
    }
    .product-name-ssr {
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 14px;
      line-height: 1.3;
      color: #1a1a1a;
    }
    @media (max-width: 479px) {
      .product-name-ssr {
        font-size: 18px;
        margin-bottom: 6px;
      }
    }
    .product-category-ssr {
      font-size: 11px;
      opacity: 0.5;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }
    @media (max-width: 479px) {
      .product-category-ssr {
        font-size: 12px;
        margin-bottom: 10px;
      }
    }
    .product-price-ssr {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a1a;
    }
    @media (max-width: 479px) {
      .product-price-ssr {
        font-size: 20px;
      }
    }
  \`;
  
  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <style dangerouslySetInnerHTML={{ __html: responsiveCSS }} />
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px', textAlign: 'center' }}>{props.description}</p>}
        
        {displayProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
            <p>${jsx(t.ssrProductsEmpty)}</p>
          </div>
        ) : (
          <div className="product-grid-ssr">
            {displayProducts.map((product: any) => (
              <div key={product.id} className="product-card-ssr">
                <div className="product-image-ssr">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} />
                  ) : (
                    <div className="product-placeholder-ssr">📦</div>
                  )}
                </div>
                <div className="product-info-ssr">
                  <h3 className="product-name-ssr">{product.name}</h3>
                  {product.category && <p className="product-category-ssr">{product.category}</p>}
                  <p className="product-price-ssr">\${parseFloat(product.price).toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function GallerySection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const images = props.images || [];
  const columns = props.columns || 2;
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stDesc = getStyledText(props.styledDescription, props.description);

  return (
    <section style={{ ...baseStyle, fontFamily, borderRadius: styles.borderRadius }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', ...stTitle.style }}>{stTitle.text}</h2>}
        {stDesc.text && <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.8, marginBottom: '32px', textAlign: 'center', ...stDesc.style }}>{stDesc.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, 1fr)\`, gap: styles.gap || '16px' }}>
          {images.map((image: ImageValue, index: number) => {
            const imageUrl = getImageUrl(image);
            return imageUrl ? (
              <img key={index} src={imageUrl} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: styles.borderRadius || '8px' }} />
            ) : null;
          })}
        </div>
      </div>
    </section>
  );
}

function PricingTableSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const items = props.items || (props as any).plans || [];
  const cardStyle = (styles.cardStyle as string) || 'elevated';
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  const getCardStyles = (): React.CSSProperties => {
    switch (cardStyle) {
      case 'elevated': return { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)' };
      case 'bordered': return { border: '1px solid ' + hexToRgba(accentColor, 0.12) };
      case 'glass': return { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
      default: return {};
    }
  };

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.8, marginBottom: '48px', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + (Math.min(items.length, 3) || 1) + ', 1fr)', gap: '20px', alignItems: 'stretch' }}>
          {items.map((item: any, index: number) => {
            const isHighlighted = item.highlighted === true;
            const price = String(item.price || item.description || '');
            const period = item.period || '/mo';
            const features: string[] = item.features || [];
            const cta = item.ctaText || props.buttonText || 'Get started';
            const ctaLink = item.ctaLink || props.buttonLink || '#';
            return (
              <div key={item.id || index} style={{
                padding: '36px 32px',
                borderRadius: '24px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                textAlign: 'left',
                backgroundColor: isHighlighted ? accentColor : ((styles as any).cardBackground || hexToRgba(accentColor, 0.04)),
                border: isHighlighted ? 'none' : '1px solid ' + hexToRgba(accentColor, 0.1),
                boxShadow: isHighlighted ? '0 20px 60px ' + hexToRgba(accentColor, 0.3) : '0 2px 12px rgba(0,0,0,0.05)',
                color: isHighlighted ? getContrastColor(accentColor) : styles.textColor,
                transform: isHighlighted ? 'scale(1.03)' : 'scale(1)',
                ...getCardStyles(),
                ...getItemStyle(index),
              }}>
                {isHighlighted && (
                  <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fff', color: accentColor, fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '999px', boxShadow: '0 4px 16px ' + hexToRgba(accentColor, 0.25), whiteSpace: 'nowrap' }}>
                    ✦ {(props as any).popularBadge || 'Most popular'}
                  </div>
                )}
                <p style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: isHighlighted ? 0.8 : 0.55, marginBottom: '12px' }}>{item.title || item.name}</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '48px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.03em' }}>{price}</span>
                  {period && <span style={{ fontSize: '14px', opacity: 0.6, paddingBottom: '8px' }}>{period}</span>}
                </div>
                {item.description && price && item.description !== price && (
                  <p style={{ fontSize: '14px', opacity: 0.65, marginBottom: '24px', lineHeight: 1.6 }}>{item.description}</p>
                )}
                <div style={{ height: '1px', backgroundColor: isHighlighted ? 'rgba(255,255,255,0.2)' : hexToRgba(accentColor, 0.1), margin: '20px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, marginBottom: '28px' }}>
                  {(features.length > 0 ? features : [item.description].filter(Boolean)).map((feature: string, fi: number) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', lineHeight: 1.5 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isHighlighted ? 'rgba(255,255,255,0.85)' : accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: '1px', flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>
                      <span style={{ opacity: isHighlighted ? 0.9 : 0.8 }}>{feature}</span>
                    </div>
                  ))}
                </div>
                <a href={ctaLink} style={{
                  display: 'block', textAlign: 'center', padding: '14px 24px', borderRadius: '12px', fontWeight: 700, fontSize: '15px', textDecoration: 'none', letterSpacing: '0.01em',
                  backgroundColor: isHighlighted ? '#fff' : resolveButtonColor(styles),
                  color: isHighlighted ? accentColor : getContrastColor(resolveButtonColor(styles)),
                }}>{cta}</a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const items = props.items || [];
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '800px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.8, marginBottom: '40px', textAlign: 'center', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '12px' }}>
          {items.map((item: any, index: number) => (
            <details key={item.id || index} style={{
              padding: '20px 24px',
              borderRadius: '12px',
              backgroundColor: hexToRgba(accentColor, 0.04),
              border: '1px solid ' + hexToRgba(accentColor, 0.08),
              cursor: 'pointer',
              ...getItemStyle(index),
            }}>
              <summary style={{ fontWeight: 600, fontSize: '17px', lineHeight: 1.4 }}>{item.title}</summary>
              <p style={{ marginTop: '12px', opacity: 0.75, lineHeight: 1.7, fontSize: '15px' }}>{item.description}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsCounterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const stats = (props as any).stats || [];
  const { containerRef, getItemStyle } = useStaggerAnimation(stats.length);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '32px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.8, marginBottom: '48px', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '24px', position: 'relative' }}>
          {stats.map((stat: any, index: number) => (
            <div key={stat.id || index} style={{ position: 'relative', ...getItemStyle(index) }}>
              {index > 0 && (
                <div style={{ position: 'absolute', left: '-12px', top: '20%', bottom: '20%', width: '1px', backgroundColor: hexToRgba(accentColor, 0.12) }} />
              )}
              <div style={{ padding: '28px 20px', borderRadius: '20px', backgroundColor: hexToRgba(accentColor, 0.04), border: '1px solid ' + hexToRgba(accentColor, 0.08), textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '40px', height: '3px', borderRadius: '0 0 3px 3px', backgroundColor: accentColor, opacity: 0.7 }} />
                {stat.icon ? (
                  <div style={{ fontSize: '26px', marginBottom: '10px', lineHeight: 1 }}>{stat.icon}</div>
                ) : stat.suffix ? (
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>{String(stat.suffix).includes('%') ? '📊' : '⚡'}</div>
                ) : null}
                <div style={{ fontSize: '52px', fontWeight: 800, marginBottom: '6px', lineHeight: 1, letterSpacing: '-0.03em', color: accentColor }}>
                  {stat.prefix}{stat.value}{stat.suffix}
                </div>
                <div style={{ fontSize: '14px', opacity: 0.6, lineHeight: 1.4, fontWeight: 500 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoEmbedSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const videoUrl = (props as any).videoUrl || '';
  
  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return \`https://www.youtube.com/embed/\${videoId}\`;
    }
    if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return \`https://www.youtube.com/embed/\${videoId}\`;
    }
    if (url.includes('vimeo.com/')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
      return \`https://player.vimeo.com/video/\${videoId}\`;
    }
    return url;
  };
  
  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius, fontFamily }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        {(() => { const st = getStyledText(props.styledTitle, props.title); return st.text ? <h2 style={{ fontSize: styles.titleFontSize || '32px', fontWeight: 700, marginBottom: '8px', ...st.style }}>{st.text}</h2> : null; })()}
        {(() => { const st = getStyledText(props.styledDescription, props.description); return st.text ? <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.8, marginBottom: '32px', ...st.style }}>{st.text}</p> : null; })()}
        {videoUrl ? (
          <div style={{ aspectRatio: '16/9', borderRadius: styles.borderRadius || '12px', overflow: 'hidden' }}>
            <iframe 
              src={getEmbedUrl(videoUrl)} 
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div style={{ aspectRatio: '16/9', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '48px' }}>▶️</span>
          </div>
        )}
      </div>
    </section>
  );
}

function DividerSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const dividerStyle = (props as any).style || 'solid';
  const accentColor = styles.accentColor || '#e2e8f0';
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <hr style={{ 
          border: 'none', 
          height: '2px', 
          background: dividerStyle === 'gradient' 
            ? \`linear-gradient(90deg, transparent, \${accentColor}, transparent)\`
            : accentColor,
          borderStyle: dividerStyle === 'dashed' ? 'dashed' : 'solid',
          borderColor: dividerStyle === 'dashed' ? accentColor : 'transparent',
          borderWidth: dividerStyle === 'dashed' ? '1px' : '0',
        }} />
      </div>
    </section>
  );
}

function SpacerSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const height = (props as any).height || styles.minHeight || '60px';
  
  return (
    <section 
      style={{ 
        height, 
        backgroundColor: styles.backgroundColor || 'transparent',
      }}
    />
  );
}

function NewsletterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;
    setIsSubmitting(true);
    setTimeout(() => {
      setSubmitted(true);
      setIsSubmitting(false);
    }, 1000);
  };

  const textColor = styles.textColor || '#1a1a1a';
  const buttonColor = resolveButtonColor(styles);
  const buttonHoverColor = (styles.buttonHoverColor as string) || '#4338ca';
  const buttonTextColor = getContrastColor(buttonColor);

  const fontFamily = resolveFontFamily(styles);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section
      style={{
        ...getBaseStyle(styles),
        fontFamily,
      }}
    >
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && (
          <h2 style={{ fontSize: styles.titleFontSize || '32px', fontWeight: '700', marginBottom: '16px', color: textColor, ...stTitle.style }}>
            {stTitle.text}
          </h2>
        )}
        {stSub.text && (
          <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.8, marginBottom: '32px', color: textColor, ...stSub.style }}>
            {stSub.text}
          </p>
        )}
        {(props as any).socialProof && !submitted && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '20px', fontSize: '13px', opacity: 0.55 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            {(props as any).socialProof}
          </div>
        )}
        {submitted ? (
          <div style={{ padding: '20px', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '8px' }}>
            <p style={{ fontSize: '16px', fontWeight: '500' }}>
              {props.successMessage || ${lit(t.newsletterSuccess)}}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', maxWidth: '500px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              placeholder={props.placeholder || ${lit(t.newsletterPlaceholder)}}
              style={{
                flex: '1 1 250px',
                padding: '14px 18px',
                fontSize: '16px',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                minWidth: '200px',
              }}
            />
            <HoverButtonComponent
              type="submit"
              disabled={isSubmitting}
              backgroundColor={buttonColor}
              hoverBackgroundColor={buttonHoverColor}
              textColor={buttonTextColor}
              style={{
                padding: '14px 28px',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              {props.buttonText || ${lit(t.newsletterButton)}}
            </HoverButtonComponent>
          </form>
        )}
        {(props as any).privacyNote && !submitted && (
          <p style={{ fontSize: '12px', opacity: 0.4, marginTop: '14px', lineHeight: 1.6 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            {(props as any).privacyNote}
          </p>
        )}
      </div>
    </section>
  );
}

// === Missing component types (matching builder's ComponentRenderer) ===

function ServicesSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const services = (props as any).services || props.items || [];
  const cardStyle = (styles.cardStyle as string) || 'bordered';
  const { containerRef, getItemStyle } = useStaggerAnimation(services.length);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  const getCardStyles = (): React.CSSProperties => {
    switch (cardStyle) {
      case 'elevated':
        return { boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)', border: 'none' };
      case 'glass':
        return { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' };
      case 'flat':
        return { boxShadow: 'none', background: 'rgba(0,0,0,0.02)', border: 'none' };
      default:
        return { border: '1px solid ' + hexToRgba(accentColor, 0.1), boxShadow: 'none' };
    }
  };

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '1200px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '40px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.6, marginBottom: '64px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {services.map((item: any, index: number) => (
            <HoverCard key={item.id || index} accentColor={accentColor} style={{
              padding: '36px',
              borderRadius: '16px',
              backgroundColor: '#ffffff',
              transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease',
              textAlign: 'left',
              ...getCardStyles(),
              ...getItemStyle(index),
            }}>
              {item.icon && (
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: hexToRgba(accentColor, 0.08),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  marginBottom: '20px',
                }}>{item.icon}</div>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.3 }}>{item.title || item.name}</h3>
              <p style={{ fontSize: '15px', opacity: 0.7, lineHeight: 1.7 }}>{item.description}</p>
              {item.price !== undefined && item.price !== '' && (
                <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '16px', color: accentColor }}>{item.price}</p>
              )}
            </HoverCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const items = props.items || [];
  const { containerRef, getItemStyle } = useStaggerAnimation(items.length);
  const stTitle = getStyledText(props.styledTitle, props.title);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '800px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '40px', fontWeight: 700, marginBottom: '64px', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: '24px', top: 0, bottom: 0, width: '2px', backgroundColor: hexToRgba(accentColor, 0.15) }} />
          {items.map((item: any, index: number) => (
            <div key={item.id || index} style={{ display: 'flex', gap: '32px', marginBottom: '48px', position: 'relative', ...getItemStyle(index) }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: accentColor,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '16px',
                flexShrink: 0,
                zIndex: 1,
                boxShadow: '0 4px 12px ' + hexToRgba(accentColor, 0.3),
              }}>
                {item.year || index + 1}
              </div>
              <div style={{ flex: 1, paddingTop: '8px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', lineHeight: 1.3 }}>{item.title}</h3>
                <p style={{ fontSize: '15px', opacity: 0.7, lineHeight: 1.7 }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeamSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const members = (props as any).members || props.items || [];
  const cardStyle = (styles.cardStyle as string) || 'elevated';
  const { containerRef, getItemStyle } = useStaggerAnimation(members.length);
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  const getCardStyles = (): React.CSSProperties => {
    switch (cardStyle) {
      case 'bordered':
        return { border: '1px solid rgba(0,0,0,0.1)', boxShadow: 'none' };
      case 'glass':
        return { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' };
      case 'flat':
        return { boxShadow: 'none', background: 'rgba(0,0,0,0.02)' };
      default:
        return { boxShadow: '0 10px 40px rgba(0,0,0,0.1)' };
    }
  };

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div ref={containerRef} style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '40px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.7, marginBottom: '60px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '32px' }}>
          {members.map((member: any, index: number) => {
            const imageUrl = getImageUrl(member.imageUrl);
            return (
              <div key={member.id || index} style={{
                textAlign: 'center',
                padding: '32px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                ...getCardStyles(),
                ...getItemStyle(index),
              }}>
                {imageUrl ? (
                  <img src={imageUrl} alt={member.name || member.title} style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', marginBottom: '20px' }} />
                ) : (
                  <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: hexToRgba(accentColor, 0.1), margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                    👤
                  </div>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>{member.name || member.title}</h3>
                <p style={{ fontSize: '14px', color: accentColor, fontWeight: 500, marginBottom: '12px' }}>{member.role || member.description}</p>
                {member.bio && <p style={{ fontSize: '14px', opacity: 0.7, lineHeight: 1.6 }}>{member.bio}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SplitSectionComponent({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const accentColor = resolveAccentColor(styles);
  const layout = props.layout || 'image-left';
  const isImageLeft = layout === 'image-left' || props.imageSide === 'left';
  const imageUrl = getImageUrl(props.imageUrl);
  const bullets: (string | { text: string })[] = (props as any).bullets || [];
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);
  const stDesc = getStyledText(props.styledDescription, props.description);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '80px', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ order: layout === 'image-right' ? 1 : 2 }}>
          {stSub.text && (
            <div style={{ fontSize: '14px', fontWeight: 600, color: accentColor, textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: '16px', ...stSub.style }}>{stSub.text}</div>
          )}
          {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '40px', fontWeight: 700, marginBottom: '24px', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
          {stDesc.text && <p style={{ fontSize: styles.bodyFontSize || '18px', lineHeight: 1.7, opacity: 0.8, marginBottom: '32px', ...stDesc.style }}>{stDesc.text}</p>}
          {/* Support both bullets (template format) and items (generic format) */}
          {bullets.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {bullets.map((bullet, index) => (
                <li key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                  <span style={{ color: accentColor, fontWeight: 700, fontSize: '20px' }}>✓</span>
                  <span style={{ fontSize: '16px' }}>{typeof bullet === 'string' ? bullet : bullet.text}</span>
                </li>
              ))}
            </ul>
          )}
          {props.items && props.items.length > 0 && bullets.length === 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {props.items.map((item) => (
                <li key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ color: accentColor, fontSize: '18px', lineHeight: 1.4 }}>✓</span>
                  <div>
                    <strong style={{ fontSize: '15px' }}>{item.title}</strong>
                    {item.description && <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '2px' }}>{item.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {props.buttonText && (
            <HoverButtonComponent
              backgroundColor={resolveButtonColor(styles)}
              hoverBackgroundColor={styles.buttonHoverColor as string || '#4338ca'}
              textColor={getContrastColor(resolveButtonColor(styles))}
              href={props.buttonLink || '#'}
              style={{ marginTop: '32px' }}
            >
              {props.buttonText}
            </HoverButtonComponent>
          )}
        </div>
        <div style={{ order: layout === 'image-right' ? 2 : 1 }}>
          {imageUrl ? (
            <img src={imageUrl} alt={props.imageAlt || ''} style={{ width: '100%', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }} />
          ) : (
            <div style={{ aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '48px', opacity: 0.3 }}>\u{1F5BC}\u{FE0F}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ComparisonTableSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const tableColumns = (props as any).tableColumns || [];
  const features = (props as any).features || [];
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '18px', opacity: 0.7, marginBottom: '48px', textAlign: 'center', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px' }}>
            <thead>
              <tr>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid ' + hexToRgba(accentColor, 0.2), fontWeight: 600 }}>{(props as any).featuresLabel || ${lit(t.comparisonFeature)}}</th>
                {tableColumns.map((col: any, i: number) => (
                  <th key={col?.id || i} style={{ padding: '16px', textAlign: 'center', borderBottom: '2px solid ' + hexToRgba(accentColor, 0.2), fontWeight: 600, backgroundColor: col?.highlighted ? hexToRgba(accentColor, 0.1) : 'transparent' }}>
                    <div style={{ fontWeight: 700, fontSize: '18px' }}>{typeof col === 'string' ? col : (col?.name || col?.label)}</div>
                    {typeof col !== 'string' && col?.price && (
                      <div style={{ fontSize: '24px', fontWeight: 700, color: accentColor, marginTop: '8px' }}>{col.price}</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature: any, fi: number) => (
                <tr key={fi} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 500 }}>{feature.name}</td>
                  {(feature.values || []).map((val: any, vi: number) => (
                    <td key={vi} style={{ padding: '14px 16px', textAlign: 'center', backgroundColor: tableColumns[vi]?.highlighted ? hexToRgba(accentColor, 0.05) : 'transparent' }}>
                      {val === true || val === 'Yes' ? <span style={{ color: accentColor }}>✓</span> : val === false || val === 'No' ? <span style={{ opacity: 0.3 }}>—</span> : val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function TabsSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const items = (props as any).tabs || props.items || [];
  const [activeTab, setActiveTab] = useState(0);
  const stTitle = getStyledText(props.styledTitle, props.title);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '32px', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {items.map((item: any, index: number) => (
            <button
              key={item.id || index}
              onClick={() => setActiveTab(index)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === index ? accentColor : hexToRgba(accentColor, 0.08),
                color: activeTab === index ? getContrastColor(accentColor) : 'inherit',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {item.title}
            </button>
          ))}
        </div>
        {items[activeTab] && (
          <div style={{ padding: '32px', backgroundColor: hexToRgba(accentColor, 0.03), borderRadius: '16px', border: '1px solid ' + hexToRgba(accentColor, 0.08) }}>
            <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>{items[activeTab].title}</h3>
            <p style={{ fontSize: '16px', lineHeight: 1.7, opacity: 0.85 }}>{items[activeTab].content || items[activeTab].description}</p>
            {items[activeTab].imageUrl && (
              <img src={getImageUrl(items[activeTab].imageUrl)} alt="" loading="lazy" style={{ width: '100%', borderRadius: '12px', marginTop: '24px' }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function MarqueeSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const items = props.items || [];
  const speed = props.speed || 30;
  const direction = (props as any).direction || 'left';

  return (
    <section style={{ ...baseStyle, fontFamily, overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes marqueeLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } } @keyframes marqueeRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }' }} />
      <div style={{
        display: 'flex',
        animation: 'marquee' + (direction === 'right' ? 'Right' : 'Left') + ' ' + speed + 's linear infinite',
        whiteSpace: 'nowrap',
      }}>
        {[...items, ...items].map((item: any, index: number) => (
          <span key={index} style={{ padding: '0 48px', fontSize: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '48px' }}>
            {item.text || item.title || item.name}
            <span style={{ opacity: 0.3 }}>\u2605</span>
          </span>
        ))}
      </div>
    </section>
  );
}

function ContactFormSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const accentColor = resolveAccentColor(styles);
  const fontFamily = resolveFontFamily(styles);
  const fields = props.formFields || [];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      const data: Record<string, string> = {};
      formData.forEach((value, key) => { data[key] = value as string; });
      await fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: data }),
      });
      setSubmitted(true);
    } catch (err) {
      console.error('Form submission error:', err);
    }
    setIsSubmitting(false);
  };

  if (submitted) {
    return (
      <section style={{ ...baseStyle, fontFamily }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>${jsx(t.formSuccessTitle)}</h2>
          <p style={{ opacity: 0.7 }}>${jsx(t.formSuccessBody)}</p>
        </div>
      </section>
    );
  }

  const stTitle = getStyledText(props.styledTitle, props.title);
  const stDesc = getStyledText(props.styledDescription, props.description);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', ...stTitle.style }}>{stTitle.text}</h2>}
        {stDesc.text && <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.7, marginBottom: '32px', textAlign: 'center', lineHeight: 1.5, ...stDesc.style }}>{stDesc.text}</p>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fields.map((field) => (
            <div key={field.id}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px' }}>{field.label}{field.required && ' *'}</label>
              {field.type === 'textarea' ? (
                <textarea name={field.label} required={field.required} placeholder={field.placeholder || ''} rows={4} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid ' + hexToRgba(accentColor, 0.2), fontSize: '15px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              ) : (
                <input name={field.label} type={field.type || 'text'} required={field.required} placeholder={field.placeholder || ''} style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid ' + hexToRgba(accentColor, 0.2), fontSize: '15px', outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>
          ))}
          <HoverButtonComponent
            type="submit"
            disabled={isSubmitting}
            backgroundColor={resolveButtonColor(styles)}
            hoverBackgroundColor={styles.buttonHoverColor as string || '#4338ca'}
            textColor={getContrastColor(resolveButtonColor(styles))}
            style={{ marginTop: '8px', width: '100%' }}
          >
            {props.buttonText || ${lit(t.formSubmit)}}
          </HoverButtonComponent>
        </form>
      </div>
    </section>
  );
}

function BeforeAfterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const [sliderPosition, setSliderPosition] = useState(props.sliderPosition || 50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Parse image values that could be strings or objects with url/crop
  const beforeImageUrl = typeof props.beforeImage === 'object' && props.beforeImage?.url 
    ? props.beforeImage.url 
    : (props.beforeImage || '');
  const afterImageUrl = typeof props.afterImage === 'object' && props.afterImage?.url 
    ? props.afterImage.url 
    : (props.afterImage || '');

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  const textColor = styles.textColor || '#1a1a1a';

  return (
    <section
      style={{
        backgroundColor: styles.backgroundColor || '#ffffff',
        padding: styles.padding || '60px 24px',
        color: textColor,
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        {props.title && (
          <h2 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '32px', textAlign: 'center', color: textColor }}>
            {props.title}
          </h2>
        )}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            overflow: 'hidden',
            borderRadius: '12px',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={() => setIsDragging(true)}
          onTouchMove={handleTouchMove}
          onTouchEnd={() => setIsDragging(false)}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: afterImageUrl ? \`url(\${afterImageUrl})\` : 'none',
              backgroundColor: afterImageUrl ? 'transparent' : '#e5e7eb',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: beforeImageUrl ? \`url(\${beforeImageUrl})\` : 'none',
              backgroundColor: beforeImageUrl ? 'transparent' : '#d1d5db',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              clipPath: \`inset(0 \${100 - sliderPosition}% 0 0)\`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: \`\${sliderPosition}%\`,
              width: '4px',
              backgroundColor: '#ffffff',
              boxShadow: '0 0 10px rgba(0,0,0,0.3)',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: \`\${sliderPosition}%\`,
              width: '40px',
              height: '40px',
              backgroundColor: '#ffffff',
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            ⟷
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {props.beforeLabel || 'Before'}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              right: '16px',
              padding: '6px 12px',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#ffffff',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {props.afterLabel || 'After'}
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoCloudSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const logos = props.logos || props.items || [];
  const isGrayscale = props.grayscale === true || props.grayscale === 'true';
  const stTitle = getStyledText(props.styledTitle, props.title);
  const stSub = getStyledText(props.styledSubtitle, props.subtitle);

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        {stTitle.text && <h2 style={{ fontSize: styles.titleFontSize || '24px', fontWeight: 600, marginBottom: '8px', lineHeight: 1.3, ...stTitle.style }}>{stTitle.text}</h2>}
        {stSub.text && <p style={{ fontSize: styles.bodyFontSize || '16px', opacity: 0.7, marginBottom: '40px', lineHeight: 1.5, ...stSub.style }}>{stSub.text}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '40px' }}>
          {logos.map((logo: any, index: number) => {
            const logoUrl = getImageUrl(logo.imageUrl);
            return logoUrl ? (
              <img
                key={logo.id || index}
                src={logoUrl}
                alt={logo.name || logo.title || ''}
                style={{
                  height: '40px',
                  maxWidth: '140px',
                  objectFit: 'contain',
                  filter: isGrayscale ? 'grayscale(100%) opacity(0.6)' : 'none',
                  transition: 'filter 0.3s ease',
                }}
              />
            ) : (
              <span key={logo.id || index} style={{ fontSize: '14px', fontWeight: 500, opacity: 0.5 }}>{logo.name || logo.title}</span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RichTextSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const fontFamily = resolveFontFamily(styles);
  const accentColor = resolveAccentColor(styles);
  const content = props.content || '';
  const maxWidth = props.maxWidth || '720px';
  const alignment = props.alignment || 'center';

  return (
    <section style={{ ...baseStyle, fontFamily }}>
      <div style={{
        maxWidth,
        margin: alignment === 'center' ? '0 auto' : alignment === 'right' ? '0 0 0 auto' : '0',
      }}>
        <div
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            fontSize: styles.bodyFontSize || '17px',
            lineHeight: 1.8,
            color: styles.textColor || '#374151',
          }}
        />
        <style dangerouslySetInnerHTML={{ __html: \`
          .rich-text-content h1 { font-size: 2.5em; font-weight: 800; margin: 1em 0 0.5em; line-height: 1.2; }
          .rich-text-content h2 { font-size: 2em; font-weight: 700; margin: 1em 0 0.5em; line-height: 1.2; }
          .rich-text-content h3 { font-size: 1.5em; font-weight: 600; margin: 0.8em 0 0.4em; line-height: 1.3; }
          .rich-text-content p { margin: 0 0 1em; }
          .rich-text-content blockquote { border-left: 4px solid \${accentColor}; padding: 16px 24px; margin: 24px 0; font-style: italic; opacity: 0.85; background: rgba(0,0,0,0.02); border-radius: 0 8px 8px 0; }
          .rich-text-content a { color: \${accentColor}; text-decoration: underline; }
          .rich-text-content ul, .rich-text-content ol { padding-left: 24px; margin: 0 0 1em; }
          .rich-text-content li { margin-bottom: 0.5em; }
          .rich-text-content img { max-width: 100%; border-radius: 8px; margin: 16px 0; }
          .rich-text-content hr { border: none; height: 1px; background: rgba(0,0,0,0.1); margin: 32px 0; }
        \` }} />
      </div>
    </section>
  );
}

// A container holds other components: its props.children are the ids of
// components stored alongside it on the page. The page hands the whole list
// down so the children can be drawn inside the container here, the way the
// builder does it - previously they were dropped, and the published page
// showed an empty box with the children loose underneath it.
function ContainerSection({
  props,
  styles,
  allComponents = [],
  products = [],
  pages = [],
  navItems,
}: {
  props: ComponentProps;
  styles: ComponentStyles;
  allComponents?: ComponentData[];
  products?: any[];
  pages?: BuilderPage[];
  navItems?: NavItem[];
}) {
  const layout = props.layout || 'vertical';
  const gap = props.gap || '24px';

  const layoutStyle: React.CSSProperties =
    layout === 'horizontal'
      ? { display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap }
      : layout === 'grid-2'
      ? { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap }
      : layout === 'grid-3'
      ? { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap }
      : layout === 'grid-4'
      ? { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap }
      : { display: 'flex', flexDirection: 'column', gap };

  const containerStyle: React.CSSProperties = {
    ...layoutStyle,
    backgroundColor: styles.backgroundColor || 'transparent',
    color: styles.textColor || '#1a1a1a',
    padding: styles.padding || '24px',
    borderRadius: styles.borderRadius || '0',
    maxWidth: styles.maxWidth || '1200px',
    margin: styles.margin || '0 auto',
    position: 'relative',
  };

  const childIds: string[] = (props.children as string[]) || [];
  const children = childIds
    .map((childId) => allComponents.find((c) => c.id === childId))
    .filter(Boolean) as ComponentData[];

  if (!children.length) return null;

  return (
    <div style={containerStyle} data-container-id={props.containerId || undefined}>
      {children.map((child) => (
        <ComponentRenderer
          key={child.id}
          component={child}
          products={products}
          pages={pages}
          navItems={navItems}
          allComponents={allComponents}
        />
      ))}
    </div>
  );
}

// ============ Custom components (primitive node trees) ============
// Mirrors the builder's CustomComponentRenderer: base styles apply always,
// tabletStyles <= 1024px, mobileStyles <= 640px. All SVG markup is
// sanitized server-side before the site is generated.

type PrimitiveNode = {
  id: string;
  type: 'box' | 'text' | 'image' | 'button' | 'svg' | 'capability';
  name?: string;
  hoverStyles?: Record<string, string>;
  /** Controlled motion presets (shared/motion.ts vocabulary) — data, not CSS. */
  motion?: any;
  styles?: Record<string, string>;
  tabletStyles?: Record<string, string>;
  mobileStyles?: Record<string, string>;
  text?: string;
  tag?: string;
  src?: string;
  alt?: string;
  label?: string;
  href?: string;
  variant?: string;
  svg?: string;
  children?: PrimitiveNode[];
  /** Trusted Birdflow widget — only on type === 'capability'. Birdflow owns the implementation. */
  capability?: string;
  /** Presentation-only config for capability nodes (whitelisted keys, no endpoints/scripts). */
  capabilityConfig?: Record<string, string | number | boolean>;
  /** Declarative interaction behavior — only on type === 'box'. Birdflow generates all runtime code. */
  behavior?: { type: string; multiple?: boolean; defaultOpen?: number; defaultTab?: number; autoPlay?: boolean; interval?: number; showArrows?: boolean; showDots?: boolean; defaultExpanded?: boolean; defaultOn?: boolean; };
};

function toKebabCase(key: string): string {
  return key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
}

function nodeClassName(node: PrimitiveNode): string {
  return 'pn-' + String(node.id).replace(/[^a-zA-Z0-9_-]/g, '');
}

function customButtonBaseStyles(variant?: string): Record<string, string> {
  const primary = theme.primaryColor || '#4f46e5';
  const secondary = (theme as any).secondaryColor || '#06b6d4';
  const radius = (theme as any).borderRadius || '8px';
  // The readable label colour for each of them, decided by the brand rather
  // than assumed to be white. The builder applies the same rule.
  const tokens = ((theme as any).tokens || {}) as Record<string, string>;
  const onPrimary = tokens['color.onPrimary'] || '#ffffff';
  const onSecondary = tokens['color.onSecondary'] || '#ffffff';
  const base: Record<string, string> = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: radius,
    fontWeight: '600',
    fontSize: '15px',
    lineHeight: '1.2',
    textDecoration: 'none',
    border: '2px solid transparent',
    cursor: 'pointer',
    transition: 'opacity 0.15s ease, transform 0.15s ease',
  };
  switch (variant) {
    case 'secondary':
      return { ...base, backgroundColor: secondary, color: onSecondary };
    case 'outline':
      return { ...base, backgroundColor: 'transparent', color: primary, borderColor: primary };
    case 'ghost':
      return { ...base, backgroundColor: 'transparent', color: primary };
    case 'link':
      return { ...base, backgroundColor: 'transparent', color: primary, padding: '0', textDecoration: 'underline' };
    default:
      return { ...base, backgroundColor: primary, color: onPrimary };
  }
}

// Defaults merged under user styles so per-node overrides always win. A
// hover PRESET from the motion vocabulary contributes the rest-state
// transition here (unless the node sets its own), exactly as the builder's
// resolvePrimitiveStyles does.
function customNodeBaseStyles(node: PrimitiveNode): Record<string, string> {
  const hoverName = node.motion && typeof node.motion === 'object' ? (node.motion as any).hover : undefined;
  const hasHoverPreset = typeof hoverName === 'string' && !!MOTION_TABLES.hovers[hoverName];
  const motionBase: Record<string, string> =
    hasHoverPreset && !(node.styles || {}).transition ? { transition: MOTION_TABLES.hoverTransition } : {};
  switch (node.type) {
    case 'box':
      return { display: 'flex', flexDirection: 'column', ...motionBase, ...(node.styles || {}) };
    case 'text':
      return { margin: '0', ...motionBase, ...(node.styles || {}) };
    case 'image':
      return { display: 'block', maxWidth: '100%', ...motionBase, ...(node.styles || {}) };
    case 'button':
      return { ...customButtonBaseStyles(node.variant), ...motionBase, ...(node.styles || {}) };
    case 'svg':
      return { display: 'block', lineHeight: '0', ...motionBase, ...(node.styles || {}) };
    default:
      return { ...motionBase, ...(node.styles || {}) };
  }
}

// Defense in depth: state is sanitized server-side before generation, but
// the emitter still refuses any key/value that could escape a CSS rule.
const SAFE_STYLE_KEY = /^[a-zA-Z]+$/;

function safeStyleValue(value: unknown): string | null {
  if (value == null) return null;
  const str = String(value).trim();
  if (!str || str.length > 300) return null;
  if (/[<>{}@;]/.test(str)) return null;
  if (str.indexOf('\\\\') >= 0) return null;
  if (/expression\\s*\\(|javascript:/i.test(str)) return null;
  return str;
}

function customStyleBlock(selector: string, styles?: Record<string, string>): string {
  if (!styles) return '';
  const decls: string[] = [];
  for (const [k, v] of Object.entries(styles)) {
    if (!SAFE_STYLE_KEY.test(k)) continue;
    const val = safeStyleValue(v);
    if (val == null) continue;
    decls.push(toKebabCase(k) + ':' + val + ';');
  }
  if (!decls.length) return '';
  return selector + '{' + decls.join('') + '}';
}

// Hover is emitted last so it wins over the breakpoint overrides, which is
// how the builder resolves it too. A hover preset from the motion
// vocabulary sits UNDER the node's explicit hoverStyles — same merge order
// as resolvePrimitiveStyles in the builder.
function collectCustomCss(node: PrimitiveNode, base: string[], tablet: string[], mobile: string[], hover: string[]) {
  const cls = '.' + nodeClassName(node);
  const b = customStyleBlock(cls, customNodeBaseStyles(node));
  if (b) base.push(b);
  const t = customStyleBlock(cls, node.tabletStyles);
  if (t) tablet.push(t);
  const m = customStyleBlock(cls, node.mobileStyles);
  if (m) mobile.push(m);
  const hoverName = node.motion && typeof node.motion === 'object' ? (node.motion as any).hover : undefined;
  const hoverPreset = typeof hoverName === 'string' ? MOTION_TABLES.hovers[hoverName] : undefined;
  const hoverDecls = hoverPreset ? { ...hoverPreset, ...(node.hoverStyles || {}) } : node.hoverStyles;
  const h = customStyleBlock(cls + ':hover', hoverDecls);
  if (h) hover.push(h);
  (node.children || []).forEach((child) => collectCustomCss(child, base, tablet, mobile, hover));
}

function fitCustomSvg(svg: string): string {
  const rootMatch = svg.match(/^<svg\\b[^>]*>/i);
  if (!rootMatch) return svg;
  if (/style="/i.test(rootMatch[0])) {
    return svg.replace(/^(<svg\\b[^>]*?)style="([^"]*)"/i, '$1style="$2;width:100%;height:100%;display:block"');
  }
  return svg.replace(/^<svg\\b/i, '<svg style="width:100%;height:100%;display:block"');
}

const CUSTOM_TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'blockquote'];

function safeCustomHref(href?: string): string {
  if (!href) return '#';
  const t = href.trim();
  if (!t || t.length > 2000) return '#';
  if (/[\\u0000-\\u001f\\u007f<>"']/.test(t)) return '#';
  if (t.charAt(0) === '#' || t.charAt(0) === '?') return t;
  if (t.slice(0, 2) === '//') return '#';
  if (t.charAt(0) === '/' || t.slice(0, 2) === './' || t.slice(0, 3) === '../') return t;
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  const colon = t.indexOf(':');
  if (colon === -1) return t;
  const slash = t.indexOf('/');
  if (slash !== -1 && colon > slash) return t;
  return '#';
}

// Context that threads the host page's product catalogue through
// ComponentRenderer → CustomComponentSection → CustomNode → capability nodes.
// Without this an embedded product_grid would always render an empty grid
// regardless of the site's catalogue. Only set when rendering a custom-type
// section; all other component types are unaffected.
const CapabilityProductsCtx = React.createContext<any[]>([]);

// ============ Behavior label extraction ============

function extractBehaviorLabel(node: PrimitiveNode, fallback: string): string {
  if (node.name && node.name.trim()) return String(node.name).trim().slice(0, 80);
  const findText = (n: PrimitiveNode): string => {
    if (n.type === 'text' && n.text) return String(n.text).slice(0, 60);
    for (const child of (n.children || [])) {
      const t = findText(child);
      if (t) return t;
    }
    return '';
  };
  return findText(node) || fallback;
}

// ============ Behavior wrapper components ============
// Birdflow-authored interaction implementations. The AI spec only sets the
// behavior type + display hints; no user-provided JavaScript is ever used.
// Keyboard accessibility (tab, Enter/Space, arrow keys) follows WAI-ARIA patterns.

function BehaviorAccordion({ node, staggerParent, multiple, defaultOpen }: { node: PrimitiveNode; staggerParent?: any; multiple?: boolean; defaultOpen?: number }) {
  const [openSet, setOpenSet] = useState<Set<number>>(function() { return new Set([defaultOpen != null ? defaultOpen : 0]); });
  const cls = nodeClassName(node);
  const children = node.children || [];
  return (
    <div className={cls}>
      {children.map(function(child: PrimitiveNode, i: number) {
        const isOpen = openSet.has(i);
        const label = extractBehaviorLabel(child, 'Panel ' + (i + 1));
        return (
          <div key={child.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
            <button
              aria-expanded={isOpen}
              onClick={function() {
                setOpenSet(function(prev: Set<number>) {
                  const next = new Set(prev);
                  if (next.has(i)) { next.delete(i); }
                  else { if (!multiple) next.clear(); next.add(i); }
                  return next;
                });
              }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '16px', textAlign: 'left', color: 'inherit' }}
            >
              {label}
              <span aria-hidden="true" style={{ transition: 'transform 0.2s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>{'▾'}</span>
            </button>
            {isOpen && (
              <div role="region" style={{ paddingBottom: '16px' }}>
                <CustomNode node={child} staggerParent={staggerParent} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BehaviorTabs({ node, staggerParent, defaultTab }: { node: PrimitiveNode; staggerParent?: any; defaultTab?: number }) {
  const [active, setActive] = useState(defaultTab != null ? defaultTab : 0);
  const cls = nodeClassName(node);
  const children = node.children || [];
  const primary = (theme as any).primaryColor || '#4f46e5';
  return (
    <div className={cls}>
      <div role="tablist" style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' as const }}>
        {children.map(function(child: PrimitiveNode, i: number) {
          const label = extractBehaviorLabel(child, 'Tab ' + (i + 1));
          const isActive = active === i;
          return (
            <button
              key={child.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={'tab-panel-' + node.id + '-' + i}
              id={'tab-btn-' + node.id + '-' + i}
              tabIndex={isActive ? 0 : -1}
              onClick={function() { setActive(i); }}
              style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '15px', background: 'transparent', borderBottom: isActive ? '2px solid ' + primary : '2px solid transparent', marginBottom: '-2px', color: isActive ? primary : 'inherit', transition: 'color 0.15s, border-color 0.15s' }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {children.map(function(child: PrimitiveNode, i: number) {
        return (
          <div
            key={child.id}
            role="tabpanel"
            id={'tab-panel-' + node.id + '-' + i}
            aria-labelledby={'tab-btn-' + node.id + '-' + i}
            hidden={active !== i}
          >
            <CustomNode node={child} staggerParent={staggerParent} />
          </div>
        );
      })}
    </div>
  );
}

function BehaviorCarousel({ node, staggerParent, showArrows, showDots, autoPlay, interval: intervalMs }: { node: PrimitiveNode; staggerParent?: any; showArrows?: boolean; showDots?: boolean; autoPlay?: boolean; interval?: number }) {
  const [current, setCurrent] = useState(0);
  const children = node.children || [];
  const total = children.length;
  const cls = nodeClassName(node);
  const primary = (theme as any).primaryColor || '#4f46e5';
  const showA = showArrows !== false;
  const showD = showDots !== false;

  useEffect(function() {
    if (!autoPlay || total < 2) return undefined;
    const id = setInterval(function() { setCurrent(function(c: number) { return (c + 1) % total; }); }, intervalMs != null ? intervalMs : 4000);
    return function() { clearInterval(id); };
  }, [autoPlay, intervalMs, total]);

  return (
    <div className={cls} style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', transition: 'transform 0.35s ease', transform: 'translateX(-' + (current * 100) + '%)' }}>
        {children.map(function(child: PrimitiveNode) {
          return (
            <div key={child.id} style={{ flex: '0 0 100%', minWidth: '100%' }}>
              <CustomNode node={child} staggerParent={staggerParent} />
            </div>
          );
        })}
      </div>
      {showA && total > 1 && (
        <React.Fragment>
          <button aria-label="Forrige" onClick={function() { setCurrent(function(c: number) { return (c - 1 + total) % total; }); }} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', zIndex: 1 }}>{'‹'}</button>
          <button aria-label="Næste" onClick={function() { setCurrent(function(c: number) { return (c + 1) % total; }); }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', zIndex: 1 }}>{'›'}</button>
        </React.Fragment>
      )}
      {showD && total > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
          {children.map(function(_: PrimitiveNode, i: number) {
            return (
              <button key={i} aria-label={'Slide ' + (i + 1)} onClick={function() { setCurrent(i); }} style={{ width: '8px', height: '8px', borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: current === i ? primary : 'rgba(0,0,0,0.2)', padding: 0, transition: 'background-color 0.2s' }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function BehaviorExpandable({ node, staggerParent, defaultExpanded }: { node: PrimitiveNode; staggerParent?: any; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded === true);
  const cls = nodeClassName(node);
  const children = node.children || [];
  const trigger = children[0];
  const content = children.slice(1);
  const label = trigger ? extractBehaviorLabel(trigger, 'Vis mere') : 'Vis mere';
  return (
    <div className={cls}>
      <button
        aria-expanded={expanded}
        onClick={function() { setExpanded(function(e: boolean) { return !e; }); }}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '16px', padding: '0 0 12px 0', color: 'inherit' }}
      >
        {label}
        <span aria-hidden="true" style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>{'▾'}</span>
      </button>
      {expanded && (
        <div>
          {content.map(function(child: PrimitiveNode) { return <CustomNode key={child.id} node={child} staggerParent={staggerParent} />; })}
        </div>
      )}
    </div>
  );
}

function BehaviorToggle({ node, staggerParent, defaultOn }: { node: PrimitiveNode; staggerParent?: any; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn === true);
  const cls = nodeClassName(node);
  const children = node.children || [];
  const primary = (theme as any).primaryColor || '#4f46e5';
  return (
    <div className={cls}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          role="switch"
          aria-checked={on}
          onClick={function() { setOn(function(v: boolean) { return !v; }); }}
          style={{ position: 'relative', display: 'inline-flex', width: '44px', height: '24px', borderRadius: '12px', backgroundColor: on ? primary : 'rgba(0,0,0,0.15)', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', padding: 0 }}
        >
          <span style={{ position: 'absolute', top: '3px', left: on ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ffffff', transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </button>
        <span style={{ fontWeight: 600 }}>{on ? 'Til' : 'Fra'}</span>
      </div>
      {on && (
        <div>
          {children.map(function(child: PrimitiveNode) { return <CustomNode key={child.id} node={child} staggerParent={staggerParent} />; })}
        </div>
      )}
    </div>
  );
}

// Entrance motion per node, from the same shared model as sections: a box
// with 'stagger' hands its entrance to its children (one after another);
// a child with its OWN entrance opts out. Direct children animate as whole
// units — grandchildren ride along inside them, hidden and moved by their
// parent's opacity/transform. Inline motion styles exist only
// while the entrance plays — at 'done' they clear, so the per-node classes
// and :hover rules take over again.
function CustomNode({ node, staggerParent }: { node: PrimitiveNode; staggerParent?: any }) {
  const ownMotion: any = node.motion && typeof node.motion === 'object' ? node.motion : null;
  const hasOwnEntrance = !!(ownMotion && typeof ownMotion.effect === 'string' && ownMotion.effect !== 'none');
  const staggerStepMs =
    node.type === 'box' && ownMotion && typeof ownMotion.stagger === 'string'
      ? MOTION_TABLES.staggers[ownMotion.stagger] || 0
      : 0;
  const isStaggerBox = staggerStepMs > 0;
  const inheritedSpec = !hasOwnEntrance && staggerParent ? staggerChildSpec(staggerParent.spec, ownMotion) : null;
  const entranceSpec = isStaggerBox ? null : hasOwnEntrance ? ownMotion : inheritedSpec;
  const resolvedMotion = computeMotion(
    MOTION_TABLES,
    entranceSpec,
    inheritedSpec && staggerParent ? staggerParent.index : undefined
  );
  const m = useMotionPhase(resolvedMotion, '');
  const motionProps: any = m.active ? { ref: m.ref, 'data-motion': '', style: m.style } : {};
  const cls = nodeClassName(node);
  // Consume the products context so capability/product_grid nodes can render
  // live catalogue data from the host page's ComponentRenderer. Calling this
  // unconditionally satisfies the React hooks-at-top-level rule.
  const capabilityProducts = React.useContext(CapabilityProductsCtx);
  switch (node.type) {
    case 'box': {
      const behavior = node.behavior;
      if (behavior && typeof behavior.type === 'string') {
        switch (behavior.type) {
          case 'accordion':
            return <BehaviorAccordion node={node} staggerParent={staggerParent} multiple={behavior.multiple} defaultOpen={behavior.defaultOpen} />;
          case 'tabs':
            return <BehaviorTabs node={node} staggerParent={staggerParent} defaultTab={behavior.defaultTab} />;
          case 'carousel':
            return <BehaviorCarousel node={node} staggerParent={staggerParent} showArrows={behavior.showArrows} showDots={behavior.showDots} autoPlay={behavior.autoPlay} interval={behavior.interval} />;
          case 'expandable':
            return <BehaviorExpandable node={node} staggerParent={staggerParent} defaultExpanded={behavior.defaultExpanded} />;
          case 'toggle':
            return <BehaviorToggle node={node} staggerParent={staggerParent} defaultOn={behavior.defaultOn} />;
        }
      }
      return (
        <div className={cls} {...motionProps}>
          {(node.children || []).map((child, childIndex) => (
            <CustomNode
              key={child.id}
              node={child}
              staggerParent={isStaggerBox ? { spec: ownMotion, index: childIndex } : undefined}
            />
          ))}
        </div>
      );
    }
    case 'text': {
      const rawTag = node.tag || 'p';
      const Tag = (CUSTOM_TEXT_TAGS.indexOf(rawTag) >= 0 ? rawTag : 'p') as any;
      return <Tag className={cls} {...motionProps}>{node.text || ''}</Tag>;
    }
    case 'image': {
      const src = node.src ? safeCustomHref(node.src) : '';
      if (!src || src === '#') return null;
      return <img className={cls} {...motionProps} src={src} alt={node.alt || ''} />;
    }
    case 'button':
      return (
        <a className={cls} {...motionProps} href={safeCustomHref(node.href)}>
          {node.label || ''}
        </a>
      );
    case 'svg':
      if (!node.svg) return null;
      return <div className={cls} {...motionProps} dangerouslySetInnerHTML={{ __html: fitCustomSvg(node.svg) }} />;
    case 'capability': {
      // Trusted Birdflow widget embedded inside a custom component tree.
      // The capability type controls which section component renders; the
      // capabilityConfig passes whitelisted display hints only — no endpoints
      // or scripts. Birdflow owns 100% of the rendered implementation.
      const cap = node.capability;
      if (!cap) return null;
      const capProps: any = node.capabilityConfig || {};
      const capStyles: any = {};
      switch (cap) {
        case 'booking':
          return <div className={cls} {...motionProps}><BookingForm props={capProps} styles={capStyles} /></div>;
        case 'contact_form':
          return <div className={cls} {...motionProps}><ContactFormSection props={capProps} styles={capStyles} /></div>;
        case 'newsletter':
          return <div className={cls} {...motionProps}><NewsletterSection props={capProps} styles={capStyles} /></div>;
        case 'product_grid': {
          // Map capability config keys to the section's internal prop names.
          // capabilityConfig uses 'maxItems' (the AI/config-facing name);
          // ProductGridSection reads 'productLimit' from props.
          const gridProps: any = { ...capProps };
          if (typeof capProps.maxItems === 'number') {
            gridProps.productLimit = Math.max(1, Math.min(12, Math.floor(capProps.maxItems)));
            delete gridProps.maxItems;
          }
          return <div className={cls} {...motionProps}><ProductGridSection props={gridProps} styles={capStyles} products={capabilityProducts} /></div>;
        }
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

function CustomComponentSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const tree = props.customTree as PrimitiveNode | undefined;
  if (!tree) return null;

  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  const hover: string[] = [];
  collectCustomCss(tree, base, tablet, mobile, hover);

  let css = base.join('\\n');
  if (tablet.length) css += '\\n@media (max-width: ${BREAKPOINTS.tablet}px){' + tablet.join('') + '}';
  if (mobile.length) css += '\\n@media (max-width: ${BREAKPOINTS.mobile}px){' + mobile.join('') + '}';
  if (hover.length) css += '\\n' + hover.join('');

  return (
    <section style={{ backgroundColor: (styles.backgroundColor as string) || 'transparent', padding: (styles.padding as string) || '0px' }}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <CustomNode node={tree} />
    </section>
  );
}

export default function ComponentRenderer({
  component: _component,
  products = [],
  pages = [],
  // No default: undefined means "no stored menu", [] means "empty on purpose".
  navItems,
  allComponents = [],
}: {
  component: ComponentData;
  products?: any[];
  pages?: BuilderPage[];
  /** The site navigation, resolved by the publisher and baked into the page. */
  navItems?: NavItem[];
  /** Every component on the page, so containers can find their children. */
  allComponents?: ComponentData[];
}) {
  const responsiveOverrides = useResponsiveOverrides(_component.styles.responsive);
  const component = Object.keys(responsiveOverrides).length > 0
    ? { ..._component, styles: { ..._component.styles, ...responsiveOverrides } }
    : _component;
  const renderComponent = () => {
    switch (component.type) {
      case 'hero':
        return <HeroSection props={component.props} styles={component.styles} />;
      case 'image-slider':
        return <ImageSliderSection props={component.props} styles={component.styles} />;
      case 'text-image':
        return <TextImageSection props={component.props} styles={component.styles} />;
      case 'cta':
        return <CTASection props={component.props} styles={component.styles} />;
      case 'features':
        return <FeaturesSection props={component.props} styles={component.styles} />;
      case 'testimonials':
        return <TestimonialsSection props={component.props} styles={component.styles} />;
      case 'header':
        return <HeaderSection props={component.props} styles={component.styles} pages={pages} navItems={navItems} />;
      case 'footer':
        return <FooterSection props={component.props} styles={component.styles} />;
      case 'product-grid':
        return <ProductGridSection props={component.props} styles={component.styles} products={products} />;
      case 'gallery':
        return <GallerySection props={component.props} styles={component.styles} />;
      case 'pricing-table':
        return <PricingTableSection props={component.props} styles={component.styles} />;
      case 'faq':
        return <FAQSection props={component.props} styles={component.styles} />;
      case 'stats-counter':
        return <StatsCounterSection props={component.props} styles={component.styles} />;
      case 'video-embed':
        return <VideoEmbedSection props={component.props} styles={component.styles} />;
      case 'divider':
        return <DividerSection props={component.props} styles={component.styles} />;
      case 'spacer':
        return <SpacerSection props={component.props} styles={component.styles} />;
      case 'newsletter':
        return <NewsletterSection props={component.props} styles={component.styles} />;
      case 'before-after':
        return <BeforeAfterSection props={component.props} styles={component.styles} />;
      case 'services':
        return <ServicesSection props={component.props} styles={component.styles} />;
      case 'timeline':
        return <TimelineSection props={component.props} styles={component.styles} />;
      case 'team':
        return <TeamSection props={component.props} styles={component.styles} />;
      case 'split-section':
        return <SplitSectionComponent props={component.props} styles={component.styles} />;
      case 'comparison-table':
        return <ComparisonTableSection props={component.props} styles={component.styles} />;
      case 'tabs':
        return <TabsSection props={component.props} styles={component.styles} />;
      case 'marquee':
        return <MarqueeSection props={component.props} styles={component.styles} />;
      case 'contact-form':
        return <ContactFormSection props={component.props} styles={component.styles} />;
      case 'logo-cloud':
        return <LogoCloudSection props={component.props} styles={component.styles} />;
      case 'rich-text':
        return <RichTextSection props={component.props} styles={component.styles} />;
      case 'container':
        return (
          <ContainerSection
            props={component.props}
            styles={component.styles}
            allComponents={allComponents}
            products={products}
            pages={pages}
            navItems={navItems}
          />
        );
      case 'custom':
        // Provide the page's product catalogue to any embedded product_grid
        // capability nodes. Context is scoped to each custom section render.
        return (
          <CapabilityProductsCtx.Provider value={products}>
            <CustomComponentSection props={component.props} styles={component.styles} />
          </CapabilityProductsCtx.Provider>
        );
      case 'booking':
      case 'booking-form':
        // Single booking implementation: the same BookingForm used for
        // top-level booking sections also renders nested booking components.
        return <BookingForm props={component.props} styles={component.styles} />;
      default:
        return null;
    }
  };

  const componentElement = renderComponent();
  if (!componentElement) return null;

  const isParallax = !!(component.styles.motion && (component.styles.motion as any).effect === 'parallax');
  const parallaxSpeed = isParallax ? (Number((component.styles.motion as any).scrollSpeed) || 0.3) : 0;
  const animated = (
    <AnimatedWrapper styles={component.styles}>
      {componentElement}
    </AnimatedWrapper>
  );
  if (isParallax) {
    return <ParallaxWrapper speed={parallaxSpeed}>{animated}</ParallaxWrapper>;
  }
  return animated;
}
`;
}

export function generateContactForm(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `'use client';

import React, { useState } from 'react';

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    description?: string;
  };
};

export default function ContactForm({ styles, props }: Props) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      const res = await fetch('/api/form-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'contact',
          data: form,
        }),
      });
      
      if (!res.ok) {
        setStatus('error');
      } else {
        setStatus('success');
        setForm({ name: '', email: '', message: '' });
      }
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '0' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>{props.title || ${lit(t.contactTitle)}}</h2>
        {props.description && <p style={{ textAlign: 'center', marginBottom: '32px', opacity: 0.8 }}>{props.description}</p>}
        
        {status === 'success' ? (
          <p style={{ textAlign: 'center', color: '#22c55e' }}>${jsx(t.contactThanks)}</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder={${lit(t.contactName)}}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <input
              type="email"
              placeholder={${lit(t.contactEmail)}}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <textarea
              placeholder={${lit(t.contactMessage)}}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={5}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px', resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{ padding: '14px 24px', backgroundColor: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
            >
              {status === 'loading' ? ${lit(t.contactSending)} : ${lit(t.contactSend)}}
            </button>
            {status === 'error' && <p style={{ color: '#ef4444', textAlign: 'center' }}>${jsx(t.contactError)}</p>}
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateBookingForm(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  const locale = SITE_LOCALE[lang];
  return `'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWebsite } from '@/components/WebsiteProvider';

type BookingService = {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: string;
  currency: string;
};

type AvailabilityData = {
  availableDates: string[];
  blockedDates: { date: string; reason?: string }[];
  dateRange: { startDate: string; endDate: string | null } | null;
  weeklySchedule: { dayOfWeek: number; startTime: string; endTime: string }[];
};

type TimeSlot = {
  time: string;
  available: boolean;
  openSlotId?: string;
  teamMemberId?: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  role?: string | null;
  color?: string | null;
  serviceIds?: string[];
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    subtitle?: string;
    buttonText?: string;
  };
};

type StepId = 'service' | 'person' | 'datetime' | 'details';

export default function BookingForm({ styles, props }: Props) {
  const { websiteId } = useWebsite();
  const [step, setStep] = useState<StepId>('service');
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Team members (optional - step is skipped entirely when there are none)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  
  // Calendar and availability state
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const accentColor = '#6366f1';

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch('/api/booking-services');
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (err) {
        console.error('Failed to fetch services:', err);
      }
    };
    fetchServices();
  }, []);

  // Fetch bookable team members (optional feature)
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const res = await fetch('/api/team-members');
        if (res.ok) {
          const data = await res.json();
          setTeamMembers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch team members:', err);
      }
    };
    fetchTeamMembers();
  }, []);

  // Fetch availability when service is selected or month changes
  useEffect(() => {
    if (!selectedService || !websiteId) return;
    
    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      try {
        const month = calendarMonth.getMonth() + 1;
        const year = calendarMonth.getFullYear();
        const res = await fetch(\`/api/availability?serviceId=\${selectedService}&month=\${month}&year=\${year}\`);
        if (res.ok) {
          const data = await res.json();
          setAvailability(data);
        }
      } catch (err) {
        console.error('Failed to fetch availability:', err);
      }
      setLoadingAvailability(false);
    };
    fetchAvailability();
  }, [selectedService, calendarMonth, websiteId]);

  const refreshSlots = async (keepSelectedTime = false) => {
    if (!selectedService || !selectedDate) return;
    setLoadingSlots(true);
    if (!keepSelectedTime) setSelectedTime('');
    try {
      const memberQuery = selectedMember ? \`&teamMemberId=\${encodeURIComponent(selectedMember)}\` : '';
      const res = await fetch(\`/api/slots?serviceId=\${selectedService}&date=\${selectedDate}\${memberQuery}\`);
      if (res.ok) {
        const data = await res.json();
        setTimeSlots(Array.isArray(data) ? data : []);
      } else {
        setTimeSlots([]);
      }
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      setTimeSlots([]);
    }
    setLoadingSlots(false);
  };

  // Fetch time slots when date (or person) is selected
  useEffect(() => {
    if (!selectedService || !selectedDate || !websiteId) return;
    
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedTime('');
      try {
        const memberQuery = selectedMember ? \`&teamMemberId=\${encodeURIComponent(selectedMember)}\` : '';
        const res = await fetch(\`/api/slots?serviceId=\${selectedService}&date=\${selectedDate}\${memberQuery}\`);
        if (res.ok) {
          const data = await res.json();
          setTimeSlots(Array.isArray(data) ? data : []);
        } else {
          setTimeSlots([]);
        }
      } catch (err) {
        console.error('Failed to fetch slots:', err);
        setTimeSlots([]);
      }
      setLoadingSlots(false);
    };
    fetchSlots();
  }, [selectedService, selectedDate, selectedMember, websiteId]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const days: { date: Date; dateStr: string; isCurrentMonth: boolean; isPast: boolean; isBlocked: boolean; isAvailable: boolean; blockReason?: string }[] = [];
    
    // Add padding days from previous month
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        dateStr: d.toISOString().split('T')[0],
        isCurrentMonth: false,
        isPast: true,
        isBlocked: false,
        isAvailable: false,
      });
    }
    
    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const dateStr = \`\${year}-\${String(month + 1).padStart(2, '0')}-\${String(i).padStart(2, '0')}\`;
      const isPast = d < today;
      const blockedRecord = availability?.blockedDates.find(b => b.date === dateStr);
      const isBlocked = !!blockedRecord;
      const isAvailable = !isPast && !isBlocked && (availability?.availableDates.includes(dateStr) ?? false);
      
      days.push({
        date: d,
        dateStr,
        isCurrentMonth: true,
        isPast,
        isBlocked,
        isAvailable,
        blockReason: blockedRecord?.reason,
      });
    }
    
    return days;
  }, [calendarMonth, availability]);

  const handleSelectService = (serviceId: string) => {
    setSelectedService(serviceId);
    setSelectedDate('');
    setSelectedTime('');
    setSelectedMember('');
    setTimeSlots([]);
    setAvailability(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setErrorMessage(${lit(t.bookingErrorRequired)});
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMessage('');
    const service = services.find(s => s.id === selectedService);
    const chosenSlot = timeSlots.find(s => s.time === selectedTime);
    const bookingDateTime = new Date(selectedDate + 'T' + selectedTime + ':00').toISOString();
    
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name,
          customerEmail: email,
          customerPhone: phone || null,
          serviceId: selectedService,
          service: service?.name || 'Service',
          date: bookingDateTime,
          time: selectedTime,
          notes: notes || null,
          team_member_id: selectedMember || chosenSlot?.teamMemberId || null,
          open_slot_id: chosenSlot?.openSlotId || null,
        }),
      });
      
      if (!res.ok) {
        let payload: any = null;
        try {
          payload = await res.json();
        } catch (parseErr) {
          payload = null;
        }
        if (res.status === 409 && payload?.code === 'MEMBER_CONFLICT') {
          setErrorMessage(${lit(t.bookingErrorMemberConflict)});
          setSelectedTime('');
          setStep('datetime');
          await refreshSlots();
        } else if (res.status === 409) {
          setErrorMessage(${lit(t.bookingErrorSlotTaken)});
          setSelectedTime('');
          setStep('datetime');
          await refreshSlots();
        } else {
          setErrorMessage(${lit(t.bookingErrorRequired)});
        }
        setStatus('error');
      } else {
        const data = await res.json();
        setStatus('success');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('analytics:booking_submit', { 
            detail: { serviceId: selectedService, serviceName: service?.name } 
          }));
          if (data.id) {
            window.dispatchEvent(new CustomEvent('analytics:booking_created', { 
              detail: { bookingId: data.id, serviceId: selectedService, serviceName: service?.name } 
            }));
          }
        }
      }
    } catch (err) {
      setErrorMessage(${lit(t.bookingErrorGeneric)});
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStep('service');
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setSelectedMember('');
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setStatus('idle');
    setErrorMessage('');
    setAvailability(null);
    setTimeSlots([]);
  };

  const navigateMonth = (direction: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  // Members that can perform the chosen service (empty serviceIds = performs all services)
  const availableMembers = useMemo(() => {
    if (!selectedService) return teamMembers;
    return teamMembers.filter(m => !m.serviceIds || m.serviceIds.length === 0 || m.serviceIds.includes(selectedService));
  }, [teamMembers, selectedService]);
  const showPersonStep = teamMembers.length > 0;
  const stepOrder: StepId[] = showPersonStep
    ? ['service', 'person', 'datetime', 'details']
    : ['service', 'datetime', 'details'];
  const currentStepIndex = Math.max(0, stepOrder.indexOf(step));
  const goToStep = (offset: number) => {
    const next = stepOrder[currentStepIndex + offset];
    if (next) setStep(next);
  };
  const selectedMemberData = teamMembers.find(m => m.id === selectedMember);
  const canProceedStep1 = selectedService !== '';
  const canProceedStep2 = selectedDate !== '' && selectedTime !== '';
  const bgColor = styles.backgroundColor || '#f8fafc';
  const textColor = styles.textColor || '#1e293b';
  const monthNames = ${JSON.stringify(CALENDAR_MONTHS[lang])};
  const dayNames = ${JSON.stringify(CALENDAR_WEEKDAYS[lang])};
  const availableSlots = timeSlots.filter(s => s.available);

  return (
    <section style={{ backgroundColor: bgColor, color: textColor, padding: styles.padding || '0' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '8px 16px', borderRadius: '20px', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>${jsx(t.bookingBadge)}</span>
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>{props.title || ${lit(t.bookingTitle)}}</h2>
          {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7 }}>{props.subtitle}</p>}
        </div>

        {status !== 'success' && services.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {stepOrder.map((s, idx) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', backgroundColor: currentStepIndex >= idx ? accentColor : '#e2e8f0', color: currentStepIndex >= idx ? '#fff' : '#94a3b8', transition: 'all 0.2s' }}>{idx + 1}</div>
                {idx < stepOrder.length - 1 && <div style={{ width: '40px', height: '2px', backgroundColor: currentStepIndex > idx ? accentColor : '#e2e8f0', transition: 'all 0.2s' }} />}
              </div>
            ))}
          </div>
        )}

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: '16px', border: '1px solid #a7f3d0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 style={{ color: '#065f46', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>${jsx(t.bookingConfirmed)}</h3>
            <p style={{ color: '#047857', marginBottom: '24px' }}>${jsx(t.bookingConfirmedBody)} {email}</p>
            <button onClick={resetForm} data-testid="button-book-another" style={{ backgroundColor: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>${jsx(t.bookingAnother)}</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fefce8', borderRadius: '12px', border: '1px solid #fde047' }}>
                <p style={{ color: '#854d0e', fontWeight: 500 }}>${jsx(t.bookingNoServices)}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {step === 'service' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>${jsx(t.bookingChooseService)}</p>
                    {services.map((service) => (
                      <div key={service.id} data-testid={'option-service-' + service.id} onClick={() => handleSelectService(service.id)} style={{ padding: '20px', borderRadius: '12px', border: selectedService === service.id ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedService === service.id ? '#f0f4ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>{service.name}</p>
                            {service.description && <p style={{ fontSize: '14px', opacity: 0.6, marginBottom: '8px' }}>{service.description}</p>}
                            <span style={{ fontSize: '13px', opacity: 0.7 }}>{service.duration_minutes} min</span>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 700, color: accentColor, backgroundColor: '#f0f4ff', padding: '8px 12px', borderRadius: '8px' }}>{formatCurrency(parseFloat(String(service.price || '0')), service.currency)}</div>
                        </div>
                      </div>
                    ))}
                    <button type="button" data-testid="button-continue-service" onClick={() => canProceedStep1 && goToStep(1)} disabled={!canProceedStep1} style={{ marginTop: '16px', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0', color: canProceedStep1 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep1 ? 'pointer' : 'default' }}>${jsx(t.bookingContinue)}</button>
                  </div>
                )}

                {step === 'person' && showPersonStep && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>${jsx(t.bookingChoosePerson)}</p>
                    <button
                      type="button"
                      data-testid="button-select-anyone"
                      onClick={() => setSelectedMember('')}
                      style={{ textAlign: 'left', padding: '16px 20px', borderRadius: '12px', border: selectedMember === '' ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedMember === '' ? '#f0f4ff' : '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '15px', color: textColor }}
                    >
                      ${jsx(t.bookingAnyone)}
                    </button>
                    {availableMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        data-testid={'button-select-member-' + member.id}
                        onClick={() => setSelectedMember(member.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', padding: '16px 20px', borderRadius: '12px', border: selectedMember === member.id ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedMember === member.id ? '#f0f4ff' : '#fff', cursor: 'pointer', color: textColor }}
                      >
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: member.color || accentColor, flexShrink: 0 }}></span>
                        <span>
                          <span style={{ display: 'block', fontWeight: 600, fontSize: '15px' }}>{member.name}</span>
                          {member.role && <span style={{ display: 'block', fontSize: '13px', opacity: 0.6 }}>{member.role}</span>}
                        </span>
                      </button>
                    ))}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" data-testid="button-back-person" onClick={() => goToStep(-1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>${jsx(t.bookingBack)}</button>
                      <button type="button" data-testid="button-continue-person" onClick={() => goToStep(1)} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: accentColor, color: '#fff', border: 'none', cursor: 'pointer' }}>${jsx(t.bookingContinue)}</button>
                    </div>
                  </div>
                )}

                {step === 'datetime' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>${jsx(t.bookingChooseDateTime)}</p>
                    
                    {/* Calendar */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <button type="button" onClick={() => navigateMonth(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '8px' }}>&lt;</button>
                        <span style={{ fontWeight: 600, fontSize: '16px' }}>{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</span>
                        <button type="button" onClick={() => navigateMonth(1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '8px' }}>&gt;</button>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {dayNames.map(d => (
                          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 500, opacity: 0.6, padding: '4px' }}>{d}</div>
                        ))}
                      </div>
                      
                      {loadingAvailability ? (
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>${jsx(t.bookingLoadingAvailability)}</div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                          {calendarDays.map((day, idx) => {
                            const isSelected = day.dateStr === selectedDate;
                            const canSelect = day.isCurrentMonth && day.isAvailable;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => canSelect && setSelectedDate(day.dateStr)}
                                disabled={!canSelect}
                                title={day.isBlocked ? (day.blockReason || ${lit(t.bookingUnavailable)}) : undefined}
                                style={{
                                  padding: '10px 4px',
                                  borderRadius: '8px',
                                  border: isSelected ? \`2px solid \${accentColor}\` : '1px solid transparent',
                                  backgroundColor: isSelected ? '#f0f4ff' : day.isBlocked ? '#fef2f2' : canSelect ? '#fff' : 'transparent',
                                  color: isSelected ? accentColor : !day.isCurrentMonth ? '#d1d5db' : day.isBlocked ? '#ef4444' : day.isPast ? '#9ca3af' : canSelect ? textColor : '#9ca3af',
                                  fontWeight: isSelected ? 600 : 400,
                                  cursor: canSelect ? 'pointer' : 'default',
                                  opacity: !day.isCurrentMonth ? 0.3 : 1,
                                  fontSize: '14px',
                                  textDecoration: day.isBlocked ? 'line-through' : 'none',
                                }}
                              >
                                {day.date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      
                      {availability && (
                        <div style={{ marginTop: '12px', display: 'flex', gap: '16px', justifyContent: 'center', fontSize: '12px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#f0f4ff', border: \`1px solid \${accentColor}\` }}></span>
                            ${jsx(t.bookingLegendAvailable)}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#fef2f2' }}></span>
                            ${jsx(t.bookingLegendBlocked)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Time Slots */}
                    {selectedDate && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>
                          ${jsx(t.bookingAvailableTimesFor)} {new Date(selectedDate + 'T00:00:00').toLocaleDateString(${lit(locale)}, { weekday: 'long', month: 'short', day: 'numeric' })}
                        </label>
                        {loadingSlots ? (
                          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>${jsx(t.bookingLoadingTimes)}</div>
                        ) : availableSlots.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fefce8', borderRadius: '8px', border: '1px solid #fde047' }}>
                            <p style={{ color: '#854d0e', fontSize: '14px' }}>${jsx(t.bookingNoTimes)}</p>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {availableSlots.map((slot) => (
                              <button key={slot.time} type="button" data-testid={'button-slot-' + slot.time} onClick={() => setSelectedTime(slot.time)} style={{ padding: '12px', borderRadius: '8px', border: selectedTime === slot.time ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedTime === slot.time ? '#f0f4ff' : '#fff', color: selectedTime === slot.time ? accentColor : textColor, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' }}>
                                {slot.time}
                                {slot.openSlotId && <span style={{ display: 'block', fontSize: '11px', opacity: 0.6, fontWeight: 400 }}>${jsx(t.bookingOpenSlot)}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {errorMessage && status === 'error' && (
                      <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>{errorMessage}</div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" data-testid="button-back-datetime" onClick={() => goToStep(-1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>${jsx(t.bookingBack)}</button>
                      <button type="button" data-testid="button-continue-datetime" onClick={() => canProceedStep2 && goToStep(1)} disabled={!canProceedStep2} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0', color: canProceedStep2 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep2 ? 'pointer' : 'default' }}>${jsx(t.bookingContinue)}</button>
                    </div>
                  </div>
                )}

                {step === 'details' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>${jsx(t.bookingYourDetails)}</p>
                    {selectedServiceData && (
                      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ opacity: 0.7 }}>${jsx(t.bookingService)}</span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                          <span style={{ opacity: 0.7 }}>Date & Time:</span>
                          <span style={{ fontWeight: 600 }}>{new Date(selectedDate + 'T00:00:00').toLocaleDateString(${lit(locale)}, { weekday: 'short', month: 'short', day: 'numeric' })} ${jsx(t.bookingAt)} {selectedTime}</span>
                        </div>
                        {selectedMemberData && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                            <span style={{ opacity: 0.7 }}>${jsx(t.bookingWith)}</span>
                            <span style={{ fontWeight: 600 }}>{selectedMemberData.name}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>${jsx(t.bookingFullName)}</label>
                      <input type="text" data-testid="input-customer-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={${lit(t.bookingNamePlaceholder)}} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>${jsx(t.bookingEmail)}</label>
                      <input type="email" data-testid="input-customer-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={${lit(t.bookingEmailPlaceholder)}} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>${jsx(t.bookingPhone)}</label>
                      <input type="tel" data-testid="input-customer-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={${lit(t.bookingPhonePlaceholder)}} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>${jsx(t.bookingNotes)}</label>
                      <textarea data-testid="input-booking-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={${lit(t.bookingNotesPlaceholder)}} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px', resize: 'none' }} />
                    </div>
                    {status === 'error' && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>{errorMessage || ${lit(t.bookingErrorRequired)}}</div>}
                    <p style={{ fontSize: '12px', opacity: 0.5, textAlign: 'center', margin: '4px 0 0' }}>
                      ${jsx(t.bookingDataNoticePre)}{' '}
                      <a href="/privacy" style={{ textDecoration: 'underline', color: 'inherit' }}>${jsx(t.legalPrivacy)}</a>.
                    </p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" data-testid="button-back-details" onClick={() => goToStep(-1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>${jsx(t.bookingBack)}</button>
                      <button type="submit" data-testid="button-confirm-booking" disabled={status === 'loading' || !name || !email} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: accentColor, color: '#fff', border: 'none', cursor: status === 'loading' || !name || !email ? 'default' : 'pointer', opacity: status === 'loading' || !name || !email ? 0.6 : 1 }}>{status === 'loading' ? ${lit(t.bookingSubmitting)} : (props.buttonText || ${lit(t.bookingSubmit)})}</button>
                    </div>
                  </div>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateProductGrid(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWebsite } from '@/components/WebsiteProvider';
import { useCart } from '@/components/CartProvider';

type ProductVariant = {
  id: string;
  name: string;
  options: Array<{ id: string; name: string; priceAdjustment: number }>;
};

type Product = {
  id: string;
  name: string;
  description?: string;
  price: string;
  currency?: string;
  image_url?: string;
  category?: string;
  variants?: ProductVariant[];
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

type Props = {
  styles: {
    backgroundColor?: string;
    textColor?: string;
    padding?: string;
  };
  props: {
    title?: string;
    description?: string;
    columns?: number;
    productLimit?: number;
  };
};

export default function ProductGrid({ styles, props }: Props) {
  const { websiteId, isLoading: websiteLoading } = useWebsite();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const columns = props.columns || 3;
  const limit = props.productLimit || 6;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setSuccessMessage(${lit(t.productPaymentSuccess)});
    }
  }, []);

  useEffect(() => {
    if (!websiteId || websiteLoading) return;
    
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('website_id', websiteId)
          .eq('status', 'active')
          .limit(limit);
        
        if (error) {
          console.error('Failed to fetch products:', error);
          setFetchError(true);
        } else if (data) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Products fetch error:', err);
        setFetchError(true);
      }
      setLoading(false);
    }
    fetchProducts();
  }, [websiteId, websiteLoading, limit]);

  const handleAddToCart = (product: Product) => {
    addItem({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url,
      category: product.category,
    });
  };

  return (
    <section style={{ backgroundColor: styles.backgroundColor, color: styles.textColor, padding: styles.padding || '0' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700 }}>{props.title || ${lit(t.productsTitle)}}</h2>
          {props.description && <p style={{ opacity: 0.7, marginTop: '8px' }}>{props.description}</p>}
        </div>

        {successMessage && (
          <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '8px', backgroundColor: '#dcfce7', color: '#166534', textAlign: 'center' }}>
            {successMessage}
          </div>
        )}
        
        <style>{\`
          .product-grid-responsive {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
          }
          @media (min-width: 480px) {
            .product-grid-responsive {
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
          }
          @media (min-width: 768px) {
            .product-grid-responsive {
              grid-template-columns: repeat(3, 1fr);
              gap: 20px;
            }
          }
          @media (min-width: 1024px) {
            .product-grid-responsive {
              grid-template-columns: repeat(4, 1fr);
              gap: 24px;
            }
          }
          .product-card {
            background: rgba(255,255,255,0.98);
            border-radius: 16px;
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.06);
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            text-decoration: none;
            color: inherit;
            display: block;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .product-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 32px rgba(0,0,0,0.12);
          }
          .product-image-wrapper {
            position: relative;
            width: 100%;
            padding-top: 100%;
            overflow: hidden;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          }
          @media (max-width: 479px) {
            .product-image-wrapper {
              padding-top: 85%;
            }
          }
          .product-image-wrapper img {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .product-image-placeholder {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          }
          .product-info {
            padding: 16px;
          }
          @media (max-width: 479px) {
            .product-info {
              padding: 20px;
            }
          }
          .product-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
            line-height: 1.3;
            color: #1a1a1a;
          }
          @media (max-width: 479px) {
            .product-title {
              font-size: 18px;
              margin-bottom: 6px;
            }
          }
          .product-category {
            font-size: 11px;
            opacity: 0.5;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
          }
          @media (max-width: 479px) {
            .product-category {
              font-size: 12px;
              margin-bottom: 10px;
            }
          }
          .product-price {
            font-size: 16px;
            font-weight: 700;
            color: #1a1a1a;
          }
          @media (max-width: 479px) {
            .product-price {
              font-size: 20px;
            }
          }
        \`}</style>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>${jsx(t.productsLoading)}</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>${jsx(t.productsError)}</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>${jsx(t.productsEmpty)}</div>
        ) : (
          <div className="product-grid-responsive">
            {products.map(product => (
              <a key={product.id} href={\`/product/\${product.id}\`} className="product-card">
                <div className="product-image-wrapper">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} />
                  ) : (
                    <div className="product-image-placeholder">📦</div>
                  )}
                </div>
                <div className="product-info">
                  <h3 className="product-title">{product.name}</h3>
                  {product.category && <p className="product-category">{product.category}</p>}
                  <p className="product-price">
                    {product.variants && product.variants.length > 0 ? ${lit(t.productsFrom)} : ''}{formatCurrency(parseFloat(product.price), product.currency)}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;
}

// Cookie consent banner for GDPR compliance
export function generateCookieBanner(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cookie_consent';

export type ConsentStatus = 'accepted' | 'rejected' | null;

export function getConsentStatus(): ConsentStatus {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === 'accepted' || stored === 'rejected') return stored;
    return null;
  } catch {
    return null;
  }
}

export function setConsentStatus(status: 'accepted' | 'rejected') {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_KEY, status);
    window.dispatchEvent(new CustomEvent('consent:change', { detail: status }));
  } catch {}
}

type CookieBannerProps = {
  bannerText?: string;
  privacyPolicyUrl?: string;
  acceptButtonText?: string;
  rejectButtonText?: string;
};

export default function CookieBanner({
  bannerText = ${lit(t.cookieText)},
  privacyPolicyUrl,
  acceptButtonText = ${lit(t.cookieAccept)},
  rejectButtonText = ${lit(t.cookieReject)}
}: CookieBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getConsentStatus();
    if (consent === null) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    setConsentStatus('accepted');
    setVisible(false);
  };

  const handleReject = () => {
    setConsentStatus('rejected');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1f2937',
      color: '#fff',
      padding: '16px 24px',
      zIndex: 9999,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      boxShadow: '0 -4px 12px rgba(0,0,0,0.15)'
    }}>
      <p style={{ flex: 1, minWidth: '200px', margin: 0, fontSize: '14px' }}>
        {bannerText}
        {privacyPolicyUrl && (
          <>
            {' '}
            <a 
              href={privacyPolicyUrl} 
              style={{ color: '#60a5fa', textDecoration: 'underline' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              ${jsx(t.cookiePrivacyPolicy)}
            </a>
          </>
        )}
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleReject}
          style={{
            padding: '8px 20px',
            backgroundColor: 'transparent',
            border: '1px solid #6b7280',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          {rejectButtonText}
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '8px 20px',
            backgroundColor: '#4f46e5',
            border: 'none',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500
          }}
        >
          {acceptButtonText}
        </button>
      </div>
    </div>
  );
}
`;
}

export function generateAnalyticsTracker(): string {
  return `'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { getConsentStatus, type ConsentStatus } from './CookieBanner';

const SESSION_KEY = 'saasify_session';
const SESSION_EXPIRY = 30 * 60 * 1000; // 30 minutes

// Initialize Supabase client for analytics
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// BirdFlow API endpoint. When configured, events are sent there so the server
// can classify the traffic source and resolve the visitor's country from the
// IP (only the ISO country code is stored - never the IP).
const BIRDFLOW_API_URL = (process.env.NEXT_PUBLIC_BIRDFLOW_API_URL || '').replace(/\\/+$/, '');

function getOrCreateSession(): string {
  if (typeof window === 'undefined') return '';
  
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      const { id, expires } = JSON.parse(stored);
      if (expires > Date.now()) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id, expires: Date.now() + SESSION_EXPIRY }));
        return id;
      }
    }
    
    const newId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: newId, expires: Date.now() + SESSION_EXPIRY }));
    return newId;
  } catch {
    return 'sess_' + Math.random().toString(36).substring(2);
  }
}

function getTrafficSource(): string {
  if (typeof window === 'undefined') return 'direct';
  
  const referrer = document.referrer;
  if (!referrer) return 'direct';
  
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    
    if (host.includes('google')) return 'google';
    if (host.includes('facebook') || host.includes('fb.com')) return 'facebook';
    if (host.includes('twitter') || host.includes('x.com')) return 'twitter';
    if (host.includes('linkedin')) return 'linkedin';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('youtube')) return 'youtube';
    if (host.includes('tiktok')) return 'tiktok';
    
    return 'referral';
  } catch {
    return 'referral';
  }
}

function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Sanitize event data - remove any PII
function sanitizeEventData(data?: Record<string, unknown>): Record<string, unknown> | null {
  if (!data) return null;
  const sanitized: Record<string, unknown> = {};
  const allowedKeys = ['path', 'productId', 'productName', 'quantity', 'price', 'currency', 'serviceId', 'serviceName', 'orderId', 'bookingId', 'total', 'utm_source', 'utm_medium', 'utm_campaign', 'durationSeconds'];
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

// Campaign parameters from the current URL, so paid/social/email campaigns
// are attributed correctly by the server-side classifier.
function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const params = new URLSearchParams(window.location.search);
    const utm: Record<string, string> = {};
    const keys = ['utm_source', 'utm_medium', 'utm_campaign'];
    for (let i = 0; i < keys.length; i++) {
      const value = params.get(keys[i]);
      if (value) utm[keys[i]] = value;
    }
    return utm;
  } catch {
    return {};
  }
}

export default function AnalyticsTracker({ websiteId }: { websiteId: string }) {
  const pathname = usePathname();
  const trackedPaths = useRef<Set<string>>(new Set());
  const [consent, setConsent] = useState<ConsentStatus>(null);
  
  // Check consent on mount and listen for changes
  useEffect(() => {
    setConsent(getConsentStatus());
    
    const handleConsentChange = (e: CustomEvent) => {
      setConsent(e.detail as ConsentStatus);
    };
    
    window.addEventListener('consent:change', handleConsentChange as EventListener);
    return () => {
      window.removeEventListener('consent:change', handleConsentChange as EventListener);
    };
  }, []);
  
  const track = useCallback(async (eventType: string, eventData?: Record<string, unknown>) => {
    // Only track if user has accepted cookies
    if (consent !== 'accepted') return;
    
    try {
      const sessionId = getOrCreateSession();
      if (!sessionId || !websiteId) return;
      
      const mergedData = sanitizeEventData({ ...(eventData || {}), ...getUtmParams() });
      
      if (BIRDFLOW_API_URL) {
        // Preferred path: the BirdFlow API classifies the traffic source from
        // the raw referrer and resolves the country server-side.
        await fetch(BIRDFLOW_API_URL + '/api/public/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            websiteId,
            sessionId,
            eventType,
            pageUrl: typeof window !== 'undefined' ? window.location.pathname : null,
            referrer: typeof document !== 'undefined' ? document.referrer : '',
            deviceType: getDeviceType(),
            eventData: mergedData,
          }),
          keepalive: true,
        });
        return;
      }
      
      // Fallback for sites published without an API URL: direct insert with
      // client-side source classification (no country available).
      if (!supabase) {
        console.warn('[Analytics] Supabase not configured');
        return;
      }
      
      const { error } = await supabase.from('analytics_events').insert({
        website_id: websiteId,
        session_id: sessionId,
        event_type: eventType,
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
        traffic_source: getTrafficSource(),
        device_type: getDeviceType(),
        event_data: mergedData,
      });
      
      if (error) {
        console.warn('[Analytics] Insert error:', error.message);
      }
    } catch (error) {
      // Silent fail for analytics
      console.warn('[Analytics] Track error:', error);
    }
  }, [websiteId, consent]);

  // Track page views on route change
  useEffect(() => {
    if (consent !== 'accepted') return;
    if (!pathname || trackedPaths.current.has(pathname)) return;
    trackedPaths.current.add(pathname);
    track('page_view', { path: pathname });
  }, [pathname, track, consent]);

  // Time on page ("besoegstid"): accumulate VISIBLE time per path and flush
  // it as a page_time beacon on route change and page hide. sendBeacon
  // survives tab closes; fetch keepalive is the fallback.
  const visibleSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef<number>(0);
  const currentPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (consent !== 'accepted') return;

    const flush = (path: string | null) => {
      let ms = accumulatedMsRef.current;
      if (visibleSinceRef.current !== null) {
        ms += performance.now() - visibleSinceRef.current;
        visibleSinceRef.current = document.visibilityState === 'visible' ? performance.now() : null;
      }
      accumulatedMsRef.current = 0;
      const seconds = Math.round(ms / 1000);
      if (!path || seconds < 1 || seconds > 3600) return;

      const sessionId = getOrCreateSession();
      if (!sessionId || !websiteId) return;
      const payload = JSON.stringify({
        websiteId: websiteId,
        sessionId: sessionId,
        eventType: 'page_time',
        pageUrl: path,
        deviceType: getDeviceType(),
        eventData: { path: path, durationSeconds: seconds },
      });

      if (BIRDFLOW_API_URL) {
        const url = BIRDFLOW_API_URL + '/api/public/analytics/track';
        let sent = false;
        if (navigator.sendBeacon) {
          // application/json triggers a CORS preflight for the beacon; the
          // platform's OPTIONS handler allows Content-Type, so it goes
          // through. If the browser refuses (returns false), fall back to
          // fetch keepalive below.
          sent = navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        }
        if (!sent) {
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } else if (supabase) {
        supabase.from('analytics_events').insert({
          website_id: websiteId,
          session_id: sessionId,
          event_type: 'page_time',
          page_url: path,
          device_type: getDeviceType(),
          event_data: { path: path, durationSeconds: seconds },
        }).then(() => {}, () => {});
      }
    };

    // Path changed: flush time spent on the previous path
    if (currentPathRef.current !== pathname) {
      flush(currentPathRef.current);
      currentPathRef.current = pathname;
      if (document.visibilityState === 'visible') {
        visibleSinceRef.current = performance.now();
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (visibleSinceRef.current !== null) {
          accumulatedMsRef.current += performance.now() - visibleSinceRef.current;
          visibleSinceRef.current = null;
        }
        flush(currentPathRef.current);
      } else {
        visibleSinceRef.current = performance.now();
      }
    };
    const onPageHide = () => {
      if (visibleSinceRef.current !== null) {
        accumulatedMsRef.current += performance.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
      flush(currentPathRef.current);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [pathname, consent, websiteId]);

  // Listen for custom analytics events
  useEffect(() => {
    const handleAddToCart = (e: CustomEvent) => {
      track('add_to_cart', e.detail);
    };
    
    const handleCheckoutStart = () => {
      track('checkout_start');
    };
    
    const handleCheckoutSuccess = (e: CustomEvent) => {
      track('checkout_success', e.detail);
    };
    
    const handleBookingSubmit = (e: CustomEvent) => {
      track('booking_submit', e.detail);
    };
    
    const handleOrderCreated = (e: CustomEvent) => {
      track('order_created', e.detail);
    };
    
    const handleBookingCreated = (e: CustomEvent) => {
      track('booking_created', e.detail);
    };
    
    window.addEventListener('analytics:add_to_cart', handleAddToCart as EventListener);
    window.addEventListener('analytics:checkout_start', handleCheckoutStart);
    window.addEventListener('analytics:checkout_success', handleCheckoutSuccess as EventListener);
    window.addEventListener('analytics:booking_submit', handleBookingSubmit as EventListener);
    window.addEventListener('analytics:order_created', handleOrderCreated as EventListener);
    window.addEventListener('analytics:booking_created', handleBookingCreated as EventListener);
    
    return () => {
      window.removeEventListener('analytics:add_to_cart', handleAddToCart as EventListener);
      window.removeEventListener('analytics:checkout_start', handleCheckoutStart);
      window.removeEventListener('analytics:checkout_success', handleCheckoutSuccess as EventListener);
      window.removeEventListener('analytics:booking_submit', handleBookingSubmit as EventListener);
      window.removeEventListener('analytics:order_created', handleOrderCreated as EventListener);
      window.removeEventListener('analytics:booking_created', handleBookingCreated as EventListener);
    };
  }, [track]);

  return null;
}
`;
}

/**
 * Structured data describing the business behind the site.
 *
 * A local practice lives or dies by whether a search engine can show its phone
 * number, address and opening hours. Only what the customer actually entered is
 * emitted - an empty field is left out rather than guessed at, which is the
 * same rule the copy rules in server/claimRules.ts enforce for AI-written text.
 *
 * Returns an empty string when there is nothing worth marking up.
 */
export function generateBusinessJsonLd(
  siteName: string,
  context: BusinessContext | undefined,
  description?: string
): string {
  const contact = context?.contact;
  const address = contact
    ? {
        ...(contact.streetAddress ? { streetAddress: contact.streetAddress } : {}),
        ...(contact.postalCode ? { postalCode: contact.postalCode } : {}),
        ...(contact.city ? { addressLocality: contact.city } : {}),
        ...(contact.country ? { addressCountry: contact.country } : {}),
      }
    : {};

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    // ProfessionalService is the closest fit for a practice or consultancy and
    // is itself a LocalBusiness, so it inherits the local-result treatment.
    '@type': 'ProfessionalService',
    name: context?.businessName?.trim() || siteName,
    ...(description?.trim() ? { description: description.trim() } : {}),
    ...(contact?.phone ? { telephone: contact.phone } : {}),
    ...(contact?.email ? { email: contact.email } : {}),
    ...(Object.keys(address).length ? { address: { '@type': 'PostalAddress', ...address } } : {}),
    ...(contact?.openingHours ? { openingHours: contact.openingHours } : {}),
    ...(contact?.cvr ? { vatID: contact.cvr } : {}),
    ...(context?.services?.length ? { makesOffer: context.services.map((name) => ({ '@type': 'Offer', name })) } : {}),
    ...(context?.location ? { areaServed: context.location } : {}),
  };

  // Name alone tells a search engine nothing it cannot read off the page.
  const substantive = Object.keys(data).filter((key) => !key.startsWith('@') && key !== 'name');
  if (substantive.length === 0) return '';

  return JSON.stringify(data);
}

export function generateRootLayout(
  siteName: string,
  websiteId: string,
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE,
  /** Site-wide fallback description; pages with their own SEO override it. */
  description?: string,
  /** What the customer told us about their business, for structured data. */
  businessContext?: BusinessContext
): string {
  const jsonLd = generateBusinessJsonLd(siteName, businessContext, description);
  return `import type { Metadata } from 'next';
import './globals.css';
import { WebsiteProvider } from '@/components/WebsiteProvider';
import { CartProvider } from '@/components/CartProvider';
import CartDrawer from '@/components/CartDrawer';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import CookieBanner from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: ${lit(siteName)},
  description: ${lit(description?.trim() || siteName)},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="${lang}">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="${googleFontsHref()}" rel="stylesheet" />${jsonLd ? `
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ${lit(jsonLd)} }}
        />` : ''}
      </head>
      <body>
        <WebsiteProvider>
          <CartProvider>
            <AnalyticsTracker websiteId={${lit(websiteId)}} />
            {children}
            <CartDrawer />
            <CookieBanner />
          </CartProvider>
        </WebsiteProvider>
      </body>
    </html>
  );
}
`;
}



/**
 * Where the published site lives, as the generated project can work it out.
 *
 * The generator has no domain to hand - a site's custom domain is attached
 * after the project is built - so the project resolves it at build time from
 * what Vercel sets, with an explicit override for anything else.
 */
const SITE_URL_HELPER = `function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\\/$/, '');
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? \`https://\${host}\` : '';
}`;

/**
 * app/sitemap.ts — every page a visitor can reach.
 *
 * Hidden pages are left out: they are hidden from the site's own navigation,
 * so listing them for search engines would defeat the point.
 */
export function generateSitemap(pages: NavPage[]): string {
  const listed = pages.filter((page) => !page.hidden).map((page) => page.path);
  return `import type { MetadataRoute } from 'next';

${SITE_URL_HELPER}

const PATHS = ${JSON.stringify(listed)};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const lastModified = new Date();
  return PATHS.map((path) => ({
    url: path === '/' ? base || '/' : \`\${base}\${path}\`,
    lastModified,
    // The front page is the entry point; everything else sits below it.
    priority: path === '/' ? 1 : 0.7,
  }));
}
`;
}

/** app/robots.ts — crawlable, with a pointer to the sitemap. */
export function generateRobots(): string {
  return `import type { MetadataRoute } from 'next';

${SITE_URL_HELPER}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: { userAgent: '*', allow: '/' },
    // Only worth stating when the absolute URL is actually known.
    ...(base ? { sitemap: \`\${base}/sitemap.xml\` } : {}),
  };
}
`;
}

/**
 * A fallback favicon: the site's initial on its primary colour.
 *
 * Used when the brand guide has no logo to shrink. An SVG icon needs no image
 * processing and every browser that matters renders it.
 */
export function generateMonogramIcon(siteName: string, primaryColor: string): string {
  // The site name is the customer's text and the colour is a stored value, so
  // neither is trusted to be XML-safe.
  const escapeXml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const initial = (siteName.trim()[0] || '?').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="12" fill="${escapeXml(primaryColor)}"/>
  <text x="32" y="44" font-family="system-ui, sans-serif" font-size="36" font-weight="700"
        text-anchor="middle" fill="#ffffff">${escapeXml(initial)}</text>
</svg>
`;
}

type NavPage = { id: string; name: string; path: string; hidden?: boolean };

/**
 * Decodes HTML entities in component data to prevent issues in generated JSX.
 * Handles common entities like &amp; &lt; &gt; &quot; &#39; etc.
 */
function decodeHtmlEntities(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&nbsp;/g, ' ');
  }
  if (Array.isArray(obj)) {
    return obj.map(decodeHtmlEntities);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = decodeHtmlEntities(value);
    }
    return result;
  }
  return obj;
}

/** What the published page tells search engines and social previews. */
export type PageMetadata = {
  title: string;
  description?: string;
};

export function generatePageFile(
  page: PageData,
  websiteId: string,
  allPages?: NavPage[],
  options?: {
    /**
     * The site navigation, already resolved from the stored navigation.
     * Resolved here rather than in the generated project for the same
     * reason design tokens are: a Next.js project cannot import `@shared`.
     */
    navItems?: Array<{ id: string; title: string; href: string }>;
    /** This page's own title and description. */
    metadata?: PageMetadata;
  }
): string {
  const componentsImport = `import type { Metadata } from 'next';
import ComponentRenderer from '@/components/ComponentRenderer';
import ContactForm from '@/components/ContactForm';
import BookingForm from '@/components/BookingForm';
import ProductGrid from '@/components/ProductGrid';`;

  // Decode HTML entities in component data before generating the page
  const cleanedComponents = decodeHtmlEntities(page.components);
  const componentsJson = JSON.stringify(cleanedComponents, null, 2);
  const pagesJson = JSON.stringify(
    (allPages || []).map(p => ({ id: p.id, name: p.name, path: p.path, hidden: p.hidden })),
    null,
    2
  );
  const navJson = JSON.stringify(options?.navItems ?? [], null, 2);

  // Every page carries its own title and description. Before this they all
  // inherited one site-wide pair, which is what made a six-page website look
  // like one page to a search engine.
  const meta = options?.metadata;
  const metadataBlock = meta
    ? `
export const metadata: Metadata = {
  title: ${lit(meta.title)},${meta.description ? `
  description: ${lit(meta.description)},` : ''}
  openGraph: {
    title: ${lit(meta.title)},${meta.description ? `
    description: ${lit(meta.description)},` : ''}
    type: 'website',
  },
};
`
    : '';

  return `${componentsImport}

// Local loose type so TypeScript accepts baked-in component JSON without
// importing from ComponentRenderer (which carries @ts-nocheck and has edge
// cases under Next.js isolatedModules). Props and styles are typed as
// Record<string,any> so any valid builder data is accepted.
type PageComponentData = { id: string; type: string; props: Record<string, any>; styles: Record<string, any> };
const pageComponents: PageComponentData[] = ${componentsJson};
const sitePages = ${pagesJson};
const siteNav = ${navJson};
${metadataBlock}
// Components sitting inside a container are drawn by that container, not by
// the page. Without this they appeared twice over: once loose at the top
// level and once (never, in fact) inside an empty container box.
const containedIds = new Set<string>(
  pageComponents.flatMap((component: any) =>
    component.type === 'container' ? ((component.props?.children as string[]) || []) : []
  )
);
const topLevelComponents = pageComponents.filter((component: any) => !containedIds.has(component.id));

export default function Page() {
  return (
    <main>
      {topLevelComponents.map((component: any) => {
        switch (component.type) {
          case 'contact-form':
            return <ContactForm key={component.id} props={component.props} styles={component.styles} />;
          case 'booking-form':
          case 'booking':
            return <BookingForm key={component.id} props={component.props} styles={component.styles} />;
          case 'product-grid':
            return <ProductGrid key={component.id} props={component.props} styles={component.styles} />;
          default:
            return (
              <ComponentRenderer
                key={component.id}
                component={component}
                pages={sitePages}
                navItems={siteNav}
                allComponents={pageComponents}
              />
            );
        }
      })}
    </main>
  );
}
`;
}

export function generateProductApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch.id;
    }
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function GET(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (productId) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('website_id', websiteId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return NextResponse.json({ message: 'Product not found' }, { status: 404 });
      }

      return NextResponse.json(data);
    }

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('website_id', websiteId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Products fetch error:', error);
      return NextResponse.json({ message: 'Failed to fetch products' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('Products error:', err);
    return NextResponse.json({ message: 'Failed to fetch products' }, { status: 500 });
  }
}
`;
}

/**
 * The "Product Page Design" settings a customer configures in the builder.
 *
 * That builder section is a design panel for the generated product pages,
 * not a section of the page it sits on. Its settings used to stop at the
 * builder: the published product pages ignored them entirely. They are
 * threaded through here so the choices the customer makes are the ones
 * visitors see.
 */
export type ProductPageDesign = {
  layout: 'side-by-side' | 'stacked' | 'gallery-focus';
  accentColor: string;
  buttonStyle: 'filled' | 'outline' | 'rounded';
  imageStyle: 'rounded' | 'square' | 'full-bleed';
  showRelated: boolean;
  showTrustBadges: boolean;
  showAccordion: boolean;
};

const PRODUCT_PAGE_DESIGN_DEFAULTS: ProductPageDesign = {
  layout: 'side-by-side',
  accentColor: '#7c3aed',
  buttonStyle: 'filled',
  imageStyle: 'rounded',
  showRelated: true,
  showTrustBadges: true,
  showAccordion: true,
};

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/** Read the design off a builder component's props, rejecting anything odd. */
export function resolveProductPageDesign(props?: Record<string, unknown>): ProductPageDesign {
  const d = { ...PRODUCT_PAGE_DESIGN_DEFAULTS };
  if (!props) return d;
  const layout = props.layout;
  if (layout === 'side-by-side' || layout === 'stacked' || layout === 'gallery-focus') d.layout = layout;
  const buttonStyle = props.buttonStyle;
  if (buttonStyle === 'filled' || buttonStyle === 'outline' || buttonStyle === 'rounded') d.buttonStyle = buttonStyle;
  const imageStyle = props.imageStyle;
  if (imageStyle === 'rounded' || imageStyle === 'square' || imageStyle === 'full-bleed') d.imageStyle = imageStyle;
  if (typeof props.accentColor === 'string' && HEX_COLOR.test(props.accentColor.trim())) {
    d.accentColor = props.accentColor.trim();
  }
  if (props.showRelated === false) d.showRelated = false;
  if (props.showTrustBadges === false) d.showTrustBadges = false;
  if (props.showAccordion === false) d.showAccordion = false;
  return d;
}

export function generateProductDetailPage(
  lang: SiteLanguage = DEFAULT_SITE_LANGUAGE,
  design: ProductPageDesign = PRODUCT_PAGE_DESIGN_DEFAULTS
): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  const accent = design.accentColor;
  const imageRadius = design.imageStyle === 'rounded' ? '16px' : '0';
  const layoutColumns =
    design.layout === 'stacked'
      ? '1fr'
      : design.layout === 'gallery-focus'
      ? 'minmax(300px, 760px) 1fr'
      : 'minmax(300px, 600px) 1fr';
  const buttonRadius = design.buttonStyle === 'rounded' ? '999px' : '12px';
  const buttonBackground = design.buttonStyle === 'outline' ? 'transparent' : accent;
  const buttonTextColor = design.buttonStyle === 'outline' ? accent : '#fff';
  const buttonBorder = design.buttonStyle === 'outline' ? '2px solid ' + accent : 'none';
  return `'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCart } from '@/components/CartProvider';

type ProductVariantOption = {
  id: string;
  name: string;
  priceAdjustment: number;
  stockQuantity?: number;
  sku?: string;
};

type ProductVariant = {
  id: string;
  name: string;
  options: ProductVariantOption[];
};

type Product = {
  id: string;
  name: string;
  description?: string;
  long_description?: string;
  product_details?: string;
  care_instructions?: string;
  size_guide?: string;
  shipping_info?: string;
  compare_at_price?: string;
  price: string;
  currency?: string;
  image_url?: string;
  images?: string[];
  category?: string;
  inventory?: string;
  variants?: ProductVariant[];
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

function ImageGallery({ images, productName }: { images: string[]; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const mainImageRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x, y });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isLightboxOpen) return;
    if (e.key === 'Escape') setIsLightboxOpen(false);
    if (e.key === 'ArrowLeft') setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
    if (e.key === 'ArrowRight') setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
  }, [isLightboxOpen, images.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isLightboxOpen]);

  if (images.length === 0) {
    return (
      <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', borderRadius: '${imageRadius}' }}>
        📦
      </div>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          ref={mainImageRef}
          onClick={() => setIsLightboxOpen(true)}
          onMouseEnter={() => setIsZoomed(true)}
          onMouseLeave={() => setIsZoomed(false)}
          onMouseMove={handleMouseMove}
          style={{
            backgroundColor: '#fff',
            borderRadius: '${imageRadius}',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            cursor: 'zoom-in',
            position: 'relative',
          }}
        >
          <img
            src={images[selectedIndex]}
            alt={productName + ' - Image ' + (selectedIndex + 1)}
            style={{
              width: '100%',
              aspectRatio: '1',
              objectFit: 'cover',
              transition: 'transform 0.2s ease-out',
              transform: isZoomed ? 'scale(1.5)' : 'scale(1)',
              transformOrigin: zoomPosition.x + '% ' + zoomPosition.y + '%',
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            opacity: isZoomed ? 0 : 1,
            transition: 'opacity 0.2s',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
              <path d="M11 8v6M8 11h6" />
            </svg>
            Click to expand
          </div>
        </div>

        {images.length > 1 && (
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '4px' }}>
            {images.map((img, index) => (
              <button
                key={index}
                onClick={() => setSelectedIndex(index)}
                style={{
                  width: '80px',
                  height: '80px',
                  flexShrink: 0,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: selectedIndex === index ? '3px solid #4f46e5' : '2px solid #e5e7eb',
                  padding: 0,
                  cursor: 'pointer',
                  background: 'none',
                  transition: 'all 0.2s',
                  opacity: selectedIndex === index ? 1 : 0.7,
                }}
              >
                <img
                  src={img}
                  alt={productName + ' - Thumbnail ' + (index + 1)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.95)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
            aria-label={${lit(t.productCloseViewer)}}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}
          >
            ✕
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => (prev > 0 ? prev - 1 : images.length - 1)); }}
                aria-label={${lit(t.productPreviousImage)}}
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedIndex(prev => (prev < images.length - 1 ? prev + 1 : 0)); }}
                aria-label={${lit(t.productNextImage)}}
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <img
            src={images[selectedIndex]}
            alt={productName + ' - Full size ' + (selectedIndex + 1)}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
            }}
            onClick={(e) => e.stopPropagation()}
          />

          {images.length > 1 && (
            <div style={{
              position: 'absolute',
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
            }}>
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function AccordionSection({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#6b7280' }}>{icon}</span>
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>{title}</span>
        </div>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        style={{
          maxHeight: isOpen ? '500px' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}
      >
        <div style={{ paddingBottom: '20px', fontSize: '15px', color: '#4b5563', lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function AccordionSections({ product }: { product: Product }) {
  const hasAnySection = product.long_description || product.product_details || product.shipping_info || product.care_instructions || product.size_guide;
  if (!hasAnySection) return null;
  
  return (
    <div style={{ marginTop: '60px', backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
      {(product.long_description || product.product_details) && (
        <AccordionSection
          title={${lit(t.productSectionDetails)}}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>}
          defaultOpen={true}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {product.product_details || product.long_description}
          </div>
        </AccordionSection>
      )}
      {product.shipping_info && (
        <AccordionSection
          title={${lit(t.productSectionShipping)}}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{product.shipping_info}</div>
        </AccordionSection>
      )}
      {product.care_instructions && (
        <AccordionSection
          title={${lit(t.productSectionCare)}}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{product.care_instructions}</div>
        </AccordionSection>
      )}
      {product.size_guide && (
        <AccordionSection
          title={${lit(t.productSectionSize)}}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 3H3v7h18V3zM21 14H3v7h18v-7z"/></svg>}
        >
          <div style={{ whiteSpace: 'pre-wrap' }}>{product.size_guide}</div>
        </AccordionSection>
      )}
    </div>
  );
}

function RelatedProducts({ currentProductId, currency = 'USD' }: { currentProductId: string; currency?: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const related = (data || []).filter((p: Product) => p.id !== currentProductId).slice(0, 8);
        setProducts(related);
      })
      .catch(() => setProducts([]));
  }, [currentProductId]);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      setCanScrollLeft(scrollRef.current.scrollLeft > 0);
      setCanScrollRight(scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [products, checkScroll]);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
      setTimeout(checkScroll, 350);
    }
  };

  if (products.length === 0) return null;

  return (
    <div style={{ marginTop: '80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>${jsx(t.productRelatedTitle)}</h2>
          <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>${jsx(t.productRelatedSubtitle)}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => scroll('left')} disabled={!canScrollLeft} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #e5e7eb', backgroundColor: canScrollLeft ? '#fff' : '#f9fafb', cursor: canScrollLeft ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canScrollLeft ? 1 : 0.4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scroll('right')} disabled={!canScrollRight} style={{ width: '44px', height: '44px', borderRadius: '50%', border: '1px solid #e5e7eb', backgroundColor: canScrollRight ? '#fff' : '#f9fafb', cursor: canScrollRight ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canScrollRight ? 1 : 0.4 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div ref={scrollRef} onScroll={checkScroll} style={{ display: 'flex', gap: '20px', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', paddingBottom: '8px' }}>
        {products.map(p => {
          const price = parseFloat(p.price);
          const comparePrice = p.compare_at_price ? parseFloat(p.compare_at_price) : null;
          const hasDiscount = comparePrice && comparePrice > price;
          return (
            <Link key={p.id} href={'/product/' + p.id} style={{ textDecoration: 'none', color: 'inherit', display: 'block', minWidth: '240px', maxWidth: '240px', backgroundColor: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', scrollSnapAlign: 'start', flexShrink: 0 }}>
              <div style={{ aspectRatio: '1', backgroundColor: '#f3f4f6', position: 'relative', overflow: 'hidden' }}>
                {p.image_url && <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                {hasDiscount && <div style={{ position: 'absolute', top: '12px', left: '12px', backgroundColor: '#dc2626', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 }}>${jsx(t.productSale)}</div>}
              </div>
              <div style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px', lineHeight: 1.4 }}>{p.name}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasDiscount && comparePrice && <span style={{ fontSize: '13px', color: '#9ca3af', textDecoration: 'line-through' }}>{formatCurrency(comparePrice, currency)}</span>}
                  <span style={{ fontSize: '15px', fontWeight: 700, color: hasDiscount ? '#dc2626' : '#111827' }}>{formatCurrency(price, currency)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = params?.id as string;
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!productId) {
      setError('Invalid product');
      setLoading(false);
      return;
    }

    fetch(\`/api/products?id=\${productId}\`)
      .then(res => {
        if (!res.ok) throw new Error('Product not found');
        return res.json();
      })
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [productId]);

  const getVariantPriceAdjustment = (): number => {
    if (!product?.variants) return 0;
    let adjustment = 0;
    for (const variant of product.variants) {
      const selectedOptionId = selectedVariants[variant.id];
      if (selectedOptionId) {
        const option = variant.options.find(o => o.id === selectedOptionId);
        if (option) {
          adjustment += option.priceAdjustment || 0;
        }
      }
    }
    return adjustment;
  };

  const getSelectedVariantNames = (): string => {
    if (!product?.variants) return '';
    const names: string[] = [];
    for (const variant of product.variants) {
      const selectedOptionId = selectedVariants[variant.id];
      if (selectedOptionId) {
        const option = variant.options.find(o => o.id === selectedOptionId);
        if (option) {
          names.push(variant.name + ': ' + option.name);
        }
      }
    }
    return names.join(', ');
  };

  const allVariantsSelected = (): boolean => {
    if (!product?.variants || product.variants.length === 0) return true;
    return product.variants.every(v => selectedVariants[v.id]);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!allVariantsSelected()) return;
    
    const priceAdjustment = getVariantPriceAdjustment();
    const finalPrice = (parseFloat(product.price) + priceAdjustment).toFixed(2);
    const variantInfo = getSelectedVariantNames();
    const hasVariants = Object.keys(selectedVariants).length > 0;
    
    addItem({
      id: product.id + (hasVariants ? '-' + Object.values(selectedVariants).join('-') : ''),
      baseProductId: product.id,
      name: product.name + (variantInfo ? ' (' + variantInfo + ')' : ''),
      description: product.description,
      price: finalPrice,
      currency: product.currency,
      image_url: product.image_url,
      category: product.category,
      selectedVariants: hasVariants ? { ...selectedVariants } : undefined,
      variantInfo: variantInfo || undefined,
    }, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getAllImages = (): string[] => {
    if (!product) return [];
    const mainImage = product.image_url;
    const additionalImages = product.images || [];
    if (mainImage) {
      return [mainImage, ...additionalImages.filter(img => img !== mainImage)];
    }
    return additionalImages;
  };

  const getStockStatus = () => {
    if (!product?.inventory) return null;
    const stock = parseInt(product.inventory);
    if (isNaN(stock)) return null;
    if (stock === 0) return { text: ${lit(t.productOutOfStock)}, color: '#ef4444' };
    if (stock <= 5) return { text: ${lit(t.productOnlyLeftPrefix)} + stock + ${lit(t.productOnlyLeftSuffix)}, color: '#f59e0b' };
    return { text: ${lit(t.productInStock)}, color: '#22c55e' };
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>${jsx(t.productLoading)}</p>
        </div>
        <style>{\`@keyframes spin { to { transform: rotate(360deg); } }\`}</style>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📦</div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>${jsx(t.productNotFound)}</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error || ${lit(t.productNotFoundBody)}}</p>
          <Link href="/" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            ${jsx(t.productBackHome)}
          </Link>
        </div>
      </div>
    );
  }

  const allImages = getAllImages();
  const stockStatus = getStockStatus();
  const isOutOfStock = stockStatus?.text === ${lit(t.productOutOfStock)};

  return (
    <div style={{ backgroundColor: '#f9fafb' }}>
      <style>{\`
        .product-page-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 24px;
        }
        .product-layout {
          display: grid;
          grid-template-columns: ${layoutColumns};
          gap: 64px;
          align-items: start;
        }
        .product-info {
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: sticky;
          top: 40px;
        }
        .product-title {
          font-size: 40px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          line-height: 1.2;
        }
        .product-price {
          font-size: 36px;
          font-weight: 700;
          color: ${accent};
          margin: 0;
        }
        .product-description {
          font-size: 16px;
          color: #6b7280;
          line-height: 1.6;
          margin: 0;
        }
        @media (max-width: 768px) {
          .product-page-container {
            padding: 20px 16px;
          }
          .product-layout {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .product-info {
            position: static;
            gap: 16px;
          }
          .product-title {
            font-size: 24px;
          }
          .product-price {
            font-size: 28px;
          }
          .product-description {
            font-size: 14px;
          }
          .back-link {
            margin-bottom: 16px !important;
          }
        }
      \`}</style>
      <div className="product-page-container">
        <Link href="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '${accent}', textDecoration: 'none', marginBottom: '32px', fontSize: '14px', fontWeight: 500 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          ${jsx(t.productBackToProducts)}
        </Link>

        <div className="product-layout">
          <ImageGallery images={allImages} productName={product.name} />

          <div className="product-info">
            {product.category && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '${accent}', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {product.category}
              </span>
            )}
            
            <h1 className="product-title">
              {product.name}
            </h1>

            {stockStatus && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: stockStatus.color }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: stockStatus.color }}>
                  {stockStatus.text}
                </span>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
              <p className="product-price">
                {formatCurrency(parseFloat(product.price) + getVariantPriceAdjustment(), product.currency)}
              </p>
              {getVariantPriceAdjustment() !== 0 && (
                <span style={{ fontSize: '18px', color: '#9ca3af', textDecoration: 'line-through' }}>
                  {formatCurrency(parseFloat(product.price), product.currency)}
                </span>
              )}
            </div>

            {product.description && (
              <p className="product-description">
                {product.description}
              </p>
            )}

            {product.variants && product.variants.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {product.variants.map(variant => (
                  <div key={variant.id}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                      {variant.name}
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {variant.options.map(option => {
                        const isSelected = selectedVariants[variant.id] === option.id;
                        return (
                          <button
                            key={option.id}
                            onClick={() => setSelectedVariants(prev => ({ ...prev, [variant.id]: option.id }))}
                            style={{
                              padding: '10px 16px',
                              border: isSelected ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                              borderRadius: '8px',
                              backgroundColor: isSelected ? '#eef2ff' : '#fff',
                              color: isSelected ? '#4f46e5' : '#374151',
                              fontWeight: isSelected ? 600 : 400,
                              cursor: 'pointer',
                              fontSize: '14px',
                              transition: 'all 0.2s',
                            }}
                          >
                            {option.name}
                            {option.priceAdjustment !== 0 && (
                              <span style={{ marginLeft: '4px', fontSize: '12px', color: option.priceAdjustment > 0 ? '#059669' : '#dc2626' }}>
                                {option.priceAdjustment > 0 ? '+' : ''}{formatCurrency(option.priceAdjustment, product.currency)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                >
                  −
                </button>
                <span style={{ width: '48px', textAlign: 'center', fontSize: '16px', fontWeight: 500 }}>
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  disabled={isOutOfStock}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: 'none',
                    backgroundColor: '#f9fafb',
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                    fontSize: '20px',
                    color: '#374151',
                  }}
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock || !allVariantsSelected()}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '14px 32px',
                  backgroundColor: isOutOfStock || !allVariantsSelected() ? '#d1d5db' : addedToCart ? '#22c55e' : '${buttonBackground}',
                  color: isOutOfStock || !allVariantsSelected() || addedToCart ? '#fff' : '${buttonTextColor}',
                  border: '${buttonBorder}',
                  borderRadius: '${buttonRadius}',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: isOutOfStock || !allVariantsSelected() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {!allVariantsSelected() ? ${lit(t.productSelectOptions)} : isOutOfStock ? ${lit(t.productOutOfStock)} : addedToCart ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10L8.5 13.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    ${jsx(t.productAdded)}
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 3H5L5.4 5M7 13H15L17 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.1 15.9 4.5 17 5.3 17H15M15 17C14.2 17 13.5 17.7 13.5 18.5S14.2 20 15 20 16.5 19.3 16.5 18.5 15.8 17 15 17ZM7 17C6.2 17 5.5 17.7 5.5 18.5S6.2 20 7 20 8.5 19.3 8.5 18.5 7.8 17 7 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    ${jsx(t.productAddToCart)}
                  </>
                )}
              </button>
            </div>

${design.showTrustBadges ? `            <div style={{ display: 'flex', gap: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                ${jsx(t.productFreeShipping)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                ${jsx(t.productSecureCheckout)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                ${jsx(t.productEasyReturns)}
              </div>
            </div>` : ''}
          </div>
        </div>

        ${design.showAccordion ? '<AccordionSections product={product} />' : ''}

        <div style={{ marginTop: '60px', backgroundColor: '#f8fafc', borderRadius: '20px', padding: '48px', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.02em' }}>${jsx(t.productWhyTitle)}</h2>
            <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '500px', margin: '0 auto' }}>${jsx(t.productWhySubtitle)}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>${jsx(t.productWhyQuality)}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>${jsx(t.productWhyQualityBody)}</p>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>${jsx(t.productWhyReturns)}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>${jsx(t.productWhyReturnsBody)}</p>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>${jsx(t.productWhyDelivery)}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>${jsx(t.productWhyDeliveryBody)}</p>
            </div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '28px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2"><path d="M12 2a10 10 0 00-10 10 10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z"/><path d="M12 6v6l4 2"/></svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>${jsx(t.productWhySupport)}</h3>
              <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>${jsx(t.productWhySupportBody)}</p>
            </div>
          </div>
        </div>

        ${design.showRelated ? '<RelatedProducts currentProductId={product.id} currency={product.currency} />' : ''}
      </div>
    </div>
  );
}
`;
}

export function generateCheckoutPage(lang: SiteLanguage = DEFAULT_SITE_LANGUAGE): string {
  const t = PUBLISHED_SITE_STRINGS[lang];
  return `'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '@/components/CartProvider';
import { useWebsite } from '@/components/WebsiteProvider';

type ShippingMethod = {
  id: string;
  name: string;
  description?: string;
  priceAmount: number;
  currency: string;
  deliveryTime?: string;
  isActive: boolean;
};

function formatCurrency(amount: number, currency: string = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', DKK: 'kr' };
  const symbol = symbols[currency] || currency;
  const formatted = currency === 'DKK' ? amount.toFixed(0) : amount.toFixed(2);
  return currency === 'DKK' ? formatted + ' ' + symbol : symbol + formatted;
}

export default function CheckoutPage() {
  const { items, totalAmount, clearCart } = useCart();
  const { websiteId, isLoading: websiteLoading } = useWebsite();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethod | null>(null);
  const [isLoadingShipping, setIsLoadingShipping] = useState(true);
  const [outOfStock, setOutOfStock] = useState<Array<{ productId: string; name: string; requested: number; available: number }>>([]);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width: 767px)').matches;
    }
    return false;
  });
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Fetch shipping methods
  useEffect(() => {
    if (!websiteId) return;
    fetch('/api/shipping-methods')
      .then(res => res.ok ? res.json() : [])
      .then((methods: ShippingMethod[]) => {
        setShippingMethods(methods);
        if (methods.length > 0) {
          setSelectedShipping(methods[0]);
        }
      })
      .catch(() => setShippingMethods([]))
      .finally(() => setIsLoadingShipping(false));
  }, [websiteId]);

  const shippingCost = selectedShipping ? selectedShipping.priceAmount / 100 : 0;
  const grandTotal = totalAmount + shippingCost;

  const currency = items.length > 0 ? (items[0].product.currency || 'USD') : 'USD';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOutOfStock([]);
    
    if (!name.trim() || !email.trim() || !address.trim() || !city.trim() || !postalCode.trim()) {
      setError(${lit(t.checkoutErrorRequired)});
      return;
    }

    if (!websiteId) {
      setError(${lit(t.checkoutErrorProcess)});
      return;
    }

    if (items.length === 0) {
      setError(${lit(t.checkoutErrorEmptyCart)});
      return;
    }

    setIsSubmitting(true);

    try {
      // First validate stock availability
      const validateRes = await fetch('/api/checkout/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item: any) => ({ 
            productId: item.product.baseProductId || item.product.id, 
            quantity: item.quantity,
            selectedVariants: item.product.selectedVariants 
          })),
          customerEmail: email,
          customerName: name,
          shippingAddress: address,
          shippingCity: city,
          shippingPostalCode: postalCode,
        }),
      });

      const validateData = await validateRes.json();
      if (!validateData.success) {
        if (validateData.outOfStock) {
          setOutOfStock(validateData.outOfStock);
        }
        throw new Error(validateData.message || 'Validation failed');
      }

      // Proceed with checkout
      const response = await fetch('/api/checkout/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item: any) => ({ 
            productId: item.product.baseProductId || item.product.id, 
            quantity: item.quantity,
            selectedVariants: item.product.selectedVariants 
          })),
          customerName: name,
          customerEmail: email,
          shippingAddress: address,
          shippingCity: city,
          shippingPostalCode: postalCode,
          shippingMethodId: selectedShipping?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.outOfStock) {
          setOutOfStock(data.outOfStock);
        }
        throw new Error(data.message || 'Failed to create order');
      }

      // Redirect to Stripe checkout if URL provided
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      setOrderId(data.orderId || '');
      clearCart();
      setSuccess(true);
      // Dispatch analytics events for checkout success
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('analytics:checkout_success', { 
          detail: { orderId: data.orderId, total: grandTotal, currency } 
        }));
        window.dispatchEvent(new CustomEvent('analytics:order_created', { 
          detail: { orderId: data.orderId, total: grandTotal, currency } 
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ${lit(t.checkoutErrorGeneric)});
    } finally {
      setIsSubmitting(false);
    }
  };

  if (websiteLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>${jsx(t.checkoutLoading)}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ backgroundColor: '#f9fafb', padding: '60px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#dcfce7', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>${jsx(t.checkoutConfirmedTitle)}</h1>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>${jsx(t.checkoutConfirmedBody)}</p>
          {orderId && <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '32px' }}>${jsx(t.checkoutOrderId)} {orderId}</p>}
          <p style={{ fontSize: '16px', color: '#4b5563', marginBottom: '32px' }}>${jsx(t.checkoutConfirmationEmail)} <strong>{email}</strong></p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            ${jsx(t.checkoutContinueShopping)}
          </Link>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ backgroundColor: '#f9fafb', padding: '60px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🛒</div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>${jsx(t.checkoutEmptyTitle)}</h1>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '32px' }}>${jsx(t.checkoutEmptyBody)}</p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            ${jsx(t.checkoutBrowseProducts)}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#f9fafb', padding: '60px 24px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6b7280', marginBottom: '32px', textDecoration: 'none', fontSize: '14px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          ${jsx(t.checkoutBackToShopping)}
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '40px' }}>${jsx(t.checkoutTitle)}</h1>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 400px', gap: isMobile ? '24px' : '40px' }}>
          <div style={{ order: isMobile ? 2 : 1 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: isMobile ? '20px' : '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>${jsx(t.checkoutYourDetails)}</h2>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>${jsx(t.checkoutFullName)}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={${lit(t.checkoutNamePlaceholder)}}
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>${jsx(t.checkoutEmail)}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={${lit(t.checkoutEmailPlaceholder)}}
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '16px', marginTop: '32px' }}>${jsx(t.checkoutShippingAddress)}</h3>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>${jsx(t.checkoutAddress)}</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={${lit(t.checkoutAddressPlaceholder)}}
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>${jsx(t.checkoutCity)}</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={${lit(t.checkoutCityPlaceholder)}}
                      required
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>${jsx(t.checkoutPostalCode)}</label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder={${lit(t.checkoutPostalCodePlaceholder)}}
                      required
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                    {outOfStock.length > 0 && (
                      <ul style={{ marginTop: '12px', marginLeft: '16px' }}>
                        {outOfStock.map((item) => (
                          <li key={item.productId} style={{ marginBottom: '4px' }}>
                            <strong>{item.name}</strong>: {item.available === 0 ? ${lit(t.checkoutOutOfStock)} : ${lit(t.checkoutOutOfStockDetail[0])} + item.available + ${lit(t.checkoutOutOfStockDetail[1])} + item.requested + ${lit(t.checkoutOutOfStockDetail[2])}}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: isSubmitting ? '#a5b4fc' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'default' : 'pointer',
                  }}
                >
                  {isSubmitting ? ${lit(t.checkoutSubmitting)} : ${lit(t.checkoutSubmit)}}
                </button>
              </form>
            </div>
          </div>

          <div style={{ order: isMobile ? 1 : 2 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: isMobile ? '20px' : '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: isMobile ? 'relative' : 'sticky', top: isMobile ? 'auto' : '24px' }}>
              <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>${jsx(t.checkoutSummary)}</h2>
              
              <div style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '20px', marginBottom: '20px' }}>
                {items.map((item) => (
                  <div key={item.product.id} style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} style={{ width: '64px', height: '64px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '64px', height: '64px', borderRadius: '8px', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📦</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: '#111827', marginBottom: '4px' }}>{item.product.name}</div>
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>${jsx(t.checkoutQty)} {item.quantity}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {formatCurrency(parseFloat(item.product.price) * item.quantity, item.product.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                <span>${jsx(t.checkoutSubtotal)}</span>
                <span>{formatCurrency(totalAmount, currency)}</span>
              </div>

              {isLoadingShipping ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                  ${jsx(t.checkoutLoadingShipping)}
                </div>
              ) : shippingMethods.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '12px' }}>${jsx(t.checkoutShippingMethod)}</div>
                  {shippingMethods.map((method) => (
                    <label 
                      key={method.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '14px',
                        border: selectedShipping?.id === method.id ? '2px solid #4f46e5' : '1px solid #e5e7eb',
                        borderRadius: '10px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        backgroundColor: selectedShipping?.id === method.id ? '#f5f3ff' : '#fff',
                      }}
                    >
                      <input
                        type="radio"
                        name="shipping"
                        checked={selectedShipping?.id === method.id}
                        onChange={() => setSelectedShipping(method)}
                        style={{ marginTop: '4px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 500, color: '#111827' }}>{method.name}</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>
                            {method.priceAmount === 0 ? ${lit(t.checkoutFree)} : formatCurrency(method.priceAmount / 100, method.currency)}
                          </span>
                        </div>
                        {method.deliveryTime && (
                          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{method.deliveryTime}</div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {!isLoadingShipping && shippingMethods.length === 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                  <span>${jsx(t.checkoutShipping)}</span>
                  <span>${jsx(t.checkoutFree)}</span>
                </div>
              )}

              {selectedShipping && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                  <span>${jsx(t.checkoutShipping)} ({selectedShipping.name})</span>
                  <span>{shippingCost === 0 ? ${lit(t.checkoutFree)} : formatCurrency(shippingCost, currency)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700, color: '#111827', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <span>${jsx(t.checkoutTotal)}</span>
                <span>{formatCurrency(grandTotal, currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;
}

export function generateOrderApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

async function getWebsiteIdFromHost(host: string, supabase: any): Promise<string | null> {
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return BUILD_TIME_WEBSITE_ID;
  }
  
  let normalizedHost = host.replace(/^www\\./, '').split(':')[0];
  const urlToMatch = \`https://\${normalizedHost}\`;
  const urlWithWww = \`https://www.\${normalizedHost}\`;
  
  const { data: exactMatch } = await supabase
    .from('websites')
    .select('id')
    .or(\`deployment_url.eq.\${urlToMatch},deployment_url.eq.\${urlWithWww}\`)
    .limit(1)
    .single();
  
  if (exactMatch) {
    return exactMatch.id;
  }
  
  const parts = normalizedHost.split('.');
  let slug: string | null = null;
  
  if (parts.length >= 3 && parts.slice(1).join('.') === 'bird-flow.com') {
    slug = parts[0];
  } else if (normalizedHost.endsWith('.vercel.app') && parts.length === 3) {
    slug = parts[0];
  }
  
  if (slug) {
    const { data: slugMatch } = await supabase
      .from('websites')
      .select('id')
      .eq('slug', slug)
      .limit(1)
      .single();
    
    if (slugMatch) {
      return slugMatch.id;
    }
  }
  
  return BUILD_TIME_WEBSITE_ID;
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ message: 'Server not configured' }, { status: 500 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const host = request.headers.get('host') || '';
    const websiteId = await getWebsiteIdFromHost(host, supabase);
    
    if (!websiteId) {
      return NextResponse.json({ message: 'Could not determine website' }, { status: 400 });
    }

    const body = await request.json();
    const { customerName, customerEmail, items, total, currency, shippingMethodId, shippingName, shippingPrice } = body;

    if (!customerName || !customerEmail || !items || items.length === 0) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        website_id: websiteId,
        customer_name: customerName,
        customer_email: customerEmail,
        status: 'pending',
        payment_status: 'unpaid',
        total: total,
        currency: currency || 'USD',
        items: items,
        shipping_method_id: shippingMethodId || null,
        shipping_name: shippingName || null,
        shipping_price: shippingPrice ? String(shippingPrice) : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Order creation error:', error);
      return NextResponse.json({ message: 'Failed to create order' }, { status: 500 });
    }

    // Insert order items into normalized table
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      website_id: websiteId,
      product_id: item.productId || item.id,
      product_name: item.productName || item.name,
      quantity: item.quantity,
      price_at_purchase: String(item.priceAtPurchase || item.price),
      currency: item.currency || currency || 'USD',
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      // Order was created, just log the error for items
    }

    return NextResponse.json({ id: order.id, message: 'Order created successfully' });
  } catch (err) {
    console.error('Order error:', err);
    return NextResponse.json({ message: 'Failed to create order' }, { status: 500 });
  }
}
`;
}

export function generateShippingMethodsApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILD_TIME_WEBSITE_ID = ${lit(websiteId)};

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data, error } = await supabase
      .from('shipping_methods')
      .select('*')
      .eq('website_id', BUILD_TIME_WEBSITE_ID)
      .eq('is_active', true)
      .order('price_amount', { ascending: true });

    if (error) {
      console.error('Shipping methods fetch error:', error);
      return NextResponse.json([], { status: 200 });
    }

    // Transform snake_case to camelCase for frontend
    const methods = (data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      priceAmount: m.price_amount,
      currency: m.currency,
      deliveryTime: m.delivery_time,
      isActive: m.is_active,
    }));

    return NextResponse.json(methods);
  } catch (err) {
    console.error('Shipping methods error:', err);
    return NextResponse.json([], { status: 200 });
  }
}
`;
}
