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

export type CompassHeading = {
  heading: number;
  cardinal: string;
};

export type TrackPoint = {
  id: number;
  latitude: number;
  longitude: number;
  recorded_at: string;
};

export type ActiveRoute = {
  id: string;
  name: string;
  pin_ids: string[];
  created_at: string;
};

export type ExportResult = {
  exportId: string;
  jsonFilename: string;
  kmlFilename: string;
  jsonPath: string;
  kmlPath: string;
  jsonUri: string;
  kmlUri: string;
  pinCount: number;
  trackPointCount: number;
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
  setActiveMbtilesPath(path: string): Promise<boolean>;
  getSideloadTilesPath(): Promise<string>;
  getDeviceId(): Promise<string>;
  getMbtilesMetadata(path: string): Promise<MbtilesMetadata>;
  getCurrentLocation(): Promise<GpsPosition>;
  listTilePackages(): Promise<TilePackageInfo[]>;
  savePin(pin: Omit<MapPin, 'created_at' | 'updated_at'> & Partial<Pick<MapPin, 'created_at' | 'updated_at'>>): Promise<MapPin>;
  listPins(): Promise<MapPin[]>;
  deletePin(pinId: string): Promise<boolean>;
  startCompass(): Promise<boolean>;
  stopCompass(): Promise<boolean>;
  getCompassHeading(): Promise<CompassHeading>;
  appendTrackPoint(latitude: number, longitude: number): Promise<TrackPoint>;
  listTrackPoints(): Promise<TrackPoint[]>;
  clearTrackPoints(): Promise<boolean>;
  appendPinToRoute(pinId: string): Promise<ActiveRoute>;
  getActiveRoute(): Promise<ActiveRoute>;
  clearRoute(): Promise<boolean>;
  exportAar(): Promise<ExportResult>;
};

export function messageFrom(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}