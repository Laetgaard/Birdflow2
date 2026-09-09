const REPLIT_IPV4_POOLER = "aws-1-eu-central-1.pooler.supabase.com";

/**
 * Replit development containers have no IPv6 route. Supabase direct database
 * hosts are IPv6-only, so use this project's IPv4-capable session pooler in
 * development while preserving the same tenant and password.
 */
export function resolveSupabaseDbUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const raw = env.SUPABASE_DB_URL || env.SUPABASE_DATABASE_URL;
  if (!raw || !env.REPLIT_DEV_DOMAIN) return raw;
  const parsed = new URL(raw);
  const projectRef = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.(?:com|co)$/i)?.[1];
  if (!projectRef) return raw;
  parsed.hostname = REPLIT_IPV4_POOLER;
  parsed.port = "5432";
  parsed.username = `postgres.${projectRef}`;
  return parsed.toString();
}