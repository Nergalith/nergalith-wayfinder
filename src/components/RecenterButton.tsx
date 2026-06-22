import React, {useMemo} from 'react';
import {StyleSheet, Text, TouchableOpacity} from 'react-native';
import type {LanguageCode} from '../utils/wayfinder';
import {t} from '../i18n/strings';

type Props = {
  dark: boolean;
  language: LanguageCode;
  onPress: () => void;
  disabled?: boolean;
};

export default function RecenterButton({dark, language, onPress, disabled}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.86}>
      <Text style={styles.text}>{t(language, 'recenter')}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    surface: dark ? '#14161b' : '#ffffff',
    text: dark ? '#f4f5f7' : '#15171c',
    border: dark ? '#30333b' : '#c9cdd3',
    accent: dark ? '#2563eb' : '#1d4ed8',
  };

  return StyleSheet.create({
    button: {
      minHeight: 52,
      minWidth: 120,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      paddingHorizontal: 16,
      shadowColor: '#000000',
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: {width: 0, height: 2},
      elevation: 4,
    },
    buttonDisabled: {opacity: 0.5},
    text: {color: colors.accent, fontSize: 16, fontWeight: '900', textAlign: 'center'},
  });
}