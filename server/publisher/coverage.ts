/**
 * Proof that the published site can draw everything the preview can.
 *
 * The builder preview and the published site are two implementations of the
 * same picture, and the publisher used to fail silently: a component type it
 * had never heard of fell through a `default: return null`, so the section
 * simply was not there on the customer's live website while it looked fine
 * in the builder.
 *
 * Two guards close that. `PUBLISHER_RENDERS` must name every type in the
 * registry, so adding a component without teaching the publisher about it
 * stops the TypeScript build. And because that declaration is only a promise,
 * `missingRendererCases` reads the generated renderer back and checks the
 * promise was kept.
 */

import type { BuilderStateData } from '../../shared/schema';
import type { ComponentType } from '../../shared/componentRegistry';
import { RENDERABLE_COMPONENT_TYPES, type ComponentTypeCoverage } from '../../shared/rendering';

/**
 * Where each component type is rendered on the published site.
 *
 * `renderer` — a `case` in the generated ComponentRenderer.
 * `productPage` — a design panel for the generated product pages, drawn
 *   nowhere on the page it sits on (the builder hides it in preview too).
 */
type Coverage = { component: string; where: 'renderer' | 'productPage' };

export const PUBLISHER_RENDERS: ComponentTypeCoverage<Coverage> = {
  hero: { component: 'HeroSection', where: 'renderer' },
  'image-slider': { component: 'ImageSliderSection', where: 'renderer' },
  'text-image': { component: 'TextImageSection', where: 'renderer' },
  cta: { component: 'CTASection', where: 'renderer' },
  features: { component: 'FeaturesSection', where: 'renderer' },
  testimonials: { component: 'TestimonialsSection', where: 'renderer' },
  footer: { component: 'FooterSection', where: 'renderer' },
  header: { component: 'HeaderSection', where: 'renderer' },
  'product-grid': { component: 'ProductGridSection', where: 'renderer' },
  // Not a section: it configures app/product/[id] (see resolveProductPageDesign).
  'product-detail': { component: 'ProductDetailPage', where: 'productPage' },
  booking: { component: 'BookingForm', where: 'renderer' },
  gallery: { component: 'GallerySection', where: 'renderer' },
  'pricing-table': { component: 'PricingTableSection', where: 'renderer' },
  faq: { component: 'FAQSection', where: 'renderer' },
  'stats-counter': { component: 'StatsCounterSection', where: 'renderer' },
  'contact-form': { component: 'ContactFormSection', where: 'renderer' },
  'video-embed': { component: 'VideoEmbedSection', where: 'renderer' },
  divider: { component: 'DividerSection', where: 'renderer' },
  spacer: { component: 'SpacerSection', where: 'renderer' },
  newsletter: { component: 'NewsletterSection', where: 'renderer' },
  'before-after': { component: 'BeforeAfterSection', where: 'renderer' },
  'logo-cloud': { component: 'LogoCloudSection', where: 'renderer' },
  marquee: { component: 'MarqueeSection', where: 'renderer' },
  tabs: { component: 'TabsSection', where: 'renderer' },
  'comparison-table': { component: 'ComparisonTableSection', where: 'renderer' },
  'split-section': { component: 'SplitSectionComponent', where: 'renderer' },
  'rich-text': { component: 'RichTextSection', where: 'renderer' },
  team: { component: 'TeamSection', where: 'renderer' },
  timeline: { component: 'TimelineSection', where: 'renderer' },
  services: { component: 'ServicesSection', where: 'renderer' },
  container: { component: 'ContainerSection', where: 'renderer' },
  custom: { component: 'CustomComponentSection', where: 'renderer' },
};

/**
 * Types the generated renderer claims to handle but has no `case` for.
 *
 * Reads the generated source rather than trusting the table above: the table
 * is a declaration, this is the evidence.
 */
export function missingRendererCases(rendererSource: string): ComponentType[] {
  return RENDERABLE_COMPONENT_TYPES.filter((type) => {
    if (PUBLISHER_RENDERS[type].where !== 'renderer') return false;
    return !rendererSource.includes(`case '${type}':`);
  });
}

export type UnrenderableComponent = {
  pageName: string;
  componentId: string;
  type: string;
};

const KNOWN_TYPES = new Set<string>(RENDERABLE_COMPONENT_TYPES);

/**
 * Components in a builder state whose type the published site cannot draw.
 *
 * Anything not in the registry at all counts too: it renders as nothing in
 * both places, but on a live site "nothing" is a hole the customer paid for.
 */
export function unrenderableComponents(state: BuilderStateData): UnrenderableComponent[] {
  const found: UnrenderableComponent[] = [];
  const check = (pageName: string, component: unknown) => {
    const type = String((component as { type?: string }).type ?? '');
    if (!KNOWN_TYPES.has(type)) {
      found.push({ pageName, componentId: String((component as { id?: string }).id ?? '?'), type });
    }
  };

  for (const page of state.pages ?? []) {
    for (const component of page.components ?? []) check(page.name, component);
  }
  // The shared header and footer live outside the page list but are drawn on
  // every page, so a hole in one of them is a hole on the whole website.
  if (state.siteChrome?.header) check('Delt header', state.siteChrome.header);
  if (state.siteChrome?.footer) check('Delt footer', state.siteChrome.footer);

  return found;
}

/** Danish explanation of a publish that would have shipped blank sections. */
export function describeUnrenderable(found: UnrenderableComponent[]): string {
  const types = Array.from(new Set(found.map((f) => f.type))).join(', ');
  const pages = Array.from(new Set(found.map((f) => f.pageName))).join(', ');
  return (
    `Udgivelsen blev stoppet: sektionstypen ${types} kan ikke vises på det udgivne website ` +
    `(fundet på ${pages}). Websitet ville se anderledes ud end i editoren.`
  );
}
