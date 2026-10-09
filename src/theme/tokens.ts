// Brand colours approved from the web app: primary #20C2F3, navy #00305D.
export const palette = {
  brand: '#20C2F3',
  navy: '#00305D',
  white: '#FFFFFF',
  gray50: '#F7F9FB',
  gray200: '#E3E8EE',
  gray500: '#6B7785',
  gray900: '#16202B',
  danger: '#C62828',
  success: '#2E7D32',
  warning: '#B26A00',
} as const;

export const colors = {
  primary: palette.brand,
  onPrimary: palette.navy,
  secondary: palette.navy,
  onSecondary: palette.white,
  background: palette.white,
  surface: palette.gray50,
  border: palette.gray200,
  text: palette.gray900,
  textMuted: palette.gray500,
  danger: palette.danger,
  success: palette.success,
  warning: palette.warning,
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const typography = {
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

export const theme = { colors, spacing, radius, typography } as const;
export type Theme = typeof theme;
