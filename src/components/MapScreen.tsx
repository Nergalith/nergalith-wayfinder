import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {LanguageCode} from '../utils/wayfinder';
import {t} from '../i18n/strings';

type Props = {
  dark: boolean;
  language: LanguageCode;
  activeTilePath: string | null;
  onOpenSettings: () => void;
};

export default function MapScreen({dark, language, activeTilePath, onOpenSettings}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);

  return (
    <View style={styles.container}>
      <View style={styles.placeholder}>
        <Text style={styles.title}>{t(language, 'mapPlaceholderTitle')}</Text>
        <Text style={styles.body}>{t(language, 'mapPlaceholderBody')}</Text>
        {activeTilePath ? (
          <Text style={styles.path} numberOfLines={2}>
            {activeTilePath}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity style={styles.settingsButton} onPress={onOpenSettings} activeOpacity={0.86}>
        <Text style={styles.settingsText}>{t(language, 'settings')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    background: dark ? '#090a0d' : '#f2f3f5',
    surface: dark ? '#14161b' : '#ffffff',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    border: dark ? '#30333b' : '#c9cdd3',
    accent: dark ? '#2563eb' : '#1d4ed8',
  };

  return StyleSheet.create({
    container: {flex: 1, backgroundColor: colors.background},
    placeholder: {
      flex: 1,
      margin: 18,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      padding: 20,
      gap: 10,
    },
    title: {color: colors.text, fontSize: 24, fontWeight: '900'},
    body: {color: colors.text, fontSize: 17, lineHeight: 26},
    path: {color: colors.muted, fontSize: 13, lineHeight: 20},
    settingsButton: {
      margin: 18,
      marginTop: 0,
      minHeight: 56,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accent,
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    settingsText: {color: colors.accent, fontSize: 18, fontWeight: '800', textAlign: 'center'},
  });
}