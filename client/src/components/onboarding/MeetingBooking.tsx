import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, Clock, Loader2, ArrowLeft } from "lucide-react";
import { PURPLE, LIME } from "@/components/bf2/theme";

/* ─────────────────────────────────────────────────────────────
   The free 30-minute improvement meeting.

   This does NOT contain a booking engine. It renders BirdFlow's
   own calendar (/api/platform-calendar*), which is built and
   administered elsewhere, and claims a slot through the same
   atomic endpoint the rest of the platform uses.

   No Stripe object is created anywhere in this path.
   ───────────────────────────────────────────────────────────── */

type Slot = { time: string; openSlotId?: string | null };
type Day = { date: string; slots: Slot[] };

export type PlatformMeeting = {
  id: string;
  date: string | Date;
  time: string;
  durationMinutes?: number | null;
  service?: string | null;
};

const DAY_NAMES = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const MONTH_NAMES = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december",
];

/** "torsdag den 4. september" from a YYYY-MM-DD string, without timezone drift. */
export function danishDayLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const weekday = DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday} den ${d}. ${MONTH_NAMES[m - 1]}`;
}

export function meetingDateString(value: string | Date): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** The permanent confirmation a returning customer lands on. */
export function MeetingConfirmation({
  meeting,
  timezone,
}: {
  meeting: PlatformMeeting;
  timezone?: string;
}) {
  const date = meetingDateString(meeting.date);
  return (
    <div className="rounded-3xl border-2 border-black/10 p-6" style={{ background: LIME }} data-testid="meeting-confirmation">
      <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: PURPLE }}>
        <CalendarCheck className="h-4 w-4" />
        Mødet er booket
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight" data-testid="text-meeting-when">
        {danishDayLabel(date)} kl. {meeting.time}
      </p>
      <p className="mt-1 text-sm text-neutral-700">
        {meeting.durationMinutes ?? 30} minutter{timezone ? ` · ${timezone.replace("Europe/", "")}` : ""} · online
      </p>
      <p className="mt-4 text-sm text-neutral-800">
        Vi gennemgår hjemmesiden sammen og aftaler, hvad der skal forbedres. Du betaler først, når du har godkendt
        det færdige resultat.
      </p>
      <p className="mt-3 text-sm text-neutral-700">
        Skal mødet flyttes? Svar på bekræftelsesmailen, du har fået — så finder vi et nyt tidspunkt.
      </p>
    </div>
  );
}

export function MeetingBooking({
  token,
  websiteId,
  pitch,
  onBooked,
  onBack,
}: {
  token: string | null;
  websiteId: string | null;
  pitch: string;
  onBooked: (meeting: PlatformMeeting) => void;
  onBack?: () => void;
}) {
  const [days, setDays] = useState<Day[]>([]);
  const [timezone, setTimezone] = useState<string>("Europe/Copenhagen");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform-calendar/slots", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Kalenderen kunne ikke hentes.");
      setDays(body.days ?? []);
      setTimezone(body.timezone || "Europe/Copenhagen");
      setDuration(body.durationMinutes || 30);
      setSelectedDate((current) => current ?? body.days?.[0]?.date ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const activeDay = useMemo(() => days.find((day) => day.date === selectedDate) ?? days[0], [days, selectedDate]);

  const book = async (slot: Slot) => {
    if (!token || !activeDay || claiming) return;
    setClaiming(slot.time);
    setError(null);
    try {
      const res = await fetch("/api/platform-calendar/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          date: activeDay.date,
          time: slot.time,
          openSlotId: slot.openSlotId ?? undefined,
          websiteId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Someone else took the slot - reload the grid instead of stranding them.
        if (body.code === "SLOT_UNAVAILABLE") {
          setError(body.message);
          await load();
          return;
        }
        if (body.code === "MEETING_ALREADY_BOOKED" && body.booking) {
          onBooked(body.booking as PlatformMeeting);
          return;
        }
        throw new Error(body.message || "Tidspunktet kunne ikke bookes.");
      }
      onBooked(body.booking as PlatformMeeting);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div data-testid="meeting-booking">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900"
          data-testid="button-back-to-decision"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til valget
        </button>
      )}

      <h2 className="text-2xl font-extrabold tracking-tight">Book et gratis møde</h2>
      <p className="mt-1.5 max-w-prose text-sm text-neutral-700" data-testid="text-meeting-pitch">
        {pitch}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {duration} minutter
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          Alle tidspunkter er dansk tid ({timezone.replace("Europe/", "")})
        </span>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Henter ledige tider…
        </div>
      ) : days.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm text-neutral-700" data-testid="no-slots">
          Der er ingen ledige tider lige nu. Skriv til os, så finder vi et tidspunkt sammen.
        </div>
      ) : (
        <>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => {
              const active = day.date === activeDay?.date;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className="shrink-0 rounded-xl border-2 px-3 py-2 text-left text-xs font-semibold transition-colors"
                  style={{
                    borderColor: active ? PURPLE : "rgba(0,0,0,0.1)",
                    background: active ? LIME : "#fff",
                  }}
                  data-testid={`day-${day.date}`}
                >
                  <span className="block">{danishDayLabel(day.date)}</span>
                  <span className="block font-normal text-neutral-500">{day.slots.length} ledige</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {activeDay?.slots.map((slot) => (
              <button
                key={`${activeDay.date}-${slot.time}`}
                type="button"
                onClick={() => book(slot)}
                disabled={claiming !== null}
                className="rounded-xl border-2 border-black/10 px-2 py-2.5 text-sm font-semibold transition-colors hover:bg-black/[0.04] disabled:opacity-50"
                data-testid={`slot-${slot.time}`}
              >
                {claiming === slot.time ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : slot.time}
              </button>
            ))}
          </div>
        </>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-600" data-testid="booking-error">
          {error}
        </p>
      )}
    </div>
  );
}
