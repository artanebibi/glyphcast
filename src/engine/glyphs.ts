/** Named ramps for the characters style, densest glyph first. */
export const CHARSET_PRESETS: ReadonlyArray<{ id: string; label: string; chars: string }> = [
  { id: 'classic', label: 'Classic', chars: '@%#*+=-:. ' },
  {
    id: 'detailed',
    label: 'Detailed',
    chars: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
  },
  { id: 'letters', label: 'Letters', chars: 'MWNHBEKAXRDPSZYVUOGQCLTJFIxuwnvcrsoeazl. ' },
  { id: 'digits', label: 'Digits', chars: '8096532471 ' },
  { id: 'binary', label: 'Binary', chars: '10 ' },
  { id: 'hex', label: 'Hex', chars: '8BDE09A6F35C247 ' },
  { id: 'symbols', label: 'Symbols', chars: '#&$%?!+;:,. ' },
  { id: 'minimal', label: 'Minimal', chars: '#+-. ' },
];

/** Fixed glyph sets for the line-art styles, densest first. */
export const STYLE_RAMPS = {
  blocks: '█▓▒░ ',
  lines: '█▌▍▎▏ ',
  diagonal: '╳╲⟍\\· ',
  cross: '╋┼+·  ',
  diamond: '◆◈◇⋄· ',
} as const;

/** Families the mixed style picks from, one per cell. */
export const MIXED_FAMILIES: readonly string[] = ['▓▒░· ', '┃│╎┊ ', '╳╲\\⋱ ', '╋┼+· ', '◆◇⋄· '];

/**
 * Picks a glyph from a ramp written densest-first.
 * level is 0 (dark) .. 1 (bright); bright cells get dense glyphs.
 */
export function pickGlyph(ramp: string, level: number): string {
  const chars = Array.from(ramp);
  if (chars.length === 0) return ' ';
  const clamped = level < 0 ? 0 : level > 1 ? 1 : level;
  const index = Math.min(chars.length - 1, Math.floor((1 - clamped) * chars.length));
  return chars[index];
}

/**
 * Unicode braille bit for each dot, indexed as [column * 4 + row]
 * for a 2-wide, 4-tall cell.
 */
const BRAILLE_BITS = [0, 1, 2, 6, 3, 4, 5, 7];

/** Ordered-dither thresholds for the 8 dots, so mid-tones become patterns. */
const BRAILLE_ORDER = [0, 5, 2, 7, 4, 1, 6, 3];

/**
 * Builds one braille character from 8 dot levels (0..1),
 * indexed as [column * 4 + row]. bias shifts how many dots light up.
 */
export function brailleChar(levels: ArrayLike<number>, bias = 0): string {
  let bits = 0;
  for (let i = 0; i < 8; i++) {
    const threshold = (BRAILLE_ORDER[i] + 0.5) / 8;
    if (levels[i] + bias > threshold) bits |= 1 << BRAILLE_BITS[i];
  }
  return String.fromCharCode(0x2800 + bits);
}
