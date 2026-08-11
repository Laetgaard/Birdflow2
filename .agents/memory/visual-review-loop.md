---
name: Visual review loop
description: Screenshot → Kimi K3 vision → structured VisualIssue[] pipeline; key design decisions for screenshots, iteration limits, and tool integration.
---

# Visual review loop

## Architecture

- **`server/visualReview.ts`** — core module: HTML generation, Puppeteer capture, Kimi analysis, issue resolution comparison.
- **Two new agent tools** in `server/aiAgentTools.ts`: `capture_page_screenshot` (read) and `run_visual_review` (read).
- **`visualReview` role** in `server/aiConfig.ts`: Kimi K3, maxCompletionTokens: 2048, maxRunCostUsd: 0.5 per call.

## Critical design rule: screenshots never travel through tool text

The raw base64 JPEG is stored in `AgentContext.screenshotCache: Map<string, VisualScreenshot>`. Tools return compact screenshot IDs (UUIDs); `run_visual_review` retrieves from the cache internally and sends to Kimi via `image_url` content parts. The agent only sees metadata and structured issues — never a base64 blob.

**Why:** A 1440×1000 JPEG at quality-80 is ~300–500KB base64. Returning it in tool text would consume the model's context window entirely.

## Iteration limit enforcement

`AgentContext.visualReviewCount?: number` tracks how many reviews have run. When it reaches `MAX_VISUAL_ITERATIONS` (= 2), `run_visual_review` refuses with a Danish error message. This is enforced at the tool layer, not the prompt layer.

**Why:** The system prompt alone is not a reliable enforcement mechanism for cost-sensitive loops.

## Chromium detection

`findChromiumPath()` checks `PUPPETEER_EXECUTABLE_PATH` env var first, then `KNOWN_CHROMIUM_PATHS` (a list of known Nix store paths including the version string). The current confirmed path in the Replit Nix environment: `/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium`. The existing `screenshotService.ts` hard-codes version 130 (wrong); `visualReview.ts` uses 125 (correct as of task).

**How to apply:** If screenshots silently produce 0 refs with a "Puppeteer launch failed" warning, the Chromium path changed. Run `ls /nix/store/ | grep chromium` and update `KNOWN_CHROMIUM_PATHS`.

## HTML generation

Uses the same publisher renderer as `publishParity.ts` — `generateComponentRenderer()` compiled with esbuild, executed with identical module stubs. Motion CSS is suppressed (`animation-play-state: paused !important; [data-motion] { opacity:1 !important }`) so screenshots capture the finished visual state, not entrance-animation hidden state.

`AgentContext.state` (already `BuilderStateData`) is passed directly to the visual review functions — do NOT call `storage.getBuilderState()` from within the tool closures.

## Kimi vision message format

Multi-image user messages use `{ type: "image_url", image_url: { url: dataUrl, detail: "high" | "low" } }` content parts. The TypeScript SDK type for messages is narrower than what Kimi actually accepts, so the messages array is cast: `messages as Parameters<typeof meteredChat>[1]["messages"]`. This is the same pattern used in `analyze_reference_image`.

## Issue resolution comparison

`resolveIssues(before, after)` matches by `(category, viewport)` proximity — not by ID, since the model generates new IDs on every call. Status values: `resolved`, `improved`, `unchanged`, `new` (regression).

## Tests

`tests/visual-review.test.ts` — 51 deterministic tests covering: schema validation, viewport constants, HTML generation, component context, issue resolution, chromium detection, tool registration, loop-limit enforcement. No Puppeteer or live Kimi calls.
