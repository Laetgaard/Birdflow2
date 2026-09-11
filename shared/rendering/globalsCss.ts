/**
 * The stylesheet a published site loads, and the one the builder canvas draws
 * into.
 *
 * This used to live in server/publisher/templates.ts, where only the publisher
 * could reach it. The builder preview therefore inherited the builder app's own
 * Tailwind and shadcn CSS instead — a different cascade from the one the
 * customer's visitors get. Now both sides render against these exact bytes.
 *
 * Pure: no Node, no server imports, no I/O.
 */

import type { ThemeConfig } from './types';
import { REDUCED_MOTION_QUERY } from './contract';
import { resolveApprovedFontStack } from '../fonts';
import { resolveDesignTokens } from '../designTokens';

export function generateGlobalsCss(theme?: ThemeConfig): string {
  // The brand, resolved once. `theme.tokens` is what the publisher computed
  // from the website's design tokens; deriving it here as well only matters
  // for older callers that hand over a bare theme.
  const tokens: Record<string, string> =
    theme?.tokens ||
    resolveDesignTokens({
      primaryColor: theme?.primaryColor,
      secondaryColor: theme?.secondaryColor,
      accentColor: theme?.accentColor,
      backgroundColor: theme?.backgroundColor,
      surfaceColor: theme?.surfaceColor,
      textColor: theme?.textColor,
      fontFamily: theme?.fontFamily,
      borderRadius: theme?.borderRadius,
      spacingScale: theme?.spacingScale,
      sectionGap: theme?.sectionGap,
      containerWidth: theme?.containerWidth,
    });

  const fontFamily = resolveApprovedFontStack(theme?.fontFamily || tokens['font.body']);
  // Sections set the body font on themselves and let their headings inherit
  // it, so a website that pairs a heading font with a different body font
  // needs a rule of its own. The builder preview emits the same rule, scoped
  // to its section wrapper. Sites using one font get nothing extra.
  const headingFont = resolveApprovedFontStack(tokens['font.heading']);
  const headingFontRule =
    headingFont && headingFont !== fontFamily
      ? `
h1, h2, h3, h4, h5, h6 {
  font-family: var(--bf-font-heading);
}
`
      : '';
  const primaryColor = tokens['color.primary'];
  const secondaryColor = tokens['color.secondary'];
  const backgroundColor = tokens['color.background'];
  const textColor = tokens['color.text'];
  const borderRadius = tokens['radius.md'];

  // Every role as a CSS variable, so the published site can restyle from the
  // brand the same way the editor does instead of only through the handful
  // of variables the first version of this file happened to emit.
  const tokenVars = Object.entries(tokens)
    .map(([path, value]) => `  --bf-${path.replace(/\./g, '-')}: ${value};`)
    .join('\n');

  return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
${tokenVars}
  --primary-color: ${primaryColor};
  --secondary-color: ${secondaryColor};
  --background-color: ${backgroundColor};
  --text-color: ${textColor};
  --border-radius: ${borderRadius};
  --font-family: ${fontFamily};
}

body {
  font-family: var(--font-family);
  line-height: 1.5;
  background-color: var(--background-color);
  color: var(--text-color);
}
${headingFontRule}
a {
  color: inherit;
  text-decoration: none;
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
  border-radius: var(--border-radius);
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: white;
  border-radius: var(--border-radius);
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  font-family: var(--font-family);
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.btn-secondary:hover {
  opacity: 0.9;
}

.card {
  border-radius: var(--border-radius);
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Animation keyframes for component entrance animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideLeft { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes zoomOut { from { opacity: 0; transform: scale(1.1); } to { opacity: 1; transform: scale(1); } }
@keyframes bounce { 
  0% { opacity: 0; transform: translateY(30px); }
  60% { opacity: 1; transform: translateY(-10px); }
  80% { transform: translateY(5px); }
  100% { transform: translateY(0); }
}
@keyframes flip { 
  from { opacity: 0; transform: perspective(400px) rotateX(90deg); } 
  to { opacity: 1; transform: perspective(400px) rotateX(0); }
}
@keyframes staggerFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

/* A visitor who has asked their system for less motion gets the finished
   page, not entrance animations. */
@media (${REDUCED_MOTION_QUERY}) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  /* Entrance motion renders server-side in its hidden state (inline
     opacity/transform). Before hydration flips it off for reduced-motion
     visitors, this rule already shows the finished layout. */
  [data-motion] {
    opacity: 1 !important;
    transform: none !important;
  }
}
`;
}
