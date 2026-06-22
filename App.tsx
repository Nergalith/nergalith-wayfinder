import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapScreen from './src/components/MapScreen';
import SettingsScreen from './src/components/SettingsScreen';
import {emptyPinState, usePinLock} from './src/hooks/usePinLock';
import {t} from './src/i18n/strings';
import {
  Wayfinder,
  messageFrom,
  type LanguageCode,
  type TilePackageInfo,
} from './src/utils/wayfinder';

type Screen = 'map' | 'settings';

function App(): React.JSX.Element {
  const [dark, setDark] = useState(true);
  const [language, setLanguage] = useState<LanguageCode>('fr');
  const [screen, setScreen] = useState<Screen>('map');
  const [activeTilePath, setActiveTilePath] = useState<string | null>(null);
  const [tilePackages, setTilePackages] = useState<TilePackageInfo[]>([]);
  const {pinState, setPinState} = usePinLock();
  const styles = useMemo(() => makeStyles(dark), [dark]);

  useEffect(() => {
    async function boot() {
      try {
        await Wayfinder.initialize();
        const themeMode = await Wayfinder.getThemeMode();
        setDark(themeMode !== 'light');
        const savedLanguage = await Wayfinder.getLanguage();
        setLanguage(savedLanguage);
        const configured = await Wayfinder.isPinConfigured();
        setPinState({
          ...emptyPinState(),
          configured,
          unlocked: !configured,
        });
        await refreshTileState();
      } catch (error) {
        Alert.alert(t(language, 'startupError'), messageFrom(error));
      }
    }

    boot();
    // Boot runs once on mount; language/pin setters are intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshTileState() {
    const [path, packages] = await Promise.all([
      Wayfinder.getActiveMbtilesPath(),
      Wayfinder.listTilePackages(),
    ]);
    setActiveTilePath(path);
    setTilePackages(packages);
  }

  async function unlockWithPin() {
    if (pinState.pin.length !== 4) {
      setPinState(current => ({...current, error: t(language, 'pinInvalid')}));
      return;
    }

    try {
      const ok = await Wayfinder.verifyPin(pinState.pin);
      setPinState(current => ({
        ...current,
        unlocked: ok,
        pin: ok ? '' : current.pin,
        error: ok ? '' : t(language, 'pinWrong'),
      }));
    } catch (error) {
      setPinState(current => ({...current, error: messageFrom(error)}));
    }
  }

  async function createPin() {
    if (pinState.pin.length !== 4 || pinState.confirmPin.length !== 4) {
      setPinState(current => ({...current, error: t(language, 'pinInvalid')}));
      return;
    }
    if (pinState.pin !== pinState.confirmPin) {
      setPinState(current => ({...current, error: t(language, 'pinMismatch')}));
      return;
    }

    try {
      await Wayfinder.setPin(pinState.pin);
      setPinState({
        configured: true,
        unlocked: true,
        pin: '',
        confirmPin: '',
        error: '',
      });
    } catch (error) {
      setPinState(current => ({...current, error: messageFrom(error)}));
    }
  }

  async function setThemeMode(nextDark: boolean) {
    setDark(nextDark);
    try {
      await Wayfinder.setThemeMode(nextDark ? 'dark' : 'light');
    } catch (error) {
      Alert.alert(t(language, 'settingsTitle'), messageFrom(error));
    }
  }

  async function setAppLanguage(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    try {
      await Wayfinder.setLanguage(nextLanguage);
    } catch (error) {
      Alert.alert(t(language, 'settingsTitle'), messageFrom(error));
    }
  }

  async function selectTilePackage(path: string) {
    await Wayfinder.setActiveMbtilesPath(path);
    await refreshTileState();
  }

  function handlePinConfiguredChange(configured: boolean) {
    setPinState(current => ({
      ...current,
      configured,
      unlocked: true,
      pin: '',
      confirmPin: '',
      error: '',
    }));
  }

  const theme = {
    background: dark ? '#090a0d' : '#f2f3f5',
    bar: dark ? '#111318' : '#ffffff',
  };

  if (!pinState.unlocked) {
    return (
      <SafeAreaView style={[styles.safe, {backgroundColor: theme.background}]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
        <View style={styles.pinScreen}>
          <Text style={styles.appTitle}>{t(language, 'appTitle')}</Text>
          <Text style={styles.subtitle}>
            {pinState.configured ? t(language, 'pinUnlockTitle') : t(language, 'pinCreateTitle')}
          </Text>
          <TextInput
            style={styles.pinInput}
            value={pinState.pin}
            onChangeText={pin =>
              setPinState(current => ({...current, pin: pin.replace(/\D/g, '').slice(0, 4)}))
            }
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            placeholder={t(language, 'pinPlaceholder')}
            placeholderTextColor={dark ? '#87919b' : '#68737d'}
          />
          {!pinState.configured ? (
            <TextInput
              style={styles.pinInput}
              value={pinState.confirmPin}
              onChangeText={confirmPin =>
                setPinState(current => ({
                  ...current,
                  confirmPin: confirmPin.replace(/\D/g, '').slice(0, 4),
                }))
              }
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder={t(language, 'pinConfirmPlaceholder')}
              placeholderTextColor={dark ? '#87919b' : '#68737d'}
            />
          ) : null}
          {pinState.error ? <Text style={styles.pinError}>{pinState.error}</Text> : null}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={pinState.configured ? unlockWithPin : createPin}
            activeOpacity={0.85}>
            <Text style={styles.primaryButtonText}>
              {pinState.configured ? t(language, 'pinUnlockButton') : t(language, 'pinCreateButton')}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, {backgroundColor: theme.background}]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, {backgroundColor: theme.bar}]}>
        <View style={styles.titleBlock}>
          <Text style={styles.appTitle}>{t(language, 'appTitle')}</Text>
          <Text style={styles.subtitle}>
            {screen === 'settings' ? t(language, 'settingsTitle') : t(language, 'appSubtitle')}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setScreen(screen === 'settings' ? 'map' : 'settings')}
          activeOpacity={0.86}>
          <Text style={styles.settingsButtonText}>
            {screen === 'settings' ? t(language, 'back') : t(language, 'settings')}
          </Text>
        </TouchableOpacity>
        <Text style={styles.versionText}>{t(language, 'versionLabel')}</Text>
      </View>

      {screen === 'map' ? (
        <MapScreen
          dark={dark}
          language={language}
          activeTilePath={activeTilePath}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : null}

      {screen === 'settings' ? (
        <SettingsScreen
          dark={dark}
          language={language}
          pinConfigured={pinState.configured}
          activeTilePath={activeTilePath}
          tilePackages={tilePackages}
          onThemeChange={setThemeMode}
          onLanguageChange={setAppLanguage}
          onTilePackageChange={selectTilePackage}
          onPinConfiguredChange={handlePinConfiguredChange}
          onBack={() => setScreen('map')}
        />
      ) : null}
    </SafeAreaView>
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
    accentText: '#ffffff',
    danger: dark ? '#ff6b66' : '#b42318',
  };

  return StyleSheet.create({
    safe: {flex: 1},
    header: {
      minHeight: 84,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    titleBlock: {flex: 1},
    appTitle: {color: colors.text, fontSize: 24, fontWeight: '800'},
    subtitle: {color: colors.muted, fontSize: 15, marginTop: 2},
    settingsButton: {
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 6,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    settingsButtonText: {color: colors.text, fontSize: 14, fontWeight: '800'},
    versionText: {color: colors.muted, fontSize: 14, fontWeight: '800'},
    pinScreen: {flex: 1, padding: 24, justifyContent: 'center', gap: 14},
    pinInput: {
      minHeight: 58,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
      paddingHorizontal: 16,
      textAlign: 'center',
    },
    pinError: {color: colors.danger, fontSize: 15, fontWeight: '800', textAlign: 'center'},
    primaryButton: {
      minHeight: 72,
      borderRadius: 8,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    primaryButtonText: {color: colors.accentText, fontSize: 24, fontWeight: '800', textAlign: 'center'},
  });
}

export default App;