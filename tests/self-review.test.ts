/**
 * Phase 9 — the three-level self-review.
 *
 * Everything here is pure: crafted states in, findings/groups/verdicts out.
 * No database, no network, no model. The AI level (B/C) is exercised only
 * through its deterministic parts — the grouping and the page-role scrub —
 * because the review must behave identically whether or not a model is
 * reachable.
 */

import { describe, expect, it } from "vitest";
import type { BuilderStateData } from "@shared/schema";
import {
  dropProtectedPageItems,
  emptySelfReview,
  groupReview,
  protectedPages,
  type SelfReview,
} from "@shared/selfReview";
import { resolveDesignTokens, tokenizeValue, isTokenRef } from "@shared/designTokens";
import { runSelfCheck } from "../server/selfCheck";
import {
  checkPublishParity,
  codeArtifactIn,
  sampleComponentCopy,
  visiblePublishedText,
} from "../server/publishParity";
import { buildReport } from "../server/aiReport";

let nextId = 0;
// `styles` is a required field on BuilderComponent (the registry always
// materializes it), so the fixture always carries one — the published
// renderer is entitled to rely on it.
const comp = (type: string, props: Record<string, unknown> = {}, styles: Record<string, unknown> = {}) => ({
  id: `c-${nextId++}`,
  type,
  props,
  styles,
});

const page = (over: Record<string, unknown> = {}) => ({
  id: `p-${nextId++}`,
  name: "Forside",
  path: "/",
  components: [],
  ...over,
});

const state = (over: Record<string, unknown> = {}): BuilderStateData =>
  ({ pages: [page()], ...over }) as unknown as BuilderStateData;

const messages = (result: ReturnType<typeof runSelfCheck>) => result.findings.map((f) => f.message);

/* ───────────────────── Level A: new deterministic checks ───────────────────── */

describe("selfCheck notes stay repairs-only", () => {
  it("report-only findings never leak into notes", () => {
    // A page with plenty to REPORT but nothing to repair.
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("cta", { buttonText: "Book nu", buttonLink: "#" })] })] })
    );
    expect(result.notes).toEqual([]);
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((f) => !f.repaired)).toBe(true);
  });

  it("repairs appear in BOTH notes and findings, marked repaired", () => {
    const result = runSelfCheck(
      state({
        pages: [page({ components: [comp("cta", { buttonText: "Se", buttonLink: "/findes-ikke" })] })],
      })
    );
    expect(result.notes.some((n) => n.includes("rettet til forsiden"))).toBe(true);
    const finding = result.findings.find((f) => f.category === "links");
    expect(finding?.repaired).toBe(true);
    expect(result.notes).toContain(finding!.message);
  });
});

describe("design-token consistency", () => {
  it("re-points literals that exactly match a token, value-preserved", () => {
    const resolved = resolveDesignTokens(undefined);
    const brand = Object.values(resolved).find(
      (v) => typeof v === "string" && v.startsWith("#") && isTokenRef(tokenizeValue("backgroundColor", v, resolved))
    ) as string | undefined;
    expect(brand).toBeTruthy();

    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("cta", {}, { backgroundColor: brand! })] })] })
    );
    const written = (result.state.pages[0].components[0].styles as Record<string, string>).backgroundColor;
    expect(isTokenRef(written)).toBe(true);
    const finding = result.findings.find((f) => f.category === "tokens" && f.repaired);
    expect(finding).toBeTruthy();
    expect(result.notes).toContain(finding!.message);
  });

  it("flags a site drifting off its palette, without touching it", () => {
    const colors = ["#010203", "#040506", "#070809", "#0a0b0c", "#0d0e0f"];
    const result = runSelfCheck(
      state({
        pages: [page({ components: colors.map((c) => comp("divider", {}, { backgroundColor: c })) })],
      })
    );
    const finding = result.findings.find(
      (f) => f.category === "tokens" && f.message.includes("uden for designsystemet")
    );
    expect(finding).toBeTruthy();
    expect(finding!.repaired).toBe(false);
    // The literals stayed literals.
    const written = result.state.pages[0].components.map(
      (c) => (c.styles as Record<string, string>).backgroundColor
    );
    expect(written).toEqual(colors);
  });
});

describe("functional bindings", () => {
  it("flags buttons without a target", () => {
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("hero", { buttonText: "Book tid", buttonLink: "" })] })] })
    );
    expect(messages(result).some((m) => m.includes('Knappen "Book tid"') && m.includes("intet mål"))).toBe(true);
  });

  it("flags menu items pointing at removed pages", () => {
    const result = runSelfCheck(
      state({ navigation: { items: [{ id: "n1", label: "Priser", pageId: "gone" }] } })
    );
    expect(messages(result).some((m) => m.includes('Menupunktet "Priser"'))).toBe(true);
  });

  it("flags a booking page without a booking section", () => {
    const result = runSelfCheck(
      state({ pages: [page({ name: "Book tid", path: "/booking", role: "booking", components: [comp("cta")] })] })
    );
    expect(messages(result).some((m) => m.includes("bookingside") && m.includes("ingen booking-sektion"))).toBe(true);
  });

  it("says nothing about a booking page that has one", () => {
    const result = runSelfCheck(
      state({ pages: [page({ name: "Book tid", path: "/booking", role: "booking", components: [comp("booking")] })] })
    );
    expect(messages(result).some((m) => m.includes("ingen booking-sektion"))).toBe(false);
  });
});

describe("motion safety", () => {
  it("flags a page where too many animations replay on every scroll", () => {
    const comps = Array.from({ length: 7 }, () =>
      comp("features", {}, { motion: { effect: "fade", repeat: "every-view" } })
    );
    const result = runSelfCheck(state({ pages: [page({ components: comps })] }));
    expect(messages(result).some((m) => m.includes("hvert scroll"))).toBe(true);
  });

  it("stays quiet below the budget", () => {
    const comps = [comp("features", {}, { motion: { effect: "fade", repeat: "every-view" } })];
    const result = runSelfCheck(state({ pages: [page({ components: comps })] }));
    expect(messages(result).some((m) => m.includes("hvert scroll"))).toBe(false);
  });
});

describe("performance budgets", () => {
  it("flags very long pages", () => {
    const comps = Array.from({ length: 15 }, () => comp("divider"));
    const result = runSelfCheck(state({ pages: [page({ components: comps })] }));
    expect(messages(result).some((m) => m.includes("15 sektioner"))).toBe(true);
  });

  it("flags images embedded as data URLs", () => {
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("gallery", { imageUrl: "data:image/png;base64,AAAA" })] })] })
    );
    expect(messages(result).some((m) => m.includes("indlejret direkte"))).toBe(true);
  });
});

describe("SEO completeness", () => {
  it("aggregates missing titles and descriptions instead of spamming per page", () => {
    const result = runSelfCheck(
      state({ pages: [page({ name: "A" }), page({ name: "B", path: "/b" })] })
    );
    const seoLines = messages(result).filter((m) => m.includes("SEO-titel"));
    expect(seoLines).toHaveLength(1);
    expect(seoLines[0]).toContain('"A"');
    expect(seoLines[0]).toContain('"B"');
  });

  it("counts H1s: heroes plus custom-tree h1 tags", () => {
    const tree = { id: "t", type: "box", children: [{ id: "t2", type: "text", tag: "h1", text: "Hej" }] };
    const result = runSelfCheck(
      state({
        pages: [page({ components: [comp("hero", { title: "Velkommen" }), comp("custom", { customTree: tree })] })],
      })
    );
    expect(messages(result).some((m) => m.includes("2 hovedoverskrifter"))).toBe(true);
  });

  it("flags a page with no H1 at all", () => {
    const result = runSelfCheck(state({ pages: [page({ components: [comp("cta")] })] }));
    expect(messages(result).some((m) => m.includes("ingen hovedoverskrift"))).toBe(true);
  });

  it("does not count a titleless hero as an H1 — it renders none", () => {
    const result = runSelfCheck(state({ pages: [page({ components: [comp("hero", { title: " " })] })] }));
    expect(messages(result).some((m) => m.includes("ingen hovedoverskrift"))).toBe(true);
  });
});

describe("accessibility semantics", () => {
  it("flags heading-level skips inside custom trees", () => {
    const tree = {
      id: "t",
      type: "box",
      children: [
        { id: "h1", type: "text", tag: "h1", text: "Klinikken" },
        { id: "h3", type: "text", tag: "h3", text: "Underoverskrift" },
      ],
    };
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("custom", { customTree: tree })] })] })
    );
    expect(messages(result).some((m) => m.includes("springer et niveau over"))).toBe(true);
  });

  it("flags images without alt text and buttons without labels", () => {
    const tree = {
      id: "t",
      type: "box",
      children: [
        { id: "i", type: "image", src: "/objects/x.png" },
        { id: "b", type: "button", label: "" },
      ],
    };
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("custom", { customTree: tree })] })] })
    );
    expect(messages(result).some((m) => m.includes("mangler alt-tekst"))).toBe(true);
    expect(messages(result).some((m) => m.includes("har ingen tekst"))).toBe(true);
  });

  it('flags generic "klik her" link texts', () => {
    const result = runSelfCheck(
      state({ pages: [page({ components: [comp("cta", { buttonText: "Klik her", buttonLink: "/" })] })] })
    );
    expect(messages(result).some((m) => m.includes('"klik her"'))).toBe(true);
  });
});

/* ───────────────────── grouping & protections ───────────────────── */

describe("groupReview", () => {
  const finding = (over: Partial<SelfReview["findings"][number]>) => ({
    level: "A" as const,
    category: "links" as const,
    message: "x",
    repaired: false,
    ...over,
  });

  it("sorts repaired/unrepaired/AI findings into the right groups", () => {
    const review: SelfReview = {
      findings: [
        finding({ message: "rettet", repaired: true }),
        finding({ message: "rapporteret" }),
        finding({ level: "B", category: "content", message: "anbefaling" }),
      ],
      parity: { status: "passed", problems: [] },
      proposals: [{ id: "1", title: "T", detail: "D", instruction: "I" }],
      ai: { ran: true },
    };
    const groups = groupReview(review);
    expect(groups.fixed).toEqual(["rettet"]);
    expect(groups.recommended).toEqual(["rapporteret", "anbefaling"]);
    expect(groups.blocking).toEqual([]);
    expect(groups.needsApproval).toHaveLength(1);
  });

  it("parity failure blocks; unavailability only informs", () => {
    const failed = groupReview({
      ...emptySelfReview(),
      parity: { status: "failed", problems: ["afviger"] },
    });
    expect(failed.blocking).toEqual(["afviger"]);

    const unavailable = groupReview({
      ...emptySelfReview(),
      parity: { status: "unavailable", problems: ["kunne ikke køre"] },
    });
    expect(unavailable.blocking).toEqual([]);
    expect(unavailable.recommended).toContain("kunne ikke køre");
  });

  it("a skipped AI pass says so instead of pretending it ran", () => {
    const groups = groupReview({
      ...emptySelfReview(),
      ai: { ran: false, skippedReason: "kostloftet er nået." },
    });
    expect(groups.recommended.some((l) => l.includes("kostloftet"))).toBe(true);
  });
});

describe("page-role protections", () => {
  const protectedState = state({
    pages: [
      page({ name: "Forside" }),
      page({ name: "Privatlivspolitik", path: "/privatlivspolitik", role: "legal" }),
      page({ name: "Book tid", path: "/booking", role: "booking" }),
    ],
  });

  it("finds the protected pages by role", () => {
    const names = protectedPages(protectedState).map((p) => p.name);
    expect(names).toEqual(["Privatlivspolitik", "Book tid"]);
  });

  it("drops recommendations that target a protected page, and says so", () => {
    const { kept, droppedNotes } = dropProtectedPageItems(
      [{ pageName: "privatlivspolitik", message: "omskriv" }, { pageName: "Forside", message: "ok" }],
      protectedPages(protectedState)
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].pageName).toBe("Forside");
    expect(droppedNotes[0]).toContain("beskyttet");
  });

  it("drops items that reference a protected page by PATH, not just by name", () => {
    const { kept, droppedNotes } = dropProtectedPageItems(
      [{ pageName: undefined, message: "Omskriv teksten på /privatlivspolitik med blødere sprog" }],
      protectedPages(protectedState),
      (i) => i.message
    );
    expect(kept).toHaveLength(0);
    expect(droppedNotes).toHaveLength(1);
  });

  it("drops proposals that merely MENTION a protected page in their text", () => {
    const { kept, droppedNotes } = dropProtectedPageItems(
      [
        { pageName: undefined, title: "Omskriv Privatlivspolitik", detail: "…", instruction: "…" },
        { pageName: undefined, title: "Ny forside", detail: "…", instruction: "…" },
      ],
      protectedPages(protectedState),
      (p) => `${p.title} ${p.detail} ${p.instruction}`
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toBe("Ny forside");
    expect(droppedNotes).toHaveLength(1);
  });
});

/* ───────────────────── publish parity ───────────────────── */

describe("publish parity helpers", () => {
  it("normalizes published HTML back to comparable prose", () => {
    const text = visiblePublishedText("<h1>Ro &amp; nærvær</h1>  <p>hos&#x27;os</p>");
    expect(text).toContain("ro & nærvær");
    expect(text).toContain("hos'os");
  });

  it("spots code shipped as text", () => {
    expect(codeArtifactIn("hej ${name}")).toBe("${");
    expect(codeArtifactIn("almindelig tekst")).toBeNull();
  });

  it("samples visible copy and skips refs, urls and markup", () => {
    const samples = sampleComponentCopy({
      type: "hero",
      props: {
        title: "Velkommen til klinikken",
        buttonText: "Book en samtale",
        buttonLink: "/kontakt",
        textColor: "{color.primary}",
        note: "<b>hej</b>",
      },
    });
    expect(samples).toContain("Velkommen til klinikken");
    expect(samples).toContain("Book en samtale");
    expect(samples.every((s) => !s.includes("{") && !s.includes("<") && !s.startsWith("/"))).toBe(true);
  });
});

describe("publish parity, end to end", () => {
  it("passes on a real site rendered through the real generated renderer", async () => {
    const site = state({
      pages: [
        page({
          components: [
            comp("hero", {
              title: "Velkommen til klinikken",
              subtitle: "Samtaleterapi med ro og nærvær",
              buttonText: "Book en samtale",
              buttonLink: "/kontakt",
            }),
            comp("features", {
              title: "Det kan jeg hjælpe med",
              items: [{ title: "Angst", description: "Individuel terapi mod angst og uro" }],
            }),
            comp("cta", { title: "Klar til at tage første skridt?", buttonText: "Kontakt mig", buttonLink: "/kontakt" }),
          ],
        }),
        page({ name: "Kontakt", path: "/kontakt", components: [comp("cta", { title: "Skriv til mig" })] }),
      ],
    });
    const result = await checkPublishParity(site, "da");
    expect(result.problems).toEqual([]);
    expect(result.status).toBe("passed");
  }, 30000);
});

/* ───────────────────── report plumbing ───────────────────── */

describe("buildReport review passthrough", () => {
  it("carries the review when given one, and omits the key when not", () => {
    const review: SelfReview = emptySelfReview();
    const withReview = buildReport([], state(), [], [], review);
    expect(withReview.review).toBe(review);
    const without = buildReport([], state(), []);
    expect("review" in without).toBe(false);
  });
});
