/**
 * Historical builder-state migrations for publishing.
 *
 * This is intentionally separate from normalize.ts:
 * - migrations understand older BirdFlow state layouts and produce the one
 *   current canonical state shape;
 * - normalization makes canonical component values internally consistent;
 * - validation decides whether the canonical state is safe to publish.
 *
 * The source state is never mutated. Every migration is deterministic and
 * idempotent, so a canonical publish snapshot can safely be reprocessed by a
 * restarted worker without changing customer content.
 */

import type { BuilderComponentData } from "../../shared/componentRegistry";
import type {
  BuilderPage,
  BuilderStateData,
  DesignTokens,
  NavLink,
  SiteChrome,
  SiteNavigation,
} from "../../shared/schema";
import {
  CURRENT_SITE_SCHEMA_VERSION,
  migrateSiteStructure,
} from "../../shared/siteStructure";
import { RENDERABLE_COMPONENT_TYPES } from "../../shared/rendering";

const KNOWN_COMPONENT_TYPES = new Set<string>(RENDERABLE_COMPONENT_TYPES);

/** Known names emitted by earlier versions of the builder. */
export const HISTORICAL_COMPONENT_ALIASES: Record<string, string> = {
  "hero-section": "hero",
  HeroComponent: "hero",
  oldHero: "hero",
  hero_v1: "hero",
  "features-section": "features",
  "header-section": "header",
  siteHeader: "header",
  "footer-section": "footer",
  siteFooter: "footer",
  "old-contact": "contact-form",
  contact: "contact-form",
};

const DEFAULT_GLOBAL_STYLES: DesignTokens = {
  primaryColor: "#4f46e5",
  secondaryColor: "#06b6d4",
  backgroundColor: "#ffffff",
  fontFamily: "Inter, sans-serif",
};

export type CompatibilityBlockerCode =
  | "UNRECOGNIZED_SITE_SCHEMA"
  | "UNSUPPORTED_FUTURE_SCHEMA"
  | "INVALID_HISTORICAL_PAGE"
  | "INVALID_HISTORICAL_COMPONENT"
  | "UNSUPPORTED_HISTORICAL_COMPONENT"
  | "INVALID_HISTORICAL_NAVIGATION";

export type CompatibilityReport = {
  sourceVersion: number;
  targetVersion: number;
  migrationsApplied: string[];
  warnings: string[];
  blockers: CompatibilityBlockerCode[];
};

export type MigratedPublishState = {
  state: BuilderStateData;
  report: CompatibilityReport;
};

/**
 * A safe, customer-facing compatibility failure. The publisher turns this into
 * structured migration failure details instead of letting an old state fall
 * through to a generic generator/Vercel error.
 */
export class PublishCompatibilityError extends Error {
  readonly stage = "migration";

  constructor(
    readonly code: CompatibilityBlockerCode,
    message: string,
    readonly details: {
      sourceVersion?: number;
      pageName?: string;
      componentId?: string;
      componentType?: string;
    } = {},
  ) {
    super(message);
    this.name = "PublishCompatibilityError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function cloneJson<T>(value: T): T {
  // Builder state is persisted as JSONB. structuredClone gives us a hard
  // non-mutation boundary even when this function is called from a worker.
  return structuredClone(value);
}

/**
 * Historical rows predate schemaVersion. They are only treated as a known
 * version when their root layout is recognizable; unknown roots never get
 * guessed into a blank website.
 */
export function detectHistoricalSchemaVersion(state: unknown): number {
  if (!isRecord(state)) return -1;
  if (
    typeof state.schemaVersion === "number" &&
    Number.isInteger(state.schemaVersion) &&
    state.schemaVersion >= 0
  ) {
    return state.schemaVersion;
  }
  if (
    Array.isArray(state.pages) ||
    Array.isArray(state.components) ||
    Array.isArray(state.elements) ||
    Array.isArray(state.sections)
  ) {
    return 0;
  }
  return -1;
}

function canonicalPath(value: unknown, pageIndex: number): string {
  const raw = asNonEmptyString(value);
  if (!raw) return pageIndex === 0 ? "/" : `/page-${pageIndex + 1}`;
  if (raw === "/") return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function canonicalProps(rawProps: unknown): Record<string, unknown> {
  const props = isRecord(rawProps) ? { ...rawProps } : {};

  // Prop changes that genuinely represent the same user-facing data. We retain
  // the old key too, so a migration never throws away a value even if an older
  // custom renderer still needs it.
  if (props.buttonLink === undefined && typeof props.buttonUrl === "string") {
    props.buttonLink = props.buttonUrl;
  }
  if (props.imageUrl === undefined && typeof props.image === "string") {
    props.imageUrl = props.image;
  }
  if (props.items === undefined && Array.isArray(props.plans)) {
    props.items = props.plans;
  }

  return props;
}

function migrateComponent(
  raw: unknown,
  context: { sourceVersion: number; pageName: string; pageId: string; index: number; slot?: "header" | "footer" },
): BuilderComponentData {
  if (!isRecord(raw)) {
    throw new PublishCompatibilityError(
      "INVALID_HISTORICAL_COMPONENT",
      `Siden “${context.pageName}” indeholder en ældre sektion, som ikke kan læses sikkert. Dit nuværende website er ikke blevet ændret.`,
      { sourceVersion: context.sourceVersion, pageName: context.pageName },
    );
  }

  const sourceType = asNonEmptyString(raw.type);
  if (!sourceType) {
    throw new PublishCompatibilityError(
      "INVALID_HISTORICAL_COMPONENT",
      `Siden “${context.pageName}” indeholder en sektion uden type, som ikke kan konverteres sikkert. Dit nuværende website er ikke blevet ændret.`,
      { sourceVersion: context.sourceVersion, pageName: context.pageName },
    );
  }
  const type = HISTORICAL_COMPONENT_ALIASES[sourceType] ?? sourceType;
  const componentId =
    asNonEmptyString(raw.id) ??
    `${context.pageId}-${context.slot ?? "component"}-${context.index + 1}`;

  if (!KNOWN_COMPONENT_TYPES.has(type)) {
    throw new PublishCompatibilityError(
      "UNSUPPORTED_HISTORICAL_COMPONENT",
      `Siden “${context.pageName}” indeholder den ældre sektion “${sourceType}”, som BirdFlow endnu ikke kan konvertere sikkert. Dit nuværende website er stadig online og er ikke blevet ændret.`,
      {
        sourceVersion: context.sourceVersion,
        pageName: context.pageName,
        componentId,
        componentType: sourceType,
      },
    );
  }

  const styles = isRecord(raw.styles)
    ? { ...raw.styles }
    : isRecord(raw.style)
      ? { ...raw.style }
      : {};

  return {
    ...raw,
    id: componentId,
    type,
    props: canonicalProps(raw.props ?? raw.data),
    styles,
  } as BuilderComponentData;
}

function componentsForPage(rawPage: Record<string, unknown>): unknown[] {
  for (const key of ["components", "elements", "sections"]) {
    if (key in rawPage) {
      if (!Array.isArray(rawPage[key])) {
        throw new PublishCompatibilityError(
          "INVALID_HISTORICAL_PAGE",
          "En ældre side har en ugyldig sektionsliste og kan ikke konverteres sikkert. Dit nuværende website er ikke blevet ændret.",
        );
      }
      return rawPage[key] as unknown[];
    }
  }
  return [];
}

function migratePage(raw: unknown, index: number, sourceVersion: number): BuilderPage {
  if (!isRecord(raw)) {
    throw new PublishCompatibilityError(
      "INVALID_HISTORICAL_PAGE",
      "Et ældre website indeholder en side, som ikke kan læses sikkert. Dit nuværende website er ikke blevet ændret.",
      { sourceVersion },
    );
  }
  const id = asNonEmptyString(raw.id) ?? `page-${index + 1}`;
  const name =
    asNonEmptyString(raw.name) ??
    asNonEmptyString(raw.title) ??
    (index === 0 ? "Home" : `Page ${index + 1}`);
  const components = componentsForPage(raw).map((component, componentIndex) =>
    migrateComponent(component, { sourceVersion, pageName: name, pageId: id, index: componentIndex }),
  );

  return {
    ...raw,
    id,
    name,
    path: canonicalPath(raw.path ?? raw.slug, index),
    components,
  } as BuilderPage;
}

function migrateNavigation(raw: Record<string, unknown>): SiteNavigation | undefined {
  const candidate =
    raw.navigation ??
    raw.navItems ??
    raw.menu ??
    (isRecord(raw.globalComponents) ? raw.globalComponents.navigation : undefined);
  const sourceItems = Array.isArray(candidate)
    ? candidate
    : isRecord(candidate) && Array.isArray(candidate.items)
      ? candidate.items
      : undefined;
  if (!sourceItems) return undefined;

  const items: NavLink[] = sourceItems.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new PublishCompatibilityError(
        "INVALID_HISTORICAL_NAVIGATION",
        "En menu på dette ældre website kan ikke konverteres sikkert. Dit nuværende website er ikke blevet ændret.",
      );
    }
    const label =
      asNonEmptyString(entry.label) ??
      asNonEmptyString(entry.title) ??
      asNonEmptyString(entry.name);
    const target =
      asNonEmptyString(entry.target) ??
      asNonEmptyString(entry.href) ??
      asNonEmptyString(entry.url) ??
      asNonEmptyString(entry.path);
    if (!label || !target) {
      throw new PublishCompatibilityError(
        "INVALID_HISTORICAL_NAVIGATION",
        "En menu på dette ældre website mangler tekst eller destination og kan ikke konverteres sikkert. Dit nuværende website er ikke blevet ændret.",
      );
    }
    return {
      id: asNonEmptyString(entry.id) ?? `nav-${index + 1}`,
      label,
      target,
      ...(asNonEmptyString(entry.pageId) ? { pageId: String(entry.pageId) } : {}),
      ...(entry.hidden === true ? { hidden: true } : {}),
    };
  });
  return { items };
}

function migrateChrome(raw: Record<string, unknown>, sourceVersion: number): SiteChrome | undefined {
  const rawChrome = isRecord(raw.siteChrome) ? raw.siteChrome : {};
  const header = rawChrome.header ?? raw.sharedHeader ?? raw.siteHeader ?? raw.header;
  const footer = rawChrome.footer ?? raw.sharedFooter ?? raw.siteFooter ?? raw.footer;
  if (header === undefined && footer === undefined) return undefined;

  const result: SiteChrome = {};
  if (header !== undefined) {
    result.header = migrateComponent(header, {
      sourceVersion,
      pageName: "Delt header",
      pageId: "site-chrome",
      index: 0,
      slot: "header",
    });
  }
  if (footer !== undefined) {
    result.footer = migrateComponent(footer, {
      sourceVersion,
      pageName: "Delt footer",
      pageId: "site-chrome",
      index: 0,
      slot: "footer",
    });
  }
  return result;
}

function migrateGlobalStyles(raw: Record<string, unknown>): DesignTokens {
  const legacyStyles =
    (isRecord(raw.globalStyles) && raw.globalStyles) ||
    (isRecord(raw.theme) && raw.theme) ||
    (isRecord(raw.styles) && raw.styles) ||
    {};
  return { ...DEFAULT_GLOBAL_STYLES, ...legacyStyles } as DesignTokens;
}

/**
 * Converts a recognized historical state into the canonical schema used by the
 * generator. The conversion is in-memory only; callers decide whether and when
 * to persist the returned state.
 */
export function migrateSiteStateToCurrent(source: unknown): MigratedPublishState {
  const sourceVersion = detectHistoricalSchemaVersion(source);
  if (sourceVersion < 0) {
    throw new PublishCompatibilityError(
      "UNRECOGNIZED_SITE_SCHEMA",
      "Denne hjemmeside er lavet i et ukendt ældre BirdFlow-format og kan ikke konverteres sikkert. Dit nuværende website er ikke blevet ændret.",
    );
  }
  if (sourceVersion > CURRENT_SITE_SCHEMA_VERSION) {
    throw new PublishCompatibilityError(
      "UNSUPPORTED_FUTURE_SCHEMA",
      "Denne hjemmeside er lavet i en nyere BirdFlow-version end udgivelsessystemet understøtter. Opdatér BirdFlow og prøv igen.",
      { sourceVersion },
    );
  }

  const raw = cloneJson(source) as Record<string, unknown>;
  const rawPages = Array.isArray(raw.pages)
    ? raw.pages
    : Array.isArray(raw.components)
      ? [{ id: "home", name: "Home", path: "/", components: raw.components }]
      : Array.isArray(raw.elements)
        ? [{ id: "home", name: "Home", path: "/", elements: raw.elements }]
        : Array.isArray(raw.sections)
          ? [{ id: "home", name: "Home", path: "/", sections: raw.sections }]
          : null;
  if (!rawPages) {
    throw new PublishCompatibilityError(
      "UNRECOGNIZED_SITE_SCHEMA",
      "Denne hjemmeside mangler en genkendelig sideliste og kan ikke konverteres sikkert. Dit nuværende website er ikke blevet ændret.",
      { sourceVersion },
    );
  }

  const pages = rawPages.map((page, index) => migratePage(page, index, sourceVersion));
  if (pages.length === 0) {
    throw new PublishCompatibilityError(
      "INVALID_HISTORICAL_PAGE",
      "Denne hjemmeside har ingen sider at udgive. Dit nuværende website er ikke blevet ændret.",
      { sourceVersion },
    );
  }

  // Do not carry superseded root keys into the immutable snapshot. Relevant
  // values have already been migrated below; retaining both representations
  // would make a future reader choose between conflicting sources of truth.
  const {
    components: _legacyComponents,
    elements: _legacyElements,
    sections: _legacySections,
    navItems: _legacyNavItems,
    menu: _legacyMenu,
    theme: _legacyTheme,
    styles: _legacyStyles,
    header: _legacyHeader,
    footer: _legacyFooter,
    sharedHeader: _legacySharedHeader,
    sharedFooter: _legacySharedFooter,
    siteHeader: _legacySiteHeader,
    siteFooter: _legacySiteFooter,
    ...canonicalBase
  } = raw;
  const navigation = migrateNavigation(raw);
  const siteChrome = migrateChrome(raw, sourceVersion);

  const canonical: BuilderStateData = {
    ...(canonicalBase as BuilderStateData),
    schemaVersion: CURRENT_SITE_SCHEMA_VERSION,
    pages,
    activePage:
      pages.find((page) => page.id === raw.activePage)?.id ??
      pages.find((page) => page.path === "/")?.id ??
      pages[0].id,
    globalStyles: migrateGlobalStyles(raw),
    ...(navigation ? { navigation } : {}),
    ...(siteChrome ? { siteChrome } : {}),
  };

  const structured = migrateSiteStructure(canonical);
  const report: CompatibilityReport = {
    sourceVersion,
    targetVersion: CURRENT_SITE_SCHEMA_VERSION,
    migrationsApplied:
      sourceVersion === CURRENT_SITE_SCHEMA_VERSION
        ? []
        : [
            ...(Array.isArray(raw.pages) ? [] : ["root-state-to-pages"]),
            "historical-components-to-canonical",
            "site-structure-to-canonical",
          ],
    warnings: [],
    blockers: [],
  };

  return { state: structured, report };
}