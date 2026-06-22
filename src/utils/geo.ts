import type {MapPin} from './wayfinder';

export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_000;

export function ownPositionFeature(latitude: number, longitude: number) {
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Point' as const,
      coordinates: [longitude, latitude] as LngLat,
    },
    properties: {},
  };
}

export function pinsFeatureCollection(pins: MapPin[]) {
  return {
    type: 'FeatureCollection' as const,
    features: pins.map(pin => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pin.longitude, pin.latitude] as LngLat,
      },
      properties: {
        id: pin.id,
        category: pin.category,
        status_key: pin.status_key,
        label: pin.label,
        icon: `pin-${pin.category}-${pin.status_key}`,
      },
    })),
  };
}

export function lineStringFeature(
  coordinates: LngLat[],
  properties: Record<string, string | number> = {},
) {
  if (coordinates.length < 2) {
    return null;
  }
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates,
    },
    properties,
  };
}

export function trackLineFeature(points: Array<{latitude: number; longitude: number}>) {
  const coordinates = points.map(point => [point.longitude, point.latitude] as LngLat);
  return lineStringFeature(coordinates, {kind: 'track'});
}

export function routeLineFeature(pins: MapPin[], pinIds: string[]) {
  const pinById = new Map(pins.map(pin => [pin.id, pin]));
  const coordinates = pinIds
    .map(pinId => pinById.get(pinId))
    .filter((pin): pin is MapPin => pin != null)
    .map(pin => [pin.longitude, pin.latitude] as LngLat);
  return lineStringFeature(coordinates, {kind: 'route'});
}

export function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingDegrees(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  const lat1 = toRadians(fromLat);
  const lat2 = toRadians(toLat);
  const dLng = toRadians(toLng - fromLng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function cardinalFromDegrees(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;
  const cards = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return cards[Math.round(normalized / 45) % 8];
}

export function formatDistanceMeters(distanceMeters: number, language: 'fr' | 'en'): string {
  if (distanceMeters >= 1000) {
    const km = distanceMeters / 1000;
    return language === 'fr' ? `${km.toFixed(1)} km` : `${km.toFixed(1)} km`;
  }
  return language === 'fr'
    ? `${Math.round(distanceMeters)} m`
    : `${Math.round(distanceMeters)} m`;
}