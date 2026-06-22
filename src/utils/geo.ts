import type {MapPin} from './wayfinder';

export type LngLat = [number, number];

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