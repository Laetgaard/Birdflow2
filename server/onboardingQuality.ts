import { createHash } from "node:crypto";
import type { BuilderComponentData } from "@shared/componentRegistry";
import { componentRegistry } from "@shared/componentRegistry";
import type { PrimitiveNode } from "@shared/generative/nodes";
import type { BuilderStateData } from "@shared/schema";
import type { SiteLanguage } from "@shared/siteLanguage";

export type OnboardingQualityCode =
  | "thin_page"
  | "placeholder_link"
  | "generic_copy"
  | "repeated_image"
  | "wrong_language"
  | "missing_import_fact"
  | "missing_customer_asset"
  | "unknown_component"
  | "empty_component"
  | "empty_custom_component"
  | "publish_parity"
  | "enhancement_failed";

export type OnboardingQualityIssue = {
  code: OnboardingQualityCode;
  message: string;
  pageId?: string;
  componentId?: string;
};

export type OnboardingQualityResult = {
  ready: boolean;
  issues: OnboardingQualityIssue[];
};

/** Identity of the exact visible draft covered by a readiness result. */
export function onboardingStateFingerprint(state: BuilderStateData): string {
  return createHash("sha256")
    .update(JSON.stringify({
      pages: state.pages ?? [],
      siteChrome: state.siteChrome ?? null,
      globalStyles: state.globalStyles ?? {},
      customComponents: state.customComponents ?? [],
      brandGuide: state.brandGuide ?? null,
    }))
    .digest("hex");
}

export function readinessMatchesOnboardingDraft(
  status: Record<string, unknown> | null | undefined,
  builder: { revision: number; state: BuilderStateData } | null | undefined,
  siteRevision: number,
): boolean {
  return (
    status?.readiness === "ready" &&
    typeof status.qualityBuilderRevision === "number" &&
    status.qualityBuilderRevision === builder?.revision &&
    typeof status.qualityFingerprint === "string" &&
    !!builder?.state &&
    status.qualityFingerprint === onboardingStateFingerprint(builder.state) &&
    typeof status.qualitySiteRevision === "number" &&
    status.qualitySiteRevision === siteRevision
  );
}

const COPY_KEYS = new Set([
  "title", "subtitle", "description", "text", "heading", "tagline", "buttonText",
  "secondaryButtonText", "name", "role", "quote", "question", "answer", "content", "label",
]);
const LINK_KEYS = /(?:href|link|url|target|destination)$/i;
const IMAGE_KEYS = /(?:image|photo|logo)(?:url)?$/i;
const GENERIC_COPY = [
  "start gratis prøveperiode",
  "kontakt salg",
  "kom i gang gratis",
  "send message",
  "book now",
  "your business",
  "lorem ipsum",
  "virksomhed 1",
  "ekspertvejledning, der hjælper dig",
  "alt hvad du skal bruge for at bygge",
];

function normalize(value: string): string {
  return value.toLocaleLowerCase("da-DK").replace(/[^a-z0-9æøåäöüéèáàíìóòúù]+/gi, " ").trim();
}

function walk(
  value: unknown,
  visit: (value: string, key: string) => void,
  key = "",
): void {
  if (typeof value === "string") {
    visit(value, key);
  } else if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visit, key));
  } else if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([childKey, child]) =>
      walk(child, visit, childKey)
    );
  }
}

function visibleCopy(component: BuilderComponentData): string[] {
  const strings: string[] = [];
  walk(component.props, (value, key) => {
    if (COPY_KEYS.has(key) && value.trim().length > 1) strings.push(value.trim());
  });
  return strings;
}

function customTreeIsRenderable(node: PrimitiveNode | undefined): boolean {
  if (!node || typeof node !== "object") return false;
  if (node.type === "text") return typeof node.text === "string" && node.text.trim().length > 0;
  if (node.type === "image") return typeof node.src === "string" && node.src.trim().length > 0;
  if (node.type === "button") return typeof node.label === "string" && node.label.trim().length > 0;
  if (node.type === "svg") return !!node.svgAssetId || (typeof node.svg === "string" && node.svg.trim().length > 0);
  if (node.type === "capability") return true;
  return Array.isArray(node.children) && node.children.some(customTreeIsRenderable);
}

const MEDIA_KEY = /(?:image|photo|logo|video|poster|thumbnail|src)(?:url|s)?$/i;

/**
 * Deterministic server-side rendering contract. Layout switches, links, and
 * styling do not make a section substantive: it needs visible copy, media,
 * structured labelled content, or a trusted capability/custom tree.
 */
export function componentHasSubstantiveContent(component: BuilderComponentData): boolean {
  if (component.type === "custom") {
    return customTreeIsRenderable(component.props?.customTree as PrimitiveNode | undefined);
  }
  if (!(component.type in componentRegistry)) return false;
  if (visibleCopy(component).length > 0) return true;
  let hasMedia = false;
  walk(component.props, (value, key) => {
    if (MEDIA_KEY.test(key) && value.trim().length > 0) hasMedia = true;
  });
  return hasMedia;
}

const registryDefaultCopy = new Set<string>();
for (const definition of Object.values(componentRegistry)) {
  walk(definition.defaultProps, (value, key) => {
    const cleaned = normalize(value);
    // Short labels such as "Kontakt" are legitimate. Only distinctive,
    // sentence-like defaults are strong enough evidence of an unedited block.
    if (COPY_KEYS.has(key) && cleaned.length >= 24) registryDefaultCopy.add(cleaned);
  });
}

function containsFact(siteText: string, fact: string): boolean {
  const words = normalize(fact).split(" ").filter((word) => word.length >= 4);
  if (words.length === 0) return true;
  const matches = words.filter((word) => siteText.includes(word)).length;
  return matches / words.length >= 0.6;
}

export function repairOnboardingDefaults(
  input: BuilderStateData,
  language: SiteLanguage,
): BuilderStateData {
  const state = structuredClone(input);
  const contactPath =
    state.pages.find((page) => /contact|kontakt/i.test(`${page.id} ${page.name} ${page.path}`))?.path ?? "/";
  const replacements =
    language === "en"
      ? { send: "Send message", start: "Contact us" }
      : { send: "Send besked", start: "Kontakt os" };

  const mutateStrings = (
    value: unknown,
    mutate: (value: string, key: string) => string,
  ): void => {
    if (Array.isArray(value)) {
      value.forEach((item) => mutateStrings(item, mutate));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (typeof child === "string") {
        (value as Record<string, unknown>)[key] = mutate(child, key);
      } else {
        mutateStrings(child, mutate);
      }
    }
  };

  const repairComponent = (component: BuilderComponentData | undefined) => {
    if (!component) return;
    mutateStrings(component.props, (value, key) => {
      const cleaned = normalize(value);
      if (LINK_KEYS.test(key) && value.trim() === "#") return contactPath;
      if (key === "buttonText" && cleaned === "send message") return replacements.send;
      if (
        key === "buttonText" &&
        ["start gratis prøveperiode", "kontakt salg", "kom i gang gratis", "book now"].includes(cleaned)
      ) {
        return replacements.start;
      }
      return value;
    });
  };
  state.pages.forEach((page) => page.components.forEach(repairComponent));
  repairComponent(state.siteChrome?.header);
  repairComponent(state.siteChrome?.footer);
  return state;
}

export function evaluateOnboardingQuality(
  state: BuilderStateData,
  options: {
    language: SiteLanguage;
    sourceFacts?: string[];
    customerAssetUrls?: string[];
    enhancementFailed?: boolean;
    parityProblems?: string[];
  },
): OnboardingQualityResult {
  const issues: OnboardingQualityIssue[] = [];
  const imageUses = new Map<string, Array<{ pageId: string; componentId: string }>>();
  const siteCopy: string[] = [];
  const knownTypes = new Set(Object.keys(componentRegistry));

  for (const page of state.pages ?? []) {
    const body = page.components.filter(
      (component) =>
        !["header", "footer"].includes(component.type) &&
        componentHasSubstantiveContent(component)
    );
    const pageCopy = body.flatMap(visibleCopy);
    siteCopy.push(...pageCopy);
    if (body.length < 2 || pageCopy.join(" ").length < 100) {
      issues.push({
        code: "thin_page",
        pageId: page.id,
        message: `${page.name} has too little meaningful page content.`,
      });
    }
    for (const component of body) {
      for (const text of visibleCopy(component)) {
        const cleaned = normalize(text);
        if (
          GENERIC_COPY.some((phrase) => cleaned.includes(phrase)) ||
          registryDefaultCopy.has(cleaned)
        ) {
          issues.push({
            code: "generic_copy",
            pageId: page.id,
            componentId: component.id,
            message: `${page.name} still contains generic starter copy: "${text.slice(0, 80)}".`,
          });
          break;
        }
      }
      walk(component.props, (value, key) => {
        if (LINK_KEYS.test(key) && value.trim() === "#") {
          issues.push({
            code: "placeholder_link",
            pageId: page.id,
            componentId: component.id,
            message: `${page.name} contains a placeholder link.`,
          });
        }
        if (IMAGE_KEYS.test(key) && /^https?:\/\/images\.unsplash\.com\//i.test(value)) {
          const canonical = value.split("?")[0];
          const uses = imageUses.get(canonical) ?? [];
          uses.push({ pageId: page.id, componentId: component.id });
          imageUses.set(canonical, uses);
        }
      });
      if (
        options.language === "da" &&
        visibleCopy(component).some((text) => ["send message", "book now"].includes(normalize(text)))
      ) {
        issues.push({
          code: "wrong_language",
          pageId: page.id,
          componentId: component.id,
          message: `${page.name} contains an English default label on a Danish site.`,
        });
      }
    }
    for (const component of page.components) {
      if (!knownTypes.has(component.type) && component.type !== "custom") {
        issues.push({
          code: "unknown_component",
          pageId: page.id,
          componentId: component.id,
          message: `${page.name} contains unsupported component type "${component.type}".`,
        });
      }
      if (
        knownTypes.has(component.type) &&
        component.type !== "custom" &&
        !["header", "footer"].includes(component.type) &&
        !componentHasSubstantiveContent(component)
      ) {
        issues.push({
          code: "empty_component",
          pageId: page.id,
          componentId: component.id,
          message: `${page.name} contains a ${component.type} section with no substantive renderable content.`,
        });
      }
      if (
        component.type === "custom" &&
        !customTreeIsRenderable(component.props?.customTree as PrimitiveNode | undefined)
      ) {
        issues.push({
          code: "empty_custom_component",
          pageId: page.id,
          componentId: component.id,
          message: `${page.name} contains a custom section with no renderable content.`,
        });
      }
    }
  }

  for (const [location, component] of [
    ["header", state.siteChrome?.header],
    ["footer", state.siteChrome?.footer],
  ] as const) {
    if (!component) continue;
    if (!knownTypes.has(component.type) && component.type !== "custom") {
      issues.push({
        code: "unknown_component",
        componentId: component.id,
        message: `The shared ${location} uses unsupported component type "${component.type}".`,
      });
    } else if (component.type === "custom" && !componentHasSubstantiveContent(component)) {
      issues.push({
        code: "empty_custom_component",
        componentId: component.id,
        message: `The shared ${location} has no renderable content.`,
      });
    } else if (!componentHasSubstantiveContent(component)) {
      issues.push({
        code: "empty_component",
        componentId: component.id,
        message: `The shared ${location} has no substantive renderable content.`,
      });
    }
  }

  imageUses.forEach((uses, image) => {
    if (uses.length >= 2) {
      issues.push({
        code: "repeated_image",
        pageId: uses[0].pageId,
        componentId: uses[0].componentId,
        message: `The same stock image is repeated ${uses.length} times (${image}).`,
      });
    }
  });

  const normalizedSite = normalize(siteCopy.join(" "));
  const facts = (options.sourceFacts ?? []).filter((fact) => normalize(fact).length >= 12);
  if (facts.length > 0 && !facts.some((fact) => containsFact(normalizedSite, fact))) {
    issues.push({
      code: "missing_import_fact",
      message: "None of the approved imported facts is represented in the draft.",
    });
  }
  const assets = options.customerAssetUrls ?? [];
  if (assets.length > 0) {
    const serialized = JSON.stringify(state);
    if (!assets.some((asset) => serialized.includes(asset))) {
      issues.push({
        code: "missing_customer_asset",
        message: "Approved customer imagery is not represented in the draft.",
      });
    }
  }
  if (options.enhancementFailed) {
    issues.push({ code: "enhancement_failed", message: "The creative enhancement pass failed." });
  }
  for (const problem of options.parityProblems ?? []) {
    issues.push({ code: "publish_parity", message: problem });
  }

  const unique = issues.filter(
    (issue, index) =>
      issues.findIndex(
        (candidate) =>
          candidate.code === issue.code &&
          candidate.pageId === issue.pageId &&
          candidate.componentId === issue.componentId &&
          candidate.message === issue.message
      ) === index
  );
  return { ready: unique.length === 0, issues: unique };
}