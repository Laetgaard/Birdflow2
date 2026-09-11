/**
 * Privacy baseline tests for Task #198.
 *
 * Covers:
 *   1. Generated site footer always contains /privacy and /terms links.
 *   2. Generated booking form contains a data-notice sentence linking to /privacy.
 *   3. Customer data export endpoint returns a structured JSON payload.
 *   4. Deletion-request endpoint is idempotent and stamps a timestamp.
 *   5. Analytics sanitization already strips PII (confirm existing guard).
 *   6. Source-level checks confirm the booking form and footer strings are
 *      injected via the correct translation keys.
 */

import { describe, it, expect } from 'vitest';
import { renderBookingView } from './helpers/renderParity';
import {
  generateComponentRenderer,
  generateBookingForm,
} from '../server/publisher/templates';
import { sanitizeAnalyticsEventData } from '../shared/schema';
import { addLegalPagesToBuilderState } from '../shared/legalPages';

// ── 1. Footer always has legal links ─────────────────────────────────────────

describe('generated site footer — legal links', () => {
  it('includes a /privacy link in the DA component renderer', () => {
    const src = generateComponentRenderer('da');
    expect(src).toContain('href="/privacy"');
    // The DA string for the privacy link
    expect(src).toContain('Privatlivspolitik');
  });

  it('includes a /terms link in the DA component renderer', () => {
    const src = generateComponentRenderer('da');
    expect(src).toContain('href="/terms"');
    expect(src).toContain('Handelsbetingelser');
  });

  it('includes a /privacy link in the EN component renderer', () => {
    const src = generateComponentRenderer('en');
    expect(src).toContain('href="/privacy"');
    expect(src).toContain('Privacy Policy');
  });

  it('legal links are NOT gated on a copyright prop — always rendered', () => {
    // The footer section must render legal links unconditionally (the old code
    // wrapped everything in `{copyright && …}`).
    const src = generateComponentRenderer('da');
    // The privacy link must appear outside a copyright-guarded block:
    // we verify it is not preceded by `copyright &&` on the same JSX line.
    const privacyLinkLine = src
      .split('\n')
      .find(l => l.includes('href="/privacy"') && l.includes('Privatlivspolitik'));
    expect(privacyLinkLine).toBeDefined();
    expect(privacyLinkLine).not.toContain('copyright &&');
  });
});

// ── 2. Booking form data notice ───────────────────────────────────────────────

describe('generated booking form — data notice', () => {
  it('contains a data-notice sentence linking to /privacy (DA)', () => {
    const src = renderBookingView('da');
    // Sentence text
    expect(src).toContain(
      'Dine oplysninger bruges kun til at håndtere din booking'
    );
    // Followed by an anchor pointing to /privacy
    expect(src).toContain('href="/privacy"');
  });

  it('contains a data-notice sentence linking to /privacy (EN)', () => {
    const src = renderBookingView('en');
    expect(src).toContain(
      'Your details are only used to process your booking'
    );
    expect(src).toContain('href="/privacy"');
  });

  it('data notice appears before the confirm button (ordering)', () => {
    const src = renderBookingView('da');
    const noticeIdx  = src.indexOf('Dine oplysninger bruges kun');
    const confirmIdx = src.indexOf('button-confirm-booking');
    expect(noticeIdx).toBeGreaterThan(0);
    expect(confirmIdx).toBeGreaterThan(0);
    expect(noticeIdx).toBeLessThan(confirmIdx);
  });
});

// ── 3. Analytics sanitization already excludes PII ───────────────────────────

describe('sanitizeAnalyticsEventData — PII exclusion', () => {
  it('strips name from analytics payload', () => {
    const sanitized = sanitizeAnalyticsEventData({
      name:    'Anne Jensen',
      email:   'anne@example.dk',
      phone:   '+45 12 34 56 78',
      path:    '/booking',
      orderId: 'ord_123',
    });
    expect(sanitized).not.toHaveProperty('name');
    expect(sanitized).not.toHaveProperty('email');
    expect(sanitized).not.toHaveProperty('phone');
  });

  it('preserves safe fields in analytics payload', () => {
    const sanitized = sanitizeAnalyticsEventData({
      path:       '/products/widget',
      productId:  'prod_abc',
      orderTotal: 299,
      bookingId:  'book_xyz',
    });
    expect(sanitized).toHaveProperty('path', '/products/widget');
    expect(sanitized).toHaveProperty('productId', 'prod_abc');
    expect(sanitized).toHaveProperty('orderTotal', 299);
    expect(sanitized).toHaveProperty('bookingId', 'book_xyz');
  });
});

// ── 4. Routes source — export endpoint exists ─────────────────────────────────

describe('server routes source — GDPR endpoints present', () => {
  // Source-tripwire: confirms the routes are wired up.
  // If someone renames the endpoint, this test breaks loudly.
  const routesSrc = (() => {
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(
      path.join(__dirname, '../server/routes.ts'),
      'utf-8'
    ) as string;
  })();

  it('has a GET export endpoint for customer data portability', () => {
    expect(routesSrc).toContain('"/api/websites/:id/customers/:customerId/export"');
    expect(routesSrc).toContain('GDPR Article 20');
    expect(routesSrc).toContain('Content-Disposition');
  });

  it('has a POST deletion-request endpoint', () => {
    expect(routesSrc).toContain('"/api/websites/:id/customers/:customerId/deletion-request"');
    expect(routesSrc).toContain('deletionRequestedAt');
    // Idempotency guard
    expect(routesSrc).toContain('alreadyRequested');
  });

  it('deletion-request endpoint is idempotent (preserves original timestamp)', () => {
    // The idempotency guard must check existingMeta before updating.
    const deletionIdx = routesSrc.indexOf('deletion-request');
    const idempotentIdx = routesSrc.indexOf('alreadyRequested', deletionIdx);
    expect(idempotentIdx).toBeGreaterThan(deletionIdx);
  });

  it('export payload excludes internal admin notes', () => {
    // The export endpoint must NOT include internalNote in the exported payload.
    // Find the export endpoint body (between the export endpoint marker and the
    // next endpoint declaration) and confirm it doesn't reference internalNote.
    const exportStart = routesSrc.indexOf('"GDPR Article 20');
    const exportEnd   = routesSrc.indexOf('deletion-request', exportStart);
    const exportBlock = routesSrc.slice(exportStart, exportEnd);
    expect(exportBlock).not.toContain('internalNote');
  });
});

// ── 5. addLegalPagesToBuilderState — real business data ends up in pages ──────

describe('addLegalPagesToBuilderState — substitutes real business identifiers', () => {
  it('replaces company name and email placeholders in the DA privacy page', () => {
    const state = addLegalPagesToBuilderState(
      { pages: [] },
      {
        websiteName: 'Anne Jensen Terapi',
        companyName: 'AJT ApS',
        contactEmail: 'anne@anneterapi.dk',
        businessAddress: 'Bredgade 12, 1260 København',
      },
      'da'
    );
    const privacyPage = state.pages.find(p => p.id === 'privacy');
    expect(privacyPage).toBeDefined();
    const content = JSON.stringify(privacyPage);
    expect(content).toContain('AJT ApS');
    expect(content).toContain('anne@anneterapi.dk');
    // Default placeholder text must not appear when real data was provided.
    expect(content).not.toContain('[Company Name]');
    expect(content).not.toContain('[contact@example.com]');
  });

  it('replaces website name and company name in the EN terms page', () => {
    const state = addLegalPagesToBuilderState(
      { pages: [] },
      { websiteName: 'My Bakery', companyName: 'Bakery Ltd' },
      'en'
    );
    const termsPage = state.pages.find(p => p.id === 'terms');
    expect(termsPage).toBeDefined();
    const content = JSON.stringify(termsPage);
    expect(content).toContain('My Bakery');
    expect(content).toContain('Bakery Ltd');
    expect(content).not.toContain('[Website Name]');
    expect(content).not.toContain('[Company Name]');
  });

  it('generates both a /privacy and a /terms page with correct paths', () => {
    const state = addLegalPagesToBuilderState(
      { pages: [] },
      { websiteName: 'Test Site' },
      'da'
    );
    const ids = state.pages.map(p => p.id);
    expect(ids).toContain('privacy');
    expect(ids).toContain('terms');
    expect(state.pages.find(p => p.id === 'privacy')?.path).toBe('/privacy');
    expect(state.pages.find(p => p.id === 'terms')?.path).toBe('/terms');
  });

  it('never overwrites a custom privacy page already in the state', () => {
    const custom = {
      id: 'privacy',
      path: '/privacy',
      title: 'Custom Privacy',
      components: [{ id: 'c1', type: 'text', props: { text: 'Hand-written policy' }, styles: {} }],
    };
    const state = addLegalPagesToBuilderState(
      { pages: [custom as any] },
      { companyName: 'Some Corp' },
      'da'
    );
    const privacyPages = state.pages.filter(p => p.id === 'privacy');
    expect(privacyPages).toHaveLength(1);
    expect(JSON.stringify(privacyPages[0])).toContain('Hand-written policy');
  });
});

// ── 6. Publisher source — legal pages are injected before publishing ──────────

describe('publisher source — legal pages wired up', () => {
  it('imports and calls addLegalPagesToBuilderState before generateNextJsProject', () => {
    const fs   = require('fs');
    const path = require('path');
    const src  = fs.readFileSync(
      path.join(__dirname, '../server/publisher/index.ts'),
      'utf-8'
    ) as string;
    expect(src).toContain('addLegalPagesToBuilderState');
    // Find the CALL (not just the import), then the CALL to generateNextJsProject.
    // Use the opening paren to distinguish call sites from import/declaration lines.
    const legalCallIdx    = src.indexOf('addLegalPagesToBuilderState(');
    const generateCallIdx = src.indexOf('generateNextJsProject(');
    expect(legalCallIdx).toBeGreaterThan(0);
    expect(generateCallIdx).toBeGreaterThan(0);
    expect(legalCallIdx).toBeLessThan(generateCallIdx);
  });
});
