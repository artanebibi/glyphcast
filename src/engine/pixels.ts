/** A plain RGBA buffer, so the math can run (and be tested) without a canvas. */
export interface Pixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function createPixels(width: number, height: number): Pixels {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Standard contrast curve; contrast is -100..100. */
export function contrastFactor(contrast: number): number {
  const c = Math.max(-100, Math.min(100, contrast)) * 2.55;
  return (259 * (c + 255)) / (255 * (259 - c));
}

/** Applies brightness (-100..100) and a contrast factor to one channel. */
export function adjustChannel(value: number, factor: number, brightness: number): number {
  const v = factor * (value - 128) + 128 + brightness * 2.55;
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbCss(r: number, g: number, b: number, a = 1): string {
  const R = Math.round(r);
  const G = Math.round(g);
  const B = Math.round(b);
  return a >= 1 ? `rgb(${R},${G},${B})` : `rgba(${R},${G},${B},${a.toFixed(3)})`;
}

/** Hermite smoothstep. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x < edge0 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
