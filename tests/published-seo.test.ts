/**
 * What a published site tells search engines about itself.
 *
 * A local practice is found or not found on the strength of this: whether its
 * pages are listed at all, and whether its phone number, address and opening
 * hours are machine-readable. None of it existed before, so every published
 * site was a set of pages with no sitemap, no robots file and no structured
 * data.
 */

import { describe, expect, it } from 'vitest';
import {
  generateBusinessJsonLd,
  generateMonogramIcon,
  generateRobots,
  generateSitemap,
} from '../server/publisher/templates';
import type { BusinessContext } from '../shared/businessContext';

const pages = [
  { id: '1', name: 'Forside', path: '/' },
  { id: '2', name: 'Om mig', path: '/om-mig' },
  { id: '3', name: 'Kladde', path: '/kladde', hidden: true },
];

describe('sitemap', () => {
  it('lists the pages a visitor can reach', () => {
    const source = generateSitemap(pages);
    expect(source).toContain('"/"');
    expect(source).toContain('"/om-mig"');
  });

  it('leaves out pages hidden from the site itself', () => {
    expect(generateSitemap(pages)).not.toContain('/kladde');
  });

  it('resolves its own base URL rather than hard-coding one', () => {
    const source = generateSitemap(pages);
    expect(source).toContain('NEXT_PUBLIC_SITE_URL');
    expect(source).toContain('VERCEL_PROJECT_PRODUCTION_URL');
  });
});

describe('robots', () => {
  it('allows crawling and points at the sitemap', () => {
    const source = generateRobots();
    expect(source).toContain("allow: '/'");
    expect(source).toContain('/sitemap.xml');
  });
});

describe('business structured data', () => {
  const contact: BusinessContext = {
    businessName: 'Klinik for Trivsel',
    location: 'Aarhus C',
    services: ['Individuel terapi', 'Parterapi'],
    contact: {
      phone: '+45 31 24 56 78',
      email: 'kontakt@klinik.dk',
      streetAddress: 'Storegade 12',
      postalCode: '8000',
      city: 'Aarhus C',
      openingHours: 'man-tors 9-17',
      cvr: '12345678',
    },
  };

  it('marks the business up as something a search engine shows locally', () => {
    const data = JSON.parse(generateBusinessJsonLd('Site', contact));
    expect(data['@type']).toBe('ProfessionalService');
    expect(data.name).toBe('Klinik for Trivsel');
    expect(data.telephone).toBe('+45 31 24 56 78');
    expect(data.address).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Storegade 12',
      postalCode: '8000',
      addressLocality: 'Aarhus C',
    });
    expect(data.openingHours).toBe('man-tors 9-17');
    expect(data.makesOffer).toHaveLength(2);
  });

  it('leaves out what the customer never entered rather than guessing', () => {
    const data = JSON.parse(
      generateBusinessJsonLd('Site', { businessName: 'Klinik', contact: { phone: '12345678' } })
    );
    expect(data.telephone).toBe('12345678');
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('openingHours');
    expect(data).not.toHaveProperty('email');
  });

  it('emits nothing at all when there is only a name', () => {
    expect(generateBusinessJsonLd('Site', { businessName: 'Klinik' })).toBe('');
    expect(generateBusinessJsonLd('Site', undefined)).toBe('');
  });

  it('falls back to the site name when the business has none', () => {
    const data = JSON.parse(generateBusinessJsonLd('Psykolog Amalie', { contact: { phone: '1' } }));
    expect(data.name).toBe('Psykolog Amalie');
  });
});

describe('fallback icon', () => {
  it('draws the initial on the brand colour', () => {
    const svg = generateMonogramIcon('Klinik for Trivsel', '#4f46e5');
    expect(svg).toContain('fill="#4f46e5"');
    expect(svg).toContain('>K</text>');
  });

  it('escapes a name that would otherwise break the SVG', () => {
    expect(generateMonogramIcon('<script>', '#000')).not.toContain('<script>');
  });
});
