/**
 * The website's structure: which pages exist, in which order, what each one
 * is for, how the visitor navigates between them, and the header and footer
 * they all share.
 *
 * Until now a page was an id, a name, a path and a list of sections.
 * Navigation was not stored anywhere — both renderers derived it from the
 * page list — and the header and footer were ordinary sections copied into
 * every page, so a six-page website held six headers that had to be edited
 * one by one.
 *
 * Everything here is shared on purpose. The builder preview and the
 * published site must agree on the navigation and on where the shared
 * header and footer sit, and the only way to guarantee that is one
 * implementation both of them call. The publisher resolves at generation
 * time (a generated Next.js project cannot import from `@shared`), exactly
 * as it does for design tokens.
 *
 * Migration is value-preserving: a website that has never seen this module
 * comes out of `migrateSiteStructure` looking pixel-for-pixel the same. A
 * page whose header differs from the shared one keeps its own and is opted
 * out, rather than being quietly restyled.
 */

import type { BuilderComponentData } from './componentRegistry';
import type {
  BuilderPage,
  BuilderStateData,
  NavLink,
  PageRole,
  SiteChrome,
  SiteNavigation,
} from './schema';

/** Every role a page can have. Later rules key off these. */
export const PAGE_ROLES: PageRole[] = ['home', 'service', 'legal', 'booking', 'landing', 'draft'];

/** Danish labels for the roles, used by the builder and the AI's tool docs. */
export const PAGE_ROLE_LABELS: Record<PageRole, string> = {
  home: 'Forside',
  service: 'Ydelse',
  legal: 'Juridisk',
  booking: 'Booking',
  landing: 'Landingsside',
  draft: 'Kladde',
};

/** What a renderer needs to draw one navigation link. */
export type NavItem = { id: string; title: string; href: string };

const LEGAL_PATHS = ['/terms', '/privacy', '/cookies', '/handelsbetingelser', '/privatlivspolitik'];
const BOOKING_PATHS = ['/booking', '/book', '/tid', '/bestil'];

/**
 * The role a page has when nobody has said otherwise.
 *
 * Guessed from what the page already is rather than asked for, so an
 * existing website gets sensible roles without anyone touching it. A guess
 * is only ever a default: an explicit role always wins.
 */
export function inferPageRole(page: BuilderPage): PageRole {
  if (page.role) return page.role;
  if (page.path === '/') return 'home';

  const path = page.path.toLowerCase();
  if (LEGAL_PATHS.includes(path)) return 'legal';
  if (BOOKING_PATHS.includes(path)) return 'booking';
  if (page.components?.some((c) => c.type === 'booking')) {
    return 'booking';
  }
  return 'service';
}

/** The role stored on the page, or the guess. */
export function pageRole(page: BuilderPage): PageRole {
  return page.role ?? inferPageRole(page);
}

/* ───────────────────────── navigation ───────────────────────── */

/**
 * The navigation both renderers used to derive on the fly.
 *
 * Kept as the migration's starting point so that storing the navigation
 * changes nothing on screen the day it is turned on.
 */
export function deriveNavigation(pages: BuilderPage[]): SiteNavigation {
  return {
    items: pages
      .filter((page) => !page.hidden)
      .map((page) => ({
        id: `nav-${page.id}`,
        label: page.name,
        target: page.path,
        pageId: page.id,
      })),
  };
}

/**
 * Keep the stored navigation honest about which pages exist.
 *
 * A link that points at a page which has been deleted is dropped, and a
 * newly created visible page gets a link at the end. Labels, order and
 * manually added links (including external ones) are left alone — that is
 * the whole point of storing the navigation instead of deriving it.
 */
export function syncNavigationWithPages(
  navigation: SiteNavigation,
  pages: BuilderPage[]
): SiteNavigation {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const items: NavLink[] = [];

  for (const item of navigation.items) {
    if (!item.pageId) {
      items.push(item);
      continue;
    }
    const page = byId.get(item.pageId);
    if (!page) continue;
    // The page may have been renamed to a new path; the link follows it.
    items.push(item.target === page.path ? item : { ...item, target: page.path });
  }

  const linked = new Set(items.map((item) => item.pageId).filter(Boolean));
  for (const page of pages) {
    if (page.hidden || linked.has(page.id)) continue;
    items.push({ id: `nav-${page.id}`, label: page.name, target: page.path, pageId: page.id });
  }

  return { items };
}

/**
 * The links a header should draw, in order.
 *
 * One function, both renderers: the builder preview calls it while
 * rendering, the publisher calls it while generating. A website with no
 * stored navigation yet falls back to the old derivation, so an
 * un-migrated state still shows the right menu.
 */
export function resolveNavItems(state: {
  navigation?: SiteNavigation;
  pages: BuilderPage[];
}): NavItem[] {
  const navigation = state.navigation ?? deriveNavigation(state.pages);
  return navigation.items
    .filter((item) => !item.hidden)
    .map((item) => ({ id: item.id, title: item.label, href: item.target }));
}

/* ───────────────────────── shared chrome ───────────────────────── */

/** Compare two sections by what they draw, ignoring their ids. */
function sameSection(a: BuilderComponentData, b: BuilderComponentData): boolean {
  return (
    JSON.stringify({ type: a.type, props: a.props, styles: a.styles }) ===
    JSON.stringify({ type: b.type, props: b.props, styles: b.styles })
  );
}

function firstHeader(page: BuilderPage): BuilderComponentData | undefined {
  const first = page.components?.[0];
  return first && first.type === 'header' ? first : undefined;
}

function lastFooter(page: BuilderPage): BuilderComponentData | undefined {
  const last = page.components?.[page.components.length - 1];
  return last && last.type === 'footer' ? last : undefined;
}

/** Does this page draw the site-wide header? */
export function usesSharedHeader(page: BuilderPage, chrome?: SiteChrome): boolean {
  return Boolean(chrome?.header) && page.useSharedHeader !== false;
}

/** Does this page draw the site-wide footer? */
export function usesSharedFooter(page: BuilderPage, chrome?: SiteChrome): boolean {
  return Boolean(chrome?.footer) && page.useSharedFooter !== false;
}

/**
 * What a page actually renders: the shared header, its own sections, the
 * shared footer.
 *
 * Every renderer goes through here. A page that opted out, or a website
 * with no shared chrome, simply gets its own sections back.
 */
export function composePageComponents(
  page: BuilderPage,
  chrome?: SiteChrome
): BuilderComponentData[] {
  const own = page.components ?? [];
  if (!chrome?.header && !chrome?.footer) return own;

  const composed: BuilderComponentData[] = [];
  if (usesSharedHeader(page, chrome) && chrome.header) composed.push(chrome.header);
  composed.push(...own);
  if (usesSharedFooter(page, chrome) && chrome.footer) composed.push(chrome.footer);
  return composed;
}

/** Every section on the website, shared chrome included, for whole-site scans. */
export function allSiteComponents(state: BuilderStateData): BuilderComponentData[] {
  const components = state.pages.flatMap((page) => page.components ?? []);
  if (state.siteChrome?.header) components.push(state.siteChrome.header);
  if (state.siteChrome?.footer) components.push(state.siteChrome.footer);
  return components;
}

/** Is this the shared header or footer rather than a section on a page? */
export function isChromeComponentId(state: BuilderStateData, componentId: string): boolean {
  return (
    state.siteChrome?.header?.id === componentId || state.siteChrome?.footer?.id === componentId
  );
}

/* ───────────────────────── SEO ───────────────────────── */

/**
 * The title and description the published page should carry.
 *
 * A page that has never been given either still gets something honest: the
 * page's own name next to the website's, which beats every page in the
 * search results sharing one title.
 */
export function pageSeo(
  page: BuilderPage,
  siteName: string
): { title: string; description?: string } {
  const explicitTitle = page.seo?.title?.trim();
  const title =
    explicitTitle && explicitTitle.length > 0
      ? explicitTitle
      : page.path === '/'
        ? siteName
        : `${page.name} – ${siteName}`;

  const description = page.seo?.description?.trim();
  return description ? { title, description } : { title };
}

/* ───────────────────────── migration ───────────────────────── */

/**
 * Give an existing website the structure it never had, without changing
 * what a visitor sees.
 *
 * - every page gets a role (guessed from what it already is)
 * - the navigation both renderers derived becomes stored navigation
 * - the header and footer that were copied onto every page become one
 *   shared definition; a page whose copy differed keeps its own and is
 *   marked as opted out, so nothing is restyled behind the customer's back
 *
 * Idempotent, and safe to run on every load: a state that already has this
 * structure comes back unchanged (the same object, so callers can tell).
 */
export function migrateSiteStructure(state: BuilderStateData): BuilderStateData {
  const pages = state.pages ?? [];
  if (pages.length === 0) return state;

  let changed = false;
  let nextPages: BuilderPage[] = pages.map((page) => {
    if (page.role) return page;
    changed = true;
    return { ...page, role: inferPageRole(page) };
  });

  // ---- shared header and footer ----
  let chrome: SiteChrome | undefined = state.siteChrome;
  let justCreatedChrome = false;
  if (!chrome) {
    const home = nextPages.find((page) => page.path === '/') ?? nextPages[0];
    const header = firstHeader(home);
    const footer = lastFooter(home);

    if (header || footer) {
      chrome = {
        ...(header ? { header: structuredClone(header) } : {}),
        ...(footer ? { footer: structuredClone(footer) } : {}),
      };
      changed = true;
      justCreatedChrome = true;
    }
  }

  // Reconcile every page against the shared definition — also on states
  // that already have one. Legal pages and AI-built pages can arrive later
  // carrying their own header/footer copies; without this pass such a page
  // would render the shared header on top of its own. An identical copy is
  // absorbed, a different one opts the page out, and a page that already
  // made its choice (flag set, nothing embedded to reconcile) is left alone.
  if (chrome?.header || chrome?.footer) {
    const header = chrome.header;
    const footer = chrome.footer;
    nextPages = nextPages.map((page) => {
      const optedOutHeader = page.useSharedHeader === false;
      const optedOutFooter = page.useSharedFooter === false;
      const pageHeader = optedOutHeader ? undefined : firstHeader(page);
      const pageFooter = optedOutFooter ? undefined : lastFooter(page);

      // A page keeps its own header when it has one that differs, and only
      // an exact match is absorbed into the shared definition.
      const takesHeader = Boolean(header && pageHeader && sameSection(pageHeader, header));
      const takesFooter = Boolean(footer && pageFooter && sameSection(pageFooter, footer));

      // A page with nothing of its own: on the FIRST migration it is opted
      // out — it never had a header, and handing it the shared one now
      // would visibly change it. Once chrome is established, a bare page is
      // a new page, and inheriting the shared chrome is exactly the point.
      const optOutHeader = Boolean(
        header && !optedOutHeader && !takesHeader && (pageHeader || justCreatedChrome)
      );
      const optOutFooter = Boolean(
        footer && !optedOutFooter && !takesFooter && (pageFooter || justCreatedChrome)
      );

      if (!takesHeader && !takesFooter && !optOutHeader && !optOutFooter) return page;

      changed = true;
      const own = [...(page.components ?? [])];
      if (takesFooter) own.pop();
      if (takesHeader) own.shift();

      return {
        ...page,
        components: own,
        ...(optOutHeader ? { useSharedHeader: false } : {}),
        ...(optOutFooter ? { useSharedFooter: false } : {}),
      };
    });
  }

  // ---- navigation ----
  // Derived from the pages as they are named now, which is exactly what the
  // renderers were computing on every render before this existed.
  let navigation = state.navigation;
  if (!navigation) {
    navigation = deriveNavigation(nextPages);
    changed = true;
  }

  if (!changed) return state;

  return {
    ...state,
    pages: nextPages,
    navigation,
    ...(chrome ? { siteChrome: chrome } : {}),
  };
}

/* ───────────────────────── page order ───────────────────────── */

/**
 * Put the pages in the given order.
 *
 * The array IS the order — there is no separate index to keep in sync, and
 * therefore no way for two pages to claim position three. Ids that are not
 * mentioned keep their relative order at the end, so a partial list cannot
 * lose a page.
 */
export function reorderPages(pages: BuilderPage[], pageIds: string[]): BuilderPage[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const ordered: BuilderPage[] = [];

  for (const id of pageIds) {
    const page = byId.get(id);
    if (page && !ordered.includes(page)) ordered.push(page);
  }
  for (const page of pages) {
    if (!ordered.includes(page)) ordered.push(page);
  }
  return ordered;
}
