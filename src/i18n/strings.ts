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
  | 'offlineOnly'
  | 'recenter'
  | 'dropPinTitle'
  | 'selectCategory'
  | 'selectStatus'
  | 'pinLabel'
  | 'pinLabelPlaceholder'
  | 'placePin'
  | 'savingPin'
  | 'cancel'
  | 'noTilesTitle'
  | 'noTilesBody'
  | 'openSettings'
  | 'gpsPermissionDenied'
  | 'loadingTiles'
  | 'compassHeading'
  | 'compassCalibrating'
  | 'compassToPin'
  | 'longPressHint'
  | 'addToRoute'
  | 'clearSelection'
  | 'deletePin'
  | 'routeTitle'
  | 'routeStops'
  | 'clearRoute'
  | 'exportAar'
  | 'exportingAar'
  | 'exportSuccess'
  | 'exportHelp';

const STRINGS: Record<LanguageCode, Record<StringKey, string>> = {
  fr: {
    appTitle: 'Nergalith Wayfinder',
    appSubtitle: 'Positionnement et navigation',
    versionLabel: 'Wayfinder v0.3.0',
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
    tilesSideloadHint: 'Pour un déploiement réel, chargez un fichier .mbtiles via les paramètres.',
    tilesActivePath: 'Fichier actif',
    pinManagement: 'Gestion du PIN',
    pinConfigured: 'PIN configuré sur cet appareil.',
    pinNotConfigured: 'Aucun PIN configuré.',
    back: 'Retour',
    offlineOnly: 'Hors ligne uniquement — aucun compte ni cloud.',
    recenter: 'Recentrer',
    dropPinTitle: 'Placer un repère',
    selectCategory: 'Catégorie',
    selectStatus: 'Statut',
    pinLabel: 'Étiquette (optionnel)',
    pinLabelPlaceholder: 'Courte description',
    placePin: 'Placer le repère',
    savingPin: 'Enregistrement...',
    cancel: 'Annuler',
    noTilesTitle: 'Aucune carte chargée',
    noTilesBody: 'Chargez un paquet MBTiles pour afficher la carte hors ligne.',
    openSettings: 'Ouvrir les paramètres',
    gpsPermissionDenied: 'Autorisation GPS refusée.',
    loadingTiles: 'Chargement des tuiles...',
    compassHeading: 'Cap',
    compassCalibrating: 'Calibration boussole...',
    compassToPin: 'Vers le repère',
    longPressHint: 'Appui long sur la carte pour placer un repère',
    addToRoute: 'Ajouter à l\'itinéraire',
    clearSelection: 'Désélectionner',
    deletePin: 'Supprimer le repère',
    routeTitle: 'Itinéraire',
    routeStops: '{count} étapes',
    clearRoute: 'Effacer l\'itinéraire',
    exportAar: 'Exporter AAR (JSON + KML)',
    exportingAar: 'Export en cours...',
    exportSuccess: 'Export enregistré dans Téléchargements/NergalithWayfinder',
    exportHelp: 'Inclut tous les repères, la trace de mouvement et l\'itinéraire actif.',
  },
  en: {
    appTitle: 'Nergalith Wayfinder',
    appSubtitle: 'Positioning and navigation',
    versionLabel: 'Wayfinder v0.3.0',
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
    tilesSideloadHint: 'For real deployment, sideload a .mbtiles file via Settings.',
    tilesActivePath: 'Active file',
    pinManagement: 'PIN management',
    pinConfigured: 'PIN is configured on this device.',
    pinNotConfigured: 'No PIN configured.',
    back: 'Back',
    offlineOnly: 'Offline only — no account or cloud.',
    recenter: 'Re-center',
    dropPinTitle: 'Drop a pin',
    selectCategory: 'Category',
    selectStatus: 'Status',
    pinLabel: 'Label (optional)',
    pinLabelPlaceholder: 'Short description',
    placePin: 'Place pin',
    savingPin: 'Saving...',
    cancel: 'Cancel',
    noTilesTitle: 'No map loaded',
    noTilesBody: 'Load an MBTiles package to display the offline map.',
    openSettings: 'Open Settings',
    gpsPermissionDenied: 'GPS permission denied.',
    loadingTiles: 'Loading tiles...',
    compassHeading: 'Heading',
    compassCalibrating: 'Calibrating compass...',
    compassToPin: 'To pin',
    longPressHint: 'Long-press the map to drop a pin',
    addToRoute: 'Add to route',
    clearSelection: 'Clear selection',
    deletePin: 'Delete pin',
    routeTitle: 'Route',
    routeStops: '{count} stops',
    clearRoute: 'Clear route',
    exportAar: 'Export AAR (JSON + KML)',
    exportingAar: 'Exporting...',
    exportSuccess: 'Export saved to Downloads/NergalithWayfinder',
    exportHelp: 'Includes all pins, movement track, and the active route.',
  },
};

export function t(language: LanguageCode, key: StringKey): string {
  return STRINGS[language][key];
}