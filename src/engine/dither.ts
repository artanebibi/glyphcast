import { adjustChannel, contrastFactor, hexToRgb, type Pixels } from './pixels';
import type { DitherAlgo } from './settings';

export type Rgb = [number, number, number];

const hexes = (...colors: string[]): Rgb[] => colors.map(hexToRgb);

/** Built-in palettes. Classic hardware palettes are public, widely published color sets. */
export const PALETTES: Record<string, { label: string; colors: Rgb[] }> = {
  mono: { label: 'Black & white', colors: hexes('#000000', '#ffffff') },
  grey4: { label: 'Grey (4)', colors: hexes('#000000', '#555555', '#aaaaaa', '#ffffff') },
  terminal: { label: 'Terminal green', colors: hexes('#020a04', '#0f3d1c', '#2f9e52', '#9dffb0') },
  amber: { label: 'Amber', colors: hexes('#0d0700', '#4a2a00', '#b36b00', '#ffc04d') },
  handheld: { label: 'Handheld', colors: hexes('#0f380f', '#306230', '#8bac0f', '#9bbc0f') },
  cga: { label: 'CGA', colors: hexes('#000000', '#55ffff', '#ff55ff', '#ffffff') },
  rgb8: {
    label: 'RGB (8)',
    colors: hexes('#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#ffffff'),
  },
  pico: {
    label: 'Pico 16',
    colors: hexes(
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa',
    ),
  },
  c64: {
    label: 'C64',
    colors: hexes(
      '#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77',
      '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb',
    ),
  },
  sepia: { label: 'Sepia', colors: hexes('#1b120b', '#5e4029', '#a67c52', '#f2e1c2') },
  riso: { label: 'Riso', colors: hexes('#f7f1e3', '#ff48b0', '#0078bf', '#1a1a1a') },
};

export function nearestColor(palette: Rgb[], r: number, g: number, b: number): Rgb {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dr = r - c[0];
    const dg = g - c[1];
    const db = b - c[2];
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** Bayer threshold matrix of size n (power of two), values 0..n*n-1. */
export function bayerMatrix(n: number): number[][] {
  if (n <= 1) return [[0]];
  const half = bayerMatrix(n / 2);
  const size = half.length;
  const out: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = half[y][x] * 4;
      out[y][x] = v;
      out[y][x + size] = v + 2;
      out[y + size][x] = v + 3;
      out[y + size][x + size] = v + 1;
    }
  }
  return out;
}

/** Error-diffusion kernels as [dx, dy, weight]. */
export const KERNELS: Record<string, ReadonlyArray<readonly [number, number, number]>> = {
  floyd: [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
  stucki: [
    [1, 0, 8 / 42],
    [2, 0, 4 / 42],
    [-2, 1, 2 / 42],
    [-1, 1, 4 / 42],
    [0, 1, 8 / 42],
    [1, 1, 4 / 42],
    [2, 1, 2 / 42],
    [-2, 2, 1 / 42],
    [-1, 2, 2 / 42],
    [0, 2, 4 / 42],
    [1, 2, 2 / 42],
    [2, 2, 1 / 42],
  ],
  sierraLite: [
    [1, 0, 2 / 4],
    [-1, 1, 1 / 4],
    [0, 1, 1 / 4],
  ],
};

export interface DitherOptions {
  algo: DitherAlgo;
  palette: Rgb[];
  brightness: number;
  contrast: number;
  invert: boolean;
}

/** Returns a new image where every pixel is a palette color. */
export function dither(src: Pixels, opts: DitherOptions): Pixels {
  const { width, height } = src;
  const factor = contrastFactor(opts.contrast);
  const work = new Float32Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    for (let c = 0; c < 3; c++) {
      let v = adjustChannel(src.data[i * 4 + c], factor, opts.brightness);
      if (opts.invert) v = 255 - v;
      work[j + c] = v;
    }
  }
  const out = new Uint8ClampedArray(width * height * 4);
  const palette = opts.palette.length ? opts.palette : PALETTES.mono.colors;

  if (opts.algo.startsWith('bayer')) {
    const n = Number(opts.algo.slice(5));
    const matrix = bayerMatrix(n);
    const cells = n * n;
    // Spread roughly one palette step so mid-tones turn into patterns.
    const spread = 255 / Math.max(1, Math.cbrt(palette.length) * 1.1);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const t = ((matrix[y % n][x % n] + 0.5) / cells - 0.5) * spread;
        const j = (y * width + x) * 3;
        const [r, g, b] = nearestColor(palette, work[j] + t, work[j + 1] + t, work[j + 2] + t);
        const o = (y * width + x) * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = 255;
      }
    }
    return { width, height, data: out };
  }

  const kernel = KERNELS[opts.algo] ?? KERNELS.floyd;
  for (let y = 0; y < height; y++) {
    // Serpentine scan avoids the diagonal "worm" artifacts of one-way scans.
    const leftToRight = y % 2 === 0;
    for (let step = 0; step < width; step++) {
      const x = leftToRight ? step : width - 1 - step;
      const j = (y * width + x) * 3;
      const r0 = work[j];
      const g0 = work[j + 1];
      const b0 = work[j + 2];
      const [r, g, b] = nearestColor(palette, r0, g0, b0);
      const o = (y * width + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
      const er = r0 - r;
      const eg = g0 - g;
      const eb = b0 - b;
      for (const [dx0, dy, w] of kernel) {
        const dx = leftToRight ? dx0 : -dx0;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny >= height) continue;
        const k = (ny * width + nx) * 3;
        work[k] += er * w;
        work[k + 1] += eg * w;
        work[k + 2] += eb * w;
      }
    }
  }
  return { width, height, data: out };
}
