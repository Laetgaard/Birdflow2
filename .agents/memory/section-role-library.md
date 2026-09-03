---
name: Section-role library
description: Maps page roles to recommended section sequences and min counts; used by plan prompt, build prompt, and post-build completeness check.
---

## What it does
`server/sectionRoleLibrary.ts` provides:
- `ROLE_SECTION_SEQUENCES` — ordered section type sequence per `PageRole`
- `ROLE_MIN_SECTIONS` — minimum section count per role for post-build validation
- `IMAGE_BEARING_SECTIONS` — section types that should get an `ai://` image marker
- `buildRoleToSectionTable()` — embedded into plan and build prompts
- `sectionContentRequirements()` — embedded into section build prompts
- `isPageComplete(role, count)` — used by `buildCompletenessNotes()` in orchestrator

## Key constants
- `MAX_IMAGES_PER_BUILD`: 8 (was 3) — in `shared/assistantPlan.ts`
- `MAX_AI_IMAGES_PER_REQUEST`: 5 (was 3) — in `server/aiImages.ts`
- Step detail max: 1500 chars (was 600) — in `server/planDraft.ts`
- Plan turns: 15 (was 12) — in `server/planAgent.ts`

## Post-build completeness check
`buildCompletenessNotes(state)` in `buildOrchestrator.ts` runs after self-review.
It appends Danish notes to the last step result for any page below its role minimum.
This surfaces naturally in the build summary without schema changes.

**Why:** AI models stop too early when given vague instructions. Explicit section
sequences, content depth requirements per section type, and post-build validation
together push the model to build complete 6-10 section pages.

## Image pipeline
Business context (`businessName`, `description`) is now threaded through:
`resolveAiImageMarkers` → `generateAndStoreImage` → `buildImagePrompt`
Call sites in `aiAgentTools.ts` extract from `ctx.state.businessContext`.

**How to apply:** When changing section types in the registry, update
`ROLE_SECTION_SEQUENCES` in sectionRoleLibrary.ts to keep the prompt table current.
