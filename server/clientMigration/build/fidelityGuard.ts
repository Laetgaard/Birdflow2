/**
 * The gate every mutation passes on its way into a migrated site.
 *
 * Fidelity means nothing was made up. The guard refuses, before technical
 * validation: any generated or stock image, any image path the job did not
 * import, and any sentence that does not appear in the source page. The
 * refusal names the offending sentence, so the agent corrects itself the
 * way it does for every other validation error. Custom trees also pass the
 * existing responsive guard, so a faithful section still works on a phone.
 */

import type { BuilderMutation } from "@shared/aiBuilderSchema";
import type { AgentContext, GuardVerdict, MutationGuard } from "../../aiAgentTools";
import { buildEvidencePool, normalizeForEvidence, type EvidencePool } from "../../claimRules";
import { guardResponsive } from "../../responsiveGuard";

const FORBIDDEN_IMAGE_RE = /^ai:\/\/|unsplash\.com|images\.unsplash|picsum\.photos|placeholder\.com|via\.placeholder|placehold\.co|pexels\.com|dummyimage/i;
const IMAGE_KEY_RE = /(image|img|src|logo|background|photo|avatar|poster|thumbnail)/i;
const TECHNICAL_KEY_RE = /^(id|ids|type|action|pageId|componentId|href|link|url|target|variant|icon|layout|alignment|align|columns|position|styles?|css|fontFamily|color|colour|.*Color|.*Colour|className|key|nodeId|nodeType|nth|styleKey|keys|itemLabel|itemFields|schema|customSchema|videoProvider|autoPlay|speed|grayscale|highlighted|required|placeholder|period|prefix|suffix|value|year|maxWidth|showCart|imageSide|kind|capability|config)$/;
/**
 * Keys that name or describe a thing for the editor and for screen readers,
 * never text the visitor reads on the page. A component's `name` is required
 * and is written by the agent in its own words; refusing it as invented copy
 * refuses every correct call.
 */
const METADATA_KEY_RE = /^(name|alt|altText|ariaLabel|aria-label|label|tags|category|summary|reason|note)$/;

/** Short UI words ("Læs mere", "Send") need no evidence. */
const MIN_EVIDENCE_LENGTH = 25;

function strings(value: unknown, key: string, depth = 0, out: Array<{ key: string; text: string }> = []): Array<{ key: string; text: string }> {
  if (depth > 12) return out;
  if (typeof value === "string") { out.push({ key, text: value }); return out; }
  if (Array.isArray(value)) { for (const item of value) strings(item, key, depth + 1, out); return out; }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) strings(v, k, depth + 1, out);
  }
  return out;
}

function looksLikeImage(key: string, text: string): boolean {
  if (IMAGE_KEY_RE.test(key)) return /^(https?:\/\/|\/objects\/|data:|ai:\/\/|blob:)/i.test(text) || FORBIDDEN_IMAGE_RE.test(text);
  return /^(https?:\/\/\S+\.(?:jpe?g|png|webp|gif|svg)(?:\?\S*)?|\/objects\/\S+)$/i.test(text) || FORBIDDEN_IMAGE_RE.test(text);
}

function isTechnical(key: string, text: string): boolean {
  if (TECHNICAL_KEY_RE.test(key)) return true;
  const v = text.trim();
  if (!v) return true;
  if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(v)) return true;
  if (/^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/i.test(v) || /^\d+(\.\d+)?(px|%|rem|em|vh|vw)?$/i.test(v)) return true;
  if (/^[a-z0-9_-]+$/i.test(v) && v.length <= 24) return true; // ids, icon names, enums
  return false;
}

/** Split a block of copy into the sentences that each need backing. */
export function sentencesOf(text: string): string[] {
  return text
    .replace(/<[^>]+>/g, " ")
    .split(/(?<=[.!?…])\s+|\n+|\s*[•·|]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_EVIDENCE_LENGTH);
}

export function backedBy(pool: EvidencePool, sentence: string): boolean {
  const needle = normalizeForEvidence(sentence).trim();
  if (!needle) return true;
  if (pool.normalized.includes(` ${needle} `)) return true;
  // A long sentence may be assembled from two source fragments split at a
  // line break; accept when every clause of it is present.
  const clauses = sentence.split(/[,;:–—-]\s+/).map((c) => normalizeForEvidence(c).trim()).filter((c) => c.length >= 12);
  return clauses.length >= 2 && clauses.every((c) => pool.normalized.includes(` ${c} `));
}

export type FidelityGuardOptions = {
  /** Every string the source page (and the site chrome) contains. */
  evidence: string[];
  /** Imported image paths (/objects/…) the mutation may reference. */
  allowedImagePaths: Set<string>;
  label: string;
};

export function makeFidelityGuard(options: FidelityGuardOptions): MutationGuard {
  const pool = buildEvidencePool(options.evidence);
  return (mutation: BuilderMutation, _ctx: AgentContext): GuardVerdict => {
    const notes: string[] = [];
    const m = mutation as unknown as Record<string, unknown>;
    if (m.action === "remove_page" || m.action === "apply_preset" || m.action === "update_global_styles") {
      return { ok: false, reason: "That action is not part of rebuilding a section." };
    }

    for (const { key, text } of strings(mutation, "root")) {
      if (looksLikeImage(key, text)) {
        if (FORBIDDEN_IMAGE_RE.test(text)) {
          return { ok: false, reason: `Billedet "${text.slice(0, 60)}" er ikke fra kundens hjemmeside. Brug kun de importerede billeder (/objects/uploads/…) — eller udelad billedet.` };
        }
        if (/^(https?:\/\/|\/objects\/)/i.test(text) && !options.allowedImagePaths.has(text)) {
          return { ok: false, reason: `Billedet "${text.slice(0, 80)}" er ikke importeret fra kundens hjemmeside. Brug kun de stier, opgaven nævner.` };
        }
        continue;
      }
      if (isTechnical(key, text) || METADATA_KEY_RE.test(key)) continue;
      for (const sentence of sentencesOf(text)) {
        if (!backedBy(pool, sentence)) {
          return { ok: false, reason: `Sætningen "${sentence.slice(0, 90)}" findes ikke på kundens side. Brug kun tekst ordret fra kilden — opfind intet.` };
        }
      }
    }

    const trees: Array<Record<string, any>> = [];
    if (m.tree) trees.push(m.tree as Record<string, any>);
    const props = (m.props ?? (m.component as any)?.props) as Record<string, any> | undefined;
    if (props?.customTree) trees.push(props.customTree);
    for (const tree of trees) {
      const report = guardResponsive(tree as any, options.label);
      notes.push(...report.repairs);
      if (report.blocking.length > 0) {
        return { ok: false, reason: `Layoutet virker ikke på telefon: ${report.blocking.join(" ")} Byg sektionen med fleksible bredder i stedet.` };
      }
    }
    return { ok: true, notes };
  };
}
