import { describe, expect, it } from "vitest";
import { resolveSupabaseDbUrl } from "../server/supabaseDbUrl";

describe("Supabase database URL resolution", () => {
  it("uses the IPv4 session pooler in a Replit development workspace", () => {
    const resolved = new URL(resolveSupabaseDbUrl({
      REPLIT_DEV_DOMAIN: "example.replit.dev",
      SUPABASE_DB_URL: "postgresql://postgres:encoded%21pass@db.projectref.supabase.co:5432/postgres",
    })!);
    expect(resolved.hostname).toBe("aws-1-eu-central-1.pooler.supabase.com");
    expect(decodeURIComponent(resolved.username)).toBe("postgres.projectref");
    expect(decodeURIComponent(resolved.password)).toBe("encoded!pass");
  });

  it("does not rewrite production or an existing pooler URL", () => {
    const production = "postgresql://postgres:pass@db.projectref.supabase.co:5432/postgres";
    const pooler = "postgresql://postgres.projectref:pass@pooler.example.com:5432/postgres";
    expect(resolveSupabaseDbUrl({ SUPABASE_DB_URL: production })).toBe(production);
    expect(resolveSupabaseDbUrl({ REPLIT_DEV_DOMAIN: "example.replit.dev", SUPABASE_DB_URL: pooler })).toBe(pooler);
  });
});