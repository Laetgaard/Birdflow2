import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Eye,
  CheckCircle2,
  Loader2,
  FileText,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  CalendarHeart,
} from "lucide-react";
import type { BrandGuide } from "@shared/customComponents";
import type { WebsiteReadiness } from '@shared/websiteReadiness';
import type { OnboardingDecisionSnapshot, OnboardingResumeStage } from "@shared/onboardingDecision";
import { BrandGuideView } from "./BrandGuideView";
import { MeetingBooking, MeetingConfirmation, type PlatformMeeting } from "./MeetingBooking";
import { PREVIEW_WIDTHS, type PreviewDevice } from "./ReadOnlySitePreview";
import { PURPLE, LIME, EASE } from "@/components/bf2/theme";

/* ─────────────────────────────────────────────────────────────
   The end of onboarding: the site they actually got, the brand
   guide that came with it, and the two ways forward.

   Left: the real website in a sandboxed same-origin iframe with a
   page selector, Computer/Mobil widths and a refresh. Right: the
   brand guide, the build report and the adjustment chat, with a
   sticky decision area underneath that always shows where they
   are - awaiting a decision, mid-checkout, invoice open, booked,
   in customisation, ready for review, or paid.

   On a phone the same content becomes tabs, with "Hjemmeside" and
   "Brandguide" first, and the decision area pinned below them so
   the actions are always reachable without covering the content.
   ───────────────────────────────────────────────────────────── */

export type DecisionCopy = {
  invoiceTerms: string;
  meetingPitch: string;
  readyForReview: string;
};

export type DecisionPage = { id: string; name: string; path: string };

export type DesignDirection = {
  id: string;
  name: string;
  concept: string;
  designIntent: string;
  brandDeviation: { level: string; changes: string[]; rationale: string };
  qualityScore: { overall: number };
  selected: boolean;
};

type Tab = "site" | "brand" | "report" | "adjust";

export function ReadinessSummary({ readiness }: { readiness?: WebsiteReadiness | null }) {
  if (!readiness) return null;
  const labels = { content: 'Indhold og struktur', visualReview: 'Visuel gennemgang', bookingSetup: 'Bookingopsætning' };
  const statuses = { passed: 'Kontrolleret', needs_repair: 'Kræver rettelse', needs_owner_input: 'Mangler dine oplysninger', unavailable: 'Ikke kontrolleret', not_applicable: 'Ikke relevant' };
  const messages: Record<string, string> = {
    'booking.services_missing': 'Opret de ydelser, der skal kunne bookes.',
    'booking.setup_present_not_reservation_tested': 'Ydelser og tider er oprettet. En gennemført reservation, betaling og bekræftelse er endnu ikke kontrolleret.',
    'booking.setup_check_unavailable': 'Bookingopsætningen kunne ikke kontrolleres. Prøv igen.',
    'booking.external_not_checked': 'Ekstern booking skal afprøves hos den valgte udbyder.',
    'booking.native_not_requested': 'Hjemmesiden bruger ikke Birdflows booking.',
    'visual.current_review_missing': 'Denne version mangler en visuel gennemgang. Et tidligere resultat gælder ikke efter ændringer.',
  };
  const explain = (message: string) => message.startsWith('booking.hours_missing:') ? 'Tilføj åbningstider eller ledige tider til ' + message.split(':').slice(1).join(':')
    : message.startsWith('booking.service_mismatch:') ? 'Bookingens navn, varighed eller pris matcher endnu ikke dine oplysninger for ' + message.split(':').slice(1).join(':')
    : message.startsWith('booking.service_invalid:') ? 'Kontrollér oplysningerne for ' + message.split(':').slice(1).join(':') : messages[message] ?? message;
  return (
    <section className="mb-5 space-y-3" data-testid="website-readiness" aria-label="Status for hjemmesiden">
      <p className="text-sm text-neutral-600">Gennemgang af version {readiness.builderRevision}. Kontrollerne erstatter ikke din godkendelse af indhold og design.</p>
      {Object.entries(readiness.checks).map(([key, check]) => (
        <div key={key} className="rounded-xl border border-black/10 p-3">
          <p className="text-sm font-bold">{labels[key as keyof typeof labels]} · {statuses[check.status]}</p>
          {check.messages.map((message, index) => <p key={index} className="mt-1 text-sm text-neutral-600">{explain(message)}</p>)}
        </div>
      ))}
    </section>
  );
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

/* ─────────── the preview pane ─────────── */

function PreviewPane({
  websiteId,
  expectedRevision,
  expectedFingerprint,
  pages,
  activePageId,
  onActivePageChange,
  directionId,
}: {
  websiteId: string;
  expectedRevision: number;
  expectedFingerprint: string;
  pages: DecisionPage[];
  activePageId: string | null;
  onActivePageChange: (pageId: string) => void;
  directionId?: string | null;
}) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [renderer, setRenderer] = useState<'builder' | 'published'>('builder');
  const [reloadKey, setReloadKey] = useState(0);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [parityError, setParityError] = useState<string | null>(null);
  const [renderDegradedError, setRenderDegradedError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // The desktop site is rendered at its real width and scaled to fit the
  // column; the mobile view is a real phone width, centred, never a shrunken
  // desktop layout.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => {
      const available = shell.clientWidth;
      const target = PREVIEW_WIDTHS[device];
      setScale(device === "mobile" ? 1 : Math.min(1, available / target));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [device]);

  // Talk to the preview document: which page, which width.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frameRef.current?.contentWindow) return;
      const payload = event.data;
      if (!payload) return;
      if (payload.type === "bf-preview-ready") setReady(true);
      if (payload.type === "bf-preview-pages") {
        const expectedIds = pages.map((page) => page.id);
        const renderedIds = Array.isArray(payload.pages) ? payload.pages.map((page: any) => page?.id) : [];
        const matches =
          payload.websiteId === websiteId &&
          payload.revision === expectedRevision &&
          payload.fingerprint === expectedFingerprint &&
          expectedIds.length > 0 &&
          expectedIds.length === renderedIds.length &&
          expectedIds.every((id, index) => id === renderedIds[index]);
        setParityError(matches ? null : "Forhåndsvisningen er blevet forældet. Opdater siden for at hente den seneste version.");
      }
      if (payload.type === "bf-preview-render-diagnostics") {
        const contextMatches =
          payload.websiteId === websiteId &&
          payload.revision === expectedRevision &&
          payload.fingerprint === expectedFingerprint;
        if (!contextMatches || payload.degraded === true) {
          setRenderDegradedError(
            "Forhåndsvisningen er ufuldstændig. Noget af hjemmesidens indhold kunne ikke vises."
          );
        } else {
          setRenderDegradedError(null);
        }
      }
      if (payload.type === "bf-preview-page" && typeof payload.pageId === "string") {
        onActivePageChange(payload.pageId);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onActivePageChange, pages, websiteId, expectedRevision, expectedFingerprint]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      { type: "bf-preview", pageId: activePageId ?? undefined, device },
      window.location.origin
    );
  }, [ready, activePageId, device, reloadKey]);

  useEffect(() => {
    setReady(false);
    setParityError(null);
    setRenderDegradedError(null);
  }, [directionId, renderer]);

  const frameHeight = device === "mobile" ? 780 : 900;

  return (
    <div className="flex h-full flex-col">
      {/* Chrome: unmistakably a preview, with the controls outside the site */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/10 px-3 py-2.5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ background: LIME, color: PURPLE }}
          data-testid="preview-badge"
        >
          <Eye className="h-3 w-3" />
          Forhåndsvisning
        </span>

        <select aria-label="Visning" value={renderer} onChange={event => setRenderer(event.target.value as 'builder' | 'published')} className="h-8 rounded-lg border border-black/10 bg-white px-2 text-xs">
          <option value="builder">Byggervisning</option>
          <option value="published">Udgivelsesvisning (simulerede indsendelser)</option>
        </select>
        {pages.length > 1 && (
          <select
            value={activePageId ?? pages[0]?.id}
            onChange={(event) => onActivePageChange(event.target.value)}
            className="h-8 max-w-[45%] truncate rounded-lg border border-black/10 bg-white px-2 text-sm"
            data-testid="select-preview-page"
            aria-label="Vælg side"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-1">
          <div className="flex rounded-lg border border-black/10 p-0.5">
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
              style={device === "desktop" ? { background: PURPLE, color: "#fff" } : undefined}
              data-testid="button-device-desktop"
            >
              <Monitor className="h-3.5 w-3.5" />
              Computer
            </button>
            <button
              type="button"
              onClick={() => setDevice("tablet")}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
              style={device === "tablet" ? { background: PURPLE, color: "#fff" } : undefined}
              data-testid="button-device-tablet"
            >
              <Tablet className="h-3.5 w-3.5" />
              Tablet
            </button>
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
              style={device === "mobile" ? { background: PURPLE, color: "#fff" } : undefined}
              data-testid="button-device-mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
              Mobil
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setReady(false);
              setParityError(null);
              setRenderDegradedError(null);
              setReloadKey((key) => key + 1);
            }}
            className="rounded-lg border border-black/10 p-1.5 transition-colors hover:bg-black/5"
            title="Opdater forhåndsvisningen"
            data-testid="button-refresh-preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={shellRef} className="flex-1 overflow-auto bg-neutral-100 p-3">
        {(parityError || renderDegradedError) && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="preview-parity-error">
            {parityError || renderDegradedError}
          </div>
        )}
        <div
          className="mx-auto overflow-hidden bg-white shadow-lg"
          style={{
            width: PREVIEW_WIDTHS[device] * scale,
            height: frameHeight * scale,
            borderRadius: device === "mobile" ? 28 : 10,
            transition: `width 0.25s ${EASE}, height 0.25s ${EASE}`,
          }}
        >
          <iframe
            key={reloadKey}
            ref={frameRef}
            title="Forhåndsvisning af din hjemmeside"
            src={`/onboarding/preview/${websiteId}?${new URLSearchParams({ renderer, ...(directionId ? { directionId } : {}) }).toString()}`}
            // No allow-forms, no allow-popups, no allow-top-navigation: nothing
            // inside the customer's site can submit, pay, open a window or move
            // the page. allow-same-origin is what lets it read the signed-in
            // session and render the real site.
            sandbox="allow-scripts allow-same-origin"
            style={{
              width: PREVIEW_WIDTHS[device],
              height: frameHeight,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              display: "block",
            }}
            data-testid="iframe-preview"
            aria-hidden={parityError ? "true" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────── the decision area ─────────── */

function DirectionCards({
  directions,
  selectedDirectionId,
  busy,
  onSelectDirection,
}: {
  directions: DesignDirection[];
  selectedDirectionId: string | null;
  busy?: boolean;
  onSelectDirection: (directionId: string) => void;
}) {
  if (!directions.length) return null;

  return (
    <section aria-labelledby="design-directions-heading" aria-busy={busy} data-testid="design-directions">
      <div className="mb-3">
        <h2 id="design-directions-heading" className="text-base font-extrabold">
          {directions.length === 1 ? 'Dit hjemmesideudkast' : 'Vælg designretning'}
        </h2>
        <p className="mt-0.5 text-sm text-neutral-600">{directions.length === 1 ? 'Gennemgå alle sider, og tilpas indhold og design.' : 'Sammenlign forslagene, og vælg den retning du vil gå videre med.'}</p>
      </div>
      <div className={directions.length === 1 ? 'grid gap-3' : 'grid gap-3 md:grid-cols-3'}>
        {directions.map((direction) => {
          const selected = selectedDirectionId ? selectedDirectionId === direction.id : direction.selected;
          return (
            <button
              key={direction.id}
              type="button"
              disabled={busy || selected}
              onClick={() => onSelectDirection(direction.id)}
              aria-pressed={selected}
              className="rounded-2xl border-2 p-4 text-left transition-colors disabled:cursor-default disabled:opacity-80"
              style={selected ? { borderColor: PURPLE, background: "rgba(76, 29, 149, 0.05)" } : { borderColor: "rgba(0,0,0,0.1)" }}
              data-testid={`design-direction-${direction.id}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-bold">{direction.name}</span>
                {selected && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: PURPLE, color: "#fff" }}>
                    Valgt
                  </span>
                )}
              </span>
              <span className="mt-2 block text-sm font-medium text-neutral-700">{direction.concept}</span>
              <span className="mt-1 block text-xs leading-relaxed text-neutral-600">{direction.designIntent}</span>
              <span className="mt-3 block text-xs text-neutral-500">
                {direction.brandDeviation.rationale}
              </span>
              {busy && !selected && <span className="mt-2 block text-xs font-semibold" style={{ color: PURPLE }}>Vælger retning…</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  variant,
  disabled,
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  variant: "primary" | "secondary";
  disabled?: boolean;
  testId: string;
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-full border-2 px-4 py-3 text-sm font-bold transition-transform disabled:opacity-60 sm:text-base"
      style={{
        borderColor: PURPLE,
        background: primary ? PURPLE : "#fff",
        color: primary ? "#fff" : PURPLE,
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function DecisionArea({
  stage,
  snapshot,
  copy,
  approvalStale,
  busy,
  onApprove,
  onCustomise,
  onRetry,
  onBackToDecision,
  meeting,
}: {
  stage: OnboardingResumeStage;
  snapshot: OnboardingDecisionSnapshot;
  copy: DecisionCopy;
  approvalStale?: boolean;
  busy?: boolean;
  onApprove: () => void;
  onCustomise: () => void;
  onRetry: () => void;
  onBackToDecision: () => void;
  meeting: PlatformMeeting | null;
}) {
  if (stage === "paid") {
    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4" data-testid="decision-paid">
        <p className="flex items-center gap-2 font-extrabold text-emerald-900">
          <CheckCircle2 className="h-5 w-5" />
          Betalingen er gennemført
        </p>
        <p className="mt-1 text-sm text-emerald-900">
          Din hjemmeside er godkendt og dit abonnement er aktivt. Du kan nu gå videre til dit kontrolpanel.
        </p>
      </div>
    );
  }

  if (stage === "invoice_open") {
    return (
      <div className="rounded-2xl border-2 border-black/10 p-4" data-testid="decision-invoice-open">
        <p className="flex items-center gap-2 font-extrabold">
          <FileText className="h-5 w-5" style={{ color: PURPLE }} />
          Faktura sendt
        </p>
        <p className="mt-1 text-sm text-neutral-700">{copy.invoiceTerms}</p>
        <p className="mt-1 text-sm text-neutral-600">
          Din hjemmeside og din brandguide bliver her, indtil betalingen er registreret.
        </p>
        {snapshot.stripeInvoiceUrl && (
          <a
            href={snapshot.stripeInvoiceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold underline"
            style={{ color: PURPLE }}
            data-testid="link-open-invoice"
          >
            Åbn fakturaen
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    );
  }

  if (stage === "checkout_pending") {
    return (
      <div className="rounded-2xl border-2 border-black/10 p-4" data-testid="decision-checkout-pending">
        <p className="flex items-center gap-2 font-extrabold">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: PURPLE }} />
          Betaling i gang
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          Vi venter på svar fra Stripe. Blev betalingen afbrudt, kan du starte forfra herunder.
        </p>
        <div className="mt-3 flex gap-2">
          <ActionButton variant="primary" onClick={onRetry} disabled={busy} testId="button-resume-checkout">
            Fortsæt betalingen
          </ActionButton>
          <ActionButton variant="secondary" onClick={onBackToDecision} disabled={busy} testId="button-abandon-checkout">
            Tilbage til valget
          </ActionButton>
        </div>
      </div>
    );
  }

  if (stage === "checkout_cancelled" || stage === "payment_failed") {
    const failed = stage === "payment_failed";
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4" data-testid="decision-payment-retry">
        <p className="flex items-center gap-2 font-extrabold text-amber-900">
          <AlertTriangle className="h-5 w-5" />
          {failed ? "Betalingen gik ikke igennem" : "Betalingen blev afbrudt"}
        </p>
        <p className="mt-1 text-sm text-amber-900">
          {failed
            ? "Der skete en fejl hos betalingsudbyderen. Din hjemmeside og din brandguide er urørt — prøv igen, når du er klar."
            : "Ingen skade sket. Din hjemmeside står præcis, som du forlod den."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <ActionButton variant="primary" onClick={onApprove} disabled={busy} testId="button-retry-payment">
            Prøv betalingen igen
          </ActionButton>
          <ActionButton variant="secondary" onClick={onCustomise} disabled={busy} testId="button-customise-after-fail">
            Jeg vil have den tilpasset
          </ActionButton>
        </div>
      </div>
    );
  }

  if (stage === "meeting_booked" && meeting) {
    return <MeetingConfirmation meeting={meeting} timezone="Europe/Copenhagen" />;
  }

  if (stage === "in_customisation") {
    return (
      <div className="rounded-2xl border-2 border-black/10 p-4" data-testid="decision-in-customisation">
        <p className="flex items-center gap-2 font-extrabold">
          <Sparkles className="h-5 w-5" style={{ color: PURPLE }} />
          Vi er i gang med dine forbedringer
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          Du hører fra os, så snart den opdaterede hjemmeside er klar til din godkendelse. Du betaler først, når du
          har godkendt det færdige resultat.
        </p>
      </div>
    );
  }

  // awaiting decision, approved-but-unpaid, and ready for review all end in
  // the same two choices - presented as equals.
  return (
    <div data-testid="decision-choices">
      {stage === "ready_for_review" && (
        <div className="mb-3 rounded-2xl p-3" style={{ background: LIME }} data-testid="banner-ready-for-review">
          <p className="flex items-center gap-2 font-extrabold" style={{ color: PURPLE }}>
            <CalendarHeart className="h-4 w-4" />
            {copy.readyForReview}
          </p>
          <p className="mt-0.5 text-sm text-neutral-700">
            Vi har arbejdet videre efter mødet. Se den igennem og godkend, hvis du er tilfreds.
          </p>
        </div>
      )}

      {approvalStale && stage !== "ready_for_review" && (
        <p className="mb-3 text-sm text-amber-700" data-testid="text-approval-stale">
          Hjemmesiden er ændret, siden du godkendte den. Godkend den nye version for at fortsætte.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <ActionButton variant="primary" onClick={onApprove} disabled={busy} testId="button-approve-and-pay">
          Godkend og betal
        </ActionButton>
        <ActionButton variant="secondary" onClick={onCustomise} disabled={busy} testId="button-book-meeting">
          <span className="flex items-center justify-center gap-1.5">
            <CalendarHeart className="h-4 w-4 shrink-0" />
            Book et møde med os
          </span>
        </ActionButton>
      </div>
      <p className="mt-2 text-xs leading-snug text-neutral-600">{copy.meetingPitch}</p>
    </div>
  );
}

/* ─────────── the workspace ─────────── */

export function DecisionWorkspace({
  stage,
  snapshot,
  previewFingerprint,
  builderRevision,
  copy,
  approvalStale,
  websiteId,
  businessName,
  pages,
  designDirections = [],
  selectedDirectionId = null,
  brandGuide,
  reportSlot,
  readiness,
  adjustmentsSlot,
  meeting,
  token,
  busy,
  downloading,
  onApprove,
  onCustomise,
  onRetry,
  onBackToDecision,
  onDownloadGuide,
  onBooked,
  onSelectDirection,
}: {
  stage: OnboardingResumeStage;
  snapshot: OnboardingDecisionSnapshot;
  previewFingerprint: string;
  builderRevision: number;
  copy: DecisionCopy;
  approvalStale?: boolean;
  websiteId: string;
  businessName: string;
  pages: DecisionPage[];
  designDirections?: DesignDirection[];
  selectedDirectionId?: string | null;
  brandGuide: BrandGuide;
  reportSlot: ReactNode;
  readiness?: WebsiteReadiness | null;
  adjustmentsSlot: ReactNode;
  meeting: PlatformMeeting | null;
  token: string | null;
  busy?: boolean;
  downloading?: boolean;
  onApprove: () => void;
  onCustomise: () => void;
  onRetry: () => void;
  onBackToDecision: () => void;
  onDownloadGuide: () => void;
  onBooked: (meeting: PlatformMeeting) => void;
  onSelectDirection?: (directionId: string) => void;
}) {
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>("site");
  const [activePageId, setActivePageId] = useState<string | null>(pages[0]?.id ?? null);

  useEffect(() => {
    if (!activePageId && pages.length) setActivePageId(pages[0].id);
  }, [pages, activePageId]);

  useEffect(() => {
    if (designDirections.length) setActivePageId(pages[0]?.id ?? null);
  }, [selectedDirectionId]);

  // The right column shows the brand guide first on desktop.
  useEffect(() => {
    setTab((current) => (isDesktop && current === "site" ? "brand" : current));
  }, [isDesktop]);

  const booking = stage === "booking";

  const preview = (
    <div className="overflow-hidden rounded-3xl border-2 border-black/10 bg-white lg:h-[calc(100vh-190px)] lg:min-h-[560px]">
      <div className="h-[70vh] lg:h-full">
        <PreviewPane
          websiteId={websiteId}
          expectedRevision={builderRevision}
          expectedFingerprint={previewFingerprint}
          pages={pages}
          activePageId={activePageId}
          onActivePageChange={setActivePageId}
          directionId={selectedDirectionId}
        />
      </div>
    </div>
  );

  const directionCards =
    designDirections.length > 0 && onSelectDirection ? (
      <DirectionCards
        directions={designDirections}
        selectedDirectionId={selectedDirectionId}
        busy={busy}
        onSelectDirection={(directionId) => {
          setActivePageId(pages[0]?.id ?? null);
          onSelectDirection(directionId);
        }}
      />
    ) : null;

  const panelBody = (
    <>
      {tab === "brand" && (
        <BrandGuideView
          guide={brandGuide}
          businessName={businessName}
          onDownload={onDownloadGuide}
          downloading={downloading}
        />
      )}
      {tab === "report" && <div data-testid="panel-report"><ReadinessSummary readiness={readiness} />{reportSlot}</div>}
      {tab === "adjust" && <div data-testid="panel-adjustments">{adjustmentsSlot}</div>}
    </>
  );

  const tabButton = (value: Tab, label: string, primary = false) => (
    <button
      key={value}
      type="button"
      onClick={() => setTab(value)}
      className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${
        primary ? "text-sm" : "text-xs"
      }`}
      style={
        tab === value
          ? { background: PURPLE, color: "#fff" }
          : { background: "rgba(0,0,0,0.05)", color: "#404040" }
      }
      data-testid={`tab-${value}`}
    >
      {label}
    </button>
  );

  const decisionArea = (
    <DecisionArea
      stage={stage}
      snapshot={snapshot}
      copy={copy}
      approvalStale={approvalStale}
      busy={busy}
      onApprove={onApprove}
      onCustomise={onCustomise}
      onRetry={onRetry}
      onBackToDecision={onBackToDecision}
      meeting={meeting}
    />
  );

  if (isDesktop) {
    return (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]" data-testid="decision-workspace">
        <div className="flex min-w-0 flex-col gap-4">
          {directionCards}
          {preview}
        </div>

        <div className="flex flex-col gap-3 lg:h-[calc(100vh-190px)] lg:min-h-[560px]">
          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border-2 border-black/10 bg-white">
            {booking ? (
              <div className="overflow-y-auto p-5">
                <MeetingBooking
                  token={token}
                  websiteId={websiteId}
                  pitch={copy.meetingPitch}
                  onBooked={onBooked}
                  onBack={onBackToDecision}
                />
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 border-b border-black/10 p-3">
                  {tabButton("brand", "Brandguide", true)}
                  {tabButton("report", "Byggerapport")}
                  {tabButton("adjust", "Justeringer")}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-5">{panelBody}</div>
              </>
            )}
          </div>

          {!booking && (
            <div className="rounded-3xl border-2 border-black/10 bg-white p-4" data-testid="decision-area">
              {decisionArea}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ─── phone: tabs, with the actions pinned under them ─── */
  return (
    <div className="flex flex-col gap-3" data-testid="decision-workspace">
      {booking ? (
        <div className="rounded-3xl border-2 border-black/10 bg-white p-4">
          <MeetingBooking
            token={token}
            websiteId={websiteId}
            pitch={copy.meetingPitch}
            onBooked={onBooked}
            onBack={onBackToDecision}
          />
        </div>
      ) : (
        <>
          {directionCards}
          <div className="flex flex-wrap items-center gap-1.5">
            {tabButton("site", "Hjemmeside", true)}
            {tabButton("brand", "Brandguide", true)}
            <span className="mx-1 h-4 w-px bg-black/10" />
            {tabButton("report", "Byggerapport")}
            {tabButton("adjust", "Justeringer")}
          </div>

          {tab === "site" ? (
            preview
          ) : (
            <div className="rounded-3xl border-2 border-black/10 bg-white p-4">{panelBody}</div>
          )}

          <div
            className="sticky bottom-0 z-10 rounded-3xl border-2 border-black/10 bg-white p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]"
            data-testid="decision-area"
          >
            {decisionArea}
          </div>
        </>
      )}
    </div>
  );
}
