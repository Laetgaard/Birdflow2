import { describe, expect, it } from "vitest";
import { createDefaultBrandGuide } from "@shared/customComponents";
import type { BuilderStateData } from "@shared/schema";
import type { WebsitePlan } from "@shared/websitePlanSchema";
import type { OnboardingGenInput } from "./onboardingGenerator";
import {
  applyDirectionManifestToState,
  bindAssetPlacementsToState,
  buildDirectionCandidate,
  buildWebsiteBrief,
  createCreativeDirectionManifests,
  directionDifferenceScore,
} from "./onboardingDirections";

const input: OnboardingGenInput = {
  language: "da",
  business: {
    name: "Ro & Retning",
    industry: "Psykoterapi",
    description: "Psykoterapi for voksne i Aarhus. Samtaler tilbydes fysisk og online.",
  },
  wishes: {
    goals: ["kontakt"],
    notes: "Fokusér på tryghed og et tydeligt næste skridt.",
  },
  feeling: "rolig, menneskelig og faglig",
  palette: {
    id: "calm",
    name: "Calm",
    description: "Calm",
    colors: {
      primary: "#35524a",
      secondary: "#b58f6b",
      accent: "#d9b382",
      background: "#f8f5ef",
      surface: "#ffffff",
      text: "#25312e",
    },
  },
  fontPair: {
    id: "pair",
    name: "Lora + Inter",
    heading: "Lora",
    body: "Inter",
    scale: "classic",
    description: "Readable",
  },
  inspirationUrls: [],
  ownImageUrls: ["https://example.com/portrait.jpg", "https://example.com/room.jpg"],
};

const plan = {
  siteName: "Ro & Retning",
  sitePurpose: "Contact",
  targetAudience: "Adults",
  language: "da",
  designSystem: {},
  pages: [{
    id: "home",
    name: "Forside",
    path: "/",
    purpose: "Introduce",
    sections: [
      { id: "hero", type: "hero", purpose: "Introduce", content: {}, assetIntent: {} },
      { id: "about", type: "text-image", purpose: "Explain", content: {}, assetIntent: {} },
      { id: "services", type: "features", purpose: "Services", content: {}, assetIntent: {} },
    ],
  }],
} as unknown as WebsitePlan;

const state: BuilderStateData = {
  activePage: "home",
  pages: [{
    id: "home",
    name: "Forside",
    path: "/",
    components: [
      { id: "header", type: "header", props: { title: "Ro & Retning" }, styles: {} },
      {
        id: "hero",
        type: "hero",
        props: {
          title: "Ro & Retning",
          description: input.business.description,
          imageUrl: input.ownImageUrls[0],
          buttonText: "Kontakt",
          buttonLink: "/kontakt",
        },
        styles: {},
      },
      {
        id: "features",
        type: "features",
        props: {
          title: "Samtaler",
          description: input.wishes.notes,
          items: [{ id: "one", title: "Psykoterapi", description: input.business.description }],
        },
        styles: {},
      },
      {
        id: "about",
        type: "text-image",
        props: {
          title: "Om Ro & Retning",
          description: input.business.description,
          imageUrl: input.ownImageUrls[1],
        },
        styles: {},
      },
      { id: "cta", type: "cta", props: { title: "Kontakt", description: input.wishes.notes }, styles: {} },
      { id: "footer", type: "footer", props: { title: "Ro & Retning" }, styles: {} },
    ],
  }],
  globalStyles: {},
  customComponents: [],
};

describe("production onboarding design directions", () => {
  it("creates one verified brief with facts, content and explicit asset inventory", () => {
    const brief = buildWebsiteBrief(input, {
      facts: [{ text: "Psykoterapi for voksne i Aarhus.", source: "website" }],
      goals: [],
      services: [],
      products: [],
    } as any);

    expect(brief.businessName).toBe("Ro & Retning");
    expect(brief.facts.some((fact) => fact.value.includes("Psykoterapi for voksne"))).toBe(true);
    expect(brief.content.length).toBeGreaterThan(0);
    expect(brief.assets).toHaveLength(2);
    expect(brief.assets[0]).toMatchObject({
      url: input.ownImageUrls[0],
      heroSuitable: true,
      preferredCrop: expect.any(String),
    });
  });

  it("creates three materially distinct manifests with explicit asset placement", () => {
    const guide = {
      ...createDefaultBrandGuide(),
      colors: input.palette.colors,
      typography: {
        ...createDefaultBrandGuide().typography,
        headingFont: input.fontPair.heading,
        bodyFont: input.fontPair.body,
      },
    };
    const brief = buildWebsiteBrief(input, { facts: [], goals: [], services: [], products: [] } as any);
    const manifests = createCreativeDirectionManifests(input, plan, guide, brief)
      .map((manifest) => bindAssetPlacementsToState(manifest, state));

    expect(manifests).toHaveLength(3);
    expect(new Set(manifests.map((manifest) => manifest.layoutArchetype)).size).toBe(3);
    expect(new Set(manifests.map((manifest) => manifest.heroComposition)).size).toBe(3);
    for (const manifest of manifests) {
      expect(manifest.assetPlacements).toHaveLength(2);
      expect(manifest.assetPlacements[0]).toMatchObject({
        assetUrl: expect.any(String),
        pageId: "home",
        sectionId: expect.any(String),
        role: expect.any(String),
        crop: expect.any(String),
      });
    }
    expect(directionDifferenceScore(manifests[0], manifests[1])).toBeGreaterThanOrEqual(70);
    expect(directionDifferenceScore(manifests[1], manifests[2])).toBeGreaterThanOrEqual(70);
  });

  it("produces three complete builder states without changing verified copy or asset URLs", () => {
    const guide = {
      ...createDefaultBrandGuide(),
      colors: input.palette.colors,
      typography: {
        ...createDefaultBrandGuide().typography,
        headingFont: input.fontPair.heading,
        bodyFont: input.fontPair.body,
      },
    };
    const brief = buildWebsiteBrief(input, { facts: [], goals: [], services: [], products: [] } as any);
    const manifests = createCreativeDirectionManifests(input, plan, guide, brief)
      .map((manifest) => bindAssetPlacementsToState(manifest, state));
    const states = manifests.map((manifest) => applyDirectionManifestToState(state, manifest));
    const candidates = states.map((candidateState, index) =>
      buildDirectionCandidate({
        state: candidateState,
        manifest: manifests[index],
        language: "da",
        customerAssetUrls: input.ownImageUrls,
        uniqueness: 80,
      }),
    );

    expect(new Set(candidates.map((candidate) => candidate.fingerprint)).size).toBe(3);
    for (const candidate of candidates) {
      const encoded = JSON.stringify(candidate.state);
      expect(candidate.state.pages).toHaveLength(state.pages.length);
      expect(encoded).toContain(input.business.description);
      expect(encoded).toContain(input.ownImageUrls[0]);
      expect(candidate.manifest.assetPlacements.map((placement) => placement.assetUrl)).toContain(input.ownImageUrls[1]);
      expect(candidate.qualityScore.directionUniqueness).toBe(80);
    }
  });
});