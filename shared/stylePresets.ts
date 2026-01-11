import type { DesignTokens, StylePreset } from './schema';

export const stylePresets: Record<StylePreset, DesignTokens> = {
  modern: {
    primaryColor: '#3B82F6',
    secondaryColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontPair: { heading: 'Inter', body: 'Inter' },
    borderRadius: '12px',
    spacingScale: 'comfortable',
    sectionGap: '80px',
    buttonStyle: 'solid',
    cardStyle: 'elevated',
  },

  luxury: {
    primaryColor: '#D4AF37',
    secondaryColor: '#9D7D2F',
    backgroundColor: '#0A0A0A',
    textColor: '#F5F5F5',
    fontFamily: 'Playfair Display, Georgia, serif',
    fontPair: { heading: 'Playfair Display', body: 'Lato' },
    borderRadius: '4px',
    spacingScale: 'spacious',
    sectionGap: '120px',
    buttonStyle: 'outline',
    cardStyle: 'bordered',
  },

  playful: {
    primaryColor: '#EC4899',
    secondaryColor: '#8B5CF6',
    backgroundColor: '#FDF4FF',
    textColor: '#1F2937',
    fontFamily: 'Poppins, system-ui, sans-serif',
    fontPair: { heading: 'Poppins', body: 'Nunito' },
    borderRadius: '24px',
    spacingScale: 'comfortable',
    sectionGap: '64px',
    buttonStyle: 'gradient',
    cardStyle: 'elevated',
  },

  corporate: {
    primaryColor: '#0F172A',
    secondaryColor: '#334155',
    backgroundColor: '#F8FAFC',
    textColor: '#0F172A',
    fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
    fontPair: { heading: 'IBM Plex Sans', body: 'IBM Plex Sans' },
    borderRadius: '8px',
    spacingScale: 'comfortable',
    sectionGap: '96px',
    buttonStyle: 'solid',
    cardStyle: 'bordered',
  },

  minimal: {
    primaryColor: '#18181B',
    secondaryColor: '#52525B',
    backgroundColor: '#FAFAFA',
    textColor: '#18181B',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontPair: { heading: 'Inter', body: 'Inter' },
    borderRadius: '6px',
    spacingScale: 'compact',
    sectionGap: '48px',
    buttonStyle: 'ghost',
    cardStyle: 'flat',
  },

  custom: {
    primaryColor: '#4F46E5',
    secondaryColor: '#6366F1',
    backgroundColor: '#FFFFFF',
    textColor: '#1F2937',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontPair: { heading: 'Inter', body: 'Inter' },
    borderRadius: '8px',
    spacingScale: 'comfortable',
    sectionGap: '64px',
    buttonStyle: 'solid',
    cardStyle: 'elevated',
  },
};

export const defaultDesignTokens: DesignTokens = stylePresets.modern;

export function getPresetTokens(preset: StylePreset): DesignTokens {
  return stylePresets[preset] || stylePresets.modern;
}

export function migrateOldGlobalStyles(oldStyles: {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  backgroundColor?: string;
}): DesignTokens {
  return {
    primaryColor: oldStyles.primaryColor || defaultDesignTokens.primaryColor,
    secondaryColor: oldStyles.secondaryColor || defaultDesignTokens.secondaryColor,
    backgroundColor: oldStyles.backgroundColor || defaultDesignTokens.backgroundColor,
    textColor: defaultDesignTokens.textColor,
    fontFamily: oldStyles.fontFamily || defaultDesignTokens.fontFamily,
    borderRadius: defaultDesignTokens.borderRadius,
    spacingScale: defaultDesignTokens.spacingScale,
    sectionGap: defaultDesignTokens.sectionGap,
    buttonStyle: defaultDesignTokens.buttonStyle,
    cardStyle: defaultDesignTokens.cardStyle,
  };
}

export const presetDescriptions: Record<StylePreset, { name: string; description: string; keywords: string[] }> = {
  modern: {
    name: 'Modern',
    description: 'Clean, professional design with blue accents and comfortable spacing',
    keywords: ['tech', 'startup', 'saas', 'app', 'software', 'digital'],
  },
  luxury: {
    name: 'Luxury',
    description: 'Elegant dark theme with gold accents and refined typography',
    keywords: ['premium', 'high-end', 'boutique', 'jewelry', 'real estate', 'fashion'],
  },
  playful: {
    name: 'Playful',
    description: 'Vibrant gradients with rounded elements and energetic feel',
    keywords: ['creative', 'kids', 'entertainment', 'games', 'social', 'lifestyle'],
  },
  corporate: {
    name: 'Corporate',
    description: 'Professional, trustworthy design for enterprise and B2B',
    keywords: ['business', 'finance', 'consulting', 'law', 'corporate', 'enterprise'],
  },
  minimal: {
    name: 'Minimal',
    description: 'Clean, distraction-free design focusing on content',
    keywords: ['portfolio', 'blog', 'personal', 'artist', 'writer', 'simple'],
  },
  custom: {
    name: 'Custom',
    description: 'Fully customizable design tokens',
    keywords: [],
  },
};
