import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {t} from '../i18n/strings';
import {Wayfinder, messageFrom, type LanguageCode, type TilePackageInfo} from '../utils/wayfinder';

type Props = {
  dark: boolean;
  language: LanguageCode;
  pinConfigured: boolean;
  activeTilePath: string | null;
  tilePackages: TilePackageInfo[];
  onThemeChange: (darkMode: boolean) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onTilePackageChange: (path: string) => Promise<void>;
  onPinConfiguredChange: (configured: boolean) => void;
  onBack: () => void;
};

function digitsOnly(value: string, max = 4) {
  return value.replace(/\D/g, '').slice(0, max);
}

export default function SettingsScreen({
  dark,
  language,
  pinConfigured,
  activeTilePath,
  tilePackages,
  onThemeChange,
  onLanguageChange,
  onTilePackageChange,
  onPinConfiguredChange,
  onBack,
}: Props) {
  const styles = useMemo(() => makeStyles(dark), [dark]);
  const [exporting, setExporting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [sideloadPath, setSideloadPath] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [removingPin, setRemovingPin] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    async function loadDeviceInfo() {
      try {
        const [id, version, sideload] = await Promise.all([
          Wayfinder.getDeviceId(),
          Wayfinder.getAppVersion(),
          Wayfinder.getSideloadTilesPath(),
        ]);
        setDeviceId(id);
        setAppVersion(version);
        setSideloadPath(sideload);
      } catch {
        // Non-blocking settings metadata.
      }
    }

    loadDeviceInfo().catch(() => undefined);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await Wayfinder.exportAar();
      Alert.alert(
        t(language, 'exportSuccess'),
        `${result.jsonFilename}\n${result.kmlFilename}\n${result.pinCount} pins · ${result.trackPointCount} track points`,
      );
    } catch (error) {
      Alert.alert(t(language, 'exportAar'), messageFrom(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleSelectPackage(path: string) {
    if (path === activeTilePath) {
      return;
    }
    try {
      await onTilePackageChange(path);
    } catch (error) {
      Alert.alert(t(language, 'tilesLabel'), messageFrom(error));
    }
  }

  async function handleImportPackage() {
    try {
      const imported = await Wayfinder.importMbtilesPackage();
      await onTilePackageChange(imported.path);
      Alert.alert(t(language, 'tilesImportSuccess'), imported.name);
    } catch (error) {
      Alert.alert(t(language, 'tilesImportPackage'), messageFrom(error));
    }
  }

  async function handleSavePinChange() {
    if (currentPin.length !== 4 || newPin.length !== 4 || confirmNewPin.length !== 4) {
      setPinError(t(language, 'pinInvalid'));
      return;
    }
    if (newPin !== confirmNewPin) {
      setPinError(t(language, 'pinMismatch'));
      return;
    }

    try {
      const ok = await Wayfinder.verifyPin(currentPin);
      if (!ok) {
        setPinError(t(language, 'pinWrong'));
        return;
      }
      await Wayfinder.setPin(newPin);
      setChangingPin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setPinError('');
      onPinConfiguredChange(true);
      Alert.alert(t(language, 'securityLabel'), t(language, 'pinChanged'));
    } catch (error) {
      setPinError(messageFrom(error));
    }
  }

  async function handleRemovePin() {
    if (currentPin.length !== 4) {
      setPinError(t(language, 'pinInvalid'));
      return;
    }

    try {
      const ok = await Wayfinder.verifyPin(currentPin);
      if (!ok) {
        setPinError(t(language, 'pinWrong'));
        return;
      }
      await Wayfinder.clearPin();
      onPinConfiguredChange(false);
      setChangingPin(false);
      setRemovingPin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setPinError('');
      Alert.alert(t(language, 'securityLabel'), t(language, 'pinRemoved'));
    } catch (error) {
      setPinError(messageFrom(error));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.86}>
        <Text style={styles.backText}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t(language, 'settingsTitle')}</Text>

      <Text style={styles.groupLabel}>{t(language, 'appearanceLabel')}</Text>
      <View style={styles.card}>
        <Text style={styles.help}>{t(language, 'themeHelp')}</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, dark && styles.toggleSelected]}
            onPress={() => onThemeChange(true)}
            activeOpacity={0.86}>
            <Text style={[styles.toggleText, dark && styles.toggleTextSelected]}>
              {t(language, 'themeDark')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !dark && styles.toggleSelected]}
            onPress={() => onThemeChange(false)}
            activeOpacity={0.86}>
            <Text style={[styles.toggleText, !dark && styles.toggleTextSelected]}>
              {t(language, 'themeLight')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inlineLabel}>{t(language, 'languageLabel')}</Text>
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
      </View>

      <Text style={styles.groupLabel}>{t(language, 'mapLabel')}</Text>
      <View style={styles.card}>
        <Text style={styles.infoText}>{t(language, 'tilesSideloadHint')}</Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleImportPackage} activeOpacity={0.86}>
          <Text style={styles.secondaryButtonText}>{t(language, 'tilesImportPackage')}</Text>
        </TouchableOpacity>
        {sideloadPath ? (
          <Text style={styles.path}>
            {t(language, 'tilesSideloadFolder')}: {sideloadPath}
          </Text>
        ) : null}

        <Text style={styles.inlineLabel}>{t(language, 'tilesSelectPackage')}</Text>
        <View style={styles.packageList}>
          {tilePackages.map(pkg => {
            const active = pkg.path === activeTilePath;
            return (
              <TouchableOpacity
                key={pkg.id}
                style={[styles.packageRow, active && styles.packageRowActive]}
                onPress={() => handleSelectPackage(pkg.path)}
                activeOpacity={0.86}>
                <View style={styles.packageTextBlock}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageMeta}>
                    {pkg.isDemo ? t(language, 'tilesDemoLoaded') : pkg.path}
                  </Text>
                </View>
                {active ? <Text style={styles.packageBadge}>{t(language, 'tilesActiveBadge')}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={styles.groupLabel}>{t(language, 'dataLabel')}</Text>
      <View style={styles.card}>
        <Text style={styles.infoText}>{t(language, 'exportHelp')}</Text>
        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.86}>
          <Text style={styles.exportButtonText}>
            {exporting ? t(language, 'exportingAar') : t(language, 'exportAar')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.groupLabel}>{t(language, 'securityLabel')}</Text>
      <View style={styles.card}>
        <Text style={styles.infoText}>
          {pinConfigured ? t(language, 'pinConfigured') : t(language, 'pinNotConfigured')}
        </Text>

        {pinConfigured ? (
          <>
            {!changingPin ? (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setChangingPin(true);
                  setRemovingPin(false);
                  setPinError('');
                  setCurrentPin('');
                }}
                activeOpacity={0.86}>
                <Text style={styles.secondaryButtonText}>{t(language, 'changePin')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pinForm}>
                <Text style={styles.inlineLabel}>{t(language, 'changePinTitle')}</Text>
                <TextInput
                  style={styles.pinInput}
                  value={currentPin}
                  onChangeText={value => setCurrentPin(digitsOnly(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder={t(language, 'currentPin')}
                  placeholderTextColor={dark ? '#87919b' : '#68737d'}
                />
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={value => setNewPin(digitsOnly(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder={t(language, 'newPin')}
                  placeholderTextColor={dark ? '#87919b' : '#68737d'}
                />
                <TextInput
                  style={styles.pinInput}
                  value={confirmNewPin}
                  onChangeText={value => setConfirmNewPin(digitsOnly(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder={t(language, 'pinConfirmPlaceholder')}
                  placeholderTextColor={dark ? '#87919b' : '#68737d'}
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                <View style={styles.pinActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setChangingPin(false);
                      setRemovingPin(false);
                      setCurrentPin('');
                      setNewPin('');
                      setConfirmNewPin('');
                      setPinError('');
                    }}
                    activeOpacity={0.86}>
                    <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleSavePinChange}
                    activeOpacity={0.86}>
                    <Text style={styles.primaryButtonText}>{t(language, 'savePin')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {!removingPin ? (
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => {
                  setRemovingPin(true);
                  setChangingPin(false);
                  setCurrentPin('');
                  setNewPin('');
                  setConfirmNewPin('');
                  setPinError('');
                }}
                activeOpacity={0.86}>
                <Text style={styles.dangerButtonText}>{t(language, 'removePin')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.pinForm}>
                <Text style={styles.inlineLabel}>{t(language, 'removePinTitle')}</Text>
                <TextInput
                  style={styles.pinInput}
                  value={currentPin}
                  onChangeText={value => setCurrentPin(digitsOnly(value))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  placeholder={t(language, 'currentPin')}
                  placeholderTextColor={dark ? '#87919b' : '#68737d'}
                />
                {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
                <View style={styles.pinActions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => {
                      setRemovingPin(false);
                      setCurrentPin('');
                      setPinError('');
                    }}
                    activeOpacity={0.86}>
                    <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.dangerButtonFlex} onPress={handleRemovePin} activeOpacity={0.86}>
                    <Text style={styles.dangerButtonText}>{t(language, 'verifyAndRemovePin')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        ) : null}
      </View>

      <Text style={styles.groupLabel}>{t(language, 'aboutLabel')}</Text>
      <View style={styles.card}>
        <Text style={styles.infoText}>
          {t(language, 'versionLabel')} ({appVersion || '—'})
        </Text>
        <Text style={styles.help}>{t(language, 'deviceHelp')}</Text>
        <Text style={styles.path}>
          {t(language, 'deviceLabel')}: {deviceId || '—'}
        </Text>
      </View>

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
    accentSoft: dark ? '#1e3a5f' : '#dbeafe',
    accentText: '#ffffff',
    danger: dark ? '#ff6b66' : '#b42318',
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
    groupLabel: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginTop: 8,
      marginBottom: 8,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 14,
      gap: 10,
      marginBottom: 8,
    },
    help: {color: colors.text, fontSize: 16, lineHeight: 24},
    inlineLabel: {color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4},
    toggleRow: {flexDirection: 'row', gap: 10},
    toggleButton: {
      flex: 1,
      minHeight: 52,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    toggleSelected: {borderColor: colors.accent, backgroundColor: colors.accent},
    toggleText: {color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center'},
    toggleTextSelected: {color: colors.accentText},
    infoText: {color: colors.text, fontSize: 16, lineHeight: 24},
    path: {color: colors.muted, fontSize: 13, lineHeight: 20},
    packageList: {gap: 8},
    packageRow: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.surfaceAlt,
    },
    packageRowActive: {borderColor: colors.accent, backgroundColor: colors.accentSoft},
    packageTextBlock: {flex: 1, gap: 2},
    packageName: {color: colors.text, fontSize: 16, fontWeight: '800'},
    packageMeta: {color: colors.muted, fontSize: 12, lineHeight: 18},
    packageBadge: {color: colors.accent, fontSize: 12, fontWeight: '900'},
    exportButton: {
      minHeight: 52,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    exportButtonDisabled: {opacity: 0.7},
    exportButtonText: {color: colors.accentText, fontSize: 17, fontWeight: '800', textAlign: 'center'},
    secondaryButton: {
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    secondaryButtonText: {color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center'},
    primaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    primaryButtonText: {color: colors.accentText, fontSize: 16, fontWeight: '800', textAlign: 'center'},
    dangerButton: {
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    dangerButtonFlex: {
      flex: 1,
      minHeight: 48,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.danger,
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    dangerButtonText: {color: colors.danger, fontSize: 16, fontWeight: '800', textAlign: 'center'},
    pinForm: {gap: 8},
    pinInput: {
      minHeight: 50,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
      paddingHorizontal: 14,
      textAlign: 'center',
    },
    pinError: {color: colors.danger, fontSize: 14, fontWeight: '800', textAlign: 'center'},
    pinActions: {flexDirection: 'row', gap: 10},
    footer: {color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12},
  });
}
