import { adjustChannel, contrastFactor, luma, type Pixels } from './pixels';
import type { Settings } from './settings';

/** Per-cell values derived from a downsampled image (one pixel per cell). */
export interface CellField {
  cols: number;
  rows: number;
  /** 0 (dark) .. 1 (bright), after auto-levels and invert. */
  level: Float32Array;
  /** Adjusted color, 3 bytes per cell. */
  rgb: Uint8ClampedArray;
}

export interface Grid {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

/** Monospace cells: height = cellSize, width = 0.6 * cellSize. */
export function glyphGrid(width: number, height: number, cellSize: number): Grid {
  const cellH = cellSize;
  const cellW = cellSize * 0.6;
  return { cols: Math.ceil(width / cellW), rows: Math.ceil(height / cellH), cellW, cellH };
}

/** Square cells for the block styles (pixel, mosaic, lego, dots, disco). */
export function squareGrid(width: number, height: number, cellSize: number): Grid {
  return {
    cols: Math.ceil(width / cellSize),
    rows: Math.ceil(height / cellSize),
    cellW: cellSize,
    cellH: cellSize,
  };
}

/**
 * Finds the luma range to stretch to 0..1, ignoring the darkest and
 * brightest 1% so a few stray pixels don't flatten the image.
 */
export function lumaRange(values: ArrayLike<number>): [number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    hist[v < 0 ? 0 : v > 255 ? 255 : v | 0]++;
  }
  const cut = Math.floor(values.length * 0.01);
  let lo = 0;
  for (let acc = 0; lo < 255; lo++) {
    acc += hist[lo];
    if (acc > cut) break;
  }
  let hi = 255;
  for (let acc = 0; hi > 0; hi--) {
    acc += hist[hi];
    if (acc > cut) break;
  }
  if (hi <= lo) return [Math.max(0, lo - 1), Math.min(255, lo + 1)];
  return [lo, hi];
}

/** Turns one-pixel-per-cell samples into normalized levels and adjusted colors. */
export function analyzeCells(px: Pixels, s: Settings): CellField {
  const count = px.width * px.height;
  const factor = contrastFactor(s.contrast);
  const rgb = new Uint8ClampedArray(count * 3);
  const lum = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = adjustChannel(px.data[i * 4], factor, s.brightness);
    const g = adjustChannel(px.data[i * 4 + 1], factor, s.brightness);
    const b = adjustChannel(px.data[i * 4 + 2], factor, s.brightness);
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
    lum[i] = luma(r, g, b);
  }
  const [lo, hi] = lumaRange(lum);
  const span = hi - lo;
  const level = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    let v = (lum[i] - lo) / span;
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    level[i] = s.invert ? 1 - v : v;
  }
  return { cols: px.width, rows: px.height, level, rgb };
}

/** Normalizes raw luma samples with a precomputed range (used for braille sub-dots). */
export function normalizeLevel(value: number, lo: number, hi: number, invert: boolean): number {
  let v = (value - lo) / (hi - lo || 1);
  v = v < 0 ? 0 : v > 1 ? 1 : v;
  return invert ? 1 - v : v;
}
