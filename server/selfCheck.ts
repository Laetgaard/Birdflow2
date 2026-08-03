/**
 * Level A of the three-level self-review: the deterministic layer.
 *
 * Runs after mutations are applied and BEFORE the state is saved. Never
 * calls a model — every check is rule-based, and only SAFE, PROVABLE
 * problems are repaired automatically. Provable problems whose fix would
 * require a judgment call are reported as unrepaired findings instead.
 *
 * Repaired automatically:
 *  1. Internal links that point at pages that don't exist → retargeted to "/".
 *  2. Explicit text/background color pairs below WCAG AA (4.5:1) → text color
 *     nudged to the nearest readable dark/light.
 *  3. Custom-tree responsive hazards (fixed widths > 640px, 3+ column grids,
 *     display fonts ≥ 48px without a mobile override) → mobile overrides added.
 *  4. Colors/fonts that exactly equal a design-token value → rewritten to
 *     reference the token (value-preserving, so nothing looks different —
 *     but a brand change now reaches them).
 *
 * Reported without being touched (deterministic, but not safely fixable):
 *  responsive hazards that cannot be repaired, buttons without a target,
 *  menu items pointing at removed pages, booking pages without a booking
 *  section, motion overuse, performance budgets, SEO completeness, and
 *  accessibility semantics (heading order, alt text, link text).
 *
 * `notes` carries the repair sentences (unchanged behavior — every caller
 * that showed notes before shows exactly the repairs, as before). The full
 * picture, repaired or not, is in `findings`; publish parity and the AI
 * levels are layered on by server/selfReview.ts.
 */

import type { BuilderStateData, BuilderPage } from "@shared/schema";
import type { PrimitiveNode } from "@shared/customComponents";
import type { ReviewFinding, ReviewCategory } from "@shared/selfReview";
import { componentRegistry } from "@shared/componentRegistry";
import { resolveDesignTokens, tokenizeDeep } from "@shared/designTokens";
import { pageRole } from "@shared/siteStructure";
import { guardResponsive } from "./responsiveGuard";

export type SelfCheckResult = {
  state: BuilderStateData;
  /** Danish repair sentences — exactly what was CHANGED automatically. */
  notes: string[];
  /** Everything Level A saw, repaired or not. */
  findings: ReviewFinding[];
};

// ============ WCAG contrast helpers ============

function parseHex(color: string | undefined): [number, number, number] | null {
  if (typeof color !== "string") return null;
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors, or null if not parseable. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const la = luminance(ca);
  const lb = luminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick the readable text color (dark slate or white) for a background. */
export function bestTextColorFor(background: string): string | null {
  const dark = contrastRatio("#1f2937", background);
  const light = contrastRatio("#ffffff", background);
  if (dark == null || light == null) return null;
  return dark >= light ? "#1f2937" : "#ffffff";
}

// ============ Structure helpers ============

function normalizePath(path: string): string {
  let target = path.split("#")[0].split("?")[0];
  if (target.endsWith("/") && target !== "/") target = target.slice(0, -1);
  return target;
}

type AddFinding = (
  category: ReviewCategory,
  message: string,
  repaired: boolean,
  pageName?: string
) => void;

function walkTree(node: PrimitiveNode | undefined, visit: (node: PrimitiveNode) => void): void {
  if (!node || typeof node !== "object") return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkTree(child, visit);
  }
}

function walkStrings(value: unknown, visit: (text: string, key: string) => void, key = ""): void {
  if (typeof value === "string") {
    visit(value, key);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit, key);
    return;
  }
  if (value && typeof value === "object") {
    for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
      walkStrings(child, visit, childKey);
    }
  }
}

// ============ Main check ============

export function runSelfCheck(inputState: BuilderStateData): SelfCheckResult {
  const state = structuredClone(inputState);
  const notes: string[] = [];
  const findings: ReviewFinding[] = [];
  const add: AddFinding = (category, message, repaired, pageName) => {
    findings.push({ level: "A", category, message, repaired, ...(pageName ? { pageName } : {}) });
    if (repaired) notes.push(message);
  };

  const pagePaths = new Set<string>();
  for (const page of state.pages) {
    pagePaths.add(normalizePath(page.path || "/"));
  }

  const isBrokenInternalLink = (href: string): boolean => {
    if (typeof href !== "string" || !href.startsWith("/")) return false;
    if (href.startsWith("/#") || href.startsWith("/objects/")) return false;
    const target = normalizePath(href);
    return target !== "" && !pagePaths.has(target);
  };

  const componentLabel = (type: string): string =>
    (componentRegistry as Record<string, { name?: string } | undefined>)[type]?.name ?? type;

  // The shared header and footer are not on any page, but they are on every
  // page: a broken link or a failed contrast there is the worst kind, so
  // they are checked as if they were one more page.
  const chromeComponents = [state.siteChrome?.header, state.siteChrome?.footer].filter(
    Boolean
  ) as BuilderStateData["pages"][number]["components"];
  const scanTargets: Array<{
    name: string;
    components: typeof chromeComponents;
    page?: BuilderPage;
  }> = [
    ...state.pages.map((page) => ({ name: page.name, components: page.components, page })),
    ...(chromeComponents.length
      ? [{ name: "Delt header og footer", components: chromeComponents }]
      : []),
  ];

  for (const target of scanTargets) {
    for (const component of target.components) {
      const label = `${componentLabel(component.type)} (${target.name})`;
      const props = (component.props ?? {}) as Record<string, any>;

      // 1) Broken internal links on standard button props
      for (const key of ["buttonLink", "secondaryButtonLink"]) {
        const href = props[key];
        if (typeof href === "string" && isBrokenInternalLink(href)) {
          props[key] = "/";
          add(
            "links",
            `Link "${href}" i ${label} pegede på en side der ikke findes — rettet til forsiden.`,
            true,
            target.page?.name
          );
        }
      }

      // 2) WCAG AA contrast on explicit section colors (skip gradient/image
      //    backgrounds — the solid color isn't what text actually sits on)
      const styles = (component.styles ?? {}) as Record<string, string>;
      if (
        styles.backgroundColor &&
        styles.textColor &&
        !styles.backgroundGradient &&
        !styles.backgroundImage
      ) {
        const ratio = contrastRatio(styles.textColor, styles.backgroundColor);
        if (ratio != null && ratio < 4.5) {
          const fixed = bestTextColorFor(styles.backgroundColor);
          if (fixed && fixed.toLowerCase() !== styles.textColor.toLowerCase()) {
            styles.textColor = fixed;
            component.styles = styles as typeof component.styles;
            add(
              "contrast",
              `Tekstfarven i ${label} opfyldte ikke WCAG-kontrast (${ratio.toFixed(1)}:1) — justeret automatisk.`,
              true,
              target.page?.name
            );
          }
        }
      }

      // 3) Custom-tree checks
      const tree = props.customTree as PrimitiveNode | undefined;
      if (component.type === "custom" && tree) {
        checkTree(tree, label, add, isBrokenInternalLink, target.page?.name);
      }
    }
  }

  // 4) Design-token consistency (after contrast, which wants raw literals):
  //    exact matches are re-pointed at the token — value-preserving and
  //    provable, so it is a safe automatic repair.
  checkTokens(state, add);

  // Report-only deterministic coverage.
  checkBindings(state, scanTargets, pagePaths, add);
  checkMotionSafety(state, add);
  checkPerformance(state, add);
  checkSeo(state, add);
  checkA11y(state, componentLabel, add);

  return { state, notes, findings };
}

function checkTree(
  root: PrimitiveNode,
  label: string,
  add: AddFinding,
  isBrokenInternalLink: (href: string) => boolean,
  pageName?: string
): void {
  const walk = (node: PrimitiveNode) => {
    if (!node || typeof node !== "object") return;
    const nodeName = node.name || node.type;
    const styles = (node.styles ?? {}) as Record<string, string>;

    // Broken links on tree buttons
    if (node.type === "button" && typeof node.href === "string" && isBrokenInternalLink(node.href)) {
      add(
        "links",
        `Link "${node.href}" på knappen "${node.label ?? nodeName}" i ${label} pegede på en side der ikke findes — rettet til forsiden.`,
        true,
        pageName
      );
      node.href = "/";
    }

    // Contrast inside the tree (explicit pairs only)
    if (styles.backgroundColor && styles.color && !styles.backgroundImage) {
      const ratio = contrastRatio(styles.color, styles.backgroundColor);
      if (ratio != null && ratio < 4.5) {
        const fixed = bestTextColorFor(styles.backgroundColor);
        if (fixed && fixed.toLowerCase() !== styles.color.toLowerCase()) {
          styles.color = fixed;
          node.styles = styles as PrimitiveNode["styles"];
          add(
            "contrast",
            `Tekstfarven på "${nodeName}" i ${label} opfyldte ikke WCAG-kontrast (${ratio.toFixed(1)}:1) — justeret automatisk.`,
            true,
            pageName
          );
        }
      }
    }

    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(root);

  // Responsive hazards are guardResponsive's job — one implementation,
  // shared with the build orchestrator, which additionally REFUSES the
  // mutations whose hazards cannot be repaired. At save time we take the
  // repairs (refusing here would mean losing work already applied) and
  // REPORT what could not be repaired instead of dropping it silently.
  const responsive = guardResponsive(root, label);
  for (const repair of responsive.repairs) add("responsive", repair, true, pageName);
  for (const hazard of responsive.blocking) add("responsive", hazard, false, pageName);
}

// ============ Design tokens ============

const COLOR_STYLE_KEYS = new Set(["backgroundColor", "textColor", "color"]);
const HEX_LITERAL = /^#[0-9a-fA-F]{3,8}$/;

function checkTokens(state: BuilderStateData, add: AddFinding): void {
  const resolved = resolveDesignTokens(state.globalStyles);

  // Exact matches migrate to references — the same value-preserving rewrite
  // the app applies on load, re-applied here so values written since then
  // follow the brand too.
  const pages = tokenizeDeep(state.pages, resolved);
  const chrome = state.siteChrome ? tokenizeDeep(state.siteChrome, resolved) : state.siteChrome;
  const changed = pages !== state.pages || chrome !== state.siteChrome;
  if (pages !== state.pages) state.pages = pages;
  if (chrome !== state.siteChrome) state.siteChrome = chrome;
  if (changed) {
    add(
      "tokens",
      "Farver og skrifttyper der matcher designsystemet er koblet til det — én brandændring opdaterer dem nu alle.",
      true
    );
  }

  // What remains literal after tokenization is genuinely off-palette. A few
  // are deliberate accents; many is a site quietly drifting off its brand.
  const offPalette = new Set<string>();
  const visitStyles = (styles: Record<string, unknown> | undefined) => {
    if (!styles) return;
    for (const [key, value] of Object.entries(styles)) {
      if (
        COLOR_STYLE_KEYS.has(key) &&
        typeof value === "string" &&
        HEX_LITERAL.test(value.trim())
      ) {
        offPalette.add(value.trim().toLowerCase());
      }
    }
  };
  for (const page of state.pages) {
    for (const component of page.components) {
      visitStyles(component.styles as Record<string, unknown> | undefined);
      const tree = (component.props as Record<string, unknown> | undefined)?.customTree;
      walkTree(tree as PrimitiveNode | undefined, (node) => {
        visitStyles(node.styles as Record<string, unknown> | undefined);
        visitStyles(node.tabletStyles as Record<string, unknown> | undefined);
        visitStyles(node.mobileStyles as Record<string, unknown> | undefined);
      });
    }
  }
  if (offPalette.size > 4) {
    add(
      "tokens",
      `${offPalette.size} forskellige farver uden for designsystemet bruges rundt om på sitet — overvej at samle dem på paletten, så en brandændring når det hele.`,
      false
    );
  }
}

// ============ Functional bindings ============

function checkBindings(
  state: BuilderStateData,
  scanTargets: Array<{ name: string; components: BuilderPage["components"]; page?: BuilderPage }>,
  pagePaths: Set<string>,
  add: AddFinding
): void {
  for (const target of scanTargets) {
    for (const component of target.components) {
      const props = (component.props ?? {}) as Record<string, any>;
      const pairs: Array<[string, string]> = [
        ["buttonText", "buttonLink"],
        ["secondaryButtonText", "secondaryButtonLink"],
      ];
      for (const [textKey, linkKey] of pairs) {
        const text = props[textKey];
        const link = props[linkKey];
        if (
          typeof text === "string" &&
          text.trim().length > 0 &&
          (link === "" || link === "#")
        ) {
          add(
            "bindings",
            `Knappen "${text.trim()}" i ${target.name} har intet mål — den gør ingenting, når man klikker på den.`,
            false,
            target.page?.name
          );
        }
      }
      const tree = props.customTree as PrimitiveNode | undefined;
      walkTree(tree, (node) => {
        if (node.type !== "button") return;
        const label = typeof node.label === "string" ? node.label.trim() : "";
        const href = typeof node.href === "string" ? node.href.trim() : "";
        if (label && (href === "" || href === "#")) {
          add(
            "bindings",
            `Knappen "${label}" i ${target.name} har intet mål — den gør ingenting, når man klikker på den.`,
            false,
            target.page?.name
          );
        }
      });
    }
  }

  // Menu items must land somewhere that exists.
  for (const item of state.navigation?.items ?? []) {
    const record = item as { id: string; label: string; pageId?: string; target?: string };
    if (record.pageId) {
      if (!state.pages.some((p) => p.id === record.pageId)) {
        add(
          "bindings",
          `Menupunktet "${record.label}" peger på en side, der ikke længere findes.`,
          false
        );
      }
    } else if (
      typeof record.target === "string" &&
      record.target.startsWith("/") &&
      !record.target.startsWith("/#") &&
      !pagePaths.has(normalizePath(record.target))
    ) {
      add(
        "bindings",
        `Menupunktet "${record.label}" peger på en side, der ikke længere findes.`,
        false
      );
    }
  }

  // A booking page that cannot take bookings is a broken promise.
  for (const page of state.pages) {
    if (pageRole(page) === "booking" && !page.components.some((c) => c.type === "booking")) {
      add(
        "bindings",
        `Siden "${page.name}" er sat op som bookingside, men har ingen booking-sektion.`,
        false,
        page.name
      );
    }
  }
}

// ============ Motion safety ============

function checkMotionSafety(state: BuilderStateData, add: AddFinding): void {
  for (const page of state.pages) {
    let everyView = 0;
    let playful = 0;
    for (const component of page.components) {
      const styles = (component.styles ?? {}) as Record<string, any>;
      const motion = (styles.motion ?? {}) as Record<string, unknown>;
      if (motion.repeat === "every-view") everyView += 1;
      if (styles.animationType === "bounce" || motion.easing === "spring") playful += 1;
      const tree = (component.props as Record<string, unknown> | undefined)?.customTree;
      walkTree(tree as PrimitiveNode | undefined, (node) => {
        const nodeMotion = (node as { motion?: Record<string, unknown> }).motion;
        if (!nodeMotion) return;
        if (nodeMotion.repeat === "every-view") everyView += 1;
        if (nodeMotion.effect === "bounce" || nodeMotion.easing === "spring") playful += 1;
      });
    }
    if (everyView > 6) {
      add(
        "motion",
        `${everyView} animationer på "${page.name}" afspilles igen ved hvert scroll — det trætter øjnene; overvej "én gang".`,
        false,
        page.name
      );
    }
    if (playful > 3) {
      add(
        "motion",
        `${playful} sektioner på "${page.name}" bruger legende animationer (spring/bounce) — én accent gør mere indtryk end mange.`,
        false,
        page.name
      );
    }
  }
}

// ============ Performance budgets ============

function checkPerformance(state: BuilderStateData, add: AddFinding): void {
  let embeddedImages = 0;
  for (const page of state.pages) {
    if (page.components.length > 14) {
      add(
        "performance",
        `Siden "${page.name}" har ${page.components.length} sektioner — meget lange sider bliver tunge og svære at overskue.`,
        false,
        page.name
      );
    }

    let imageRefs = 0;
    let treeNodes = 0;
    for (const component of page.components) {
      walkStrings(component.props, (text, key) => {
        if (text.startsWith("data:image/")) embeddedImages += 1;
        else if (
          key.toLowerCase().includes("src") ||
          key.toLowerCase().includes("image") ||
          /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(text)
        ) {
          if (text.startsWith("/objects/") || text.startsWith("http") || text.startsWith("data:")) {
            imageRefs += 1;
          }
        }
      });
      const tree = (component.props as Record<string, unknown> | undefined)?.customTree;
      walkTree(tree as PrimitiveNode | undefined, () => {
        treeNodes += 1;
      });
    }
    if (imageRefs > 24) {
      add(
        "performance",
        `Siden "${page.name}" viser ${imageRefs} billeder — over ca. 24 mærkes det tydeligt på indlæsningstiden.`,
        false,
        page.name
      );
    }
    if (treeNodes > 350) {
      add(
        "performance",
        `Egne komponenter på "${page.name}" indeholder ${treeNodes} elementer — så store træer gør både editor og site langsomme.`,
        false,
        page.name
      );
    }
  }
  if (embeddedImages > 0) {
    add(
      "performance",
      `${embeddedImages} billede${embeddedImages === 1 ? "" : "r"} ligger indlejret direkte i sidens data i stedet for i mediebiblioteket — det gør siden tung at indlæse.`,
      false
    );
  }
}

// ============ SEO completeness ============

function checkSeo(state: BuilderStateData, add: AddFinding): void {
  const missingTitle: string[] = [];
  const missingDescription: string[] = [];
  for (const page of state.pages) {
    const seo = page.seo ?? {};
    if (!seo.title?.trim()) missingTitle.push(page.name);
    else if (seo.title.trim().length > 60) {
      add(
        "seo",
        `SEO-titlen på "${page.name}" er ${seo.title.trim().length} tegn — hold den under 60, ellers klipper Google den af.`,
        false,
        page.name
      );
    }
    if (!seo.description?.trim()) missingDescription.push(page.name);
    else if (seo.description.trim().length > 160) {
      add(
        "seo",
        `SEO-beskrivelsen på "${page.name}" er ${seo.description.trim().length} tegn — hold den under 160, ellers klipper Google den af.`,
        false,
        page.name
      );
    }

    // One main heading per page: hero sections render the page's H1 — but
    // only when they actually have a title; a titleless hero is a banner,
    // not a heading — and custom trees can add their own.
    let h1Count = page.components.filter((c) => {
      if (c.type !== "hero") return false;
      const title = (c.props as Record<string, unknown> | undefined)?.title;
      return typeof title === "string" && title.trim() !== "";
    }).length;
    for (const component of page.components) {
      const tree = (component.props as Record<string, unknown> | undefined)?.customTree;
      walkTree(tree as PrimitiveNode | undefined, (node) => {
        if (node.type === "text" && (node as { tag?: string }).tag === "h1") h1Count += 1;
      });
    }
    if (h1Count === 0) {
      add(
        "seo",
        `Siden "${page.name}" har ingen hovedoverskrift (H1) — søgemaskiner bruger den til at forstå, hvad siden handler om.`,
        false,
        page.name
      );
    } else if (h1Count > 1) {
      add(
        "seo",
        `Siden "${page.name}" har ${h1Count} hovedoverskrifter (H1) — én pr. side giver den klareste struktur.`,
        false,
        page.name
      );
    }
  }
  const list = (names: string[]) => names.map((n) => `"${n}"`).join(", ");
  if (missingTitle.length > 0) {
    add(
      "seo",
      `${missingTitle.length} side${missingTitle.length === 1 ? " mangler" : "r mangler"} SEO-titel (vises i Googles søgeresultater): ${list(missingTitle)}.`,
      false
    );
  }
  if (missingDescription.length > 0) {
    add(
      "seo",
      `${missingDescription.length} side${missingDescription.length === 1 ? " mangler" : "r mangler"} SEO-beskrivelse: ${list(missingDescription)}.`,
      false
    );
  }
}

// ============ Accessibility & semantics ============

const GENERIC_LINK_TEXTS = new Set(["klik her", "læs mere", "se mere", "her", "klik", "link"]);

function checkA11y(
  state: BuilderStateData,
  componentLabel: (type: string) => string,
  add: AddFinding
): void {
  let genericLinkTexts = 0;
  for (const page of state.pages) {
    let missingAlt = 0;
    let emptyButtons = 0;
    for (const component of page.components) {
      const props = (component.props ?? {}) as Record<string, any>;
      for (const key of ["buttonText", "secondaryButtonText"]) {
        const text = props[key];
        if (typeof text === "string" && GENERIC_LINK_TEXTS.has(text.trim().toLowerCase())) {
          genericLinkTexts += 1;
        }
      }
      const tree = props.customTree as PrimitiveNode | undefined;
      if (!tree) continue;

      // Heading order: walking the tree in render order, a heading may go at
      // most one level deeper than the deepest seen so far (h2 → h3 is fine,
      // h1 → h3 skips the structure a screen reader navigates by).
      let deepest = 0;
      let flaggedSkip = false;
      walkTree(tree, (node) => {
        if (node.type === "text") {
          const tag = (node as { tag?: string }).tag;
          if (typeof tag === "string" && /^h[1-4]$/.test(tag)) {
            const level = Number(tag.slice(1));
            if (deepest > 0 && level > deepest + 1 && !flaggedSkip) {
              flaggedSkip = true;
              add(
                "a11y",
                `Overskrifterne i ${componentLabel(component.type)} på "${page.name}" springer et niveau over (h${deepest} → h${level}) — skærmlæsere mister strukturen.`,
                false,
                page.name
              );
            }
            deepest = Math.max(deepest, level);
          }
        }
        if (node.type === "image") {
          const alt = (node as { alt?: string }).alt;
          if (!alt?.trim()) missingAlt += 1;
        }
        if (node.type === "button") {
          const label = (node as { label?: string }).label;
          if (typeof label === "string" && GENERIC_LINK_TEXTS.has(label.trim().toLowerCase())) {
            genericLinkTexts += 1;
          }
          if (!label?.trim()) emptyButtons += 1;
        }
      });
    }
    if (missingAlt > 0) {
      add(
        "a11y",
        `${missingAlt} billede${missingAlt === 1 ? "" : "r"} på "${page.name}" mangler alt-tekst — skærmlæsere kan ikke beskrive dem.`,
        false,
        page.name
      );
    }
    if (emptyButtons > 0) {
      add(
        "a11y",
        `${emptyButtons} knap${emptyButtons === 1 ? "" : "per"} på "${page.name}" har ingen tekst — skærmlæsere kan ikke præsentere dem.`,
        false,
        page.name
      );
    }
  }
  if (genericLinkTexts > 0) {
    add(
      "a11y",
      `${genericLinkTexts} knap${genericLinkTexts === 1 ? "" : "per"} bruger tekster som "klik her"/"læs mere", der ikke siger hvor de fører hen — beskrivende tekster hjælper både skærmlæsere og SEO.`,
      false
    );
  }
}
