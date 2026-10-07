export const chiefTheme = {
  color: {
    background: '#021209',
    surface: '#041a10',
    surfaceRaised: '#072317',
    surfaceSoft: '#0a2c1c',
    border: '#0f3b23',
    borderStrong: '#1b5e38',
    accent: '#34d399',
    accentStrong: '#10b981',
    text: '#f0fdf4',
    textMuted: '#a7f3d0',
    textDim: '#6ee7b7',
    warning: '#f59e0b',
    critical: '#f43f5e',
    danger: '#ef4444',
    info: '#38bdf8',
    offline: '#94a3b8'
  },
  radius: {
    sm: '10px',
    md: '14px',
    lg: '18px',
    pill: '999px'
  },
  shadow: {
    card: '0 12px 30px rgba(0,0,0,0.26)',
    nav: '0 -4px 20px rgba(0,0,0,0.5)',
    accent: '0 0 18px rgba(52,211,153,0.18)'
  },
  touchTarget: '48px'
} as const;

export type ChiefTheme = typeof chiefTheme;
