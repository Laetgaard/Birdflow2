import { build, type Loader } from 'esbuild';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname } from 'node:path';

/** Resolve trusted renderer modules explicitly; avoids ancestor-directory
 * discovery failing in restricted Windows hosts. No customer code is loaded. */
export async function bundlePreviewModules(modules: Record<string, string>, entry: string): Promise<string> {
  const projectRoot = process.cwd();
  const requireFromProject = createRequire(resolve(projectRoot, 'package.json'));
  const result = await build({
    stdin: { contents: entry, loader: 'tsx', resolveDir: projectRoot },
    bundle: true, write: false, format: 'iife', platform: 'browser', minify: true, jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'trusted-preview-modules', setup(builder) {
      builder.onResolve({ filter: /.*/ }, args => {
        if (args.path in modules) return { path: args.path, namespace: 'preview' };
        const requireFromImporter = args.namespace === 'dependency' ? createRequire(args.importer) : requireFromProject;
        return { path: requireFromImporter.resolve(args.path), namespace: 'dependency' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'preview' }, args => ({ contents: modules[args.path], loader: 'tsx' }));
      builder.onLoad({ filter: /.*/, namespace: 'dependency' }, async args => ({
        contents: await readFile(args.path, 'utf8'),
        loader: (extname(args.path) === '.json' ? 'json' : 'js') as Loader,
        resolveDir: dirname(args.path),
      }));
    } }],
  });
  return result.outputFiles[0].text;
}
