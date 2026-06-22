import {NativeModules} from 'react-native';

export type ThemeMode = 'dark' | 'light';
export type LanguageCode = 'fr' | 'en';

export type TilePackageInfo = {
  id: string;
  name: string;
  path: string;
  isDemo: boolean;
};

export type MbtilesMetadata = {
  path: string;
  mbtilesUrl: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  name: string;
  attribution: string;
  centerLng?: number;
  centerLat?: number;
  centerZoom?: number;
  bounds?: number[];
};

export type GpsPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  provider: string;
};

export type MapPin = {
  id: string;
  category: string;
  status_key: string;
  label: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
};

export const Wayfinder = NativeModules.WayfinderNative as {
  initialize(): Promise<boolean>;
  getAppVersion(): Promise<string>;
  getThemeMode(): Promise<ThemeMode>;
  setThemeMode(mode: ThemeMode): Promise<boolean>;
  getLanguage(): Promise<LanguageCode>;
  setLanguage(language: LanguageCode): Promise<boolean>;
  isPinConfigured(): Promise<boolean>;
  setPin(pin: string): Promise<boolean>;
  verifyPin(pin: string): Promise<boolean>;
  clearPin(): Promise<boolean>;
  getActiveMbtilesPath(): Promise<string | null>;
  getMbtilesMetadata(path: string): Promise<MbtilesMetadata>;
  getCurrentLocation(): Promise<GpsPosition>;
  listTilePackages(): Promise<TilePackageInfo[]>;
  savePin(pin: Omit<MapPin, 'created_at' | 'updated_at'> & Partial<Pick<MapPin, 'created_at' | 'updated_at'>>): Promise<MapPin>;
  listPins(): Promise<MapPin[]>;
  deletePin(pinId: string): Promise<boolean>;
};

export function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}