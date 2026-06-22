import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {getCategory, getStatusHex} from '../constants/symbology';
import {t} from '../i18n/strings';
import type {LanguageCode, MapPin} from '../utils/wayfinder';

type Props = {
  dark: boolean;
  language: LanguageCode;
  pin: MapPin | null;
  routePinCount: number;
  onAddToRoute: () => void;
  onClearSelection: () => void;
  onDeletePin: () => void;
};

export default function PinActionSheet({
  dark,
  language,
  pin,
  routePinCount,
  onAddToRoute,
  onClearSelection,
  onDeletePin,
}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);

  if (!pin) {
    return null;
  }

  const category = getCategory(pin.category);
  const categoryLabel = language === 'fr' ? category?.labelFr : category?.labelEn;
  const statusHex = getStatusHex(pin.status_key);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={[styles.statusDot, {backgroundColor: statusHex}]} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{pin.label || categoryLabel || pin.category}</Text>
          <Text style={styles.subtitle}>
            {categoryLabel} · {t(language, 'routeStops').replace('{count}', String(routePinCount))}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryButton} onPress={onAddToRoute} activeOpacity={0.86}>
          <Text style={styles.primaryText}>{t(language, 'addToRoute')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onClearSelection} activeOpacity={0.86}>
          <Text style={styles.secondaryText}>{t(language, 'clearSelection')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dangerButton} onPress={onDeletePin} activeOpacity={0.86}>
          <Text style={styles.dangerText}>{t(language, 'deletePin')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    surface: dark ? '#14161b' : '#ffffff',
    surfaceAlt: dark ? '#24272f' : '#e3e5e8',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    border: dark ? '#30333b' : '#c9cdd3',
    accent: dark ? '#2563eb' : '#1d4ed8',
    accentText: '#ffffff',
    danger: dark ? '#ff6b66' : '#b42318',
  };

  return StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      gap: 12,
    },
    header: {flexDirection: 'row', alignItems: 'center', gap: 10},
    statusDot: {width: 14, height: 14, borderRadius: 7},
    headerText: {flex: 1, gap: 2},
    title: {color: colors.text, fontSize: 18, fontWeight: '900'},
    subtitle: {color: colors.muted, fontSize: 14, fontWeight: '700'},
    actions: {gap: 8},
    primaryButton: {
      minHeight: 52,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryText: {color: colors.accentText, fontSize: 17, fontWeight: '800', textAlign: 'center'},
    secondaryButton: {
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    secondaryText: {color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center'},
    dangerButton: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    dangerText: {color: colors.danger, fontSize: 16, fontWeight: '800', textAlign: 'center'},
  });
}