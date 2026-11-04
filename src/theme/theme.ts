import { useColorScheme } from 'react-native';

const light = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  text: '#152C28',
  muted: '#667771',
  line: '#E5EBE8',
  gain: '#087E5B',
  loss: '#C13D49',
  accent: '#DDF5EB',
};
const dark: Theme = {
  bg: '#0C1715',
  card: '#14241F',
  text: '#F0F7F3',
  muted: '#A0B6AC',
  line: '#293F36',
  gain: '#6EE7B7',
  loss: '#FF8F9C',
  accent: '#203E32',
};

export type Theme = typeof light;

// Keep palettes outside components so their object identity stays stable.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
