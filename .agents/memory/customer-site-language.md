---
name: Customer website language (da/en)
description: How one per-website language choice reaches onboarding, generation, published sites, emails and the builder AI — plus the traps found while wiring it.
---

# One language value, many consumers

The customer's choice lives on the `websites` row and is mirrored from the
onboarding answers. Every downstream consumer has a `websiteId` but not an
onboarding session, so the row — not the session — is the source of truth.

**Why:** generation, publishing, emails, the builder agent and the design
interview all run long after onboarding ends, sometimes months later.

**How to apply:** when adding a new customer-facing output, read the language
off the website row (`normalizeSiteLanguage(website?.language)`) and default to
Danish. Never thread it through call chains from onboarding.

## Danish is a default, not a fallback path

Every localized function takes the language as a *trailing, defaulted*
parameter, so an un-threaded caller keeps producing today's Danish output and
the compiler never forces a sweeping edit. `normalizeSiteLanguage` turns
anything that is not `"en"` into Danish rather than throwing — a bad value must
never strand a customer mid-onboarding.

## The publisher's double-escape trap (cost real debugging time)

Generated Next.js files are built from template literals in the publisher.
Localized text must be interpolated at *generation* time:

    ${jsx(t.cartTitle)}   →  {"Din kurv"}      (JSX text node / attribute)
    ${lit(t.cartClose)}   →  "Luk"             (generated JS/TS context)

Writing `${'${jsx(t.cartTitle)}'}` type-checks, publishes, and emits the literal
characters `${jsx(t.cartTitle)}` into the customer's live site — `jsx` and `t`
do not exist in the generated project. tsc cannot catch it.

**How to apply:** after touching publisher templates, run the generators and
assert the output contains no `jsx(t.` / `lit(t.`. There is a test for exactly
this in `tests/site-language.test.ts`; keep it.

## Email defaults live in two places

Picking a per-language default inside the email service is not enough: template
rows are *seeded into the database* for every website the first time an email is
attempted, and a seeded row always wins over the service default. Both the
seeding and the send path must choose by the website's language, and seeding
must stay insert-only so a customer's edited wording is never overwritten.

## Builder-agent language vs interface language

The site copy follows the customer's language; the builder/manage/dashboard
chrome, the agent's status messages and its summaries stay Danish. The system
prompt has to say both, or the model answers the user in English as soon as the
site is English.
