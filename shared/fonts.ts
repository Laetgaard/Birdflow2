/**
 * The one approved font list.
 *
 * The builder only ever offers these fonts, and the published site loads
 * exactly this set. Before, the two lists were written out separately: a
 * font the customer picked in the builder could simply not exist on the
 * published site, and the site silently fell back to something else. Adding
 * a font here adds it to both, and nowhere else can add one to only one.
 */

export type FontCategory = "sans" | "serif" | "display" | "mono";

export type ApprovedFont = {
  /** What the customer sees, and the Google Fonts family name. */
  name: string;
  /** The full CSS font stack stored on components and global styles. */
  stack: string;
  category: FontCategory;
  /** Weights loaded for this family. Empty means the family has only one. */
  weights: number[];
};

export const APPROVED_FONTS: readonly ApprovedFont[] = [
  { name: "Inter", stack: "Inter, system-ui, sans-serif", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { name: "Poppins", stack: "Poppins, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Montserrat", stack: "Montserrat, sans-serif", category: "sans", weights: [400, 500, 600, 700, 800] },
  { name: "Open Sans", stack: "Open Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Roboto", stack: "Roboto, sans-serif", category: "sans", weights: [400, 500, 700] },
  { name: "Lato", stack: "Lato, sans-serif", category: "sans", weights: [400, 700, 900] },
  { name: "Nunito", stack: "Nunito, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Nunito Sans", stack: "Nunito Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Raleway", stack: "Raleway, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Work Sans", stack: "Work Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "DM Sans", stack: "DM Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Plus Jakarta Sans", stack: "Plus Jakarta Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700, 800] },
  { name: "Manrope", stack: "Manrope, sans-serif", category: "sans", weights: [400, 500, 600, 700, 800] },
  { name: "Outfit", stack: "Outfit, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Figtree", stack: "Figtree, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Space Grotesk", stack: "Space Grotesk, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Sora", stack: "Sora, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Urbanist", stack: "Urbanist, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Lexend", stack: "Lexend, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Rubik", stack: "Rubik, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Quicksand", stack: "Quicksand, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Josefin Sans", stack: "Josefin Sans, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Barlow", stack: "Barlow, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Mulish", stack: "Mulish, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Karla", stack: "Karla, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Cabin", stack: "Cabin, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Archivo", stack: "Archivo, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Exo 2", stack: "Exo 2, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Overpass", stack: "Overpass, sans-serif", category: "sans", weights: [400, 500, 600, 700] },
  { name: "Playfair Display", stack: "Playfair Display, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Merriweather", stack: "Merriweather, serif", category: "serif", weights: [400, 700, 900] },
  { name: "Lora", stack: "Lora, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "PT Serif", stack: "PT Serif, serif", category: "serif", weights: [400, 700] },
  { name: "Source Serif 4", stack: "Source Serif 4, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Libre Baskerville", stack: "Libre Baskerville, serif", category: "serif", weights: [400, 700] },
  { name: "Crimson Text", stack: "Crimson Text, serif", category: "serif", weights: [400, 600, 700] },
  { name: "EB Garamond", stack: "EB Garamond, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Cormorant Garamond", stack: "Cormorant Garamond, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Spectral", stack: "Spectral, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Bitter", stack: "Bitter, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Vollkorn", stack: "Vollkorn, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Cardo", stack: "Cardo, serif", category: "serif", weights: [400, 700] },
  { name: "Frank Ruhl Libre", stack: "Frank Ruhl Libre, serif", category: "serif", weights: [400, 500, 600, 700] },
  { name: "Bebas Neue", stack: "Bebas Neue, sans-serif", category: "display", weights: [] },
  { name: "Oswald", stack: "Oswald, sans-serif", category: "display", weights: [400, 500, 600, 700] },
  { name: "Anton", stack: "Anton, sans-serif", category: "display", weights: [] },
  { name: "Righteous", stack: "Righteous, sans-serif", category: "display", weights: [] },
  { name: "Teko", stack: "Teko, sans-serif", category: "display", weights: [400, 500, 600, 700] },
  { name: "Cinzel", stack: "Cinzel, serif", category: "display", weights: [400, 500, 600, 700] },
  { name: "Abril Fatface", stack: "Abril Fatface, serif", category: "display", weights: [] },
  { name: "Big Shoulders Display", stack: "Big Shoulders Display, sans-serif", category: "display", weights: [400, 500, 600, 700, 800] },
  { name: "Fira Code", stack: "Fira Code, monospace", category: "mono", weights: [400, 500, 600, 700] },
  { name: "JetBrains Mono", stack: "JetBrains Mono, monospace", category: "mono", weights: [400, 500, 600, 700] },
  { name: "Source Code Pro", stack: "Source Code Pro, monospace", category: "mono", weights: [400, 500, 600, 700] },
  { name: "IBM Plex Mono", stack: "IBM Plex Mono, monospace", category: "mono", weights: [400, 500, 600, 700] },
  { name: "Roboto Mono", stack: "Roboto Mono, monospace", category: "mono", weights: [400, 500, 600, 700] },
  { name: "Space Mono", stack: "Space Mono, monospace", category: "mono", weights: [400, 700] },
];

/** The stack used when nothing is chosen, or when a stack is not approved. */
export const DEFAULT_FONT_STACK = "Inter, system-ui, sans-serif";

const BY_STACK = new Map(APPROVED_FONTS.map((f) => [f.stack.toLowerCase(), f]));
const BY_NAME = new Map(APPROVED_FONTS.map((f) => [f.name.toLowerCase(), f]));

/** The family name a CSS stack starts with, unquoted: "Lora, serif" -> "Lora". */
export function primaryFamily(stack: string): string {
  return (stack || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
}

/** Is this exact stack one the published site is guaranteed to load? */
export function isApprovedFontStack(stack: string | undefined): boolean {
  if (!stack) return false;
  if (BY_STACK.has(stack.trim().toLowerCase())) return true;
  return BY_NAME.has(primaryFamily(stack).toLowerCase());
}

/**
 * Turn whatever is stored into a stack the published site can render.
 *
 * A stack whose first family is approved keeps that family (older states
 * stored slightly different fallbacks). Anything else falls back to the
 * default rather than shipping a font the site never loads.
 */
export function resolveApprovedFontStack(stack: string | undefined): string {
  if (!stack) return DEFAULT_FONT_STACK;
  const exact = BY_STACK.get(stack.trim().toLowerCase());
  if (exact) return exact.stack;
  const byName = BY_NAME.get(primaryFamily(stack).toLowerCase());
  if (byName) return byName.stack;
  return DEFAULT_FONT_STACK;
}

/** The single Google Fonts stylesheet URL the published site loads. */
export function googleFontsHref(): string {
  const families = [...APPROVED_FONTS]
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((f) => {
      const family = f.name.replace(/ /g, "+");
      return f.weights.length ? `family=${family}:wght@${f.weights.join(";")}` : `family=${family}`;
    });
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
