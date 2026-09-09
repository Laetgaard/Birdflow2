import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generatePublishedPreview } from '../server/publisher/generatedPreview';
import { sofieReferenceSite } from './fixtures/sofieSite';

const executablePath = process.env.BIRDFLOW_TEST_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);

describe.skipIf(!executablePath)('actual emitted Sofie preview', () => {
  let browser: Browser;
  let page: Page;
  let html: string;
  const errors: string[] = [];
  const requests: Array<{ url: string; method: string }> = [];
  beforeAll(async () => {
    const preview = await generatePublishedPreview({ state: sofieReferenceSite(), websiteId: 'fictional-sofie', revision: 7, language: 'da' });
    html = preview.html;
    const artifactDir = resolve('../milestone-a-reference');
    await mkdir(artifactDir, { recursive: true });
    await writeFile(resolve(artifactDir, 'published-preview.html'), html);
    await writeFile(resolve(artifactDir, 'state.json'), JSON.stringify(sofieReferenceSite(), null, 2));
    browser = await puppeteer.launch({ executablePath, headless: true });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request', async request => {
      const url = new URL(request.url());
      requests.push({ url: request.url(), method: request.method() });
      if (url.hostname === 'birdflow.test' && request.isNavigationRequest()) return request.respond({ contentType: 'text/html', body: html });
      if (url.pathname.endsWith('/qa-therapist-hero.jpg')) return request.respond({ contentType: 'image/jpeg', body: await readFile(resolve('attached_assets/generated_images/qa-therapist-hero.jpg')) });
      if (url.pathname.endsWith('/booking-services')) return request.respond({ contentType: 'application/json', body: JSON.stringify([{ id: 'intro', name: 'Indledende samtale', duration_minutes: 25, price: '550', currency: 'DKK' }]) });
      if (url.pathname.endsWith('/team-members') || url.pathname.endsWith('/slots')) return request.respond({ contentType: 'application/json', body: '[]' });
      // Repeatable layout check uses fallback fonts, records no external fetches.
      return request.abort();
    });
    await page.goto('http://birdflow.test', { waitUntil: 'networkidle0' });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  it.each([320, 390, 768, 1024, 1440])('renders every planned page without horizontal overflow at %spx', async width => {
    await page.setViewport({ width, height: 1000 });
    for (const id of ['home', 'about', 'services', 'contact']) {
      await page.evaluate(pageId => window.postMessage({ type: 'bf-preview', pageId }, window.location.origin), id);
      const expected = { home: 'Plads til det', about: 'Et menneske', services: 'Samtaler i dit tempo', contact: 'Tag det første skridt' }[id]!;
      await page.waitForFunction(expected => document.querySelector('h1')?.textContent?.includes(expected), {}, expected);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), id).toBe(true);
      expect(await page.$$eval('h1', nodes => nodes.length)).toBe(1);
      if (id === 'home' && [390, 768, 1440].includes(width)) await page.screenshot({ path: resolve('../milestone-a-reference/home-' + width + '.png'), fullPage: true });
    }
    expect(errors).toEqual([]);
  });

  it('uses native navigation and refuses actual booking or form submissions', async () => {
    await page.evaluate(() => window.postMessage({ type: 'bf-preview', pageId: 'home' }, window.location.origin));
    await page.waitForSelector('a[href="/samtaler"]');
    await page.$eval('a[href="/samtaler"]', element => (element as HTMLElement).click());
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Samtaler i dit tempo.');
    const result = await page.evaluate(async () => {
      try { const response = await fetch('/api/bookings', { method: 'POST', body: '{}' }); return (await response.json()).id; }
      catch { return 'blocked'; }
    });
    expect(result).toBe('preview-only');
    expect(requests.filter(request => request.method !== 'GET')).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('works in the actual sandboxed srcdoc host, including booking reads and parent page selection', async () => {
    await page.evaluate(html => {
      document.body.innerHTML = '';
      const frame = document.createElement('iframe');
      frame.id = 'published-frame';
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      frame.srcdoc = html;
      document.body.appendChild(frame);
    }, html);
    const element = await page.waitForSelector('#published-frame');
    const child = await element!.contentFrame();
    await child!.waitForSelector('h1');
    await page.evaluate(() => (document.querySelector('iframe') as HTMLIFrameElement).contentWindow!.postMessage({ type: 'bf-preview', pageId: 'contact' }, window.location.origin));
    await child!.waitForFunction(() => document.querySelector('h1')?.textContent === 'Tag det første skridt.');
    await child!.waitForFunction(() => document.body.textContent?.includes('Indledende samtale'));
    expect(requests.some(request => request.url.includes('/api/public/websites/fictional-sofie/booking-services'))).toBe(true);
    expect(requests.filter(request => request.method !== 'GET')).toEqual([]);
  });
});
