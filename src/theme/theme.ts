import { useColorScheme } from 'react-native';

// Shared color roles keep new screens consistent with the reference app.
// Gold is for actions/selection; green and red are reserved for price movements.
const light = {
  bg: '#FFFFFF',
  card: '#F7F7F8',
  elevated: '#EEEEF1',
  text: '#17161D',
  muted: '#66656F',
  line: '#DCDCE2',
  inputBorder: '#86858E',
  gain: '#087E46',
  loss: '#C52D40',
  accent: '#FFF2D3',
  accentText: '#925400',
  gold: '#FFC34B',
  purple: '#6045FF',
  buttonText: '#121019',
  gradientStart: '#FFDF55',
  gradientEnd: '#F19A2A',
  summaryStart: '#FFF8E7',
  summaryEnd: '#F7F7F8',
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
  gold: '#FFC34B',
  purple: '#7560FF',
  buttonText: '#121019',
  gradientStart: '#FFDF55',
  gradientEnd: '#F19A2A',
  summaryStart: '#332A19',
  summaryEnd: '#141316',
};

export type Theme = typeof light;

// Stable palettes preserve memoized row props across price ticks.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
