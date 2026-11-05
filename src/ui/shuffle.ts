import { CHARSET_PRESETS } from '../engine/glyphs';
import { PALETTES } from '../engine/dither';
import { DITHER_ALGOS, sanitize, STYLE_IDS, type Settings } from '../engine/settings';

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

/** A random but tasteful look: new style, tone and maybe one effect. */
export function shuffleSettings(current: Settings): Settings {
  const style = pick(STYLE_IDS.filter((s) => s !== current.style));
  const effect = pick(['none', 'none', 'fxGlow', 'fxScanlines', 'fxRgbSplit', 'fxVignette', 'fxGrain'] as const);
  return sanitize({
    ...current,
    style,
    cellSize: between(7, 16),
    brightness: between(-10, 15),
    contrast: between(5, 45),
    darkCutoff: between(10, 40),
    charset: style === 'characters' ? pick(CHARSET_PRESETS).chars : current.charset,
    ditherAlgo: pick(DITHER_ALGOS),
    ditherPalette: pick(Object.keys(PALETTES)),
    ditherScale: between(2, 5),
    mosaicShape: pick(['square', 'wide', 'tall'] as const),
    discoSeed: between(1, 9999),
    fxGlow: effect === 'fxGlow',
    fxScanlines: effect === 'fxScanlines',
    fxRgbSplit: effect === 'fxRgbSplit',
    fxVignette: effect === 'fxVignette',
    fxGrain: effect === 'fxGrain',
    fxGlitch: false,
    fxCrt: false,
  });
}
