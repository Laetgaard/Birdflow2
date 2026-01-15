import * as fs from 'fs';
import * as path from 'path';
import type { BuilderStateData } from '../../shared/schema';
import type { ThemeConfig } from '../../shared/rendering/types';
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
  generateProductApiRoute,
  generateAnalyticsTracker,
  generateCookieBanner,
} from './templates';

export type GeneratorConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export async function generateNextJsProject(config: GeneratorConfig): Promise<string> {
  const { websiteId, siteName, builderState, supabaseUrl, supabaseAnonKey } = config;
  
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
  
  const globalStyles = builderState.globalStyles || {};
  const theme: ThemeConfig = {
    primaryColor: globalStyles.primaryColor || '#4f46e5',
    secondaryColor: globalStyles.secondaryColor || '#22c55e',
    fontFamily: globalStyles.fontFamily || 'system-ui',
    backgroundColor: globalStyles.backgroundColor || '#ffffff',
    textColor: globalStyles.textColor || '#1f2937',
    borderRadius: globalStyles.borderRadius || '8px',
    spacingScale: globalStyles.spacingScale || 'comfortable',
    sectionGap: globalStyles.sectionGap || '80px',
    buttonStyle: globalStyles.buttonStyle || 'solid',
    cardStyle: globalStyles.cardStyle || 'elevated',
  };
  
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
    { path: 'components/CartDrawer.tsx', content: generateCartDrawer() },
    { path: 'components/ComponentRenderer.tsx', content: generateComponentRenderer() },
    { path: 'components/ContactForm.tsx', content: generateContactForm() },
    { path: 'components/BookingForm.tsx', content: generateBookingForm() },
    { path: 'components/ProductGrid.tsx', content: generateProductGrid() },
    { path: 'components/AnalyticsTracker.tsx', content: generateAnalyticsTracker() },
    { path: 'components/CookieBanner.tsx', content: generateCookieBanner() },
    { path: 'app/layout.tsx', content: generateRootLayout(siteName, websiteId) },
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
    { path: 'app/api/products/route.ts', content: generateProductApiRoute(websiteId) },
    { path: 'app/api/orders/route.ts', content: generateOrderApiRoute(websiteId) },
    { path: 'app/api/shipping-methods/route.ts', content: generateShippingMethodsApiRoute(websiteId) },
    { path: 'app/product/[id]/page.tsx', content: generateProductDetailPage() },
    { path: 'app/checkout/page.tsx', content: generateCheckoutPage() },
  ];
  
  for (const page of builderState.pages) {
    const pagePath = page.path === '/' ? 'app/page.tsx' : `app${page.path}/page.tsx`;
    
    if (page.path !== '/') {
      await fs.promises.mkdir(path.join(outputDir, 'app', page.path.slice(1)), { recursive: true });
    }
    
    // Cast to any to avoid type mismatches between schema types and rendering types
    // The page data is serialized to JSON, so runtime types don't matter
    files.push({ path: pagePath, content: generatePageFile(page as any, websiteId, builderState.pages as any) });
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
