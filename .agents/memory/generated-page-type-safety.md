---
name: Generated page type safety
description: How to keep generated Next.js page files TypeScript-clean without @ts-nocheck
---

# Generated page file type safety

## Rule
Generated page files must NOT import types from `ComponentRenderer.tsx` — that file carries `@ts-nocheck` and Next.js `isolatedModules` mode causes type errors in other files that import from it, even for `export type` declarations.

**Why:** TypeScript with `isolatedModules: true` (used by Next.js) has edge cases when re-exporting types from `@ts-nocheck` files — the Vercel build reports `errorCode: "type_error"` even though the builder's own `tsc` passes.

## How to apply
Define a local loose type in each generated page file instead:

```ts
type PageComponentData = { id: string; type: string; props: Record<string, any>; styles: Record<string, any> };
const pageComponents: PageComponentData[] = [...baked JSON...];
```

- Props and styles typed as `Record<string, any>` — accepts any valid builder data.
- No cross-file dependency on the `@ts-nocheck` renderer file.
- The Zod validation in `server/publisher/validate.ts` is the real data quality gate.

## What NOT to do
- Do NOT import `type ComponentData` from `@/components/ComponentRenderer` in generated pages.
- Do NOT add `// @ts-nocheck` to page files (masks real errors).
- Do NOT use `ComponentData[]` with an import from the renderer.

## Location
`generatePageFile()` in `server/publisher/templates.ts` — the local type is defined in the returned template string, before `const pageComponents`.
