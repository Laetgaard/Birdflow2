import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Milestone 7 (consolidation): the builder must expose ONE AI assistant.
 * The phased architect is a guided flow inside it, not a parallel tab.
 */

describe("one AI assistant (source tripwires)", () => {
  const builderSource = readFileSync(
    join(__dirname, "..", "client", "src", "pages", "builder.tsx"),
    "utf8"
  );
  const assistantSource = readFileSync(
    join(__dirname, "..", "client", "src", "components", "AIAssistant.tsx"),
    "utf8"
  );

  it("builder.tsx mounts the unified assistant, not two panels", () => {
    expect(builderSource).toContain("<AIAssistant");
    // The old coequal sub-tabs must stay gone
    expect(builderSource).not.toContain('TabsTrigger value="phased"');
    expect(builderSource).not.toContain('TabsTrigger value="chat"');
    expect(builderSource).not.toContain("PhasedArchitectPanel");
  });

  it("the assistant hosts both flows and a guided entry point", () => {
    expect(assistantSource).toContain("AIBuilderPanel");
    expect(assistantSource).toContain("PhasedArchitectPanel");
    expect(assistantSource).toContain("assistant-open-guided");
    expect(assistantSource).toContain("assistant-back-to-chat");
    // Empty sites get the guided-build suggestion card
    expect(assistantSource).toContain("assistant-guided-suggestion");
    expect(assistantSource).toContain("siteIsEmpty");
  });
});
