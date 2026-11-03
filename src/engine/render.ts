import { analyzeCells, glyphGrid, lumaRange, normalizeLevel, squareGrid, type CellField, type Grid } from './cells';
import { dither, PALETTES } from './dither';
import { crtCurve, glitch, grain, rgbSplit } from './fx';
import { brailleChar, MIXED_FAMILIES, pickGlyph, STYLE_RAMPS } from './glyphs';
import { adjustChannel, contrastFactor, hexToRgb, luma, rgbCss, smoothstep, type Pixels } from './pixels';
import { hash2 } from './random';
import type { Settings, StyleId } from './settings';

export interface SourceImage {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/** The character grid behind a text-based render, for TXT/HTML export. */
export interface TextGrid {
  cols: number;
  rows: number;
  chars: string[];
  /** 3 bytes per cell. */
  rgb: Uint8ClampedArray;
}

export interface RenderResult {
  width: number;
  height: number;
  /** Cell size actually used (may be raised to keep very large grids fast). */
  cellSize: number;
  text: TextGrid | null;
  ms: number;
}

const GLYPH_STYLES: ReadonlySet<StyleId> = new Set([
  'characters',
  'blocks',
  'lines',
  'diagonal',
  'cross',
  'diamond',
  'mixed',
  'braille',
]);

export const isTextStyle = (style: StyleId): boolean => GLYPH_STYLES.has(style);

/** Upper bound on drawn cells, to keep a redraw well under a second. */
const MAX_CELLS = 160_000;

const FONT_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';

// ---------------------------------------------------------------------------
// Canvas helpers

const pool = new Map<string, HTMLCanvasElement>();

function scratch(key: string, width: number, height: number): HTMLCanvasElement {
  let c = pool.get(key);
  if (!c) {
    c = document.createElement('canvas');
    pool.set(key, c);
  }
  if (c.width !== width) c.width = width;
  if (c.height !== height) c.height = height;
  return c;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
  return ctx;
}

/**
 * Downscales in halving steps so large reductions average pixels
 * instead of skipping them (one big drawImage step aliases badly).
 */
function downscale(src: SourceImage, width: number, height: number, key: string): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  let current: CanvasImageSource = src.image;
  let cw = src.width;
  let ch = src.height;
  let flip = 0;
  while (cw > w * 2 && ch > h * 2) {
    const nw = Math.max(w, Math.floor(cw / 2));
    const nh = Math.max(h, Math.floor(ch / 2));
    const step = scratch(`${key}:step${flip}`, nw, nh);
    const sctx = ctx2d(step);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.clearRect(0, 0, nw, nh);
    sctx.drawImage(current, 0, 0, cw, ch, 0, 0, nw, nh);
    current = step;
    cw = nw;
    ch = nh;
    flip ^= 1;
  }
  const out = scratch(key, w, h);
  const octx = ctx2d(out);
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.clearRect(0, 0, w, h);
  octx.drawImage(current, 0, 0, cw, ch, 0, 0, w, h);
  return out;
}

function readPixels(canvas: HTMLCanvasElement): Pixels {
  const data = ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  return { width: canvas.width, height: canvas.height, data };
}

export function outputDimensions(srcW: number, srcH: number, longSide: number): { width: number; height: number } {
  const scale = longSide / Math.max(srcW, srcH);
  return {
    width: Math.max(1, Math.round(srcW * scale)),
    height: Math.max(1, Math.round(srcH * scale)),
  };
}

// ---------------------------------------------------------------------------
// Background

function paintBackground(ctx: CanvasRenderingContext2D, src: SourceImage, W: number, H: number, s: Settings, cell: number) {
  if (s.background === 'none') {
    ctx.clearRect(0, 0, W, H);
    return;
  }
  ctx.fillStyle = s.bgColor;
  ctx.fillRect(0, 0, W, H);
  if (s.background !== 'blur' || s.bgOpacity <= 0) return;
  const factor = cell * (0.5 + s.bgBlur);
  const small = downscale(src, W / factor, H / factor, 'bg');
  ctx.save();
  ctx.globalAlpha = s.bgOpacity / 100;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Shared per-cell helpers

/** Fade-in for dim cells: 0 below the cutoff, 1 well above it. */
function cutoffAlpha(level: number, darkCutoff: number): number {
  const cut = (darkCutoff / 100) * 0.6;
  if (cut <= 0) return 1;
  return smoothstep(cut * 0.55, cut, level);
}

function covered(col: number, row: number, coverage: number): boolean {
  return coverage >= 100 || hash2(col, row, 3) * 100 < coverage;
}

function cellColor(field: CellField, i: number, s: Settings, ink: [number, number, number], shade = 1): [number, number, number] {
  if (s.colorMode === 'mono') {
    const k = shade * (0.25 + 0.75 * field.level[i]);
    return [ink[0] * k, ink[1] * k, ink[2] * k];
  }
  return [field.rgb[i * 3] * shade, field.rgb[i * 3 + 1] * shade, field.rgb[i * 3 + 2] * shade];
}

function sampleField(src: SourceImage, grid: Grid, s: Settings, key = 'cells'): CellField {
  return analyzeCells(readPixels(downscale(src, grid.cols, grid.rows, key)), s);
}

// ---------------------------------------------------------------------------
// Text styles

function rampFor(style: StyleId, s: Settings): string {
  switch (style) {
    case 'blocks':
    case 'lines':
    case 'diagonal':
    case 'cross':
    case 'diamond':
      return STYLE_RAMPS[style];
    default:
      return s.charset;
  }
}

function drawGlyphs(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings): TextGrid {
  const field = sampleField(src, grid, s);
  const { cols, rows, cellW, cellH } = grid;
  const ink = hexToRgb(s.inkColor);
  const baseRamp = rampFor(s.style, s);
  const opacity = s.glyphOpacity / 100;
  const chars = new Array<string>(cols * rows).fill(' ');
  const lift = (s.darkCutoff / 100) * 0.6 * 0.55;

  ctx.font = `${cellH}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const level = field.level[i];
      const alpha = cutoffAlpha(level, s.darkCutoff);
      if (alpha <= 0.02 || !covered(c, r, s.coverage)) continue;
      const ramp =
        s.style === 'mixed' ? MIXED_FAMILIES[Math.floor(hash2(c, r, 11) * MIXED_FAMILIES.length)] : baseRamp;
      // Use the whole ramp for the cells that survive the cutoff.
      const glyph = pickGlyph(ramp, (level - lift) / (1 - lift));
      if (glyph === ' ') continue;
      chars[i] = glyph;
      const [R, G, B] = cellColor(field, i, s, ink, 1);
      ctx.fillStyle = rgbCss(R, G, B, alpha * opacity);
      ctx.fillText(glyph, (c + 0.5) * cellW, (r + 0.5) * cellH);
    }
  }
  return { cols, rows, chars, rgb: colorsFor(field, s, ink) };
}

function colorsFor(field: CellField, s: Settings, ink: [number, number, number]): Uint8ClampedArray {
  if (s.colorMode === 'source') return field.rgb;
  const out = new Uint8ClampedArray(field.cols * field.rows * 3);
  for (let i = 0; i < field.cols * field.rows; i++) {
    out[i * 3] = ink[0];
    out[i * 3 + 1] = ink[1];
    out[i * 3 + 2] = ink[2];
  }
  return out;
}

function drawBraille(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings): TextGrid {
  const { cols, rows, cellW, cellH } = grid;
  const field = sampleField(src, grid, s);
  const dots = readPixels(downscale(src, cols * 2, rows * 4, 'braille'));
  const factor = contrastFactor(s.contrast);
  const lum = new Float32Array(dots.width * dots.height);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = luma(
      adjustChannel(dots.data[i * 4], factor, s.brightness),
      adjustChannel(dots.data[i * 4 + 1], factor, s.brightness),
      adjustChannel(dots.data[i * 4 + 2], factor, s.brightness),
    );
  }
  const [lo, hi] = lumaRange(lum);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  const bias = (25 - s.darkCutoff) / 100;
  const chars = new Array<string>(cols * rows).fill(' ');
  const levels = new Float32Array(8);

  ctx.font = `${cellH}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!covered(c, r, s.coverage)) continue;
      for (let dc = 0; dc < 2; dc++) {
        for (let dr = 0; dr < 4; dr++) {
          const v = lum[(r * 4 + dr) * dots.width + (c * 2 + dc)];
          levels[dc * 4 + dr] = normalizeLevel(v, lo, hi, s.invert);
        }
      }
      const glyph = brailleChar(levels, bias);
      if (glyph === '⠀') continue;
      const i = r * cols + c;
      chars[i] = glyph;
      const [R, G, B] = cellColor(field, i, s, ink, 1);
      ctx.fillStyle = rgbCss(R, G, B, opacity);
      ctx.fillText(glyph, (c + 0.5) * cellW, (r + 0.5) * cellH);
    }
  }
  return { cols, rows, chars, rgb: colorsFor(field, s, ink) };
}

// ---------------------------------------------------------------------------
// Shape styles

function drawDots(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings) {
  const field = sampleField(src, grid, s);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  const size = Math.min(grid.cellW, grid.cellH);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const i = r * grid.cols + c;
      const level = field.level[i];
      const alpha = cutoffAlpha(level, s.darkCutoff * 0.6);
      if (alpha <= 0.02 || !covered(c, r, s.coverage)) continue;
      const radius = 0.5 * size * (0.1 + 0.9 * level);
      if (radius < 0.4) continue;
      const [R, G, B] = cellColor(field, i, s, ink);
      ctx.fillStyle = rgbCss(R, G, B, alpha * opacity);
      ctx.beginPath();
      ctx.arc((c + 0.5) * grid.cellW, (r + 0.5) * grid.cellH, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function quantize(v: number, levels: number): number {
  const steps = Math.max(1, levels - 1);
  return (Math.round((v / 255) * steps) / steps) * 255;
}

function drawPixels(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings) {
  const field = sampleField(src, grid, s);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!covered(c, r, s.coverage)) continue;
      const i = r * grid.cols + c;
      const [R, G, B] = cellColor(field, i, s, ink);
      ctx.fillStyle = rgbCss(quantize(R, s.pixelLevels), quantize(G, s.pixelLevels), quantize(B, s.pixelLevels), opacity);
      // Overlap by a hair so no seams show between cells.
      ctx.fillRect(Math.floor(c * grid.cellW), Math.floor(r * grid.cellH), Math.ceil(grid.cellW) + 1, Math.ceil(grid.cellH) + 1);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    ctx.rect(x, y, w, h);
  }
}

function drawMosaic(ctx: CanvasRenderingContext2D, src: SourceImage, W: number, H: number, s: Settings) {
  const tileW = s.cellSize * (s.mosaicShape === 'wide' ? 2 : 1);
  const tileH = s.cellSize * (s.mosaicShape === 'tall' ? 2 : 1);
  const grid: Grid = { cols: Math.ceil(W / tileW), rows: Math.ceil(H / tileH), cellW: tileW, cellH: tileH };
  const field = sampleField(src, grid, s);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  const gap = Math.max(1, Math.min(tileW, tileH) * 0.08);
  const radius = Math.min(tileW, tileH) * 0.22;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!covered(c, r, s.coverage)) continue;
      const i = r * grid.cols + c;
      const [R, G, B] = cellColor(field, i, s, ink);
      ctx.fillStyle = rgbCss(R, G, B, opacity);
      roundRect(ctx, c * tileW + gap / 2, r * tileH + gap / 2, tileW - gap, tileH - gap, radius);
      ctx.fill();
    }
  }
}

const brickCache = new Map<string, HTMLCanvasElement>();

function brickSprite(size: number, r: number, g: number, b: number): HTMLCanvasElement {
  const key = `${size}|${r},${g},${b}`;
  const cached = brickCache.get(key);
  if (cached) return cached;
  if (brickCache.size > 4096) brickCache.clear();
  const px = Math.max(4, Math.ceil(size));
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const c = ctx2d(canvas);
  const lighten = (k: number) => rgbCss(Math.min(255, r + k), Math.min(255, g + k), Math.min(255, b + k));
  const darken = (k: number) => rgbCss(r * k, g * k, b * k);
  // Plate with a light top-left edge and a dark bottom-right edge.
  c.fillStyle = rgbCss(r, g, b);
  c.fillRect(0, 0, px, px);
  const edge = Math.max(1, px * 0.06);
  c.fillStyle = lighten(28);
  c.fillRect(0, 0, px, edge);
  c.fillRect(0, 0, edge, px);
  c.fillStyle = darken(0.62);
  c.fillRect(0, px - edge, px, edge);
  c.fillRect(px - edge, 0, edge, px);
  // Stud: shadow, body, then a soft highlight.
  const cx = px / 2;
  const cy = px / 2;
  const rad = px * 0.3;
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath();
  c.arc(cx + px * 0.05, cy + px * 0.07, rad, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = lighten(14);
  c.beginPath();
  c.arc(cx, cy, rad, 0, Math.PI * 2);
  c.fill();
  const shine = c.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.05, cx - rad * 0.2, cy - rad * 0.2, rad);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = shine;
  c.beginPath();
  c.arc(cx, cy, rad, 0, Math.PI * 2);
  c.fill();
  brickCache.set(key, canvas);
  return canvas;
}

function drawLego(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings) {
  const field = sampleField(src, grid, s);
  const ink = hexToRgb(s.inkColor);
  ctx.save();
  ctx.globalAlpha = s.glyphOpacity / 100;
  ctx.imageSmoothingEnabled = true;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!covered(c, r, s.coverage)) continue;
      const i = r * grid.cols + c;
      const [R, G, B] = cellColor(field, i, s, ink);
      const sprite = brickSprite(grid.cellW, quantize(R, 8), quantize(G, 8), quantize(B, 8));
      ctx.drawImage(sprite, c * grid.cellW, r * grid.cellH, grid.cellW, grid.cellH);
    }
  }
  ctx.restore();
}

function drawDisco(ctx: CanvasRenderingContext2D, src: SourceImage, grid: Grid, s: Settings) {
  const field = sampleField(src, grid, s);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  const size = grid.cellW;
  const gap = Math.max(1, size * 0.1);
  const variation = s.discoVariation / 100;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!covered(c, r, s.coverage)) continue;
      const i = r * grid.cols + c;
      const level = field.level[i];
      const jitter = 1 + (hash2(c, r, s.discoSeed) - 0.5) * 1.2 * variation;
      const [R0, G0, B0] = cellColor(field, i, s, ink, (1 + 0.35 * level) * jitter);
      const R = Math.min(255, R0);
      const G = Math.min(255, G0);
      const B = Math.min(255, B0);
      const x = c * size + gap / 2;
      const y = r * size + gap / 2;
      const w = size - gap;
      const grad = ctx.createLinearGradient(x, y, x + w * 0.4, y + w);
      const hl = 0.25 + 0.5 * level;
      grad.addColorStop(0, rgbCss(R + (255 - R) * hl, G + (255 - G) * hl, B + (255 - B) * hl, opacity));
      grad.addColorStop(0.25, rgbCss(R, G, B, opacity));
      grad.addColorStop(1, rgbCss(R * 0.55, G * 0.55, B * 0.55, opacity));
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, w);
      // Occasional sparkle on bright tiles.
      if (hash2(c, r, s.discoSeed + 99) < 0.05 * level * level) {
        const sx = x + w * 0.3;
        const sy = y + w * 0.3;
        const arm = w * 0.9;
        ctx.strokeStyle = `rgba(255,255,255,${0.85 * opacity})`;
        ctx.lineWidth = Math.max(1, w * 0.08);
        ctx.beginPath();
        ctx.moveTo(sx - arm / 2, sy);
        ctx.lineTo(sx + arm / 2, sy);
        ctx.moveTo(sx, sy - arm / 2);
        ctx.lineTo(sx, sy + arm / 2);
        ctx.stroke();
      }
    }
  }
}

function drawVoxels(ctx: CanvasRenderingContext2D, src: SourceImage, W: number, H: number, s: Settings) {
  const t = s.voxelSize / 2; // hexagon "radius"
  const hexW = Math.sqrt(3) * t;
  const rowStep = 1.5 * t;
  const cols = Math.ceil(W / hexW) + 2;
  const rows = Math.ceil(H / rowStep) + 2;
  const sample = readPixels(downscale(src, Math.ceil(W / hexW) * 2, Math.ceil(H / rowStep) * 2, 'voxel'));
  const factor = contrastFactor(s.contrast);
  const ink = hexToRgb(s.inkColor);
  const opacity = s.glyphOpacity / 100;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineJoin = 'round';
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : hexW / 2;
    for (let c = 0; c < cols; c++) {
      const cx = c * hexW + offset - hexW / 2;
      const cy = r * rowStep - t / 2;
      if (cx < -hexW || cx > W + hexW || cy < -t * 2 || cy > H + t * 2) continue;
      if (!covered(c, r, s.coverage)) continue;
      const sx = Math.min(sample.width - 1, Math.max(0, Math.floor((cx / W) * sample.width)));
      const sy = Math.min(sample.height - 1, Math.max(0, Math.floor((cy / H) * sample.height)));
      const o = (sy * sample.width + sx) * 4;
      let R = adjustChannel(sample.data[o], factor, s.brightness);
      let G = adjustChannel(sample.data[o + 1], factor, s.brightness);
      let B = adjustChannel(sample.data[o + 2], factor, s.brightness);
      if (s.invert) {
        R = 255 - R;
        G = 255 - G;
        B = 255 - B;
      }
      if (s.colorMode === 'mono') {
        const k = 0.25 + (0.75 * luma(R, G, B)) / 255;
        R = ink[0] * k;
        G = ink[1] * k;
        B = ink[2] * k;
      }
      const top = rgbCss(Math.min(255, R * 1.3 + 12), Math.min(255, G * 1.3 + 12), Math.min(255, B * 1.3 + 12));
      const left = rgbCss(R * 0.9, G * 0.9, B * 0.9);
      const right = rgbCss(R * 0.55, G * 0.55, B * 0.55);
      const hw = hexW / 2;
      // Top face
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.moveTo(cx, cy - t);
      ctx.lineTo(cx + hw, cy - t / 2);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - hw, cy - t / 2);
      ctx.closePath();
      ctx.fill();
      // Left face
      ctx.fillStyle = left;
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy - t / 2);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + t);
      ctx.lineTo(cx - hw, cy + t / 2);
      ctx.closePath();
      ctx.fill();
      // Right face
      ctx.fillStyle = right;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + hw, cy - t / 2);
      ctx.lineTo(cx + hw, cy + t / 2);
      ctx.lineTo(cx, cy + t);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDither(ctx: CanvasRenderingContext2D, src: SourceImage, W: number, H: number, s: Settings) {
  const scale = Math.max(1, s.ditherScale);
  const small = readPixels(downscale(src, W / scale, H / scale, 'dither'));
  const palette = PALETTES[s.ditherPalette]?.colors ?? PALETTES.mono.colors;
  const out = dither(small, {
    algo: s.ditherAlgo,
    palette,
    brightness: s.brightness,
    contrast: s.contrast,
    invert: s.invert,
  });
  const canvas = scratch('dither:out', out.width, out.height);
  ctx2d(canvas).putImageData(new ImageData(new Uint8ClampedArray(out.data), out.width, out.height), 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = s.glyphOpacity / 100;
  ctx.drawImage(canvas, 0, 0, W, H);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Effects

function applyEffects(ctx: CanvasRenderingContext2D, W: number, H: number, s: Settings) {
  if (s.fxGlow && s.fxGlowAmount > 0) {
    const blurred = downscale({ image: ctx.canvas, width: W, height: H }, W / 6, H / 6, 'glow');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (s.fxGlowAmount / 100) * 0.9;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(blurred, 0, 0, W, H);
    ctx.restore();
  }

  const pixelFx = (s.fxRgbSplit && s.fxRgbSplitOffset > 0) || (s.fxGlitch && s.fxGlitchAmount > 0) ||
    (s.fxCrt && s.fxCrtAmount > 0) || (s.fxGrain && s.fxGrainAmount > 0);
  if (pixelFx) {
    const image = ctx.getImageData(0, 0, W, H);
    const px: Pixels = { width: W, height: H, data: image.data };
    const scale = Math.max(1, W / 800);
    if (s.fxRgbSplit) rgbSplit(px, s.fxRgbSplitOffset * scale);
    if (s.fxGlitch) glitch(px, s.fxGlitchAmount / 100, s.fxGlitchSeed);
    if (s.fxCrt) crtCurve(px, s.fxCrtAmount / 100);
    if (s.fxGrain) grain(px, s.fxGrainAmount / 100, s.fxGlitchSeed);
    ctx.putImageData(image, 0, 0);
  }

  if (s.fxScanlines && s.fxScanlinesAmount > 0) {
    const spacing = Math.max(2, s.fxScanlinesSpacing * Math.max(1, W / 800));
    const thick = Math.max(1, spacing / 3);
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${(s.fxScanlinesAmount / 100) * 0.75})`;
    for (let y = 0; y < H; y += spacing) ctx.fillRect(0, Math.round(y), W, thick);
    ctx.restore();
  }

  if (s.fxVignette && s.fxVignetteAmount > 0) {
    const amount = s.fxVignetteAmount / 100;
    const radius = Math.hypot(W, H) / 2;
    const g = ctx.createRadialGradient(W / 2, H / 2, radius * (0.75 - 0.5 * amount), W / 2, H / 2, radius);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.4 + 0.6 * amount)})`);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Entry point

/** Renders `src` into `target` with the given settings. */
export function render(target: HTMLCanvasElement, src: SourceImage, s: Settings): RenderResult {
  const start = performance.now();
  const { width: W, height: H } = outputDimensions(src.width, src.height, s.outputSize);
  if (target.width !== W) target.width = W;
  if (target.height !== H) target.height = H;
  const ctx = ctx2d(target);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Raise the cell size if the grid would be too big to draw quickly.
  const minCell = Math.sqrt((W * H) / (0.6 * MAX_CELLS));
  const cellSize = Math.max(s.cellSize, Math.ceil(minCell));
  const eff: Settings = cellSize === s.cellSize ? s : { ...s, cellSize };

  paintBackground(ctx, src, W, H, eff, cellSize);

  let text: TextGrid | null = null;
  switch (eff.style) {
    case 'braille':
      text = drawBraille(ctx, src, glyphGrid(W, H, cellSize), eff);
      break;
    case 'characters':
    case 'blocks':
    case 'lines':
    case 'diagonal':
    case 'cross':
    case 'diamond':
    case 'mixed':
      text = drawGlyphs(ctx, src, glyphGrid(W, H, cellSize), eff);
      break;
    case 'dots':
      drawDots(ctx, src, squareGrid(W, H, cellSize), eff);
      break;
    case 'pixel':
      drawPixels(ctx, src, squareGrid(W, H, cellSize), eff);
      break;
    case 'mosaic':
      drawMosaic(ctx, src, W, H, eff);
      break;
    case 'lego':
      drawLego(ctx, src, squareGrid(W, H, Math.max(cellSize, 8)), eff);
      break;
    case 'disco':
      drawDisco(ctx, src, squareGrid(W, H, cellSize), eff);
      break;
    case 'voxel':
      drawVoxels(ctx, src, W, H, eff);
      break;
    case 'dither':
      drawDither(ctx, src, W, H, eff);
      break;
  }

  applyEffects(ctx, W, H, eff);
  return { width: W, height: H, cellSize, text, ms: performance.now() - start };
}
