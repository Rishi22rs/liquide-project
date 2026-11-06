import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createThemePreference } from '../domain/themePreference';

export const themePreference = createThemePreference(AsyncStorage);
export function useThemeMode() {
  return useSyncExternalStore(themePreference.subscribe, themePreference.getSnapshot);
}
