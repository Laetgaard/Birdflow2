---
name: Onboarding decision flow (preview → approve → pay / customise)
description: Rules for the end of onboarding — revision-scoped approval, Stripe card/invoice paths, webhook dedup and the read-only preview.
---

# End of onboarding: preview, approve, customise, pay

## Four independent state dimensions, one writer
Generation, decision, payment-method and payment are separate persisted dimensions on the onboarding session — never collapsed into one "status" string. One server module is the only writer, and it is also the choke point for the schema-readiness gate below; the pure state machine (stage derivation, approval staleness, due-date maths, mandated Danish copy) lives in shared code so client and server agree.
**Why:** a single status forced impossible questions ("is a customer with an open invoice who booked a meeting *paid*?") and every screen invented its own guess.
**How to apply:** new outcomes extend one dimension; if you need a new stage, derive it in the shared state machine, don't add a status value elsewhere.

## Approval is scoped to a site revision
Approval stores the revision it approved; a later site change voids it and the customer must re-approve — *unless* payment already succeeded (a paid customer is never told their approval is stale).
**Why:** otherwise a post-approval edit ships something the customer never agreed to.
**How to apply:** bump the revision **only from explicit site mutations** (builder-state PATCH, AI agent/apply/architect writes). Never bump from a GET-time legacy-state migration or any read path — opening the builder would silently void an approval.

## Idempotency key shape
Scope checkout/invoice idempotency to website + approved revision + payment method, and additionally reuse a still-open Checkout Session whose metadata revision matches.
**Why:** website-only keys block a legitimate second attempt after the site changed; revision-less keys let double clicks create a second subscription and a second setup charge.

## Paid state comes only from a verified webhook
No client callback, no success-URL redirect, no polling result may set paid. The success URL only starts a short "confirming with Stripe" poll of the server record.
**How to apply:** invoice customers stay reachable (preview, guide, status) while the invoice is open; treat `invoice.paid` as the single transition.

## Webhook dedup is per consumer, not per event
Stripe event ids are claimed in a shared dedup table, but each consumer claims a namespaced key (`<eventId>:onboarding`, `<eventId>:orders`).
**Why:** one endpoint feeds several independent handlers; a bare event-id claim makes the first handler starve the others. A dedup-table failure must fall through to processing — a missing dedup row is cheaper than a dropped payment.

## Stripe invoice due on the 1st of next month
Use a `send_invoice` subscription plus `add_invoice_items` for the one-time setup fee, then pin the exact `due_date` on the draft invoice before sending. Compute the date by incrementing the month (December must roll into January) — never by adding days.

## Prices are never literals
All amounts resolve live from Stripe Price objects; missing configuration surfaces as a 503, never a fallback number. A regression test scans the billing module for 4+ digit literals, so unix-seconds conversions must stay in the recognisable `* 1000` / `/ 1000` form.

## Preview isolation
The read-only preview is a same-origin route embedded in an iframe sandboxed to scripts and same-origin only — no forms, popups or top navigation — plus in-iframe neutralisation of submit/click and non-GET fetch. Ownership of both the onboarding session and the website is checked server-side before any preview, download, approval or booking.

## Paying is not the only gate
Payment state and the profile-level onboarding flag live on different rows, so they cannot be written atomically. Converge from both ends: retry after the payment event, and reconcile idempotently on every authoritative read.
**Why:** a customer who paid but whose flag write failed bounces forever between the onboarding page and the dashboard, each redirecting to the other.
**How to apply:** whenever a new state must unlock a gate someone else owns, make the unlock idempotent and re-assert it on read — never once, in one place, best-effort.

## Boot-time DDL needs a readiness gate
This project has no migration runner, so schema changes are idempotent DDL run at boot — but the port opens first and the database can be briefly unreachable. Anything touching new columns must await a shared readiness promise (one attempt shared by all waiters, self-retrying), and boot must retry with backoff without blocking the port.
**Why:** otherwise the first request after a cold start reads a column that does not exist yet, and a database that was down for ten seconds stays broken until someone restarts the process.
