/**
 * 11 Gol — FIFA World Cup 2026 design system.
 * Dark-first palette. Tournament brand: black / white / gold (#D4AF37)
 * with per-host-country accent families (USA blue, Mexico green, Canada red).
 */

export const palette = {
  bg: '#0A0E1A', // near-black deep navy (page background)
  surface: '#141929', // elevated surface
  card: '#1E2540', // card background
  cardElevated: '#252D4F',
  gold: '#D4AF37', // primary accent
  goldDim: 'rgba(212,175,55,0.12)',
  goldGlow: 'rgba(212,175,55,0.28)',
  text: '#F5F5F5', // primary text
  textSecondary: '#8A9BB5', // secondary text
  textTertiary: '#5A6684', // muted
  border: 'rgba(255,255,255,0.08)',
  border2: 'rgba(255,255,255,0.14)',
  glass: 'rgba(30,37,64,0.55)',
  glassBorder: 'rgba(255,255,255,0.10)',
  live: '#E24B4A', // live / danger red
  liveDim: 'rgba(226,75,74,0.16)',
  success: '#639922',
  white: '#FFFFFF',
  black: '#000000',
} as const;

/** Host-country accent families. */
export const hostColors = {
  USA: { primary: '#185FA5', bright: '#378ADD', soft: '#B5D4F4', emoji: '🇺🇸' },
  Mexico: { primary: '#3B6D11', bright: '#639922', soft: '#C0DD97', emoji: '🇲🇽' },
  Canada: { primary: '#A32D2D', bright: '#E24B4A', soft: '#F7C1C1', emoji: '🇨🇦' },
} as const;

export type HostCountry = keyof typeof hostColors;

export function hostOf(country: string): HostCountry {
  const c = country.toLowerCase();
  if (c.startsWith('mex')) return 'Mexico';
  if (c.startsWith('can')) return 'Canada';
  return 'USA';
}

/** Confederation accent (small dots / labels). */
export const confederationColor: Record<string, string> = {
  UEFA: '#378ADD',
  CONMEBOL: '#D4AF37',
  CONCACAF: '#639922',
  CAF: '#E24B4A',
  AFC: '#9B6BDF',
  OFC: '#46C6B8',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  // System fonts; display weight used for hero headings.
  display: '900' as const,
  bold: '700' as const,
  semibold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
};

/** Stage display metadata. */
export const stageMeta: Record<
  string,
  { label: string; labelEs: string; short: string }
> = {
  group: { label: 'Group Stage', labelEs: 'Fase de Grupos', short: 'GRP' },
  r32: { label: 'Round of 32', labelEs: 'Dieciseisavos', short: 'R32' },
  r16: { label: 'Round of 16', labelEs: 'Octavos', short: 'R16' },
  qf: { label: 'Quarter-finals', labelEs: 'Cuartos', short: 'QF' },
  sf: { label: 'Semi-finals', labelEs: 'Semifinales', short: 'SF' },
  third: { label: 'Third Place', labelEs: 'Tercer Puesto', short: '3RD' },
  final: { label: 'Final', labelEs: 'Final', short: 'FINAL' },
};
