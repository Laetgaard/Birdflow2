/**
 * Creating the client's project: a websites row and an empty builder state,
 * in one transaction, owned by the client — never by the admin who clicked.
 *
 * Mirrors the transaction behind POST /api/onboarding/create-website and,
 * like it, does not consult the plan's website limit: the plan was granted
 * a moment ago by the same admin, and the limit is for self-service.
 */

import { sql } from "drizzle-orm";
import { db } from "../storage";
import { websites, builderState } from "@shared/schema";
import type { BuilderStateData } from "@shared/schema";
import { CURRENT_SITE_SCHEMA_VERSION } from "@shared/siteStructure";
import { normalizeSiteLanguage } from "@shared/siteLanguage";

export function slugForCompany(company: string): string {
  const base = company.trim().toLowerCase()
    .replace(/[æ]/g, "ae").replace(/[ø]/g, "oe").replace(/[å]/g, "aa")
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "website";
  return `${base.slice(0, 48)}-${Date.now().toString(36)}`;
}

/** The state a migrated site starts from: one empty home page so the builder never opens on nothing. */
export function initialMigratedState(language: "da" | "en"): BuilderStateData {
  return {
    schemaVersion: CURRENT_SITE_SCHEMA_VERSION,
    pages: [{ id: "home", name: language === "en" ? "Home" : "Forside", path: "/", role: "home", components: [] }],
    activePage: "home",
    globalStyles: {
      primaryColor: "#3b82f6",
      secondaryColor: "#8b5cf6",
      fontFamily: "Inter",
      backgroundColor: "#ffffff",
    } as BuilderStateData["globalStyles"],
    navigation: { items: [] },
  };
}

export async function createMigratedWebsite(input: {
  ownerId: string;
  name: string;
  language: "da" | "en";
}): Promise<{ websiteId: string; slug: string; revision: number }> {
  const language = normalizeSiteLanguage(input.language);
  const slug = slugForCompany(input.name);
  const state = initialMigratedState(language);

  return db.transaction(async (tx) => {
    const [website] = await tx.insert(websites).values({
      ownerId: input.ownerId,
      name: input.name.trim().slice(0, 200),
      slug,
      setupType: "ai",
      status: "draft",
      language,
    }).returning();
    const [row] = await tx.insert(builderState).values({ websiteId: website.id, state }).returning({ revision: builderState.revision });
    await tx.execute(sql`
      INSERT INTO public_stats (id, total_creators, updated_at)
      VALUES (1, 1, NOW())
      ON CONFLICT (id) DO UPDATE SET total_creators = public_stats.total_creators + 1, updated_at = NOW()
    `);
    return { websiteId: website.id, slug, revision: row.revision };
  });
}
