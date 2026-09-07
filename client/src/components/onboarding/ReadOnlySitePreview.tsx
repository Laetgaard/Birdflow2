import { useEffect, useMemo, useState } from "react";
import type { BuilderComponentData } from "@shared/componentRegistry";
import type { DesignTokens, SiteChrome } from "@shared/schema";
import { composePageComponents, type NavItem } from "@shared/siteStructure";
import ComponentRenderer from "@/components/builder/ComponentRenderer";
import { BuilderSelectionProvider } from "@/contexts/BuilderSelectionContext";
import { topLevelComponents } from "@shared/rendering/contract";

/* ─────────────────────────────────────────────────────────────
   The customer's real website, rendered read-only.

   It goes through the SAME renderer the builder canvas uses -
   same component registry, same custom components, same global
   styles - so what they see is what was actually built. What it
   does NOT pass is every editing affordance: no selection, no
   hover outlines, no inline text editing, no drag handles, no
   insert points and no element overlay.
   ───────────────────────────────────────────────────────────── */

export type PreviewPage = {
  id: string;
  name: string;
  path: string;
  hidden?: boolean;
  /** Explicit false means this page draws its own header/footer. */
  useSharedHeader?: boolean;
  useSharedFooter?: boolean;
  components: BuilderComponentData[];
};

export const PREVIEW_WIDTHS = {
  desktop: 1200,
  /** A real phone width - the mobile view is not a scaled-down desktop. */
  mobile: 390,
} as const;

export type PreviewDevice = keyof typeof PREVIEW_WIDTHS;

/** Load the fonts the site was designed with, so the preview is truthful. */
export function useGoogleFonts(fonts: Array<string | undefined>): void {
  const key = fonts.filter(Boolean).join("|");
  useEffect(() => {
    key
      .split("|")
      .filter(Boolean)
      .forEach((name) => {
        const id = `gf-${name.replace(/\s+/g, "-").toLowerCase()}`;
        if (document.getElementById(id)) return;
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(
          /%20/g,
          "+"
        )}:wght@400;500;600;700;800&display=swap`;
        document.head.appendChild(link);
      });
  }, [key]);
}

/**
 * Nothing inside the preview may act. Forms cannot submit, links cannot
 * navigate the page away, and buttons that would take a payment or delete
 * something do nothing at all. The iframe sandbox blocks most of this at the
 * browser level; this is the second line so the component is safe on its own.
 */
function useNeutralisedInteractions(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const stop = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const onSubmit = (event: Event) => stop(event);

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const actionable = target.closest("a, button, [role='button'], input[type='submit']");
      if (!actionable) return;
      // Let in-preview page links through - the preview handles them itself.
      if (actionable instanceof HTMLAnchorElement) {
        const href = actionable.getAttribute("href") || "";
        if (href.startsWith("#")) return;
      }
      stop(event);
    };

    // Capture phase: we win before any component's own handler runs.
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [enabled]);
}

/**
 * Refuse every state-changing request made from inside the preview. A booking
 * widget or checkout button that slips past the click guard still cannot
 * reach the API.
 */
function useReadOnlyNetwork(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const originalFetch = window.fetch;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        return Promise.reject(new Error("Preview is read-only"));
      }
      return originalFetch(input, init);
    }) as typeof window.fetch;
    return () => {
      window.fetch = originalFetch;
    };
  }, [enabled]);
}

const noop = () => {};

export function ReadOnlySitePreview({
  pages,
  activePageId,
  globalStyles,
  chrome,
  navItems,
  device = "desktop",
  onNavigate,
  neutralise = true,
}: {
  pages: PreviewPage[];
  activePageId?: string;
  globalStyles?: DesignTokens;
  /** The site-wide header and footer, drawn around every page that uses them. */
  chrome?: SiteChrome;
  /** The resolved site navigation, so the preview's menu matches the real one. */
  navItems?: NavItem[];
  device?: PreviewDevice;
  /** Called when a link inside the site points at another generated page. */
  onNavigate?: (pageId: string) => void;
  neutralise?: boolean;
}) {
  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  // The same composition the builder canvas and the publisher use: shared
  // header, the page's own sections, shared footer.
  const composed = useMemo(
    () => (activePage ? composePageComponents(activePage, chrome) : []),
    [activePage, chrome]
  );

  useGoogleFonts([
    globalStyles?.fontFamily,
    globalStyles?.fontPair?.heading,
    globalStyles?.fontPair?.body,
  ]);
  useNeutralisedInteractions(neutralise);
  useReadOnlyNetwork(neutralise);

  // Site-internal links move the preview between generated pages instead of
  // navigating the browser.
  useEffect(() => {
    if (!onNavigate) return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#" || href.startsWith("http")) return;
      const match = pages.find((page) => page.path === href || `#${page.path}` === href);
      if (match) {
        event.preventDefault();
        event.stopPropagation();
        onNavigate(match.id);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pages, onNavigate]);

  if (!activePage) {
    return (
      <div className="flex h-full items-center justify-center p-12 text-sm text-muted-foreground">
        Der er ingen sider at vise endnu.
      </div>
    );
  }

  return (
    <BuilderSelectionProvider
      isBuilderMode={false}
      selectedId={null}
      hoveredId={null}
      components={composed}
      onUpdateComponent={noop}
      onDeleteComponent={noop}
      onDuplicateComponent={noop}
      onMoveComponent={noop}
      pages={pages}
      activePage={activePage.id}
    >
      <div
        className="mx-auto bg-white"
        style={{ width: PREVIEW_WIDTHS[device], maxWidth: "100%" }}
        data-testid="readonly-site-preview"
      >
        {topLevelComponents(composed).map((component) => (
          <ComponentRenderer
            key={component.id}
            component={component}
            isPreview
            pages={pages}
            navItems={navItems}
            allComponents={composed}
            deviceMode={device}
            globalStyles={globalStyles}
          />
        ))}
      </div>
    </BuilderSelectionProvider>
  );
}

/** Small helper the preview page uses to keep its own loading state tidy. */
export function usePreviewData(websiteId: string | null, token: string | null) {
  const [data, setData] = useState<{
    pages: PreviewPage[];
    globalStyles: DesignTokens;
    chrome?: SiteChrome;
    navItems: NavItem[];
    websiteName: string;
    websiteId: string;
    revision: number;
    fingerprint: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!websiteId || !token) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/onboarding/preview/${websiteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message || "Forhåndsvisningen kunne ikke hentes.");
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setData({
          pages: body.pages ?? [],
          globalStyles: body.globalStyles ?? {},
          chrome: body.siteChrome ?? undefined,
          navItems: body.navItems ?? [],
          websiteName: body.websiteName ?? "",
          websiteId: body.websiteId ?? websiteId,
          revision: body.revision ?? 0,
          fingerprint: body.fingerprint ?? "",
        });
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [websiteId, token]);

  return { data, error, loading };
}
