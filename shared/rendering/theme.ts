/**
 * Turning a website's stored global styles into the theme both renderers draw
 * against.
 *
 * The publisher built this object inline while generating a project, so the
 * builder canvas had no way to construct the same one — it resolved tokens its
 * own way and drifted. Both sides now call this.
 *
 * Pure: no Node, no server imports, no I/O.
 */

import type { ThemeConfig } from './types';
import { TOKEN_FALLBACKS, resolveDesignTokens } from '../designTokens';

type GlobalStyles = Parameters<typeof resolveDesignTokens>[0];

/**
 * The theme for a set of global styles.
 *
 * `tokens` carries every design token already resolved, so callers that need
 * them (the publisher writes them into theme.json and globals.css) do not have
 * to resolve twice.
 */
export function themeFromGlobalStyles(globalStyles: GlobalStyles | null | undefined): ThemeConfig {
  const styles = (globalStyles || {}) as NonNullable<GlobalStyles>;
  const resolvedTokens = resolveDesignTokens(styles);

  return {
    primaryColor: resolvedTokens['color.primary'],
    secondaryColor: resolvedTokens['color.secondary'],
    accentColor: resolvedTokens['color.accent'],
    // The body font a section inherits is the resolved token, not the raw
    // stored value: a website that pairs two fonts keeps its body font here
    // and its heading font in the rule globals.css emits.
    fontFamily: resolvedTokens['font.body'],
    headingFontFamily: resolvedTokens['font.heading'],
    backgroundColor: resolvedTokens['color.background'],
    surfaceColor: resolvedTokens['color.surface'],
    textColor: resolvedTokens['color.text'],
    borderRadius: styles.borderRadius || TOKEN_FALLBACKS.borderRadius,
    containerWidth: resolvedTokens['size.container'],
    spacingScale: styles.spacingScale || 'comfortable',
    sectionGap: styles.sectionGap || '0',
    buttonStyle: styles.buttonStyle || 'solid',
    cardStyle: styles.cardStyle || 'elevated',
    tokens: resolvedTokens,
  };
}
