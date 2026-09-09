import type { BuilderStateData } from '../../shared/schema';
import type { BuilderComponentData } from '../../shared/componentRegistry';
import { createDefaultBrandGuide, inferEditableSchema, type PrimitiveNode } from '../../shared/customComponents';
import { migrateSiteStructure } from '../../shared/siteStructure';
import { prepareWebsiteBrief } from '../../server/websiteBrief';
import { SOFIE_INPUT, sofieContext } from './sofiePractice';

const text = (id: string, value: string, tag: PrimitiveNode['tag'] = 'p'): PrimitiveNode => ({
  id, type: 'text', text: value, tag, styles: { fontSize: tag === 'h1' ? '64px' : tag === 'h2' ? '38px' : tag === 'h3' ? '24px' : '18px', lineHeight: tag?.startsWith('h') ? '1.15' : '1.7', maxWidth: '680px', fontFamily: tag?.startsWith('h') ? 'Lora, Georgia, serif' : 'Inter, Arial, sans-serif' },
  mobileStyles: { fontSize: tag === 'h1' ? '38px' : tag === 'h2' ? '30px' : tag === 'h3' ? '22px' : '17px' },
});
const box = (id: string, children: PrimitiveNode[], extra: Partial<PrimitiveNode> = {}): PrimitiveNode => ({
  id, type: 'box', children, styles: { display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '0' }, ...extra,
});
const button = (id: string, label: string, href: string): PrimitiveNode => ({
  id, type: 'button', label, href, variant: 'primary', styles: { backgroundColor: '{color.primary}', color: '#ffffff', padding: '16px 24px', borderRadius: '6px', alignSelf: 'flex-start', fontSize: '16px' },
});
function section(id: string, children: PrimitiveNode[], background = '{color.background}'): BuilderComponentData {
  const tree = box(id + '-root', [box(id + '-inner', children, { styles: { display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '1120px', width: '100%', margin: '0 auto' } })], {
    styles: { backgroundColor: background, color: '{color.text}', padding: '88px 40px' },
    tabletStyles: { padding: '64px 28px' }, mobileStyles: { padding: '48px 20px' },
  });
  const schema = inferEditableSchema(tree);
  schema.fields.push({ key: 'section-spacing', label: 'Afstande', type: 'styleGroup', nodeId: tree.id, keys: ['padding', 'gap'] });
  return { id, type: 'custom', props: { customTree: tree, customSchema: schema, customName: id }, styles: { padding: '0', fontFamily: 'Inter' } };
}

/** Hand-authored reference fixture, NOT evidence of successful AI generation. */
export function sofieReferenceSite(): BuilderStateData {
  const context = sofieContext();
  const hero = section('sofie-hero', [
    box('hero-grid', [
      box('hero-copy', [
        text('hero-eyebrow', 'SOFIE LUND · PSYKOLOG I KØBENHAVN', 'span'),
        text('hero-title', 'Plads til det, der fylder.', 'h1'),
        text('hero-copy-text', 'Samtaler for voksne med angst og stress. Et sted at begynde, når du ønsker at sætte ord på det svære — i København eller online.'),
        button('hero-book', 'Se samtaler og priser', '/samtaler'),
      ]),
      { id: 'hero-portrait', type: 'image', src: SOFIE_INPUT.ownImageUrls[0], alt: 'Illustrativt portræt til den fiktive testpraksis', styles: { width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: '120px 120px 8px 8px' } },
    ], { styles: { display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', alignItems: 'center', gap: '64px' }, tabletStyles: { gap: '32px' }, mobileStyles: { gridTemplateColumns: '1fr', gap: '32px' } }),
  ]);
  const first = section('first-conversation', [
    text('first-label', 'ET ENKELT FØRSTE SKRIDT', 'span'),
    text('first-title', 'Du behøver ikke have de rigtige ord.', 'h2'),
    text('first-intro', 'En indledende samtale giver plads til at fortælle, hvad der fylder, og stille spørgsmål. Her kan du få et første indtryk, før du vælger, om du vil fortsætte.'),
    box('first-cards', [
      box('first-one', [text('first-one-title', 'Det, der fylder', 'h3'), text('first-one-text', 'Tag udgangspunkt i det, du har lyst til at tale om. Du kan begynde med en situation fra din hverdag.')]),
      box('first-two', [text('first-two-title', 'Dine spørgsmål', 'h3'), text('first-two-text', 'Der er plads til spørgsmål om samtalerne og om forskellen på at mødes fysisk eller online.')]),
      box('first-three', [text('first-three-title', 'Et næste skridt', 'h3'), text('first-three-text', 'Se mulighederne og priserne, og overvej hvilken samtale der passer til det, du søger.')]),
    ], { styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '36px' }, tabletStyles: { gap: '24px' }, mobileStyles: { gridTemplateColumns: '1fr' } }),
    button('first-link', 'Læs om den første samtale', '/om'),
  ], '#eee9df');
  const about = section('about', [text('about-title', 'Et menneske at tale med.', 'h1'), text('about-copy', SOFIE_INPUT.business.description), text('about-more', 'På denne hjemmeside kan du læse om samtalemuligheder og priser. Har du spørgsmål, før du tager det første skridt, kan du skrive til Sofie.')]);
  const practical = section('practical', [text('practical-title', 'Fysisk eller online', 'h2'), text('practical-copy', 'Du kan vælge en individuel samtale i København eller en online samtale. Den præcise adresse og de ledige tider bliver oplyst, når praksissens booking er klar.'), button('practical-link', 'Se kontaktmuligheder', '/kontakt')], '#eee9df');
  const services = section('services', [
    text('services-title', 'Samtaler i dit tempo.', 'h1'),
    text('services-intro', 'Vælg mellem en individuel samtale, en online samtale og en kortere indledende samtale. Nedenfor kan du se varighed og pris for hver mulighed.'),
    box('service-cards', SOFIE_INPUT.practice!.services!.map(service => box('service-' + service.key, [
      text(service.key + '-name', service.name, 'h3'),
      text(service.key + '-details', service.durationMinutes + ' minutter · ' + service.priceMinor! / 100 + ' kr.'),
      button(service.key + '-book', 'Se booking', '/kontakt'),
    ])), { styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }, mobileStyles: { gridTemplateColumns: '1fr' } }),
  ]);
  const choice = section('choice', [text('choice-title', 'I tvivl om, hvor du skal begynde?', 'h2'), text('choice-copy', 'Du kan skrive med spørgsmål om de praktiske rammer eller vælge en indledende samtale. Der er ingen forventning om, at du på forhånd ved, hvordan du vil beskrive det, der fylder.'), button('choice-contact', 'Kontakt Sofie', '/kontakt')], '#eee9df');
  const contact = section('contact', [text('contact-title', 'Tag det første skridt.', 'h1'), text('contact-copy', 'Skriv til sofie@example.com med praktiske spørgsmål om samtalerne. Undlad at sende følsomme oplysninger via almindelig mail. Adresse og åbningstider mangler endnu i denne fiktive testpraksis.'), button('contact-email', 'Skriv til Sofie', 'mailto:sofie@example.com')]);
  const booking: BuilderComponentData = { id: 'native-booking', type: 'booking', props: { title: 'Find en samtale', description: 'Bookingopsætning mangler. Testvisningen opretter ingen reservationer.', variant: 'compact' }, styles: { accentColor: '#35594e', textColor: '#25342f', backgroundColor: '#eee9df', padding: '48px 20px' } };
  const state: BuilderStateData = {
    activePage: 'home',
    businessContext: context, websiteBrief: prepareWebsiteBrief(SOFIE_INPUT, context),
    brandGuide: { ...createDefaultBrandGuide(), businessName: 'Sofie Lund', colors: SOFIE_INPUT.palette.colors, typography: { ...createDefaultBrandGuide().typography, headingFont: 'Lora', bodyFont: 'Inter' } },
    globalStyles: { primaryColor: '#35594e', secondaryColor: '#b88e71', backgroundColor: '#f8f5ef', textColor: '#25342f', fontFamily: 'Inter', fontPair: { heading: 'Lora', body: 'Inter' } },
    pages: [
      { id: 'home', name: 'Forside', path: '/', components: [
        { id: 'site-header', type: 'header', props: { title: 'Sofie Lund', showCart: false }, styles: { backgroundColor: '#f8f5ef', textColor: '#25342f', padding: '0' } },
        hero, first,
        { id: 'site-footer', type: 'footer', props: { title: 'Sofie Lund · København', description: 'Fiktiv testpraksis — ikke en rigtig behandlerhjemmeside.' }, styles: { backgroundColor: '#25342f', textColor: '#ffffff', padding: '0' } },
      ] },
      { id: 'about', name: 'Om samtalerne', path: '/om', components: [about, practical] },
      { id: 'services', name: 'Samtaler og priser', path: '/samtaler', components: [services, choice] },
      { id: 'contact', name: 'Kontakt og booking', path: '/kontakt', components: [contact, booking] },
    ],
  };
  return migrateSiteStructure(state);
}
