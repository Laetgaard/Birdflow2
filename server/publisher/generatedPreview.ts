import type { BuilderStateData } from '@shared/schema';
import { migrateSiteStructure, composePageComponents, resolveNavItems } from '@shared/siteStructure';
import { googleFontsHref } from '@shared/fonts';
import { onboardingStateFingerprint } from '../onboardingQuality';
import { preparePublishedState } from './prepareState';
import { bundlePreviewModules } from './previewBundle';
import { generateBookingForm, generateComponentRenderer, generateContactForm, generateGlobalsCss, generatePageFile, generateTrustedRuntime } from './templates';

/** Runs actual emitted pages/renderer with read-only platform adapters.
 * This previews rendering, not deployment, checkout, email or reservation. */
export async function generatePublishedPreview(args: { state: BuilderStateData; websiteId: string; revision: number; language: 'da' | 'en'; fingerprint?: string }) {
  const { state, theme } = preparePublishedState(migrateSiteStructure(args.state));
  const pages = state.pages.map(page => ({ ...page, components: composePageComponents(page, state.siteChrome) }));
  if (!pages.length) throw new Error('No pages to preview');
  if (pages.some(page => page.components.some(component => ['product-grid', 'product-detail'].includes(component.type)))) {
    throw new Error('Generated preview for product pages is not available in this pilot. Use the builder preview.');
  }
  const navItems = resolveNavItems(state);
  const modules: Record<string, string> = {
    '@/components/ComponentRenderer': generateComponentRenderer(args.language),
    '@/components/BookingForm': generateBookingForm(args.language),
    '@/components/ContactForm': generateContactForm(args.language),
    '@/components/trustedRuntime': generateTrustedRuntime(),
    '@/theme.json': 'export default ' + JSON.stringify(theme),
    '@/components/WebsiteProvider': 'export const useWebsite = () => ({websiteId:' + JSON.stringify(args.websiteId) + '});',
    '@/components/CartProvider': 'export const useCart = () => ({items:[],addItem:()=>{throw new Error("Checkout unavailable in preview")}});',
    '@/components/ProductGrid': 'export default function ProductGrid(){throw new Error("Product preview unavailable")}',
  };
  pages.forEach((page, index) => {
    modules['#page' + index] = generatePageFile(page as never, args.websiteId, pages, { navItems });
  });
  const identity = { websiteId: args.websiteId, revision: args.revision, fingerprint: args.fingerprint ?? onboardingStateFingerprint(args.state) };
  const entry = `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    ${pages.map((_, index) => 'import Page' + index + ' from "#page' + index + '";').join('\n')}
    const identity = ${JSON.stringify(identity)};
    const pages = ${JSON.stringify(pages.map(page => ({ id: page.id, name: page.name, path: page.path })))};
    const views = [${pages.map((_, index) => 'Page' + index).join(',')}];
    const previewOrigin = new URL(document.baseURI).origin;
    const send = data => window.parent.postMessage({...identity,...data}, previewOrigin === 'null' ? '*' : previewOrigin);
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const url = new URL(input instanceof Request ? input.url : String(input), document.baseURI);
      if (method === 'POST' && ['/api/bookings','/api/form-submissions'].includes(url.pathname)) {
        // Show the real confirmation design without issuing a network write.
        return new Response(JSON.stringify({id:'preview-only',success:true,preview:true}), {status:200,headers:{'Content-Type':'application/json'}});
      }
      if (method !== 'GET') throw new Error('Preview cannot submit a booking, form or payment.');
      const allowed = ['/api/booking-services','/api/team-members','/api/slots'];
      if (!allowed.includes(url.pathname)) throw new Error('Data unavailable in this preview');
      return originalFetch('/api/public/websites/' + encodeURIComponent(identity.websiteId) + url.pathname.slice(4) + url.search, {signal:init.signal});
    };
    const root = createRoot(document.getElementById('root'));
    let active = 0;
    const show = index => { active=index; root.render(React.createElement(views[index])); window.scrollTo(0,0); send({type:'bf-preview-page',pageId:pages[index].id}); };
    window.addEventListener('message', event => {
      if (event.source !== window.parent || (previewOrigin !== 'null' && event.origin !== previewOrigin) || event.data?.type !== 'bf-preview') return;
      const index = pages.findIndex(page => page.id === event.data.pageId); if(index >= 0) show(index);
    });
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a'); if(!link) return;
      const href = link.getAttribute('href') || '';
      if(href.startsWith('#')) return;
      event.preventDefault(); event.stopPropagation();
      const url = new URL(href, 'https://preview.invalid');
      const index = url.origin === 'https://preview.invalid' ? pages.findIndex(page => page.path === url.pathname) : -1;
      if(index >= 0) { show(index); if(url.hash) setTimeout(()=>document.getElementById(url.hash.slice(1))?.scrollIntoView(),0); }
    }, true);
    window.addEventListener('error', () => send({type:'bf-preview-render-diagnostics',degraded:true}));
    show(0); send({type:'bf-preview-ready'}); send({type:'bf-preview-pages',pages});
  `;
  const script = await bundlePreviewModules(modules, entry);
  // Escape closing tags even when supplied copy contains script/style-looking text.
  const html = '<!doctype html><html lang="' + args.language + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39; https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: data: blob: &#39;self&#39;; connect-src &#39;self&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">' +
    '<link rel="stylesheet" href="' + googleFontsHref().replaceAll('&', '&amp;') + '"><style>' + generateGlobalsCss(theme).replaceAll('<', '\\3c ') + '</style></head><body><div id="root"></div><script>' + script.replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
  return { html, ...identity, mode: 'generated_read_only' as const };
}
