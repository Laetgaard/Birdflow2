/**
 * The last pass over a migrated site: shared header and footer from the
 * plan, navigation in the source's order, legal pages where the source had
 * none, a snapshot the client can always return to, and the site name.
 */

import { eq } from "drizzle-orm";
import { db, storage } from "../../storage";
import { websites } from "@shared/schema";
import type { BuilderStateData } from "@shared/schema";
import { syncNavigationWithPages, migrateSiteStructure, withBrandLogo } from "@shared/siteStructure";
import { addLegalPagesToBuilderState } from "@shared/legalPages";
import { applyBusinessContext } from "../build/businessFacts";
import { createBuilderSnapshot } from "../../planStore";
import { buildHeaderComponent, buildFooterComponent } from "../plan/sectionMapper";

export { applyBusinessContext };
import type { MigrationAssetRecord, MigrationPlan, PageExtraction } from "@shared/clientMigration";

export function applyChromeAndNavigation(state: BuilderStateData, plan: MigrationPlan, assets: MigrationAssetRecord[]): BuilderStateData {
  const next = structuredClone(state);
  const slugToPath = (slug: string) => (slug ? `/${slug}` : "/");
  const logoPath = plan.chrome.header.logoMediaId ? assets.find((a) => a.mediaId === plan.chrome.header.logoMediaId)?.storagePath : next.brandGuide?.logoUrl;
  const header = buildHeaderComponent({
    // The form's company name is the website's name, not necessarily the
    // word the client puts beside their logo — and when the original showed
    // no word at all, neither does the rebuild.
    brandText: plan.chrome.header.showBrandText === false ? undefined : plan.chrome.header.brandText ?? plan.siteName,
    showBrandText: plan.chrome.header.showBrandText,
    logoPath,
    nav: plan.chrome.header.nav.map((link) => ({ label: link.label, href: slugToPath(link.targetSlug) })),
    cta: plan.chrome.header.cta,
    style: plan.chrome.header.style,
  });
  const footer = buildFooterComponent({
    copyright: plan.chrome.footer.copyright,
    contactText: plan.chrome.footer.contactText,
    columns: plan.chrome.footer.columns,
    social: plan.chrome.footer.social,
  });
  next.siteChrome = { header: withBrandLogo(header as any, next.brandGuide?.logoUrl), footer: footer as any };

  const byPath = new Map(next.pages.map((page) => [page.path, page]));
  const items = plan.chrome.header.nav
    .map((link, index) => {
      const page = byPath.get(slugToPath(link.targetSlug));
      return page ? { id: `mig-navlink-${index}`, label: link.label, target: page.path, pageId: page.id } : null;
    })
    .filter((item): item is NonNullable<typeof item> => !!item);
  // Pages the plan put in navigation but the header did not list.
  for (const pagePlan of plan.pages.filter((p) => p.inNavigation)) {
    const path = slugToPath(pagePlan.targetSlug);
    if (items.some((item) => item.target === path)) continue;
    const page = byPath.get(path);
    if (page) items.push({ id: `mig-navlink-${page.id}`, label: pagePlan.navLabel ?? pagePlan.targetName, target: path, pageId: page.id });
  }
  next.navigation = syncNavigationWithPages({ items }, next.pages);
  // Pages that are not in the navigation stay reachable but hidden from menus.
  for (const page of next.pages) {
    const planned = plan.pages.find((p) => slugToPath(p.targetSlug) === page.path);
    if (planned && !planned.inNavigation && page.role !== "home") {
      const link = next.navigation.items.find((item) => item.pageId === page.id);
      if (link) link.hidden = true;
    }
  }
  return next;
}

export function addLegalPagesIfMissing(state: BuilderStateData, plan: MigrationPlan, language: "da" | "en", businessName: string): BuilderStateData {
  const hasLegal = plan.pages.some((p) => p.role === "legal");
  if (hasLegal) return state;
  const contact = state.businessContext?.contact;
  return addLegalPagesToBuilderState(state, {
    websiteName: businessName,
    companyName: businessName,
    contactEmail: contact?.email ?? "",
    businessAddress: [contact?.streetAddress, contact?.postalCode, contact?.city].filter(Boolean).join(", "),
  }, language);
}

/**
 * What the migration could not bring along, in the words the client reads in
 * their builder. The plan's own notes first, then one line per section that
 * could not be rebuilt — de-duplicated, because a site with forty untouched
 * embeds would otherwise fill the card with the same sentence.
 */
export function migrationNotes(plan: MigrationPlan, language: "da" | "en"): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();
  const push = (line: string) => {
    const text = line.trim().slice(0, 300);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    notes.push(text);
  };
  for (const note of plan.notes) push(note);
  const messages = new Map<string, number>();
  for (const entry of plan.unsupported) messages.set(entry.message, (messages.get(entry.message) ?? 0) + 1);
  for (const [message, count] of Array.from(messages.entries())) {
    const times = language === "da" ? `${count} steder` : `${count} places`;
    push(count > 1 ? `${message} (${times})` : message);
  }
  return notes.slice(0, 20);
}

export async function finalizeMigratedSite(args: {
  websiteId: string;
  state: BuilderStateData;
  expectedRevision: number;
  plan: MigrationPlan;
  assets: MigrationAssetRecord[];
  extractions: PageExtraction[];
  language: "da" | "en";
  sourceHost: string;
  jobId: string;
}): Promise<{ state: BuilderStateData; revision: number; snapshotId: string }> {
  let state = applyChromeAndNavigation(args.state, args.plan, args.assets);
  state = applyBusinessContext(state, { businessName: args.plan.siteName, language: args.language, extractions: args.extractions });
  state = addLegalPagesIfMissing(state, args.plan, args.language, args.plan.siteName);
  state = migrateSiteStructure(state);
  state.activePage = state.pages.find((p) => p.role === "home")?.id ?? state.pages[0]?.id ?? "home";
  // The mark that says "this look was the customer's, copied on purpose".
  // Written before the save so it survives even if the snapshot below fails.
  state.migration = {
    sourceHost: args.sourceHost,
    jobId: args.jobId,
    migratedAt: new Date().toISOString(),
    preserveFidelity: true,
    notes: migrationNotes(args.plan, args.language),
  };

  const saved = await storage.updateBuilderState(args.websiteId, state, args.expectedRevision, { svgAssetOrigin: "customer" } as any);
  if (!saved) throw Object.assign(new Error("builder_conflict"), { code: "builder_conflict" });
  let revision = (saved as any).revision as number;

  await db.update(websites).set({ name: args.plan.siteName.slice(0, 200), updatedAt: new Date() }).where(eq(websites.id, args.websiteId));
  const snapshot = await createBuilderSnapshot({ websiteId: args.websiteId, buildId: 0, label: `Migreret fra ${args.sourceHost}`, content: state, revision });

  // The snapshot's id only exists now, and the client's "back to the rebuild"
  // link needs it. A second write, and a conflict here costs the link, not
  // the migration: the site is already saved and the snapshot already exists.
  state.migration.snapshotId = snapshot.id;
  try {
    const relinked = await storage.updateBuilderState(args.websiteId, state, revision, { svgAssetOrigin: "customer" } as any);
    if (relinked) revision = (relinked as any).revision as number;
  } catch {
    /* the snapshot is still listed under "Gendan" — only the shortcut is lost */
  }
  return { state, revision, snapshotId: snapshot.id };
}
