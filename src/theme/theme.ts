// Match the supplied Liquide screenshots: black, charcoal, white and warm gold.
// Components use semantic roles so future palette changes stay in this file.
const light = {
  bg: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#EEEEF1',
  text: '#17161D',
  muted: '#66656F',
  line: '#DCDCE2',
  inputBorder: '#86858E',
  gain: '#087E46',
  loss: '#C52D40',
  accent: '#FFF2D3',
  accentText: '#925400',
  primary: '#FFC34B',
  buttonText: '#121019',
  gradientStart: '#FFDF55',
  gradientEnd: '#F19A2A',
  summaryStart: '#FFF8E7',
  summaryEnd: '#FFFFFF',
};

const dark: Theme = {
  bg: '#000000',
  card: '#101011',
  elevated: '#25242D',
  text: '#FAFAFC',
  muted: '#A09FA8',
  line: '#303035',
  inputBorder: '#77767E',
  gain: '#39CE87',
  loss: '#FF6879',
  accent: '#282116',
  accentText: '#FFC34B',
  primary: '#FFC34B',
  buttonText: '#121019',
  gradientStart: '#FFDF55',
  gradientEnd: '#F19A2A',
  summaryStart: '#26221B',
  summaryEnd: '#141316',
};

export type Theme = typeof light;

// Keep both palettes available, but default to the dark reference as requested.
export const themes = { light, dark };

// A stable palette preserves memoized row props across price ticks.
export function useTheme(): Theme {
  return themes.dark;
}
