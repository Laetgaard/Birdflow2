---
name: Public-site language switching
description: How the DA/EN choice on BirdFlow's public marketing pages is scoped, stored and rendered, and the constraints that shaped it.
---

# Route-aware locale, not app-wide locale

The saved language is **global and persistent**, but the **displayed** language is
derived per route: only the public marketing routes honour the stored choice; auth
screens and the whole logged-in product render Danish regardless. The provider
therefore exposes two values — the stored preference (what the toggle shows) and
the effective language (what the page renders). Never collapse them into one.

**Why:** the product UI, onboarding, generated customer sites and transactional
emails are Danish-only. If the provider returned a single `lang`, a visitor who
picked English on the front page would land in a half-translated dashboard.

**How to apply:** when a new public page becomes bilingual, add its path to the
public-marketing path set — that set is the single switch that decides whether the
choice applies and whether the toggle is offered. Anything not in the set stays
Danish automatically.

# No flash of the wrong language

Read the stored preference **synchronously in the state initialiser**, not in an
effect. An effect-based read renders Danish for one frame before swapping to
English, which is very visible on a full page of copy.

# Copy lives in one `Record<Lang, Shape>` per page

Each bilingual page holds a single typed copy record with a `da` and an `en`
branch, consumed through one hook. Module-level arrays of user-facing strings
must be folded into that record; anything that stays module-level (icons, accent
colours, ordering) must be language-neutral and keyed by index.

**Why:** a full `Record<Lang, Shape>` makes a missing translation a type error.
Per-string ternaries scattered through JSX let Danish leak into English silently.

# Verifying a translation pass

Two checks catch nearly everything, both worth rebuilding as throwaway scripts:

1. **Danish residue** — render each page in English in a headless browser and
   scan `body.innerText` for `æøå` plus a few unambiguous Danish stopwords. Watch
   for false positives: `booking` is also English, and fictional domains
   (`din-klinik.dk`) are intentionally Danish.
2. **Danish preserved verbatim** — diff every string literal containing `æøå`
   between `HEAD` and the working tree; each one must still appear somewhere in
   the new file. This proves the Danish was *moved*, not reworded.

Also check `document.documentElement.lang`, horizontal overflow at 375/1024/1440,
and that returning from an auth screen to a public page restores the choice.

# Adding a control to a nav that is already full

The shared public navbar was at capacity at its `lg` breakpoint before the toggle
existed (Danish fitted with ~6px to spare at exactly 1024px). Adding any control
there **will** clip the CTA unless spacing is bought back in the `lg`–`xl` range
(smaller gap, smaller button padding, one step smaller link text), with the
original rhythm restored at `xl`.

**How to apply:** measure, do not eyeball — compare the nav's right edge against
its parent row's right edge at 1024/1152/1280/1440 in *both* languages, and
compare against the pre-change baseline before accepting the result.
