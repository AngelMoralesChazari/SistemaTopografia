export const LAB_ID_DEFAULT = 'lab-topo-uagro';

export const theme = {
  color: {
    navy: '#19315F',
    navyHover: '#142847',
    navy2: '#12365F',
    red: '#D90429',
    redSoft: '#fff0f2',
    canvas: '#F8F9FA',
    canvasMobile: '#FBFCFD',
    surface: '#FFFFFF',
    ink: '#17212B',
    muted: '#718092',
    line: '#E5E9EF',
    success: '#16855B',
    successSoft: '#EAF8F1',
    info: '#2266D8',
    infoSoft: '#EDF4FF',
    warning: '#A76A00',
    warningSoft: '#FFF5D6',
    delivered: '#7463BD',
    deliveredSoft: '#F1EFFD',
    sidebarText: '#B7C7D9',
    sidebarMuted: '#7990A9',
    grey: '#DFE4E9',
  },
  radius: {
    sm: 6,
    md: 9,
    lg: 14,
    pill: 20,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  font: {
    sans: 'System',
    size: {
      xs: 12,
      sm: 13,
      md: 14,
      lg: 16,
      xl: 20,
      xxl: 24,
      display: 32,
    },
  },

  shadow: {
    soft: {
      shadowColor: 'rgba(25, 49, 95, 0.06)',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 2,
    },
    md: {
      shadowColor: 'rgba(25, 49, 95, 0.08)',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 4,
    },
  },
} as const;

export type Theme = typeof theme;
