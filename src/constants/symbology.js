/**
 * Nergalith Standard Symbology v1.0 — single source of truth for Wayfinder.
 * Leaflet/web spec is defined here verbatim; MapLibre RN consumes rasterized
 * teardrop bitmaps generated from these values (SymbolLayer image assets).
 */

/** @typedef {'checkpoint' | 'location' | 'group' | 'vehicle' | 'incident' | 'shooting' | 'explosion' | 'military' | 'person' | 'general'} WayfinderCategoryKey */
/** @typedef {'hostile' | 'friendly' | 'unknown' | 'neutral' | 'inactive'} StatusColorKey */

export const SYMBOLOGY_VERSION = '1.0';

/**
 * Teardrop pin geometry — Nergalith Standard Symbology v1.0 (verbatim).
 * Do not approximate these values elsewhere.
 */
export const TEARDROP_PIN = {
  width: 30,
  height: 40,
  viewBox: '0 0 30 40',
  /** SVG path for the teardrop shape (Leaflet L.Icon / v1.0 standard). */
  path: 'M15 0C6.716 0 0 6.716 0 15c0 10 15 25 15 25S30 25 30 15C30 6.716 23.284 0 15 0z',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -42],
  symbolFontSize: 13,
  symbolFontFamily: 'system-ui,Arial,sans-serif',
  symbolFill: '#ffffff',
  symbolX: 15,
  symbolY: 16,
  symbolDy: '0.35em',
};

/**
 * MapLibre RN SymbolLayer equivalent of the Leaflet anchor spec.
 * icon-anchor "bottom" on a 30×40 image places the tip at the coordinate.
 */
/** @type {{ iconAnchor: 'bottom', iconOffset: [number, number], iconSize: number }} */
export const MAPLIBRE_TEARDROP_ANCHOR = {
  iconAnchor: 'bottom',
  iconOffset: [0, 0],
  iconSize: 1,
};

/** Own-position marker — blue circle, not a teardrop. */
export const OWN_POSITION = {
  color: '#2563eb',
  radius: 8,
  strokeColor: '#ffffff',
  strokeWidth: 2,
};

/**
 * Wayfinder curated subset — 10 categories (order matches operator grid).
 * @type {Array<{ key: WayfinderCategoryKey, labelEn: string, labelFr: string, symbol: string }>}
 */
export const WAYFINDER_CATEGORIES = [
  {key: 'checkpoint', labelEn: 'Checkpoint', labelFr: 'Poste de contrôle', symbol: '⬛'},
  {key: 'location', labelEn: 'Named Location / Waypoint', labelFr: 'Lieu nommé / Point de passage', symbol: '⌂'},
  {key: 'group', labelEn: 'Group / Armed Group', labelFr: 'Groupe / Groupe armé', symbol: '✶'},
  {key: 'vehicle', labelEn: 'Vehicle', labelFr: 'Véhicule', symbol: '⬡'},
  {key: 'incident', labelEn: 'Incident / Event', labelFr: 'Incident / Événement', symbol: '▲'},
  {key: 'shooting', labelEn: 'Shooting', labelFr: 'Tir / Fusillade', symbol: '✕'},
  {key: 'explosion', labelEn: 'Explosion', labelFr: 'Explosion', symbol: '✱'},
  {key: 'military', labelEn: 'Military', labelFr: 'Militaire', symbol: '✪'},
  {key: 'person', labelEn: 'Person', labelFr: 'Personne', symbol: '◉'},
  {key: 'general', labelEn: 'General / Other', labelFr: 'Général / Autre', symbol: '●'},
];

/**
 * Five status colors — Nergalith Standard Symbology v1.0.
 * @type {Record<StatusColorKey, { hex: string, labelEn: string, labelFr: string }>}
 */
export const STATUS_COLORS = {
  hostile: {hex: '#dc2626', labelEn: 'Hostile / Threat / Danger', labelFr: 'Hostile / Menace / Danger'},
  friendly: {hex: '#16a34a', labelEn: 'Friendly / Safe / Confirmed', labelFr: 'Ami / Sûr / Confirmé'},
  unknown: {hex: '#eab308', labelEn: 'Unknown / Unconfirmed / Caution', labelFr: 'Inconnu / Non confirmé / Attention'},
  neutral: {hex: '#2563eb', labelEn: 'Neutral / Civilian / No affiliation', labelFr: 'Neutre / Civil / Sans affiliation'},
  inactive: {hex: '#64748b', labelEn: 'Inactive / Historical / No status', labelFr: 'Inactif / Historique / Sans statut'},
};

export const DEFAULT_STATUS_KEY = 'unknown';
export const DEFAULT_STATUS_HEX = STATUS_COLORS.unknown.hex;

/** @type {Record<WayfinderCategoryKey, typeof WAYFINDER_CATEGORIES[number]>} */
export const CATEGORY_BY_KEY = WAYFINDER_CATEGORIES.reduce((acc, category) => {
  acc[category.key] = category;
  return acc;
}, /** @type {Record<string, typeof WAYFINDER_CATEGORIES[number]>} */ ({}));

/** @type {StatusColorKey[]} */
export const STATUS_COLOR_KEYS = ['hostile', 'friendly', 'unknown', 'neutral', 'inactive'];

/**
 * Build teardrop SVG string per v1.0 standard (Leaflet data-URL form).
 * MapLibre Phase 2: rasterize this SVG to a 30×40 PNG for Images.addImage().
 */
export function createTeardropSvg(fillHex, symbol) {
  const {width, height, viewBox, path, symbolFontSize, symbolFontFamily, symbolFill, symbolX, symbolY, symbolDy} =
    TEARDROP_PIN;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}"><path d="${path}" fill="${fillHex}"/><text x="${symbolX}" y="${symbolY}" font-size="${symbolFontSize}" font-family="${symbolFontFamily}" text-anchor="middle" dy="${symbolDy}" fill="${symbolFill}">${symbol}</text></svg>`;
}

/** Stable cache key for MapLibre image registry: pin-{category}-{statusKey} */
export function pinImageId(categoryKey, statusKey = DEFAULT_STATUS_KEY) {
  return `pin-${categoryKey}-${statusKey}`;
}

/** All image IDs that Phase 2 should pre-register with MapLibre (10 × 5 = 50). */
export function allPinImageIds() {
  return WAYFINDER_CATEGORIES.flatMap(category =>
    STATUS_COLOR_KEYS.map(statusKey => pinImageId(category.key, statusKey)),
  );
}

export function getCategory(key) {
  return CATEGORY_BY_KEY[key] || CATEGORY_BY_KEY.general;
}

export function getStatusHex(statusKey) {
  return STATUS_COLORS[statusKey]?.hex || DEFAULT_STATUS_HEX;
}

export function createPinSvg(categoryKey, statusKey = DEFAULT_STATUS_KEY) {
  const category = getCategory(categoryKey);
  const fill = getStatusHex(statusKey);
  return createTeardropSvg(fill, category.symbol);
}
