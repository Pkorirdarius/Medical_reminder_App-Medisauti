export const COLORS = {
  primary:        '#00513f',
  primaryContainer: '#006b54',
  onPrimaryContainer: '#94e8cb',
  primaryFixed:   '#9ef3d6',

  secondary:       '#27609d',
  secondaryContainer: '#89bcff',
  onSecondaryFixedVariant: '#004882',

  background:      '#f9faf5',
  surfaceLowest:   '#ffffff',
  surfaceLow:      '#f3f4f0',
  surfaceHigh:     '#e8e8e4',

  onSurface:       '#1a1c1a',
  onSurfaceVariant:'#3e4944',
  outline:         '#6f7a74',

  error:           '#ba1a1a',
  warning:         '#BA7517',
  errorContainer:  '#ffdad6',
  errorMuted:      'rgba(186,26,26,0.30)',

  teal:     { 50: '#E1F5EE', 100: '#9FE1CB', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041' },
  amber:    { 50: '#FAEEDA', 400: '#BA7517', 800: '#633806' },
  red:      { 50: '#FCEBEB', 400: '#E24B4A', 800: '#791F1F' },
  green:    { 50: '#EAF3DE', 400: '#639922', 500: '#4D7A1A', 800: '#27500A' },
  goal:     { 50: '#EAF3DE', 500: '#4D7A1A', 600: '#3A6312', 700: '#2A4D0C' },
  blue:     { 50: '#E6F1FB', 400: '#378ADD', 800: '#0C447C' },
  gray:     { 50: '#F1EFE8', 100: '#D3D1C7', 200: '#B4B2A9', 600: '#5F5E5A', 800: '#444441' },
  white:    '#FFFFFF',
  text:     { primary: '#1A1A18', secondary: '#5F5E5A', hint: '#B4B2A9' },
  cardShadow: '#000',
};

export const DARK_COLORS = {
  primary:        '#5ed4b0',
  primaryContainer: '#006b54',
  onPrimaryContainer: '#94e8cb',
  primaryFixed:   '#1d9e75',

  secondary:       '#89bcff',
  secondaryContainer: '#004882',
  onSecondaryFixedVariant: '#d6e8ff',

  background:      '#0d1117',
  surfaceLowest:   '#161b22',
  surfaceLow:      '#1c2333',
  surfaceHigh:     '#2d3748',

  onSurface:       '#e6edf3',
  onSurfaceVariant:'#b1bac4',
  outline:         '#8b949e',

  error:           '#ff6b6b',
  warning:         '#ffa94d',
  errorContainer:  '#4a1a1a',
  errorMuted:      'rgba(255,107,107,0.30)',

  teal:     { 50: '#0d2822', 100: '#1a4d3d', 400: '#5ed4b0', 600: '#3aa88a', 800: '#1d7a61' },
  amber:    { 50: '#332206', 400: '#ffa94d', 800: '#ffd599' },
  red:      { 50: '#3a1111', 400: '#ff6b6b', 800: '#ff9999' },
  green:    { 50: '#1a3311', 400: '#4caf50', 500: '#66bb6a', 800: '#a5d6a7' },
  goal:     { 50: '#1a3311', 500: '#66bb6a', 600: '#4caf50', 700: '#388e3c' },
  blue:     { 50: '#0d2137', 400: '#58a6ff', 800: '#79b8ff' },
  gray:     { 50: '#21262d', 100: '#30363d', 200: '#484f58', 600: '#8b949e', 800: '#c9d1d9' },
  white:    '#ffffff',
  text:     { primary: '#e6edf3', secondary: '#8b949e', hint: '#484f58' },
  cardShadow: '#000',
};

export const FONT = {
  headline: 'Lexend-ExtraBold',
  bold:     'Lexend-Bold',
  semibold: 'Lexend-SemiBold',
  medium:   'Lexend-Medium',
  body:     'PublicSans',
  bodyMedium: 'PublicSans-Medium',
  bodySemiBold: 'PublicSans-SemiBold',
  bodyBold: 'PublicSans-Bold',
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  pill: 100,
};

export const SHADOW = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 8 },
};
