import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import {Wayfinder, messageFrom, type GpsPosition, type TrackPoint} from '../utils/wayfinder';

const TRACK_INTERVAL_MS = 30_000;

export function useMovementTrack(position: GpsPosition | null) {
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [trackError, setTrackError] = useState<string | null>(null);
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const refreshTrackPoints = useCallback(async () => {
    const points = await Wayfinder.listTrackPoints();
    setTrackPoints(points);
  }, []);

  useEffect(() => {
    refreshTrackPoints().catch(() => undefined);
  }, [refreshTrackPoints]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      setAppActive(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!appActive) {
      return;
    }

    let cancelled = false;

    async function recordPoint() {
      const current = positionRef.current;
      if (!current) {
        return;
      }
      try {
        await Wayfinder.appendTrackPoint(current.latitude, current.longitude);
        if (!cancelled) {
          await refreshTrackPoints();
          setTrackError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTrackError(messageFrom(error));
        }
      }
    }

    recordPoint().catch(() => undefined);
    const interval = setInterval(() => {
      recordPoint().catch(() => undefined);
    }, TRACK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [appActive, refreshTrackPoints]);

  return {
    trackPoints,
    trackError,
    refreshTrackPoints,
  };
}