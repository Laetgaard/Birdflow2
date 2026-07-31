import type { Request } from "express";
import geoip from "fast-geoip";
import type { AnalyticsTimeseriesPoint } from "@shared/schema";

// ============================================================
// Analytics ingest helpers
//
// Traffic-source classification and IP -> country resolution
// happen HERE, at ingest, so published sites only need to send
// the raw document.referrer. The visitor IP is used for a single
// in-process GeoIP lookup and is never stored (GDPR: we keep the
// ISO 3166-1 alpha-2 country code only).
// ============================================================

/** Canonical traffic sources the dashboard understands. */
export const KNOWN_TRAFFIC_SOURCES = [
  "direct",
  "google",
  "bing",
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "email",
  "referral",
] as const;

export type KnownTrafficSource = (typeof KNOWN_TRAFFIC_SOURCES)[number];

const UTM_SOURCE_MAP: Record<string, KnownTrafficSource> = {
  google: "google",
  adwords: "google",
  "google-ads": "google",
  googleads: "google",
  bing: "bing",
  facebook: "facebook",
  fb: "facebook",
  meta: "facebook",
  instagram: "instagram",
  ig: "instagram",
  twitter: "twitter",
  x: "twitter",
  linkedin: "linkedin",
  youtube: "youtube",
  tiktok: "tiktok",
  pinterest: "pinterest",
  email: "email",
  newsletter: "email",
  mail: "email",
  mailchimp: "email",
  klaviyo: "email",
  resend: "email",
};

const REFERRER_HOST_RULES: Array<{ match: string[]; source: KnownTrafficSource }> = [
  // Mail hosts first: "mail.google.com" must classify as email, not google
  { match: ["mail.google.", "outlook.", "mail.yahoo."], source: "email" },
  { match: ["google."], source: "google" },
  { match: ["bing.com"], source: "bing" },
  { match: ["facebook.", "fb.com", "m.facebook.", "l.facebook.", "lm.facebook."], source: "facebook" },
  { match: ["instagram.", "l.instagram."], source: "instagram" },
  { match: ["twitter.", "x.com", "t.co"], source: "twitter" },
  { match: ["linkedin.", "lnkd.in"], source: "linkedin" },
  { match: ["youtube.", "youtu.be"], source: "youtube" },
  { match: ["tiktok."], source: "tiktok" },
  { match: ["pinterest."], source: "pinterest" },
];

/**
 * Classify a visit's traffic source from the page's own URL/UTM data and
 * the raw document.referrer. Pure function, unit-tested.
 *
 * Priority: explicit utm_source > referrer host rules > direct/referral.
 */
export function classifyTrafficSource(args: {
  referrer?: string | null;
  utmSource?: string | null;
  /** Host of the tracked page itself, to ignore self-referrals. */
  pageHost?: string | null;
}): KnownTrafficSource {
  const utm = (args.utmSource || "").trim().toLowerCase();
  if (utm) {
    const mapped = UTM_SOURCE_MAP[utm];
    if (mapped) return mapped;
    if ((KNOWN_TRAFFIC_SOURCES as readonly string[]).includes(utm)) {
      return utm as KnownTrafficSource;
    }
    // Unknown but explicit campaign source -> count as referral, not direct
    return "referral";
  }

  const referrer = (args.referrer || "").trim();
  if (!referrer) return "direct";

  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "referral";
  }
  if (!host) return "direct";

  const pageHost = (args.pageHost || "").trim().toLowerCase().replace(/^www\./, "");
  const bareHost = host.replace(/^www\./, "");
  if (pageHost && (bareHost === pageHost || bareHost.endsWith(`.${pageHost}`))) {
    // Internal navigation on the same site is not an acquisition source
    return "direct";
  }

  for (let i = 0; i < REFERRER_HOST_RULES.length; i++) {
    const rule = REFERRER_HOST_RULES[i];
    for (let j = 0; j < rule.match.length; j++) {
      if (host.includes(rule.match[j])) return rule.source;
    }
  }
  return "referral";
}

/** Extract utm_source from a page URL that may contain a query string. */
export function extractUtmSource(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  try {
    const url = new URL(pageUrl, "https://placeholder.local");
    return url.searchParams.get("utm_source");
  } catch {
    return null;
  }
}

/** First hop of x-forwarded-for, or the socket address. */
export function getClientIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) {
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.socket?.remoteAddress || null;
}

function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "localhost") return true;
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^127\./.test(v4) || /^10\./.test(v4) || /^192\.168\./.test(v4)) return true;
  const m = v4.match(/^172\.(\d+)\./);
  if (m) {
    const octet = parseInt(m[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  return /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
}

/**
 * Resolve an IP to an ISO 3166-1 alpha-2 country code. Returns null for
 * private/unresolvable IPs. The IP itself is never persisted.
 */
export async function lookupCountry(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const cleaned = ip.replace(/^::ffff:/i, "").trim();
  if (!cleaned || isPrivateIp(cleaned)) return null;
  try {
    const info = await geoip.lookup(cleaned);
    return info?.country || null;
  } catch (error) {
    console.warn("[Analytics] GeoIP lookup failed:", (error as Error).message);
    return null;
  }
}

// ============================================================
// Date helpers (Europe/Copenhagen)
// ============================================================

const CPH_TZ = "Europe/Copenhagen";

function tzOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    return part ? Number(part.value) : 0;
  };
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUTC - date.getTime();
}

/** YYYY-MM-DD for a date, evaluated in Copenhagen local time. */
export function copenhagenDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CPH_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** UTC instant of Copenhagen local midnight for the day containing `at`. */
export function copenhagenDayStart(at: Date): Date {
  const dayStr = copenhagenDateString(at);
  const [y, m, d] = dayStr.split("-").map(Number);
  // First guess assuming the offset at "at", then correct once for DST edges.
  let start = new Date(Date.UTC(y, m - 1, d) - tzOffsetMs(at, CPH_TZ));
  start = new Date(Date.UTC(y, m - 1, d) - tzOffsetMs(start, CPH_TZ));
  return start;
}

/**
 * UTC instants for [local midnight, next local midnight) of "today" in
 * Copenhagen. DST-aware: the local day is 23h on spring-forward and 25h on
 * fall-back days, so the end is derived from the NEXT day's midnight rather
 * than start + 24h.
 */
export function copenhagenDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = copenhagenDayStart(now);
  // 30h past local midnight is always inside the next local day (which is
  // 23-25h long), so its day start IS the next local midnight.
  const end = copenhagenDayStart(new Date(start.getTime() + 30 * 60 * 60 * 1000));
  return { start, end };
}

/**
 * Fill a sparse day-bucketed series so every day in [start, end] exists,
 * with zeroes where there was no traffic. Buckets are Copenhagen days.
 */
export function fillDailySeries(
  rows: Array<{ date: string; pageViews: number; visitors: number }>,
  startDate: Date,
  endDate: Date
): AnalyticsTimeseriesPoint[] {
  const byDate: Record<string, { pageViews: number; visitors: number }> = {};
  for (let i = 0; i < rows.length; i++) {
    byDate[rows[i].date] = { pageViews: rows[i].pageViews, visitors: rows[i].visitors };
  }
  // Iterate CALENDAR days between the Copenhagen dates of start and end.
  // Using pure UTC date arithmetic on the date components is DST-free;
  // stepping a real timestamp by 24h would skip/duplicate local dates around
  // DST transitions.
  const startStr = copenhagenDateString(startDate);
  const endStr = copenhagenDateString(endDate);
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  let cursor = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);

  const points: AnalyticsTimeseriesPoint[] = [];
  let guard = 0;
  while (cursor <= endUtc && guard < 400) {
    const day = new Date(cursor);
    const dateStr = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, "0")}-${String(day.getUTCDate()).padStart(2, "0")}`;
    points.push({
      date: dateStr,
      pageViews: byDate[dateStr]?.pageViews || 0,
      visitors: byDate[dateStr]?.visitors || 0,
    });
    cursor += 24 * 60 * 60 * 1000;
    guard++;
  }
  return points;
}
