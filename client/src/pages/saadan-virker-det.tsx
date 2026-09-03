import type { ReactNode } from "react";
import { Link } from "wouter";
import { BLUE, BLUSH, LIME, PAGE_CSS, PURPLE } from "@/components/bf2/theme";
import {
  BirdDefs,
  CtaEnterWave,
  HeroExitWave,
  RevealOnView,
  SeamWave,
} from "@/components/bf2/primitives";
import { Nav, SIGNUP_HREF, useSignupLabel } from "@/components/bf2/Nav";
import { MarketingFooter } from "@/components/bf2/MarketingFooter";
import {
  AnalyticsMock,
  AnalyticsPhone,
  BookingMock,
  EconomyMock,
  EconomyPhone,
  EditorMock,
  MailEditorMock,
  MailsMock,
  OverviewMock,
  OverviewPhone,
  ShopMock,
  ShopPhone,
  SlotDialogMock,
} from "@/components/marketing/HowItWorksMocks";
import { useLocale, pick, type Lang } from "@/lib/locale";

/* ─────────────────────────────────────────────────────────────
   /saadan-virker-det — the platform explained, chapter by chapter.

   Purpose: a visitor who needs more than the homepage before they
   sign up. Every chapter maps to a module that ships today —
   OverviewSection, builder, BookingsSection/OpenSlotDialog,
   EmailSettingsCard, AnalyticsSection, EconomicsSection and
   ProductsSection/OrdersSection — so nothing here is aspirational.

   One exception, deliberately shipped ahead of the feature:
   chapter 04 says a mail can be held for your approval instead of
   sending automatically. Today EmailSettingsCard only offers
   on/off per mail type. This was approved on the basis that
   approval-before-send is releasing before this page goes live. If
   that slips, soften `mails.approve*` below and drop the
   "Godkendes af dig" row in HowItWorksMocks.tsx.

   The workspace visuals are rebuilt in HTML rather than
   screenshotted — see the note at the top of HowItWorksMocks.tsx.
   ───────────────────────────────────────────────────────────── */

type Chapter = {
  id: string;
  kicker: string;
  title: string;
  body: string[];
  /** Arrow list under the copy. */
  points?: string[];
  /** Caption under the visual. */
  caption: string;
  /** Small muted tag beside the kicker (the shop is optional). */
  tag?: string;
};

type Copy = {
  heroKicker: string;
  heroTitle: string;
  heroBody: string;
  jump: string;
  chapters: Record<
    "overblik" | "hjemmesiden" | "booking" | "mails" | "analyse" | "okonomi" | "butik",
    Chapter
  >;
  editorCards: Array<{ label: string; body: ReactNode }>;
  editorClosing: string;
  bookingIntro: string;
  bookingCalendarTitle: string;
  bookingCalendarBody: string;
  bookingSlotTitle: string;
  bookingSlotBody: string;
  mailsIntro: string;
  mailsListTitle: string;
  mailsListBody: string;
  mailsEditorCaption: string;
  butikClosing: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
  ctaNote: string;
  ctaSecondary: string;
  mockAlt: string;
};

const COPY: Record<Lang, Copy> = {
  da: {
    heroKicker: "SÅDAN VIRKER SYSTEMET",
    heroTitle: "Sådan virker Birdflow",
    heroBody:
      "Hjemmesiden er det, klienten møder. Bag den ligger booking, ledige tider, automatiske mails, tal, betaling og materialer — samlet i ét system. Herunder gennemgår vi hver del.",
    jump: "Spring til et afsnit",
    chapters: {
      overblik: {
        id: "overblik",
        kicker: "01 · OVERBLIK",
        title: "Én skærm, der samler dagen",
        body: [
          "Når du åbner Birdflow, ser du med det samme, hvad der kræver din opmærksomhed: dagens aftaler, nye henvendelser, besøg på siden og månedens omsætning.",
          "Hvert felt er en genvej. Klikker du på ulæste formularer, åbner listen med henvendelserne. Klikker du på bookinger i dag, åbner kalenderen på den dag. Du behøver ikke lede efter noget i en menu.",
        ],
        points: [
          "Dagens aftaler med tid og sted",
          "Ulæste henvendelser fra kontaktformularen",
          "Status på hjemmesiden og de automatiske mails",
        ],
        caption: "Overblik i Birdflow — vist med eksempeldata",
      },
      hjemmesiden: {
        id: "hjemmesiden",
        kicker: "02 · HJEMMESIDEN",
        title: "To klik. Så er sektionen væk — eller ny",
        body: [
          "Du redigerer hjemmesiden direkte på siden. Klik på en tekst og skriv. Skift skriftstørrelse, farve og billeder, mens du ser resultatet med det samme.",
        ],
        caption: "Editoren i Birdflow · og menuen der åbner ved klik på +",
      },
      booking: {
        id: "booking",
        kicker: "03 · BOOKING-ADMINISTRATION",
        title: "Du åbner tiderne. Klienten vælger inden for dem",
        body: [],
        caption: "",
      },
      mails: {
        id: "mails",
        kicker: "04 · AUTOMATISKE MAILS",
        title: "Du vælger, hvad der sender sig selv",
        body: [],
        caption: "",
      },
      analyse: {
        id: "analyse",
        kicker: "05 · ANALYSE",
        title: "Hvad bliver din side egentlig brugt til?",
        body: [
          "Enkelt overblik — ikke et marketingværktøj du skal lære at bruge. Du kan se:",
        ],
        points: [
          "Hvor mange der har besøgt siden, og om det stiger",
          "Hvilke sider de læser — f.eks. om »Samtaleterapi« bliver fundet",
          "Hvor de kommer fra: Google, sociale medier eller direkte",
          "Hvor mange der klikker videre til booking",
        ],
        caption: "Analyse i Birdflow — vist med eksempeldata",
      },
      okonomi: {
        id: "okonomi",
        kicker: "06 · ØKONOMI",
        title: "Faktureret, modtaget og udestående",
        body: [
          "Betalinger kører gennem din egen Stripe-konto — pengene går direkte til dig. Birdflow viser dig blot, hvad status er.",
        ],
        points: [
          "Fakturaer sendt, betalt og forfaldne",
          "Betaling ved booking eller faktura efter samtalen",
          "Månedens omsætning fra samtaler og materialer",
        ],
        caption: "Økonomi i Birdflow — vist med eksempeldata",
      },
      butik: {
        id: "butik",
        kicker: "07 · BUTIK",
        tag: "VALGFRI",
        title: "Sælger du andet end samtaler?",
        body: [
          "Nogle praksisser tilbyder mere end forløb: en arbejdsbog til stress, lydøvelser til uro, eller en pakke med materialer til et forløb. Det behøver ikke ligge i en separat webshop.",
          "Læg materialerne op med pris og billede, og de kan købes direkte på din hjemmeside. Ordrer, kvitteringer og forsendelse ligger i samme system som dine bookinger.",
        ],
        caption: "Butik i Birdflow — vist med eksempeldata",
      },
    },
    editorCards: [
      {
        label: "FJERN EN SEKTION",
        body: (
          <>
            Klik på sektionen <span className="opacity-45">→</span> tryk på slet-ikonet. Færdig.
          </>
        ),
      },
      {
        label: "TILFØJ EN SEKTION",
        body: (
          <>
            Hold musen mellem to sektioner — der kommer et <strong>+</strong> frem. Klik, vælg
            f.eks. »Booking« i listen, og sektionen sættes ind præcis der.
          </>
        ),
      },
    ],
    editorClosing: "Ingen plugins, ingen opdateringer, ingen kode. Og intet går live, før du trykker Udgiv.",
    bookingIntro:
      "Booking i Birdflow er to ting, der hænger sammen: de tider du lægger ud, og de bookinger der kommer ind. Ingen kan booke en tid, du ikke selv har åbnet.",
    bookingCalendarTitle: "Kalenderen: alt det bookede",
    bookingCalendarBody:
      "Bookinger fra hjemmesiden lander direkte her. Skift mellem liste, uge og måned, se hvem der har booket hvad, og ret eller aflys en aftale — så sendes beskeden til klienten automatisk.",
    bookingSlotTitle: "Ledige tider: rammerne du sætter",
    bookingSlotBody:
      "Opret en ledig tid med dato, tidspunkt og varighed, knyt den til en ydelse eller en behandler, og tilføj en intern note. Lukker du en tid, forsvinder den fra hjemmesiden med det samme.",
    mailsIntro:
      "For hver mailtype bestemmer du, om den skal sendes automatisk, eller om den skal ligge klar til din godkendelse først. Bekræftelser kører typisk automatisk — svar på henvendelser vil mange gerne læse igennem selv, inden de går ud.",
    mailsListTitle: "Slå til, slå fra, eller godkend selv",
    mailsListBody:
      "Bookingbekræftelse, ændring, aflysning, besked om ny henvendelse og påmindelse før aftalen. Du sætter selv, hvor mange timer før påmindelsen skal gå ud.",
    mailsEditorCaption: "Redigering af en enkelt mail — med live forhåndsvisning",
    butikClosing: "Bruger du det ikke, slår du bare butikken fra — så er den ikke en del af din side.",
    ctaTitle: "Kom i gang med din praksis",
    ctaBody:
      "Opret en konto, fortæl om din praksis, og se et udkast til hjemmesiden. Booking, henvendelser og mails sættes op omkring den.",
    ctaButton: "Kom i gang",
    ctaNote: "Ingen teknisk forberedelse",
    ctaSecondary: "Se priser",
    mockAlt: "Eksempel på Birdflow-arbejdsrummet",
  },
  en: {
    heroKicker: "HOW THE SYSTEM WORKS",
    heroTitle: "How Birdflow works",
    heroBody:
      "The website is what your client meets. Behind it sit booking, open slots, automatic emails, figures, payment and materials — gathered in one system. Below we walk through each part.",
    jump: "Jump to a section",
    chapters: {
      overblik: {
        id: "overblik",
        kicker: "01 · OVERVIEW",
        title: "One screen that gathers the day",
        body: [
          "When you open Birdflow you see straight away what needs you: today's appointments, new enquiries, visits to the site and the month's revenue.",
          "Every tile is a shortcut. Click unread forms and the enquiry list opens. Click today's bookings and the calendar opens on that day. Nothing has to be hunted for in a menu.",
        ],
        points: [
          "Today's appointments with time and place",
          "Unread enquiries from the contact form",
          "Status of the website and the automatic emails",
        ],
        caption: "Overview in Birdflow — shown with example data",
      },
      hjemmesiden: {
        id: "hjemmesiden",
        kicker: "02 · THE WEBSITE",
        title: "Two clicks. The section is gone — or new",
        body: [
          "You edit the website directly on the page. Click a piece of text and type. Change type size, colour and images while you watch the result.",
        ],
        caption: "The Birdflow editor · and the menu that opens on +",
      },
      booking: {
        id: "booking",
        kicker: "03 · BOOKING ADMINISTRATION",
        title: "You open the times. Clients choose within them",
        body: [],
        caption: "",
      },
      mails: {
        id: "mails",
        kicker: "04 · AUTOMATIC EMAILS",
        title: "You decide what sends itself",
        body: [],
        caption: "",
      },
      analyse: {
        id: "analyse",
        kicker: "05 · ANALYTICS",
        title: "What is your site actually used for?",
        body: ["A plain overview — not a marketing tool you have to learn. You can see:"],
        points: [
          "How many have visited, and whether it is rising",
          "Which pages they read — whether “Talk therapy” is being found",
          "Where they come from: Google, social media or direct",
          "How many click through to booking",
        ],
        caption: "Analytics in Birdflow — shown with example data",
      },
      okonomi: {
        id: "okonomi",
        kicker: "06 · FINANCES",
        title: "Invoiced, received and outstanding",
        body: [
          "Payments run through your own Stripe account — the money goes straight to you. Birdflow simply shows you where things stand.",
        ],
        points: [
          "Invoices sent, paid and overdue",
          "Payment at booking, or an invoice after the session",
          "The month's revenue from sessions and materials",
        ],
        caption: "Finances in Birdflow — shown with example data",
      },
      butik: {
        id: "butik",
        kicker: "07 · SHOP",
        tag: "OPTIONAL",
        title: "Do you sell more than sessions?",
        body: [
          "Some practices offer more than courses of treatment: a workbook for stress, audio exercises for restlessness, or a pack of materials for a programme. That does not need a separate webshop.",
          "Add the materials with a price and an image and they can be bought straight from your website. Orders, receipts and shipping sit in the same system as your bookings.",
        ],
        caption: "Shop in Birdflow — shown with example data",
      },
    },
    editorCards: [
      {
        label: "REMOVE A SECTION",
        body: (
          <>
            Click the section <span className="opacity-45">→</span> press the delete icon. Done.
          </>
        ),
      },
      {
        label: "ADD A SECTION",
        body: (
          <>
            Hover between two sections — a <strong>+</strong> appears. Click it, pick e.g.
            &ldquo;Booking&rdquo; from the list, and the section drops in exactly there.
          </>
        ),
      },
    ],
    editorClosing:
      "No plugins, no updates, no code. And nothing goes live until you press Publish.",
    bookingIntro:
      "Booking in Birdflow is two things that hang together: the times you put out, and the bookings that come in. Nobody can book a time you have not opened yourself.",
    bookingCalendarTitle: "The calendar: everything booked",
    bookingCalendarBody:
      "Bookings from the website land straight here. Switch between list, week and month, see who booked what, and change or cancel an appointment — the message goes to the client automatically.",
    bookingSlotTitle: "Open times: the frame you set",
    bookingSlotBody:
      "Create an open slot with date, time and duration, attach it to a service or a practitioner, and add an internal note. Close a slot and it disappears from the website immediately.",
    mailsIntro:
      "For each type of email you decide whether it sends automatically, or waits for your approval first. Confirmations usually run automatically — replies to enquiries are something many prefer to read through before they go out.",
    mailsListTitle: "Switch on, switch off, or approve yourself",
    mailsListBody:
      "Booking confirmation, change, cancellation, notice of a new enquiry, and the reminder before the appointment. You set how many hours ahead the reminder goes out.",
    mailsEditorCaption: "Editing a single email — with live preview",
    butikClosing: "If you don't use it, switch the shop off — then it is not part of your site.",
    ctaTitle: "Get started with your practice",
    ctaBody:
      "Create an account, tell us about your practice, and see a draft of the website. Booking, enquiries and emails are set up around it.",
    ctaButton: "Get started",
    ctaNote: "No technical preparation",
    ctaSecondary: "See pricing",
    mockAlt: "Example of the Birdflow workspace",
  },
};

/* ─────────── layout helpers ─────────── */

/** "01 · OVERBLIK" → "Overblik" for the hero jump chips. */
function chipLabel(kicker: string): string {
  const name = kicker.split("·").pop()?.trim() ?? kicker;
  return name.charAt(0) + name.slice(1).toLowerCase();
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p
      className="m-0 text-[12px] font-extrabold tracking-[0.14em]"
      style={{ color: PURPLE }}
    >
      {children}
    </p>
  );
}

function ChapterHeading({ chapter }: { chapter: Chapter }) {
  return (
    <>
      <Kicker>
        {chapter.kicker}
        {chapter.tag && <span className="ml-2 opacity-45 text-black">{chapter.tag}</span>}
      </Kicker>
      <h2 className="m-0 mt-3.5 text-[clamp(26px,4.6vw,38px)] leading-[1.16] font-black tracking-[-0.01em]">
        {chapter.title}
      </h2>
    </>
  );
}

function Points({ items }: { items: string[] }) {
  return (
    <ul className="m-0 mt-5 p-0 list-none max-w-[430px]">
      {items.map((item, i) => (
        <li
          key={item}
          className="flex gap-3 py-2.5 text-[16.5px] font-bold"
          style={{
            borderTop: "1.5px solid rgba(0,0,0,0.1)",
            borderBottom: i === items.length - 1 ? "1.5px solid rgba(0,0,0,0.1)" : undefined,
          }}
        >
          <span className="font-black flex-none" style={{ color: BLUE }} aria-hidden="true">
            →
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Figure wrapper: the caption is the accessible description of the mock. */
function Visual({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="m-0">
      <div aria-hidden="true">{children}</div>
      <figcaption className="mt-3.5 ml-0.5 text-[13px] font-extrabold" style={{ color: PURPLE }}>
        {caption}
      </figcaption>
    </figure>
  );
}

/** Two-column chapter: copy on one side, visual on the other. */
function SplitChapter({
  chapter,
  reverse = false,
  children,
  extra,
}: {
  chapter: Chapter;
  reverse?: boolean;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section id={chapter.id} className="scroll-mt-24">
      <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
        <RevealOnView>
          <div
            className={`flex flex-wrap gap-10 lg:gap-12 items-center ${
              reverse ? "flex-row-reverse" : ""
            }`}
          >
            <div className="flex-[1_1_360px] min-w-[min(100%,280px)] max-w-[470px]">
              <ChapterHeading chapter={chapter} />
              {chapter.body.map((p) => (
                <p key={p} className="m-0 mt-4 text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
                  {p}
                </p>
              ))}
              {chapter.points && <Points items={chapter.points} />}
              {extra}
            </div>
            <div className="flex-[1_1_560px] min-w-[min(100%,280px)]">{children}</div>
          </div>
        </RevealOnView>
      </div>
    </section>
  );
}

/** Swaps the desktop workspace for the phone frame at 900px. */
function Responsive({ full, phone }: { full: ReactNode; phone: ReactNode }) {
  return (
    <>
      <div className="hidden min-[900px]:block">{full}</div>
      <div className="min-[900px]:hidden">{phone}</div>
    </>
  );
}

export default function SaadanVirkerDetPage() {
  const { lang } = useLocale();
  const t = pick(COPY, lang);
  const signupLabel = useSignupLabel();
  const c = t.chapters;

  const chips = [c.overblik, c.hjemmesiden, c.booking, c.mails, c.analyse, c.okonomi, c.butik];

  return (
    <div
      className="bf2-page min-h-screen"
      style={{ fontFamily: "'Nunito', sans-serif", color: "#000", background: LIME }}
    >
      <style>{PAGE_CSS}</style>
      <BirdDefs />
      <Nav />

      <main>
        {/* Hero */}
        <section style={{ background: PURPLE }} data-testid="section-hiw-hero">
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 pt-12 pb-6 lg:pt-16">
            <p className="m-0 text-[12.5px] font-extrabold tracking-[0.16em] text-white/70">
              {t.heroKicker}
            </p>
            <h1 className="bf2-display m-0 mt-4 max-w-[920px] text-white text-[clamp(31px,5.6vw,54px)] leading-[1.14]">
              {t.heroTitle}
            </h1>
            <p className="m-0 mt-5 max-w-[700px] text-[clamp(17px,1.7vw,20px)] leading-[1.65] text-white/[0.88]">
              {t.heroBody}
            </p>
            <nav aria-label={t.jump} className="flex gap-2.5 mt-7 flex-wrap">
              {chips.map((chapter) => (
                <a
                  key={chapter.id}
                  href={`#${chapter.id}`}
                  className="no-underline text-[13.5px] font-extrabold whitespace-nowrap text-white rounded-full px-4 py-2 border-[1.5px] border-white/[0.28] bg-white/[0.14] hover:bg-white/25 transition-colors"
                >
                  {chipLabel(chapter.kicker)}
                </a>
              ))}
            </nav>
          </div>
          <HeroExitWave into={LIME} />
        </section>

        {/* 01 · Overblik */}
        <div style={{ background: LIME }}>
          <SplitChapter chapter={c.overblik}>
            <Visual caption={c.overblik.caption}>
              <Responsive full={<OverviewMock />} phone={<OverviewPhone />} />
            </Visual>
          </SplitChapter>
        </div>

        <SeamWave top={LIME} bottom={BLUSH} />

        {/* 02 · Hjemmesiden */}
        <div style={{ background: BLUSH }}>
          <SplitChapter
            chapter={c.hjemmesiden}
            reverse
            extra={
              <>
                <div className="mt-5 max-w-[440px] flex flex-col gap-3">
                  {t.editorCards.map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-xl px-5 py-4"
                      style={{ border: "1.5px solid rgba(128,22,195,0.25)" }}
                    >
                      <p
                        className="m-0 text-[11px] font-extrabold tracking-[0.12em]"
                        style={{ color: PURPLE }}
                      >
                        {card.label}
                      </p>
                      <p className="m-0 mt-2 text-[16.5px] leading-[1.55] font-bold">{card.body}</p>
                    </div>
                  ))}
                </div>
                <p className="m-0 mt-5 text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
                  {t.editorClosing}
                </p>
              </>
            }
          >
            <Visual caption={c.hjemmesiden.caption}>
              <EditorMock />
            </Visual>
          </SplitChapter>
        </div>

        <SeamWave top={BLUSH} bottom={LIME} />

        {/* 03 · Booking */}
        <section id={c.booking.id} className="scroll-mt-24" style={{ background: LIME }}>
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <RevealOnView>
              <div className="max-w-[760px]">
                <ChapterHeading chapter={c.booking} />
                <p className="m-0 mt-4 text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
                  {t.bookingIntro}
                </p>
              </div>
              <div className="flex flex-wrap gap-10 mt-9 items-start">
                <div className="flex-[1_1_480px] min-w-[min(100%,280px)]">
                  <div aria-hidden="true">
                    <BookingMock />
                  </div>
                  <h3 className="m-0 mt-3.5 text-[20px] font-black">{t.bookingCalendarTitle}</h3>
                  <p className="m-0 mt-2 max-w-[520px] text-[clamp(16px,1.5vw,17.5px)] leading-[1.6]">
                    {t.bookingCalendarBody}
                  </p>
                </div>
                <div className="flex-[1_1_360px] min-w-[min(100%,280px)]">
                  <div aria-hidden="true">
                    <SlotDialogMock />
                  </div>
                  <h3 className="m-0 mt-3.5 text-[20px] font-black">{t.bookingSlotTitle}</h3>
                  <p className="m-0 mt-2 max-w-[480px] text-[clamp(16px,1.5vw,17.5px)] leading-[1.6]">
                    {t.bookingSlotBody}
                  </p>
                </div>
              </div>
            </RevealOnView>
          </div>
        </section>

        <SeamWave top={LIME} bottom={BLUSH} />

        {/* 04 · Automatiske mails */}
        <section id={c.mails.id} className="scroll-mt-24" style={{ background: BLUSH }}>
          <div className="max-w-[1240px] mx-auto px-5 md:px-9 py-12 lg:py-20">
            <RevealOnView>
              <div className="max-w-[760px]">
                <ChapterHeading chapter={c.mails} />
                <p className="m-0 mt-4 text-[clamp(16.5px,1.6vw,19px)] leading-[1.65]">
                  {t.mailsIntro}
                </p>
              </div>
              <div className="flex flex-wrap gap-10 mt-9 items-start">
                <div className="flex-[1_1_440px] min-w-[min(100%,280px)]">
                  <div aria-hidden="true">
                    <MailsMock />
                  </div>
                  <h3 className="m-0 mt-3.5 text-[20px] font-black">{t.mailsListTitle}</h3>
                  <p className="m-0 mt-2 max-w-[520px] text-[clamp(16px,1.5vw,17.5px)] leading-[1.6]">
                    {t.mailsListBody}
                  </p>
                </div>
                <div className="flex-[1_1_420px] min-w-[min(100%,280px)]">
                  <Visual caption={t.mailsEditorCaption}>
                    <MailEditorMock />
                  </Visual>
                </div>
              </div>
            </RevealOnView>
          </div>
        </section>

        <SeamWave top={BLUSH} bottom={LIME} />

        {/* 05 · Analyse */}
        <div style={{ background: LIME }}>
          <SplitChapter chapter={c.analyse}>
            <Visual caption={c.analyse.caption}>
              <Responsive full={<AnalyticsMock />} phone={<AnalyticsPhone />} />
            </Visual>
          </SplitChapter>
        </div>

        <SeamWave top={LIME} bottom={BLUSH} />

        {/* 06 · Økonomi */}
        <div style={{ background: BLUSH }}>
          <SplitChapter chapter={c.okonomi} reverse>
            <Visual caption={c.okonomi.caption}>
              <Responsive full={<EconomyMock />} phone={<EconomyPhone />} />
            </Visual>
          </SplitChapter>
        </div>

        <SeamWave top={BLUSH} bottom={LIME} />

        {/* 07 · Butik */}
        <div style={{ background: LIME }}>
          <SplitChapter
            chapter={c.butik}
            extra={
              <p
                className="m-0 mt-4 text-[16.5px] leading-[1.6] font-extrabold"
                style={{ color: PURPLE }}
              >
                {t.butikClosing}
              </p>
            }
          >
            <Visual caption={c.butik.caption}>
              <Responsive full={<ShopMock />} phone={<ShopPhone />} />
            </Visual>
          </SplitChapter>
        </div>

        <CtaEnterWave from={LIME} />

        {/* Closing CTA */}
        <section style={{ background: PURPLE }} data-testid="section-hiw-cta">
          <div className="max-w-[900px] mx-auto px-5 md:px-9 pb-16 lg:pb-24 text-center">
            <h2 className="bf2-display m-0 text-white text-[clamp(28px,4.8vw,46px)] leading-[1.18]">
              {t.ctaTitle}
            </h2>
            <p className="m-0 mt-5 mx-auto max-w-[560px] text-[clamp(16.5px,1.6vw,19px)] leading-[1.65] text-white/[0.86]">
              {t.ctaBody}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={SIGNUP_HREF}
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] hover:brightness-110 transition"
                style={{ background: BLUE, boxShadow: "0 8px 24px rgba(10,2,25,0.38)" }}
                data-testid="button-hiw-signup"
              >
                {signupLabel}
              </Link>
              <Link
                href="/pricing"
                className="inline-block text-white no-underline text-[17px] font-extrabold px-[30px] py-[15px] rounded-[10px] border-2 border-white/45 hover:bg-white/10 transition-colors"
                data-testid="button-hiw-pricing"
              >
                {t.ctaSecondary}
              </Link>
            </div>
            <p className="m-0 mt-4 text-[15px] font-extrabold text-white/[0.68]">{t.ctaNote}</p>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
