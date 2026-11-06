import { createContext, useContext, type ComponentRef, type RefObject } from 'react';
import type { View } from 'react-native';
import { themePreference } from '../state/themePreference';

export type ThemeView = ComponentRef<typeof View>;
export type ThemeAnchor = RefObject<ThemeView | null>;
export const ThemeTransitionContext = createContext({
  busy: false,
  toggleAt: (_anchor: ThemeAnchor) => {
    themePreference.toggle();
  },
});
export function useThemeTransition() {
  return useContext(ThemeTransitionContext);
}
