import { describe, expect, it } from "vitest";
import type { BuilderStateData } from "@shared/schema";
import {
  evaluateOnboardingQuality,
  onboardingStateFingerprint,
  readinessMatchesOnboardingDraft,
  repairOnboardingDefaults,
} from "./onboardingQuality";

function component(id: string, type: string, props: Record<string, unknown>) {
  return { id, type, props, styles: {} };
}

function state(components: ReturnType<typeof component>[]): BuilderStateData {
  return {
    pages: [{ id: "home", name: "Hjem", path: "/", components }],
    activePage: "home",
    globalStyles: {},
  } as BuilderStateData;
}

const substantial = component("copy", "rich-text", {
  title: "Fysioterapi med ro og nærvær",
  description:
    "Klinik Nordlys hjælper mennesker i Aarhus med et personligt fysioterapiforløb, der tager udgangspunkt i deres hverdag, bevægelse og konkrete behov.",
});

describe("onboarding final quality contract", () => {
  it("rejects thin pages", () => {
    const result = evaluateOnboardingQuality(
      state([component("hero", "hero", { title: "Kort" })]),
      { language: "da" }
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "thin_page" }));
    expect(result.ready).toBe(false);
  });

  it("rejects unsupported component types instead of substituting a hero", () => {
    const result = evaluateOnboardingQuality(
      state([substantial, component("mystery", "invented-slider", substantial.props)]),
      { language: "da" }
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "unknown_component" }));
  });

  it("rejects a known section whose props contain no renderable registry content", () => {
    const result = evaluateOnboardingQuality(
      state([substantial, component("blank-hero", "hero", {})]),
      { language: "da" }
    );
    expect(result.ready).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "empty_component", componentId: "blank-hero" })
    );
  });

  it("rejects generic SaaS copy and placeholder links", () => {
    const result = evaluateOnboardingQuality(
      state([
        substantial,
        component("cta", "cta", {
          title: "Klar til næste skridt med Klinik Nordlys?",
          description: "Tag kontakt og hør, hvordan et forløb kan passe til din hverdag.",
          buttonText: "Start gratis prøveperiode",
          buttonLink: "#",
        }),
      ]),
      { language: "da" }
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["generic_copy", "placeholder_link"])
    );
  });

  it("repairs placeholder links and Danish default labels deterministically", () => {
    const input = state([
      substantial,
      component("form", "contact-form", {
        title: "Skriv til klinikken om dine behov",
        description: "Fortæl kort hvad du ønsker hjælp til, så klinikken kan vende tilbage.",
        buttonText: "Send Message",
        buttonLink: "#",
      }),
    ]);
    input.pages.push({ id: "kontakt", name: "Kontakt", path: "/kontakt", components: [] });
    const repaired = repairOnboardingDefaults(input, "da");
    const props = repaired.pages[0].components[1].props;
    expect(props.buttonText).toBe("Send besked");
    expect(props.buttonLink).toBe("/kontakt");
  });

  it("rejects a stock image repeated across sections", () => {
    const imageUrl = "https://images.unsplash.com/photo-123?w=800";
    const result = evaluateOnboardingQuality(
      state([
        component("one", "split-section", {
          ...substantial.props,
          imageUrl,
        }),
        component("two", "hero", {
          title: "Et forløb der passer ind i din hverdag",
          description:
            "Du får tydelig vejledning og et roligt forløb, der tager udgangspunkt i dine konkrete mål og muligheder.",
          imageUrl,
        }),
      ]),
      { language: "da" }
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "repeated_image" }));
  });

  it("requires imported facts and approved customer imagery to reach the draft", () => {
    const result = evaluateOnboardingQuality(
      state([
        substantial,
        component("cta", "cta", {
          title: "Tal med os om dit næste skridt",
          description:
            "Kontakt klinikken for at høre mere om mulighederne og finde et forløb, der passer til dig.",
        }),
      ]),
      {
        language: "da",
        sourceFacts: ["Klinikken blev grundlagt i 1998 på Frederiksberg"],
        customerAssetUrls: ["/objects/real-clinic.jpg"],
      }
    );
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_import_fact", "missing_customer_asset"])
    );
  });

  it("cannot report ready when enhancement or publisher parity failed", () => {
    const result = evaluateOnboardingQuality(
      state([
        substantial,
        component("cta", "cta", {
          title: "Få en rolig afklaring",
          description:
            "Kontakt Klinik Nordlys og fortæl, hvad du gerne vil kunne i din hverdag, så finder vi næste skridt sammen.",
        }),
      ]),
      {
        language: "da",
        enhancementFailed: true,
        parityProblems: ["Sektionen kan ikke gengives ved udgivelse."],
      }
    );
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["enhancement_failed", "publish_parity"])
    );
  });

  it("rejects and does not count a custom section with no renderable tree", () => {
    const result = evaluateOnboardingQuality(
      state([
        substantial,
        component("empty", "custom", { customTree: { id: "root", type: "box", children: [] } }),
      ]),
      { language: "da" }
    );
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["empty_custom_component", "thin_page"])
    );
  });

  it("rejects empty or unrenderable shared site chrome", () => {
    const draft = state([
      substantial,
      component("cta", "cta", {
        title: "Tag næste skridt",
        description:
          "Kontakt Klinik Nordlys for en afklaring af dine behov og muligheder for et personligt fysioterapiforløb.",
      }),
    ]);
    draft.siteChrome = {
      header: component("empty-header", "custom", {
        customTree: { id: "root", type: "box", children: [] },
      }),
      footer: component("empty-footer", "footer", {}),
    } as BuilderStateData["siteChrome"];
    const result = evaluateOnboardingQuality(draft, { language: "da" });
    expect(result.ready).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "empty_custom_component", componentId: "empty-header" }),
      expect.objectContaining({ code: "empty_component", componentId: "empty-footer" }),
    ]));
  });
});

describe("approval readiness is bound to one exact draft", () => {
  const draft = state([substantial, component("cta", "cta", {
    title: "Tag næste skridt sammen med klinikken",
    description:
      "Kontakt Klinik Nordlys for en rolig afklaring af dine behov og muligheder for et personligt fysioterapiforløb.",
  })]);
  const status = {
    readiness: "ready",
    qualityBuilderRevision: 7,
    qualityFingerprint: onboardingStateFingerprint(draft),
    qualitySiteRevision: 3,
  };

  it("fails closed when legacy readiness metadata is absent", () => {
    expect(readinessMatchesOnboardingDraft({}, { revision: 7, state: draft }, 3)).toBe(false);
  });

  it("rejects a draft changed after readiness was evaluated", () => {
    const changed = structuredClone(draft);
    changed.pages[0].components.pop();
    expect(readinessMatchesOnboardingDraft(status, { revision: 8, state: changed }, 4)).toBe(false);
  });

  it("accepts only the exact validated revision, fingerprint and site revision", () => {
    expect(readinessMatchesOnboardingDraft(status, { revision: 7, state: draft }, 3)).toBe(true);
  });
});