/**
 * The three-level self-review, shared between server and client.
 *
 * Three kinds of finding deserve three different responses:
 *
 *   Level A — deterministic repair. Provable problems. Safe ones are fixed
 *             automatically; provable-but-not-safely-fixable ones are
 *             reported without being touched.
 *   Level B — AI design review. Subjective recommendations (information
 *             architecture, content quality, brand consistency). Reported,
 *             never applied on their own.
 *   Level C — approved redesign. Broad changes that need the customer to
 *             say yes first. Approving one sends its instruction through
 *             the NORMAL build flow with all its gates — nothing here
 *             applies anything.
 *
 * Publish parity is Level A: whether the generated (published) renderer can
 * reproduce the approved preview is deterministic and provable, so a build
 * must never be reported clean while it fails.
 *
 * This file is imported by both the server (which produces a SelfReview)
 * and the client (which displays one), so it holds types, grouping and the
 * page-role protections — no server-only dependencies.
 */

import type { BuilderStateData, PageRole } from './schema';
import { pageRole } from './siteStructure';

/* ───────────────────────── findings ───────────────────────── */

export type ReviewLevel = 'A' | 'B' | 'C';

export const REVIEW_CATEGORIES = [
  // Level A (deterministic)
  'links',
  'contrast',
  'responsive',
  'tokens',
  'bindings',
  'motion',
  'performance',
  'seo',
  'a11y',
  'parity',
  // Level B (AI review)
  'ia',
  'content',
  'brand',
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

export type ReviewFinding = {
  level: ReviewLevel;
  category: ReviewCategory;
  /** Danish, customer-facing, one sentence. */
  message: string;
  /**
   * True when the problem was repaired in the returned state. Only a Level A
   * finding can ever be repaired — B and C never apply anything.
   */
  repaired: boolean;
  /** The page the finding concerns, when it concerns one page. */
  pageName?: string;
};

/* ───────────────────────── publish parity ───────────────────────── */

export type ParityStatus =
  /** The generated renderer compiled and reproduced every page's content. */
  | 'passed'
  /** Provable divergence — the published site would not match the preview. */
  | 'failed'
  /**
   * The check itself could not run (e.g. the compiler is not installed in
   * this environment). Reported so nobody mistakes "not checked" for
   * "checked and fine" — but it does not block, because it proves nothing
   * about the site.
   */
  | 'unavailable';

export type ParityResult = { status: ParityStatus; problems: string[] };

/* ───────────────────────── Level C proposals ───────────────────────── */

export type ReviewProposal = {
  id: string;
  /** Danish headline, e.g. "Saml de tre korte sider til én". */
  title: string;
  /** Danish explanation of what would change and why. */
  detail: string;
  /**
   * The Danish instruction the customer can approve. Approval hands this to
   * the ordinary assistant flow — plan gates, large-change approval and
   * claim rules all still apply. The review never executes it.
   */
  instruction: string;
};

/* ───────────────────────── the review ───────────────────────── */

export type SelfReview = {
  findings: ReviewFinding[];
  parity: ParityResult;
  proposals: ReviewProposal[];
  /** Whether the Level B AI pass ran; when it did not, the Danish reason. */
  ai: { ran: boolean; skippedReason?: string };
};

/* ───────────────────────── display grouping ───────────────────────── */

/**
 * The one Danish report the customer reads, in the order they should read
 * it: what blocks publishing, what was fixed, what is recommended, what
 * waits for their approval.
 */
export type ReviewGroups = {
  /** Publish-parity problems — the build must not be presented as clean. */
  blocking: string[];
  /** Level A findings that were repaired automatically. */
  fixed: string[];
  /** Level A findings that are provable but not safely fixable, plus Level B. */
  recommended: string[];
  /** Level C — waits for explicit approval. */
  needsApproval: ReviewProposal[];
};

export const REVIEW_GROUP_LABELS = {
  blocking: 'Forskel mellem forhåndsvisning og udgivet side',
  fixed: 'Rettet automatisk',
  recommended: 'Anbefalinger',
  needsApproval: 'Kræver din godkendelse',
} as const;

function dedupe(lines: string[]): string[] {
  return Array.from(new Set(lines));
}

export function groupReview(review: SelfReview): ReviewGroups {
  const fixed: string[] = [];
  const recommended: string[] = [];

  for (const finding of review.findings) {
    if (finding.level === 'A' && finding.repaired) fixed.push(finding.message);
    else recommended.push(finding.message);
  }

  const blocking =
    review.parity.status === 'failed' ? dedupe(review.parity.problems) : [];
  if (review.parity.status === 'unavailable') {
    recommended.push(
      review.parity.problems[0] ??
        'Udgivelsestjekket kunne ikke gennemføres i dette miljø.'
    );
  }
  if (!review.ai.ran && review.ai.skippedReason) {
    recommended.push(`AI-gennemgangen blev sprunget over: ${review.ai.skippedReason}`);
  }

  return {
    blocking,
    fixed: dedupe(fixed),
    recommended: dedupe(recommended),
    needsApproval: review.proposals,
  };
}

/** An empty review — what older persisted results deserialize into. */
export function emptySelfReview(): SelfReview {
  return {
    findings: [],
    parity: { status: 'passed', problems: [] },
    proposals: [],
    ai: { ran: false },
  };
}

/* ───────────────────────── page-role protections ───────────────────────── */

/**
 * Pages a broad content pass must not rewrite. Legal pages carry wording
 * with legal weight, booking pages carry working machinery, and draft pages
 * are unfinished by definition — reviewing their prose is reviewing a
 * half-written sentence.
 */
export const PROTECTED_PAGE_ROLES: readonly PageRole[] = ['legal', 'booking', 'draft'];

export type ProtectedPage = { name: string; path: string; role: PageRole };

export function protectedPages(state: BuilderStateData): ProtectedPage[] {
  return (state.pages ?? [])
    .map((page) => ({ name: page.name, path: page.path ?? '', role: pageRole(page) }))
    .filter((page) => PROTECTED_PAGE_ROLES.includes(page.role));
}

const norm = (name: string) => name.trim().toLowerCase();

/**
 * Enforce the role protections on review items — deterministically, not by
 * trusting the prompt. Items that target a protected page (by `pageName`,
 * or by naming one in their text for proposals) are dropped and reported.
 */
export function dropProtectedPageItems<T extends { pageName?: string }>(
  items: T[],
  protectedList: ProtectedPage[],
  /** Extra texts to scan for page-name mentions (used for proposals). */
  textOf?: (item: T) => string
): { kept: T[]; droppedNotes: string[] } {
  if (protectedList.length === 0) return { kept: items, droppedNotes: [] };
  // A page is referenced by its name OR its path — a proposal saying
  // "opdater /privatlivspolitik" targets the legal page as surely as one
  // naming it. Tokens under 3 characters (like the path "/") would match
  // far too much ordinary prose to mean anything.
  const entries = protectedList.map((page) => ({
    page,
    nameKey: norm(page.name),
    tokens: [norm(page.name), norm(page.path)].filter((t) => t.length >= 3),
  }));

  const kept: T[] = [];
  const droppedNotes: string[] = [];
  for (const item of items) {
    let hit: ProtectedPage | undefined;
    if (item.pageName) {
      const key = norm(item.pageName);
      hit = entries.find((e) => e.nameKey === key)?.page;
    }
    if (!hit && textOf) {
      const text = norm(textOf(item));
      hit = entries.find((e) => e.tokens.some((t) => text.includes(t)))?.page;
    }
    if (hit) {
      const label =
        hit.role === 'legal' ? 'juridisk side' : hit.role === 'booking' ? 'bookingside' : 'kladde';
      droppedNotes.push(
        `Et forslag om "${hit.name}" blev udeladt — siden er beskyttet (${label}).`
      );
    } else {
      kept.push(item);
    }
  }
  return { kept, droppedNotes };
}
