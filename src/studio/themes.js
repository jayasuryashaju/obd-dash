// Studio visual styles. `shape` picks the blade artwork; colours become CSS
// variables on the Studio root so every widget follows the theme.

export const THEMES = {
  redline: {
    name: 'Redline', desc: 'Carbon dial, slanted red blades', shape: 'slant', carbon: true,
    acc: '#ff2b3a', glow: '#ff2b3a55',
  },
  toxic: {
    name: 'Toxic', desc: 'Carbon dial, acid-green chevrons', shape: 'chevron', carbon: true,
    acc: '#3dff63', glow: '#3dff6355',
  },
  volt: {
    name: 'Volt', desc: 'Solid yellow face, block blades', shape: 'block', solid: true,
    acc: '#ffe014', glow: '#ffe01455',
  },
  blaze: {
    name: 'Blaze', desc: 'Double ring of orange blades', shape: 'double',
    acc: '#ff7a1a', glow: '#ff7a1a55',
  },
  phantom: {
    name: 'Phantom', desc: 'Matte black, white knife blades', shape: 'knife',
    acc: '#f1f3f5', glow: '#ffffff40',
  },
  glacier: {
    name: 'Glacier', desc: 'Cyan neon segments', shape: 'block',
    acc: '#1fd5ff', glow: '#1fd5ff55',
  },
};

export const THEME_IDS = Object.keys(THEMES);

/** CSS custom properties for a theme in dark or light mode. */
export function themeVars(id, light) {
  const t = THEMES[id] || THEMES.toxic;
  if (light) {
    return {
      '--acc': t.acc === '#f1f3f5' ? '#1b1d21' : t.acc,
      '--glow': t.glow,
      '--bg': '#e6e9ed',
      '--bg2': '#f6f7f9',
      '--face': t.solid ? t.acc : '#ffffff',
      '--ring': t.acc === '#f1f3f5' ? '#1b1d21' : t.acc,
      '--off': '#d3d8de',
      '--tick': '#9aa2ad',
      '--txt': '#111418',
      '--ftxt': '#111418',
      '--sub': '#5e6670',
      '--fsub': t.solid ? '#3a3a3a' : '#5e6670',
      '--panel': 'rgba(255,255,255,0.92)',
      '--line': '#c9cfd6',
    };
  }
  return {
    '--acc': t.acc,
    '--glow': t.glow,
    '--bg': '#050607',
    '--bg2': '#0d0f12',
    '--face': t.solid ? t.acc : t.carbon ? 'url(#st-carbon)' : '#0b0c0e',
    '--ring': t.acc,
    '--off': 'rgba(255,255,255,0.07)',
    '--tick': 'rgba(255,255,255,0.55)',
    '--txt': '#f4f6f8',
    '--ftxt': t.solid ? '#111' : '#f4f6f8',
    '--sub': 'rgba(235,240,245,0.55)',
    '--fsub': t.solid ? 'rgba(0,0,0,0.6)' : 'rgba(235,240,245,0.55)',
    '--panel': 'rgba(14,16,19,0.94)',
    '--line': 'rgba(255,255,255,0.12)',
  };
}
