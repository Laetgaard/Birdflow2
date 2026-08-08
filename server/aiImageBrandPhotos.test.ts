/**
 * Tests for brand-photo preference in image resolution and the brand-guide
 * completeness + prompt-context helpers introduced alongside the "Assetter" tab.
 */
import { describe, it, expect } from "vitest";
import { resolveAiImageMarkers } from "./aiImages";
import {
  brandGuideCompleteness,
  buildBrandContext,
  createDefaultBrandGuide,
  type BrandGuide,
} from "@shared/customComponents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuide(overrides: Partial<BrandGuide> = {}): BrandGuide {
  return { ...createDefaultBrandGuide(), ...overrides };
}

function addComponentMutation(imageUrl: string) {
  return {
    action: "add_component" as const,
    sectionId: "hero",
    component: {
      id: "comp-1",
      type: "hero",
      props: { imageUrl },
    },
  };
}

// ---------------------------------------------------------------------------
// brandGuideCompleteness
// ---------------------------------------------------------------------------

describe("brandGuideCompleteness", () => {
  it("returns 0/6 for a default guide with no assets filled", () => {
    const guide = createDefaultBrandGuide();
    const { count, total, missing } = brandGuideCompleteness(guide);
    expect(total).toBe(6);
    expect(count).toBe(0);
    expect(missing).toHaveLength(6);
  });

  it("counts logo as one of the six items", () => {
    const { count } = brandGuideCompleteness(makeGuide({ logoUrl: "/objects/logo.png" }));
    expect(count).toBe(1);
  });

  it("counts brandPhotos (at least one) as one item", () => {
    const { count } = brandGuideCompleteness(
      makeGuide({ brandPhotos: [{ url: "/objects/p1.jpg", mediaId: "m1" }] })
    );
    expect(count).toBe(1);
  });

  it("counts illustrationStyle as one item", () => {
    const { count } = brandGuideCompleteness(
      makeGuide({ illustrationStyle: "flat 2D cartoon" })
    );
    expect(count).toBe(1);
  });

  it("counts motionPreset as one item", () => {
    const { count } = brandGuideCompleteness(makeGuide({ motionPreset: "bold" }));
    expect(count).toBe(1);
  });

  it("counts toneOfVoice as one item", () => {
    const { count } = brandGuideCompleteness(makeGuide({ toneOfVoice: "Varm og direkte" }));
    expect(count).toBe(1);
  });

  it("counts keywords (at least one) as one item", () => {
    const { count } = brandGuideCompleteness(makeGuide({ keywords: ["troværdig"] }));
    expect(count).toBe(1);
  });

  it("reaches 6/6 when every category is filled", () => {
    const { count, missing } = brandGuideCompleteness(
      makeGuide({
        logoUrl: "/objects/logo.png",
        brandPhotos: [{ url: "/objects/p1.jpg", mediaId: "m1" }],
        illustrationStyle: "flat 2D cartoon in warm earth tones",
        motionPreset: "subtle",
        toneOfVoice: "Varm og direkte",
        keywords: ["troværdig", "lokal"],
      })
    );
    expect(count).toBe(6);
    expect(missing).toHaveLength(0);
  });

  it("returns null-safe when guide is null", () => {
    const { count } = brandGuideCompleteness(null);
    expect(count).toBe(0);
  });

  it("ignores whitespace-only illustrationStyle", () => {
    const { count } = brandGuideCompleteness(makeGuide({ illustrationStyle: "   " }));
    expect(count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// buildBrandContext — new fields
// ---------------------------------------------------------------------------

describe("buildBrandContext — new asset fields", () => {
  it("includes motionPreset with its description", () => {
    const ctx = buildBrandContext(makeGuide({ motionPreset: "playful" }));
    expect(ctx).toContain("Motion personality: playful");
    expect(ctx).toContain("spring");
  });

  it("includes motionDescription when present", () => {
    const ctx = buildBrandContext(makeGuide({ motionDescription: "gentle fade — no bouncing" }));
    expect(ctx).toContain("Motion direction: gentle fade");
  });

  it("includes brand photo count when photos are uploaded", () => {
    const ctx = buildBrandContext(
      makeGuide({
        brandPhotos: [
          { url: "/objects/p1.jpg", mediaId: "m1" },
          { url: "/objects/p2.jpg", mediaId: "m2" },
        ],
      })
    );
    expect(ctx).toContain("Brand photos: 2 uploaded photo");
    expect(ctx).toContain("PREFER these over AI-generated images");
  });

  it("includes illustrationStyle", () => {
    const ctx = buildBrandContext(makeGuide({ illustrationStyle: "flat cartoon warm tones" }));
    expect(ctx).toContain("Illustration style: flat cartoon warm tones");
  });

  it("appends illustrationReferenceUrl to the illustration line", () => {
    const ctx = buildBrandContext(
      makeGuide({
        illustrationStyle: "flat 2D",
        illustrationReferenceUrl: "https://example.com/ref.png",
      })
    );
    expect(ctx).toContain("https://example.com/ref.png");
  });

  it("omits illustration section when illustrationStyle is absent", () => {
    const ctx = buildBrandContext(makeGuide({ illustrationStyle: undefined }));
    expect(ctx).not.toContain("Illustration style:");
  });

  it("omits brand photo hint when brandPhotos is empty", () => {
    const ctx = buildBrandContext(makeGuide({ brandPhotos: [] }));
    expect(ctx).not.toContain("Brand photos:");
  });
});

// ---------------------------------------------------------------------------
// resolveAiImageMarkers — brand photo preference
// ---------------------------------------------------------------------------

describe("resolveAiImageMarkers — brand photo preference", () => {
  const PHOTO_1 = "/objects/brand-photo-1.jpg";
  const PHOTO_2 = "/objects/brand-photo-2.jpg";
  const PHOTO_3 = "/objects/brand-photo-3.jpg";

  it("fills a single image slot with the first brand photo", async () => {
    const mutations = [addComponentMutation("ai://cozy office hero shot")];
    const guide = makeGuide({
      brandPhotos: [{ url: PHOTO_1, mediaId: "m1" }],
    });

    const { mutations: resolved, created } = await resolveAiImageMarkers(
      "ws-test",
      mutations as any,
      guide as any
    );

    const props = (resolved[0] as any).component.props;
    expect(props.imageUrl).toBe(PHOTO_1);
    expect(created.some((c) => c.includes("brandfoto"))).toBe(true);
  });

  it("uses round-robin when there are more slots than photos", async () => {
    // 3 slots, 2 photos → [photo1, photo2, photo1]
    const mutations = [
      addComponentMutation("ai://hero"),
      // add_component only gives one slot; use update_component for the rest
      { action: "update_component" as const, componentId: "c2", props: { imageUrl: "ai://team photo" } },
      { action: "update_component" as const, componentId: "c3", props: { imageUrl: "ai://office" } },
    ];
    const guide = makeGuide({
      brandPhotos: [
        { url: PHOTO_1, mediaId: "m1" },
        { url: PHOTO_2, mediaId: "m2" },
      ],
    });

    const { mutations: resolved } = await resolveAiImageMarkers(
      "ws-test",
      mutations as any,
      guide as any
    );

    const urls = [
      (resolved[0] as any).component.props.imageUrl,
      (resolved[1] as any).props.imageUrl,
      (resolved[2] as any).props.imageUrl,
    ];
    expect(urls).toEqual([PHOTO_1, PHOTO_2, PHOTO_1]);
  });

  it("returns all N photos when N slots exactly matches photo count", async () => {
    const mutations = [
      addComponentMutation("ai://hero"),
      { action: "update_component" as const, componentId: "c2", props: { imageUrl: "ai://team" } },
      { action: "update_component" as const, componentId: "c3", props: { imageUrl: "ai://office" } },
    ];
    const guide = makeGuide({
      brandPhotos: [
        { url: PHOTO_1, mediaId: "m1" },
        { url: PHOTO_2, mediaId: "m2" },
        { url: PHOTO_3, mediaId: "m3" },
      ],
    });

    const { mutations: resolved } = await resolveAiImageMarkers(
      "ws-test",
      mutations as any,
      guide as any
    );

    expect((resolved[0] as any).component.props.imageUrl).toBe(PHOTO_1);
    expect((resolved[1] as any).props.imageUrl).toBe(PHOTO_2);
    expect((resolved[2] as any).props.imageUrl).toBe(PHOTO_3);
  });

  it("returns original mutations unchanged when there are no ai:// markers", async () => {
    const mutations = [
      { action: "update_component" as const, componentId: "c1", props: { title: "Hello" } },
    ];
    const guide = makeGuide({
      brandPhotos: [{ url: PHOTO_1, mediaId: "m1" }],
    });

    const { mutations: resolved, created, notes } = await resolveAiImageMarkers(
      "ws-test",
      mutations as any,
      guide as any
    );

    expect(created).toHaveLength(0);
    expect(notes).toHaveLength(0);
    // No image-related props to modify — title should be untouched
    expect((resolved[0] as any).props.title).toBe("Hello");
  });

  it("does not modify the original mutations array (works on a clone)", async () => {
    const original = addComponentMutation("ai://hero");
    const mutations = [original];
    const guide = makeGuide({
      brandPhotos: [{ url: PHOTO_1, mediaId: "m1" }],
    });

    await resolveAiImageMarkers("ws-test", mutations as any, guide as any);

    // Original mutation props must be untouched
    expect((original as any).component.props.imageUrl).toBe("ai://hero");
  });
});
