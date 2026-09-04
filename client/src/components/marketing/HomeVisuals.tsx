import { BLUE, GREEN, LIME, PURPLE } from "@/components/bf2/theme";
import { Bird, ScaleToFit } from "@/components/bf2/primitives";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   The homepage's section visuals.

   The approved design leaves an empty image slot beside sections
   02, 04 and 05 ("Visual til »Sådan fungerer det«", "Typografi- og
   farvevalg i Birdflow", "Stort visual af Birdflow-systemet"). These
   three components fill them.

   Two are drawn rather than photographed. The product screenshots we
   hold are small — the builder editor is 364x181 — so blowing one up
   to the 620px-tall panel the design draws would ship a soft, pixelated
   picture. A composed illustration stays crisp at any width and can say
   exactly what the section's text says. Section 04 is the exception: it
   is literally about picking type and colour, and we have the real
   editor screenshot of that at a usable size, so it shows the real one.

   Everything is DOM and inline SVG in the bf2 palette — no images to
   load beyond that one screenshot, and no new dependencies.
   ───────────────────────────────────────────────────────────── */

/* ═══════════ 02 · what runs while you are in session ═══════════ */

type FlowCopy = {
  today: string;
  adminBetween: string;
  zeroMin: string;
  now: string;
  sessions: Array<{ time: string; title: string; place: string }>;
  events: Array<{ time: string; title: string; sub: string }>;
  ariaLabel: string;
};

const FLOW_COPY: Record<Lang, FlowCopy> = {
  da: {
    today: "I DAG · TIRSDAG",
    adminBetween: "Administration imellem",
    zeroMin: "0 min.",
    now: "NU",
    sessions: [
      { time: "09.00", title: "Samtale", place: "Klinik" },
      { time: "11.00", title: "Samtale", place: "Online" },
      { time: "13.00", title: "Samtale", place: "Klinik" },
    ],
    events: [
      { time: "09.51", title: "Bekræftelse sendt", sub: "Tid, sted og praktisk information" },
      { time: "11.50", title: "Kalenderen opdateret", sub: "Tiden lukkede sig selv på siden" },
      { time: "13.14", title: "Henvendelse samlet", sub: "Ligger i Birdflow med status" },
      { time: "i morgen 08.00", title: "Påmindelse planlagt", sub: "Går ud før aftalen" },
    ],
    ariaLabel:
      "En tirsdag i praksissen: tre samtaler, og imellem dem sender Birdflow bekræftelsen, opdaterer kalenderen, samler henvendelsen og planlægger påmindelsen.",
  },
  en: {
    today: "TODAY · TUESDAY",
    adminBetween: "Admin in between",
    zeroMin: "0 min.",
    now: "NOW",
    sessions: [
      { time: "09.00", title: "Session", place: "Clinic" },
      { time: "11.00", title: "Session", place: "Online" },
      { time: "13.00", title: "Session", place: "Clinic" },
    ],
    events: [
      { time: "09.51", title: "Confirmation sent", sub: "Time, place and the practical details" },
      { time: "11.50", title: "Calendar updated", sub: "The slot closed itself on the site" },
      { time: "13.14", title: "Enquiry collected", sub: "Waiting in Birdflow with a status" },
      { time: "tomorrow 08.00", title: "Reminder scheduled", sub: "Goes out before the appointment" },
    ],
    ariaLabel:
      "A Tuesday in the practice: three sessions, and in between them Birdflow sends the confirmation, updates the calendar, collects the enquiry and schedules the reminder.",
  },
};

function SessionRow({ time, title, place, now }: { time: string; title: string; place: string; now?: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-[11px] bg-white px-3 py-2.5 border border-black/[0.07]"
      style={{ boxShadow: "0 4px 14px rgba(20,5,40,0.06)" }}
    >
      <span className="w-[3px] self-stretch rounded-full shrink-0" style={{ background: PURPLE }} />
      <span className="text-[12.5px] font-extrabold tabular-nums shrink-0" style={{ color: "rgba(0,0,0,0.55)" }}>
        {time}
      </span>
      <span className="text-[13.5px] font-extrabold truncate">{title}</span>
      <span className="ml-auto flex items-center gap-2 shrink-0">
        {now && (
          <span
            className="rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white tracking-[0.08em]"
            style={{ background: PURPLE }}
          >
            {now}
          </span>
        )}
        <span className="text-[11.5px] font-extrabold" style={{ color: "rgba(0,0,0,0.45)" }}>
          {place}
        </span>
      </span>
    </div>
  );
}

function EventRow({ time, title, sub }: { time: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5 pl-4 sm:pl-7">
      <span
        className="mt-[2px] grid place-items-center w-[19px] h-[19px] rounded-full shrink-0 text-white text-[11px] font-black"
        style={{ background: GREEN }}
        aria-hidden="true"
      >
        ✓
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold leading-tight">{title}</span>
        <span className="block text-[11.5px] font-bold leading-snug" style={{ color: "rgba(0,0,0,0.52)" }}>
          {sub} · {time}
        </span>
      </span>
    </div>
  );
}

/** The day board: sessions, and what Birdflow handled between them. */
export function FlowVisual() {
  const { lang } = useLocale();
  const t = pick(FLOW_COPY, lang);

  return (
    <div
      className="w-full rounded-[16px] overflow-hidden p-4 sm:p-6 lg:p-7 flex flex-col gap-4 lg:h-[520px]"
      style={{ background: "rgba(128,22,195,0.06)" }}
      role="img"
      aria-label={t.ariaLabel}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11.5px] font-extrabold tracking-[0.14em]" style={{ color: "rgba(0,0,0,0.55)" }}>
          {t.today}
        </span>
        <span
          className="ml-auto inline-flex items-baseline gap-1.5 rounded-full bg-white px-3 py-1.5 border border-black/[0.07]"
          style={{ boxShadow: "0 4px 14px rgba(20,5,40,0.06)" }}
        >
          <span className="text-[11.5px] font-extrabold" style={{ color: "rgba(0,0,0,0.55)" }}>
            {t.adminBetween}
          </span>
          <span className="bf2-display text-[17px] leading-none" style={{ color: GREEN }}>
            {t.zeroMin}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-2.5 lg:gap-3 lg:justify-center lg:flex-1 min-w-0">
        <SessionRow {...t.sessions[0]} />
        <EventRow {...t.events[0]} />
        <SessionRow {...t.sessions[1]} />
        <EventRow {...t.events[1]} />
        <SessionRow {...t.sessions[2]} now={t.now} />
        <EventRow {...t.events[2]} />
        <EventRow {...t.events[3]} />
      </div>

    </div>
  );
}

/* ═══════════ 04 · picking type and colour ═══════════ */

const BRAND_COPY: Record<Lang, { alt: string; swatches: string; type: string; sample: string }> = {
  da: {
    alt: "Birdflows brandvalg: skrifttyper og farver til en psykologs hjemmeside",
    swatches: "Farver",
    type: "Typografi",
    sample: "Overskrift",
  },
  en: {
    alt: "Birdflow's brand choices: typefaces and colours for a psychologist's website",
    swatches: "Colours",
    type: "Typography",
    sample: "Heading",
  },
};

/** The real brand editor, framed, with the two choices it is about called out. */
export function BrandVisual() {
  const { lang } = useLocale();
  const t = pick(BRAND_COPY, lang);

  return (
    <div className="relative w-full">
      <div
        className="rounded-[16px] overflow-hidden bg-white border border-black/[0.07]"
        style={{ boxShadow: "0 24px 60px rgba(20,5,40,0.16)" }}
      >
        <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-black/[0.07]">
          <span className="w-2 h-2 rounded-full" style={{ background: "#E06B5E" }} />
          <span className="w-2 h-2 rounded-full" style={{ background: "#E3B341" }} />
          <span className="w-2 h-2 rounded-full" style={{ background: "#5BAE73" }} />
          <Bird className="w-[18px] h-[15px] ml-2" style={{ color: PURPLE }} />
        </div>
        <picture>
          <source media="(max-width: 767px)" srcSet="/assets/home-redesign/brand-editor-mobile.png" />
          <img
            src="/assets/home-redesign/brand-editor-desktop.png"
            alt={t.alt}
            width={560}
            height={351}
            decoding="async"
            className="block w-full h-auto"
          />
        </picture>
      </div>

      {/* the two choices the section names, lifted off the screenshot */}
      <div
        className="hidden sm:flex absolute -left-4 bottom-6 flex-col gap-2 rounded-[13px] bg-white px-3.5 py-3 border border-black/[0.07]"
        style={{ boxShadow: "0 14px 34px rgba(20,5,40,0.16)" }}
        aria-hidden="true"
      >
        <span className="text-[10.5px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.5)" }}>
          {t.swatches.toUpperCase()}
        </span>
        <span className="flex gap-1.5">
          {[PURPLE, BLUE, GREEN, "#B96D4A", LIME].map((c) => (
            <span
              key={c}
              className="w-5 h-5 rounded-full border border-black/[0.08]"
              style={{ background: c }}
            />
          ))}
        </span>
      </div>

      <div
        className="hidden sm:block absolute -right-3 top-8 rounded-[13px] bg-white px-4 py-3 border border-black/[0.07]"
        style={{ boxShadow: "0 14px 34px rgba(20,5,40,0.16)" }}
        aria-hidden="true"
      >
        <span className="block text-[10.5px] font-extrabold tracking-[0.12em]" style={{ color: "rgba(0,0,0,0.5)" }}>
          {t.type.toUpperCase()}
        </span>
        <span className="bf2-display block text-[22px] leading-tight mt-1">{t.sample}</span>
      </div>
    </div>
  );
}

/* ═══════════ 05 · the whole system, in one board ═══════════ */

type SystemCopy = {
  ariaLabel: string;
  nav: string[];
  siteName: string;
  live: string;
  canvasTitle: string;
  blocks: Array<{ label: string; note: string }>;
  selected: string;
  panelTitle: string;
  panelRows: Array<{ label: string; value: string }>;
  running: string[];
};

const SYSTEM_COPY: Record<Lang, SystemCopy> = {
  da: {
    ariaLabel:
      "Birdflow-systemet: en menu med overblik, hjemmeside, booking, henvendelser, mails, webshop og analyse; midt i redigeres siden sektion for sektion; til højre vælges farver, typografi og afstand.",
    nav: ["Overblik", "Hjemmeside", "Booking", "Henvendelser", "Mails", "Webshop", "Analyse"],
    siteName: "Psykolog Sofie Lund",
    live: "Live",
    canvasTitle: "Forside",
    blocks: [
      { label: "Forsidebillede", note: "Overskrift, tekst og knap" },
      { label: "Om mig", note: "Tekst og portræt" },
      { label: "Ydelser", note: "Tre kort med priser" },
      { label: "Book en tid", note: "Booking slået til" },
    ],
    selected: "Valgt",
    panelTitle: "Udtryk",
    panelRows: [
      { label: "Farver", value: "Rolig" },
      { label: "Typografi", value: "Serif" },
      { label: "Afstand", value: "Luftig" },
      { label: "Hjørner", value: "Bløde" },
    ],
    running: ["Hosting", "Domæne", "Booking", "Mails", "Betaling", "Analyse"],
  },
  en: {
    ariaLabel:
      "The Birdflow system: a menu with overview, website, booking, enquiries, emails, webshop and analytics; the page is edited section by section in the middle; colours, typography and spacing are chosen on the right.",
    nav: ["Overview", "Website", "Booking", "Enquiries", "Emails", "Webshop", "Analytics"],
    siteName: "Psykolog Sofie Lund",
    live: "Live",
    canvasTitle: "Home",
    blocks: [
      { label: "Hero image", note: "Heading, text and button" },
      { label: "About me", note: "Text and portrait" },
      { label: "Services", note: "Three cards with prices" },
      { label: "Book a time", note: "Booking switched on" },
    ],
    selected: "Selected",
    panelTitle: "Look",
    panelRows: [
      { label: "Colours", value: "Calm" },
      { label: "Typography", value: "Serif" },
      { label: "Spacing", value: "Airy" },
      { label: "Corners", value: "Soft" },
    ],
    running: ["Hosting", "Domain", "Booking", "Emails", "Payment", "Analytics"],
  },
};

/** The system board at its design width — 980px — for ScaleToFit to shrink. */
function SystemBoard({ t }: { t: SystemCopy }) {
  return (
    <div
      className="rounded-[18px] overflow-hidden bg-white border border-black/[0.08]"
      style={{ boxShadow: "0 30px 76px rgba(20,5,40,0.16)" }}
    >
      {/* platform bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-black/[0.07]">
        <Bird className="w-[22px] h-[18px]" style={{ color: PURPLE }} />
        <span className="text-[13.5px] font-extrabold">{t.siteName}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-extrabold" style={{ color: GREEN }}>
          <span className="w-[7px] h-[7px] rounded-full" style={{ background: GREEN }} />
          {t.live}
        </span>
      </div>

      <div className="flex">
        {/* left rail */}
        <div className="w-[186px] shrink-0 border-r border-black/[0.07] py-4">
          {t.nav.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2.5 mx-2.5 px-3 py-2 rounded-[9px] text-[13px] font-extrabold"
              style={
                i === 1
                  ? { background: "rgba(128,22,195,0.1)", color: PURPLE }
                  : { color: "rgba(0,0,0,0.6)" }
              }
            >
              <span
                className="w-[7px] h-[7px] rounded-full shrink-0"
                style={{ background: i === 1 ? PURPLE : "rgba(0,0,0,0.2)" }}
              />
              {item}
            </div>
          ))}
        </div>

        {/* the page, block by block */}
        <div className="flex-1 min-w-0 p-5" style={{ background: "rgba(128,22,195,0.04)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[12px] font-extrabold tracking-[0.1em]" style={{ color: "rgba(0,0,0,0.5)" }}>
              {t.canvasTitle.toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {t.blocks.map((b, i) => (
              <div
                key={b.label}
                className="rounded-[11px] bg-white px-4 py-3 flex items-center gap-3"
                style={
                  i === 0
                    ? { border: `2px solid ${PURPLE}`, boxShadow: "0 8px 22px rgba(128,22,195,0.14)" }
                    : { border: "1px solid rgba(0,0,0,0.08)" }
                }
              >
                <span
                  className="w-[26px] h-[26px] rounded-[7px] shrink-0"
                  style={{ background: i === 0 ? "rgba(128,22,195,0.16)" : "rgba(0,0,0,0.06)" }}
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-extrabold leading-tight">{b.label}</span>
                  <span className="block text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.5)" }}>
                    {b.note}
                  </span>
                </span>
                {i === 0 && (
                  <span
                    className="ml-auto rounded-full px-2.5 py-1 text-[10.5px] font-extrabold text-white"
                    style={{ background: PURPLE }}
                  >
                    {t.selected}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* the look panel */}
        <div className="w-[212px] shrink-0 border-l border-black/[0.07] p-4">
          <span className="block text-[12px] font-extrabold tracking-[0.1em] mb-3" style={{ color: "rgba(0,0,0,0.5)" }}>
            {t.panelTitle.toUpperCase()}
          </span>
          <div className="flex gap-1.5 mb-4">
            {[PURPLE, BLUE, GREEN, "#B96D4A"].map((c) => (
              <span key={c} className="w-6 h-6 rounded-full border border-black/[0.08]" style={{ background: c }} />
            ))}
          </div>
          {t.panelRows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 border-t border-black/[0.06]">
              <span className="text-[12.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
                {r.label}
              </span>
              <span className="text-[12.5px] font-extrabold">{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* what runs underneath, all of it */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5 border-t border-black/[0.07]" style={{ background: LIME }}>
        {t.running.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[12px] font-extrabold border border-black/[0.07]"
          >
            <span className="w-[6px] h-[6px] rounded-full" style={{ background: GREEN }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The big system visual the design asks for, composed rather than screenshot. */
/** The phone composition. Not the desktop board shrunk: at 350px the
    three-column board scales to about a third and its labels stop being
    readable, so the phone gets the same content stacked at full size —
    the menu as a scrollable chip row, the page blocks, then the look
    choices. */
function SystemBoardPhone({ t }: { t: SystemCopy }) {
  return (
    <div
      className="rounded-[16px] overflow-hidden bg-white border border-black/[0.08]"
      style={{ boxShadow: "0 20px 48px rgba(20,5,40,0.14)" }}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.07]">
        <Bird className="w-[19px] h-[15px]" style={{ color: PURPLE }} />
        <span className="text-[12.5px] font-extrabold truncate">{t.siteName}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-extrabold shrink-0" style={{ color: GREEN }}>
          <span className="w-[6px] h-[6px] rounded-full" style={{ background: GREEN }} />
          {t.live}
        </span>
      </div>

      {/* the menu, swipeable rather than stacked */}
      <div className="flex gap-2 overflow-x-auto bf2-noscrollbar px-4 py-3 border-b border-black/[0.07]">
        {t.nav.map((item, i) => (
          <span
            key={item}
            className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-extrabold"
            style={
              i === 1
                ? { background: "rgba(128,22,195,0.1)", color: PURPLE }
                : { background: "rgba(0,0,0,0.045)", color: "rgba(0,0,0,0.6)" }
            }
          >
            {item}
          </span>
        ))}
      </div>

      <div className="p-4" style={{ background: "rgba(128,22,195,0.04)" }}>
        <span className="block text-[11px] font-extrabold tracking-[0.1em] mb-2.5" style={{ color: "rgba(0,0,0,0.5)" }}>
          {t.canvasTitle.toUpperCase()}
        </span>
        <div className="flex flex-col gap-2">
          {t.blocks.map((b, i) => (
            <div
              key={b.label}
              className="rounded-[10px] bg-white px-3 py-2.5 flex items-center gap-2.5"
              style={
                i === 0
                  ? { border: `2px solid ${PURPLE}`, boxShadow: "0 6px 16px rgba(128,22,195,0.12)" }
                  : { border: "1px solid rgba(0,0,0,0.08)" }
              }
            >
              <span
                className="w-[22px] h-[22px] rounded-[6px] shrink-0"
                style={{ background: i === 0 ? "rgba(128,22,195,0.16)" : "rgba(0,0,0,0.06)" }}
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-extrabold leading-tight">{b.label}</span>
                <span className="block text-[11px] font-bold truncate" style={{ color: "rgba(0,0,0,0.5)" }}>
                  {b.note}
                </span>
              </span>
              {i === 0 && (
                <span
                  className="ml-auto shrink-0 rounded-full px-2 py-[3px] text-[10px] font-extrabold text-white"
                  style={{ background: PURPLE }}
                >
                  {t.selected}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3.5 border-t border-black/[0.07]">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-extrabold tracking-[0.1em]" style={{ color: "rgba(0,0,0,0.5)" }}>
            {t.panelTitle.toUpperCase()}
          </span>
          <span className="flex gap-1.5 ml-auto">
            {[PURPLE, BLUE, GREEN, "#B96D4A"].map((c) => (
              <span key={c} className="w-5 h-5 rounded-full border border-black/[0.08]" style={{ background: c }} />
            ))}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
          {t.panelRows.map((r) => (
            <span key={r.label} className="text-[12px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
              {r.label} <span className="font-extrabold text-black">{r.value}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-t border-black/[0.07]" style={{ background: LIME }}>
        {t.running.map((r) => (
          <span
            key={r}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold border border-black/[0.07]"
          >
            <span className="w-[5px] h-[5px] rounded-full" style={{ background: GREEN }} />
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SystemVisual() {
  const { lang } = useLocale();
  const t = pick(SYSTEM_COPY, lang);

  return (
    <div role="img" aria-label={t.ariaLabel}>
      {/* phones: composed for the width it actually has */}
      <div className="sm:hidden">
        <SystemBoardPhone t={t} />
      </div>
      {/* tablets: the desktop board, scaled to fit */}
      <div className="hidden sm:block lg:hidden">
        <ScaleToFit designWidth={980}>
          <SystemBoard t={t} />
        </ScaleToFit>
      </div>
      {/* desktop: at full size */}
      <div className="hidden lg:block">
        <SystemBoard t={t} />
      </div>
    </div>
  );
}
