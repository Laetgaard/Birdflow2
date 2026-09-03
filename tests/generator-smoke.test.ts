/**
 * Generator smoke tests — fast sanity checks on the generated Next.js project.
 *
 * These run without npm install or next build (too slow for CI). They verify:
 *  1. The generator produces a complete file tree for a minimal builder state.
 *  2. ComponentRenderer.tsx does NOT carry // @ts-nocheck — the motion functions
 *     have explicit `any` type annotations so noImplicitAny is satisfied without
 *     suppressing the entire file (regression guard: absence must stay absent).
 *  3. Generated page files do NOT carry // @ts-nocheck — literal-union props
 *     (alignment, layout, variant, etc.) are widened to `string` in PageComponentData
 *     so baked JSON literals are accepted without whole-file suppression.
 *  4. Key generated files are non-empty and contain expected markers.
 *
 * For a full build test (npm install + next build), set real env vars and run:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_WEBSITE_ID=... \
 *   NEXT_PUBLIC_BIRDFLOW_API_URL=... \
 *   node -e "require('child_process').execSync('npm run build', { cwd: '<generatedDir>', stdio: 'inherit' })"
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { generateNextJsProject } from '../server/publisher/generator';
import type { BuilderStateData } from '../shared/schema';

// ── Minimal fixture (single page, basic hero) ────────────────────────────────
const MINIMAL_STATE: BuilderStateData = {
  pages: [
    {
      id: 'home',
      name: 'Home',
      path: '/',
      role: 'home' as const,
      components: [
        {
          id: 'hero-1',
          type: 'hero',
          props: {
            title: 'Test Site',
            subtitle: 'A subtitle',
            description: 'A description',
            buttonText: 'Contact',
            buttonLink: '/contact',
          },
          styles: {},
        },
      ],
    },
  ],
  activePage: 'home',
  globalStyles: {},
} as unknown as BuilderStateData;

// ── Rich multi-page fixture covering literal-union props ──────────────────────
// This fixture deliberately includes props whose values must survive TypeScript
// inference without widening to `string`. Any regression in generatePageFile()
// that removes the @ts-nocheck guard will be caught by the page-header tests
// below, while this fixture makes it easy to also add a compilation test later.
const RICH_STATE: BuilderStateData = {
  pages: [
    {
      id: 'home',
      name: 'Home',
      path: '/',
      role: 'home' as const,
      components: [
        {
          id: 'hero-home',
          type: 'hero',
          props: {
            title: 'Welcome',
            subtitle: 'Hero subtitle',
            alignment: 'center',          // literal union: "center"|"left"|"right"
            description: 'Hero body',
            buttonText: 'Book now',
            buttonLink: '/contact',
          },
          styles: {
            padding: 'large',
            buttonStyle: 'primary',
          },
        },
        {
          id: 'features-home',
          type: 'features',
          props: {
            title: 'Our Services',
            alignment: 'left',
            layout: 'grid',              // literal union prop
            items: [
              { id: 'f1', title: 'Feature 1', description: 'Desc 1' },
              { id: 'f2', title: 'Feature 2', description: 'Desc 2' },
            ],
          },
          styles: {
            backgroundColor: '#ffffff',
            columns: '3',
          },
        },
        {
          id: 'cta-home',
          type: 'cta',
          props: {
            title: 'Ready to start?',
            alignment: 'right',
            buttonText: 'Get in touch',
            buttonLink: '/contact',
            variant: 'filled',           // literal union prop
          },
          styles: {},
        },
      ],
    },
    {
      id: 'services',
      name: 'Services',
      path: '/services',
      role: 'custom' as const,
      components: [
        {
          id: 'hero-services',
          type: 'hero',
          props: {
            title: 'Services',
            alignment: 'center',
            description: 'What we offer',
          },
          styles: { padding: 'medium' },
        },
        {
          id: 'services-list',
          type: 'services',
          props: {
            title: 'Details',
            subtitle: 'What we offer',
            alignment: 'left',
            layout: 'grid',
          },
          styles: { fontSize: 'base', fontWeight: 'normal' },
        },
      ],
    },
    {
      id: 'contact',
      name: 'Contact',
      path: '/contact',
      role: 'contact' as const,
      components: [
        {
          id: 'hero-contact',
          type: 'hero',
          props: { title: 'Contact us', alignment: 'center' },
          styles: {},
        },
        {
          id: 'form-contact',
          type: 'contact-form',
          props: { title: 'Send a message' },
          styles: {},
        },
      ],
    },
  ],
  activePage: 'home',
  globalStyles: {
    primaryColor: '#1a56db',
    fontFamily: 'Inter',
  },
} as unknown as BuilderStateData;

let minimalDir: string;
let richDir: string;

beforeAll(async () => {
  [minimalDir, richDir] = await Promise.all([
    generateNextJsProject({
      websiteId: 'smoke-test-id',
      siteName: 'Smoke Test Site',
      builderState: MINIMAL_STATE,
      supabaseUrl: 'https://smoke.supabase.co',
      supabaseAnonKey: 'smoke-anon-key',
      language: 'da',
    }),
    generateNextJsProject({
      websiteId: 'rich-test-id',
      siteName: 'Rich Test Site',
      builderState: RICH_STATE,
      supabaseUrl: 'https://rich.supabase.co',
      supabaseAnonKey: 'rich-anon-key',
      language: 'da',
    }),
  ]);
}, 30_000);

// ── Backward compat: keep using minimalDir as "projectDir" ───────────────────
// Tests written before the rich fixture was added reference projectDir.
let projectDir: string;
beforeAll(() => { projectDir = minimalDir; });

describe('generated project structure', () => {
  it('produces a directory', () => {
    expect(fs.existsSync(projectDir)).toBe(true);
    expect(fs.statSync(projectDir).isDirectory()).toBe(true);
  });

  it('generates package.json with required scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.scripts?.build).toBe('next build');
    expect(pkg.dependencies?.next).toBeTruthy();
    expect(pkg.dependencies?.react).toBeTruthy();
  });

  it('generates tsconfig.json', () => {
    const tsc = JSON.parse(fs.readFileSync(path.join(projectDir, 'tsconfig.json'), 'utf-8'));
    expect(tsc.compilerOptions?.strict).toBe(true);
    expect(tsc.compilerOptions?.skipLibCheck).toBe(true);
  });

  it('generates app/page.tsx for home', () => {
    const pagePath = path.join(projectDir, 'app', 'page.tsx');
    expect(fs.existsSync(pagePath)).toBe(true);
    const content = fs.readFileSync(pagePath, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
  });

  it('generates all API routes', () => {
    const routes = [
      'app/api/bookings/route.ts',
      'app/api/booking-services/route.ts',
      'app/api/form-submissions/route.ts',
      'app/api/availability/route.ts',
      'app/api/slots/route.ts',
      'app/api/team-members/route.ts',
      'app/api/products/route.ts',
      'app/api/orders/route.ts',
      'app/api/checkout/create-session/route.ts',
      'app/api/checkout/validate/route.ts',
      'app/api/checkout/confirm/route.ts',
      'app/api/webhook/stripe/route.ts',
    ];
    for (const route of routes) {
      expect(fs.existsSync(path.join(projectDir, route)), route).toBe(true);
    }
  });

  it('generates component files', () => {
    const components = [
      'components/ComponentRenderer.tsx',
      'components/BookingForm.tsx',
      'components/ContactForm.tsx',
      'components/CartProvider.tsx',
      'components/CartDrawer.tsx',
    ];
    for (const comp of components) {
      expect(fs.existsSync(path.join(projectDir, comp)), comp).toBe(true);
    }
  });
});

// ── Regression guard: Vercel build was crashing because TypeScript's         ──
// ── noImplicitAny rejected the minified `computeMotion(tables, ...)` params. ──
describe('ComponentRenderer.tsx TypeScript safety', () => {
  let rendererSource: string;

  beforeAll(() => {
    rendererSource = fs.readFileSync(
      path.join(projectDir, 'components', 'ComponentRenderer.tsx'),
      'utf-8'
    );
  });

  it('does NOT start with // @ts-nocheck — motion functions carry explicit any annotations instead', () => {
    // Phase 4 of the type-safety plan: the four motion functions baked via
    // .toString() now have explicit `(param: any, ...) => any` annotations on
    // their holding constants. That satisfies noImplicitAny without the
    // whole-file suppressor. This assertion is the permanent regression guard
    // that must stay inverted — any future change that re-adds @ts-nocheck
    // as the first non-blank line will fail here.
    const firstMeaningfulLine = rendererSource
      .split('\n')
      .find((l) => l.trim().length > 0);
    expect(firstMeaningfulLine?.trim()).not.toBe('// @ts-nocheck');
  });

  it('baked motion functions carry explicit any type annotations', () => {
    // These annotations are what allow us to remove @ts-nocheck. They must
    // remain intact whenever the generator template is edited.
    expect(rendererSource).toContain('computeMotion: (tables: any');
    expect(rendererSource).toContain('motionPhaseStyle: (resolved: any');
    expect(rendererSource).toContain('sectionMotionSpec: (styles: any');
    expect(rendererSource).toContain('staggerChildSpec: (parentSpec: any');
  });

  it('contains the motion tables constant', () => {
    expect(rendererSource).toContain('MOTION_TABLES');
  });

  it('contains the computeMotion function', () => {
    expect(rendererSource).toContain('computeMotion');
  });
});

// ── Generated page files: type-safe without @ts-nocheck ─────────────────────
// ── Task #125: literal-union props (alignment, imageSide) are widened to     ──
// ── `string` in the generated ComponentProps so baked-in JSON literals are   ──
// ── accepted by TypeScript without suppressing the whole file.                ──
describe('generated page files TypeScript safety', () => {
  function firstMeaningfulLine(content: string): string {
    return content.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
  }

  // Page files must NOT suppress TypeScript — the whole point of task #125.
  it('home page (minimal) does NOT start with @ts-nocheck', () => {
    const content = fs.readFileSync(path.join(minimalDir, 'app', 'page.tsx'), 'utf-8');
    expect(firstMeaningfulLine(content)).not.toBe('// @ts-nocheck');
  });

  it('home page starts with an import statement', () => {
    const content = fs.readFileSync(path.join(minimalDir, 'app', 'page.tsx'), 'utf-8');
    expect(firstMeaningfulLine(content)).toMatch(/^import /);
  });

  it('page file defines a local loose component type for TypeScript safety', () => {
    const content = fs.readFileSync(path.join(minimalDir, 'app', 'page.tsx'), 'utf-8');
    // Uses a local PageComponentData type (not imported from @ts-nocheck renderer)
    // so isolatedModules and strict mode are both satisfied without @ts-nocheck.
    expect(content).toContain('PageComponentData');
    expect(content).toContain('ComponentRenderer');
  });

  it('page file annotates baked-in data with the local component type', () => {
    const content = fs.readFileSync(path.join(minimalDir, 'app', 'page.tsx'), 'utf-8');
    expect(content).toContain('PageComponentData[]');
  });

  it('rich pages do not start with @ts-nocheck', () => {
    for (const [label, filePath] of [
      ['home', path.join(richDir, 'app', 'page.tsx')],
      ['services', path.join(richDir, 'app', 'services', 'page.tsx')],
      ['contact', path.join(richDir, 'app', 'contact', 'page.tsx')],
    ] as const) {
      expect(fs.existsSync(filePath), `${label} page exists`).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(firstMeaningfulLine(content), `${label} does not start with @ts-nocheck`).not.toBe('// @ts-nocheck');
    }
  });

  it('rich pages contain the literal-union props that previously caused Vercel build failures', () => {
    // Services page has alignment: "left" and alignment: "center" — the exact
    // values that previously widened to string and crashed the Vercel build.
    const servicesContent = fs.readFileSync(
      path.join(richDir, 'app', 'services', 'page.tsx'),
      'utf-8'
    );
    expect(servicesContent).toContain('"alignment"');
    // Home page has all three alignment variants plus imageSide-adjacent props.
    const homeContent = fs.readFileSync(path.join(richDir, 'app', 'page.tsx'), 'utf-8');
    expect(homeContent).toContain('"center"');
    expect(homeContent).toContain('"left"');
    expect(homeContent).toContain('"right"');
    // These pages must also carry the ComponentData annotation.
    expect(homeContent).toContain('ComponentData[]');
  });
});

describe('generated code correctness', () => {
  it('root layout bakes in website ID', () => {
    const layout = fs.readFileSync(path.join(projectDir, 'app', 'layout.tsx'), 'utf-8');
    expect(layout).toContain('smoke-test-id');
  });

  it('booking API bakes in website ID as fallback', () => {
    const route = fs.readFileSync(
      path.join(projectDir, 'app', 'api', 'bookings', 'route.ts'),
      'utf-8'
    );
    expect(route).toContain('smoke-test-id');
  });

  it('supabase client uses env var', () => {
    const lib = fs.readFileSync(path.join(projectDir, 'lib', 'supabase.ts'), 'utf-8');
    expect(lib).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('generated page file is valid UTF-8 with no null bytes', () => {
    const page = fs.readFileSync(path.join(projectDir, 'app', 'page.tsx'));
    // null bytes indicate a binary corruption / template escape bug
    expect(page.indexOf(0)).toBe(-1);
  });
});
