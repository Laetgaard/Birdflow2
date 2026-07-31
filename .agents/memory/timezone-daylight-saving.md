---
name: Timezone & DST handling (Europe/Copenhagen analytics)
description: Rules for local-day windows, daily series iteration, and ICU quirks when bucketing by Copenhagen days.
---

# Local-day windows must be DST-aware

**Rule:** A Copenhagen "day" is 23h on the spring-forward day and 25h on the
fall-back day. Never compute a local day window as `start + 24h` — derive the
end as the NEXT local midnight (day start of `start + 30h` works: 30h past
midnight is always inside the next 23–25h day). Same for iterating daily
series: step over calendar dates with pure `Date.UTC(y,m,d) + 86400000`
arithmetic on date components, never step a real timestamp by 24h (that skips
or duplicates a local date at DST transitions).

**Why:** Architect review caught that `+24h` day windows put one hour of
bookings/orders in the wrong Copenhagen date twice a year, and timestamp
stepping duplicated a chart date across the autumn transition.

**How to apply:** Anything bucketing by local day — overview KPIs, analytics
timeseries, booking date windows. Server tests must include the two DST
Sundays (late March, late October). SQL side: bucket with
`timezone('Europe/Copenhagen', timezone('UTC', ts))::date`, which is
DST-correct on its own.

# ICU 24:00 quirk in tests

`Intl.DateTimeFormat(..., { hour12: false })` can render midnight as "24:00"
in some ICU versions. Use `hourCycle: "h23"` in tests/format helpers that
assert on "00:00".
