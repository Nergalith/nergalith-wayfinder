import {
  Camera,
  GeoJSONSource,
  Images,
  Layer,
  Map,
  RasterSource,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {MAPLIBRE_TEARDROP_ANCHOR, OWN_POSITION} from '../constants/symbology';
import {PIN_IMAGE_MANIFEST} from '../constants/pinImages';
import {useMovementTrack} from '../hooks/useMovementTrack';
import {t} from '../i18n/strings';
import {
  ownPositionFeature,
  pinsFeatureCollection,
  routeLineFeature,
  trackLineFeature,
} from '../utils/geo';
import {requestLocationPermission} from '../utils/permissions';
import {
  Wayfinder,
  messageFrom,
  type ActiveRoute,
  type GpsPosition,
  type LanguageCode,
  type MapPin,
  type MbtilesMetadata,
} from '../utils/wayfinder';
import CompassPanel from './CompassPanel';
import PinActionSheet from './PinActionSheet';
import PinDropSheet from './PinDropSheet';
import RecenterButton from './RecenterButton';

const EMPTY_MAP_STYLE = {
  version: 8 as const,
  name: 'wayfinder-empty',
  sources: {},
  layers: [] as [],
};

const TRACK_LINE_COLOR = '#60a5fa';
const ROUTE_LINE_COLOR = '#f97316';

type Props = {
  dark: boolean;
  language: LanguageCode;
  activeTilePath: string | null;
  onOpenSettings: () => void;
};

export default function MapScreen({dark, language, activeTilePath, onOpenSettings}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);
  const cameraRef = useRef<CameraRef | null>(null);
  const hasAutoCenteredRef = useRef(false);
  const [tileMeta, setTileMeta] = useState<MbtilesMetadata | null>(null);
  const [position, setPosition] = useState<GpsPosition | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute>({
    id: 'active',
    name: '',
    pin_ids: [],
    created_at: '',
  });
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [loadingTiles, setLoadingTiles] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [dropCoordinate, setDropCoordinate] = useState<{latitude: number; longitude: number} | null>(
    null,
  );
  const [dropVisible, setDropVisible] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  const selectedPin = useMemo(
    () => pins.find(pin => pin.id === selectedPinId) ?? null,
    [pins, selectedPinId],
  );

  const {trackPoints} = useMovementTrack(position);

  const loadPins = useCallback(async () => {
    const saved = await Wayfinder.listPins();
    setPins(saved);
  }, []);

  const loadRoute = useCallback(async () => {
    const route = await Wayfinder.getActiveRoute();
    setActiveRoute(route);
  }, []);

  useEffect(() => {
    loadPins().catch(() => undefined);
    loadRoute().catch(() => undefined);
  }, [loadPins, loadRoute]);

  useEffect(() => {
    async function loadTiles() {
      if (!activeTilePath) {
        setTileMeta(null);
        setLoadingTiles(false);
        return;
      }
      setLoadingTiles(true);
      try {
        const metadata = await Wayfinder.getMbtilesMetadata(activeTilePath);
        setTileMeta(metadata);
      } catch (error) {
        setTileMeta(null);
        Alert.alert(t(language, 'noTilesTitle'), messageFrom(error));
      } finally {
        setLoadingTiles(false);
      }
    }

    loadTiles().catch(() => undefined);
  }, [activeTilePath, language]);

  useEffect(() => {
    hasAutoCenteredRef.current = false;
  }, [activeTilePath]);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function startGps() {
      const granted = await requestLocationPermission();
      if (!granted) {
        setGpsError(t(language, 'gpsPermissionDenied'));
        return;
      }

      async function refreshPosition() {
        try {
          const next = await Wayfinder.getCurrentLocation();
          if (!cancelled) {
            setPosition(next);
            setGpsError(null);
          }
        } catch (error) {
          if (!cancelled) {
            setGpsError(messageFrom(error));
          }
        }
      }

      await refreshPosition();
      interval = setInterval(() => {
        refreshPosition().catch(() => undefined);
      }, 3000);
    }

    startGps().catch(error => setGpsError(messageFrom(error)));

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [language]);

  const initialCenter = useMemo<[number, number]>(() => {
    if (tileMeta?.centerLng != null && tileMeta.centerLat != null) {
      return [tileMeta.centerLng, tileMeta.centerLat];
    }
    if (position) {
      return [position.longitude, position.latitude];
    }
    return [18.5582, 4.3947];
  }, [position, tileMeta]);

  const initialZoom = tileMeta?.centerZoom ?? 12;

  useEffect(() => {
    if (!tileMeta || tileMeta.centerLng == null || tileMeta.centerLat == null || !cameraRef.current) {
      return;
    }
    cameraRef.current.easeTo({
      center: [tileMeta.centerLng, tileMeta.centerLat],
      zoom: tileMeta.centerZoom ?? 12,
      duration: 0,
    });
  }, [tileMeta]);

  useEffect(() => {
    if (
      !position ||
      !cameraRef.current ||
      hasAutoCenteredRef.current ||
      !positionWithinTileBounds(position, tileMeta)
    ) {
      return;
    }
    hasAutoCenteredRef.current = true;
    cameraRef.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: initialZoom,
      duration: 0,
    });
  }, [position, initialZoom, tileMeta]);

  function recenterOnOwnPosition() {
    if (!position || !cameraRef.current) {
      return;
    }
    cameraRef.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: Math.max(initialZoom, 14),
      duration: 500,
    });
  }

  async function saveDroppedPin(payload: {
    category: string;
    status_key: string;
    label: string;
    latitude: number;
    longitude: number;
  }) {
    setSavingPin(true);
    try {
      await Wayfinder.savePin({
        id: '',
        category: payload.category,
        status_key: payload.status_key,
        label: payload.label,
        latitude: payload.latitude,
        longitude: payload.longitude,
      });
      await loadPins();
      setDropVisible(false);
      setDropCoordinate(null);
    } catch (error) {
      Alert.alert(t(language, 'dropPinTitle'), messageFrom(error));
    } finally {
      setSavingPin(false);
    }
  }

  async function handleAddToRoute() {
    if (!selectedPinId) {
      return;
    }
    try {
      const route = await Wayfinder.appendPinToRoute(selectedPinId);
      setActiveRoute(route);
    } catch (error) {
      Alert.alert(t(language, 'routeTitle'), messageFrom(error));
    }
  }

  async function handleClearRoute() {
    try {
      await Wayfinder.clearRoute();
      setActiveRoute({id: 'active', name: '', pin_ids: [], created_at: ''});
    } catch (error) {
      Alert.alert(t(language, 'routeTitle'), messageFrom(error));
    }
  }

  async function handleDeletePin() {
    if (!selectedPinId) {
      return;
    }
    const deletedPinId = selectedPinId;
    try {
      await Wayfinder.deletePin(deletedPinId);
      setSelectedPinId(null);
      setPins(current => current.filter(pin => pin.id !== deletedPinId));
      setActiveRoute(current => ({
        ...current,
        pin_ids: current.pin_ids.filter(pinId => pinId !== deletedPinId),
      }));
      await Promise.all([loadPins(), loadRoute()]);
    } catch (error) {
      Alert.alert(t(language, 'deletePin'), messageFrom(error));
    }
  }

  const ownPositionGeoJson = useMemo(() => {
    if (!position) {
      return {type: 'FeatureCollection' as const, features: []};
    }
    return {
      type: 'FeatureCollection' as const,
      features: [ownPositionFeature(position.latitude, position.longitude)],
    };
  }, [position]);

  const pinsGeoJson = useMemo(() => pinsFeatureCollection(pins), [pins]);

  const trackGeoJson = useMemo(() => {
    const feature = trackLineFeature(trackPoints);
    return {
      type: 'FeatureCollection' as const,
      features: feature ? [feature] : [],
    };
  }, [trackPoints]);

  const routeGeoJson = useMemo(() => {
    const feature = routeLineFeature(pins, activeRoute.pin_ids);
    return {
      type: 'FeatureCollection' as const,
      features: feature ? [feature] : [],
    };
  }, [pins, activeRoute.pin_ids]);

  if (!activeTilePath || !tileMeta) {
    return (
      <View style={styles.container}>
        <View style={styles.messageBox}>
          <Text style={styles.title}>{t(language, 'noTilesTitle')}</Text>
          <Text style={styles.body}>{t(language, 'noTilesBody')}</Text>
          <Text style={styles.settingsLink} onPress={onOpenSettings}>
            {t(language, 'openSettings')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={EMPTY_MAP_STYLE}
        onLongPress={event => {
          const [longitude, latitude] = event.nativeEvent.lngLat;
          setDropCoordinate({latitude, longitude});
          setDropVisible(true);
          setSelectedPinId(null);
        }}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: initialCenter,
            zoom: initialZoom,
          }}
        />
        <Images images={PIN_IMAGE_MANIFEST} />
        <RasterSource
          id="deployment-tiles"
          tiles={[tileMeta.tileUrlTemplate]}
          tileSize={tileMeta.tileSize}
          scheme="xyz"
          minzoom={tileMeta.minZoom}
          maxzoom={tileMeta.maxZoom}>
          <Layer id="deployment-tiles-layer" type="raster" source="deployment-tiles" />
        </RasterSource>
        <GeoJSONSource id="movement-track" data={trackGeoJson}>
          <Layer
            id="movement-track-layer"
            type="line"
            source="movement-track"
            paint={{
              'line-color': TRACK_LINE_COLOR,
              'line-width': 3,
              'line-opacity': 0.85,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="route-line" data={routeGeoJson}>
          <Layer
            id="route-line-layer"
            type="line"
            source="route-line"
            paint={{
              'line-color': ROUTE_LINE_COLOR,
              'line-width': 4,
              'line-opacity': 0.95,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource id="own-position" data={ownPositionGeoJson}>
          <Layer
            id="own-position-layer"
            type="circle"
            source="own-position"
            paint={{
              'circle-radius': OWN_POSITION.radius,
              'circle-color': OWN_POSITION.color,
              'circle-stroke-color': OWN_POSITION.strokeColor,
              'circle-stroke-width': OWN_POSITION.strokeWidth,
            }}
          />
        </GeoJSONSource>
        <GeoJSONSource
          id="pins"
          data={pinsGeoJson}
          hitbox={{top: 24, bottom: 24, left: 24, right: 24}}
          onPress={event => {
            const feature = event.nativeEvent.features?.[0];
            const pinId = feature?.properties?.id;
            if (typeof pinId === 'string') {
              setSelectedPinId(pinId);
              setDropVisible(false);
              setDropCoordinate(null);
            }
          }}>
          <Layer
            id="pins-layer"
            type="symbol"
            source="pins"
            layout={{
              'icon-image': ['get', 'icon'],
              'icon-anchor': MAPLIBRE_TEARDROP_ANCHOR.iconAnchor,
              'icon-offset': MAPLIBRE_TEARDROP_ANCHOR.iconOffset,
              'icon-size': MAPLIBRE_TEARDROP_ANCHOR.iconSize,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
            }}
          />
        </GeoJSONSource>
      </Map>

      <View style={styles.overlayTop}>
        {gpsError ? <Text style={styles.gpsBanner}>{gpsError}</Text> : null}
        {loadingTiles ? <Text style={styles.gpsBanner}>{t(language, 'loadingTiles')}</Text> : null}
        <CompassPanel
          dark={dark}
          language={language}
          position={position}
          selectedPin={selectedPin}
        />
        <Text style={styles.hint}>{t(language, 'longPressHint')}</Text>
      </View>

      <View style={[styles.overlayBottom, selectedPin ? styles.overlayBottomRaised : null]}>
        {activeRoute.pin_ids.length > 0 ? (
          <TouchableOpacity style={styles.routeChip} onPress={handleClearRoute} activeOpacity={0.86}>
            <Text style={styles.routeChipText}>
              {t(language, 'routeStops').replace('{count}', String(activeRoute.pin_ids.length))}
            </Text>
            <Text style={styles.routeChipAction}>{t(language, 'clearRoute')}</Text>
          </TouchableOpacity>
        ) : null}
        <RecenterButton
          dark={dark}
          language={language}
          onPress={recenterOnOwnPosition}
          disabled={!position}
        />
      </View>

      <View style={styles.overlayActions}>
        <PinActionSheet
          dark={dark}
          language={language}
          pin={selectedPin}
          routePinCount={activeRoute.pin_ids.length}
          onAddToRoute={handleAddToRoute}
          onClearSelection={() => setSelectedPinId(null)}
          onDeletePin={handleDeletePin}
        />
      </View>

      <PinDropSheet
        visible={dropVisible}
        dark={dark}
        language={language}
        coordinate={dropCoordinate}
        saving={savingPin}
        onCancel={() => {
          setDropVisible(false);
          setDropCoordinate(null);
        }}
        onSave={saveDroppedPin}
      />
    </View>
  );
}

function positionWithinTileBounds(position: GpsPosition, tileMeta: MbtilesMetadata | null): boolean {
  const bounds = tileMeta?.bounds;
  if (!bounds || bounds.length !== 4) {
    return true;
  }
  const [west, south, east, north] = bounds;
  return (
    position.longitude >= west &&
    position.longitude <= east &&
    position.latitude >= south &&
    position.latitude <= north
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    background: dark ? '#090a0d' : '#f2f3f5',
    surface: dark ? '#14161b' : '#ffffff',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    danger: dark ? '#ff6b66' : '#b42318',
    accent: dark ? '#f97316' : '#ea580c',
    accentText: '#ffffff',
  };

  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    map: {flex: 1},
    overlayTop: {position: 'absolute', top: 12, left: 12, right: 12, gap: 8},
    overlayBottom: {
      position: 'absolute',
      bottom: 18,
      right: 18,
      alignItems: 'flex-end',
      gap: 10,
    },
    overlayBottomRaised: {bottom: 196},
    overlayActions: {
      position: 'absolute',
      left: 12,
      right: 12,
      bottom: 18,
    },
    gpsBanner: {
      color: colors.danger,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: '700',
      overflow: 'hidden',
    },
    hint: {
      color: colors.muted,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: '700',
      alignSelf: 'flex-start',
    },
    routeChip: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
      alignItems: 'flex-end',
    },
    routeChipText: {color: colors.text, fontSize: 14, fontWeight: '800'},
    routeChipAction: {color: colors.accent, fontSize: 13, fontWeight: '800'},
    messageBox: {
      flex: 1,
      margin: 18,
      borderRadius: 8,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      padding: 20,
      gap: 10,
    },
    title: {color: colors.text, fontSize: 22, fontWeight: '900'},
    body: {color: colors.text, fontSize: 17, lineHeight: 26},
    settingsLink: {color: '#2563eb', fontSize: 17, fontWeight: '800', marginTop: 8},
  });
}
