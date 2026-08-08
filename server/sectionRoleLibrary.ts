/**
 * Section-role library.
 *
 * Maps every page role to its recommended section sequence and minimum
 * section count. Used by:
 *  - the plan prompt (embedded table tells the model what to plan per page)
 *  - the build step prompt (section steps know what content depth is required)
 *  - the post-build completeness check (detects thin pages after a build)
 *
 * The sequences follow the AIDA framework: Attention → Interest → Desire →
 * Action. They are recommendations, not hard constraints — the build agent
 * may deviate when the business context calls for something different.
 */

import type { SectionType } from "@shared/sectionRegistry";
import type { PageRole } from "@shared/schema";

/**
 * Ordered section sequence per page role.
 * Designed so the first 5–6 entries form a complete, publishable page;
 * the rest extend it into a rich site.
 */
export const ROLE_SECTION_SEQUENCES: Record<PageRole, SectionType[]> = {
  home: [
    "hero-section",       // Attention: value prop + CTA
    "features-section",   // Interest: what makes this business special (3-6 items)
    "social-proof-section", // Desire: testimonials — ONLY from business facts
    "stats-section",      // Desire: key numbers — ONLY from business facts
    "team-section",       // Trust: who is behind this
    "faq-section",        // Overcome objections (5-8 Q&As)
    "cta-section",        // Action: final push
    "contact-section",    // Action: contact details / form
  ],
  service: [
    "hero-section",
    "services-section",   // What services are offered (3-5 items)
    "features-section",   // Why choose us (benefits, 3-6 items)
    "timeline-section",   // How the process works (3-5 steps)
    "social-proof-section",
    "faq-section",
    "cta-section",
  ],
  booking: [
    "hero-section",
    "services-section",   // Bookable services / treatments / sessions
    "features-section",   // What to expect / benefits
    "social-proof-section",
    "timeline-section",   // Booking process: book → confirm → attend
    "faq-section",
    "contact-section",
  ],
  landing: [
    "hero-section",
    "features-section",
    "social-proof-section",
    "pricing-section",    // Pricing — ONLY with real prices from business facts
    "faq-section",
    "cta-section",
  ],
  legal: [
    "hero-section",
    "features-section",   // Key legal points as readable bullets
  ],
  draft: [
    "hero-section",
    "features-section",
    "cta-section",
  ],
};

/** Minimum sections a page needs before it is considered complete. */
export const ROLE_MIN_SECTIONS: Record<PageRole, number> = {
  home: 6,
  service: 6,
  booking: 6,
  landing: 5,
  legal: 2,
  draft: 3,
};

/** These section types have a primary image slot (hero image or item images). */
export const IMAGE_BEARING_SECTIONS = new Set<SectionType>([
  "hero-section",
  "gallery-section",
  "product-hero-section",
  "reviews-section",
  "team-section",
]);

/**
 * Recommended sections for a given role.
 * Falls back to the home sequence when the role is unknown.
 */
export function recommendedSections(role: string): SectionType[] {
  return (
    ROLE_SECTION_SEQUENCES[role as PageRole] ?? ROLE_SECTION_SEQUENCES.home
  );
}

export function minSectionsForRole(role: string): number {
  return ROLE_MIN_SECTIONS[role as PageRole] ?? 5;
}

export function isPageComplete(role: string, sectionCount: number): boolean {
  return sectionCount >= minSectionsForRole(role);
}

/**
 * Builds the role-to-section reference table that is embedded in the plan
 * and build prompts, so the model sees the recommended sequence for every
 * role at a glance.
 */
export function buildRoleToSectionTable(): string {
  const rows = (
    Object.entries(ROLE_SECTION_SEQUENCES) as [PageRole, SectionType[]][]
  ).map(([role, sections]) => {
    const min = ROLE_MIN_SECTIONS[role];
    return `  ${role.padEnd(10)} (min ${min}): ${sections.join(" → ")}`;
  });
  return rows.join("\n");
}

/**
 * Returns a human-readable description of required content depth for a
 * given section type. Used in build step prompts so the agent knows exactly
 * what fields to fill.
 */
export function sectionContentRequirements(): string {
  return `hero         title (6-10 words, benefit-led), subtitle (15-25 words), description (30-50 words),
               buttonText (specific action verb), buttonLink, imageUrl (ai:// or Unsplash)
  features     title, subtitle, 4-6 items each: id + title (4-6 words) + description (2-3 sentences) + icon
  services     title, subtitle, 3-5 items each: id + title + description + optional price
  social-proof title, 2-3 testimonial items (ONLY from business facts; skip this section if none are supplied)
  stats        title, 4 stats each: id + value + label (ONLY from business facts; skip if none supplied)
  team         title, 2-4 members each: id + title (name) + description (role/bio) + imageUrl (ai://)
  faq          title, 5-8 Q&A pairs: id + title (question) + description (answer, 2-4 sentences)
  cta          title (5-8 punchy words), description (1-2 sentences), buttonText, buttonLink
  contact      title, description, buttonText; add address/phone ONLY from business facts
  timeline     title, subtitle, 4-6 steps each: id + title + description (how-it-works or process)
  pricing      title, subtitle, 3 tiers each: id + title + description + features[] (ONLY real prices)
  gallery      title, description, images[] (ai:// descriptions for each, 3-6 images)`;
}
