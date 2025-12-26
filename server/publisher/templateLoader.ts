import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type TemplateContext = {
  siteName?: string;
  websiteId?: string;
  primaryColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  [key: string]: string | undefined;
};

const templateCache = new Map<string, string>();

export function loadTemplate(templatePath: string, context: TemplateContext = {}): string {
  const fullPath = path.join(__dirname, 'templates', templatePath);
  
  let content: string;
  if (templateCache.has(fullPath)) {
    content = templateCache.get(fullPath)!;
  } else {
    content = fs.readFileSync(fullPath, 'utf-8');
    templateCache.set(fullPath, content);
  }
  
  let result = content;
  for (const [key, value] of Object.entries(context)) {
    if (value !== undefined) {
      const placeholder = `__${key.toUpperCase()}__`;
      result = result.split(placeholder).join(value);
    }
  }
  
  return result;
}

export function clearTemplateCache(): void {
  templateCache.clear();
}
