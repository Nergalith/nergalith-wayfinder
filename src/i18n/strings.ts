import type {LanguageCode} from '../utils/wayfinder';

type StringKey =
  | 'appTitle'
  | 'appSubtitle'
  | 'versionLabel'
  | 'pinCreateTitle'
  | 'pinUnlockTitle'
  | 'pinPlaceholder'
  | 'pinConfirmPlaceholder'
  | 'pinCreateButton'
  | 'pinUnlockButton'
  | 'pinInvalid'
  | 'pinMismatch'
  | 'pinWrong'
  | 'startupError'
  | 'mapPlaceholderTitle'
  | 'mapPlaceholderBody'
  | 'settings'
  | 'settingsTitle'
  | 'themeDark'
  | 'themeLight'
  | 'themeHelp'
  | 'languageLabel'
  | 'languageFr'
  | 'languageEn'
  | 'tilesLabel'
  | 'tilesDemoLoaded'
  | 'tilesSideloadHint'
  | 'tilesActivePath'
  | 'pinManagement'
  | 'pinConfigured'
  | 'pinNotConfigured'
  | 'back'
  | 'offlineOnly';

const STRINGS: Record<LanguageCode, Record<StringKey, string>> = {
  fr: {
    appTitle: 'Nergalith Wayfinder',
    appSubtitle: 'Positionnement et navigation',
    versionLabel: 'Wayfinder v0.1.0',
    pinCreateTitle: 'Créer un code PIN à 4 chiffres',
    pinUnlockTitle: 'Entrez le code PIN',
    pinPlaceholder: 'PIN',
    pinConfirmPlaceholder: 'Confirmer le PIN',
    pinCreateButton: 'Créer le PIN',
    pinUnlockButton: 'Déverrouiller',
    pinInvalid: 'Entrez un code PIN à 4 chiffres.',
    pinMismatch: 'La confirmation du PIN ne correspond pas.',
    pinWrong: 'Code PIN incorrect.',
    startupError: 'Erreur au démarrage',
    mapPlaceholderTitle: 'Carte',
    mapPlaceholderBody: 'La couche carte MapLibre arrive en Phase 2. Le module natif et le PIN sont prêts.',
    settings: 'Paramètres',
    settingsTitle: 'Paramètres',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeHelp: 'Le mode sombre est le défaut pour le terrain de nuit.',
    languageLabel: 'Langue',
    languageFr: 'Français',
    languageEn: 'Anglais',
    tilesLabel: 'Paquet de tuiles MBTiles',
    tilesDemoLoaded: 'Tuiles de démo Bangui (CAR) chargées pour les tests.',
    tilesSideloadHint: 'Pour un déploiement réel, chargez un fichier .mbtiles via les paramètres (Phase 2).',
    tilesActivePath: 'Fichier actif',
    pinManagement: 'Gestion du PIN',
    pinConfigured: 'PIN configuré sur cet appareil.',
    pinNotConfigured: 'Aucun PIN configuré.',
    back: 'Retour',
    offlineOnly: 'Hors ligne uniquement — aucun compte ni cloud.',
  },
  en: {
    appTitle: 'Nergalith Wayfinder',
    appSubtitle: 'Positioning and navigation',
    versionLabel: 'Wayfinder v0.1.0',
    pinCreateTitle: 'Create a 4-digit PIN',
    pinUnlockTitle: 'Enter PIN to unlock',
    pinPlaceholder: 'PIN',
    pinConfirmPlaceholder: 'Confirm PIN',
    pinCreateButton: 'Create PIN',
    pinUnlockButton: 'Unlock',
    pinInvalid: 'Enter the 4-digit PIN.',
    pinMismatch: 'PIN confirmation did not match.',
    pinWrong: 'PIN did not match.',
    startupError: 'Startup error',
    mapPlaceholderTitle: 'Map',
    mapPlaceholderBody: 'MapLibre map layer arrives in Phase 2. Native module and PIN gate are ready.',
    settings: 'Settings',
    settingsTitle: 'Settings',
    themeDark: 'Dark',
    themeLight: 'Light',
    themeHelp: 'Dark mode is the default for field use at night.',
    languageLabel: 'Language',
    languageFr: 'French',
    languageEn: 'English',
    tilesLabel: 'MBTiles package',
    tilesDemoLoaded: 'Demo Bangui (CAR) tiles loaded for testing.',
    tilesSideloadHint: 'For real deployment, sideload a .mbtiles file via Settings (Phase 2).',
    tilesActivePath: 'Active file',
    pinManagement: 'PIN management',
    pinConfigured: 'PIN is configured on this device.',
    pinNotConfigured: 'No PIN configured.',
    back: 'Back',
    offlineOnly: 'Offline only — no account or cloud.',
  },
};

export function t(language: LanguageCode, key: StringKey): string {
  return STRINGS[language][key];
}