import type { DesignSystem } from "./websitePlanSchema";

export interface DesignPreset {
  id: string;
  name: string;
  description: string;
  designSystem: DesignSystem;
}

export const DesignPresetRegistry: Record<string, DesignPreset> = {
  luxuryBrand: {
    id: "luxuryBrand",
    name: "Luxury Brand",
    description: "Elegant, high-end aesthetic with minimal colors, serif fonts, airy spacing, and slow subtle animations",
    designSystem: {
      colors: {
        primary: "#1a1a1a",
        secondary: "#2d2d2d",
        accent: "#c9a962",
        background: "#ffffff",
        surface: "#fafafa",
        text: "#1a1a1a",
      },
      typography: {
        headingFont: "Playfair Display",
        bodyFont: "Inter",
        scale: "editorial",
      },
      spacing: {
        section: "airy",
        component: "normal",
      },
      radius: "soft",
      shadow: "subtle",
      motion: {
        style: "subtle",
        speed: "slow",
      },
      tone: "luxury",
    },
  },

  modernSaas: {
    id: "modernSaas",
    name: "Modern SaaS",
    description: "Clean, professional look with blue tech palette, sans-serif fonts, balanced spacing, and smooth animations",
    designSystem: {
      colors: {
        primary: "#3b82f6",
        secondary: "#8b5cf6",
        accent: "#06b6d4",
        background: "#ffffff",
        surface: "#f8fafc",
        text: "#0f172a",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
        scale: "modern",
      },
      spacing: {
        section: "normal",
        component: "normal",
      },
      radius: "soft",
      shadow: "subtle",
      motion: {
        style: "subtle",
        speed: "normal",
      },
      tone: "modern",
    },
  },

  playfulStartup: {
    id: "playfulStartup",
    name: "Playful Startup",
    description: "Vibrant, energetic design with bright colors, rounded corners, generous spacing, and expressive animations",
    designSystem: {
      colors: {
        primary: "#8b5cf6",
        secondary: "#ec4899",
        accent: "#f59e0b",
        background: "#ffffff",
        surface: "#faf5ff",
        text: "#1e1b4b",
      },
      typography: {
        headingFont: "Poppins",
        bodyFont: "Inter",
        scale: "bold",
      },
      spacing: {
        section: "airy",
        component: "normal",
      },
      radius: "rounded",
      shadow: "elevated",
      motion: {
        style: "expressive",
        speed: "normal",
      },
      tone: "playful",
    },
  },

  corporateBusiness: {
    id: "corporateBusiness",
    name: "Corporate Business",
    description: "Professional, trustworthy aesthetic with conservative colors, tight spacing, minimal motion, and square corners",
    designSystem: {
      colors: {
        primary: "#1e40af",
        secondary: "#0f766e",
        accent: "#0284c7",
        background: "#ffffff",
        surface: "#f1f5f9",
        text: "#1e293b",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
        scale: "classic",
      },
      spacing: {
        section: "tight",
        component: "tight",
      },
      radius: "none",
      shadow: "subtle",
      motion: {
        style: "none",
        speed: "normal",
      },
      tone: "corporate",
    },
  },

  minimalStudio: {
    id: "minimalStudio",
    name: "Minimal Studio",
    description: "Ultra-clean design with very few colors, maximum whitespace, no motion, and pure typography focus",
    designSystem: {
      colors: {
        primary: "#18181b",
        secondary: "#3f3f46",
        accent: "#18181b",
        background: "#ffffff",
        surface: "#fafafa",
        text: "#18181b",
      },
      typography: {
        headingFont: "Inter",
        bodyFont: "Inter",
        scale: "editorial",
      },
      spacing: {
        section: "airy",
        component: "airy",
      },
      radius: "none",
      shadow: "none",
      motion: {
        style: "none",
        speed: "slow",
      },
      tone: "minimal",
    },
  },
};

// Helper to get preset by site type
export function getRecommendedPreset(siteType: string): DesignPreset {
  const recommendations: Record<string, string> = {
    saas: "modernSaas",
    ecommerce: "modernSaas",
    brand: "luxuryBrand",
    agency: "minimalStudio",
    portfolio: "minimalStudio",
    clinic: "corporateBusiness",
    restaurant: "luxuryBrand",
    blog: "minimalStudio",
    landing: "modernSaas",
    nonprofit: "corporateBusiness",
    corporate: "corporateBusiness",
    personal: "playfulStartup",
  };

  const presetId = recommendations[siteType] || "modernSaas";
  return DesignPresetRegistry[presetId];
}

// Helper to map spacing style to CSS values
export function getSpacingValues(style: "tight" | "normal" | "airy"): { section: string; component: string } {
  const spacingMap = {
    tight: { section: "60px 24px", component: "16px" },
    normal: { section: "80px 24px", component: "24px" },
    airy: { section: "120px 24px", component: "32px" },
  };
  return spacingMap[style];
}

// Helper to map radius style to CSS values
export function getRadiusValue(style: "none" | "soft" | "rounded"): string {
  const radiusMap = {
    none: "0px",
    soft: "8px",
    rounded: "16px",
  };
  return radiusMap[style];
}

// Helper to map shadow style to CSS values
export function getShadowValue(style: "none" | "subtle" | "elevated"): string {
  const shadowMap = {
    none: "none",
    subtle: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
    elevated: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
  };
  return shadowMap[style];
}

// Helper to map motion settings to animation config
export function getMotionConfig(motion: { style: "none" | "subtle" | "expressive"; speed: "slow" | "normal" | "fast" }): {
  animation: string;
  duration: number;
  delay: number;
} {
  const animations = {
    none: "none",
    subtle: "fade-up",
    expressive: "zoom-in",
  };

  const durations = {
    slow: 0.9,
    normal: 0.6,
    fast: 0.35,
  };

  return {
    animation: animations[motion.style],
    duration: durations[motion.speed],
    delay: 0.1,
  };
}

// Typography scale configurations
export function getTypographyScale(scale: "modern" | "editorial" | "classic" | "bold"): {
  h1: string;
  h2: string;
  h3: string;
  body: string;
  small: string;
} {
  const scales = {
    modern: {
      h1: "clamp(2.5rem, 5vw, 4rem)",
      h2: "clamp(2rem, 4vw, 3rem)",
      h3: "clamp(1.5rem, 3vw, 2rem)",
      body: "1rem",
      small: "0.875rem",
    },
    editorial: {
      h1: "clamp(3rem, 6vw, 5rem)",
      h2: "clamp(2.25rem, 4.5vw, 3.5rem)",
      h3: "clamp(1.75rem, 3.5vw, 2.5rem)",
      body: "1.125rem",
      small: "0.9375rem",
    },
    classic: {
      h1: "clamp(2.25rem, 4.5vw, 3.5rem)",
      h2: "clamp(1.875rem, 3.75vw, 2.75rem)",
      h3: "clamp(1.5rem, 3vw, 2rem)",
      body: "1rem",
      small: "0.875rem",
    },
    bold: {
      h1: "clamp(3.5rem, 7vw, 6rem)",
      h2: "clamp(2.5rem, 5vw, 4rem)",
      h3: "clamp(1.875rem, 3.75vw, 2.5rem)",
      body: "1.125rem",
      small: "1rem",
    },
  };
  return scales[scale];
}
