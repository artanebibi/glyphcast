import type { Pixels } from './pixels';
import { mulberry32 } from './random';

/** Shifts red left and blue right by `offset` pixels. */
export function rgbSplit(px: Pixels, offset: number): void {
  const off = Math.round(offset);
  if (off === 0) return;
  const { width, height, data } = px;
  const src = data.slice();
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = (row + x) * 4;
      const xr = Math.min(width - 1, x + off);
      const xb = Math.max(0, x - off);
      data[i] = src[(row + xr) * 4];
      data[i + 2] = src[(row + xb) * 4 + 2];
    }
  }
}

/** Bulges the picture outward like an old curved screen. amount is 0..1. */
export function crtCurve(px: Pixels, amount: number): void {
  if (amount <= 0) return;
  const { width, height, data } = px;
  const src = data.slice();
  const k = 0.25 * amount;
  const cx = width / 2;
  const cy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x - cx) / cx;
      const v = (y - cy) / cy;
      const f = 1 + (u * u + v * v) * k;
      const sx = Math.round(u * f * cx + cx);
      const sy = Math.round(v * f * cy + cy);
      const o = (y * width + x) * 4;
      if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
        data[o] = data[o + 1] = data[o + 2] = 0;
        data[o + 3] = 255;
        continue;
      }
      const s = (sy * width + sx) * 4;
      data[o] = src[s];
      data[o + 1] = src[s + 1];
      data[o + 2] = src[s + 2];
      data[o + 3] = src[s + 3];
    }
  }
}

/**
 * Slides random horizontal bands sideways and splits their color.
 * Seeded so the same settings always give the same image.
 */
export function glitch(px: Pixels, amount: number, seed: number): void {
  if (amount <= 0) return;
  const { width, height, data } = px;
  const src = data.slice();
  const rand = mulberry32(seed);
  const bands = Math.floor(3 + 18 * amount);
  const maxShift = Math.max(1, Math.floor(width * 0.12 * amount));
  for (let n = 0; n < bands; n++) {
    const top = Math.floor(rand() * height);
    const h = Math.max(1, Math.floor((0.004 + rand() * 0.05) * height));
    const shift = Math.round((rand() - 0.5) * 2 * maxShift);
    const tint = rand() < 0.35;
    for (let y = top; y < Math.min(height, top + h); y++) {
      for (let x = 0; x < width; x++) {
        const sx = Math.min(width - 1, Math.max(0, x - shift));
        const o = (y * width + x) * 4;
        const s = (y * width + sx) * 4;
        data[o] = src[s];
        data[o + 1] = src[s + 1];
        data[o + 2] = src[s + 2];
        if (tint) {
          const sr = (y * width + Math.min(width - 1, sx + 6)) * 4;
          data[o] = src[sr];
        }
      }
    }
  }
}

/** Adds seeded monochrome film grain. amount is 0..1. */
export function grain(px: Pixels, amount: number, seed: number): void {
  if (amount <= 0) return;
  const { data } = px;
  const rand = mulberry32(seed * 7919 + 1);
  const strength = 70 * amount;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rand() - 0.5) * strength;
    data[i] += n;
    data[i + 1] += n;
    data[i + 2] += n;
  }
}
