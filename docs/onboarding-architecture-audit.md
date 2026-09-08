# Task #236 — Full onboarding architecture audit

**Scope and method.** This is a code-grounded audit of the current repository, not a redesign or implementation plan. Labels mean **ACTIVE** (reachable implementation), **MISSING** (not found), **LEGACY** (old compatibility code), **FALLBACK** (degraded recovery), and **UNVERIFIED** (not runtime-proven here). Supplemental labels are **PARTIAL** (only some of the stated behavior is implemented), **PARALLEL** (a separately active system for a related concern), and **INSUFFICIENT** (retained evidence exists but cannot establish the claimed end-to-end behavior). File references are current-code evidence; no provider credentials or raw provider failures are included.

## 1. Executive summary

**ACTIVE — decisive canonical answer.** `BuilderStateData` is the canonical TypeScript/render contract for an editable Birdflow site, and its current persisted instance is the one-per-site `builder_state.state` JSONB record—not imported HTML, generated TSX, an onboarding answer payload, or a direction preview. Its contract is `shared/schema.ts:569-641`: `BuilderStateData` contains `pages`, `globalStyles`, optional `navigation` and `siteChrome`, capabilities/configuration, assets and context; `builderState.website_id` is unique and its `revision` supports compare-and-swap writes. **Important runtime qualification:** the DB insert validator is intentionally `insertBuilderStateSchema.state: z.any()` (`shared/schema.ts:623-632`); TypeScript typing is not a runtime JSON schema validation guarantee. A page is `BuilderPage` (`shared/schema.ts:472-484`) containing registry `BuilderComponentData` sections. This is the format onboarding must ultimately generate.

Both active journeys create/link a `websites` draft, `builder_state`, and `onboarding_sessions` record through `server/routes.ts:417-547`. They converge only after import approval or interview submission at `startOnboardingGeneration(websiteId, OnboardingGenInput)` (`server/onboardingGenerator.ts:81-123,233-306`). The generator creates normal builder state, then direction candidates and selection replace the chosen state atomically (`server/onboardingDecision.ts:182-315`).

The existing-site flow is an evidence-informed regeneration, not DOM-to-builder conversion: HTTP crawl → extracted facts/assets → analysis → `OnboardingGenInput.migration` → shared AI plan/build → `BuilderStateData`. It preserves selected assets and some facts but does not recreate source layout, CSS, script behavior, navigation tree, native forms, booking configuration, commerce, or memberships (`server/websiteImportCrawler.ts:179-262`; `server/websiteImportService.ts:341-442`). The new-site flow is similarly a generator pipeline, but starts from interview/business/design answers rather than crawled evidence.

## 2. Architecture diagram

```text
New site (ACTIVE)
onboarding UI answers
  → POST /api/onboarding/create-website [websites + builder_state transaction]
  → answers.path="ai", onboarding_sessions.websiteId
  → POST /api/websites/:id/onboarding/generate
  → brandguide → plan → build → enhance → check
  → BuilderStateData in builder_state.state
  → direction candidates / read-only preview / selected state
  → decision approval → /builder/:websiteId → publish snapshot → generated Next project

Existing site (ACTIVE)
URL + ownership + preserve|improve
  → POST /api/onboarding/import/start → answers.websiteImport(discovering lease)
  → crawlWebsite: public, same-origin HTML pages / sitemap / assets
  → analyseReport (AI, or deterministic analysis FALLBACK) → review
  → POST /api/onboarding/import/approve: selected pages/assets/booking choice
  → downloaded media + OnboardingGenInput.migration facts
  └──────────────────────────────────────────────→ same shared generator above

Parallel path (ACTIVE/PARALLEL)
buildWorker/buildOrchestrator plan/build records, with distinct per-step persistence
(`server/buildWorker.ts`), is not the primary onboarding generator.
```

**Convergence/divergence.** Scratch calls the shared generator at `server/routes.ts:6304-6315`; import does so after approval at `server/routes.ts:846-848`. Before that, import alone uses `websiteImportService.ts`, `websiteImportCrawler.ts`, report analysis and asset copying; scratch alone reconstructs interview input through `scratchGenerationInput` (`routes.ts:6207-6243`). There is no demonstrated shared persisted `SiteSpec`: the closest common handoff is `OnboardingGenInput`, with import’s optional `migration` object.

## 3. New-site onboarding

**ACTIVE.** `client/src/pages/onboarding.tsx` is the primary UI; `POST /api/onboarding/create-website` creates `websites` (`setupType: "ai"`, `status: "draft"`, language) and an empty-home `builder_state` in a transaction (`server/routes.ts:481-525`). It then non-fatally links `onboarding_sessions.websiteId` and sets `answers.path` to `"ai"` or `"import"` (`:528-543`). Consequently, **ACTIVE risk:** a website can exist if the later session link fails.

The generation endpoint is `POST /api/websites/:id/onboarding/generate` (`routes.ts:6245-6322`). It requires business name, industry/description, goals/notes, feeling, palette/font pair and image paths; rejects unapproved fonts, non-empty builder state (409), unowned media, and limits starts to three per six hours (`:6188-6305`). `startOnboardingGeneration` claims durable generation state, registers a process-local job, and persists terminal status (`onboardingGenerator.ts:233-306`). The create endpoint additionally uses `aiOnboardingCreateLock`, a process-local `Set<userId>`, and reuses an existing owner AI draft (`server/routes.ts:414-455`). **PARTIAL:** this blocks double submit only within one Node process; it is not a cross-instance distributed lock, so cross-instance concurrent creates still depend on the existing-draft check rather than a database uniqueness constraint.

Its exact phases are `brandguide|plan|build|enhance|check|done|error` (`onboardingGenerator.ts:127-177`): `finalizeBrandGuide`, `analyzeAndPlanWebsite`/`buildFromPlan`, `processAIBuildRequest` plus image resolution, and `runSelfCheck` (`:549-724`). These are persisted UI/progress statuses, not a complete enumeration of execution: subsequent direction enrichment builds three complete candidates and runs visual review/repair (documented in §§9 and 11). Generation status is mirrored to `onboarding_sessions.genStatus` and includes `phase`, `phasesDone`, `done`, `fallback`, `readiness`, quality revision/fingerprint and `attempt`; readiness is `ready|repair_required|provider_failed|spend_limited|deterministic_fallback`.

`GET /api/websites/:id/onboarding/generate/status` reads jobs/status and, after restart, can reconstruct persisted AI answers and restart with `{mode:"recover"}` (`routes.ts:6324-6420`), stopping at attempt three. **MISSING:** durable per-phase input/output checkpoints; the live worker is a process-local `Map` (`onboardingGenerator.ts:179-225`).

### Persisted-stage matrix

| Requested stage | Current durable record | Recovery / duplicate boundary | Status |
|---|---|---|---|
| answers collected | `onboarding_sessions.answers` (`shared/schema.ts:302-345`) | session reload/device access; individual answer-write idempotency not established | **ACTIVE/PARTIAL** |
| crawl completed | `answers.websiteImport.report/state` | same review URL/direction is reused | **ACTIVE** |
| site specification completed | no pre-generation cross-path SiteSpec; direction `websiteBrief` later persists in bundle | no durable pre-generation equivalent | **MISSING** |
| design directions completed | `onboarding_sessions.designDirections` / `OnboardingDirectionBundle` (`shared/schema.ts:291-295`; `shared/onboardingDirections.ts:120-128`) | atomic bundle persistence (`onboardingDecision.ts:274-315`) | **ACTIVE** |
| direction selected | bundle `selectedDirectionId`, selection revision and selected state/session transaction | stale revision/fingerprint rejected | **ACTIVE** |
| site plan completed | user-approved `answers.plan` may be carried in `OnboardingGenInput`; AI-created `WebsitePlan` is local `let plan` | plan is created at `analyzeAndPlanWebsite` and passed directly to `buildFromPlan`, with no independent write/checkpoint (`server/onboardingGenerator.ts:613-655`) | **MISSING** for AI plan checkpoint; **ACTIVE/PARTIAL** only for a previously user-approved answer plan |
| generation started | `generationState`, `genStatus`, claim/attempt in session | status route may restart; job itself is local | **ACTIVE/PARTIAL** |
| page generated | no per-page onboarding write | generated `builtState`/`finalState` remains in memory until whole `BuilderStateData` is written at `storage.updateBuilderState` (`server/onboardingGenerator.ts:643-655,778`) | **MISSING** |
| assets copied | object storage plus `mediaAsset`; imported paths in import state | no per-asset durable outcome/cursor | **PARTIAL** |
| quality validation completed | `genStatus` quality issues/revision/fingerprint/site revision | certification becomes stale on state change | **ACTIVE** |
| repair completed | resulting builder state/status and candidate `repairHistory` | bounded passes, not a generic durable repair journal | **PARTIAL** |
| draft ready | session readiness/status and certified revision/fingerprint | only matching state can be selected/approved | **ACTIVE** |
| approved | onboarding decision state in session | explicit decision transitions | **ACTIVE** |

### User action, idempotency, and duplicate-risk matrix

| User action/failure | Websites | AI calls/pages/components | Import/assets | Current protection and residual risk |
|---|---|---|---|---|
| refresh or double-click create | **PARTIAL** duplicate risk | n/a | n/a | local `aiOnboardingCreateLock` returns 429 and existing AI draft is reused (`routes.ts:414-455`); lock is process-local, not cross-instance |
| create from two instances/devices | **UNVERIFIED/PARTIAL** | n/a | n/a | no shown DB unique draft-per-owner constraint; concurrent read-before-insert can escape local lock |
| click scratch generate twice | no new site | **ACTIVE** prevents concurrent start / non-empty-state generation | n/a | route returns current generating status, rejects non-empty state; start attempts capped (`routes.ts:6245-6322`) |
| refresh/reconnect during scratch generation | no new site | **PARTIAL** duplicate/restarted calls possible | n/a | session claim/status and recovery reconstruct input; process-local job is lost across restart, no completed-step journal |
| start import twice | no new site | analysis/crawl reused while valid | **ACTIVE** avoids second active crawl | advisory DB lock, same review reuse, lease and attempt cap (`websiteImportService.ts:105-199`) |
| restart during crawl | no new site | analysis deferred until rerun crawl | no duplicate persisted asset yet | status restarts whole crawl; no page queue/URL checkpoint (`routes.ts:786-813`) |
| approve import twice after completion | no new site | generator input reused | **ACTIVE** approved state returns prior input | `approveWebsiteImport` idempotent approved return (`websiteImportService.ts:341-442`) |
| interruption/retry during asset approval before approved state persists | no new site | n/a | **PARTIAL duplicate risk** | hash dedupe is only `seenContent` within one approval call (`websiteImportService.ts:255-282`); no durable content-hash uniqueness/per-asset transaction outcome is evidenced, so a rerun can create duplicate object/media rows |
| repeat session record/agent message | no new site directly | **UNVERIFIED** duplicate messages/calls | n/a | no explicit idempotency key established for `/api/onboarding/session/record` or agent messaging |
| public form retry | n/a | n/a | n/a | **MISSING** explicit submission idempotency key (`form_submissions`, `shared/schema.ts:868-877`) |
| public booking retry/slot race | n/a | n/a | n/a | slot claim race handling/tests exist (`tests/owner-booking-slot-claim.test.ts`); all-path transaction guarantee **UNVERIFIED** |
| publish clicked twice | no new site | no builder duplication expected | n/a | publish job idempotency handling (`server/routes.ts:3351-3424`) |

## 4. Existing-site import

**ACTIVE entry and review.** `WebsiteImportStep` (`client/src/components/onboarding/WebsiteImportStep.tsx:31-162`) asks URL, ownership, `preserve|improve`, selected pages/assets, booking choice (`birdflow|external|later`) and corrections. Client phases are `setup|analysing|review|approved`, while `WebsiteImportState` server phases are `not_started|discovering|review|approved|failed` (`shared/websiteImport.ts:115-136`).

`POST /api/onboarding/import/start` validates trimmed ≤2,000-character URL, literal ownership confirmation and direction, writes `answers.path="import"`, then calls `startWebsiteImport` (`server/routes.ts:760-784`). That service acquires a per-user PostgreSQL advisory transaction lock, reuses an identical review or active valid lease, otherwise increments attempts and creates a three-minute lease; maximum is three (`server/websiteImportService.ts:105-199`). State is JSON under `onboarding_sessions.answers.websiteImport`; a local `running` set is not durable. Status recovery (`GET /api/onboarding/import/status`, `routes.ts:786-813`) reruns a whole stranded discovery job—**MISSING** page/asset cursor checkpointing.

### Crawler and import fidelity

`crawlWebsite` is bounded HTTP/HTML crawling, not browser rendering. `assertPublicUrl` and `fetchPublicUrlPinned` only allow HTTP(S), reject credentials/local/internal and DNS-resolved private/reserved addresses, and pin the selected address to the request (`server/websiteImportCrawler.ts:87-146`). Limits are 10 pages, 50 assets, 3 redirects, 1 MB/page, 5 MB aggregate, 8 seconds/request (`:8-13,264-352`). It is FIFO/BFS traversal (`queued.shift()`), but depth is **not separately bounded**; page/bytes/queue exhaustion supplies the effective bound. It best-effort requests `/sitemap.xml`, queues same-origin links, removes hashes and deduplicates exact normalized URL strings; query strings are retained because only `hash` is cleared (`:319-350`). Same-origin comparison rejects subdomains unless the canonical origin itself changes through the narrow allowed redirect rule; redirects otherwise must remain canonical same origin. **MISSING:** `robots.txt` policy and fetch retry loop. **MISSING:** JavaScript execution, so React/Next/Webflow/Wix/Squarespace dynamic output is not guaranteed to be present.

`extractHtml` strips `script`, `style`, `noscript`, and `template`, then extracts title/descriptions, headings, visible text, links, `<img>` URL/alt, theme/hex/font literals, email, phone-like text, price, hours, forms, booking/service/social/integration signals (`:179-262`). It does not extract computed styles, CSS variables, dimensions, responsive layouts, DOM interaction or scripts.

| Source property | Extracted | Understood | Recreated | Builder editable |
|---|---|---|---|---|
| Text | **ACTIVE** visible text | **ACTIVE** capped source facts/context | **PARTIAL** AI-written components, not literal source blocks | **ACTIVE** resulting component text |
| Navigation | **ACTIVE** same-origin links | **PARTIAL** selected URL/fact evidence | **PARTIAL** AI-generated navigation; no source nav tree | **ACTIVE** generated navigation only |
| Pages | **ACTIVE** crawled URLs/title | **PARTIAL** selected pages/facts | **PARTIAL** AI page plan, not source structure | **ACTIVE** generated pages only |
| Images | **ACTIVE** same-origin `<img>`/alt | **PARTIAL** selected prompt context | **PARTIAL** copied raster may remain unplaced | **ACTIVE** only if placed in a component |
| Logo | **PARTIAL** qualifying `<img>` only; no classifier | **MISSING** dedicated logo semantics | **PARTIAL** generic selected media, no guaranteed header logo | **ACTIVE** only if placed |
| Colors | **ACTIVE** theme/hex literals | **PARTIAL** evidence, not computed style | **PARTIAL** generator/token recreation | **ACTIVE** generated tokens |
| Fonts | **ACTIVE** CSS `font-family` literals | **PARTIAL** evidence | **PARTIAL** approval input uses Inter rather than proven source fidelity | **ACTIVE** generated typography |
| Layout | **MISSING** computed layout/DOM hierarchy | **MISSING** | **MISSING** source-faithful layout | **ACTIVE** only for newly generated layout |
| Spacing | **MISSING** computed spacing | **MISSING** | **MISSING** source-faithful spacing | **ACTIVE** only for generated styles |
| Buttons | **PARTIAL** CTA/link text as text/link evidence | **MISSING** button semantics/style | **MISSING** source button fidelity | **ACTIVE** only for generated buttons |
| Forms | **ACTIVE** form detection | **PARTIAL** unsupported marker | **MISSING** source config/submission migration | **MISSING** until native form is configured |
| Booking | **ACTIVE** signal/integration URL | **ACTIVE** external booking choice | external **ACTIVE** normal link; Birdflow operational config **UNVERIFIED** | link **ACTIVE**; real booking **UNVERIFIED** |
| Services | **PARTIAL** service-like headings/prices | **PARTIAL** inferred facts | **PARTIAL** website copy/context; operational records not demonstrated | **ACTIVE** generated copy only |
| Team | **PARTIAL** headings/text only | **MISSING/PARTIAL** no person identity model | **MISSING** operational team migration | **ACTIVE** only as generated/about copy |
| SEO | **ACTIVE** title/description | **PARTIAL** | **UNVERIFIED** direct SEO migration | **UNVERIFIED** |
| Responsive behavior | **MISSING** rendering/computed breakpoints | **MISSING** | **MISSING** source behavior | **ACTIVE** only for generated responsive components |

**Asset lifecycle (ACTIVE, with lossiness).** Crawl discovers same-origin `<img>` and document links (50 cap). The UI selects at most 20 (`WebsiteImportStep.tsx:102-108`); approval maps choices only to reported assets (`websiteImportService.ts:237-246`). `importSelectedAssets` rechecks origin/SSRF, uses 8-second/8-MB bounds, permits JPEG/PNG/WebP/GIF and PDF; `sharp` validates dimensions, rotates and converts raster to WebP quality 84, SHA-256 deduplicates within that import, writes object storage and creates `mediaAsset` (`:201-304`). SVG/AVIF/source-set/CSS-background extraction is **MISSING**. Individual failures are logged/skipped and approval still succeeds (`:304-306`), with **MISSING** persisted per-asset outcome. Up to 20 paths are recorded, but only six imported images become `ownImageUrls`; PDFs are not generator image inputs (`:405-423`). Thus selected assets may remain unused (**UNVERIFIED** placement).

`analyseReport` tells the model that source strings are untrusted, not instructions, and prohibits invented factual claims; analysis failure/spend limit uses deterministic analysis and a warning (**ACTIVE/FALLBACK**, `websiteImportService.ts:62-103`). Approval (`POST /api/onboarding/import/approve`, `routes.ts:815-855`) verifies user/site/session, selections and safe external booking URL. `approveWebsiteImport` is idempotent once approved, filters report/facts, imports assets, constructs migration input and persists it (`websiteImportService.ts:341-442`).

## 5. Builder architecture

**ACTIVE canonical contract.** `builder_state` (`shared/schema.ts:606-641`) is the canonical persisted editable document: unique `website_id`, JSONB `state`, monotonic `revision`. `BuilderStateData` (`:569-604`) holds pages, `activePage`, `globalStyles: DesignTokens`, stored navigation/site chrome, style preset, media/configuration, custom-component library, brand guide and business context. `BuilderPage` (`:472-484`) supplies id/name/path/hidden/role/SEO/header-footer flags and `components: BuilderComponentData[]`. A section is a registry component—not a separate database table—whose `type`, props and styles are defined in `shared/componentRegistry.ts` and allowed AI vocabulary (`shared/aiBuilderSchema.ts:16-26,171-176`).

`siteChrome` is canonical shared header/footer (`shared/schema.ts:466-470`); `composePageComponents` (`shared/siteStructure.ts`) combines it for rendering and `resolveNavItems` resolves navigation. The client builder loads `/api/websites/:id` and `/api/websites/:id/builder`, migrates state and uses React state (`client/src/pages/builder.tsx:612-691`); `ComponentRenderer` dispatches registry components (`client/src/components/builder/ComponentRenderer.tsx:4027-4238`). Autosave posts builder state and server CAS uses the revision (`builder.tsx:233-353`, `server/builderStateWriter.ts`).

**ACTIVE embedded custom architecture, not a competing document.** A `type:"custom"` registry section embeds `props.customTree: PrimitiveNode`; node types are `box|text|image|button|svg|capability` with responsive styles/motion and a 400-node/24-depth bound (`shared/generative/nodes.ts:1-105`). Reusable account masters are separate `account_components.tree` JSONB and clone into a site, so master edits do not rewrite clones (`supabase/migrations/20260812_account_components.sql`). **LEGACY/MISSING:** no active arbitrary `customCode`/JS renderer was found.

History is mixed: canvas undo/redo is in-memory, bounded 50 and lost on reload (`shared/builderHistory.ts:3-89`, `builder.tsx:207-218`). **ACTIVE durable history:** `builder_snapshots` stores full `content: jsonb`, revision, label and build ID after every completed AI build (`shared/schema.ts:699-718`); `VersionHistoryPanel` presents it (`client/src/components/builder/VersionHistoryPanel.tsx`) and the list/restore APIs are `GET /api/websites/:id/ai/snapshots` and `POST /api/websites/:id/ai/snapshots/:snapshotId/restore` (`server/assistantPlanRoutes.ts:676-735`). Restore uses optimistic locking and returns 409 on concurrent change. **PARTIAL scope:** comments/route describe the last 20 *completed-build* snapshots, primarily AI plan builds, rather than a snapshot for every canvas edit or a demonstrated snapshot for every onboarding generation. `assistant_plans`/`assistant_builds` separately retain approved-plan/pre-build data (`shared/schema.ts:650-695`, `server/proposalStore.ts:13-73`).

## 6. AI architecture

**ACTIVE.** AI role/model selection and budgets are centralized rather than hardcoded at callsites (`server/aiConfig.ts:121-264`, `server/aiCall.ts:102-171`); spend pricing/meter TTL is in `server/aiSpend.ts:30-190`. Onboarding stages call: `finalizeBrandGuide` via `meteredChat("designInterview")` (`server/designInterview.ts:122-288`); architect planning/build via `meteredChat("architectPlan")`/`("architectBuild")` (`server/websiteArchitect.ts:415-477`); builder enhancement; `runSelfCheck`; then direction build/visual review (`onboardingGenerator.ts:549-1030`). Core prompts are `buildPlanPrompt`/`buildEnhancePrompt` (`onboardingGenerator.ts:1496-1635`), architect construction and design interview prompts at cited modules.

Structured JSON response format is used, but **UNVERIFIED/PARTIAL** whether every response is provider-native Zod-validated rather than parsed/validated by callers. `aiCall` retries primary network/auth/provider failure once and does not retry spend limits (`server/aiCall.ts:20-48,119-171`). A deterministic starter site is explicitly used on provider/spend failure (`onboardingGenerator.ts:4-13,680-910`)—**FALLBACK**, not equivalent AI quality. `server/aiBuilder.ts` is **ACTIVE/PARALLEL**, not legacy: onboarding imports and calls `processAIBuildRequest` for enhancement, base finding-led repair, and candidate repair (`server/onboardingGenerator.ts:31,685,738,981`; `server/aiBuilder.ts:1197+`). `siteGeneration`/`siteThinking` role configuration remains a separately active/general generation route (`aiConfig.ts:52-57`).

Generated image markers use `ai://`; resolver traversal is capped at 5,000 nodes and creates no more than five images/request (`server/aiImages.ts:29-30,298-455`). The builder prompt says three unique images, so **ACTIVE contract drift** exists. `referenceVision` is configured but use in all paths is **UNVERIFIED**.

## 7. Website data model

**ACTIVE key relationships.** `profiles` is user/account authority and Supabase Auth owns email (`shared/schema.ts:68-108`). `websites` is tenant root (`owner_id`, status/setup/kind/language/currency, `schema.ts:169-205`). `onboarding_sessions` is unique by user, optionally points to website, and stores answers/transcript plus generation/decision/payment state in JSONB (`:302-345`). `builder_state` is the single current builder state above. `websiteInputs` (`:230-249`) is provenance, not render state; `phasedBuildState` (`:399-422`) is **LEGACY/PARALLEL** progress, not canonical site output.

Media rows are created by import service; `svg_assets` is produced through sanitized extraction (`server/svgExtraction.ts:51-96`). Relevant derived/review records include `assistant_plans`, `assistant_builds`, onboarding direction bundle/session fields and publish-job/content snapshots (`shared/schema.ts:650-690`; `server/routes.ts:3418-3426`). There is no demonstrated normalized, shared persisted `SiteSpec`, `WebsiteSpec`, page-plan, or content-plan that both onboarding paths use.

## 8. Operational data

**ACTIVE, separate from website copy.** `BuilderStateData.bookingConfig` can contain enabled/timezone/services/availability/form fields, while operational booking is normalized into `booking_services` (`shared/schema.ts:1073-1085`), availability/blocked-date tables, `booking_team_members` (`:1168-1184`), `booking_open_slots` (`:1196-1209`) and `bookings` (`:792-825`: website/service/team links). Manage booking-service CRUD is `/api/websites/:id/booking-services` and `/api/websites/:id/booking-services/:serviceId` (`server/routes.ts:3786-3865`); service availability is a separate route. A visible “Book” CTA is real only when it maps to native booking component/config **and** pre-existing applicable service, availability/team/slot data and submission handling—not merely generated text.

### Exact operational capability traces

* **Booking — ACTIVE generated-site path; separate platform path.** A native registry `booking` section or constrained `PrimitiveNode capability` (`shared/aiBuilderSchema.ts:16-26`; `shared/generative/capabilities.ts:17-106`) must survive publisher coverage into the generated booking template. Publisher writes generated Next routes for bookings, booking services, availability, slots and team members (`server/publisher/generator.ts:378-387`) using `generateBookingApiRoute`, `generateBookingServicesApiRoute`, `generateAvailabilityApiRoute`, `generateSlotsApiRoute` and `generateTeamMembersApiRoute` (`server/publisher/templates.ts:142-500,532,717,914,1170`). `generateBookingForm` calls those local routes for services/team/availability and posts booking data (`templates.ts:6018-6137,6274+`). The generated booking route directly reads/writes `booking_services`, `booking_open_slots` and `bookings`; on submission it creates a booking and may claim/update an open slot. Service, team and slot rows are prerequisites, not records created by the booking POST (`shared/schema.ts:792-825,1073-1209`). The platform `POST /api/public/websites/:id/bookings` is a separate submission path (`server/routes.ts:4317-`); the platform URL used from the generated booking route in `templates.ts:142-500` is only confirmation-email dispatch. Staff manage booking services through the exact Manage CRUD routes above and availability separately. **UNVERIFIED:** onboarding creates all prerequisite rows/configuration as one working chain.
* **Forms — ACTIVE generated-site path; separate platform path.** A registry `contact-form`/capability becomes published UI that POSTs local `/api/form-submissions` (`server/publisher/templates.ts:4885-4911,5920-6015`). Publisher writes `app/api/form-submissions/route.ts` through `generateFormSubmissionApiRoute` (`server/publisher/generator.ts:383-385`; `server/publisher/templates.ts:622-714`); this generated route uses its Supabase service-role client and inserts directly into `form_submissions`, rather than forwarding to the platform public form endpoint. `POST /api/public/websites/:id/forms` is a separate platform path that also creates a submission (`server/routes.ts:4287-4314`; `shared/schema.ts:868-877`). Manage reads `GET /api/websites/:id/submissions` (`routes.ts:1965-1975`) and `SubmissionsSection` fetches/renders that endpoint (`client/src/pages/manage/SubmissionsSection.tsx:15-100`). **MISSING:** a normalized form-definition table and submission idempotency key; generated form payload variants (`formData` versus `formType`/`data`) should not be assumed equivalent without route-level validation.
* **People — ACTIVE separate models.** About/practitioner content is ordinary component copy/facts in `BuilderStateData`; bookable personnel are `booking_team_members` with service IDs and availability (`shared/schema.ts:1168-1184`) consumed by the booking template. There is **MISSING** automatic identity mapping between an imported/generated “about” person and a booking team-member row. Onboarding can therefore create no bookable provider—or duplicate representations—unless an explicit mapping is made.

**UNVERIFIED critical handoff.** No code evidence proves generator `bookingConfig.services` is promoted to `booking_services`; retained QA records a generated fixture lacking owned service rows and booking component (`qa-results/persistent-onboarding-fixtures.json:~1032-1072`). Imported “60 minutes/950 DKK” becomes source fact/copy context, not demonstrated operational service creation. There are no declared Drizzle FKs in those listed booking definitions, so database referential enforcement is **UNVERIFIED/MISSING**.

Forms are UI/config in builder JSON; submissions persist as `form_submissions(websiteId, formName, data, read, metadata)` (`shared/schema.ts:868-877`) with no form-definition table and no explicit public submission idempotency key. Contact/customer is likewise fragmented: `customers` has unique `(websiteId, lower(email))` and legacy totals (`:887-943`), while forms/booking retain independent contact fields. Team/about/provider/booking-team representations are separate; import does not establish identity matching, so avoiding duplicate people is **MISSING**.

Payments exist separately through payment settings, orders/Stripe routes (`shared/schema.ts:1347+`; `server/routes.ts:2686-2973,5284-5715`) and invoices (`schema.ts:840-866`). Stripe webhook event IDs are deduplicated (`:391-397`); onboarding payment state/IDs live in session JSON. Import only detects Stripe/commerce—it does not migrate it.

## 9. Design/content architecture

**ACTIVE design tokens.** `DesignTokens` (`shared/schema.ts:535-567`) lives at `BuilderStateData.globalStyles`; `shared/designTokens.ts` resolves named color/type/space roles. Components can reference tokens (`shared/aiBuilderSchema.ts:70-168`). Absent newer fields and navigation use explicit compatibility derivations (`schema.ts:541-544,580-584`)—**FALLBACK**. Brand information → `finalizeBrandGuide` → tokens/AI plan → component props/styles, but composition and mobile hierarchy are substantially component/AI decisions rather than a proven complete persistent design-system specification.

**ACTIVE persisted intermediate direction schemas, with representation boundary.** There is no shared *pre-generation* SiteSpec for import and interview inputs, but generation does create and persist substantial intermediate data: `WebsiteBrief` (facts, content, assets, missing information), `CreativeDirectionManifest` (layout, type, palette, spacing, cards, buttons and asset placements), `OnboardingDirectionCandidate.state: BuilderStateData` (a complete candidate), and `OnboardingDirectionBundle` (brief, all candidates, selected ID and selection revision) (`shared/onboardingDirections.ts:4-128`; session `designDirections` at `shared/schema.ts:291-295`). After base build, three candidates use `buildDirectionCandidate` (`server/onboardingDirections.ts:533-569`), screenshots/Kimi review and at most one targeted repair per candidate (`onboardingGenerator.ts:815-1030,1058+`). Bundle persistence is atomic (`onboardingDecision.ts:274-315`). Direction effects that survive are the selected `BuilderStateData`; **UNVERIFIED** that every preview-direction metadata choice independently controls all fonts, imagery, layouts, copy and page architecture.

**ACTIVE direction propagation trace.** `applyDirectionManifestToState(input, manifest)` clones the candidate and writes palette, body/heading fonts and font pair, type scale, spacing scale, radius, card/button styles and archetype-derived container width into `globalStyles` (`server/onboardingDirections.ts:366-387`). It styles component background/text/accent/padding/font, changes hero alignment/layout and button style, modifies feature/service columns/alignment/variant and can change `features` to `services` or `text-image` to `split-section` (`:291-363`). It reorders home-page body components for structured/organic directions, binds manifest asset placements to target component `imageUrl`/background crop, and styles page/site chrome (`:388-419`). **Explicit limit:** this function does not itself rewrite copy or add a new page architecture; it transforms the existing candidate state. `OnboardingDirectionCandidate.state` retains each full transformed state and selection persists/installs the selected `BuilderStateData` through the direction decision transaction (`shared/onboardingDirections.ts:95-128`; `server/onboardingDecision.ts:182-315`).

Copy is principally embedded in component props in builder state, editable with the component. Business context/facts are appended for import (maximum 60 facts × 500 characters; correction protected, `onboardingGenerator.ts:532-547`), not a direct factual source-of-truth synchronization model. Prompts prohibit inventing imported factual data, but equivalent comprehensive factual-field validation for interview-entered credentials/prices is **MISSING/UNVERIFIED**.

## 10. Preview + builder handoff

**ACTIVE high parity for onboarding preview.** `/onboarding/preview/:websiteId` (`client/src/App.tsx:98-99`) gets `/api/onboarding/preview/:websiteId` and `ReadOnlySitePreview` uses the same `ComponentRenderer`, shared chrome composition and `isPreview`, while suppressing mutating submits/clicks (`client/src/components/onboarding/ReadOnlySitePreview.tsx:73-132,177-293`). Diagnostics detect missing/empty output but do not repair it (`:41-49,192-229`). This preview renders the same canonical `BuilderStateData` later edited in builder.

Direction selection atomically changes builder/session state only after revision/fingerprint readiness checks; stale/missing/generating/paid outcomes are explicit (`server/onboardingDecision.ts:162-226,339-366`). Builder entry is the normal builder route/data loads above; no HTML-to-builder conversion happens at this handoff.

**ACTIVE conversion risk after preview.** Publish has another renderer: canonical state → migration → immutable job/content snapshot → generated TSX/Next project. The client and published renderer share vocabulary, not executable renderer (`shared/rendering/types.ts:1-25`). Boundaries include direction bundle→state, tokens→resolved values, object-store URL→downloaded public asset, shared chrome→flattened page components, components→generated TSX. This can lose unsupported component behavior despite client preview parity.

## 11. QA + validation

**ACTIVE deterministic gate.** `evaluateOnboardingQuality` (`server/onboardingQuality.ts:8-63,210+`) reports `thin_page`, `placeholder_link`, `generic_copy`, `repeated_image`, `wrong_language`, `missing_import_fact`, `missing_customer_asset`, `unknown_component`, empty-component/custom-component, publish-parity, direction-quality, enhancement-failed. A thin page has fewer than two substantive body components or <100 visible-copy characters. “Ready” means no base issue list; `readinessMatchesOnboardingDraft` additionally requires `ready`, builder revision, fingerprint and session site revision match.

`runSelfCheck` can repair internal links, contrast below 4.5:1, responsive hazards and token literals before save; it reports remaining binding/menu/booking/motion/performance/SEO/a11y findings (`server/selfCheck.ts:1-45,130-235`). Onboarding performs exactly one finding-led AI repair, then reruns self-check; saved failures remain `repair_required` (`onboardingGenerator.ts:718-774`).

Directions have a stronger gate: zero quality issues, score ≥65, uniqueness ≥50, visual review ran, and no critical/high visual issue (`onboardingDirections.ts:478-530`). Thus the actual execution is broader than the UI phase names: base enrichment/check, then three full candidate `BuilderStateData` builds, visual reviews and bounded candidate repairs. Before the decision path can finalize selected output, code requires completed generation, base readiness/parity certification at matching revision/fingerprint, a direction that passes its gate, and a selected candidate (`onboardingGenerator.ts:815-1030`; `onboardingDecision.ts:182-270`; `onboardingQuality.ts:35-63`). Visual review generates publisher-equivalent HTML, screenshots desktop/tablet/mobile, asks a strict JSON visual-review response, and degrades to `ran:false/skippedReason` instead of throwing (`server/visualReview.ts:43-123,250-340,357-667`). It is advisory outside direction gating; interactive booking is stubbed/skipped in static publish parity (`server/publishParity.ts:237-340`). **MISSING:** demonstrated hard checks for real booking/service rows, form delivery, public interaction, source image placement, end-to-end mobile behavior, payment, or all broken external links.

Retained QA is **ACTIVE evidence**: `scripts/run-persistent-onboarding-qa.ts`, `server/qaFixtureSupport.ts:129-328`, `tests/persistent-onboarding-qa-contract.test.ts`, crawler/selection/decision/access tests. Fixtures retain sanitized inputs, IDs, routes, ownership and preview/decision outcomes. They are **INSUFFICIENT** as redesign regression proof for operational services/team/availability, form submission/customer upsert, payment/webhook, RLS, SSRF permutations, prompt injection/SVG, restart/resume or delivery; fixture support intentionally removes auth/provider data.

## 12. Publishing

**ACTIVE.** `POST /api/websites/:id/publish` authenticates/authorizes, migrates current state, creates an atomic immutable job/content snapshot with idempotency handling, returns 202 and starts `runPublishJob` (`server/routes.ts:3296-3504`, especially `:3338-3460`). `server/publisher/generator.ts:239-325` migrates state, fetches object-storage images, resolves tokens, sanitizes custom SVG/content and rejects unrenderable components. Coverage guards require publisher support for every renderable registry type (`server/publisher/coverage.ts:30-110`).

It emits pages at `app/page.tsx` and `app${page.path}/page.tsx`, flattens `siteChrome`, and generates its own component renderer/templates (`publisher/generator.ts:341-423`; `templates.ts`). Worker deployment/status updates occur in `server/publisher/worker.ts:194-206,337-386`. Onboarding uses this normal pipeline only once its state is normal builder state. Publishing requires a current renderable state; readiness/fingerprint protects decision flow but is not proof of every operational integration.

## 13. Security

**ACTIVE importer defenses.** The crawler blocks SSRF through protocol/credential checks, DNS rejection of local/private/link-local/multicast/documentation/NAT64/reserved ranges, DNS pinning and same-origin bounded redirects (`server/websiteImportCrawler.ts:24-145,300-317`). HTML is non-executing and strips executable/style containers before text extraction (`:179-190`); strict import schemas bound report/selections (`shared/websiteImport.ts:24-113`). Analysis prompt instructs treating crawled strings as untrusted facts (`websiteImportService.ts:62-103`).

**MISSING/PARTIAL.** No robots handling; no browser sandbox because there is no JS rendering; no demonstrated prompt-injection detector/isolation beyond instructions/schema; source text still reaches model context. Imported asset selection/download has origin and SSRF checks (`websiteImportService.ts:201-246`) but arbitrary source image content safety beyond type/dimension conversion is limited. SVG is strongly sanitized—removes scripts, external fetch/links, event attributes and unsafe containers; max 300 KB, used save/canvas/publish (`shared/svgSanitizer.ts:1-180`, `server/svgExtraction.ts:51-96`). Custom components prohibit arbitrary endpoint/API/script fields and capability config is allowlisted (`shared/generative/nodes.ts:93-105`, `capabilities.ts:1-106`). Inline SVG is **LEGACY** and publish-sanitized (`publisher/generator.ts:274-276`). Equivalent guarantees for all generated HTML/raster/PDF use are **UNVERIFIED**.

## 14. Technical debt

* **ACTIVE/PARALLEL:** `buildWorker`/`buildOrchestrator` has per-step durable plan/build recovery while `onboardingGenerator` uses process-local jobs plus JSON status (`server/buildWorker.ts`; `server/onboardingGenerator.ts:179-306`).
* **ACTIVE/PARALLEL:** `aiBuilder` is used by onboarding enhancement and repair, while architect planning and `siteGeneration/siteThinking` roles coexist (`server/onboardingGenerator.ts:31,685,738,981`; `server/aiBuilder.ts:1197+`; `server/aiConfig.ts:52-57`).
* **FALLBACK:** token/navigation compatibility derivations and deterministic starter/analysis avoid hard failure but can conceal degraded output (`shared/schema.ts:541-544,580-584`; `onboardingGenerator.ts:680-910`).
* **MISSING contract execution:** import schema declares `crawl|manual|skip`, but active routes implement URL crawl only; report schema states `queued|crawling|not_started` are not crawler outputs (`shared/websiteImport.ts:3-22`; crawler `:274-352`).
* **ACTIVE dual rendering:** client preview/builder and generated publisher renderer are separate; static parity cannot prove interactive capabilities.
* **ACTIVE dual feature representation:** registry booking/contact sections and custom `PrimitiveNode capability` nodes coexist (`shared/aiBuilderSchema.ts:16-26`; `shared/generative/capabilities.ts:17-28`).

## 15. Reusable systems

1. **ACTIVE:** `BuilderStateData`, component registry, `siteChrome`, token resolver and revision CAS are the native editable/publishable contract (`shared/schema.ts`, `componentRegistry.ts`, `builderStateWriter.ts`).
2. **ACTIVE:** shared `startOnboardingGeneration` already gives import and scratch a common downstream builder-state pipeline.
3. **ACTIVE:** bounded SSRF-safe crawler, import selection and object-storage/media registration provide a defensible evidence/asset intake base.
4. **ACTIVE:** quality fingerprint/revision gate, self-check, candidate gate, publisher coverage and parity tests are reusable safeguards.
5. **ACTIVE:** booking/service/team/form/public-route systems exist as operational systems, even though generator handoff to them is incomplete.
6. **ACTIVE:** retained sanitized QA fixture tooling supplies durable regression metadata without secrets.

## 16. Missing capabilities

**MISSING:** a single persisted shared structured site specification with factual fields/provenance and explicit operational-data mappings; DOM/CSS/computed responsive import; browser-rendered-site support; robots policy; source nav/SEO/form/booking/payment migration; guaranteed selected-asset placement and per-asset outcome; durable granular crawl/generation checkpoints; proof/promotion of generated services into booking records; identity mapping for team/provider/about people; form definitions/idempotency; comprehensive factual-claim confirmation; hard end-to-end operational quality gates; and a complete regression fixture suite for public/security/recovery paths.

## 17. Important architectural decisions

| Decision | Current situation | Options | Recommendation | Reason |
|---|---|---|---|---|
| Native output source | `BuilderStateData` is editable/publish source | HTML/TSX; custom trees only; canonical state | Generate canonical `BuilderStateData` | It is the builder, preview and publish input (`shared/schema.ts:569-641`) |
| Shared intermediate model | `OnboardingGenInput` is shared; no durable SiteSpec | retain inputs; one persisted SiteSpec; separate paths | Introduce one persisted spec before deeper redesign | Current import loses source semantics into capped facts |
| Import promise | facts/assets → regenerated site | visual clone; evidence-informed native recreation | Promise evidence-informed native recreation | Crawler has no DOM/CSS/JS fidelity |
| Components | registry plus safe custom tree | registry-only; curated compositions; arbitrary React | Prefer registry + constrained custom tree | Native editability and no arbitrary JS (`nodes.ts`, registry) |
| Operational handoff | visual booking/services differ from normalized data | copy-only; create operational records; sync layer | Explicitly map and validate operational records | QA found absent services/booking component |
| Preview criterion | client preview shares renderer; publisher differs | preview-only; add publish-equivalent validation | Keep shared preview and require publisher parity | Publishing performs real conversion |
| Reliability | JSON status/recovery, local job workers | retain; durable queue/checkpoints | Choose durable checkpointed execution | Current restart reruns/loses in-flight work |
| Import assets | copied selected raster but skipped failures possible | hotlink; copy; copy + manifest | Copy with durable per-asset manifest | Current storage is safer but outcome is opaque |
| Quality readiness | deterministic/fingerprint and candidate gates | advisory; hard operational gates | Extend readiness only after operational checks exist | Current ready does not prove booking/forms/services |
| Fixtures | sanitized contract evidence | retain minimal; add end-to-end contracts | Extend, never overwrite retained fixtures | Existing evidence is useful but insufficient |

## 18. Relevant files/modules

* `shared/schema.ts` — website/session/state/tokens/operational tables and typed contract; note builder-state insert schema accepts JSON through `z.any()`.
* `shared/onboardingDirections.ts` — `WebsiteBrief`, `CreativeDirectionManifest`, complete state candidates and `OnboardingDirectionBundle`.
* `server/routes.ts` — onboarding creation, generation, import, booking/services, publishing routes.
* `server/onboardingGenerator.ts` — shared phase orchestration, statuses, fallback and direction workflow.
* `server/websiteImportCrawler.ts`, `server/websiteImportService.ts`, `shared/websiteImport.ts` — crawl, safety, report, import state/approval/assets.
* `server/websiteArchitect.ts`, `server/designInterview.ts`, `server/aiCall.ts`, `server/aiConfig.ts`, `server/aiImages.ts` — architect/design/model/spend/image calls.
* `server/onboardingQuality.ts`, `server/selfCheck.ts`, `server/visualReview.ts`, `server/onboardingDirections.ts`, `server/onboardingDecision.ts` — readiness, repair, review, candidate/approval state.
* `client/src/pages/builder.tsx`, `client/src/components/builder/ComponentRenderer.tsx`, `client/src/components/onboarding/ReadOnlySitePreview.tsx` — edit/preview renderer paths.
* `server/publisher/generator.ts`, `server/publisher/coverage.ts`, `server/publishParity.ts`, `server/publisher/worker.ts` — conversion/deployment guards.
* `scripts/run-persistent-onboarding-qa.ts`, `server/qaFixtureSupport.ts`, `qa-results/persistent-onboarding-fixtures.json`, `tests/persistent-onboarding-qa-contract.test.ts` — retained QA evidence.

## 19. Questions you genuinely cannot answer from the codebase

1. Which product promise and consent/legal policy should govern copying third-party-looking source content after a user confirms ownership?
2. Which source fidelity level is commercially required—brand-informed regeneration or a supported subset of visual/structural reproduction?
3. Which booking, payment, external-calendar, CRM and form providers are intended supported migration targets, and which require customer reconnection?
4. Which business facts require explicit user confirmation before publishing, and who is accountable for their accuracy?
5. What latency, spend, crawl-size and retry experience is acceptable for each onboarding tier?
6. What is the desired conflict/synchronization policy when website copy, service records, team records and booking configuration disagree?
7. Which capabilities should be enabled automatically versus require legal/compliance or staff review?

## Critical findings for the upcoming redesign

1. **ACTIVE — highest priority:** Make `builder_state.state: BuilderStateData` the only final site source; generated TSX/HTML is derived output.
2. **MISSING/PARTIAL:** There is no durable shared *pre-generation* SiteSpec. `WebsiteBrief`, `CreativeDirectionManifest`, full-state candidates and `OnboardingDirectionBundle` are persisted later direction intermediates, while import facts and interview answers initially converge only as `OnboardingGenInput`.
3. **ACTIVE/MISSING:** Import is not website recreation. It is limited HTTP extraction plus AI regeneration; do not promise layout/CSS/behavior fidelity.
4. **MISSING:** Crawler does not execute JS, capture computed style or responsive layout, import CSS backgrounds/source sets/AVIF/SVG, or obey robots.
5. **ACTIVE/PARTIAL:** Imported raster is copied safely and deduped only within an approval attempt, but selected asset failure, interrupted-approval duplication and final placement are not durably guaranteed or visible.
6. **UNVERIFIED critical:** Generated booking configuration/services are not proven to create real `booking_services`, availability, team mappings and native booking components; retained QA found absence.
7. **MISSING:** Forms, contacts, team/about/provider identities and business data have multiple representations without demonstrated synchronization or idempotency.
8. **ACTIVE:** Preview uses the real client builder renderer, a strong handoff property; publishing uses a different generated renderer, so parity must remain a release concern.
9. **ACTIVE/FALLBACK:** Ready is revision/fingerprint-bound and deterministic checks are useful, but deterministic starter/analysis fallbacks can yield a saved draft without equivalent AI quality.
10. **MISSING:** In-flight generator jobs are process-local and import recovery restarts crawling; durable status is not durable step execution. Website-create locking is also process-local across instances.
11. **ACTIVE:** One AI repair pass and candidate visual gates exist; they do not prove interactive booking/forms/payments or complete responsive/pixel correctness.
12. **ACTIVE:** SSRF controls, non-executing extraction, bounded requests and SVG sanitization are solid foundations; prompt injection treatment remains partial.
13. **ACTIVE/PARALLEL:** `buildWorker`/`buildOrchestrator`, `aiBuilder`, architect roles and onboarding generator overlap in orchestration responsibilities and need an ownership decision before consolidation.
14. **ACTIVE/MISSING:** Retained QA fixtures are safe, durable negative evidence, but cannot certify operational, security, recovery or public-submission regressions.
15. **MISSING:** Completion semantics must be separated into draft-renderable, fact-confirmed, operationally configured, publisher-renderable and customer-approved rather than relying on one `ready` label.