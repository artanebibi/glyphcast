import { describe, expect, it } from 'vitest';
import { analyzeCells, glyphGrid, lumaRange } from './cells';
import { bayerMatrix, dither, KERNELS, nearestColor, PALETTES } from './dither';
import { toHtml, toPlainText } from './export';
import { crtCurve, glitch, rgbSplit } from './fx';
import { brailleChar, pickGlyph } from './glyphs';
import { adjustChannel, contrastFactor, createPixels } from './pixels';
import { decodeRecipe, encodeRecipe, settingsDelta } from './recipe';
import { DEFAULTS, sanitize, STYLE_IDS } from './settings';
import { STYLES } from './styles';

describe('settings', () => {
  it('falls back to defaults for junk input', () => {
    expect(sanitize(null)).toEqual(DEFAULTS);
    expect(sanitize({ style: 'nope', cellSize: 'big', invert: 'yes' })).toEqual(DEFAULTS);
  });

  it('clamps numbers and validates colors', () => {
    const s = sanitize({ cellSize: 9999, bgColor: 'red', inkColor: '#00FF00' });
    expect(s.cellSize).toBe(48);
    expect(s.bgColor).toBe(DEFAULTS.bgColor);
    expect(s.inkColor).toBe('#00FF00');
  });

  it('has a gallery entry for every style', () => {
    expect(STYLES.map((s) => s.id).sort()).toEqual([...STYLE_IDS].sort());
  });
});

describe('recipe', () => {
  it('round-trips settings, including unicode charsets', () => {
    const s = sanitize({ style: 'braille', cellSize: 8, charset: '█▓▒░ ', fxGlitch: true });
    const decoded = decodeRecipe(encodeRecipe(s));
    expect(decoded).toEqual({ ok: true, settings: s });
  });

  it('stores only changed keys', () => {
    expect(settingsDelta(DEFAULTS)).toEqual({});
    expect(settingsDelta({ ...DEFAULTS, style: 'dots' })).toEqual({ style: 'dots' });
  });

  it('reads codes from full links and rejects bad input', () => {
    const code = encodeRecipe({ ...DEFAULTS, style: 'lego' });
    const fromLink = decodeRecipe(`https://example.com/?r=${code}&x=1`);
    expect(fromLink.ok && fromLink.settings.style).toBe('lego');
    expect(decodeRecipe('').ok).toBe(false);
    expect(decodeRecipe('%%%').ok).toBe(false);
    expect(decodeRecipe(btoa(JSON.stringify({ v: 99 }))).ok).toBe(false);
  });
});

describe('glyphs', () => {
  it('maps bright cells to dense glyphs', () => {
    expect(pickGlyph('@%#*+=-:. ', 1)).toBe('@');
    expect(pickGlyph('@%#*+=-:. ', 0)).toBe(' ');
    expect(pickGlyph('@%#*+=-:. ', 0.5)).toBe('=');
  });

  it('handles multi-code-unit glyphs', () => {
    expect(pickGlyph('█▓▒░ ', 1)).toBe('█');
  });

  it('builds braille characters from dot levels', () => {
    expect(brailleChar(new Array(8).fill(0))).toBe('⠀');
    expect(brailleChar(new Array(8).fill(1))).toBe('⣿');
    // Only the top-left dot (dot 1, bit 0).
    expect(brailleChar([1, 0, 0, 0, 0, 0, 0, 0], -0.1)).toBe('⠁');
    // Only the bottom-right dot (dot 8, bit 7).
    expect(brailleChar([0, 0, 0, 0, 0, 0, 0, 1], -0.1)).toBe('⢀');
  });
});

describe('pixels and cells', () => {
  it('uses the standard contrast curve', () => {
    expect(contrastFactor(0)).toBeCloseTo(1, 6);
    expect(contrastFactor(50)).toBeGreaterThan(1);
    expect(adjustChannel(128, contrastFactor(100), 0)).toBeCloseTo(128, 0);
    expect(adjustChannel(200, 1, 100)).toBe(255);
  });

  it('ignores 1% outliers when stretching levels', () => {
    const values = new Array(1000).fill(100);
    for (let i = 0; i < 500; i++) values[i] = 50;
    values[0] = 0;
    values[999] = 255;
    expect(lumaRange(values)).toEqual([50, 100]);
  });

  it('normalizes a gradient to 0..1 and can invert it', () => {
    const px = createPixels(256, 1);
    for (let x = 0; x < 256; x++) px.data.set([x, x, x, 255], x * 4);
    const base = { ...DEFAULTS, contrast: 0 };
    const field = analyzeCells(px, base);
    expect(field.level[0]).toBe(0);
    expect(field.level[255]).toBe(1);
    expect(field.level[128]).toBeCloseTo(0.5, 1);
    expect(analyzeCells(px, { ...base, invert: true }).level[255]).toBe(0);
  });

  it('uses monospace-shaped cells', () => {
    expect(glyphGrid(600, 110, 10)).toEqual({ cols: 100, rows: 11, cellW: 6, cellH: 10 });
  });
});

describe('dither', () => {
  it('builds valid Bayer matrices', () => {
    const m = bayerMatrix(4).flat().sort((a, b) => a - b);
    expect(m).toEqual(Array.from({ length: 16 }, (_, i) => i));
  });

  it('error kernels distribute all the error', () => {
    for (const kernel of Object.values(KERNELS)) {
      expect(kernel.reduce((sum, [, , w]) => sum + w, 0)).toBeLessThanOrEqual(1.0000001);
    }
    expect(KERNELS.floyd.reduce((sum, [, , w]) => sum + w, 0)).toBeCloseTo(1, 9);
  });

  it('only outputs palette colors and keeps average brightness', () => {
    const px = createPixels(64, 64);
    for (let i = 0; i < 64 * 64; i++) px.data.set([128, 128, 128, 255], i * 4);
    for (const algo of ['bayer4', 'floyd', 'atkinson'] as const) {
      const out = dither(px, { algo, palette: PALETTES.mono.colors, brightness: 0, contrast: 0, invert: false });
      let white = 0;
      for (let i = 0; i < out.data.length; i += 4) {
        expect([0, 255]).toContain(out.data[i]);
        if (out.data[i] === 255) white++;
      }
      // About half the pixels should be white for 50% grey.
      expect(white / (64 * 64)).toBeGreaterThan(0.35);
      expect(white / (64 * 64)).toBeLessThan(0.65);
    }
  });

  it('finds the nearest palette color', () => {
    expect(nearestColor(PALETTES.mono.colors, 200, 200, 200)).toEqual([255, 255, 255]);
    expect(nearestColor(PALETTES.mono.colors, 20, 20, 20)).toEqual([0, 0, 0]);
  });
});

describe('effects', () => {
  it('rgb split moves only the red and blue channels', () => {
    const px = createPixels(4, 1);
    px.data.set([10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255]);
    rgbSplit(px, 1);
    expect(Array.from(px.data.slice(4, 8))).toEqual([70, 50, 30, 255]);
  });

  it('glitch is deterministic for a seed', () => {
    const make = () => {
      const px = createPixels(32, 32);
      for (let i = 0; i < px.data.length; i++) px.data[i] = (i * 37) % 251;
      return px;
    };
    const a = make();
    const b = make();
    glitch(a, 0.6, 42);
    glitch(b, 0.6, 42);
    expect(a.data).toEqual(b.data);
  });

  it('crt curve keeps the center pixel', () => {
    const px = createPixels(9, 9);
    px.data.set([1, 2, 3, 255], (4 * 9 + 4) * 4);
    crtCurve(px, 1);
    expect(Array.from(px.data.slice((4 * 9 + 4) * 4, (4 * 9 + 4) * 4 + 4))).toEqual([1, 2, 3, 255]);
  });
});

describe('export', () => {
  const grid = {
    cols: 3,
    rows: 2,
    chars: ['@', '<', ' ', ' ', '#', ' '],
    rgb: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0, 0, 0, 0]),
  };

  it('writes plain text without trailing spaces', () => {
    expect(toPlainText(grid)).toBe('@<\n #');
  });

  it('writes escaped, colored HTML', () => {
    const html = toHtml(grid, '#000000');
    expect(html).toContain('<span style="color:#f80000">@&lt;</span>');
    expect(html).toContain('<span style="color:#00f800">#</span>');
  });
});
