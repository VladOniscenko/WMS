export type ThemeId = 'editorial' | 'minimal' | 'playful'

export interface ThemePalette {
  primary: string
  secondary: string
  background: string
  surface: string
  text: string
  muted: string
  accent: string
}

export interface FontPairing {
  name: string
  heading: string
  body: string
  headingFamily: string
  bodyFamily: string
}

export interface ThemeConfig {
  id: ThemeId
  name: string
  tagline: string
  description: string
  layoutVariant: 'split' | 'centered' | 'cards'
  headerStyle: 'sticky' | 'transparent' | 'solid'
  heroLayout: 'full-bleed' | 'centered'
  cardStyle: 'rounded' | 'flat' | 'bordered'
  fontPairing: FontPairing
  palette: ThemePalette
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  editorial: {
    id: 'editorial',
    name: 'Editorial Studio',
    tagline: 'Bold, cultured, and magazine-inspired typography.',
    description: 'An elegant editorial design with full-bleed hero banners, serif headlines, and warm terracotta hues.',
    layoutVariant: 'split',
    headerStyle: 'sticky',
    heroLayout: 'full-bleed',
    cardStyle: 'rounded',
    fontPairing: {
      name: 'Playfair & DM Sans',
      heading: 'Playfair Display',
      body: 'DM Sans',
      headingFamily: "'Playfair Display', Georgia, serif",
      bodyFamily: "'DM Sans', sans-serif",
    },
    palette: {
      primary: '#b77962',
      secondary: '#3e2e33',
      background: '#f7f6f3',
      surface: '#ffffff',
      text: '#242126',
      muted: '#817a85',
      accent: '#e0a68d',
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal Atelier',
    tagline: 'Quiet, architectural, and hyper-refined.',
    description: 'A disciplined Swiss-modern design with crisp hairline borders, centered compositions, and calm taupe accents.',
    layoutVariant: 'centered',
    headerStyle: 'solid',
    heroLayout: 'centered',
    cardStyle: 'bordered',
    fontPairing: {
      name: 'Inter Sans',
      heading: 'Inter',
      body: 'Inter',
      headingFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      bodyFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    },
    palette: {
      primary: '#3f3b39',
      secondary: '#9b8b7a',
      background: '#faf9f7',
      surface: '#ffffff',
      text: '#1c1917',
      muted: '#78716c',
      accent: '#d6cec7',
    },
  },
  playful: {
    id: 'playful',
    name: 'Playful Pop',
    tagline: 'Bright, expressive, and tactile.',
    description: 'A vibrant modern look featuring floating transparent headers, soft pastel surfaces, and energetic rose highlights.',
    layoutVariant: 'cards',
    headerStyle: 'transparent',
    heroLayout: 'centered',
    cardStyle: 'flat',
    fontPairing: {
      name: 'DM Sans Rounded',
      heading: 'DM Sans',
      body: 'DM Sans',
      headingFamily: "'DM Sans', sans-serif",
      bodyFamily: "'DM Sans', sans-serif",
    },
    palette: {
      primary: '#c26d8b',
      secondary: '#783d58',
      background: '#fdf8fa',
      surface: '#ffffff',
      text: '#2b1e25',
      muted: '#967b88',
      accent: '#fbcfe8',
    },
  },
}

export function getTheme(themeId?: string): ThemeConfig {
  if (themeId && themeId in THEMES) {
    return THEMES[themeId as ThemeId]
  }
  return THEMES.editorial
}

