import React, {useMemo, useState} from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  DEFAULT_STATUS_KEY,
  STATUS_COLOR_KEYS,
  STATUS_COLORS,
  WAYFINDER_CATEGORIES,
} from '../constants/symbology';
import {t} from '../i18n/strings';
import type {LanguageCode} from '../utils/wayfinder';

type Props = {
  visible: boolean;
  dark: boolean;
  language: LanguageCode;
  coordinate: {latitude: number; longitude: number} | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (payload: {
    category: string;
    status_key: string;
    label: string;
    latitude: number;
    longitude: number;
  }) => void;
};

export default function PinDropSheet({
  visible,
  dark,
  language,
  coordinate,
  saving = false,
  onCancel,
  onSave,
}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);
  const [category, setCategory] = useState('general');
  const [statusKey, setStatusKey] = useState(DEFAULT_STATUS_KEY);
  const [label, setLabel] = useState('');

  function handleSave() {
    if (!coordinate) {
      return;
    }
    onSave({
      category,
      status_key: statusKey,
      label: label.trim(),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{t(language, 'dropPinTitle')}</Text>
            {coordinate ? (
              <Text style={styles.coords}>
                {coordinate.latitude.toFixed(5)}, {coordinate.longitude.toFixed(5)}
              </Text>
            ) : null}

            <Text style={styles.section}>{t(language, 'selectCategory')}</Text>
            <View style={styles.categoryGrid}>
              {WAYFINDER_CATEGORIES.map(item => {
                const selected = category === item.key;
                const itemLabel = language === 'fr' ? item.labelFr : item.labelEn;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.categoryButton, selected && styles.categorySelected]}
                    onPress={() => setCategory(item.key)}
                    activeOpacity={0.86}>
                    <Text style={styles.categorySymbol}>{item.symbol}</Text>
                    <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                      {itemLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.section}>{t(language, 'selectStatus')}</Text>
            <View style={styles.statusRow}>
              {STATUS_COLOR_KEYS.map(key => {
                const selected = statusKey === key;
                const status = STATUS_COLORS[key];
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.statusSwatch,
                      {backgroundColor: status.hex},
                      selected && styles.statusSelected,
                    ]}
                    onPress={() => setStatusKey(key)}
                    activeOpacity={0.86}
                    accessibilityLabel={language === 'fr' ? status.labelFr : status.labelEn}
                  />
                );
              })}
            </View>

            <Text style={styles.section}>{t(language, 'pinLabel')}</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder={t(language, 'pinLabelPlaceholder')}
              placeholderTextColor={dark ? '#87919b' : '#68737d'}
              maxLength={48}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel} disabled={saving}>
                <Text style={styles.cancelText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving || !coordinate}
                activeOpacity={0.86}>
                <Text style={styles.saveText}>
                  {saving ? t(language, 'savingPin') : t(language, 'placePin')}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(dark: boolean) {
  const colors = {
    backdrop: 'rgba(0,0,0,0.55)',
    surface: dark ? '#14161b' : '#ffffff',
    text: dark ? '#f4f5f7' : '#15171c',
    muted: dark ? '#a3a8b0' : '#606672',
    border: dark ? '#30333b' : '#c9cdd3',
    accent: dark ? '#2563eb' : '#1d4ed8',
    accentText: '#ffffff',
  };

  return StyleSheet.create({
    backdrop: {flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop},
    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    content: {padding: 18, paddingBottom: 28, gap: 8},
    title: {color: colors.text, fontSize: 22, fontWeight: '900'},
    coords: {color: colors.muted, fontSize: 14, fontWeight: '700', marginBottom: 6},
    section: {color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 10},
    categoryGrid: {gap: 10},
    categoryButton: {
      minHeight: 64,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? '#1b1d23' : '#f8fafc',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
    },
    categorySelected: {borderColor: colors.accent, borderWidth: 2},
    categorySymbol: {color: colors.text, fontSize: 22, width: 28, textAlign: 'center'},
    categoryLabel: {flex: 1, color: colors.text, fontSize: 17, fontWeight: '700'},
    categoryLabelSelected: {color: colors.accent},
    statusRow: {flexDirection: 'row', gap: 10, marginTop: 4},
    statusSwatch: {
      flex: 1,
      minHeight: 54,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusSelected: {borderWidth: 3, borderColor: colors.text},
    input: {
      minHeight: 52,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: dark ? '#1b1d23' : '#f8fafc',
      color: colors.text,
      fontSize: 17,
      paddingHorizontal: 14,
    },
    actions: {flexDirection: 'row', gap: 10, marginTop: 16},
    cancelButton: {
      flex: 1,
      minHeight: 56,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    cancelText: {color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center'},
    saveButton: {
      flex: 1,
      minHeight: 56,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
    },
    saveText: {color: colors.accentText, fontSize: 17, fontWeight: '900', textAlign: 'center'},
  });
}