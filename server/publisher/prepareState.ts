import type { BuilderStateData } from '../../shared/schema';
import type { ThemeConfig } from '../../shared/rendering/types';
import { TOKEN_FALLBACKS, resolveDesignTokens, resolveTokensDeep } from '../../shared/designTokens';
import { sanitizeBuilderStateCustomContent } from '../../shared/customComponents';
import { normalizePages } from './normalize';

/** Shared data preparation for emitted pages and the generated preview. */
export function preparePublishedState(state: BuilderStateData) {
  let processedBuilderState = structuredClone(state);
  const globalStyles = processedBuilderState.globalStyles || {};

  // A style may point at the brand ("{color.primary}") rather than repeat it.
  // Generated projects cannot import from @shared, so rather than shipping a
  // second copy of the resolver that could drift from the editor's, the
  // references are resolved here — with the same shared function the builder
  // preview uses — and the project receives finished values.
  //
  // This happens BEFORE sanitising, so a resolved brand value is subject to
  // the same checks as anything else that reaches a generated stylesheet.
  const resolvedTokens = resolveDesignTokens(globalStyles);
  processedBuilderState = {
    ...processedBuilderState,
    pages: resolveTokensDeep(processedBuilderState.pages, resolvedTokens),
    // The shared header and footer are drawn on every page, so they go
    // through the same resolution as the sections around them.
    ...(processedBuilderState.siteChrome
      ? { siteChrome: resolveTokensDeep(processedBuilderState.siteChrome, resolvedTokens) }
      : {}),
  };

  // Defense in depth: strip unsafe SVG markup from custom components even if
  // an unsanitized tree made it into the stored state.
  processedBuilderState = sanitizeBuilderStateCustomContent(processedBuilderState);

  // Normalise component props: coerce known enum drifts (e.g. alignment
  // "middle" → "center") and apply legacy field renames so that old websites
  // don't surface avoidable Zod validation errors.
  processedBuilderState = {
    ...processedBuilderState,
    pages: normalizePages(
      processedBuilderState.pages as Array<{ name?: string; components?: unknown[] }>,
    ) as typeof processedBuilderState.pages,
  };

  const theme: ThemeConfig = {
    primaryColor: resolvedTokens['color.primary'],
    secondaryColor: resolvedTokens['color.secondary'],
    accentColor: resolvedTokens['color.accent'],
    // The body font a section inherits is the resolved token, not the raw
    // stored value: a website that pairs two fonts keeps its body font here
    // and its heading font in the rule globals.css emits, exactly as the
    // builder preview does.
    fontFamily: resolvedTokens['font.body'],
    headingFontFamily: resolvedTokens['font.heading'],
    backgroundColor: resolvedTokens['color.background'],
    surfaceColor: resolvedTokens['color.surface'],
    textColor: resolvedTokens['color.text'],
    borderRadius: globalStyles.borderRadius || TOKEN_FALLBACKS.borderRadius,
    containerWidth: resolvedTokens['size.container'],
    spacingScale: globalStyles.spacingScale || 'comfortable',
    sectionGap: globalStyles.sectionGap || '0',
    buttonStyle: globalStyles.buttonStyle || 'solid',
    cardStyle: globalStyles.cardStyle || 'elevated',
    tokens: resolvedTokens,
  };

  return { state: processedBuilderState, theme };
}
