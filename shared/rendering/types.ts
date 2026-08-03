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
  fontFamily: string;
  backgroundColor: string;
  textColor?: string;
  borderRadius?: string;
  spacingScale?: 'compact' | 'comfortable' | 'spacious';
  sectionGap?: string;
  buttonStyle?: 'solid' | 'outline' | 'ghost' | 'gradient';
  cardStyle?: 'flat' | 'elevated' | 'bordered' | 'glass';
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
