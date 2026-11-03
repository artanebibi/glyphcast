export const STYLE_IDS = [
  'characters',
  'blocks',
  'lines',
  'diagonal',
  'cross',
  'diamond',
  'mixed',
  'braille',
  'dots',
  'pixel',
  'mosaic',
  'lego',
  'disco',
  'voxel',
  'dither',
] as const;

export type StyleId = (typeof STYLE_IDS)[number];

export const DITHER_ALGOS = [
  'bayer2',
  'bayer4',
  'bayer8',
  'floyd',
  'atkinson',
  'stucki',
  'sierraLite',
] as const;
export type DitherAlgo = (typeof DITHER_ALGOS)[number];

export type Background = 'blur' | 'solid' | 'none';
export type ColorMode = 'source' | 'mono';
export type MosaicShape = 'square' | 'wide' | 'tall';

/**
 * Every option the renderer understands. Kept flat so the share link can
 * store only the keys that differ from DEFAULTS.
 */
export interface Settings {
  style: StyleId;
  /** Cell height in output pixels. Cell width is 0.6 of this. */
  cellSize: number;
  /** Ramp for the characters style, densest glyph first. */
  charset: string;
  /** -100..100 */
  brightness: number;
  /** -100..100 */
  contrast: number;
  /** 0..100. Cells darker than this are left empty (glyph styles only). */
  darkCutoff: number;
  /** 0..100. Share of cells drawn; the rest are skipped by a stable hash. */
  coverage: number;
  invert: boolean;
  colorMode: ColorMode;
  inkColor: string;
  glyphOpacity: number;
  background: Background;
  bgColor: string;
  /** Blur radius of the photo backdrop, in cells. */
  bgBlur: number;
  /** 0..100 */
  bgOpacity: number;
  /** Long side of the rendered image, in pixels. */
  outputSize: number;

  pixelLevels: number;
  mosaicShape: MosaicShape;
  discoVariation: number;
  discoSeed: number;
  voxelSize: number;

  ditherAlgo: DitherAlgo;
  ditherPalette: string;
  ditherScale: number;

  fxGlow: boolean;
  fxGlowAmount: number;
  fxScanlines: boolean;
  fxScanlinesAmount: number;
  fxScanlinesSpacing: number;
  fxRgbSplit: boolean;
  fxRgbSplitOffset: number;
  fxGlitch: boolean;
  fxGlitchAmount: number;
  fxGlitchSeed: number;
  fxCrt: boolean;
  fxCrtAmount: number;
  fxVignette: boolean;
  fxVignetteAmount: number;
  fxGrain: boolean;
  fxGrainAmount: number;
}

export const DEFAULTS: Readonly<Settings> = Object.freeze({
  style: 'characters',
  cellSize: 11,
  charset: '@%#*+=-:. ',
  brightness: 0,
  contrast: 20,
  darkCutoff: 25,
  coverage: 100,
  invert: false,
  colorMode: 'source',
  inkColor: '#9dffb0',
  glyphOpacity: 100,
  background: 'blur',
  bgColor: '#0b0b0f',
  bgBlur: 1,
  bgOpacity: 22,
  outputSize: 1600,

  pixelLevels: 6,
  mosaicShape: 'square',
  discoVariation: 25,
  discoSeed: 1,
  voxelSize: 14,

  ditherAlgo: 'bayer4',
  ditherPalette: 'mono',
  ditherScale: 3,

  fxGlow: false,
  fxGlowAmount: 40,
  fxScanlines: false,
  fxScanlinesAmount: 35,
  fxScanlinesSpacing: 3,
  fxRgbSplit: false,
  fxRgbSplitOffset: 3,
  fxGlitch: false,
  fxGlitchAmount: 30,
  fxGlitchSeed: 7,
  fxCrt: false,
  fxCrtAmount: 30,
  fxVignette: false,
  fxVignetteAmount: 50,
  fxGrain: false,
  fxGrainAmount: 20,
});

/** Inclusive numeric bounds, used to clamp values from share links and the UI. */
export const RANGES: Partial<Record<keyof Settings, readonly [number, number]>> = {
  cellSize: [4, 48],
  brightness: [-100, 100],
  contrast: [-100, 100],
  darkCutoff: [0, 100],
  coverage: [0, 100],
  glyphOpacity: [0, 100],
  bgBlur: [0, 12],
  bgOpacity: [0, 100],
  outputSize: [400, 3200],
  pixelLevels: [2, 16],
  discoVariation: [0, 100],
  discoSeed: [1, 9999],
  voxelSize: [4, 64],
  ditherScale: [1, 12],
  fxGlowAmount: [0, 100],
  fxScanlinesAmount: [0, 100],
  fxScanlinesSpacing: [2, 12],
  fxRgbSplitOffset: [0, 30],
  fxGlitchAmount: [0, 100],
  fxGlitchSeed: [1, 9999],
  fxCrtAmount: [0, 100],
  fxVignetteAmount: [0, 100],
  fxGrainAmount: [0, 100],
};

const ENUMS: Partial<Record<keyof Settings, readonly string[]>> = {
  style: STYLE_IDS,
  ditherAlgo: DITHER_ALGOS,
  background: ['blur', 'solid', 'none'],
  colorMode: ['source', 'mono'],
  mosaicShape: ['square', 'wide', 'tall'],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/**
 * Builds a full, valid Settings object from untrusted partial input
 * (a share link, local storage, a UI event). Unknown keys and invalid
 * values fall back to DEFAULTS.
 */
export function sanitize(input: unknown): Settings {
  const out: Settings = { ...DEFAULTS };
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    if (!(key in src)) continue;
    const value = src[key];
    const fallback = DEFAULTS[key];
    if (typeof fallback === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const range = RANGES[key];
      (out[key] as number) = range ? Math.min(range[1], Math.max(range[0], value)) : value;
    } else if (typeof fallback === 'boolean') {
      if (typeof value === 'boolean') (out[key] as boolean) = value;
    } else if (typeof fallback === 'string') {
      if (typeof value !== 'string') continue;
      const allowed = ENUMS[key];
      if (allowed && !allowed.includes(value)) continue;
      if (key.endsWith('Color') && !HEX_COLOR.test(value)) continue;
      if (key === 'charset' && (value.length === 0 || value.length > 96)) continue;
      (out[key] as string) = value;
    }
  }
  return out;
}
