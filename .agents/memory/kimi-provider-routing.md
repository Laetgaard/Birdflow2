---
name: Kimi K3 provider routing
description: Durable architectural decisions for the two-provider AI layer (Kimi K3 for builder, OpenAI for conversational/image).
---

# Kimi K3 provider routing

## Core rule
Builder-agent roles (planning, siteGeneration, buildStep, selfReview, etc.) → Kimi K3. Conversational/image roles → OpenAI. The split is declared per-role via `provider` on `AiRoleConfig`; callers never select the client.

**Why:** Kimi K3 is cheaper for long builder reasoning contexts; OpenAI remains for image generation (only supported there) and short conversational turns where latency matters more.

## Fallback budget guarantee
On any non-`SpendLimitError` primary failure, release the primary reservation first, then *reserve the fallback worst case* before starting the fallback call. If that reserve fails, the run is at ceiling — throw the original error, not a misleading SpendLimitError.

**Why:** Without this check, a gpt-5.1 fallback (which may be more expensive) can push the run past its ceiling just as the primary call would have.

## reasoning_effort
Conditionally included only for `provider === "openai"`. Kimi K3's OAI-compatible endpoint does not accept it.

## required_secret
`KIMI_API_KEY` — must be provisioned as a workspace secret. `getKimi()` throws a descriptive error on init if missing (it does NOT silently fall back to OpenAI at init time — that only happens on call errors).

## Test seam
Mock both `../server/kimiClient` and `../server/openaiClient` in any test touching builder roles. Use unique args per tool call across steps (e.g. `{ tag: "step-N" }`) to avoid triggering the repeated-call detector.
