import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Milestone 12 (prerequisite): importing an AI module must not construct
 * the OpenAI client.
 *
 * Seven server modules used to do `const openai = new OpenAI({...})` at
 * module scope. The constructor throws without an API key, so on a fresh
 * clone three test files - aiImagePlanning, aiTreeSafety and
 * onboardingGenerator, none of which call OpenAI - died on import and
 * `npm test` reported 170/13 instead of 198/13.
 *
 * The client now comes from a memoised getOpenAI() in server/openaiClient.ts.
 */

// phasedArchitect and aiVisionCloner were in this list until M14
// deleted both modules along with their routes.
const AI_MODULES = [
  "aiBuilder",
  "aiAgent",
  "designInterview",
  "aiImages",
  "websiteArchitect",
] as const;

// Provider clients: the only modules allowed to call `new OpenAI(...)`.
// Kimi K3 uses the OpenAI-compatible SDK pointed at api.moonshot.ai, so
// kimiClient.ts is a peer of openaiClient.ts — both are provider modules,
// not AI consumer modules.
const PROVIDER_MODULES = ["openaiClient", "kimiClient"] as const;

const serverDir = join(__dirname, "..", "server");
const read = (name: string) => readFileSync(join(serverDir, `${name}.ts`), "utf8");

describe("OpenAI client is constructed lazily", () => {
  it("no AI consumer module constructs a client at module scope", () => {
    for (const name of AI_MODULES) {
      expect(read(name), `${name}.ts must not call new OpenAI(...)`).not.toMatch(
        /new OpenAI\s*\(/
      );
    }
  });

  it("only provider modules (openaiClient, kimiClient) construct OpenAI clients", () => {
    // Both provider modules must construct one (lazy, not at module scope)
    for (const name of PROVIDER_MODULES) {
      expect(read(name), `${name}.ts should construct an OpenAI client`).toMatch(
        /new OpenAI\s*\(/
      );
    }
  });

  it("every AI module routes through a shared provider accessor", () => {
    for (const name of AI_MODULES) {
      // Directly, or through the metered wrapper that owns the accessor —
      // what must never come back is a module holding its own client.
      const src = read(name);
      const routed =
        src.includes('from "./openaiClient"') ||
        src.includes('from "./kimiClient"') ||
        src.includes('from "./aiCall"');
      expect(routed, `${name}.ts should reach AI providers through openaiClient, kimiClient or aiCall`).toBe(true);
    }
  });
});

describe("importing AI modules without credentials", () => {
  const saved = {
    key: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };

  beforeAll(() => {
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    if (saved.key !== undefined) process.env.AI_INTEGRATIONS_OPENAI_API_KEY = saved.key;
    if (saved.openai !== undefined) process.env.OPENAI_API_KEY = saved.openai;
  });

  // The regression this guards: these imports used to throw
  // "Missing credentials" before a single test body ran.
  it("does not throw", async () => {
    await expect(import("../server/designInterview")).resolves.toBeDefined();
    await expect(import("../server/websiteArchitect")).resolves.toBeDefined();
  });

  it("only fails when the client is actually used", async () => {
    const { getOpenAI, resetOpenAIClientForTests } = await import(
      "../server/openaiClient"
    );
    resetOpenAIClientForTests();
    expect(() => getOpenAI()).toThrow(/credentials/i);
  });

  it("memoises the client once credentials exist", async () => {
    const { getOpenAI, resetOpenAIClientForTests } = await import(
      "../server/openaiClient"
    );
    resetOpenAIClientForTests();
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "sk-test-dummy";
    try {
      expect(getOpenAI()).toBe(getOpenAI());
    } finally {
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      resetOpenAIClientForTests();
    }
  });
});
