import OpenAI from "openai";

/* ─────────────────────────────────────────────────────────────
   One lazily-constructed OpenAI client, shared by every AI module.

   These modules used to each build their own client at module
   scope. The OpenAI constructor throws when no key is present, so
   *importing* any of them without OPENAI_API_KEY set killed the
   import — which meant `npm test` on a fresh clone failed to load
   three test files that never call OpenAI at all.

   Constructing on first use instead keeps import side-effect free.
   The client is memoised, so callers still share one instance.
   ───────────────────────────────────────────────────────────── */

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return client;
}

/** Test seam: drops the memoised client so the next call rebuilds it. */
export function resetOpenAIClientForTests(): void {
  client = null;
}
