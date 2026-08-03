/**
 * Deterministic copy rules for AI-written text.
 *
 * The system prompt already says "Danish, specific, never placeholder", but
 * a prompt is a request, not a guarantee. These are the checks that run on
 * the actual mutation, before it applies, so a `copywriting` step cannot
 * quietly ship "Lorem ipsum" or "Din tekst her" onto a live psychology
 * practice's front page.
 *
 * Never calls a model. Two severities:
 *  - blocking: the mutation is refused and the error is handed back to the
 *    agent, which gets to write it properly.
 *  - warnings: recorded in the build report, nothing is refused.
 */

import type { BuilderMutation } from "@shared/aiBuilderSchema";
import type { PrimitiveNode } from "@shared/customComponents";

export type CopyReport = { blocking: string[]; warnings: string[] };

/**
 * Placeholder text, in the forms it actually shows up in. Matched
 * case-insensitively against the whole string, not as substrings of real
 * words — "todo" must not fire on "en todo-liste til klienten".
 */
const PLACEHOLDER_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /lorem\s+ipsum/i, label: "lorem ipsum" },
  { re: /\bdin\s+tekst\s+her\b/i, label: '"Din tekst her"' },
  { re: /\bindsæt\s+tekst\b/i, label: '"Indsæt tekst"' },
  { re: /\bskriv\s+din\s+tekst\b/i, label: '"Skriv din tekst"' },
  { re: /\byour\s+text\s+here\b/i, label: '"Your text here"' },
  { re: /\bplaceholder\b/i, label: '"placeholder"' },
  { re: /\bcoming\s+soon\b/i, label: '"Coming soon"' },
  { re: /\blorem\b/i, label: '"Lorem"' },
  { re: /^\s*(todo|tbd|xxx+)\s*[:.!]?\s*$/i, label: "en TODO-markering" },
  { re: /\btekst\s+kommer\b/i, label: '"Tekst kommer"' },
  { re: /\beksempel(tekst|overskrift)\b/i, label: '"Eksempeltekst"' },
];

/** Headings longer than this stop being headings. */
const MAX_HEADING_CHARS = 90;

/** A heading this short is almost always a stub ("Titel", "Om"). */
const MIN_HEADING_CHARS = 3;

/** Prop keys that carry customer-visible copy on a standard section. */
const COPY_PROP_KEYS = [
  "title",
  "subtitle",
  "description",
  "buttonText",
  "secondaryButtonText",
  "eyebrow",
  "label",
] as const;

/** Prop keys that are headings specifically — the length rules apply. */
const HEADING_PROP_KEYS = new Set(["title"]);

function collectFromTree(node: PrimitiveNode | undefined, out: Array<{ key: string; text: string }>): void {
  if (!node || typeof node !== "object") return;
  if (node.type === "text" && typeof node.text === "string") {
    const isHeading = node.tag === "h1" || node.tag === "h2" || node.tag === "h3";
    out.push({ key: isHeading ? "title" : "text", text: node.text });
  }
  if (node.type === "button" && typeof node.label === "string") {
    out.push({ key: "buttonText", text: node.label });
  }
  if (node.type === "image" && typeof node.alt === "string" && node.alt.trim()) {
    out.push({ key: "alt", text: node.alt });
  }
  if (Array.isArray(node.children)) node.children.forEach((child) => collectFromTree(child, out));
}

/** Every customer-visible string a mutation would write. */
export function extractCopy(mutation: BuilderMutation): Array<{ key: string; text: string }> {
  const out: Array<{ key: string; text: string }> = [];
  const m = mutation as unknown as Record<string, any>;

  const readProps = (props: Record<string, any> | undefined) => {
    if (!props || typeof props !== "object") return;
    for (const key of COPY_PROP_KEYS) {
      if (typeof props[key] === "string" && props[key].trim()) {
        out.push({ key, text: props[key] });
      }
    }
    if (Array.isArray(props.items)) {
      for (const item of props.items) {
        if (item && typeof item.title === "string") out.push({ key: "itemTitle", text: item.title });
        if (item && typeof item.description === "string") {
          out.push({ key: "itemDescription", text: item.description });
        }
      }
    }
    if (props.customTree) collectFromTree(props.customTree as PrimitiveNode, out);
  };

  readProps(m.props);
  readProps(m.component?.props);
  readProps(m.section?.props);
  if (m.tree) collectFromTree(m.tree as PrimitiveNode, out);
  if (typeof m.page?.name === "string") out.push({ key: "pageName", text: m.page.name });
  if (typeof m.name === "string" && mutation.action === "update_page") {
    out.push({ key: "pageName", text: m.name });
  }

  return out;
}

/**
 * Check the copy a single mutation writes.
 *
 * `existingHeadings` are the headings already on the target page, so the
 * check can catch a second "Velkommen" being added under the first.
 */
export function checkCopy(
  mutation: BuilderMutation,
  options: { existingHeadings?: string[] } = {}
): CopyReport {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const strings = extractCopy(mutation);

  const seenHeadings = new Set(
    (options.existingHeadings ?? []).map((h) => h.trim().toLowerCase()).filter(Boolean)
  );

  for (const { key, text } of strings) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.re.test(trimmed)) {
        blocking.push(
          `Teksten "${trimmed.slice(0, 60)}" indeholder ${pattern.label}. Skriv rigtig dansk tekst i stedet.`
        );
        break;
      }
    }

    const isHeading = HEADING_PROP_KEYS.has(key);
    if (isHeading) {
      if (trimmed.length < MIN_HEADING_CHARS) {
        blocking.push(`Overskriften "${trimmed}" er for kort til at sige noget. Skriv en rigtig overskrift.`);
      } else if (trimmed.length > MAX_HEADING_CHARS) {
        warnings.push(
          `Overskriften "${trimmed.slice(0, 50)}…" er ${trimmed.length} tegn — den bliver til en tekstblok på mobil.`
        );
      }
      const normalized = trimmed.toLowerCase();
      if (seenHeadings.has(normalized)) {
        warnings.push(`Overskriften "${trimmed}" findes allerede på siden.`);
      }
      seenHeadings.add(normalized);
    }
  }

  return { blocking, warnings };
}

/** The headings already present on a page, for the duplicate check. */
export function pageHeadings(components: Array<{ props?: Record<string, any> }>): string[] {
  const out: string[] = [];
  for (const component of components) {
    const title = component.props?.title;
    if (typeof title === "string" && title.trim()) out.push(title);
  }
  return out;
}
