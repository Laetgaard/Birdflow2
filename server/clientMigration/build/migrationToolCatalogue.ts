/**
 * The tools the migration agent may call: the normal catalogue minus every
 * tool that generates content, restyles the site or reaches outside the
 * one section it is rebuilding.
 */

import { buildToolCatalogue, type AgentTool } from "../../aiAgentTools";

export const EXCLUDED_MIGRATION_TOOLS = new Set([
  "generate_image",
  "apply_preset",
  "propose_palettes",
  "propose_font_pairs",
  "plan_site",
  "propose_design_directions",
  "apply_design_direction",
  "analyze_reference_image",
  "remove_page",
  "reorder_pages",
  "set_global_styles",
  "update_global_styles",
  "update_navigation",
  "update_site_chrome",
  "run_visual_review",
  "capture_page_screenshot",
  "add_page",
  "update_brand_guide",
  "batch_update_components",
  "set_motion",
]);

export function migrationToolCatalogue(): AgentTool[] {
  return buildToolCatalogue().filter((tool) => !EXCLUDED_MIGRATION_TOOLS.has(tool.name));
}
