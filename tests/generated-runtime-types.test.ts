import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { generateBookingForm, generateComponentRenderer, generateTrustedRuntime } from '../server/publisher/templates';

describe('generated runtime TypeScript contract', () => {
  it('typechecks the real booking and component renderer in strict mode', () => {
    const root = resolve('.').replace(/\\/g, '/');
    const dir = `${root}/node_modules/.birdflow-virtual-typecheck`;
    const files = new Map(Object.entries({
      [`${dir}/components/BookingForm.tsx`]: generateBookingForm('en'),
      [`${dir}/components/ComponentRenderer.tsx`]: generateComponentRenderer('en'),
      [`${dir}/components/trustedRuntime.js`]: generateTrustedRuntime(),
      [`${dir}/components/WebsiteProvider.ts`]: 'export const useWebsite = () => ({websiteId:"fixture-site"});',
      [`${dir}/components/CartProvider.ts`]: 'export const useCart = (): any => ({items:[], addItem:()=>{}});',
      [`${dir}/theme.json`]: JSON.stringify({primaryColor:'#345',secondaryColor:'#567',fontFamily:'Arial',backgroundColor:'#fff',textColor:'#123',borderRadius:'8px'}),
    }));
    const options: ts.CompilerOptions = {
      strict: true, noEmit: true, allowJs: true, checkJs: false, skipLibCheck: true,
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, resolveJsonModule: true,
      baseUrl: dir, paths: {'@/*':['./*']}, types:['node','react'], typeRoots:[`${root}/node_modules/@types`],
    };
    const host = ts.createCompilerHost(options);
    const read = host.readFile.bind(host), exists = host.fileExists.bind(host), directory = host.directoryExists?.bind(host);
    const normalize = (path: string) => path.replace(/\\/g, '/');
    host.readFile = path => files.get(normalize(path)) ?? read(path);
    host.fileExists = path => files.has(normalize(path)) || exists(path);
    host.directoryExists = path => Array.from(files.keys()).some(file => file.startsWith(normalize(path) + '/')) || !!directory?.(path);
    const program = ts.createProgram({rootNames:Array.from(files.keys()), options, host});
    const errors = ts.getPreEmitDiagnostics(program).map(error => `${error.file?.fileName}:${error.file && error.start !== undefined ? error.file.getLineAndCharacterOfPosition(error.start).line + 1 : ''}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
    expect(errors, errors.join('\n')).toEqual([]);
  }, 30000);
});
