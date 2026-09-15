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
  // Library and canvas tools would introduce content the source site never had.
  "list_account_components",
  "insert_library_component",
  "create_canvas",
  "add_canvas_element",
  "arrange_canvas_element",
  // Whole-site reads and metered analyses: the agent works on one section of
  // one page it is told about, and each of these costs a call (or a browser
  // round-trip) that places nothing.
  "analyze_design",
  "run_self_check",
  "read_pages",
  "list_pages",
  "find_text",
  "list_custom_components",
  "duplicate_component",
  "move_component",
]);

/**
 * @param extra Tools only a migration has — cutting a region out of the
 *   customer's own screenshot, reading the source page's decorations. They
 *   are appended rather than built in, because they need the job's
 *   extraction, screenshot and importer to exist.
 */
export function migrationToolCatalogue(extra: AgentTool[] = []): AgentTool[] {
  const base = buildToolCatalogue().filter((tool) => !EXCLUDED_MIGRATION_TOOLS.has(tool.name));
  const names = new Set(base.map((tool) => tool.name));
  return [...base, ...extra.filter((tool) => !names.has(tool.name))];
}
