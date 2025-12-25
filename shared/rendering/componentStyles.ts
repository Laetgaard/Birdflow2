import type { ComponentStyles, ThemeConfig } from './types';

export function getBaseStyles(
  styles: ComponentStyles,
  theme?: ThemeConfig,
  isSelected?: boolean,
  isPreview?: boolean
): Record<string, string | number | undefined> {
  return {
    backgroundColor: styles.backgroundColor || theme?.backgroundColor,
    color: styles.textColor,
    padding: styles.padding || '60px 24px',
    cursor: isPreview ? 'default' : 'pointer',
    outline: isSelected ? '3px solid #3b82f6' : 'none',
    outlineOffset: '-3px',
    position: 'relative',
  };
}

export function mergeThemeWithStyles(
  styles: ComponentStyles,
  theme?: ThemeConfig
): ComponentStyles {
  return {
    ...styles,
    backgroundColor: styles.backgroundColor || theme?.backgroundColor,
  };
}
