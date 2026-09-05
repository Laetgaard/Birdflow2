import { describe, expect, it } from "vitest";
import {
  initialWebsiteImportAssetIds,
  MAX_WEBSITE_IMPORT_ASSETS,
  toggleWebsiteImportAsset,
  type WebsiteImportAsset,
} from "../client/src/components/onboarding/WebsiteImportStep";

describe("website import asset selection boundary", () => {
  const assets: WebsiteImportAsset[] = Array.from({ length: 50 }, (_, index) => ({
    id: `asset-${index}`,
    name: `Asset ${index}`,
    kind: "image",
  }));

  it("creates a valid default approval selection from a 50-asset report", () => {
    const selected = initialWebsiteImportAssetIds(assets);
    expect(selected).toHaveLength(MAX_WEBSITE_IMPORT_ASSETS);
  });

  it("does not let the review UI select a twenty-first asset", () => {
    const selected = initialWebsiteImportAssetIds(assets);
    expect(toggleWebsiteImportAsset(selected, "asset-49")).toEqual(selected);
    expect(toggleWebsiteImportAsset(selected, selected[0])).toHaveLength(19);
  });
});