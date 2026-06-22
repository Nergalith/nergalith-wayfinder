import {NativeModules} from 'react-native';

export type ThemeMode = 'dark' | 'light';
export type LanguageCode = 'fr' | 'en';

export type TilePackageInfo = {
  id: string;
  name: string;
  path: string;
  isDemo: boolean;
};

export const Wayfinder = NativeModules.WayfinderNative as {
  initialize(): Promise<boolean>;
  getThemeMode(): Promise<ThemeMode>;
  setThemeMode(mode: ThemeMode): Promise<boolean>;
  getLanguage(): Promise<LanguageCode>;
  setLanguage(language: LanguageCode): Promise<boolean>;
  isPinConfigured(): Promise<boolean>;
  setPin(pin: string): Promise<boolean>;
  verifyPin(pin: string): Promise<boolean>;
  clearPin(): Promise<boolean>;
  getActiveMbtilesPath(): Promise<string | null>;
  listTilePackages(): Promise<TilePackageInfo[]>;
  getAppVersion(): Promise<string>;
};

export function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}