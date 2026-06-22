import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {LanguageCode, TilePackageInfo} from '../utils/wayfinder';
import {t} from '../i18n/strings';

type Props = {
  dark: boolean;
  language: LanguageCode;
  pinConfigured: boolean;
  activeTilePath: string | null;
  tilePackages: TilePackageInfo[];
  onThemeChange: (darkMode: boolean) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onBack: () => void;
};

export default function SettingsScreen({
  dark,
  language,
  pinConfigured,
  activeTilePath,
  tilePackages,
  onThemeChange,
  onLanguageChange,
  onBack,
}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);
  const demoPackage = tilePackages.find(pkg => pkg.isDemo);

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
        <Text style={styles.backText}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t(language, 'settingsTitle')}</Text>
      <Text style={styles.help}>{t(language, 'themeHelp')}</Text>

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, dark && styles.toggleSelected]}
          onPress={() => onThemeChange(true)}
          activeOpacity={0.86}>
          <Text style={[styles.toggleText, dark && styles.toggleTextSelected]}>{t(language, 'themeDark')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, !dark && styles.toggleSelected]}
          onPress={() => onThemeChange(false)}
          activeOpacity={0.86}>
          <Text style={[styles.toggleText, !dark && styles.toggleTextSelected]}>{t(language, 'themeLight')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{t(language, 'languageLabel')}</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, language === 'fr' && styles.toggleSelected]}
          onPress={() => onLanguageChange('fr')}
          activeOpacity={0.86}>
          <Text style={[styles.toggleText, language === 'fr' && styles.toggleTextSelected]}>
            {t(language, 'languageFr')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, language === 'en' && styles.toggleSelected]}
          onPress={() => onLanguageChange('en')}
          activeOpacity={0.86}>
          <Text style={[styles.toggleText, language === 'en' && styles.toggleTextSelected]}>
            {t(language, 'languageEn')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>{t(language, 'tilesLabel')}</Text>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {demoPackage ? t(language, 'tilesDemoLoaded') : t(language, 'tilesSideloadHint')}
        </Text>
        <Text style={styles.infoMuted}>{t(language, 'tilesSideloadHint')}</Text>
        {activeTilePath ? (
          <Text style={styles.path}>
            {t(language, 'tilesActivePath')}: {activeTilePath}
          </Text>
        ) : null}
      </View>

      <Text style={styles.label}>{t(language, 'pinManagement')}</Text>
      <Text style={styles.infoText}>
        {pinConfigured ? t(language, 'pinConfigured') : t(language, 'pinNotConfigured')}
      </Text>

      <Text style={styles.footer}>{t(language, 'offlineOnly')}</Text>
    </ScrollView>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    background: dark ? '#090a0d' : '#f2f3f5',
    surface: dark ? '#14161b' : '#ffffff',
    surfaceAlt: dark ? '#24272f' : '#e3e5e8',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    border: dark ? '#30333b' : '#c9cdd3',
    accent: dark ? '#2563eb' : '#1d4ed8',
    accentText: '#ffffff',
  };

  return StyleSheet.create({
    screen: {padding: 18, paddingBottom: 34},
    backButton: {
      alignSelf: 'flex-start',
      minHeight: 48,
      paddingHorizontal: 14,
      justifyContent: 'center',
      borderRadius: 6,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 12,
    },
    backText: {color: colors.text, fontSize: 16, fontWeight: '700'},
    sectionTitle: {color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: 12},
    help: {color: colors.text, fontSize: 17, lineHeight: 26, marginBottom: 12},
    label: {color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 16, marginBottom: 8},
    toggleRow: {flexDirection: 'row', gap: 10, marginBottom: 8},
    toggleButton: {
      flex: 1,
      minHeight: 56,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    toggleSelected: {borderColor: colors.accent, backgroundColor: colors.accent},
    toggleText: {color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center'},
    toggleTextSelected: {color: colors.accentText},
    infoBox: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 14,
      gap: 8,
    },
    infoText: {color: colors.text, fontSize: 16, lineHeight: 24},
    infoMuted: {color: colors.muted, fontSize: 15, lineHeight: 22},
    path: {color: colors.muted, fontSize: 13, lineHeight: 20},
    footer: {color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 20},
  });
}