---
name: Platform calendar & booking context
description: BirdFlow's own bookings live on a sentinel-owned websites row with an explicit booking context; the invariants any new websites/bookings query must respect.
---

# BirdFlow's own calendar is a `websites` row, and bookings carry a context

**Invariant 1 — the platform row is never a customer.**
BirdFlow's own booking calendar is an ordinary website row of the platform kind, owned by a non-uuid sentinel rather than a real account. It must be excluded from every query that lists, counts or bills websites (site lists, plan limits, admin directories, funnels, growth charts), and nobody may ever be resolved as its owner — access is admin-only, decided server-side.

**Invariant 2 — the two booking sides must never leak into each other.**
An explicit context column separates BirdFlow's internal onboarding meetings from appointments made through customers' published sites. Its NOT NULL default lives in the **database**, not in application code, because published customer sites insert bookings straight into Supabase without passing through this codebase. Every query that lists or counts bookings has to make a context decision, and so does every new booking-adjacent background job.

**Why:** The alternative — a fake customer account or a hardcoded website id — makes the internal calendar indistinguishable from a real customer in every aggregate, and one forgotten filter turns internal meetings into customer-visible bookings or inflates someone's plan usage. Nothing fails loudly when this goes wrong.

**How to apply:**
- Reuse the single booking engine (services, weekly availability, open slots, atomic claim, conflict checks, ICS email). Never fork a second one for internal meetings.
- Seeding runs at boot behind a Postgres advisory lock plus a partial unique index, because dev and prod share one database and both may boot at once.
- Reminders are deliberately context-agnostic; "thanks, book again" follow-ups are customer-site only.

# Drizzle gotcha: don't `$type<Union>()` a column on a widely-updated table

Adding `.$type<SomeUnion>()` to a `text()` column narrows it inside the insert type, and every existing `update(...).set({ ...partial, updatedAt })` helper that passes a `Partial<>` of it then fails to typecheck — the errors surface in unrelated call sites, not where you edited. Keep the column plain `text()` and export the union separately for the code that writes it.
