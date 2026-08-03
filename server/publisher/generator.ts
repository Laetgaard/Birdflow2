import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { BuilderStateData } from '../../shared/schema';
import { sanitizeBuilderStateCustomContent } from '../../shared/customComponents';
import type { ThemeConfig } from '../../shared/rendering/types';
import { resolveApprovedFontStack } from '../../shared/fonts';
import { missingRendererCases, unrenderableComponents, describeUnrenderable } from './coverage';
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
} from './templates';
import { DEFAULT_SITE_LANGUAGE, type SiteLanguage } from '../../shared/siteLanguage';

export type GeneratorConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
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
  const { websiteId, siteName, builderState, supabaseUrl, supabaseAnonKey } = config;
  const language = config.language ?? DEFAULT_SITE_LANGUAGE;
  
  const outputDir = path.join('/tmp', 'publish', websiteId, Date.now().toString());
  
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
  
  let processedBuilderState = builderState;
  if (objectStorageUrls.size > 0) {
    console.log('[Publisher] Downloading images from Object Storage...');
    const urlMappings = await downloadAndSaveImages(objectStorageUrls, outputDir);
    console.log(`[Publisher] Downloaded ${urlMappings.size} images`);
    
    // Replace URLs in builder state
    processedBuilderState = replaceObjectStorageUrls(builderState, urlMappings) as BuilderStateData;
  }

  // Defense in depth: strip unsafe SVG markup from custom components even if
  // an unsanitized tree made it into the stored state.
  processedBuilderState = sanitizeBuilderStateCustomContent(processedBuilderState);

  const globalStyles = processedBuilderState.globalStyles || {};
  const theme: ThemeConfig = {
    primaryColor: globalStyles.primaryColor || '#4f46e5',
    secondaryColor: globalStyles.secondaryColor || '#22c55e',
    fontFamily: resolveApprovedFontStack(globalStyles.fontFamily),
    backgroundColor: globalStyles.backgroundColor || '#ffffff',
    textColor: globalStyles.textColor || '#1f2937',
    borderRadius: globalStyles.borderRadius || '8px',
    spacingScale: globalStyles.spacingScale || 'comfortable',
    sectionGap: globalStyles.sectionGap || '0',
    buttonStyle: globalStyles.buttonStyle || 'solid',
    cardStyle: globalStyles.cardStyle || 'elevated',
  };
  
  // A component type the publisher cannot draw would come out as a blank
  // space on the live site while looking finished in the builder. Refuse to
  // build instead of shipping that difference.
  const unrenderable = unrenderableComponents(processedBuilderState);
  if (unrenderable.length) {
    throw new Error(describeUnrenderable(unrenderable));
  }

  // The builder's "Product Page Design" section configures the generated
  // product pages rather than the page it sits on, so its settings are read
  // here and baked into those pages.
  const productPageDesign = resolveProductPageDesign(
    processedBuilderState.pages
      ?.flatMap((page) => page.components ?? [])
      .find((component) => (component as { type?: string }).type === 'product-detail')
      ?.props as Record<string, unknown> | undefined
  );

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
    { path: 'lib/supabase.ts', content: generateSupabaseClient(websiteId) },
    { path: 'lib/supabase-admin.ts', content: generateServerSupabase(websiteId) },
    { path: 'components/WebsiteProvider.tsx', content: generateWebsiteProvider() },
    { path: 'components/CartProvider.tsx', content: generateCartProvider() },
    { path: 'components/CartDrawer.tsx', content: generateCartDrawer(language) },
    { path: 'components/ComponentRenderer.tsx', content: componentRendererSource },
    { path: 'components/ContactForm.tsx', content: generateContactForm(language) },
    { path: 'components/BookingForm.tsx', content: generateBookingForm(language) },
    { path: 'components/ProductGrid.tsx', content: generateProductGrid(language) },
    { path: 'components/AnalyticsTracker.tsx', content: generateAnalyticsTracker() },
    { path: 'components/CookieBanner.tsx', content: generateCookieBanner(language) },
    { path: 'app/layout.tsx', content: generateRootLayout(siteName, websiteId, language) },
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
  
  for (const page of processedBuilderState.pages) {
    const pagePath = page.path === '/' ? 'app/page.tsx' : `app${page.path}/page.tsx`;
    
    if (page.path !== '/') {
      await fs.promises.mkdir(path.join(outputDir, 'app', page.path.slice(1)), { recursive: true });
    }
    
    // Cast to any to avoid type mismatches between schema types and rendering types
    // The page data is serialized to JSON, so runtime types don't matter
    files.push({ path: pagePath, content: generatePageFile(page as any, websiteId, processedBuilderState.pages as any) });
  }
  
  for (const file of files) {
    const filePath = path.join(outputDir, file.path);
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, file.content, 'utf-8');
  }
  
  return outputDir;
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
