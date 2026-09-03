/**
 * The rendering contract shared by the builder preview and the published site.
 *
 * These two renderers are separate implementations of the same picture. The
 * only thing keeping them honest is that they agree on the vocabulary: what
 * component types exist, what props and styles mean, and where the
 * breakpoints are. That vocabulary is defined once, here — and it is taken
 * from the component registry rather than written out again, because the
 * hand-written copy that used to live in this file had already drifted into
 * a stale subset (it was missing `product-detail`, `custom`, `container` and
 * more), which is exactly how a type goes missing from the publisher without
 * anything failing.
 */

export type {
  ComponentType,
  ComponentProps,
  ComponentStyles,
  ComponentItem,
  FormField,
  StatItem,
  PricingItem,
  StyledText,
  BuilderComponentData,
} from '../componentRegistry';

import type { BuilderComponentData } from '../componentRegistry';

export type ThemeConfig = {
  primaryColor: string;
  secondaryColor: string;
  /** Third brand colour, resolved from the secondary when the site has none. */
  accentColor?: string;
  fontFamily: string;
  /** Heading font, which may differ from the body font. */
  headingFontFamily?: string;
  backgroundColor: string;
  /** Card/panel colour, derived from the background when the site has none. */
  surfaceColor?: string;
  textColor?: string;
  borderRadius?: string;
  /** Max width of centred page content. */
  containerWidth?: string;
  spacingScale?: 'compact' | 'comfortable' | 'spacious';
  sectionGap?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
  /**
   * Every design token resolved to a value, as `"color.primary" -> "#4f46e5"`.
   *
   * The published site is written with token references already substituted,
   * so this is not needed to draw it — it is carried into `theme.json` and
   * `globals.css` so the generated project exposes the same brand as CSS
   * variables, and so a published build can be compared against the brand it
   * was built from.
   */
  tokens?: Record<string, string>;
};

export type PageData = {
  id: string;
  name: string;
  path: string;
  components: BuilderComponentData[];
};

export type SiteData = {
  websiteId: string;
  pages: PageData[];
  theme: ThemeConfig;
  supabaseUrl: string;
  supabaseAnonKey: string;
};
