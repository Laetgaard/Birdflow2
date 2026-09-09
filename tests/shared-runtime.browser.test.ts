import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as esbuild from 'esbuild';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateBookingForm, generateTrustedRuntime } from '../server/publisher/templates';

// CI can supply BIRDFLOW_TEST_CHROME. Local checks also use an installed
// browser, without downloads, a database, live accounts or paid AI calls.
const executablePath = process.env.BIRDFLOW_TEST_CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);

describe.skipIf(!executablePath)('trusted runtime browser contract', () => {
  let browser: Browser;
  let page: Page;
  let bundle: string;
  const errors: string[] = [];
  beforeAll(async () => {
    const result = await esbuild.build({
      stdin: { contents: `
        import React from 'react';
        import {createRoot} from 'react-dom/client';
        import BookingWidget from './client/src/components/builder/BookingWidget';
        import PublishedBooking from '#published';
        import {createBehaviorRuntime} from '#runtime';
        const Behavior = createBehaviorRuntime(React);
        const root = createRoot(document.getElementById('root'));
        const services = [{id:'therapy', name:'Individual therapy', price:'1200', currency:'DKK', durationMinutes:50}];
        const members = [{id:'anna',name:'Fictional Anna',serviceIds:['therapy']}, {id:'bo',name:'Fictional Bo',serviceIds:['therapy']}];
        window.requests = [];
        window.fetch = async (url, options = {}) => {
          window.requests.push({url:String(url), method:options.method || 'GET', body:options.body});
          const data = String(url).includes('booking-services') ? services : String(url).includes('team-members') ? members : String(url).includes('slots') ? [{time:'09:00',available:true,openSlotId:'slot-1',teamMemberId:'anna'}, {time:'10:00',available:false}] : {id:'test-booking'};
          return {ok:true, status:200, json: async () => data};
        };
        let revision = 0;
        window.mountBooking = (host, language='en', appearance={}) => {
          window.requests = [];
          const props = {title:'A calm first step', description:'Choose a conversation at your own pace.', ...appearance};
          const styles = {accentColor:'#375d52', backgroundColor:'#f5f2eb',textColor:'#253c35',fontFamily:'Arial',padding:'24px'};
          root.render(host === 'builder' ? <BookingWidget key={++revision} websiteId="fixture-site" isPreview language={language} props={props} styles={styles}/> : <PublishedBooking key={++revision} props={props} styles={styles}/>);
        };
        window.mountBehavior = (type, editing=false) => root.render(<Behavior key={++revision} editing={editing} language="en" node={{id:'behavior',name:'Care options',type:'box',behavior:{type},children:[{id:'a',type:'text',name:'First',text:'First panel'}, {id:'b',type:'text',name:'Second',text:'Second panel'}]}} renderChild={child=><p>{child.text}</p>}/>);
      `, resolveDir: resolve('.'), loader: 'tsx' },
      write: false, bundle: true, platform: 'browser', format: 'iife', minify: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{ name: 'generated-booking-fixture', setup(build) {
        build.onResolve({ filter: /^(#published|#runtime|@\/components\/(trustedRuntime|WebsiteProvider))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: args.path === '#published' ? generateBookingForm('en') : args.path.endsWith('WebsiteProvider') ? 'export const useWebsite = () => ({websiteId:"fixture-site"});' : generateTrustedRuntime(),
          loader: 'tsx', resolveDir: resolve('.'),
        }));
      } }],
    });
    bundle = result.outputFiles[0].text;
    browser = await puppeteer.launch({ executablePath, headless: true });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    await page.setContent('<html><head><style>body{margin:0;font-family:Arial}*{box-sizing:border-box}button,input,textarea,select{font:inherit}</style></head><body><div id="root"></div></body></html>');
    await page.addScriptTag({ content: bundle });
  }, 30000);
  afterAll(async () => { await browser?.close(); });

  const clickText = async (text: string) => {
    await page.evaluate(text => {
      const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(text));
      if (!button || button.disabled) throw new Error(`Button unavailable: ${text}`);
      button.click();
    }, text);
  };
  const mount = async (host: string, props = {}) => {
    await page.evaluate((host, props) => (window as any).mountBooking(host, 'en', props), host, props);
    await page.waitForFunction(() => !!document.querySelector('button[aria-pressed="false"]'));
  };

  it.each([320, 390, 768, 1440])('matches booking pixels at %spx without horizontal overflow', async width => {
    await page.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await mount('builder', {variant:'compact'});
    const builder = await page.screenshot();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await mount('published', {variant:'compact'});
    expect(Buffer.from(await page.screenshot()).equals(Buffer.from(builder))).toBe(true);
  });

  it.each(['builder', 'published'])('%s completes the flow and resets without stale state', async host => {
    await page.setViewport({ width: 390, height: 1000 });
    await mount(host, {displayMode:'list'});
    await clickText('Individual therapy');
    await page.waitForSelector('select');
    await page.select('select', 'anna');
    await clickText('Continue');
    await page.waitForSelector('input[type=date]');
    await page.evaluate(() => {
      const input = document.querySelector('input[type=date]') as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '2028-02-29');
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some(button => button.textContent === '09:00'));
    await clickText('09:00');
    await clickText('Continue');
    await page.waitForSelector('input[name=name]');
    await page.type('input[name=name]', 'Fictional Test');
    await page.type('input[name=email]', 'fixture@example.com');
    await clickText('Confirm booking');
    await page.waitForFunction(() => document.body.textContent?.includes('Your booking is confirmed'));
    const posts = await page.evaluate(() => (window as any).requests.filter((r: any) => r.method === 'POST'));
    if (host === 'builder') expect(posts).toHaveLength(0);
    else {
      expect(posts).toHaveLength(1);
      expect(JSON.parse(posts[0].body)).toMatchObject({ date:'2028-02-29T00:00:00.000Z',time:'09:00',team_member_id:'anna',open_slot_id:'slot-1' });
    }
    await clickText('Make another booking');
    await page.waitForFunction(() => document.querySelector('[aria-label="Booking steps"] [aria-current="step"]')?.textContent === '1. Service');
    expect(errors).toEqual([]);
  });

  it('shows the configured heading and supports keyboard tab navigation', async () => {
    await mount('builder', {headingVisible:false});
    expect(await page.$('h2')).toBeNull();
    await page.evaluate(() => (window as any).mountBehavior('tabs'));
    await page.waitForSelector('[role=tab]');
    await page.focus('[role=tab]');
    await page.keyboard.press('End');
    expect(await page.$eval('[role=tab][aria-selected=true]', el => el.textContent)).toBe('Second');
    expect(await page.$$eval('[role=tabpanel]', nodes => nodes.map(node => (node as HTMLElement).hidden))).toEqual([true,false]);
  });

  it('accordion interactions work while edit mode exposes every child', async () => {
    await page.evaluate(() => (window as any).mountBehavior('accordion'));
    await page.waitForSelector('[aria-expanded]');
    await clickText('Second');
    expect(await page.$$eval('[role=region]', nodes => nodes.map(node => (node as HTMLElement).hidden))).toEqual([true,false]);
    await page.evaluate(() => (window as any).mountBehavior('accordion', true));
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[role=region]')).every(node => !(node as HTMLElement).hidden));
    expect(errors).toEqual([]);
  });
});
