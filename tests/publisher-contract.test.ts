/**
 * Publisher contract tests — generated TypeScript must type-check clean.
 *
 * These tests verify that the generated Next.js project (ComponentRenderer +
 * page files) contains no real TypeScript errors when checked with the tsc gate
 * configuration (noResolve:true, strict:true — same settings the publisher uses
 * before uploading to Vercel).
 *
 * Specifically, this is a regression guard for the class of bugs where a
 * baked-in function has implicit-any parameters (TS7006) that would fail a
 * strict Vercel build. The four motion functions (computeMotion, motionPhaseStyle,
 * sectionMotionSpec, staggerChildSpec) were the original offenders; this suite
 * ensures they — and any future baked functions — stay clean.
 *
 * Runtime: runs tsc as a subprocess (~5-15 s). The test timeout is set to 60 s.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { generateNextJsProject } from '../server/publisher/generator';
import * as tscGateModule from '../server/publisher/tscGate';
import { runTscGate, PublishTypeError } from '../server/publisher/tscGate';
import { publishWebsite } from '../server/publisher/index';
import {
  createPublishJob,
  failPublishJob,
  getPublishJob,
} from '../server/publisher/publishJobs';
import type { BuilderStateData } from '../shared/schema';

// ── Test fixture ──────────────────────────────────────────────────────────────
// A compact but realistic builder state covering the component types most
// likely to surface type errors (motion, hero, features, text variants).

// Only component types registered in PUBLISHER_RENDERS (coverage.ts) are valid.
// 'text', 'image-text', 'contact' are NOT registered — use 'hero', 'features',
// 'text-image', 'cta', 'contact-form', 'rich-text' instead.
const CONTRACT_STATE: BuilderStateData = {
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
            title: 'Contract Test Site',
            subtitle: 'Type safety verified',
            alignment: 'center',
            description: 'This page exists only to satisfy the tsc gate.',
            buttonText: 'Learn more',
            buttonLink: '/services',
          },
          styles: {
            motion: {
              effect: 'fade-in',
              trigger: 'scroll',
              duration: 'normal',
              delay: 'none',
            },
          },
        },
        {
          id: 'features-1',
          type: 'features',
          props: {
            title: 'Features',
            subtitle: 'What we offer',
            features: [
              { title: 'Fast', description: 'Very fast' },
              { title: 'Reliable', description: 'Very reliable' },
            ],
          },
          styles: {},
        },
        {
          id: 'text-image-1',
          type: 'text-image',
          props: {
            title: 'Our story',
            content: 'We started small.',
            imageSide: 'left',
            imageUrl: 'https://example.com/photo.jpg',
          },
          styles: {},
        },
      ],
    },
    {
      id: 'services',
      name: 'Services',
      path: '/services',
      role: 'services' as const,
      components: [
        {
          id: 'cta-1',
          type: 'cta',
          props: {
            title: 'Ready to start?',
            subtitle: 'Contact us today',
            buttonText: 'Get in touch',
            buttonLink: '/contact',
          },
          styles: {},
        },
        {
          id: 'contact-form-1',
          type: 'contact-form',
          props: {
            title: 'Contact us',
            subtitle: 'We would love to hear from you',
          },
          styles: {},
        },
      ],
    },
  ],
  activePage: 'home',
  globalStyles: {
    primaryColor: '#1a1a1a',
    fontFamily: 'Inter',
  },
} as unknown as BuilderStateData;

// ── Shared generated dir ──────────────────────────────────────────────────────

let contractDir: string;

beforeAll(async () => {
  contractDir = await generateNextJsProject({
    websiteId: 'contract-test-website',
    siteName: 'Contract Test Site',
    builderState: CONTRACT_STATE,
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    language: 'en',
  });
}, 30_000);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publisher contract — generated TypeScript type-checks clean', () => {
  it(
    'tsc gate passes on the generated project (no real type errors)',
    async () => {
      // runTscGate must resolve without throwing. Any thrown PublishTypeError
      // (or unexpected error) fails the test.
      await expect(runTscGate(contractDir)).resolves.toBeUndefined();
    },
    60_000,
  );

  it(
    'ComponentRenderer.tsx exists and is non-empty',
    () => {
      const rendererPath = path.join(contractDir, 'components', 'ComponentRenderer.tsx');
      expect(fs.existsSync(rendererPath), 'ComponentRenderer.tsx must exist').toBe(true);
      const content = fs.readFileSync(rendererPath, 'utf-8');
      expect(content.length).toBeGreaterThan(1000);
    },
  );

  it(
    'ComponentRenderer.tsx does not start with // @ts-nocheck',
    () => {
      const content = fs.readFileSync(
        path.join(contractDir, 'components', 'ComponentRenderer.tsx'),
        'utf-8',
      );
      const firstMeaningfulLine = content.split('\n').find((l) => l.trim().length > 0);
      expect(firstMeaningfulLine?.trim()).not.toBe('// @ts-nocheck');
    },
  );

  it(
    'tsc gate surfaces PublishTypeError when the renderer has implicit-any (negative test)',
    async () => {
      // The gate only checks ComponentRenderer.tsx. To test rejection, we
      // temporarily append a function with an implicit-any parameter — the
      // exact class of bug the gate was designed to catch — to that file.
      const rendererPath = path.join(contractDir, 'components', 'ComponentRenderer.tsx');
      const originalContent = fs.readFileSync(rendererPath, 'utf-8');
      const badSuffix = [
        '\n// Deliberate implicit-any for negative-test purposes (removed after test)',
        'export function __badContractTestFn(x) { return x; } // TS7006: x has implicit-any type',
      ].join('\n');

      try {
        fs.writeFileSync(rendererPath, originalContent + badSuffix, 'utf-8');
        await expect(runTscGate(contractDir)).rejects.toBeInstanceOf(PublishTypeError);
      } finally {
        // Restore the original file regardless of outcome
        fs.writeFileSync(rendererPath, originalContent, 'utf-8');
      }
    },
    60_000,
  );
});

// ── Failure-details wiring tests ──────────────────────────────────────────────
// These tests verify that structured failure metadata (stage, errorMessage,
// timestamp) flows end-to-end: from a thrown PublishTypeError or validation
// error through publishWebsite's catch block → failPublishJob → DB → getPublishJob.

describe('publisher contract — failure details wiring', () => {
  it(
    'publishWebsite returns failureDetails.stage="type_check" when tsc gate throws PublishTypeError',
    async () => {
      // Spy on runTscGate so it throws a PublishTypeError without needing to
      // generate a renderer with deliberate implicit-any bugs. The rest of the
      // pipeline (generation, cleanup) runs normally so the wiring is real.
      const fakeErrors: tscGateModule.TscError[] = [
        {
          file: 'components/ComponentRenderer.tsx',
          line: 100,
          column: 5,
          code: 'TS7006',
          message: "Parameter 'x' implicitly has an 'any' type.",
        },
      ];
      const spy = vi
        .spyOn(tscGateModule, 'runTscGate')
        .mockRejectedValueOnce(new PublishTypeError(fakeErrors));

      try {
        const result = await publishWebsite({
          websiteId: 'contract-failure-test',
          siteName: 'Contract Failure Test',
          builderState: CONTRACT_STATE,
          supabaseUrl: 'https://example.supabase.co',
          supabaseAnonKey: 'test-anon-key',
          supabaseServiceRoleKey: 'test-service-role-key',
          vercelToken: 'test-token-not-reached',
          birdflowApiUrl: 'https://test.example.com',
          language: 'en',
        });

        expect(result.success).toBe(false);
        expect(result.failureDetails).toBeDefined();
        expect(result.failureDetails?.stage).toBe('type_check');
        expect(result.failureDetails?.errorMessage).toBeTruthy();
        expect(result.failureDetails?.timestamp).toBeTruthy();
        // Gate's first error file should be recorded as componentType
        expect(result.failureDetails?.componentType).toBe('components/ComponentRenderer.tsx');
      } finally {
        spy.mockRestore();
      }
    },
    60_000,
  );

  it(
    'publishWebsite returns failureDetails.stage="generating" for validation errors (not type_check)',
    async () => {
      // A component with an alignment value that normalization does NOT coerce
      // (only 'middle' is coerced to 'center') will fail validatePageComponents
      // inside generateNextJsProject — before the tsc gate or any Vercel call.
      // The returned failureDetails must reflect stage='generating', not 'type_check'.
      const invalidState = {
        pages: [
          {
            id: 'home',
            name: 'Home',
            path: '/',
            role: 'home',
            components: [
              {
                id: 'hero-1',
                type: 'hero',
                props: { title: 'Test', alignment: 'totally-invalid-alignment' },
                styles: {},
              },
            ],
          },
        ],
        activePage: 'home',
        globalStyles: {},
      } as unknown as BuilderStateData;

      const result = await publishWebsite({
        websiteId: 'contract-validation-failure-test',
        siteName: 'Validation Failure Test',
        builderState: invalidState,
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        supabaseServiceRoleKey: 'test-service-role-key',
        vercelToken: 'test-token-not-reached',
        birdflowApiUrl: 'https://test.example.com',
        language: 'en',
      });

      expect(result.success).toBe(false);
      expect(result.failureDetails).toBeDefined();
      // Validation throws before the gate, so stage must be 'generating', not 'type_check'
      expect(result.failureDetails?.stage).toBe('generating');
      expect(result.failureDetails?.errorMessage).toMatch(/alignment/i);
      expect(result.failureDetails?.timestamp).toBeTruthy();
    },
    60_000,
  );
});
