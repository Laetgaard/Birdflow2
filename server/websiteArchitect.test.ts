import { beforeEach, describe, expect, it, vi } from "vitest";
import { SectionPlanSchema, type WebsitePlan } from "@shared/websitePlanSchema";

const meteredChatMock = vi.fn();
vi.mock("./aiCall", () => ({
  meteredChat: (...args: unknown[]) => meteredChatMock(...args),
}));

import { analyzeAndPlanWebsite, buildFromPlan } from "./websiteArchitect";

function plan(): WebsitePlan {
  return {
    siteType: "clinic",
    siteName: "Klinik Nordlys",
    tagline: "Bevægelse med ro",
    currentPhase: "structure",
    analysis: {
      whatThisSiteIs: "A physiotherapy clinic website",
      targetAudience: "People seeking physiotherapy in Aarhus",
      uniqueSellingPoints: ["Modern physiotherapy in Aarhus"],
    },
    designSystem: {
      colors: {
        primary: "#123456",
        secondary: "#345678",
        accent: "#c07820",
        background: "#ffffff",
        surface: "#f5f5f5",
        text: "#111111",
      },
      typography: { headingFont: "Fraunces", bodyFont: "Inter", scale: "modern" },
      spacing: { section: "normal", component: "normal" },
      radius: "soft",
      shadow: "subtle",
      motion: { style: "subtle", speed: "normal" },
      tone: "organic",
    },
    designTone: "organic",
    animationStyle: "subtle",
    navigation: {
      style: "minimal",
      items: [{ label: "Kontakt", path: "/kontakt" }],
      hasCta: true,
      ctaText: "Book tid",
    },
    pages: [{
      id: "home",
      name: "Hjem",
      path: "/",
      purpose: "Explain the clinic and drive bookings",
      sections: [{
        id: "home-hero",
        pattern: "hero",
        description: "A calm introduction to the clinic",
        priority: "essential",
        purpose: "Orient visitors and offer the next step",
        contentIntent: "Name the clinic and explain its physiotherapy offer",
        evidence: ["Modern physiotherapy in Aarhus"],
        cta: { label: "Book tid", destination: "/kontakt" },
        assetIntent: {
          type: "customer-image",
          purpose: "Show the real clinic",
          customerAssetUrl: "/objects/clinic.jpg",
        },
        responsiveIntent: {
          desktop: "Two columns with copy and image",
          tablet: "Balanced two-column layout",
          mobile: "Copy before a full-width image",
        },
        capabilityIntent: { capability: "booking", behavior: "CTA opens contact page" },
      }],
    }],
    uxGoals: ["Make booking easy"],
    conversionGoals: ["Booking enquiries"],
    buildPhases: [{
      phase: 1,
      name: "Build",
      description: "Build all planned sections",
      estimatedSteps: 1,
    }],
  };
}

function aiResponse(value: unknown) {
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}

beforeEach(() => {
  meteredChatMock.mockReset();
});

describe("website plan quality contract", () => {
  it("keeps old section plans valid while preserving rich intent fields", () => {
    expect(SectionPlanSchema.safeParse({
      id: "legacy",
      pattern: "hero",
      description: "Legacy hero",
    }).success).toBe(true);

    const rich = SectionPlanSchema.parse(plan().pages[0].sections[0]);
    expect(rich.contentIntent).toContain("physiotherapy");
    expect(rich.evidence).toEqual(["Modern physiotherapy in Aarhus"]);
    expect(rich.cta?.destination).toBe("/kontakt");
    expect(rich.assetIntent?.customerAssetUrl).toBe("/objects/clinic.jpg");
    expect(rich.responsiveIntent?.mobile).toContain("full-width");
    expect(rich.capabilityIntent?.capability).toBe("booking");
  });

  it("preserves rich intent from architect output", async () => {
    meteredChatMock.mockResolvedValue(aiResponse(plan()));
    const result = await analyzeAndPlanWebsite("Create the clinic site");
    expect(result.success).toBe(true);
    expect(result.plan?.pages[0].sections[0]).toMatchObject({
      purpose: "Orient visitors and offer the next step",
      contentIntent: "Name the clinic and explain its physiotherapy offer",
      cta: { destination: "/kontakt" },
      assetIntent: { customerAssetUrl: "/objects/clinic.jpg" },
    });
  });

  it("rejects malformed and thin architect output", async () => {
    meteredChatMock.mockResolvedValue(aiResponse({ siteType: "clinic", pages: [] }));
    const malformed = await analyzeAndPlanWebsite("Create a clinic site");
    expect(malformed.success).toBe(false);

    const thin = plan();
    delete (thin.pages[0].sections[0] as any).contentIntent;
    meteredChatMock.mockResolvedValue(aiResponse(thin));
    const missingIntent = await analyzeAndPlanWebsite("Create a clinic site");
    expect(missingIntent.success).toBe(false);
    expect(missingIntent.error).toContain("contentIntent");
  });
});

describe("builder output quality contract", () => {
  it("rejects unknown component types instead of mapping them to hero", async () => {
    meteredChatMock.mockResolvedValue(aiResponse({
      pages: [{
        id: "home",
        name: "Home",
        path: "/",
        components: [{ id: "mystery", type: "magic-banner", props: { title: "Real copy" }, styles: {} }],
      }],
    }));
    const result = await buildFromPlan(plan());
    expect(result.success).toBe(false);
    expect(result.error).toContain("unknown component type");
  });

  it("rejects empty pages, empty props, and placeholder CTA links", async () => {
    meteredChatMock.mockResolvedValue(aiResponse({ pages: [] }));
    expect((await buildFromPlan(plan())).success).toBe(false);

    meteredChatMock.mockResolvedValue(aiResponse({
      pages: [{
        id: "home",
        name: "Home",
        path: "/",
        components: [{ id: "hero", type: "hero", props: {}, styles: {} }],
      }],
    }));
    expect((await buildFromPlan(plan())).success).toBe(false);

    meteredChatMock.mockResolvedValue(aiResponse({
      pages: [{
        id: "home",
        name: "Home",
        path: "/",
        components: [{
          id: "hero",
          type: "hero",
          props: { title: "Klinik Nordlys", buttonText: "Book", buttonLink: "#" },
          styles: {},
        }],
      }],
    }));
    expect((await buildFromPlan(plan())).error).toContain("Placeholder CTA");
  });

  it("rejects props that become empty after registry sanitization", async () => {
    meteredChatMock.mockResolvedValue(aiResponse({
      pages: [{
        id: "home",
        name: "Home",
        path: "/",
        components: [{
          id: "blank-hero",
          type: "hero",
          props: { inventedField: "This is discarded" },
          styles: {},
        }],
      }],
    }));
    const noAssetPlan = plan();
    noAssetPlan.pages[0].sections[0].assetIntent = {
      type: "none",
      purpose: "This section is copy-led",
    };
    const result = await buildFromPlan(noAssetPlan);
    expect(result.success).toBe(false);
    expect(result.error).toContain("no substantive content after sanitization");
  });

  it('never fills a missing practitioner identity or portrait with stock people', async () => {
    const requestPlan = plan();
    requestPlan.pages[0].sections[0].assetIntent = { type: 'none', purpose: 'Text introduction' };
    meteredChatMock.mockResolvedValue(aiResponse({ pages: [{
      id: 'home', name: 'Home', path: '/', components: [{
        id: 'team', type: 'team', props: { title: 'Your practitioner', members: [{ name: 'Sofie Lund', role: 'Psykolog' }, { role: 'Unspecified' }] }, styles: {},
      }],
    }] }));
    const result = await buildFromPlan(requestPlan);
    expect(result.success).toBe(true);
    expect(result.builderState?.pages[0].components[0].props.members).toEqual([{ id: 'member_0', name: 'Sofie Lund', role: 'Psykolog', bio: '', imageUrl: undefined }]);
  });

  it("accepts a known alias and preserves a supplied customer image", async () => {
    meteredChatMock.mockResolvedValue(aiResponse({
      pages: [{
        id: "home",
        name: "Hjem",
        path: "/",
        components: [{
          id: "split",
          type: "split",
          props: { title: "Klinik Nordlys", imageUrl: "/objects/clinic.jpg" },
          styles: { responsive: { mobile: { padding: "16px" } } },
        }],
      }],
    }));
    const result = await buildFromPlan(plan());
    expect(result.success).toBe(true);
    expect(result.builderState?.pages[0].components[0].type).toBe("split-section");
    expect(result.builderState?.pages[0].components[0].props.imageUrl).toBe("/objects/clinic.jpg");
    expect(result.builderState?.pages[0].components[0].styles.responsive?.mobile?.padding).toBe("16px");
  });
});
