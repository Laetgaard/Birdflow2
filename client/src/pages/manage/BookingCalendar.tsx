// Kalendervisning (uge/måned) til bookingoversigten i manage-dashboardet.
// Bygget fra bunden med date-fns (dansk lokalisering, uger starter mandag) og
// HTML5 drag & drop, så bookinger kan flyttes direkte i kalenderen.
import { useMemo, useState, type ReactElement } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  getISOWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarPlus, Clock, Plus } from "lucide-react";
import type { Booking, OpenSlot, TeamMember } from "./types";

/** Neutral farve når en booking ikke har en person tilknyttet. */
export const NEUTRAL_MEMBER_COLOR = "#94a3b8";

/** Lokal dagsnøgle (YYYY-MM-DD) for et Date-objekt. */
export function dayKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Dagsnøgle for en bookings dato-felt. Serveren gemmer datoen som midnat, så vi
 * forskyder 12 timer før vi læser UTC-dagen. Det gør nøglen robust over for
 * tidszoneforskelle mellem server og browser.
 */
export function bookingDayKey(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return new Date(parsed.getTime() + 12 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** "HH:MM" for en booking - bruger time-feltet og falder tilbage til datoen. */
export function bookingTimeOf(booking: Booking): string {
  if (booking.time && /^\d{1,2}:\d{2}/.test(booking.time)) {
    const [h, m] = booking.time.split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  const parsed = new Date(booking.date);
  if (!isNaN(parsed.getTime())) return format(parsed, "HH:mm");
  return "";
}

export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time || "");
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 30, minutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || "").replace("#", "");
  if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(148, 163, 184, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const WEEK_START_HOUR = 7;
const WEEK_END_HOUR = 21;
const SLOT_MINUTES = 30;
const ROW_HEIGHT = 28; // px pr. 30 minutter
const WEEK_START_MINUTES = WEEK_START_HOUR * 60;
const WEEK_ROWS = ((WEEK_END_HOUR - WEEK_START_HOUR) * 60) / SLOT_MINUTES;

type DayItem =
  | { kind: "booking"; time: string; minutes: number; booking: Booking }
  | { kind: "slot"; time: string; minutes: number; slot: OpenSlot };

export type BookingCalendarProps = {
  view: "week" | "month";
  anchorDate: Date;
  onAnchorDateChange: (date: Date) => void;
  bookings: Booking[];
  openSlots: OpenSlot[];
  teamMembers: TeamMember[];
  memberFilter: string;
  onMemberFilterChange: (value: string) => void;
  onSelectBooking: (booking: Booking) => void;
  onSelectSlot: (slot: OpenSlot) => void;
  onCreateBooking: (date: string, time?: string) => void;
  onCreateSlot: (date: string, time?: string) => void;
  onMoveBooking: (booking: Booking, date: string, time: string) => void;
};

export function BookingCalendar({
  view,
  anchorDate,
  onAnchorDateChange,
  bookings,
  openSlots,
  teamMembers,
  memberFilter,
  onMemberFilterChange,
  onSelectBooking,
  onSelectSlot,
  onCreateBooking,
  onCreateSlot,
  onMoveBooking,
}: BookingCalendarProps) {
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<string[]>([]);

  const memberById = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((m) => map.set(m.id, m));
    return map;
  }, [teamMembers]);

  const visibleBookings = useMemo(
    () =>
      bookings.filter((b) =>
        memberFilter === "all" ? true : b.teamMemberId === memberFilter,
      ),
    [bookings, memberFilter],
  );

  const visibleSlots = useMemo(
    () =>
      openSlots.filter((s) => {
        if (s.status !== "open") return false;
        if (memberFilter === "all") return true;
        return !s.teamMemberId || s.teamMemberId === memberFilter;
      }),
    [openSlots, memberFilter],
  );

  /** Alle elementer grupperet pr. dag og sorteret efter klokkeslæt. */
  const itemsByDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (key: string, item: DayItem) => {
      if (!key) return;
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    };

    visibleBookings.forEach((booking) => {
      const time = bookingTimeOf(booking);
      push(bookingDayKey(booking.date), {
        kind: "booking",
        time,
        minutes: timeToMinutes(time),
        booking,
      });
    });

    visibleSlots.forEach((slot) => {
      const time = (slot.time || "").slice(0, 5);
      push(bookingDayKey(slot.date), {
        kind: "slot",
        time,
        minutes: timeToMinutes(time),
        slot,
      });
    });

    map.forEach((list) => list.sort((a, b) => a.minutes - b.minutes));
    return map;
  }, [visibleBookings, visibleSlots]);

  const monthGridStart = useMemo(
    () => startOfWeek(startOfMonth(anchorDate), { weekStartsOn: 1 }),
    [anchorDate],
  );
  const weekStart = useMemo(() => startOfWeek(anchorDate, { weekStartsOn: 1 }), [anchorDate]);

  const monthDays = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)),
    [monthGridStart],
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const today = new Date();

  const rangeLabel =
    view === "month"
      ? capitalize(format(anchorDate, "LLLL yyyy", { locale: da }))
      : `Uge ${getISOWeek(weekStart)} · ${format(weekStart, "d. MMM", { locale: da })} – ${format(
          addDays(weekStart, 6),
          "d. MMM yyyy",
          { locale: da },
        )}`;

  const goPrev = () =>
    onAnchorDateChange(view === "month" ? addMonths(anchorDate, -1) : addWeeks(anchorDate, -1));
  const goNext = () =>
    onAnchorDateChange(view === "month" ? addMonths(anchorDate, 1) : addWeeks(anchorDate, 1));

  const handleDropOnDay = (date: Date, time?: string) => {
    const booking = draggingBooking;
    setDraggingBooking(null);
    if (!booking) return;
    const targetDate = dayKey(date);
    const targetTime = time || bookingTimeOf(booking) || "09:00";
    if (targetDate === bookingDayKey(booking.date) && targetTime === bookingTimeOf(booking)) return;
    onMoveBooking(booking, targetDate, targetTime);
  };

  const memberColor = (memberId?: string | null) =>
    (memberId && memberById.get(memberId)?.color) || NEUTRAL_MEMBER_COLOR;

  const memberName = (memberId?: string | null) =>
    (memberId && memberById.get(memberId)?.name) || "";

  /** Popover-menu til tomme celler: opret booking eller ledig tid. */
  const renderCellMenu = (cellKey: string, dateStr: string, time: string | undefined, cell: ReactElement) => {
    if (menuKey !== cellKey) return cell;
    return (
      <Popover open onOpenChange={(open) => !open && setMenuKey(null)}>
        <PopoverTrigger asChild>{cell}</PopoverTrigger>
        <PopoverContent className="w-52 p-1" align="start" data-testid="calendar-cell-menu">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            onClick={() => {
              setMenuKey(null);
              onCreateBooking(dateStr, time);
            }}
            data-testid="menu-new-booking"
          >
            <CalendarPlus className="h-4 w-4" /> Ny booking
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            onClick={() => {
              setMenuKey(null);
              onCreateSlot(dateStr, time);
            }}
            data-testid="menu-new-open-slot"
          >
            <Clock className="h-4 w-4" /> Ny ledig tid
          </button>
        </PopoverContent>
      </Popover>
    );
  };

  const bookingChip = (booking: Booking, compact: boolean) => {
    const color = memberColor(booking.teamMemberId);
    const cancelled = booking.status === "cancelled";
    return (
      <div
        key={`booking-${booking.id}`}
        draggable={!cancelled}
        onDragStart={(e) => {
          if (cancelled) return;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", booking.id);
          setDraggingBooking(booking);
        }}
        onDragEnd={() => setDraggingBooking(null)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectBooking(booking);
        }}
        className={`truncate rounded-md border-l-4 px-1.5 py-0.5 text-[11px] font-medium leading-tight ${
          cancelled ? "line-through opacity-60" : "cursor-pointer hover:brightness-95"
        } ${compact ? "" : "h-full overflow-hidden"}`}
        style={{
          backgroundColor: hexToRgba(color, cancelled ? 0.1 : 0.22),
          borderLeftColor: color,
        }}
        title={`${booking.time ? bookingTimeOf(booking) + " " : ""}${booking.customerName} · ${booking.service}${
          memberName(booking.teamMemberId) ? ` · ${memberName(booking.teamMemberId)}` : ""
        }`}
        data-testid={`calendar-booking-${booking.id}`}
      >
        <span className="tabular-nums opacity-70">{bookingTimeOf(booking)}</span>{" "}
        <span>{booking.customerName}</span>
        {!compact && (
          <div className="truncate text-[10px] font-normal opacity-80">{booking.service}</div>
        )}
      </div>
    );
  };

  const slotChip = (slot: OpenSlot, compact: boolean) => {
    const color = memberColor(slot.teamMemberId);
    return (
      <div
        key={`slot-${slot.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSlot(slot);
        }}
        className={`cursor-pointer truncate rounded-md border border-dashed px-1.5 py-0.5 text-[11px] leading-tight text-muted-foreground hover:bg-muted ${
          compact ? "" : "h-full overflow-hidden"
        }`}
        style={{ borderColor: color }}
        title={`${(slot.time || "").slice(0, 5)} ledig tid${
          memberName(slot.teamMemberId) ? ` · ${memberName(slot.teamMemberId)}` : ""
        }`}
        data-testid={`calendar-slot-${slot.id}`}
      >
        <span className="tabular-nums">{(slot.time || "").slice(0, 5)}</span> Ledig tid
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goPrev} data-testid="calendar-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnchorDateChange(new Date())}
            data-testid="calendar-today"
          >
            I dag
          </Button>
          <Button variant="outline" size="icon" onClick={goNext} data-testid="calendar-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-base font-semibold" data-testid="calendar-range-label">
          {rangeLabel}
        </div>
      </div>

      {/* Personfilter */}
      {teamMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onMemberFilterChange("all")}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              memberFilter === "all" ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            data-testid="filter-member-all"
          >
            Alle
          </button>
          {teamMembers.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onMemberFilterChange(member.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                memberFilter === member.id ? "border-primary bg-primary/10" : "hover:bg-muted"
              }`}
              data-testid={`filter-member-${member.id}`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: member.color || NEUTRAL_MEMBER_COLOR }}
              />
              {member.name}
            </button>
          ))}
        </div>
      )}

      {view === "month" ? (
        <div className="overflow-hidden rounded-lg border" data-testid="calendar-month">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {weekDays.map((day) => (
              <div
                key={`head-${day.toISOString()}`}
                className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
              >
                {capitalize(format(day, "EEEEEE", { locale: da }))}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const key = dayKey(day);
              const items = itemsByDay.get(key) || [];
              const expanded = expandedDays.includes(key);
              const shown = expanded ? items : items.slice(0, 3);
              const hidden = items.length - shown.length;
              const isToday = isSameDay(day, today);
              const inMonth = isSameMonth(day, anchorDate);

              const cell = (
                <div
                  className={`min-h-[104px] cursor-pointer border-b border-r p-1 transition-colors last:border-r-0 hover:bg-muted/40 ${
                    inMonth ? "" : "bg-muted/20 text-muted-foreground"
                  }`}
                  onClick={() => setMenuKey(key)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnDay(day);
                  }}
                  data-testid={`calendar-day-${key}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium ${
                        isToday ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {shown.map((item) =>
                      item.kind === "booking" ? bookingChip(item.booking, true) : slotChip(item.slot, true),
                    )}
                    {hidden > 0 && (
                      <button
                        type="button"
                        className="w-full rounded px-1 text-left text-[11px] text-muted-foreground hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedDays((prev) => [...prev, key]);
                        }}
                        data-testid={`calendar-more-${key}`}
                      >
                        +{hidden} flere
                      </button>
                    )}
                  </div>
                </div>
              );

              return (
                <div key={key}>{renderCellMenu(key, key, undefined, cell)}</div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border" data-testid="calendar-week">
          <div className="flex border-b bg-muted/40">
            <div className="w-14 shrink-0" />
            {weekDays.map((day) => {
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={`wh-${day.toISOString()}`}
                  className="flex-1 px-1 py-1.5 text-center text-xs"
                >
                  <div className="text-muted-foreground">
                    {capitalize(format(day, "EEEEEE", { locale: da }))}
                  </div>
                  <div
                    className={`mx-auto mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-medium ${
                      isToday ? "bg-primary text-primary-foreground" : ""
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            <div className="flex">
              {/* Tidsakse */}
              <div className="w-14 shrink-0">
                {Array.from({ length: WEEK_END_HOUR - WEEK_START_HOUR }, (_, i) => (
                  <div
                    key={`hour-${i}`}
                    className="relative border-b text-[11px] text-muted-foreground"
                    style={{ height: ROW_HEIGHT * 2 }}
                  >
                    <span className="absolute right-1 top-0 -translate-y-1/2 bg-background px-0.5">
                      {String(WEEK_START_HOUR + i).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {weekDays.map((day) => {
                const key = dayKey(day);
                const items = itemsByDay.get(key) || [];
                return (
                  <div key={`col-${key}`} className="relative flex-1 border-l">
                    {Array.from({ length: WEEK_ROWS }, (_, row) => {
                      const minutes = WEEK_START_MINUTES + row * SLOT_MINUTES;
                      const time = minutesToTime(minutes);
                      const cellKey = `${key}T${time}`;
                      const cell = (
                        <div
                          className={`cursor-pointer hover:bg-muted/50 ${
                            row % 2 === 1 ? "border-b" : "border-b border-dashed border-muted"
                          }`}
                          style={{ height: ROW_HEIGHT }}
                          onClick={() => setMenuKey(cellKey)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDropOnDay(day, time);
                          }}
                          data-testid={`calendar-cell-${cellKey}`}
                        />
                      );
                      return (
                        <div key={cellKey}>{renderCellMenu(cellKey, key, time, cell)}</div>
                      );
                    })}

                    {/* Chips oven på rasteret */}
                    <div className="pointer-events-none absolute inset-0">
                      {items.map((item) => {
                        const duration =
                          item.kind === "booking"
                            ? item.booking.durationMinutes || 60
                            : item.slot.durationMinutes || 30;
                        const top = ((item.minutes - WEEK_START_MINUTES) / SLOT_MINUTES) * ROW_HEIGHT;
                        const height = Math.max(20, (duration / SLOT_MINUTES) * ROW_HEIGHT - 2);
                        if (top < -height) return null;
                        return (
                          <div
                            key={item.kind === "booking" ? item.booking.id : item.slot.id}
                            className="pointer-events-auto absolute left-0.5 right-0.5"
                            style={{ top: Math.max(0, top), height }}
                          >
                            {item.kind === "booking"
                              ? bookingChip(item.booking, false)
                              : slotChip(item.slot, false)}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border-l-4 border-l-slate-400 bg-slate-200" />
          Booking
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-6 rounded border border-dashed border-slate-400" />
          Ledig tid
        </span>
        <span className="flex items-center gap-1.5">
          <Plus className="h-3 w-3" /> Klik på en tom celle for at oprette
        </span>
      </div>
    </div>
  );
}
