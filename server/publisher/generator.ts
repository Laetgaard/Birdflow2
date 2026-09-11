import { preparePublishedState } from './prepareState';
import { tmpdir } from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { BuilderStateData } from '../../shared/schema';
import { sanitizeBuilderStateCustomContent } from '../../shared/customComponents';
import { resolveApprovedFontStack } from '../../shared/fonts';
import {
  composePageComponents,
  migrateSiteStructure,
  pageSeo,
  resolveNavItems,
} from '../../shared/siteStructure';
import { missingRendererCases, unrenderableComponents, describeUnrenderable } from './coverage';
import { normalizePages } from './normalize';
import { validateBuilderStateForPublish } from './validate';
import { migrateSiteStateToCurrent } from './migrations';
import { ObjectStorageService, ObjectNotFoundError } from '../replit_integrations/object_storage/objectStorage';
import {
  generatePackageJson,
  generateTsConfig,
  generateNextConfig,
  generateThemeJson,
  generateEnvExample,
  generateNvmrc,
  generateSupabaseClient,
  generateServerSupabase,
  generateWebsiteProvider,
  generateCartProvider,
  generateCartDrawer,
  generateComponentRenderer,
  generateContactForm,
  generateBookingForm,
  generateTrustedRuntime,
  generateProductGrid,
  generateProductDetailPage,
  resolveProductPageDesign,
  generateCheckoutPage,
  generateOrderApiRoute,
  generateShippingMethodsApiRoute,
  generateRootLayout,
  generateGlobalsCss,
  generatePageFile,
  generateCheckoutApiRoute,
  generateCheckoutValidateApiRoute,
  generateCheckoutConfirmApiRoute,
  generateStripeWebhookApiRoute,
  generateBookingApiRoute,
  generateBookingServicesApiRoute,
  generateFormSubmissionApiRoute,
  generateAvailabilityApiRoute,
  generateSlotsApiRoute,
  generateTeamMembersApiRoute,
  generateProductApiRoute,
  generateAnalyticsTracker,
  generateCookieBanner,
  generateSitemap,
  generateRobots,
  generateMonogramIcon,
} from './templates';
import { DEFAULT_SITE_LANGUAGE, type SiteLanguage } from '../../shared/siteLanguage';

export type GeneratorConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Immutable publish identity embedded in the artifact when called by the publisher. */
  deploymentIdentity?: {
    schemaVersion: 1;
    siteId: string;
    publishJobId: string;
    snapshotHash: string;
  };
  /** Language the published site is written in. Danish when omitted. */
  language?: SiteLanguage;
};

type ImageMapping = { originalUrl: string; newUrl: string };

const CSS_URL_REGEX = /url\(['"]?([^'")\s]+)['"]?\)/g;

function extractObjectStorageUrls(obj: any, urls: Set<string> = new Set()): Set<string> {
  if (!obj) return urls;
  
  if (typeof obj === 'string') {
    // Check for direct /objects/ URLs
    if (obj.startsWith('/objects/')) {
      urls.add(obj);
    }
    // Check for URLs embedded in CSS url() syntax
    const matches = Array.from(obj.matchAll(CSS_URL_REGEX));
    for (const match of matches) {
      if (match[1] && match[1].startsWith('/objects/')) {
        urls.add(match[1]);
      }
    }
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      extractObjectStorageUrls(item, urls);
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      extractObjectStorageUrls(obj[key], urls);
    }
  }
  
  return urls;
}

function replaceObjectStorageUrls(obj: any, mappings: Map<string, string>): any {
  if (!obj) return obj;
  
  if (typeof obj === 'string') {
    // Direct /objects/ URL replacement
    if (obj.startsWith('/objects/')) {
      return mappings.get(obj) || obj;
    }
    // Replace URLs embedded in CSS url() syntax
    if (obj.includes('/objects/')) {
      let result = obj;
      for (const [originalUrl, newUrl] of Array.from(mappings.entries())) {
        result = result.split(originalUrl).join(newUrl);
      }
      return result;
    }
    return obj;
  } else if (Array.isArray(obj)) {
    return obj.map(item => replaceObjectStorageUrls(item, mappings));
  } else if (typeof obj === 'object') {
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = replaceObjectStorageUrls(obj[key], mappings);
    }
    return result;
  }
  
  return obj;
}

async function downloadAndSaveImages(
  urls: Set<string>,
  outputDir: string
): Promise<Map<string, string>> {
  const mappings = new Map<string, string>();
  const imagesDir = path.join(outputDir, 'public', 'images');
  await fs.promises.mkdir(imagesDir, { recursive: true });
  
  const objectStorageService = new ObjectStorageService();
  
  for (const url of Array.from(urls)) {
    try {
      // Use ObjectStorageService for reliable path resolution
      const file = await objectStorageService.getObjectEntityFile(url);
      
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      
      // Get file extension from original filename or content type
      const parts = url.split('/');
      const originalFilename = parts[parts.length - 1] || '';
      let extension = path.extname(originalFilename);
      
      // Try to get extension from content type if not in filename
      if (!extension && metadata.contentType) {
        const mimeExtensions: Record<string, string> = {
          'image/webp': '.webp',
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/svg+xml': '.svg',
          'image/bmp': '.bmp',
          'image/tiff': '.tiff',
        };
        extension = mimeExtensions[metadata.contentType] || '';
      }
      
      // Default to .webp since our upload system converts to webp
      if (!extension) {
        extension = '.webp';
      }
      
      // Generate unique filename to avoid collisions
      const uniqueFilename = `${randomUUID()}${extension}`;
      const localPath = path.join(imagesDir, uniqueFilename);
      await fs.promises.writeFile(localPath, buffer);
      
      const newUrl = `/images/${uniqueFilename}`;
      mappings.set(url, newUrl);
      
      console.log(`[Publisher] Downloaded image: ${url} -> ${newUrl}`);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        console.warn(`[Publisher] Image not found in Object Storage: ${url}`);
      } else {
        console.error(`[Publisher] Failed to download image ${url}:`, error);
      }
    }
  }
  
  return mappings;
}

export async function generateNextJsProject(config: GeneratorConfig): Promise<string> {
  const { websiteId, siteName, builderState: sourceBuilderState, supabaseUrl, supabaseAnonKey } = config;
  // Defensive boundary: all generator inputs are canonical, even when a
  // caller bypasses the normal publish route in a test or a future worker.
  const { state: builderState } = migrateSiteStateToCurrent(sourceBuilderState);
  const language = config.language ?? DEFAULT_SITE_LANGUAGE;
  
  const outputDir = path.join(tmpdir(), 'publish', websiteId, Date.now().toString());
  
  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'checkout', 'create-session'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'checkout', 'validate'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'checkout', 'confirm'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'webhook', 'stripe'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'bookings'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'booking-services'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'form-submissions'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'availability'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'slots'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'products'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'orders'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'shipping-methods'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'product', '[id]'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'checkout'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'components'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'lib'), { recursive: true });
  
  // Extract and download Object Storage images
  console.log('[Publisher] Extracting Object Storage URLs from builder state...');
  const objectStorageUrls = extractObjectStorageUrls(builderState);
  console.log(`[Publisher] Found ${objectStorageUrls.size} Object Storage URLs`);
  
  // Pages, navigation and shared chrome, brought up to date before anything
  // reads them. A website last saved by an older editor has no stored
  // navigation and a header copied onto every page; the migration is
  // value-preserving, so publishing it produces the same site either way.
  let processedBuilderState = migrateSiteStructure(builderState);
  if (objectStorageUrls.size > 0) {
    console.log('[Publisher] Downloading images from Object Storage...');
    const urlMappings = await downloadAndSaveImages(objectStorageUrls, outputDir);
    console.log(`[Publisher] Downloaded ${urlMappings.size} images`);
    
    // Replace URLs in builder state
    processedBuilderState = replaceObjectStorageUrls(processedBuilderState, urlMappings) as BuilderStateData;
  }

  const prepared = preparePublishedState(processedBuilderState);
  processedBuilderState = prepared.state;
  const theme = prepared.theme;

  // Normalise component props: coerce known enum drifts (e.g. alignment
  // "middle" → "center") and apply legacy field renames so that old websites
  // don't surface avoidable Zod validation errors.
  processedBuilderState = {
    ...processedBuilderState,
    pages: normalizePages(
      processedBuilderState.pages as Array<{ name?: string; components?: unknown[] }>,
    ) as typeof processedBuilderState.pages,
  };

  // A component type the publisher cannot draw would come out as a blank
  // space on the live site while looking finished in the builder. Refuse to
  // build instead of shipping that difference.
  const unrenderable = unrenderableComponents(processedBuilderState);
  if (unrenderable.length) {
    throw new Error(describeUnrenderable(unrenderable));
  }

  // Validate component data before generating the project. This catches
  // invalid prop values (e.g. alignment = "middle") before they reach Vercel,
  // producing a clear Birdflow error instead of a TypeScript build failure.
  validateBuilderStateForPublish(processedBuilderState.pages as Array<{
    name?: string;
    components?: unknown[];
  }>);

  // The builder's "Product Page Design" section configures the generated
  // product pages rather than the page it sits on, so its settings are read
  // here and baked into those pages.
  const productPageDesign = resolveProductPageDesign(
    processedBuilderState.pages
      ?.flatMap((page) => page.components ?? [])
      .find((component) => (component as { type?: string }).type === 'product-detail')
      ?.props as Record<string, unknown> | undefined
  );

  // The home page's meta description doubles as the whole site's fallback.
  const homePage =
    processedBuilderState.pages.find((page) => page.path === '/') ?? processedBuilderState.pages[0];
  const homeDescription = homePage ? pageSeo(homePage, siteName).description : undefined;

  const componentRendererSource = generateComponentRenderer(language);
  const uncovered = missingRendererCases(componentRendererSource);
  if (uncovered.length) {
    throw new Error(
      `Udgivelsen blev stoppet: den genererede renderer mangler sektionstyperne ${uncovered.join(', ')}. ` +
        'Det udgivne website ville ikke se ud som i editoren.'
    );
  }

  const files: Array<{ path: string; content: string }> = [
    { path: 'package.json', content: generatePackageJson(siteName) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'next.config.js', content: generateNextConfig() },
    { path: 'theme.json', content: generateThemeJson(theme) },
    { path: '.env.example', content: generateEnvExample() },
    { path: '.nvmrc', content: generateNvmrc() },
    ...(config.deploymentIdentity
      ? [{
          path: 'public/birdflow-deployment.json',
          content: `${JSON.stringify(config.deploymentIdentity)}\n`,
        }]
      : []),
    { path: 'lib/supabase.ts', content: generateSupabaseClient(websiteId) },
    { path: 'lib/supabase-admin.ts', content: generateServerSupabase(websiteId) },
    { path: 'components/WebsiteProvider.tsx', content: generateWebsiteProvider() },
    { path: 'components/CartProvider.tsx', content: generateCartProvider() },
    { path: 'components/CartDrawer.tsx', content: generateCartDrawer(language) },
    { path: 'components/ComponentRenderer.tsx', content: componentRendererSource },
    { path: 'components/ContactForm.tsx', content: generateContactForm(language) },
    { path: 'components/BookingForm.tsx', content: generateBookingForm(language) },
    { path: 'components/trustedRuntime.js', content: generateTrustedRuntime() },
    { path: 'components/ProductGrid.tsx', content: generateProductGrid(language) },
    { path: 'components/AnalyticsTracker.tsx', content: generateAnalyticsTracker() },
    { path: 'components/CookieBanner.tsx', content: generateCookieBanner(language) },
    // Found by search engines: a sitemap of the pages a visitor can reach, and
    // a robots file pointing at it. Neither existed before, so a new site had
    // to be discovered link by link.
    { path: 'app/sitemap.ts', content: generateSitemap(processedBuilderState.pages as never) },
    { path: 'app/robots.ts', content: generateRobots() },
    // The home page's own description doubles as the site-wide fallback, so
    // even a page with no SEO of its own never ships a vendor slogan.
    {
      path: 'app/layout.tsx',
      content: generateRootLayout(
        siteName,
        websiteId,
        language,
        homeDescription,
        processedBuilderState.businessContext
      ),
    },
    { path: 'app/globals.css', content: generateGlobalsCss(theme) },
    { path: 'app/api/checkout/create-session/route.ts', content: generateCheckoutApiRoute(websiteId) },
    { path: 'app/api/checkout/validate/route.ts', content: generateCheckoutValidateApiRoute(websiteId) },
    { path: 'app/api/checkout/confirm/route.ts', content: generateCheckoutConfirmApiRoute(websiteId) },
    { path: 'app/api/webhook/stripe/route.ts', content: generateStripeWebhookApiRoute(websiteId) },
    { path: 'app/api/bookings/route.ts', content: generateBookingApiRoute(websiteId) },
    { path: 'app/api/booking-services/route.ts', content: generateBookingServicesApiRoute(websiteId) },
    { path: 'app/api/form-submissions/route.ts', content: generateFormSubmissionApiRoute(websiteId) },
    { path: 'app/api/availability/route.ts', content: generateAvailabilityApiRoute(websiteId) },
    { path: 'app/api/slots/route.ts', content: generateSlotsApiRoute(websiteId) },
    { path: 'app/api/team-members/route.ts', content: generateTeamMembersApiRoute(websiteId) },
    { path: 'app/api/products/route.ts', content: generateProductApiRoute(websiteId) },
    { path: 'app/api/orders/route.ts', content: generateOrderApiRoute(websiteId) },
    { path: 'app/api/shipping-methods/route.ts', content: generateShippingMethodsApiRoute(websiteId) },
    { path: 'app/product/[id]/page.tsx', content: generateProductDetailPage(language, productPageDesign) },
    { path: 'app/checkout/page.tsx', content: generateCheckoutPage(language) },
  ];
  
  // One navigation for the whole site, resolved once from the stored
  // navigation — the builder preview resolves the same list with the same
  // function, which is what keeps the two menus identical.
  const navItems = resolveNavItems(processedBuilderState);

  for (const page of processedBuilderState.pages) {
    const pagePath = page.path === '/' ? 'app/page.tsx' : `app${page.path}/page.tsx`;
    
    if (page.path !== '/') {
      await fs.promises.mkdir(path.join(outputDir, 'app', page.path.slice(1)), { recursive: true });
    }

    // The shared header and footer are folded into the page's sections here,
    // exactly where the builder preview puts them, so the generated file
    // needs no notion of chrome at all.
    const composed = {
      ...page,
      components: composePageComponents(
        page,
        processedBuilderState.siteChrome,
        processedBuilderState.brandGuide?.logoUrl
      ),
    };

    // Cast to any to avoid type mismatches between schema types and rendering types
    // The page data is serialized to JSON, so runtime types don't matter
    files.push({
      path: pagePath,
      content: generatePageFile(composed as any, websiteId, processedBuilderState.pages as any, {
        navItems,
        metadata: pageSeo(page, siteName),
      }),
    });
  }
  
  for (const file of files) {
    const filePath = path.join(outputDir, file.path);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, file.content, 'utf-8');
  }

  await writeFavicon(outputDir, processedBuilderState, siteName, theme.primaryColor);
  
  return outputDir;
}

/**
 * The tab icon for the published site.
 *
 * Prefers the logo the customer uploaded to their brand guide, shrunk to a
 * square; falls back to their initial on the brand's primary colour. Sites had
 * no icon at all before, so every one of them showed the browser's blank page
 * glyph next to its name in a tab, a bookmark and a search result.
 *
 * Never fails a publish: an icon is worth having, not worth losing a site over.
 */
async function writeFavicon(
  outputDir: string,
  state: BuilderStateData,
  siteName: string,
  primaryColor: string
): Promise<void> {
  const appDir = path.join(outputDir, 'app');

  const logoUrl = state.brandGuide?.logoUrl;
  // The logo has already been downloaded into public/ if it came from object
  // storage, so it is on disk under the path the site now references.
  if (logoUrl && logoUrl.startsWith('/')) {
    const localLogo = path.join(outputDir, 'public', logoUrl.replace(/^\//, ''));
    try {
      await fs.promises.access(localLogo);
      const sharp = (await import('sharp')).default;
      await sharp(localLogo)
        .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(path.join(appDir, 'icon.png'));
      return;
    } catch (error) {
      console.warn('[Publisher] Could not build an icon from the brand logo:', error);
    }
  }

  try {
    await fs.promises.writeFile(
      path.join(appDir, 'icon.svg'),
      generateMonogramIcon(siteName, primaryColor),
      'utf-8'
    );
  } catch (error) {
    console.warn('[Publisher] Could not write a fallback icon:', error);
  }
}

export async function createTarball(projectDir: string): Promise<Buffer> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  const tarballPath = `${projectDir}.tar.gz`;
  
  await execAsync(`tar -czf ${tarballPath} -C ${projectDir} .`);
  
  const tarball = await fs.promises.readFile(tarballPath);
  
  await fs.promises.unlink(tarballPath);
  
  return tarball;
}

export async function cleanupProject(projectDir: string): Promise<void> {
  await fs.promises.rm(projectDir, { recursive: true, force: true });
}
