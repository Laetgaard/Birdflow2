---
name: Invented-claims gate
description: Evidence-pool design for refusing AI-invented claims (prices, testimonials, stats, credentials) — which pool per path, baseline rule for final guards, traversal and ordering hazards.
---

# Invented-claims gate (business facts)

The AI may rephrase customer facts, never add new concrete claims. Enforcement is deterministic server code — prompts only reduce the refusal rate, they are not the guarantee.

## Evidence-pool rule (the core design)
- **Mutations**: pool = business facts + ALL current site copy. Echoing/moving/restyling existing content is never "inventing"; legacy content is grandfathered.
- **Whole-state scrubs of machine output** (onboarding, architect rebuild, fallbacks): pool = facts ONLY. Machine output must not vouch for itself.
- **Final guard on a mutation-path save** (agent runs that persist a whole state): pool = facts + the site as it stood BEFORE the run. Facts-only there would nuke grandfathered/customer copy; state-as-its-own-baseline would let fabrications self-certify.
- **Why:** one pool for every path either blocks harmless edits of old copy or lets generated fabrications launder themselves in.

## Rules that took thought
- `forbiddenClaims` are EXCLUDED from evidence and refused even when a fact backs them ("true but must not be said").
- Detectors always run BOTH Danish and English; only refusal/note language follows the site language. Missing context ≠ gate off.
- Multi-part detector keys ("9 out of 10") require each number separately backed — keeps cross-language backing working.
- Stats/pricing rows are claims by construction: judge `value`/`price` fields directly; sentence detectors miss split number+keyword.
- Protected facts are enforced structurally: no AI mutation can write the business context at all.

## Ordering hazard: validation vs materialization
High-level section mutations are validated before registry defaults / custom content become real props. Judge the payload at validation AND scrub each materialized component at expansion; a fully-unbacked sample section is dropped, not added. Belt-and-braces: whole-state paths scrub AFTER expansion too, and the agent save path runs the baseline-evidence final guard. Manual (human) section-adding stays ungated on purpose.

## Traversal, not allowlists
A "which props carry text" allowlist drifts with every new component shape, and a drifted allowlist is a silent hole. Walk every string, with three guards: skip style subtrees entirely (percent widths read as statistics), skip technical keys/values in BOTH detection and evidence (a filename like `foto-850kr.jpg` must neither launder "850 kr" in nor get refused), and for HTML scrub text runs then re-check the tag-stripped whole (claims straddle inline tags) — blank the string rather than attempt markup surgery.

## Accepted trade-off
Static human-authored starter templates seed sample claims by design (non-AI path, customer owns and edits them). Grandfathered deliberately — do not "fix" by scrubbing template picks.

## How to apply
New AI write path? Mutation-shaped → the shared per-mutation validator (claims gate runs last, structural errors keep their messages; no action-subset shortcuts — that was a real bypass once). Whole machine-generated states → facts-only scrub. Persisting a whole state after a gated run → baseline-evidence scrub with the pre-run state. Tests assert wiring via source tripwires — re-point them when renaming.
