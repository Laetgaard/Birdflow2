import { useCallback, useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  ReadOnlySitePreview,
  usePreviewData,
  type PreviewDevice,
} from "@/components/onboarding/ReadOnlySitePreview";

/* ─────────────────────────────────────────────────────────────
   /onboarding/preview/:websiteId

   The preview lives on its own same-origin route so the onboarding
   page can embed it in a sandboxed iframe: the customer's site gets
   its own document, its own scroll and its own CSS, and none of the
   wizard's styling leaks into it (or the other way round).

   The server checks that the signed-in user owns both the onboarding
   session and the website before it returns a single component, so
   guessing another customer's website id gets a 403, not a preview.
   ───────────────────────────────────────────────────────────── */

export default function OnboardingPreviewPage() {
  const [, params] = useRoute("/onboarding/preview/:websiteId");
  const { token, loading: authLoading } = useAuth();
  const websiteId = params?.websiteId ?? null;

  const { data, error, loading } = usePreviewData(websiteId, token);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  // The embedding page drives which page and which width are shown, so the
  // controls can live in the onboarding chrome instead of on top of the site.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data;
      if (!payload || payload.type !== "bf-preview") return;
      if (typeof payload.pageId === "string") setActivePageId(payload.pageId);
      if (payload.device === "desktop" || payload.device === "mobile") setDevice(payload.device);
    };
    window.addEventListener("message", onMessage);
    // Tell the parent we are ready for instructions.
    window.parent?.postMessage({ type: "bf-preview-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!activePageId && data?.pages?.length) setActivePageId(data.pages[0].id);
  }, [data, activePageId]);

  // Report the rendered page list back so the parent can build its selector
  // from what actually rendered.
  useEffect(() => {
    if (!data) return;
    window.parent?.postMessage(
      {
        type: "bf-preview-pages",
        websiteId: data.websiteId,
        revision: data.revision,
        fingerprint: data.fingerprint,
        pages: data.pages.map((page) => ({ id: page.id, name: page.name, path: page.path })),
      },
      window.location.origin
    );
  }, [data]);

  const reportRenderDiagnostics = useCallback(
    (diagnostics: import("@/components/onboarding/ReadOnlySitePreview").PreviewRenderDiagnostics) => {
      if (!data) return;
      window.parent?.postMessage(
        {
          type: "bf-preview-render-diagnostics",
          websiteId: data.websiteId,
          revision: data.revision,
          fingerprint: data.fingerprint,
          ...diagnostics,
        },
        window.location.origin
      );
    },
    [data]
  );

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-8 text-center">
        <p className="max-w-sm text-sm text-neutral-600" data-testid="preview-error">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">
      <ReadOnlySitePreview
        pages={data?.pages ?? []}
        websiteId={data?.websiteId ?? websiteId ?? ""}
        activePageId={activePageId ?? undefined}
        globalStyles={data?.globalStyles}
        chrome={data?.chrome}
        navItems={data?.navItems}
        svgAssets={data?.svgAssets}
        expectedTopLevelComponentIds={
          activePageId ? data?.renderExpectations[activePageId]?.topLevelComponentIds : undefined
        }
        expectedTopLevelComponentCount={
          activePageId ? data?.renderExpectations[activePageId]?.topLevelComponentCount : undefined
        }
        device={device}
        onNavigate={(pageId) => {
          setActivePageId(pageId);
          window.parent?.postMessage({ type: "bf-preview-page", pageId }, window.location.origin);
        }}
        onRenderDiagnostics={reportRenderDiagnostics}
      />
    </div>
  );
}
