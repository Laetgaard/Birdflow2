---
name: Onboarding design candidates
description: Durable rules for generating, reviewing, storing and selecting the three onboarding design directions.
---

Onboarding directions are complete builder snapshots derived from one verified brief, not lightweight preview objects or three independent content generations. Their manifests must bind asset placements to real page/component IDs, and uniqueness is judged from the actual states rather than manifest labels.

**Why:** Customers must compare genuinely different presentations without seeing different facts, invented claims, or a preview that cannot become the editable site.

**How to apply:** Review every candidate at desktop and mobile size, fail closed when review is unavailable, and persist the candidate bundle with the selected builder state under one revision-checked transaction.

Direction selection promotes the stored snapshot unchanged. It must re-check candidate eligibility, update readiness fingerprints/revisions atomically, and be blocked while checkout, invoice collection, or payment is active.

**Why:** Regeneration or an unguarded switch can make the preview, approval and paid draft refer to different websites.

**How to apply:** Treat selection like a builder write: lock builder then onboarding session, invalidate approval when allowed, never retry a stale revision blindly, and preserve the exact candidate fingerprint.

Retained QA evidence is successful only when all three candidate states, six candidate screenshots, decision-state evidence, exact preview/selection fingerprints, and completed visual reviews agree. A file or database row existing is not proof that the corresponding step worked.

**Why:** A detailed retained audit found high candidate scores alongside blank owned imagery, clipped mobile layouts, thin pages, unavailable visual review, and unmatched fingerprints. Treating record existence as success would have hidden these failures.

**How to apply:** Preserve every attempt append-only, classify missing evidence explicitly, keep provider failures separate from screenshot capture, and calibrate quality scores only from checks that actually ran.