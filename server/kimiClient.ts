import OpenAI from "openai";

/* ─────────────────────────────────────────────────────────────
   Kimi K3 client (Moonshot AI) — provider-independent wrapper
   for the OpenAI-compatible Moonshot API.

   Mirrors the lazy-init pattern of openaiClient.ts so the two
   provider modules stay symmetric. Constructing on first use
   keeps imports side-effect free: tests that never call Kimi
   import this file without a key present and are not harmed.

   Base URL defaults to the official Moonshot endpoint;
   KIMI_BASE_URL may override it for testing or staging without
   being a required secret.

   Never expose KIMI_API_KEY to the browser — this module must
   only be imported from server-side code.
   ───────────────────────────────────────────────────────────── */

const DEFAULT_KIMI_BASE_URL = "https://api.moonshot.ai/v1";

let client: OpenAI | null = null;

export function getKimi(): OpenAI {
  if (!client) {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Missing Kimi credentials: KIMI_API_KEY is not set. " +
          "Add KIMI_API_KEY to your environment secrets."
      );
    }
    client = new OpenAI({
      apiKey,
      baseURL: process.env.KIMI_BASE_URL ?? DEFAULT_KIMI_BASE_URL,
    });
  }
  return client;
}

/** Test seam: drops the memoised client so the next call rebuilds it. */
export function resetKimiClientForTests(): void {
  client = null;
}
