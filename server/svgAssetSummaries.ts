/**
 * What the agent may know about a website's stored illustrations without
 * reading their markup: enough to draw one by id and recolour its slots.
 *
 * Kept apart from the tool catalogue so a caller that mocks the catalogue
 * (tests, the plan agent) still gets the lookup — and so a missing table
 * degrades to "none known" rather than an error in the assistant.
 */

import { storage } from "./storage";

export type SvgAssetSummary = {
  id: string;
  name: string;
  colorSlots?: Array<{ id: string; original: string; label: string }>;
  width?: number;
  height?: number;
  /** Where the migration found it (section ids), when it was imported. */
  usedBy?: string[];
  /** A word for what it is: logo, decoration, illustration … */
  role?: string;
};

/** The website's stored illustrations, as the agent sees them; empty when the store is unavailable. */
export async function loadSvgAssetSummaries(websiteId: string): Promise<SvgAssetSummary[]> {
  try {
    const rows = await storage.getSvgAssets(websiteId);
    return rows.map((row) => ({ id: row.id, name: row.name, colorSlots: (row.colorSlots as SvgAssetSummary["colorSlots"]) ?? undefined }));
  } catch {
    return [];
  }
}
