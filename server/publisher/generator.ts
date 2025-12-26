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
  generateSupabaseClient,
  generateServerSupabase,
  generateComponentRenderer,
  generateContactForm,
  generateBookingForm,
  generateProductGrid,
  generateShopPageWithCart,
  generateShopClient,
  generateProductDetailPage,
  generateProductDetailClient,
  generateCartPage,
  generateCheckoutSuccessPage,
  generateCartProviderComponent,
  generateCheckoutAPI,
  generateCheckoutSQL,
  generateGlobalsCss,
  generatePageFile,
  generateRootLayout,
} from './templates';

export type GeneratorConfig = {
  websiteId: string;
  siteName: string;
  builderState: BuilderStateData;
  supabaseUrl: string;
  supabaseAnonKey: string;
  hasProducts?: boolean;
};

export async function generateNextJsProject(config: GeneratorConfig): Promise<string> {
  const { websiteId, siteName, builderState, supabaseUrl, supabaseAnonKey, hasProducts } = config;
  
  let pagesForNav = [...builderState.pages];
  
  if (hasProducts) {
    if (!pagesForNav.some(p => p.path === '/shop')) {
      pagesForNav.push({ id: 'shop', name: 'Shop', path: '/shop', components: [] });
    }
    if (!pagesForNav.some(p => p.path === '/cart')) {
      pagesForNav.push({ id: 'cart', name: 'Cart', path: '/cart', components: [] });
    }
  }
  
  const outputDir = path.join('/tmp', 'publish', websiteId, Date.now().toString());
  
  await fs.promises.mkdir(outputDir, { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'components'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'lib'), { recursive: true });
  
  const theme: ThemeConfig = builderState.globalStyles || {
    primaryColor: '#4f46e5',
    secondaryColor: '#22c55e',
    fontFamily: 'system-ui',
    backgroundColor: '#ffffff',
  };
  
  const files: Array<{ path: string; content: string }> = [
    { path: 'package.json', content: generatePackageJson(siteName) },
    { path: 'tsconfig.json', content: generateTsConfig() },
    { path: 'next.config.js', content: generateNextConfig() },
    { path: 'theme.json', content: generateThemeJson(theme) },
    { path: '.env.example', content: generateEnvExample() },
    { path: 'lib/supabase.ts', content: generateSupabaseClient() },
    { path: 'lib/supabase-admin.ts', content: generateServerSupabase() },
    { path: 'components/ComponentRenderer.tsx', content: generateComponentRenderer() },
    { path: 'components/ContactForm.tsx', content: generateContactForm() },
    { path: 'components/BookingForm.tsx', content: generateBookingForm() },
    { path: 'components/ProductGrid.tsx', content: generateProductGrid() },
    { path: 'app/layout.tsx', content: generateRootLayout(siteName) },
    { path: 'app/globals.css', content: generateGlobalsCss() },
  ];
  
  for (const page of builderState.pages) {
    const pagePath = page.path === '/' ? 'app/page.tsx' : `app${page.path}/page.tsx`;
    
    if (page.path !== '/') {
      await fs.promises.mkdir(path.join(outputDir, 'app', page.path.slice(1)), { recursive: true });
    }
    
    files.push({ path: pagePath, content: generatePageFile(page, websiteId, pagesForNav) });
  }
  
  await fs.promises.mkdir(path.join(outputDir, 'app', 'shop'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'shop', '[id]'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'cart'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'checkout', 'success'), { recursive: true });
  await fs.promises.mkdir(path.join(outputDir, 'app', 'api', 'checkout'), { recursive: true });
  
  files.push({ path: 'components/CartProvider.tsx', content: generateCartProviderComponent(websiteId) });
  files.push({ path: 'app/shop/page.tsx', content: generateShopPageWithCart() });
  files.push({ path: 'app/shop/ShopClient.tsx', content: generateShopClient() });
  files.push({ path: 'app/shop/[id]/page.tsx', content: generateProductDetailPage() });
  files.push({ path: 'app/shop/[id]/ProductDetailClient.tsx', content: generateProductDetailClient() });
  files.push({ path: 'app/cart/page.tsx', content: generateCartPage() });
  files.push({ path: 'app/checkout/success/page.tsx', content: generateCheckoutSuccessPage() });
  files.push({ path: 'app/api/checkout/route.ts', content: generateCheckoutAPI() });
  files.push({ path: 'supabase/process_checkout.sql', content: generateCheckoutSQL() });
  
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
