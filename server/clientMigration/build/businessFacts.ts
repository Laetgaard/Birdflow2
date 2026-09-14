/**
 * Seeding the client's business context from their own website.
 *
 * The builder's claim rules refuse any price, testimonial, statistic or
 * credential that the customer has not supplied as a fact. A migrated site
 * is nothing but such claims — the customer's own — so before a single
 * section is placed, every concrete claim on the source page becomes a
 * fact. That satisfies the rules by construction: what the source says is
 * allowed; anything else is still refused.
 */

import type { BuilderStateData } from "@shared/schema";
import { deriveBusinessContext, type BusinessContext } from "@shared/businessContext";
import type { PageExtraction } from "@shared/clientMigration";

export const MAX_BUSINESS_FACTS = 100;
export const FACT_ID_PREFIX = "mig-fact-";

const CLAIM_WORDS = /(certificer|uddann|autoriser|medlem|år|years|erfaring|experience|garanti|guarantee|siden|since|award|pris)/i;

type Fact = NonNullable<BusinessContext["facts"]>[number];

function weight(role: string): number {
  return role === "pricing" ? 3 : role === "testimonials" ? 3 : role === "stats" ? 2 : role === "team" ? 1 : 0;
}

/** Every line on the source pages the claim rules would otherwise refuse, most sensitive first. */
export function collectSourceFacts(extractions: PageExtraction[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (text: string | undefined) => {
    const t = (text ?? "").trim().slice(0, 500);
    if (t.length >= 8 && !seen.has(t)) { seen.add(t); out.push(t); }
  };
  const prioritized = extractions.flatMap((page) => page.sections).sort((a, b) => weight(b.role) - weight(a.role));
  for (const section of prioritized) {
    for (const item of section.items) {
      if (item.price) push(`${item.title ?? ""} ${item.price}`.trim());
      if (item.quote) push(item.quote);
      if (item.personName) push(`${item.personName}${item.role ? ` – ${item.role}` : ""}`);
      if (item.text && (/\d/.test(item.text) || CLAIM_WORDS.test(item.text))) push(item.text);
      if (item.title && /\d/.test(item.title)) { push(item.title); push(`${item.title} ${item.text ?? ""}`.trim()); }
    }
    for (const quote of section.quotes) push(`${quote.text}${quote.cite ? ` – ${quote.cite}` : ""}`);
  }
  for (const section of prioritized) {
    for (const paragraph of [...section.paragraphs, ...section.lists.flat()]) {
      if (/\d/.test(paragraph) || CLAIM_WORDS.test(paragraph)) push(paragraph);
    }
    for (const heading of section.headings) if (/\d/.test(heading.text) || CLAIM_WORDS.test(heading.text)) push(heading.text);
  }
  return out;
}

export function applyBusinessContext(
  state: BuilderStateData,
  args: { businessName: string; language: "da" | "en"; extractions: PageExtraction[]; description?: string; merge?: boolean },
): BuilderStateData {
  const next = structuredClone(state);
  const home = args.extractions[0];
  const footer = home?.chrome.footer;
  const email = footer?.contactText?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = footer?.contactText?.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0];
  const context = deriveBusinessContext({
    businessName: args.businessName,
    description: args.description ?? home?.description,
    language: args.language,
    existing: next.businessContext,
  });
  context.contact = { ...(context.contact ?? {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}) };

  // Facts the customer typed in themselves are never touched. Migration facts
  // are replaced by default (the final pass sees every page) or kept when a
  // single page is being built and the others' facts must survive.
  const kept: Fact[] = (context.facts ?? []).filter((fact) => args.merge || !fact.id.startsWith(FACT_ID_PREFIX));
  const seen = new Set(kept.map((fact) => fact.text));
  const facts: Fact[] = [...kept];
  for (const text of collectSourceFacts(args.extractions)) {
    if (facts.length >= MAX_BUSINESS_FACTS) break;
    if (seen.has(text)) continue;
    seen.add(text);
    facts.push({ id: FACT_ID_PREFIX, text });
  }
  let n = 0;
  context.facts = facts.map((fact) => (fact.id.startsWith(FACT_ID_PREFIX) ? { ...fact, id: `${FACT_ID_PREFIX}${++n}` } : fact));

  const services = args.extractions.flatMap((page) => page.sections.filter((s) => s.role === "services").flatMap((s) => s.items.map((i) => i.title ?? "").filter(Boolean)));
  context.services = Array.from(new Set([...(args.merge ? context.services ?? [] : []), ...services])).slice(0, 20);
  context.updatedAt = new Date().toISOString();
  next.businessContext = context;
  return next;
}
