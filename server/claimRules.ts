/**
 * Deterministic invented-claim rules for AI-written copy.
 *
 * The business context (shared/businessContext.ts) says what the customer
 * actually supplied; these rules refuse AI copy whose concrete claims it
 * does not back. Six categories, matched in BOTH Danish and English every
 * time — a Danish site must not get away with an English fake review:
 *
 *   testimonial   quotes with an author, ratings, review counts
 *   qualification education/training claims (autoriseret, cand.psych., certified…)
 *   price         amounts with a currency
 *   statistic     percentages, "9 ud af 10", client counts, years of experience
 *   credential    memberships/approvals (medlem af…, ydernummer, registered with…)
 *   result        treatment outcomes and guarantees (garanteret, symptomfri, cure…)
 *
 * The evidence model: a detected claim is allowed only when its core —
 * the number, the credential keyword, the quoted text — appears in the
 * evidence pool. For mutations the pool is the business context PLUS the
 * copy already on the site, so the AI may move or restyle what already
 * stands (the customer wrote it, or it predates this rule) but cannot add
 * a claim nobody supplied. For whole generated states (onboarding,
 * architect rebuild) the pool is the business context alone, and
 * violations are scrubbed out with a note instead of failing the build.
 *
 * Never calls a model. A prompt asks; this refuses.
 */

import type { BuilderStateData } from "@shared/schema";
import type { PrimitiveNode } from "@shared/customComponents";
import {
  collectBusinessEvidence,
  type BusinessContext,
} from "@shared/businessContext";
import { normalizeSiteLanguage, type SiteLanguage } from "@shared/siteLanguage";

export type ClaimCategory =
  | "testimonial"
  | "qualification"
  | "price"
  | "statistic"
  | "credential"
  | "result"
  | "forbidden";

export type ClaimFinding = {
  category: ClaimCategory;
  /** The offending text, truncated for display. */
  snippet: string;
  /** Full refusal message in the site's language. */
  message: string;
};

/* ─────────── normalisation & evidence pool ─────────── */

/**
 * Normalise text so backing checks survive formatting differences:
 * case, Danish thousand separators (1.000 → 1000), decimal commas
 * (4,8 → 48 on both sides), punctuation and glued units (850kr → 850 kr).
 * %, + and / are kept as standalone tokens because they carry claim
 * meaning (40 %, 10 k +, 24 / 7).
 */
const LOWER_LETTER = "a-z0-9æøåäöüßéèêëáàâãíìîïóòôõúùûýñç";

export function normalizeForEvidence(text: string): string {
  const collapsed = text
    .toLowerCase()
    .replace(/(\d)[.,](?=\d)/g, "$1")
    .replace(/[%+/]/g, " $& ")
    .replace(new RegExp(`[^${LOWER_LETTER}%+/]+`, "g"), " ")
    .replace(new RegExp(`(\\d)([${LOWER_LETTER.replace("0-9", "")}])`, "g"), "$1 $2")
    .replace(new RegExp(`([${LOWER_LETTER.replace("0-9", "")}])(\\d)`, "g"), "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed ? ` ${collapsed} ` : " ";
}

export type EvidencePool = { normalized: string };

export function buildEvidencePool(parts: Array<string | null | undefined>): EvidencePool {
  const normalized = parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map(normalizeForEvidence)
    .join("");
  return { normalized };
}

function backed(pool: EvidencePool, phrase: string): boolean {
  const needle = normalizeForEvidence(phrase).trim();
  if (!needle) return true;
  return pool.normalized.includes(` ${needle} `);
}

/**
 * Generic textual traversal. An allowlist of prop keys drifts the moment a
 * new component shape appears (members[].bio, tabs[].content, comparison
 * rows…), and a drifted allowlist is a hole in the gate — so instead EVERY
 * string is visited except technical values (urls, colours, ids, styling).
 */
// customSchema holds panel field labels ("Overskrift"), not site copy —
// it must neither feed the evidence pool nor get scrubbed.
// `customSchema` (stored) and `schema` (the AI mutation key it arrives
// under) are panel metadata — field labels name what a customer can edit,
// they are not site copy and must not be claim-judged.
const SKIP_SUBTREE_RE = /^(styles?|css|customCss|globalStyles|animations?|motion|transition|easing|svg|customSchema|schema)$/i;
const SKIP_STRING_RE =
  /(id|ids|url|href|src|link|icon|logo|image|img|photo|avatar|color|colour|background|font|family|slug|path|anchor|variant|align|alignment|size|width|height|class|className|target|media|video|audio|poster|embed|format|layout|position|direction|shape|fit|mode|theme|level|tag|key|ref|testid|token|preset|gradient|shadow|radius|spacing|weight)$/i;

/** Values that are markup/links/tokens, not customer-visible prose. */
function isTechnicalString(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  if (/^(https?:\/\/|\/[a-z0-9_\-./]*$|#|mailto:|tel:|data:|blob:)/i.test(v)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return true;
  if (/^\{[^{}]*\}$/.test(v)) return true; // design-token reference
  if (v.startsWith("<svg")) return true;
  if (!/\s/.test(v) && /\.[a-z]{2,4}$/i.test(v)) return true; // bare filename
  return false;
}

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, " ");

function collectTextualDeep(value: any, key: string, out: string[], depth = 0): void {
  if (depth > 16 || value == null) return;
  if (typeof value === "string") {
    if (SKIP_STRING_RE.test(key) || isTechnicalString(value)) return;
    out.push(value.includes("<") ? stripHtml(value) : value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value.slice(0, 300)) collectTextualDeep(v, key, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    // Stat-like entries split the number from its unit ("10" + "K+"): also
    // record the joined form so backing checks see what the visitor sees.
    const v = value as Record<string, any>;
    if (v.value != null && (typeof v.value === "string" || typeof v.value === "number")) {
      const line = `${v.prefix ?? ""}${v.value}${v.suffix ?? ""}`.trim();
      if (line) out.push(line);
    }
    for (const [k, child] of Object.entries(v)) {
      if (SKIP_SUBTREE_RE.test(k)) continue;
      collectTextualDeep(child, k, out, depth + 1);
    }
  }
}

/** Every visible string in a whole builder state (echo evidence for edits). */
export function collectStateCopy(state: BuilderStateData): string[] {
  const out: string[] = [];
  for (const page of state.pages ?? []) {
    if (typeof page.name === "string") out.push(page.name);
    collectTextualDeep((page as Record<string, any>).seo, "seo", out);
    for (const component of page.components ?? []) {
      collectTextualDeep(component.props as Record<string, any>, "props", out);
    }
  }
  const chrome = state.siteChrome as Record<string, any> | undefined;
  collectTextualDeep(chrome?.header?.props, "props", out);
  collectTextualDeep(chrome?.footer?.props, "props", out);
  return out;
}

const statePoolCache = new WeakMap<object, EvidencePool>();

/**
 * Evidence pool for judging a MUTATION against a live site: business
 * context plus everything already on the site. Content that already
 * stands was either written by the customer or predates this rule —
 * moving or restyling it is not inventing it.
 */
export function poolForState(state: BuilderStateData): EvidencePool {
  const cached = statePoolCache.get(state as object);
  if (cached) return cached;
  const pool = buildEvidencePool([
    ...collectBusinessEvidence(state.businessContext),
    ...collectStateCopy(state),
  ]);
  statePoolCache.set(state as object, pool);
  return pool;
}

/* ─────────── detectors (always both languages) ─────────── */

type Detector = {
  category: Exclude<ClaimCategory, "forbidden">;
  re: RegExp;
  /**
   * What must be backed by evidence. Defaults to the whole match.
   * An array means EVERY part must be backed (e.g. both numbers of
   * "9 out of 10" — so a Danish fact "9 ud af 10" backs English copy).
   */
  key?: (m: RegExpMatchArray) => string | string[];
};

const DETECTORS: Detector[] = [
  // ---- price: an amount with a currency, either order ----
  { category: "price", re: /(\d[\d.,]*)\s*(?:kr\.?|kroner|dkk|,-|€|euro|eur|\$|usd|£|gbp)(?![a-zA-ZæøåÆØÅäöüÄÖÜ])/gi, key: (m) => m[1] },
  { category: "price", re: /(?:kr\.?|dkk|€|\$|£)\s*(\d[\d.,]*)/gi, key: (m) => m[1] },

  // ---- statistic: percentages, ratios, counts, experience ----
  { category: "statistic", re: /(\d[\d.,]*)\s*(?:%|procent\b|percent\b)/gi, key: (m) => m[1] },
  { category: "statistic", re: /\b(\d+)\s*(?:ud af|out of)\s*(\d+)/gi, key: (m) => [m[1], m[2]] },
  {
    category: "statistic",
    re: /\b(\d[\d.,]*)\s*\+?\s*(?:klienter|kunder|patienter|deltagere|virksomheder|behandlinger|forløb|clients|customers|patients|companies|businesses|sessions)\b/gi,
    key: (m) => m[1],
  },
  { category: "statistic", re: /\b(\d[\d.,]*)\s*års?\s*erfaring/gi, key: (m) => m[1] },
  { category: "statistic", re: /\b(\d[\d.,]*)\s*years?(?:['’]s)?\s*(?:of\s+)?experience/gi, key: (m) => m[1] },
  { category: "statistic", re: /\b(?:siden|since|est\.?|etableret|established|founded)\s+(19\d{2}|20\d{2})\b/gi, key: (m) => m[1] },

  // ---- testimonial: ratings, review counts, quote + attribution ----
  { category: "testimonial", re: /\b(\d[.,]?\d?)\s*\/\s*5\b/g, key: (m) => `${m[1]} / 5` },
  { category: "testimonial", re: /\b(\d[.,]?\d?)\s*(?:stjerner|stars)\b/gi, key: (m) => m[1] },
  { category: "testimonial", re: /\b(\d[\d.,]*)\s*\+?\s*(?:anmeldelser|vurderinger|udtalelser|reviews|ratings|testimonials)\b/gi, key: (m) => m[1] },
  {
    category: "testimonial",
    re: /["“”„«]([^"“”„«»]{25,240})["“”»]\s*[—–-]\s*[A-ZÆØÅÄÖÜÉ][A-Za-zÆØÅæøåÄÖÜäöüÉé.]*(?:\s+[A-ZÆØÅÄÖÜÉ][A-Za-zÆØÅæøåÄÖÜäöüÉé.]*)*/g,
    key: (m) => m[1],
  },

  // ---- qualification: education/training ----
  { category: "qualification", re: /\bautoriseret\b/gi },
  { category: "qualification", re: /\bcand\.?\s?(?:psych|psyk|pæd|mag|merc)\b\.?/gi },
  { category: "qualification", re: /\bspecialpsykolog\b/gi },
  { category: "qualification", re: /\bspecialist(?:uddann\w*)?\s+i\b/gi },
  { category: "qualification", re: /\bcertificer\w*\b/gi },
  { category: "qualification", re: /\befteruddann\w*\b/gi },
  { category: "qualification", re: /\buddannet\s+(?:fra|på|i|som)\b/gi },
  { category: "qualification", re: /\blicen[sc]ed\b/gi },
  { category: "qualification", re: /\bcertified\b/gi },
  { category: "qualification", re: /\baccredited\b/gi },
  { category: "qualification", re: /\bboard[- ]?certified\b/gi },
  { category: "qualification", re: /\bph\.?d\.?\b/gi },
  { category: "qualification", re: /\bmsc\b|\bm\.sc\.?\b/gi },

  // ---- credential: memberships, approvals, public-scheme status ----
  { category: "credential", re: /\bmedlem\s+af\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bmember\s+of\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bgodkendt\s+af\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bapproved\s+by\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bregistreret\s+(?:hos|ved)\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bregistered\s+with\s+([^,.!?\n]{3,60})/gi, key: (m) => m[1] },
  { category: "credential", re: /\bydernummer\b/gi },
  { category: "credential", re: /\boverenskomst\s+med\b/gi },
  { category: "credential", re: /\bsygesikring\w*\b/gi },
  { category: "credential", re: /\bpsykolognævnet\b/gi },

  // ---- result: outcomes and guarantees ----
  { category: "result", re: /\bgaranter\w*\b/gi },
  { category: "result", re: /\bguarantee[sd]?\b/gi },
  { category: "result", re: /\bdokumenteret\s+effekt\w*\b/gi },
  { category: "result", re: /\b(?:klinisk|videnskabeligt)\s+bevist\b/gi },
  { category: "result", re: /\bevidensbaseret\w*\b/gi },
  { category: "result", re: /\bevidence[- ]based\b/gi },
  { category: "result", re: /\bproven\s+(?:results?|effects?|track\s+record)\b/gi },
  { category: "result", re: /\bkurer\w*\b/gi },
  { category: "result", re: /\bhelbred\w*\b/gi },
  { category: "result", re: /\bcure[sd]?\b/gi },
  { category: "result", re: /\bsymptomfri\b/gi },
  { category: "result", re: /\bsymptom[- ]free\b/gi },
  { category: "result", re: /\b(?:bliver?|blive)\s+rask\b/gi },
  {
    category: "result",
    re: /\b(?:på|efter|within|in|after)\s+(\d+)\s*(?:uger|weeks|sessioner|sessions|samtaler|consultations|måneder|months)\b/gi,
    key: (m) => m[1],
  },
];

/* ─────────── messages ─────────── */

const CATEGORY_LABEL: Record<ClaimCategory, Record<SiteLanguage, string>> = {
  testimonial: { da: "udtalelse/anmeldelse", en: "testimonial/review" },
  qualification: { da: "kvalifikation", en: "qualification" },
  price: { da: "pris", en: "price" },
  statistic: { da: "statistik", en: "statistic" },
  credential: { da: "autorisation/medlemskab", en: "credential/membership" },
  result: { da: "behandlingsresultat/garanti", en: "treatment result/guarantee" },
  forbidden: { da: "forbudt påstand", en: "forbidden claim" },
};

function truncate(text: string, max = 70): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function refusalMessage(category: ClaimCategory, snippet: string, lang: SiteLanguage): string {
  const label = CATEGORY_LABEL[category][lang];
  if (category === "forbidden") {
    return lang === "en"
      ? `The copy uses a forbidden claim: "${snippet}". The customer has marked this claim as one that must never appear on the site.`
      : `Teksten bruger en forbudt påstand: "${snippet}". Kunden har markeret, at denne påstand ikke må bruges på sitet.`;
  }
  return lang === "en"
    ? `Invented ${label}: "${snippet}" is not backed by the customer's business facts. The AI must not make this up. If it is true, add it under Brand → Business facts — otherwise write the copy without it.`
    : `Opdigtet ${label}: "${snippet}" er ikke dækket af kundens forretningsfakta. AI'en må ikke opfinde den slags. Er oplysningen rigtig, så tilføj den under Brand → Forretningsfakta — ellers skal teksten skrives uden.`;
}

function scrubNote(category: ClaimCategory, snippet: string, where: string, lang: SiteLanguage): string {
  const label = CATEGORY_LABEL[category][lang];
  return lang === "en"
    ? `Left out of "${where}" (${label}): "${snippet}" — not something you have supplied. Add it under Brand → Business facts if it belongs on the site.`
    : `Udeladt fra "${where}" (${label}): "${snippet}" — ikke en oplysning du har givet. Tilføj den under Brand → Forretningsfakta, hvis den skal med på sitet.`;
}

/* ─────────── text-level check ─────────── */

export type ClaimCheckOptions = {
  lang: SiteLanguage;
  forbidden?: string[];
};

/** All unbacked claims in one string of copy. */
export function findTextClaims(
  text: string,
  pool: EvidencePool,
  opts: ClaimCheckOptions
): Array<{ category: ClaimCategory; snippet: string }> {
  const found: Array<{ category: ClaimCategory; snippet: string }> = [];
  if (!text || !text.trim()) return found;

  for (const raw of opts.forbidden ?? []) {
    const needle = normalizeForEvidence(raw).trim();
    if (needle.length < 3) continue;
    if (normalizeForEvidence(text).includes(` ${needle} `)) {
      found.push({ category: "forbidden", snippet: truncate(raw) });
    }
  }

  for (const det of DETECTORS) {
    det.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = det.re.exec(text)) !== null) {
      if (m.index === det.re.lastIndex) det.re.lastIndex++; // zero-length guard
      const key = det.key ? det.key(m) : m[0];
      const parts = Array.isArray(key) ? key : [key];
      if (!parts.every((part) => backed(pool, part))) {
        found.push({ category: det.category, snippet: truncate(m[0]) });
      }
    }
  }
  return found;
}

/* ─────────── mutation-level check ─────────── */

/** Resolve the component type a mutation writes to, when determinable. */
function mutationTargetType(mutation: Record<string, any>, state: BuilderStateData): string | undefined {
  if (mutation.component?.type) return mutation.component.type;
  if (mutation.sectionType) return mutation.sectionType;
  if (mutation.componentId && mutation.pageId) {
    const page = state.pages.find((p) => p.id === mutation.pageId);
    return page?.components.find((c) => c.id === mutation.componentId)?.type;
  }
  return undefined;
}

/**
 * Check every string a mutation would write. Component-aware: items on a
 * testimonials section ARE testimonials (quote must be supplied verbatim,
 * not merely assembled from innocent words), and stats/pricing entries are
 * claims by construction.
 */
export function checkMutationClaims(
  mutation: Record<string, any>,
  state: BuilderStateData
): ClaimFinding[] {
  const ctx = state.businessContext;
  const lang = normalizeSiteLanguage(ctx?.language);
  const pool = poolForState(state);
  const opts: ClaimCheckOptions = { lang, forbidden: ctx?.forbiddenClaims };

  const findings: Array<{ category: ClaimCategory; snippet: string }> = [];
  const targetType = mutationTargetType(mutation, state);
  const isTestimonialTarget =
    targetType === "testimonials" ||
    targetType === "social-proof-section" ||
    targetType === "reviews-section";
  const isPricingTarget = targetType === "pricing-table" || targetType === "pricing-section";

  const propsList: Array<Record<string, any> | undefined> = [
    mutation.props,
    mutation.component?.props,
    mutation.section?.props,
    mutation.header?.props,
    mutation.footer?.props,
    // add_section payload: materialized into component props AFTER
    // validation, so it is judged here, before that happens.
    mutation.customContent,
  ];

  // Testimonials: every item is an attributed quote. The quote itself must
  // be backed — a real name plus an invented sentence is still invented.
  if (isTestimonialTarget) {
    for (const props of propsList) {
      if (!Array.isArray(props?.items)) continue;
      for (const item of props!.items) {
        const quote = typeof item?.description === "string" ? item.description : "";
        if (quote.trim() && !backed(pool, quote)) {
          findings.push({ category: "testimonial", snippet: truncate(quote) });
        }
      }
    }
  }

  // Stats entries are statistics by construction ("500+ Glade klienter"
  // hides the number from the sentence-level detectors, so the value is
  // judged directly). Pricing rows the same for digit prices without a
  // currency marker.
  for (const props of propsList) {
    if (Array.isArray(props?.stats)) {
      for (const s of props!.stats) {
        const valueStr = `${s?.prefix ?? ""}${s?.value ?? ""}${s?.suffix ?? ""}`.trim();
        if (/\d/.test(String(s?.value ?? "")) && !backed(pool, valueStr)) {
          findings.push({
            category: "statistic",
            snippet: truncate(`${valueStr} ${s?.label ?? ""}`.trim()),
          });
        }
      }
    }
    if (isPricingTarget && Array.isArray(props?.items)) {
      for (const item of props!.items) {
        const price = typeof item?.price === "string" ? item.price : "";
        if (/\d/.test(price) && !backed(pool, price)) {
          findings.push({
            category: "price",
            snippet: truncate(`${item?.title ? `${item.title}: ` : ""}${price}`),
          });
        }
      }
    }
  }

  const texts: string[] = [];
  for (const props of propsList) collectTextualDeep(props, "props", texts);
  if (mutation.tree) collectTextualDeep(mutation.tree, "tree", texts);
  if (typeof mutation.page?.name === "string") texts.push(mutation.page.name); // add_page
  if (typeof mutation.name === "string" && mutation.action === "update_page") texts.push(mutation.name);
  collectTextualDeep(mutation.seo, "seo", texts); // update_page: published <title>/meta
  if (mutation.action === "update_navigation") collectTextualDeep(mutation.items, "items", texts);

  for (const text of texts) findings.push(...findTextClaims(text, pool, opts));

  const seen = new Set<string>();
  const out: ClaimFinding[] = [];
  for (const f of findings) {
    const dedupeKey = `${f.category}:${f.snippet}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ ...f, message: refusalMessage(f.category, f.snippet, lang) });
  }
  return out;
}

/* ─────────── whole-state scrub (onboarding / architect rebuild) ─────────── */

export type ScrubResult = {
  state: BuilderStateData;
  /** Customer-facing notes in the site's language, capped and deduped. */
  notes: string[];
  removed: number;
};

const MAX_SCRUB_NOTES = 10;

function dropClaimSentences(
  text: string,
  pool: EvidencePool,
  opts: ClaimCheckOptions
): { text: string; dropped: Array<{ category: ClaimCategory; snippet: string }> } {
  const sentences = text.split(/(?<=[.!?…])\s+/);
  const kept: string[] = [];
  const dropped: Array<{ category: ClaimCategory; snippet: string }> = [];
  for (const sentence of sentences) {
    const findings = findTextClaims(sentence, pool, opts);
    if (findings.length === 0) kept.push(sentence);
    else dropped.push(...findings);
  }
  return { text: kept.join(" ").trim(), dropped };
}

type NoteFn = (category: ClaimCategory, snippet: string, where: string) => void;

/** Sentence-level scrub; HTML-aware for rich-text strings. */
function scrubStringValue(
  value: string,
  where: string,
  pool: EvidencePool,
  opts: ClaimCheckOptions,
  note: NoteFn
): string {
  if (value.includes("<")) {
    const parts = value.split(/(<[^>]*>)/g);
    const scrubbedParts = parts.map((part) => {
      if (part.startsWith("<")) return part;
      const { text, dropped } = dropClaimSentences(part, pool, opts);
      for (const d of dropped) note(d.category, d.snippet, where);
      return text;
    });
    const joined = scrubbedParts.join("");
    // A claim can straddle inline tags ("Over <b>2.000</b> klienter") so no
    // single text run contains it. If the stripped whole still claims, the
    // string goes entirely — markup surgery is not worth trusting.
    const residual = findTextClaims(stripHtml(joined), pool, opts);
    if (residual.length > 0) {
      for (const d of residual) note(d.category, d.snippet, where);
      return "";
    }
    return joined;
  }
  const { text, dropped } = dropClaimSentences(value, pool, opts);
  for (const d of dropped) note(d.category, d.snippet, where);
  return text;
}

/** In-place generic scrub of every textual string under a container. */
function scrubDeep(
  container: any,
  key: string,
  where: string,
  pool: EvidencePool,
  opts: ClaimCheckOptions,
  note: NoteFn,
  depth = 0
): void {
  if (depth > 16 || container == null) return;
  if (Array.isArray(container)) {
    for (let i = 0; i < container.length; i++) {
      const v = container[i];
      if (typeof v === "string") {
        if (SKIP_STRING_RE.test(key) || isTechnicalString(v)) continue;
        container[i] = scrubStringValue(v, where, pool, opts, note);
      } else {
        scrubDeep(v, key, where, pool, opts, note, depth + 1);
      }
    }
    // Lists of strings (feature bullets): drop entries the scrub emptied.
    if (container.length > 0 && container.every((v) => typeof v === "string")) {
      for (let i = container.length - 1; i >= 0; i--) {
        if (!(container[i] as string).trim()) container.splice(i, 1);
      }
    }
    return;
  }
  if (typeof container === "object") {
    for (const [k, v] of Object.entries(container)) {
      if (SKIP_SUBTREE_RE.test(k)) continue;
      if (typeof v === "string") {
        if (SKIP_STRING_RE.test(k) || isTechnicalString(v)) continue;
        (container as Record<string, any>)[k] = scrubStringValue(v, where, pool, opts, note);
      } else {
        scrubDeep(v, k, where, pool, opts, note, depth + 1);
      }
    }
  }
}

/**
 * Scrub one component's props against a pool. Returns false when the
 * component lost its reason to exist (all social proof / stats / pricing
 * rows were unbacked) and should be removed entirely.
 */
function scrubComponentWithPool(
  component: { type: string; props?: Record<string, any> },
  where: string,
  pool: EvidencePool,
  opts: ClaimCheckOptions,
  note: NoteFn
): boolean {
  const props = component.props as Record<string, any> | undefined;
  if (!props) return true;

  if (component.type === "testimonials" && Array.isArray(props.items)) {
    const keptItems = props.items.filter((item: any) => {
      const quote = typeof item?.description === "string" ? item.description : "";
      const itemText = [item?.title, item?.role, quote].filter(Boolean).join(" — ");
      if (quote.trim() && !backed(pool, quote)) {
        note("testimonial", truncate(itemText), where);
        return false;
      }
      if (findTextClaims(itemText, pool, opts).length > 0) {
        note("testimonial", truncate(itemText), where);
        return false;
      }
      return true;
    });
    props.items = keptItems;
    if (keptItems.length === 0) return false; // empty social proof: drop the section
  }

  if (component.type === "stats-counter" && Array.isArray(props.stats)) {
    const keptStats = props.stats.filter((s: any) => {
      const line = `${s?.prefix ?? ""}${s?.value ?? ""}${s?.suffix ?? ""} ${s?.label ?? ""}`.trim();
      const hasDigits = /\d/.test(String(s?.value ?? ""));
      if (hasDigits && !backed(pool, `${s?.prefix ?? ""}${s?.value ?? ""}${s?.suffix ?? ""}`)) {
        note("statistic", truncate(line), where);
        return false;
      }
      if (findTextClaims(line, pool, opts).length > 0) {
        note("statistic", truncate(line), where);
        return false;
      }
      return true;
    });
    props.stats = keptStats;
    if (keptStats.length === 0) return false;
  }

  if (component.type === "pricing-table" && Array.isArray(props.items)) {
    const keptItems = props.items.filter((item: any) => {
      const price = typeof item?.price === "string" ? item.price : "";
      if (/\d/.test(price) && !backed(pool, price)) {
        note("price", truncate(`${item?.title ?? ""}: ${price}`), where);
        return false;
      }
      return true;
    });
    props.items = keptItems;
    if (keptItems.length === 0) return false;
  }

  scrubDeep(props, "props", where, pool, opts, note);
  return true;
}

/**
 * Scrub a single machine-materialized component against a LIVE site's pool
 * (business facts + existing copy). Used where add_section expands registry
 * defaults into real components AFTER validation has already run: sample
 * quotes and invented-looking numbers must not ride in on a template.
 * Returns keep=false when the whole component should be dropped.
 */
export function scrubGeneratedComponent<T extends { type: string; props?: Record<string, any> }>(
  component: T,
  state: BuilderStateData
): { component: T; keep: boolean; removed: number } {
  const ctx = state.businessContext;
  const lang = normalizeSiteLanguage(ctx?.language);
  const pool = poolForState(state);
  const opts: ClaimCheckOptions = { lang, forbidden: ctx?.forbiddenClaims };
  const clone = structuredClone(component);
  let removed = 0;
  const keep = scrubComponentWithPool(clone, "", pool, opts, () => {
    removed += 1;
  });
  return { component: clone, keep, removed };
}

/**
 * Remove every unbacked claim from a freshly generated state. Used on the
 * whole-state paths that bypass mutations (onboarding generation, architect
 * rebuild): the build must not fail over an invented sentence, so the
 * sentence goes and a note tells the customer what was left out and how to
 * get it back (supply the fact).
 *
 * Evidence here is the business context ALONE — the state being scrubbed is
 * machine output and must not vouch for itself.
 */
export function scrubStateClaims(
  state: BuilderStateData,
  businessContext?: BusinessContext | null,
  baseline?: BuilderStateData
): ScrubResult {
  const ctx = businessContext ?? state.businessContext;
  const lang = normalizeSiteLanguage(ctx?.language);
  // No baseline: the state is machine output judged against facts alone.
  // With a baseline (final guard on a mutation-path save): copy that stood
  // on the site BEFORE the run is evidence too — legacy and customer-typed
  // content survives, only what the run introduced must be backed. Never
  // pass the state being scrubbed as its own baseline.
  const pool = buildEvidencePool([
    ...collectBusinessEvidence(ctx),
    ...(baseline ? collectStateCopy(baseline) : []),
  ]);
  const opts: ClaimCheckOptions = { lang, forbidden: ctx?.forbiddenClaims };

  const next = structuredClone(state) as BuilderStateData;
  const notes: string[] = [];
  let removed = 0;

  const note: NoteFn = (category, snippet, where) => {
    removed += 1;
    notes.push(scrubNote(category, snippet, where, lang));
  };

  for (const page of next.pages ?? []) {
    const seo = (page as Record<string, any>).seo;
    if (seo) scrubDeep(seo, "seo", page.name, pool, opts, note);
    page.components = (page.components ?? []).filter((component) =>
      scrubComponentWithPool(component as { type: string; props?: Record<string, any> }, page.name, pool, opts, note)
    );
  }
  const chrome = next.siteChrome as Record<string, any> | undefined;
  const chromeName = "header/footer";
  if (chrome?.header) scrubComponentWithPool(chrome.header, chromeName, pool, opts, note);
  if (chrome?.footer) scrubComponentWithPool(chrome.footer, chromeName, pool, opts, note);

  const deduped = Array.from(new Set(notes));
  const capped =
    deduped.length > MAX_SCRUB_NOTES
      ? [
          ...deduped.slice(0, MAX_SCRUB_NOTES),
          lang === "en"
            ? `…and ${deduped.length - MAX_SCRUB_NOTES} more unbacked claims were left out.`
            : `…og ${deduped.length - MAX_SCRUB_NOTES} flere udokumenterede påstande blev udeladt.`,
        ]
      : deduped;

  return { state: next, notes: capped, removed };
}
