import type { ThemeConfig, PageData, BuilderComponentData } from '../../shared/rendering/types';

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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
  
  // Strategy 2: Slug-based lookup for recognized domain patterns only
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, customerEmail, customerPhone, serviceId, service, date, time, notes } = body;
    
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

    const { data, error } = await supabase.from('bookings').insert({
      website_id: effectiveWebsiteId,
      service_id: serviceId || null,
      service: service,
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone || null,
      date: new Date(date).toISOString(),
      time: time || null,
      duration_minutes: durationMinutes,
      price: price,
      notes: notes || null,
      status: 'pending',
    }).select().single();

    if (error) {
      console.error('Booking error:', error);
      return NextResponse.json({ message: 'Failed to create booking' }, { status: 500 });
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
            date,
            time,
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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
    const date = searchParams.get('date');

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

    // Get availability rules for this day
    const { data: rules } = await supabase
      .from('service_availability')
      .select('start_time, end_time, slot_duration_minutes')
      .eq('service_id', serviceId)
      .eq('is_active', true)
      .or(\`day_of_week.eq.\${dayOfWeek},specific_date.eq.\${date}\`);

    if (!rules || rules.length === 0) {
      return NextResponse.json([]);
    }

    // Get existing bookings for this date
    const startOfDay = \`\${date}T00:00:00\`;
    const endOfDay = \`\${date}T23:59:59\`;

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
    const slots: { time: string; available: boolean }[] = [];
    const addedTimes = new Set<string>();

    for (const rule of rules) {
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
          addedTimes.add(timeStr);
          slots.push({
            time: timeStr,
            available: !bookedTimes.has(timeStr),
          });
        }
        
        currentTime += slotDuration;
      }
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

export function generateCheckoutApiRoute(websiteId: string): string {
  return `import { NextRequest, NextResponse } from 'next/server';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const WEBSITE_ID = '${websiteId}';

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
const WEBSITE_ID = '${websiteId}';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerEmail, customerName, customerPhone, shippingAddress } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, message: 'Cart is empty' }, { status: 400 });
    }

    if (!customerEmail || !customerEmail.includes('@')) {
      return NextResponse.json({ success: false, message: 'Valid email is required', field: 'customerEmail' }, { status: 400 });
    }

    if (!customerName || customerName.trim().length < 2) {
      return NextResponse.json({ success: false, message: 'Name is required', field: 'customerName' }, { status: 400 });
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
const WEBSITE_ID = '${websiteId}';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, customerEmail, customerName, customerPhone, shippingAddress, shippingMethodId } = body;

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
      shipping_address: shippingAddress || null,
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
const WEBSITE_ID = '${websiteId}';

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
export const fallbackWebsiteId = '${websiteId}';

// Runtime website ID (will be set by WebsiteProvider)
let runtimeWebsiteId: string | null = null;

export function setRuntimeWebsiteId(id: string) {
  runtimeWebsiteId = id;
}

export function getWebsiteId(): string {
  return runtimeWebsiteId || fallbackWebsiteId;
}

// For backward compatibility
export const websiteId = '${websiteId}';

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
  
  // Strategy 2: Slug-based lookup for recognized domain patterns only
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

export const websiteId = '${websiteId}';

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
    async function detectWebsite() {
      try {
        const hostname = window.location.hostname;
        
        if (shouldDetectWebsite(hostname)) {
          const website = await fetchWebsiteByDeploymentUrl(hostname);
          if (website) {
            setWebsiteIdState(website.id);
            setWebsiteName(website.name);
            setRuntimeWebsiteId(website.id);
          }
        }
      } catch (error) {
        console.error('Failed to detect website:', error);
      } finally {
        setIsLoading(false);
      }
    }

    detectWebsite();
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

export function generateCartDrawer(): string {
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
            Shopping Cart
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
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#6b7280' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛒</div>
              <p style={{ fontSize: '16px', fontWeight: 500 }}>Your cart is empty</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>Add some products to get started!</p>
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
                      {formatCurrency(parseFloat(item.product.price || '0'), item.product.currency)} each
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
                        Remove
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
              <span style={{ fontSize: '16px', color: '#6b7280' }}>Total</span>
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
              Proceed to Checkout
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

export function generateComponentRenderer(): string {
  return `'use client';

import React, { useState, useEffect } from 'react';
import theme from '@/theme.json';
import { useCart } from '@/components/CartProvider';

type BuilderPage = {
  id: string;
  name: string;
  path: string;
  hidden?: boolean;
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
  alignment?: 'left' | 'center' | 'right';
  imageSide?: 'left' | 'right';
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
  [key: string]: any; // Allow additional properties
};

function getImageUrl(image: ImageValue | undefined): string {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || '';
}

type ComponentStyles = {
  backgroundColor?: string;
  textColor?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
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
  cardStyle?: string;
  [key: string]: any; // Allow additional properties
};

type ComponentData = {
  id: string;
  type: string;
  props: ComponentProps;
  styles: ComponentStyles;
};

function getBaseStyle(styles: ComponentStyles): React.CSSProperties {
  return {
    backgroundColor: styles.backgroundColor || theme.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '0',
    position: 'relative',
  };
}

function HeroSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const imageUrl = getImageUrl(props.imageUrl);
  const backgroundImage = imageUrl ? { backgroundImage: \`url(\${imageUrl})\`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  
  return (
    <section style={{ ...baseStyle, ...backgroundImage }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: props.alignment || 'center' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h1>
        {props.subtitle && <p style={{ fontSize: '24px', opacity: 0.9, marginBottom: '16px' }}>{props.subtitle}</p>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>}
        {props.buttonText && (
          <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: '#1a1a1a', borderRadius: '8px', textDecoration: 'none' }}>
            {props.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function ImageSliderSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', padding: '20px 0' }}>
        {props.images?.map((img, i) => {
          const url = getImageUrl(img);
          return url ? (
            <img key={i} src={url} alt={\`Slide \${i + 1}\`} style={{ width: '300px', height: '200px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
          ) : null;
        })}
      </div>
    </section>
  );
}

function TextImageSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const isImageLeft = props.imageSide === 'left';
  const imageUrl = getImageUrl(props.imageUrl);
  
  return (
    <section style={baseStyle}>
      <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexDirection: isImageLeft ? 'row-reverse' : 'row', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
          <p style={{ fontSize: '18px', lineHeight: 1.7, opacity: 0.8 }}>{props.description}</p>
        </div>
        {imageUrl && (
          <div style={{ flex: 1, minWidth: '300px' }}>
            <img src={imageUrl} alt="" style={{ width: '100%', borderRadius: '12px' }} />
          </div>
        )}
      </div>
    </section>
  );
}

function CTASection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>{props.title}</h2>
        <p style={{ fontSize: '18px', opacity: 0.9, marginBottom: '32px' }}>{props.description}</p>
        {props.buttonText && (
          <a href={props.buttonLink || '#'} style={{ display: 'inline-block', padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#ffffff', color: styles.backgroundColor || '#4f46e5', borderRadius: '8px', textDecoration: 'none' }}>
            {props.buttonText}
          </a>
        )}
      </div>
    </section>
  );
}

function FeaturesSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>
        {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
          {props.items?.map(item => (
            <div key={item.id} style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>
              {item.icon && <div style={{ fontSize: '32px', marginBottom: '16px' }}>{item.icon}</div>}
              <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '14px', opacity: 0.8 }}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '48px' }}>{props.title}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
          {props.items?.map(item => (
            <div key={item.id} style={{ padding: '32px', backgroundColor: '#f8f9fa', borderRadius: '12px', textAlign: 'left' }}>
              <p style={{ fontSize: '16px', fontStyle: 'italic', marginBottom: '16px', color: styles.textColor }}>"{item.description}"</p>
              <p style={{ fontWeight: 600, color: styles.textColor }}>{item.title}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeaderSection({ props, styles, pages }: { props: ComponentProps; styles: ComponentStyles; pages?: BuilderPage[] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const baseStyle = getBaseStyle({ ...styles, padding: '16px 24px' });
  const { totalItems, toggleCart } = useCart();
  const showCart = props.showCart !== false && props.showCart !== 'false';

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navItems = pages && pages.length > 0
    ? pages.filter(page => !page.hidden).map(page => ({ id: page.id, title: page.name, href: page.path }))
    : props.items?.map(item => ({ id: item.id, title: item.title, href: item.description || '#' })) || [];
  
  return (
    <header style={{ ...baseStyle, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '20px', fontWeight: 700, color: 'inherit', textDecoration: 'none' }}>
          {(() => {
            const logoUrl = typeof props.imageUrl === 'object' && props.imageUrl !== null 
              ? (props.imageUrl as any).url || (props.imageUrl as any).src 
              : props.imageUrl;
            return logoUrl ? (
              <img src={logoUrl} alt={props.title || 'Logo'} style={{ height: '40px', width: 'auto', objectFit: 'contain' }} />
            ) : null;
          })()}
          {props.title && <span>{props.title}</span>}
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {!isMobile && (
            <nav style={{ display: 'flex', gap: '24px' }}>
              {navItems.map(item => (
                <a key={item.id} href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>{item.title}</a>
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
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
              aria-label="Toggle menu"
            >
              <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: '24px', height: '3px', backgroundColor: styles.textColor || '#1a1a1a', borderRadius: '2px', transition: 'all 0.3s', transform: mobileMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
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
            <a
              key={item.id}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: styles.textColor || '#1a1a1a', textDecoration: 'none', padding: '8px 0', fontSize: '16px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}
            >
              {item.title}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

function FooterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle({ ...styles, padding: '32px 24px' });
  
  return (
    <footer style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontWeight: 600, marginBottom: '8px' }}>{props.title}</p>
        <p style={{ opacity: 0.7, fontSize: '14px' }}>{props.description}</p>
      </div>
    </footer>
  );
}

function ProductGridSection({ props, styles, products }: { props: ComponentProps; styles: ComponentStyles; products: any[] }) {
  const baseStyle = getBaseStyle(styles);
  const columns = props.columns || 3;
  const limit = props.productLimit || 6;
  const displayProducts = products.slice(0, limit);
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '18px', opacity: 0.7, marginBottom: '48px', textAlign: 'center' }}>{props.description}</p>}
        
        {displayProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>
            <p>No products available.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${columns}, 1fr)\`, gap: '24px' }}>
            {displayProducts.map((product: any) => (
              <div key={product.id} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.1)' }}>
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', aspectRatio: '4/3', backgroundColor: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px' }}>
                    📦
                  </div>
                )}
                <div style={{ padding: '16px' }}>
                  <h3 style={{ fontWeight: 600, marginBottom: '4px' }}>{product.name}</h3>
                  {product.category && <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>{product.category}</p>}
                  {product.description && <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '12px' }}>{product.description}</p>}
                  <p style={{ fontSize: '20px', fontWeight: 700 }}>\${parseFloat(product.price).toFixed(2)}</p>
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
  const images = props.images || [];
  const columns = props.columns || 2;
  
  return (
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '32px', textAlign: 'center' }}>{props.description}</p>}
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
  const items = props.items || [];
  const cardStyle = styles.cardStyle || 'elevated';
  
  const getCardStyles = () => {
    switch (cardStyle) {
      case 'elevated': return { boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)' };
      case 'bordered': return { border: '1px solid rgba(0,0,0,0.1)' };
      case 'glass': return { background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' };
      default: return {};
    }
  };
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${items.length || 1}, 1fr)\`, gap: '24px' }}>
          {items.map((item: any, index: number) => (
            <div key={item.id || index} style={{ padding: '32px', borderRadius: '16px', backgroundColor: 'rgba(255,255,255,0.05)', ...getCardStyles() }}>
              {item.icon && <div style={{ fontSize: '40px', marginBottom: '16px' }}>{item.icon}</div>}
              <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>{item.title}</h3>
              <p style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px' }}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const items = props.items || [];
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '40px', textAlign: 'center' }}>{props.subtitle}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px' }}>
          {items.map((item: any, index: number) => (
            <details key={item.id || index} style={{ padding: '20px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.03)', cursor: 'pointer' }}>
              <summary style={{ fontWeight: 600, fontSize: '18px' }}>{item.title}</summary>
              <p style={{ marginTop: '12px', opacity: 0.8 }}>{item.description}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatsCounterSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
  const stats = (props as any).stats || [];
  
  return (
    <section style={baseStyle}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.subtitle && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '48px' }}>{props.subtitle}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${stats.length || 1}, 1fr)\`, gap: '32px' }}>
          {stats.map((stat: any, index: number) => (
            <div key={stat.id || index}>
              <div style={{ fontSize: '48px', fontWeight: 800, marginBottom: '8px' }}>
                {stat.prefix}{stat.value}{stat.suffix}
              </div>
              <div style={{ fontSize: '16px', opacity: 0.8 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoEmbedSection({ props, styles }: { props: ComponentProps; styles: ComponentStyles }) {
  const baseStyle = getBaseStyle(styles);
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
    <section style={{ ...baseStyle, borderRadius: styles.borderRadius }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        {props.title && <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>{props.title}</h2>}
        {props.description && <p style={{ fontSize: '16px', opacity: 0.8, marginBottom: '32px' }}>{props.description}</p>}
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

export default function ComponentRenderer({ component, products = [], pages = [] }: { component: ComponentData; products?: any[]; pages?: BuilderPage[] }) {
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
      return <HeaderSection props={component.props} styles={component.styles} pages={pages} />;
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
    default:
      return null;
  }
}
`;
}

export function generateContactForm(): string {
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
        <h2 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '16px', textAlign: 'center' }}>{props.title || 'Contact Us'}</h2>
        {props.description && <p style={{ textAlign: 'center', marginBottom: '32px', opacity: 0.8 }}>{props.description}</p>}
        
        {status === 'success' ? (
          <p style={{ textAlign: 'center', color: '#22c55e' }}>Thank you! We'll get back to you soon.</p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              type="text"
              placeholder="Your Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <input
              type="email"
              placeholder="Your Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
            />
            <textarea
              placeholder="Your Message"
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
              {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
            {status === 'error' && <p style={{ color: '#ef4444', textAlign: 'center' }}>Something went wrong. Please try again.</p>}
          </form>
        )}
      </div>
    </section>
  );
}
`;
}

export function generateBookingForm(): string {
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

export default function BookingForm({ styles, props }: Props) {
  const { websiteId } = useWebsite();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [services, setServices] = useState<BookingService[]>([]);
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
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

  // Fetch time slots when date is selected
  useEffect(() => {
    if (!selectedService || !selectedDate || !websiteId) return;
    
    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedTime('');
      try {
        const res = await fetch(\`/api/slots?serviceId=\${selectedService}&date=\${selectedDate}\`);
        if (res.ok) {
          const data = await res.json();
          setTimeSlots(data);
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
  }, [selectedService, selectedDate, websiteId]);

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
    setTimeSlots([]);
    setAvailability(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime || !name || !email) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    const service = services.find(s => s.id === selectedService);
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
        }),
      });
      
      if (!res.ok) {
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
      setStatus('error');
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedService('');
    setSelectedDate('');
    setSelectedTime('');
    setName('');
    setEmail('');
    setPhone('');
    setNotes('');
    setStatus('idle');
    setAvailability(null);
    setTimeSlots([]);
  };

  const navigateMonth = (direction: number) => {
    setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + direction, 1));
  };

  const selectedServiceData = services.find(s => s.id === selectedService);
  const canProceedStep1 = selectedService !== '';
  const canProceedStep2 = selectedDate !== '' && selectedTime !== '';
  const bgColor = styles.backgroundColor || '#f8fafc';
  const textColor = styles.textColor || '#1e293b';
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const availableSlots = timeSlots.filter(s => s.available);

  return (
    <section style={{ backgroundColor: bgColor, color: textColor, padding: styles.padding || '0' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', padding: '8px 16px', borderRadius: '20px', marginBottom: '16px' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 500 }}>Book Your Appointment</span>
          </div>
          <h2 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '12px' }}>{props.title || 'Schedule a Visit'}</h2>
          {props.subtitle && <p style={{ fontSize: '18px', opacity: 0.7 }}>{props.subtitle}</p>}
        </div>

        {status !== 'success' && services.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
            {[1, 2, 3].map((s) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '14px', backgroundColor: step >= s ? accentColor : '#e2e8f0', color: step >= s ? '#fff' : '#94a3b8', transition: 'all 0.2s' }}>{s}</div>
                {s < 3 && <div style={{ width: '40px', height: '2px', backgroundColor: step > s ? accentColor : '#e2e8f0', transition: 'all 0.2s' }} />}
              </div>
            ))}
          </div>
        )}

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', borderRadius: '16px', border: '1px solid #a7f3d0' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <svg style={{ width: '32px', height: '32px', color: '#fff' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 style={{ color: '#065f46', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Booking Confirmed!</h3>
            <p style={{ color: '#047857', marginBottom: '24px' }}>We'll send a confirmation email to {email}</p>
            <button onClick={resetForm} style={{ backgroundColor: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Book Another Appointment</button>
          </div>
        ) : (
          <div style={{ backgroundColor: '#fff', borderRadius: '20px', padding: '32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(0,0,0,0.06)' }}>
            {services.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fefce8', borderRadius: '12px', border: '1px solid #fde047' }}>
                <p style={{ color: '#854d0e', fontWeight: 500 }}>No services available right now</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {step === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Choose a Service</p>
                    {services.map((service) => (
                      <div key={service.id} onClick={() => handleSelectService(service.id)} style={{ padding: '20px', borderRadius: '12px', border: selectedService === service.id ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedService === service.id ? '#f0f4ff' : '#fff', cursor: 'pointer', transition: 'all 0.15s ease' }}>
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
                    <button type="button" onClick={() => canProceedStep1 && setStep(2)} disabled={!canProceedStep1} style={{ marginTop: '16px', padding: '14px 24px', borderRadius: '12px', fontSize: '16px', fontWeight: 600, backgroundColor: canProceedStep1 ? accentColor : '#e2e8f0', color: canProceedStep1 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep1 ? 'pointer' : 'default' }}>Continue</button>
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Select Date & Time</p>
                    
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
                        <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>Loading availability...</div>
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
                                title={day.isBlocked ? (day.blockReason || 'Unavailable') : undefined}
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
                            Available
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: '#fef2f2' }}></span>
                            Blocked
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Time Slots */}
                    {selectedDate && (
                      <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, opacity: 0.8 }}>
                          Available Times for {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </label>
                        {loadingSlots ? (
                          <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>Loading times...</div>
                        ) : availableSlots.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px', backgroundColor: '#fefce8', borderRadius: '8px', border: '1px solid #fde047' }}>
                            <p style={{ color: '#854d0e', fontSize: '14px' }}>No available times for this date. Please select another date.</p>
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {availableSlots.map((slot) => (
                              <button key={slot.time} type="button" onClick={() => setSelectedTime(slot.time)} style={{ padding: '12px', borderRadius: '8px', border: selectedTime === slot.time ? '2px solid ' + accentColor : '2px solid #e2e8f0', backgroundColor: selectedTime === slot.time ? '#f0f4ff' : '#fff', color: selectedTime === slot.time ? accentColor : textColor, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' }}>{slot.time}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="button" onClick={() => canProceedStep2 && setStep(3)} disabled={!canProceedStep2} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: canProceedStep2 ? accentColor : '#e2e8f0', color: canProceedStep2 ? '#fff' : '#94a3b8', border: 'none', cursor: canProceedStep2 ? 'pointer' : 'default' }}>Continue</button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px' }}>Your Details</p>
                    {selectedServiceData && (
                      <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '10px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                          <span style={{ opacity: 0.7 }}>Service:</span>
                          <span style={{ fontWeight: 600 }}>{selectedServiceData.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                          <span style={{ opacity: 0.7 }}>Date & Time:</span>
                          <span style={{ fontWeight: 600 }}>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {selectedTime}</span>
                        </div>
                      </div>
                    )}
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Full Name *</label>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Email *</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Phone (optional)</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px', border: '1px solid #e2e8f0' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>Notes (optional)</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any special requests..." style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px', resize: 'none' }} />
                    </div>
                    {status === 'error' && <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '14px', textAlign: 'center' }}>Please fill in all required fields and try again.</div>}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <button type="button" onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', borderRadius: '12px', fontWeight: 600, border: '1px solid #e2e8f0', backgroundColor: '#fff', cursor: 'pointer' }}>Back</button>
                      <button type="submit" disabled={status === 'loading' || !name || !email} style={{ flex: 2, padding: '14px', borderRadius: '12px', fontWeight: 600, backgroundColor: accentColor, color: '#fff', border: 'none', cursor: status === 'loading' || !name || !email ? 'default' : 'pointer', opacity: status === 'loading' || !name || !email ? 0.6 : 1 }}>{status === 'loading' ? 'Booking...' : (props.buttonText || 'Confirm Booking')}</button>
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

export function generateProductGrid(): string {
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
      setSuccessMessage('Payment successful! Your order has been placed.');
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
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700 }}>{props.title || 'Products'}</h2>
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
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          @media (min-width: 640px) {
            .product-grid-responsive {
              grid-template-columns: repeat(3, 1fr);
              gap: 16px;
            }
          }
          @media (min-width: 1024px) {
            .product-grid-responsive {
              grid-template-columns: repeat(4, 1fr);
              gap: 24px;
            }
          }
          .product-card {
            background: #fff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            text-decoration: none;
            color: inherit;
            display: block;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .product-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.12);
          }
          .product-image-wrapper {
            position: relative;
            width: 100%;
            padding-top: 125%; /* 4:5 aspect ratio */
            overflow: hidden;
            background: #f5f5f5;
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
            font-size: 48px;
            background: #f0f0f0;
          }
          .product-info {
            padding: 12px;
          }
          @media (min-width: 640px) {
            .product-info {
              padding: 16px;
            }
          }
          .product-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #1a1a1a;
          }
          .product-category {
            font-size: 11px;
            opacity: 0.5;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .product-price {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
          }
        \`}</style>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading products...</div>
        ) : fetchError ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>Unable to load products. Please try again later.</div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', opacity: 0.6 }}>No products available.</div>
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
                    {product.variants && product.variants.length > 0 ? 'From ' : ''}{formatCurrency(parseFloat(product.price), product.currency)}
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
export function generateCookieBanner(): string {
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
  bannerText = "We use cookies to improve your experience and analyze site traffic.",
  privacyPolicyUrl,
  acceptButtonText = "Accept",
  rejectButtonText = "Reject"
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
              Privacy Policy
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
  const allowedKeys = ['path', 'productId', 'productName', 'quantity', 'price', 'currency', 'serviceId', 'serviceName', 'orderId', 'bookingId', 'total'];
  for (const key of allowedKeys) {
    if (data[key] !== undefined) {
      sanitized[key] = data[key];
    }
  }
  return Object.keys(sanitized).length > 0 ? sanitized : null;
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
    if (!supabase) {
      console.warn('[Analytics] Supabase not configured');
      return;
    }
    
    try {
      const sessionId = getOrCreateSession();
      if (!sessionId || !websiteId) return;
      
      const { error } = await supabase.from('analytics_events').insert({
        website_id: websiteId,
        session_id: sessionId,
        event_type: eventType,
        page_url: typeof window !== 'undefined' ? window.location.pathname : null,
        traffic_source: getTrafficSource(),
        device_type: getDeviceType(),
        event_data: sanitizeEventData(eventData),
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

export function generateRootLayout(siteName: string, websiteId: string): string {
  return `import type { Metadata } from 'next';
import './globals.css';
import { WebsiteProvider } from '@/components/WebsiteProvider';
import { CartProvider } from '@/components/CartProvider';
import CartDrawer from '@/components/CartDrawer';
import AnalyticsTracker from '@/components/AnalyticsTracker';
import CookieBanner from '@/components/CookieBanner';

export const metadata: Metadata = {
  title: '${siteName}',
  description: 'Built with SaaSify',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebsiteProvider>
          <CartProvider>
            <AnalyticsTracker websiteId="${websiteId}" />
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

export function generateGlobalsCss(theme?: ThemeConfig): string {
  const fontFamily = theme?.fontFamily || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const primaryColor = theme?.primaryColor || '#4f46e5';
  const secondaryColor = theme?.secondaryColor || '#22c55e';
  const backgroundColor = theme?.backgroundColor || '#ffffff';
  const textColor = theme?.textColor || '#1f2937';
  const borderRadius = theme?.borderRadius || '8px';
  const sectionGap = theme?.sectionGap || '0';
  
  return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --primary-color: ${primaryColor};
  --secondary-color: ${secondaryColor};
  --background-color: ${backgroundColor};
  --text-color: ${textColor};
  --border-radius: ${borderRadius};
  --section-gap: ${sectionGap};
  --font-family: ${fontFamily};
}

body {
  font-family: var(--font-family);
  line-height: 1.5;
  background-color: var(--background-color);
  color: var(--text-color);
}

a {
  color: inherit;
  text-decoration: none;
}

section {
  margin-bottom: var(--section-gap);
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
  border-radius: var(--border-radius);
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.btn-secondary:hover {
  opacity: 0.9;
}

.card {
  border-radius: var(--border-radius);
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
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

export function generatePageFile(page: PageData, websiteId: string, allPages?: NavPage[]): string {
  const componentsImport = `import ComponentRenderer from '@/components/ComponentRenderer';
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
  
  return `${componentsImport}

const pageComponents = ${componentsJson};
const sitePages = ${pagesJson};

export default function Page() {
  return (
    <main>
      {pageComponents.map((component: any) => {
        switch (component.type) {
          case 'contact-form':
            return <ContactForm key={component.id} props={component.props} styles={component.styles} />;
          case 'booking-form':
          case 'booking':
            return <BookingForm key={component.id} props={component.props} styles={component.styles} />;
          case 'product-grid':
            return <ProductGrid key={component.id} props={component.props} styles={component.styles} />;
          default:
            return <ComponentRenderer key={component.id} component={component} pages={sitePages} />;
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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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

export function generateProductDetailPage(): string {
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
      <div style={{ width: '100%', aspectRatio: '1', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', borderRadius: '16px' }}>
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
            borderRadius: '16px',
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
            aria-label="Close image viewer"
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
                aria-label="Previous image"
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
                aria-label="Next image"
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
    if (stock === 0) return { text: 'Out of Stock', color: '#ef4444' };
    if (stock <= 5) return { text: 'Only ' + stock + ' left!', color: '#f59e0b' };
    return { text: 'In Stock', color: '#22c55e' };
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#6b7280' }}>Loading product...</p>
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
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Product Not Found</h1>
          <p style={{ color: '#6b7280', marginBottom: '24px' }}>{error || 'The product you are looking for does not exist or is no longer available.'}</p>
          <Link href="/" style={{ display: 'inline-block', padding: '12px 24px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 600 }}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const allImages = getAllImages();
  const stockStatus = getStockStatus();
  const isOutOfStock = stockStatus?.text === 'Out of Stock';

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
          grid-template-columns: minmax(300px, 600px) 1fr;
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
          color: #4f46e5;
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
        <Link href="/" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#4f46e5', textDecoration: 'none', marginBottom: '32px', fontSize: '14px', fontWeight: 500 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Products
        </Link>

        <div className="product-layout">
          <ImageGallery images={allImages} productName={product.name} />

          <div className="product-info">
            {product.category && (
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                  backgroundColor: isOutOfStock || !allVariantsSelected() ? '#d1d5db' : addedToCart ? '#22c55e' : '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
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
                {!allVariantsSelected() ? 'Select Options' : isOutOfStock ? 'Out of Stock' : addedToCart ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M5 10L8.5 13.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Added to Cart
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 3H5L5.4 5M7 13H15L17 5H5.4M7 13L5.4 5M7 13L4.7 15.3C4.1 15.9 4.5 17 5.3 17H15M15 17C14.2 17 13.5 17.7 13.5 18.5S14.2 20 15 20 16.5 19.3 16.5 18.5 15.8 17 15 17ZM7 17C6.2 17 5.5 17.7 5.5 18.5S6.2 20 7 20 8.5 19.3 8.5 18.5 7.8 17 7 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Add to Cart
                  </>
                )}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '24px', paddingTop: '24px', borderTop: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                Free Shipping
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                Secure Checkout
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Easy Returns
              </div>
            </div>
          </div>
        </div>

        {product.long_description && (
          <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Product Details</h2>
            <div style={{ fontSize: '16px', color: '#4b5563', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
              {product.long_description}
            </div>
          </div>
        )}

        <div style={{ marginTop: '80px', backgroundColor: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '24px' }}>Why Choose Us</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Premium Quality</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Crafted with the finest materials for lasting durability</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Satisfaction Guaranteed</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>30-day money-back guarantee on all orders</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>Fast Delivery</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>Quick and reliable shipping to your doorstep</p>
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

export function generateCheckoutPage(): string {
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<ShippingMethod | null>(null);
  const [isLoadingShipping, setIsLoadingShipping] = useState(true);
  const [outOfStock, setOutOfStock] = useState<Array<{ productId: string; name: string; requested: number; available: number }>>([]);

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
    
    if (!name.trim() || !email.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (!websiteId) {
      setError('Unable to process order. Please try again.');
      return;
    }

    if (items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setIsSubmitting(true);

    try {
      // First validate stock availability
      const validateRes = await fetch('/api/checkout/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({ 
            productId: item.product.baseProductId || item.product.id, 
            quantity: item.quantity,
            selectedVariants: item.product.selectedVariants 
          })),
          customerEmail: email,
          customerName: name,
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
          items: items.map(item => ({ 
            productId: item.product.baseProductId || item.product.id, 
            quantity: item.quantity,
            selectedVariants: item.product.selectedVariants 
          })),
          customerName: name,
          customerEmail: email,
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
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (websiteLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Loading...</div>
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
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Order Confirmed!</h1>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '8px' }}>Thank you for your order.</p>
          {orderId && <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '32px' }}>Order ID: {orderId}</p>}
          <p style={{ fontSize: '16px', color: '#4b5563', marginBottom: '32px' }}>We'll send a confirmation email to <strong>{email}</strong></p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            Continue Shopping
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
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#111827', marginBottom: '16px' }}>Your cart is empty</h1>
          <p style={{ fontSize: '16px', color: '#6b7280', marginBottom: '32px' }}>Add some items to your cart to checkout.</p>
          <Link href="/" style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '12px', fontWeight: 600, textDecoration: 'none' }}>
            Browse Products
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
          Back to shopping
        </Link>

        <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', marginBottom: '40px' }}>Checkout</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }}>
          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>Your Information</h2>
              
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '16px', outline: 'none' }}
                  />
                </div>

                {error && (
                  <div style={{ marginBottom: '20px', padding: '14px 16px', backgroundColor: '#fef2f2', borderRadius: '10px', color: '#dc2626', fontSize: '14px' }}>
                    {error}
                    {outOfStock.length > 0 && (
                      <ul style={{ marginTop: '12px', marginLeft: '16px' }}>
                        {outOfStock.map((item) => (
                          <li key={item.productId} style={{ marginBottom: '4px' }}>
                            <strong>{item.name}</strong>: {item.available === 0 ? 'Out of stock' : \`Only \${item.available} available (requested \${item.requested})\`}
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
                  {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>

          <div>
            <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', position: 'sticky', top: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>Order Summary</h2>
              
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
                      <div style={{ fontSize: '14px', color: '#6b7280' }}>Qty: {item.quantity}</div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#111827' }}>
                      {formatCurrency(parseFloat(item.product.price) * item.quantity, item.product.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '12px' }}>
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount, currency)}</span>
              </div>

              {isLoadingShipping ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '14px' }}>
                  Loading shipping options...
                </div>
              ) : shippingMethods.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '12px' }}>Shipping Method</div>
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
                            {method.priceAmount === 0 ? 'Free' : formatCurrency(method.priceAmount / 100, method.currency)}
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
                  <span>Shipping</span>
                  <span>Free</span>
                </div>
              )}

              {selectedShipping && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6b7280', marginBottom: '20px' }}>
                  <span>Shipping ({selectedShipping.name})</span>
                  <span>{shippingCost === 0 ? 'Free' : formatCurrency(shippingCost, currency)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 700, color: '#111827', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                <span>Total</span>
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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
const BUILD_TIME_WEBSITE_ID = '${websiteId}';

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
    const methods = (data || []).map(m => ({
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
