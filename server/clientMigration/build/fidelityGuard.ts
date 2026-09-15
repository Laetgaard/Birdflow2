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
import { collectReferencedSvgAssetIds } from "@shared/svgAssets";

const FORBIDDEN_IMAGE_RE = /^ai:\/\/|unsplash\.com|images\.unsplash|picsum\.photos|placeholder\.com|via\.placeholder|placehold\.co|pexels\.com|dummyimage/i;
const IMAGE_KEY_RE = /(image|img|src|logo|background|photo|avatar|poster|thumbnail)/i;
const TECHNICAL_KEY_RE = /^(id|ids|type|action|pageId|componentId|href|link|url|target|variant|icon|layout|alignment|align|columns|position|styles?|css|fontFamily|color|colour|.*Color|.*Colour|className|key|nodeId|nodeType|nth|styleKey|keys|itemLabel|itemFields|schema|customSchema|videoProvider|autoPlay|speed|grayscale|highlighted|required|placeholder|period|prefix|suffix|value|year|maxWidth|showCart|imageSide|kind|capability|config|svgColors|viewBox|clipPath|transform|inset|zIndex|backgroundSize|backgroundPosition|backgroundRepeat|shapeId)$/;
/** Markup that can carry words or pictures of its own; a drawing never needs these. */
const SVG_CONTENT_RE = /<(image|text|foreignObject|a)\b/i;
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

/**
 * A CSS image value carries the same path an `src` does, wrapped.
 *
 * `backgroundImage: "url(/objects/uploads/hero.webp)"` is how a box gets a
 * photo behind its words — the one way the agent can rebuild an overlay hero.
 * Read as prose it is a 40-character "sentence" nobody's website ever said,
 * so the guard used to refuse every such rebuild and tell the model its
 * *sentence* was invented. The path is what matters; the wrapper is syntax.
 */
export function imagePathsIn(text: string): string[] {
  const out: string[] = [];
  const re = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push(m[1].trim());
  return out;
}

/** A CSS value that only names colours, gradients, keywords or data URIs. */
function isCssImageValue(key: string, text: string): boolean {
  if (!IMAGE_KEY_RE.test(key) || !/url\(/i.test(text)) return false;
  return true;
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
  // CSS values, not copy: a gradient, a custom property, a keyword. A scrim
  // over a photo is written as one of these and says nothing to a reader.
  if (/^(none|inherit|initial|unset|transparent|currentColor)$/i.test(v)) return true;
  if (/^(linear|radial|conic|repeating-linear|repeating-radial)-gradient\(/i.test(v) || /^var\(--/i.test(v)) return true;
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
  /**
   * Imported svg asset ids the mutation may reference. When given, an
   * `svgAssetId` must be one of these or already drawn somewhere on the
   * site; when absent, ids are not checked.
   */
  allowedSvgAssetIds?: Set<string>;
  label: string;
};

export function makeFidelityGuard(options: FidelityGuardOptions): MutationGuard {
  const pool = buildEvidencePool(options.evidence);
  return (mutation: BuilderMutation, ctx: AgentContext): GuardVerdict => {
    const notes: string[] = [];
    const m = mutation as unknown as Record<string, unknown>;
    if (m.action === "remove_page" || m.action === "apply_preset" || m.action === "update_global_styles") {
      return { ok: false, reason: "That action is not part of rebuilding a section." };
    }

    for (const { key, text } of strings(mutation, "root")) {
      // Stored illustrations are referenced by id: an imported one, or one
      // the site already draws. Inline markup is a drawing, never copy —
      // unless it smuggles words or pictures in through <text> or <image>.
      if (key === "svgAssetId") {
        if (options.allowedSvgAssetIds && !options.allowedSvgAssetIds.has(text) && !collectReferencedSvgAssetIds(ctx.state as Parameters<typeof collectReferencedSvgAssetIds>[0]).has(text)) {
          return { ok: false, reason: `Illustrationen "${text.slice(0, 40)}" er ikke importeret fra kundens hjemmeside. Brug kun de svg-id'er, opgaven nævner — eller tegn formen selv med generate_svg_shape.` };
        }
        continue;
      }
      if (key === "svg") {
        if (SVG_CONTENT_RE.test(text)) {
          return { ok: false, reason: "SVG-markup må kun tegne former: <image>, <text>, <a> og <foreignObject> er ikke tilladt. Brug tekst-noder til ord og billed-noder til fotos." };
        }
        continue;
      }
      // A background written as CSS: check the paths inside it, then move on.
      // `none` and a pure gradient carry no path and are simply styling.
      if (isCssImageValue(key, text)) {
        for (const path of imagePathsIn(text)) {
          if (FORBIDDEN_IMAGE_RE.test(path)) {
            return { ok: false, reason: `Billedet "${path.slice(0, 60)}" er ikke fra kundens hjemmeside. Brug kun de importerede billeder (/objects/uploads/…) — eller udelad billedet.` };
          }
          if (/^(https?:\/\/|\/objects\/)/i.test(path) && !options.allowedImagePaths.has(path)) {
            return { ok: false, reason: `Billedet "${path.slice(0, 80)}" er ikke importeret fra kundens hjemmeside. Brug kun de stier, opgaven nævner.` };
          }
        }
        continue;
      }
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
