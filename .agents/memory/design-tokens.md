---
name: Design tokens (brand references)
description: How a style value points at the brand instead of repeating it, and the four places that quietly break it.
---

A style value may be a reference to a brand role (`"{color.primary}"`) instead
of a literal. One shared resolver decides what a role is worth; the builder
resolves while it draws, the publisher resolves while it writes the project.

**Why the publisher resolves at generation time, not at runtime:** a generated
Next.js project cannot import `@shared`. Resolving during generation means the
project receives finished values instead of a second copy of the resolver that
would drift from the editor's — parity then holds by construction rather than
by discipline.

**Resolve before sanitising.** The publisher must substitute references
*before* the custom-content sanitiser runs, so the resolved brand value is
subject to the same checks as any other value that reaches a stylesheet.
Sanitising first also silently deletes the references.

**The primitive-style sanitiser rejects `{` and `}`** as CSS-rule breakout
characters, so it has to recognise a whole-value reference to a known role
explicitly. Without that, a custom component's colour disappears the moment
the site is saved — the failure is invisible until someone looks at the site.
Keep the exception narrow: whole-value references to closed set of roles only,
never embedded ones.

**Migration must be value-preserving.** Turning existing literals into
references may only match values that already render identically, otherwise a
live site changes appearance on load. Two traps:
- Colours: only exact matches migrate. A near-match was a deliberate one-off.
- Fonts: compare through the approved-font resolver, not raw strings. Both
  renderers normalise a stored font before use, so `"Lato"` and
  `"Lato, sans-serif"` already draw the same thing; comparing raw strings
  leaves the first one a literal that stops following the brand.

**Every section must ask the same question about the brand.** The failure
mode is a section that reads only its own override and falls back to a
built-in default instead of the brand value — the preview then shows one font
and the published page inherits another, for the same site. Cover the whole
registry in one parametrised test rather than spot-checking a hero.

**Paired fonts need a rule of their own.** Sections set one font on
themselves and let their headings inherit it, so a heading font only takes
effect through an explicit heading rule — the preview scopes it to its section
wrapper, the published site emits the equivalent into globals.css, and both
are skipped when the two fonts are the same. What a section inherits must come
from the resolved body token, not the raw stored font family, or a paired site
inherits one font in defaults and another through references.

**How to prove neutrality:** render the same component before and after
migration through both renderers and compare the markup. The parity harness
mirrors the publisher's resolve step so a tokenised component can be compared
against the preview, which resolves for itself.

**Migration runs in memory on builder load and is not autosaved.** Persisting
it would bump the revision and disturb revision-scoped approval; it lands with
the customer's next real edit.

**AI enforcement lives at the choke point, not in the prompt.** Prompt and
schema guidance ask for references, but the model will type a hex eventually,
and a hex is a section that quietly stops following the brand. Tokenising the
finished state at the end of mutation application covers every writer path and
sections expanded from templates.

**`isTokenRef` returns `boolean`, deliberately not a type predicate.** A
`value is string` predicate narrows the else-branch of `value: string` callers
to `never`.
