import { expect, it } from 'vitest';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sofieReferenceSite } from './fixtures/sofieSite';
import { generatePublishedPreview } from '../server/publisher/generatedPreview';

const executablePath = process.env.BIRDFLOW_TEST_CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);

it.skipIf(!executablePath)('edits through the real custom fields UI, saves/reloads locally, undoes and renders the edited publication', async () => {
  const initial = sofieReferenceSite();
  const result = await build({
    stdin: { loader: 'tsx', resolveDir: resolve('.'), contents: `
      import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
      import Panel from './client/src/components/builder/SemanticFieldsPanel';
      import Renderer from './client/src/components/builder/CustomComponentRenderer';
      import {createHistory,pushHistory,undo} from './shared/builderHistory';
      const initial = ${JSON.stringify(initial)};
      const load = () => JSON.parse(localStorage.getItem('sofie-editor') || JSON.stringify(initial));
      function App(){
        const [state,setState] = useState(load); const [history,setHistory] = useState(()=>createHistory(load()));
        window.savedEditorState = () => state;
        const component = state.pages[0].components[0];
        const update = updates => {
          const next = structuredClone(state);
          next.pages[0].components[0].props = {...component.props,...updates.props};
          setHistory(pushHistory(history,next,'Owner edit')); setState(next);
        };
        return <><button id="save" onClick={()=>localStorage.setItem('sofie-editor',JSON.stringify(state))}>Save</button>
          <button id="undo" onClick={()=>{const result=undo(history);setHistory(result.history);if(result.state)setState(result.state)}}>Undo</button>
          <Panel tree={component.props.customTree} schema={component.props.customSchema} onUpdate={update} websiteId="fictional-sofie" accessToken="" globalStyles={state.globalStyles}/>
          <div id="canvas"><Renderer component={component} isPreview globalStyles={state.globalStyles}/></div></>;
      }
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' },
  });
  const editorHtml = '<html><body><div id="root"></div><script>' + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
  let publishedHtml = '';
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request', request => request.isNavigationRequest()
      ? request.respond({ contentType: 'text/html', body: request.url().endsWith('/published') ? publishedHtml : editorHtml })
      : request.abort());
    await page.goto('http://editor.test');
    const setField = async (id: string, value: string) => {
      await page.waitForSelector('[data-testid="' + id + '"]');
      await page.evaluate((id, value) => {
        const field = document.querySelector('[data-testid="' + id + '"]') as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
        field.dispatchEvent(new Event('input', { bubbles: true }));
      }, id, value);
    };
    const title = 'En samtale med plads til dig.';
    await setField('semantic-field-n-hero-title', title);
    await page.waitForFunction(title => document.querySelector('#canvas h1')?.textContent === title, {}, title);
    await page.click('#undo');
    await page.waitForFunction(() => document.querySelector('#canvas h1')?.textContent === 'Plads til det, der fylder.');
    await setField('semantic-field-n-hero-title', title);
    await setField('semantic-field-n-hero-book-link', '/kontakt');
    await setField('semantic-field-n-hero-portrait-alt', 'Portræt til den fiktive Sofie-praksis');
    await page.select('[data-testid="semantic-style-device"]', 'mobileStyles');
    await setField('semantic-field-n-hero-portrait-focus-0', '30');
    await setField('semantic-field-n-hero-portrait-focus-1', '25');
    await setField('semantic-style-section-spacing-padding', '40px 18px');
    await page.click('#save');
    await page.reload();
    await page.waitForFunction(title => document.querySelector('#canvas h1')?.textContent === title, {}, title);
    const edited = await page.evaluate(() => (window as any).savedEditorState());
    expect(edited.pages.slice(1)).toEqual(initial.pages.slice(1));
    publishedHtml = (await generatePublishedPreview({ state: edited, websiteId: 'fictional-sofie', revision: 8, language: 'da' })).html;
    await page.setViewport({ width: 390, height: 844 });
    await page.goto('http://editor.test/published');
    await page.waitForFunction(title => document.querySelector('h1')?.textContent === title, {}, title);
    expect(await page.$('a[href="/kontakt"]')).not.toBeNull();
    expect(await page.$('img[alt="Portræt til den fiktive Sofie-praksis"]')).not.toBeNull();
    expect(await page.$eval('img[alt="Portræt til den fiktive Sofie-praksis"]', node => getComputedStyle(node).objectPosition)).toBe('30% 25%');
    await page.setViewport({ width: 1440, height: 900 });
    expect(await page.$eval('img[alt="Portræt til den fiktive Sofie-praksis"]', node => getComputedStyle(node).objectPosition)).not.toBe('30% 25%');
    expect(errors).toEqual([]);
  } finally { await browser.close(); }
}, 60_000);
