/**
 * Creative director types — Task #169
 *
 * Birdflow can act as a creative design partner, not just a brand-compliance
 * bot. Every significant design proposal carries a DesignIntent and
 * BrandDeviation so the approval gate, the client UI and the tests can all
 * reason about what is being proposed and why.
 */

/**
 * How closely a design proposal follows the customer's existing brand guide.
 *
 * brand_aligned  — stays within the current palette, fonts and style; a pure
 *                  execution of what the brand already established.
 * brand_evolution — thoughtful refinement: same visual DNA, evolved emphasis;
 *                  may shift a secondary colour or try a new typographic scale.
 * experimental   — a genuinely new direction; significant departure from at
 *                  least two brand dimensions (colour, type, layout language).
 *                  These proposals are stored separately and require explicit
 *                  user approval before touching the live site.
 */
export type DesignIntent = "brand_aligned" | "brand_evolution" | "experimental";

/**
 * How far a design proposal departs from the current brand guide.
 *
 * none   — no brand-guide values change.
 * low    — one value changes (e.g. an accent colour), tone and type preserved.
 * medium — two or three values change (e.g. new palette + new body font).
 * high   — the palette, typography AND layout language all differ materially;
 *          this level triggers the large-change approval gate.
 */
export type BrandDeviationLevel = "none" | "low" | "medium" | "high";

export type BrandDeviation = {
  /** Magnitude of the departure. */
  level: BrandDeviationLevel;
  /**
   * Human-readable list of specific changes, e.g.
   * ["Primærfarve ændret fra #1a2b3c til #2d6a4f", "Skrifttype skiftet til Playfair Display"]
   */
  changes: string[];
  /**
   * Danish rationale explaining WHY this deviation plausibly improves the
   * customer's differentiation, emotional impact, usability or visual quality.
   */
  rationale: string;
};

/**
 * One named design direction proposed by the creative-director tool.
 *
 * A direction is a named, self-contained proposal. It carries enough
 * information for the client to render a preview card and for the server
 * to apply or discard the direction on demand.
 */
export type DesignDirection = {
  /** Stable, random short id (e.g. "dir-a3f9"). */
  id: string;
  /** Evocative short name, e.g. "Calm Clinical", "Organic Editorial". */
  name: string;
  /** One-sentence concept describing the visual and emotional direction. */
  concept: string;
  /** How faithfully this direction follows the existing brand guide. */
  designIntent: DesignIntent;
  /** Exactly what differs from the current brand guide, and why. */
  brandDeviation: BrandDeviation;
  /**
   * Brand-guide key-value changes this direction would introduce.
   * Matches the structure of update_brand_guide mutations — so the server
   * can replay them on approval.
   *
   * E.g. { primaryColor: "#2d6a4f", fontFamily: "Playfair Display" }
   */
  brandGuideChanges: Record<string, unknown>;
};

/** The three post-approval choices offered to the user after an experimental
 *  direction is applied. */
export type BrandEvolutionChoice =
  | "keep_here"      // Apply only to this page/section — brand guide unchanged
  | "apply_site"     // Apply across the whole website — brand guide unchanged
  | "add_to_guide";  // Persist the new direction into the brand guide
