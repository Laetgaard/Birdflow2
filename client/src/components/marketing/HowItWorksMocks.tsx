import type { ReactNode } from "react";
import { BLUE, GREEN, PURPLE } from "@/components/bf2/theme";
import { Bird } from "@/components/bf2/primitives";

/* ─────────────────────────────────────────────────────────────
   Reconstructions of the Birdflow workspace for /saadan-virker-det.

   Why these are built in HTML rather than screenshotted: every
   screenshot we hold — including the ones already shipping on the
   homepage — is the "WOOL" demo site, badged "Kladde", with empty
   datasets (0 bookings, 0 kr., "Ingen kommende bookinger"). Showing
   a practitioner an empty webshop is the opposite of what these
   sections claim, so the workspace is rebuilt here with realistic
   figures for an example practice.

   Everything structural is taken from the real product: the sidebar
   groups (BOOKINGER / SHOP / KUNDER), the section names, the booking
   toolbar, and the "Ny ledig tid" field list all match what the app
   actually renders. Only the data is invented.

   The labels inside these mocks stay Danish in both languages,
   because the logged-in product is Danish whatever the visitor
   picked — see PUBLIC_MARKETING_PATHS in lib/locale.tsx. Localising
   them would show an English workspace that does not exist. The
   marketing copy and captions around them are bilingual.

   Each mock is decorative: the surrounding section states every fact
   in real text, so these carry aria-hidden and the figure supplies
   the accessible description.
   ───────────────────────────────────────────────────────────── */

const LINE = "1px solid rgba(0,0,0,0.09)";
const LINE_SOFT = "1px solid rgba(0,0,0,0.06)";
const MUTED = "rgba(0,0,0,0.45)";

/** White workspace card with the design's border, radius and lift. */
export function MockFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white overflow-hidden rounded-[16px] ${className}`}
      style={{ border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 30px 70px rgba(20,5,40,0.2)" }}
    >
      {children}
    </div>
  );
}

/* The real workspace sidebar: grouped exactly as the product groups it. */
const SIDEBAR_GROUPS: Array<{ heading?: string; items: string[] }> = [
  { items: ["Overblik"] },
  { heading: "BOOKINGER", items: ["Bookinger", "Ydelser & tider", "Team"] },
  { heading: "SHOP", items: ["Ordrer", "Produkter", "Forsendelse"] },
  { heading: "KUNDER", items: ["Kunder", "Formularer"] },
  { items: ["Analytics", "Økonomi"] },
];

export function MockSidebar({ active, badge }: { active: string; badge?: Record<string, string> }) {
  return (
    <div
      className="flex-none w-[clamp(112px,22%,190px)] py-4"
      style={{ background: "#FBFAFD", borderRight: LINE }}
    >
      <div className="flex items-center gap-2 px-3 lg:px-4 pb-3">
        <span
          className="grid place-items-center w-6 h-6 rounded-lg flex-none"
          style={{ background: "rgba(48,109,218,0.12)" }}
        >
          <Bird className="w-3.5 h-3" style={{ color: BLUE }} />
        </span>
        <span className="min-w-0">
          <span className="block text-[12.5px] font-extrabold leading-tight truncate">
            Sofie Lund
          </span>
          <span
            className="inline-block mt-0.5 text-[8.5px] font-extrabold px-1.5 py-px rounded"
            style={{ background: "rgba(46,125,79,0.12)", color: GREEN }}
          >
            Udgivet
          </span>
        </span>
      </div>

      {SIDEBAR_GROUPS.map((group, gi) => (
        <div key={gi} className={gi === 0 ? "" : "mt-2"}>
          {group.heading && (
            <p
              className="m-0 px-3 lg:px-4 pt-2 pb-1 text-[8.5px] font-extrabold tracking-[0.1em]"
              style={{ color: MUTED }}
            >
              {group.heading}
            </p>
          )}
          {group.items.map((item) => {
            const on = item === active;
            return (
              <div
                key={item}
                className="flex items-center gap-1 px-3 lg:px-4 py-[7px] text-[11.5px] leading-tight"
                style={
                  on
                    ? {
                        color: BLUE,
                        fontWeight: 800,
                        background: "rgba(48,109,218,0.08)",
                        borderLeft: `2.5px solid ${BLUE}`,
                        paddingLeft: "calc(0.75rem - 2.5px)",
                      }
                    : { color: "rgba(0,0,0,0.6)", fontWeight: 700 }
                }
              >
                <span className="truncate">{item}</span>
                {badge?.[item] && (
                  <span
                    className="ml-auto flex-none text-[9px] font-extrabold rounded-full px-1.5 py-px text-white"
                    style={{ background: PURPLE }}
                  >
                    {badge[item]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Small labelled figure tile, as used across the workspace. */
export function StatCard({
  label,
  value,
  note,
  valueColor,
  noteColor,
}: {
  label: string;
  value: string;
  note?: string;
  valueColor?: string;
  noteColor?: string;
}) {
  return (
    <div className="rounded-[11px] px-3.5 py-3" style={{ border: LINE }}>
      <p className="m-0 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="m-0 mt-1 text-[20px] font-black leading-none" style={{ color: valueColor }}>
        {value}
      </p>
      {note && (
        <p
          className="m-0 mt-1 text-[10.5px] font-extrabold"
          style={{ color: noteColor ?? "rgba(0,0,0,0.5)" }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

/** Phone-shaped frame with the product's bottom tab bar, shown under 900px. */
export function PhoneFrame({
  title,
  active,
  children,
}: {
  title: string;
  active: "Overblik" | "Booking" | "Kunder" | "Mere";
  children: ReactNode;
}) {
  const tabs: Array<typeof active> = ["Overblik", "Booking", "Kunder", "Mere"];
  return (
    <div className="flex justify-center w-full">
      <div
        className="w-full max-w-[320px] bg-white rounded-[26px] overflow-hidden"
        style={{ border: LINE, boxShadow: "0 22px 54px rgba(20,5,40,0.2)" }}
      >
        <div className="flex items-center gap-2 px-4 pt-3 pb-2.5" style={{ borderBottom: LINE_SOFT }}>
          <Bird className="w-[17px] h-3.5" style={{ color: BLUE }} />
          <span className="text-[13px] font-black">{title}</span>
        </div>
        <div className="px-4 pt-3.5 pb-4">{children}</div>
        <div className="flex px-2 pt-2 pb-3" style={{ borderTop: LINE_SOFT, background: "#FDFDFB" }}>
          {tabs.map((tab) => {
            const on = tab === active;
            return (
              <span
                key={tab}
                className="flex-1 text-center text-[10px] font-extrabold"
                style={{ color: on ? BLUE : MUTED }}
              >
                <span
                  className="block w-[18px] h-[18px] mx-auto mb-1 rounded-md"
                  style={{ background: on ? "rgba(48,109,218,0.15)" : "rgba(0,0,0,0.07)" }}
                />
                {tab}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Two-column grid of small tiles, the phone layout for every figure block. */
export function PhoneStats({ items }: { items: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => (
        <div key={item.label} className="rounded-[11px] px-3 py-2.5" style={{ border: LINE }}>
          <p className="m-0 text-[9px] font-extrabold tracking-[0.08em]" style={{ color: MUTED }}>
            {item.label}
          </p>
          <p className="m-0 mt-1 text-[19px] font-black leading-none" style={{ color: item.color }}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export { LINE, LINE_SOFT, MUTED };

/* ─────────── 01 · Overblik ─────────── */

const TODAY = [
  { time: "10.00", what: "Individuel samtale", where: "Klinik", accent: false },
  { time: "13.30", what: "Første samtale · ny booking", where: "Online", accent: true },
  { time: "15.00", what: "Parsamtale", where: "Klinik", accent: false },
];

export function OverviewMock() {
  return (
    <MockFrame className="flex" >
      <MockSidebar active="Overblik" badge={{ Formularer: "4" }} />
      <div className="flex-1 min-w-0 px-4 lg:px-6 pt-5 pb-6">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[20px] font-black tracking-[-0.01em]">God formiddag, Sofie</span>
          <span className="text-[12.5px] font-bold" style={{ color: MUTED }}>
            Tirsdag d. 14. oktober
          </span>
        </div>

        <div className="grid gap-2.5 mt-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(104px,1fr))" }}>
          <StatCard label="BOOKINGER I DAG" value="3" note="Næste kl. 13.30" noteColor={BLUE} />
          <StatCard label="ULÆSTE FORMULARER" value="4" valueColor={PURPLE} note="Siden i går" />
          <StatCard label="SIDEVISNINGER" value="184" note="+18 % på 7 dage" noteColor={GREEN} />
          <StatCard label="OMSÆTNING I DAG" value="2.500 kr." note="18.400 kr. i oktober" />
        </div>

        <div className="mt-3.5 rounded-[11px] px-4 py-3" style={{ border: LINE }}>
          <p className="m-0 mb-1 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            KOMMENDE BOOKINGER
          </p>
          {TODAY.map((row, i) => (
            <div
              key={row.time}
              className="flex gap-3 items-baseline py-2"
              style={i < TODAY.length - 1 ? { borderBottom: LINE_SOFT } : undefined}
            >
              <span
                className="text-[13px] font-extrabold w-[42px] flex-none"
                style={row.accent ? { color: BLUE } : undefined}
              >
                {row.time}
              </span>
              <span
                className="text-[13px] font-bold min-w-0 truncate"
                style={row.accent ? { color: BLUE, fontWeight: 800 } : undefined}
              >
                {row.what}
              </span>
              <span className="ml-auto flex-none text-[11.5px] font-bold" style={{ color: MUTED }}>
                {row.where}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 mt-3 flex-wrap">
          {[
            ["Hjemmeside udgivet", GREEN],
            ["Bekræftelsesmail aktiv", GREEN],
            ["Påmindelse planlagt", PURPLE],
          ].map(([label, color]) => (
            <span
              key={label}
              className="text-[11.5px] font-extrabold whitespace-nowrap rounded-full px-3 py-[5px]"
              style={{ color, background: `${color}1A` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </MockFrame>
  );
}

export function OverviewPhone() {
  return (
    <PhoneFrame title="God formiddag, Sofie" active="Overblik">
      <PhoneStats
        items={[
          { label: "I DAG", value: "3" },
          { label: "FORMULARER", value: "4", color: PURPLE },
          { label: "BESØG", value: "184" },
          { label: "OMSÆTNING", value: "18.400" },
        ]}
      />
      <div className="mt-3 rounded-[11px] px-3 py-3" style={{ border: LINE }}>
        <p className="m-0 mb-1.5 text-[9px] font-extrabold tracking-[0.08em]" style={{ color: MUTED }}>
          NÆSTE
        </p>
        <div className="flex gap-2.5 items-baseline">
          <span className="text-[13px] font-black" style={{ color: BLUE }}>
            13.30
          </span>
          <span className="text-[12.5px] font-bold">Første samtale · online</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ─────────── 02 · Hjemmesiden ─────────── */

const SECTION_MENU = ["Booking", "Ydelser & priser", "Om mig", "Ofte stillede spørgsmål", "Kontaktformular"];

/** The site editor: canvas with a selected section, plus the insert menu. */
export function EditorMock() {
  return (
    <div className="relative">
      <MockFrame className="flex">
        <div className="flex-none w-[clamp(96px,20%,164px)] py-3" style={{ background: "#FBFAFD", borderRight: LINE }}>
          <p className="m-0 px-3 pb-2 text-[8.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            SEKTIONER
          </p>
          {["Forside", "Om mig", "Ydelser", "Booking", "Kontakt"].map((s) => (
            <div
              key={s}
              className="px-3 py-[7px] text-[11.5px] leading-tight"
              style={
                s === "Ydelser"
                  ? { color: BLUE, fontWeight: 800, background: "rgba(48,109,218,0.08)" }
                  : { color: "rgba(0,0,0,0.6)", fontWeight: 700 }
              }
            >
              {s}
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 px-4 py-2.5 flex-wrap" style={{ borderBottom: LINE_SOFT }}>
            <span className="text-[11.5px] font-extrabold" style={{ color: MUTED }}>
              Rediger hjemmeside
            </span>
            <span className="ml-auto flex items-center gap-2">
              <span
                className="text-[11px] font-extrabold rounded-md px-2.5 py-1"
                style={{ border: "1.5px solid rgba(0,0,0,0.14)", color: "rgba(0,0,0,0.55)" }}
              >
                Forhåndsvis
              </span>
              <span
                className="text-[11px] font-extrabold rounded-md px-3 py-1.5 text-white"
                style={{ background: BLUE }}
              >
                Udgiv
              </span>
            </span>
          </div>

          <div className="p-4" style={{ background: "#F4F2F8" }}>
            {/* selected section — the toolbar that appears on a single click */}
            <div className="relative rounded-[10px] bg-white p-4" style={{ outline: `2px solid ${BLUE}` }}>
              <span
                className="absolute -top-2.5 right-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-[9.5px] font-extrabold text-white"
                style={{ background: BLUE }}
              >
                Ydelser
                <span className="opacity-70">⋮</span>
                <span aria-hidden="true">🗑</span>
              </span>
              <p className="m-0 text-[13px] font-black">Ydelser &amp; priser</p>
              <div className="grid grid-cols-3 gap-2 mt-2.5">
                {[
                  ["Individuel samtale", "900 kr."],
                  ["Parsamtale", "1.500 kr."],
                  ["Første samtale", "1.400 kr."],
                ].map(([name, price]) => (
                  <div key={name} className="rounded-md px-2 py-2" style={{ border: LINE }}>
                    <p className="m-0 text-[9.5px] font-extrabold leading-tight">{name}</p>
                    <p className="m-0 mt-1 text-[10px] font-black" style={{ color: BLUE }}>
                      {price}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* the + that appears between sections on hover */}
            <div className="flex items-center gap-2 py-2.5">
              <span className="flex-1 h-px" style={{ background: "rgba(48,109,218,0.35)" }} />
              <span
                className="grid place-items-center w-6 h-6 rounded-md text-white text-[15px] font-black leading-none"
                style={{ background: BLUE }}
              >
                +
              </span>
              <span className="flex-1 h-px" style={{ background: "rgba(48,109,218,0.35)" }} />
            </div>

            <div className="rounded-[10px] bg-white p-4" style={{ border: LINE }}>
              <p className="m-0 text-[13px] font-black">Om mig</p>
              <p
                className="m-0 mt-1.5 text-[10px] leading-relaxed max-w-[42%]"
                style={{ color: "rgba(0,0,0,0.55)" }}
              >
                Autoriseret psykolog.
              </p>
            </div>
          </div>
        </div>
      </MockFrame>

      {/* the menu that opens on clicking the + */}
      <div
        className="relative z-[2] -mt-8 sm:-mt-12 ml-3 sm:ml-6 inline-block max-w-[300px] bg-white rounded-[14px] overflow-hidden"
        style={{ border: LINE, boxShadow: "0 22px 52px rgba(20,5,40,0.22)" }}
      >
        <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: LINE_SOFT }}>
          <span
            className="grid place-items-center w-[22px] h-[22px] rounded-[7px] text-white text-[14px] font-black leading-none"
            style={{ background: BLUE }}
          >
            +
          </span>
          <span className="text-[12.5px] font-extrabold">Tilføj sektion her</span>
        </div>
        <div className="py-1.5">
          {SECTION_MENU.map((item, i) => (
            <div
              key={item}
              className="flex items-center gap-2.5 px-4 py-2"
              style={i === 0 ? { background: "rgba(48,109,218,0.07)" } : undefined}
            >
              <span
                className="w-[26px] h-5 rounded flex-none"
                style={{ background: i === 0 ? BLUE : "rgba(0,0,0,0.14)" }}
              />
              <span
                className="text-[12.5px]"
                style={i === 0 ? { color: BLUE, fontWeight: 800 } : { color: "rgba(0,0,0,0.7)", fontWeight: 700 }}
              >
                {item}
              </span>
              {i === 0 && (
                <span className="ml-auto text-[10.5px] font-extrabold" style={{ color: BLUE }}>
                  Indsæt
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── 03 · Booking ─────────── */

const DAYS = [
  { d: "Ma", n: "13" },
  { d: "Ti", n: "14", today: true },
  { d: "On", n: "15" },
  { d: "To", n: "16" },
  { d: "Fr", n: "17" },
];

/** Booked slots as [column, topPercent, heightPercent, time, name, tone]. */
const SLOTS: Array<[number, number, number, string, string, "booked" | "new" | "open"]> = [
  [0, 8, 16, "09.00", "Individuel", "booked"],
  [0, 46, 16, "13.00", "Parsamtale", "booked"],
  [1, 16, 16, "10.00", "Individuel", "booked"],
  [1, 54, 20, "13.30", "Første samtale", "new"],
  [2, 8, 16, "09.00", "Ledig tid", "open"],
  [2, 62, 16, "14.00", "Individuel", "booked"],
  [3, 30, 20, "11.00", "Parsamtale", "booked"],
  [4, 16, 16, "10.00", "Ledig tid", "open"],
  [4, 54, 16, "13.00", "Individuel", "booked"],
];

const SLOT_TONE = {
  booked: { background: "rgba(48,109,218,0.12)", color: "#24559E", border: "none" },
  new: { background: PURPLE, color: "#FFFFFF", border: "none" },
  open: { background: "transparent", color: MUTED, border: "1.5px dashed rgba(0,0,0,0.22)" },
} as const;

export function BookingMock() {
  return (
    <MockFrame className="flex">
      <MockSidebar active="Bookinger" />
      <div className="flex-1 min-w-0 px-4 lg:px-5 pt-4 pb-5">
        <div className="flex items-start gap-3 flex-wrap">
          <span>
            <span className="block text-[16px] font-black leading-tight">Bookinger</span>
            <span className="block text-[10.5px] font-bold mt-0.5" style={{ color: MUTED }}>
              Håndtér aftaler og bookinger af ydelser
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1.5 flex-wrap">
            <span className="flex rounded-md overflow-hidden" style={{ border: LINE }}>
              {["Liste", "Uge", "Måned"].map((v) => (
                <span
                  key={v}
                  className="text-[10px] font-extrabold px-2 py-1"
                  style={v === "Uge" ? { background: "#fff", color: "#000" } : { color: MUTED }}
                >
                  {v}
                </span>
              ))}
            </span>
            <span
              className="text-[10px] font-extrabold px-2 py-1 rounded-md"
              style={{ border: LINE, color: "rgba(0,0,0,0.6)" }}
            >
              Ny ledig tid
            </span>
            <span className="text-[10px] font-extrabold px-2 py-1 rounded-md text-white" style={{ background: BLUE }}>
              + Ny booking
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span className="flex gap-1">
            {["‹", "I dag", "›"].map((b) => (
              <span key={b} className="text-[10px] font-extrabold px-2 py-1 rounded-md" style={{ border: LINE }}>
                {b}
              </span>
            ))}
          </span>
          <span className="ml-auto text-[11.5px] font-extrabold">Uge 42 · 13. – 17. oktober</span>
        </div>

        <div className="mt-3 rounded-[10px] overflow-hidden" style={{ border: LINE }}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(5,1fr)", borderBottom: LINE_SOFT }}>
            {DAYS.map((day) => (
              <div key={day.n} className="text-center py-1.5">
                <p className="m-0 text-[9px] font-bold" style={{ color: MUTED }}>
                  {day.d}
                </p>
                <p
                  className="m-0 text-[12px] font-extrabold leading-tight mt-0.5"
                  style={day.today ? { color: "#fff" } : undefined}
                >
                  {day.today ? (
                    <span
                      className="inline-grid place-items-center w-[19px] h-[19px] rounded-full"
                      style={{ background: BLUE }}
                    >
                      {day.n}
                    </span>
                  ) : (
                    day.n
                  )}
                </p>
              </div>
            ))}
          </div>
          <div className="relative grid h-[168px]" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            {DAYS.map((day, i) => (
              <div key={day.n} className="relative" style={i < 4 ? { borderRight: LINE_SOFT } : undefined} />
            ))}
            {SLOTS.map(([col, top, height, time, name, tone], i) => (
              <span
                key={i}
                className="absolute rounded-[5px] px-1.5 py-1 text-[8.5px] font-extrabold leading-tight overflow-hidden"
                style={{
                  left: `calc(${col} * 20% + 3px)`,
                  width: "calc(20% - 6px)",
                  top: `${top}%`,
                  height: `${height}%`,
                  ...SLOT_TONE[tone],
                }}
              >
                {time}
                <span className="hidden min-[560px]:block">{name}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** The "Ny ledig tid" dialog — field list taken from the real product. */
export function SlotDialogMock() {
  const field = (label: string, value: string, hint = false) => (
    <div>
      <p className="m-0 mb-1 text-[10px] font-extrabold" style={{ color: "rgba(0,0,0,0.7)" }}>
        {label}
      </p>
      <p
        className="m-0 text-[11.5px] font-bold rounded-lg px-2.5 py-2"
        style={{ border: LINE, color: hint ? MUTED : "#000" }}
      >
        {value}
      </p>
    </div>
  );

  return (
    <MockFrame>
      <div className="px-5 pt-4 pb-5">
        <p className="m-0 text-[15px] font-black">Ny ledig tid</p>
        <p className="m-0 mt-1 text-[11px] font-bold leading-relaxed" style={{ color: MUTED }}>
          Ledige tider vises på hjemmesiden, så klienterne kan booke dem direkte.
        </p>

        <div className="grid grid-cols-3 gap-2.5 mt-4">
          {field("Dato *", "14-10-2026")}
          {field("Tidspunkt *", "13:30")}
          {field("Varighed (min)", "60")}
        </div>
        <div className="grid gap-2.5 mt-2.5">
          {field("Ydelse", "Første samtale")}
          {field("Person", "Sofie Lund")}
          {field("Noter", "Interne noter om den ledige tid", true)}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-md" style={{ border: LINE }}>
            Annuller
          </span>
          <span className="text-[11px] font-extrabold px-3 py-1.5 rounded-md text-white" style={{ background: BLUE }}>
            Opret ledig tid
          </span>
        </div>
      </div>
    </MockFrame>
  );
}

/* ─────────── 04 · Automatiske mails ─────────── */

/* Mail types the product actually sends (shared/schema.ts template kinds).
   "Godkendes af dig" describes approval-before-send, which is a planned
   capability — see the note in pages/saadan-virker-det.tsx. */
const MAIL_ROWS: Array<[string, string, "auto" | "approve" | "off"]> = [
  ["Bookingbekræftelse", "Sendes automatisk", "auto"],
  ["Påmindelse · 24 timer før", "Sendes automatisk", "auto"],
  ["Ændret booking", "Sendes automatisk", "auto"],
  ["Aflyst booking", "Sendes automatisk", "auto"],
  ["Svar på ny henvendelse", "Godkendes af dig", "approve"],
];

const MAIL_TONE = {
  auto: { color: GREEN, background: "rgba(46,125,79,0.1)" },
  approve: { color: PURPLE, background: "rgba(128,22,195,0.09)" },
  off: { color: MUTED, background: "rgba(0,0,0,0.06)" },
} as const;

export function MailsMock() {
  return (
    <MockFrame className="flex">
      <MockSidebar active="Formularer" />
      <div className="flex-1 min-w-0 px-4 lg:px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[16px] font-black">E-mails</span>
          <span className="text-[11px] font-bold" style={{ color: MUTED }}>
            4 af 5 notifikationer aktive
          </span>
        </div>

        <div className="mt-3 rounded-[11px] overflow-hidden" style={{ border: LINE }}>
          {MAIL_ROWS.map((row, i) => {
            const [name, status, tone] = row;
            return (
              <div
                key={name}
                className="flex items-center gap-3 px-3.5 py-2.5"
                style={i < MAIL_ROWS.length - 1 ? { borderBottom: LINE_SOFT } : undefined}
              >
                <span
                  className="w-[30px] h-[17px] rounded-full relative flex-none"
                  style={{ background: tone === "approve" ? "rgba(0,0,0,0.18)" : GREEN }}
                >
                  <span
                    className="absolute top-[2.5px] w-3 h-3 rounded-full bg-white"
                    style={tone === "approve" ? { left: "2.5px" } : { right: "2.5px" }}
                  />
                </span>
                <span className="text-[12.5px] font-extrabold min-w-0 truncate">{name}</span>
                <span
                  className="ml-auto flex-none text-[10px] font-extrabold rounded-full px-2.5 py-1 whitespace-nowrap"
                  style={MAIL_TONE[tone]}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Sender identity — the other half of EmailSettingsCard. */}
        <div className="mt-3 rounded-[11px] px-3.5 py-3" style={{ border: LINE }}>
          <p className="m-0 mb-2 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            AFSENDER
          </p>
          {[
            ["Afsendernavn", "Psykolog Sofie Lund"],
            ["Svar-til e-mail", "kontakt@sofielund.dk"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-3 py-1.5">
              <span className="text-[11px] font-bold flex-none" style={{ color: MUTED }}>
                {label}
              </span>
              <span className="ml-auto text-[11.5px] font-extrabold min-w-0 truncate">{value}</span>
            </div>
          ))}
          <div className="flex items-center gap-3 py-1.5">
            <span className="text-[11px] font-bold flex-none" style={{ color: MUTED }}>
              Brandfarve
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded" style={{ background: "#4C5F50" }} />
              <span className="text-[11.5px] font-extrabold">#4C5F50</span>
            </span>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/** Template editor with the live preview pane beside it. */
export function MailEditorMock() {
  const token = (t: string) => (
    <span
      className="rounded px-1.5 py-px text-[10px] font-extrabold"
      style={{ background: "rgba(48,109,218,0.1)", color: BLUE }}
    >
      {t}
    </span>
  );
  const field = (label: string, value: string) => (
    <>
      <p className="m-0 mt-3 mb-1 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="m-0 text-[12px] font-bold rounded-lg px-2.5 py-2" style={{ border: LINE }}>
        {value}
      </p>
    </>
  );

  return (
    <MockFrame>
      <div className="flex items-center gap-2.5 px-4 py-3 flex-wrap" style={{ borderBottom: LINE_SOFT }}>
        <span className="text-[13px] font-extrabold">Rediger: Bookingbekræftelse</span>
        <span
          className="ml-auto text-[11px] font-extrabold rounded-md px-2.5 py-1"
          style={{ border: "1.5px solid rgba(0,0,0,0.14)", color: "rgba(0,0,0,0.55)" }}
        >
          Send test
        </span>
        <span className="text-[11px] font-extrabold rounded-md px-3 py-1.5 text-white" style={{ background: BLUE }}>
          Gem
        </span>
      </div>

      <div className="flex flex-wrap">
        <div className="flex-[2_1_240px] min-w-0 px-4 pb-4" style={{ borderRight: LINE_SOFT }}>
          {field("EMNELINJE", "Din tid er bekræftet")}
          {field("OVERSKRIFT", "Vi ses snart")}
          <p className="m-0 mt-3 mb-1 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            BRØDTEKST
          </p>
          <div
            className="rounded-lg px-2.5 py-2.5 text-[11.5px] leading-relaxed"
            style={{ border: LINE, color: "rgba(0,0,0,0.78)" }}
          >
            Hej {token("fornavn")}, tak for din booking. Vi ses {token("dato")} kl. {token("tid")}.
          </div>
          <div className="flex items-center gap-2 mt-3.5 pt-3" style={{ borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <span className="w-[34px] h-[19px] rounded-full relative flex-none" style={{ background: GREEN }}>
              <span className="absolute right-[3px] top-[3px] w-[13px] h-[13px] rounded-full bg-white" />
            </span>
            <span className="text-[11.5px] font-extrabold">Send automatisk</span>
          </div>
        </div>

        <div className="flex-[1_1_200px] min-w-[180px] px-4 py-3.5" style={{ background: "#FBFAFD" }}>
          <p className="m-0 mb-2 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            FORHÅNDSVISNING
          </p>
          <div className="bg-white rounded-[10px] px-3.5 py-3.5" style={{ border: LINE }}>
            <p className="m-0 text-[9px] font-extrabold tracking-[0.1em]" style={{ color: "rgba(0,0,0,0.4)" }}>
              PSYKOLOG SOFIE LUND
            </p>
            <p className="m-0 mt-2 text-[14px] font-black">Vi ses snart</p>
            <p className="m-0 mt-2 text-[11px] leading-relaxed" style={{ color: "rgba(0,0,0,0.72)" }}>
              Hej Emma, tak for din booking. Vi ses tirsdag d. 14. oktober kl. 13.30.
            </p>
            <p
              className="m-0 mt-3 inline-block text-[10px] font-extrabold rounded-md px-3 py-1.5 text-white"
              style={{ background: "#4C5F50" }}
            >
              Se din aftale
            </p>
            <p className="m-0 mt-3 text-[9.5px] leading-snug" style={{ color: "rgba(0,0,0,0.5)" }}>
              Sofie Lund · Gammel Mønt 4, København K
            </p>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

/* ─────────── 05 · Analyse ─────────── */

const WEEKS: Array<[string, number, string]> = [
  ["Uge 40", 46, "rgba(128,22,195,0.28)"],
  ["Uge 41", 62, "rgba(128,22,195,0.40)"],
  ["Uge 42", 84, "rgba(128,22,195,0.62)"],
  ["Uge 43", 96, PURPLE],
];

function MiniList({ heading, rows }: { heading: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-[11px] px-4 py-3.5" style={{ border: LINE }}>
      <p className="m-0 mb-1.5 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
        {heading}
      </p>
      {rows.map(([label, value], i) => (
        <div
          key={label}
          className="flex items-baseline py-[7px]"
          style={i < rows.length - 1 ? { borderBottom: LINE_SOFT } : undefined}
        >
          <span className="text-[12.5px] font-bold">{label}</span>
          <span className="ml-auto text-[12.5px] font-extrabold">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsMock() {
  return (
    <MockFrame className="flex">
      <MockSidebar active="Analytics" />
      <div className="flex-1 min-w-0 px-4 lg:px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[16px] font-black">Analytics</span>
          <span className="text-[11px] font-extrabold" style={{ color: MUTED }}>
            Oktober 2026
          </span>
          <span className="ml-auto flex gap-1.5">
            <span className="text-[10px] font-extrabold rounded-md px-2.5 py-1 text-white" style={{ background: BLUE }}>
              30 dage
            </span>
            <span className="text-[10px] font-bold rounded-md px-2.5 py-1" style={{ border: LINE, color: MUTED }}>
              7 dage
            </span>
          </span>
        </div>

        <div className="grid gap-2.5 mt-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(98px,1fr))" }}>
          <StatCard label="BESØG" value="184" note="+18 %" noteColor={GREEN} />
          <StatCard label="UNIKKE" value="147" note="+12 %" noteColor={GREEN} />
          <StatCard label="BOOKINGKLIK" value="21" note="11 % af besøg" />
          <StatCard label="FORMULARER" value="9" note="via kontaktformular" />
        </div>

        <div className="mt-3.5 rounded-[11px] px-4 py-3.5" style={{ border: LINE }}>
          <p className="m-0 mb-3 text-[9.5px] font-extrabold tracking-[0.1em]" style={{ color: MUTED }}>
            BESØG PR. UGE
          </p>
          <div className="flex items-end gap-3 h-[104px]">
            {WEEKS.map(([label, h, bg]) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                <span className="w-full rounded-t-md" style={{ height: h, background: bg }} />
                <span
                  className="text-[9.5px] font-extrabold"
                  style={{ color: bg === PURPLE ? PURPLE : MUTED }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 mt-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <MiniList
            heading="MEST BESØGTE SIDER"
            rows={[["Forside", "96"], ["Samtaleterapi", "38"], ["Priser", "27"], ["Om Sofie", "23"]]}
          />
          <MiniList
            heading="TRAFIKKILDER"
            rows={[["Google", "112"], ["Direkte", "44"], ["Instagram", "19"], ["Psykologguiden", "9"]]}
          />
        </div>
      </div>
    </MockFrame>
  );
}

export function AnalyticsPhone() {
  return (
    <PhoneFrame title="Analytics · oktober" active="Mere">
      <PhoneStats
        items={[
          { label: "BESØG", value: "184" },
          { label: "UNIKKE", value: "147" },
          { label: "BOOKINGKLIK", value: "21" },
          { label: "FORMULARER", value: "9", color: PURPLE },
        ]}
      />
      <div className="mt-3 rounded-[11px] px-3 py-3" style={{ border: LINE }}>
        <p className="m-0 mb-2.5 text-[9px] font-extrabold tracking-[0.08em]" style={{ color: MUTED }}>
          BESØG PR. UGE
        </p>
        <div className="flex items-end gap-2 h-[70px]">
          {WEEKS.map(([label, h, bg]) => (
            <span key={label} className="flex-1 rounded-t-[5px]" style={{ height: h * 0.75, background: bg }} />
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ─────────── 06 · Økonomi ─────────── */

const INVOICES: Array<[string, string, string, string, string, string]> = [
  ["1042", "Individuel samtale", "14. okt.", "1.100 kr.", "Betalt", GREEN],
  ["1041", "Første samtale", "13. okt.", "1.400 kr.", "Betalt", GREEN],
  ["1040", "Parsamtale", "10. okt.", "1.500 kr.", "Afventer", PURPLE],
  ["1039", "Arbejdsbog: Når stress fylder", "9. okt.", "149 kr.", "Betalt", GREEN],
  ["1038", "Individuel samtale", "6. okt.", "700 kr.", "Forfalden", "#B03030"],
];

/** Shared table shell: a real table on desktop, stacked cards under 640px. */
function MockTable({
  head,
  rows,
  /** Column weights — the description column needs more room than an id. */
  cols = "0.5fr 1.7fr 0.7fr 0.8fr 0.8fr",
}: {
  head: string[];
  rows: Array<{ cells: string[]; statusColor: string }>;
  cols?: string;
}) {
  return (
    <div className="mt-3.5 rounded-[11px] overflow-hidden" style={{ border: LINE }}>
      <div
        className="hidden sm:grid gap-2.5 px-4 py-2.5"
        style={{
          gridTemplateColumns: cols,
          background: "#FBFAFD",
          borderBottom: LINE_SOFT,
        }}
      >
        {head.map((h) => (
          <span key={h} className="text-[9px] font-extrabold tracking-[0.08em]" style={{ color: MUTED }}>
            {h}
          </span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={row.cells[0]}
          className="grid gap-1 sm:gap-2.5 px-4 py-2.5 sm:items-center"
          style={{
            gridTemplateColumns: cols,
            borderBottom: i < rows.length - 1 ? LINE_SOFT : undefined,
          }}
        >
          {row.cells.map((cell, ci) => (
            <span
              key={ci}
              className={`text-[12px] font-bold min-w-0 truncate ${ci === 0 ? "col-span-full sm:col-span-1" : ""}`}
              style={
                ci === row.cells.length - 1
                  ? { fontSize: "10.5px", fontWeight: 800, color: row.statusColor }
                  : undefined
              }
            >
              <span className="sm:hidden font-extrabold" style={{ color: MUTED }}>
                {ci > 0 ? `${head[ci]} ` : ""}
              </span>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function EconomyMock() {
  return (
    <MockFrame className="flex">
      <MockSidebar active="Økonomi" />
      <div className="flex-1 min-w-0 px-4 lg:px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[16px] font-black">Økonomi</span>
          <span className="text-[11px] font-extrabold" style={{ color: MUTED }}>
            Oktober 2026
          </span>
          <span
            className="ml-auto flex items-center gap-1.5 text-[10.5px] font-extrabold rounded-full px-2.5 py-1"
            style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
            Stripe forbundet
          </span>
        </div>

        <div className="grid gap-2.5 mt-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          <StatCard label="FAKTURERET" value="18.400 kr." note="14 samtaler · 3 materialer" />
          <StatCard label="MODTAGET" value="16.200 kr." valueColor={GREEN} note="88 % betalt" />
          <StatCard label="UDESTÅENDE" value="2.200 kr." valueColor={PURPLE} note="2 fakturaer" />
        </div>

        <MockTable
          head={["NR.", "YDELSE", "DATO", "BELØB", "STATUS"]}
          rows={INVOICES.map((r) => ({ cells: [r[0], r[1], r[2], r[3], r[4]], statusColor: r[5] }))}
        />
      </div>
    </MockFrame>
  );
}

export function EconomyPhone() {
  return (
    <PhoneFrame title="Økonomi · oktober" active="Mere">
      <PhoneStats
        items={[
          { label: "FAKTURERET", value: "18.400" },
          { label: "MODTAGET", value: "16.200", color: GREEN },
          { label: "UDESTÅENDE", value: "2.200", color: PURPLE },
          { label: "BETALT", value: "88 %" },
        ]}
      />
      <div className="mt-3 flex items-center gap-2 rounded-[11px] px-3 py-2.5" style={{ border: LINE }}>
        <span className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
        <span className="text-[11.5px] font-extrabold">Stripe forbundet</span>
      </div>
    </PhoneFrame>
  );
}

/* ─────────── 07 · Butik ─────────── */

/** Product artwork drawn in CSS — no stock imagery, no third-party brands. */
function WorkbookArt({ small = false }: { small?: boolean }) {
  return (
    <div
      className="grid place-items-center"
      style={{ background: "#EDE6D8", height: small ? 82 : 124, padding: small ? 10 : 14 }}
    >
      <div
        className="box-border"
        style={{
          width: small ? 46 : 78,
          height: small ? 62 : 98,
          borderRadius: "3px 8px 8px 3px",
          background: "#4C5F50",
          padding: small ? "8px 6px" : "12px 10px",
          boxShadow: "0 8px 20px rgba(20,5,40,0.22)",
        }}
      >
        {!small && (
          <p
            className="m-0 font-extrabold tracking-[0.1em]"
            style={{ fontSize: 8, color: "rgba(255,255,255,0.7)" }}
          >
            ARBEJDSBOG
          </p>
        )}
        <p
          className="m-0 font-extrabold"
          style={{
            fontSize: small ? 7.5 : 11,
            lineHeight: 1.2,
            marginTop: small ? 0 : 8,
            color: "#FFFFFF",
          }}
        >
          Når stress fylder
        </p>
      </div>
    </div>
  );
}

function AudioArt({ small = false }: { small?: boolean }) {
  const bars = small ? [10, 17, 13, 20] : [12, 22, 16, 26, 14];
  return (
    <div
      className="grid place-items-center"
      style={{ background: "#DCE3E8", height: small ? 82 : 124, padding: small ? 10 : 14 }}
    >
      <div
        className="flex flex-col items-center justify-center gap-2"
        style={{
          width: small ? 58 : 98,
          height: small ? 58 : 98,
          borderRadius: small ? 9 : 12,
          background: "#2E4A66",
          boxShadow: "0 8px 20px rgba(20,5,40,0.22)",
        }}
      >
        <span className="flex items-end gap-[3px]" style={{ height: small ? 20 : 26 }}>
          {bars.map((h, i) => (
            <span
              key={i}
              className="rounded-sm"
              style={{ width: small ? 3 : 4, height: h, background: `rgba(255,255,255,${0.55 + i * 0.1})` }}
            />
          ))}
        </span>
        {!small && (
          <p className="m-0 text-[9.5px] font-extrabold tracking-[0.06em]" style={{ color: "rgba(255,255,255,0.85)" }}>
            6 LYDSPOR
          </p>
        )}
      </div>
    </div>
  );
}

const ORDERS: Array<[string, string, string, string, string, string]> = [
  ["#218", "Arbejdsbog: Når stress fylder", "13. okt.", "149 kr.", "Pakkes", BLUE],
  ["#217", "Lydøvelser til uro", "11. okt.", "99 kr.", "Leveret", GREEN],
  ["#216", "Arbejdsbog: Når stress fylder", "7. okt.", "149 kr.", "Sendt", GREEN],
];

export function ShopMock() {
  const card = (art: ReactNode, title: string, meta: string, price: string, status: string) => (
    <div className="rounded-[12px] overflow-hidden" style={{ border: LINE }}>
      {art}
      <div className="px-3.5 py-3">
        <p className="m-0 text-[13px] font-extrabold leading-tight">{title}</p>
        <p className="m-0 mt-1 text-[11.5px] font-bold" style={{ color: "rgba(0,0,0,0.55)" }}>
          {meta}
        </p>
        <div className="flex items-center mt-2.5 gap-2">
          <span className="text-[14px] font-black">{price}</span>
          <span
            className="ml-auto text-[10px] font-extrabold rounded-full px-2.5 py-1 whitespace-nowrap"
            style={{ color: GREEN, background: "rgba(46,125,79,0.1)" }}
          >
            {status}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <MockFrame className="flex">
      <MockSidebar active="Produkter" />
      <div className="flex-1 min-w-0 px-4 lg:px-5 pt-4 pb-5">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[16px] font-black">Produkter</span>
          <span className="text-[11px] font-extrabold" style={{ color: MUTED }}>
            2 aktive
          </span>
          <span className="ml-auto text-[10.5px] font-extrabold rounded-lg px-3 py-1.5 text-white" style={{ background: BLUE }}>
            + Nyt produkt
          </span>
        </div>

        <div className="grid gap-3 mt-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
          {card(<WorkbookArt />, "Arbejdsbog: Når stress fylder", "Trykt · 64 sider · sendes med post", "149 kr.", "Aktiv · 12 på lager")}
          {card(<AudioArt />, "Lydøvelser til uro", "Digitalt · 6 spor · download efter køb", "99 kr.", "Aktiv · digital")}
        </div>

        <MockTable
          head={["ORDRE", "PRODUKT", "DATO", "BELØB", "STATUS"]}
          rows={ORDERS.map((r) => ({ cells: [r[0], r[1], r[2], r[3], r[4]], statusColor: r[5] }))}
        />
      </div>
    </MockFrame>
  );
}

export function ShopPhone() {
  return (
    <PhoneFrame title="Produkter" active="Mere">
      <div className="grid grid-cols-2 gap-2.5">
        {[
          { art: <WorkbookArt small />, name: "Arbejdsbog", price: "149 kr." },
          { art: <AudioArt small />, name: "Lydøvelser", price: "99 kr." },
        ].map((p) => (
          <div key={p.name} className="rounded-[11px] overflow-hidden" style={{ border: LINE }}>
            {p.art}
            <div className="px-2.5 py-2.5">
              <p className="m-0 text-[11px] font-extrabold leading-tight">{p.name}</p>
              <p className="m-0 mt-1 text-[12.5px] font-black">{p.price}</p>
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}
