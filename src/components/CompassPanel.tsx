import React, {useEffect, useMemo, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {t} from '../i18n/strings';
import {
  bearingDegrees,
  cardinalFromDegrees,
  formatDistanceMeters,
  haversineDistanceMeters,
} from '../utils/geo';
import {
  Wayfinder,
  messageFrom,
  type CompassHeading,
  type GpsPosition,
  type LanguageCode,
  type MapPin,
} from '../utils/wayfinder';

type Props = {
  dark: boolean;
  language: LanguageCode;
  position: GpsPosition | null;
  selectedPin: MapPin | null;
};

export default function CompassPanel({dark, language, position, selectedPin}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);
  const [heading, setHeading] = useState<CompassHeading | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function start() {
      try {
        await Wayfinder.startCompass();
        async function refreshHeading() {
          try {
            const next = await Wayfinder.getCompassHeading();
            if (!cancelled) {
              setHeading(next);
              setCompassError(null);
            }
          } catch (error) {
            if (!cancelled) {
              setCompassError(messageFrom(error));
            }
          }
        }
        await refreshHeading();
        interval = setInterval(() => {
          refreshHeading().catch(() => undefined);
        }, 500);
      } catch (error) {
        if (!cancelled) {
          setCompassError(messageFrom(error));
        }
      }
    }

    start().catch(error => setCompassError(messageFrom(error)));

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
      Wayfinder.stopCompass().catch(() => undefined);
    };
  }, []);

  const targetInfo = useMemo(() => {
    if (!position || !selectedPin) {
      return null;
    }
    const distance = haversineDistanceMeters(
      position.latitude,
      position.longitude,
      selectedPin.latitude,
      selectedPin.longitude,
    );
    const bearing = bearingDegrees(
      position.latitude,
      position.longitude,
      selectedPin.latitude,
      selectedPin.longitude,
    );
    return {
      distance,
      bearing,
      bearingCardinal: cardinalFromDegrees(bearing),
    };
  }, [position, selectedPin]);

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{t(language, 'compassHeading')}</Text>
      {heading ? (
        <Text style={styles.headingValue}>
          {heading.cardinal} {Math.round(heading.heading)}°
        </Text>
      ) : (
        <Text style={styles.muted}>{compassError ?? t(language, 'compassCalibrating')}</Text>
      )}

      {selectedPin && targetInfo ? (
        <View style={styles.targetBlock}>
          <Text style={styles.label}>{t(language, 'compassToPin')}</Text>
          <Text style={styles.targetValue}>
            {targetInfo.bearingCardinal} {Math.round(targetInfo.bearing)}°
          </Text>
          <Text style={styles.distanceValue}>
            {formatDistanceMeters(targetInfo.distance, language)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    surface: dark ? '#14161b' : '#ffffff',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    accent: dark ? '#38bdf8' : '#1d4ed8',
    border: dark ? '#30333b' : '#c9cdd3',
  };

  return StyleSheet.create({
    panel: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
      minWidth: 168,
    },
    label: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    headingValue: {
      color: colors.text,
      fontSize: 28,
      fontWeight: '900',
      lineHeight: 32,
    },
    muted: {
      color: colors.muted,
      fontSize: 15,
      fontWeight: '700',
    },
    targetBlock: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 2,
    },
    targetValue: {
      color: colors.accent,
      fontSize: 24,
      fontWeight: '900',
      lineHeight: 28,
    },
    distanceValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
  });
}