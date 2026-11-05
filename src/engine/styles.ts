import type { StyleId } from './settings';

export type StyleGroup = 'ASCII & text' | 'Shapes' | 'Print';

export interface StyleInfo {
  id: StyleId;
  label: string;
  /** A glyph used as the style's icon. */
  icon: string;
  blurb: string;
  group: StyleGroup;
  /** Short descriptors, shown on cards and matched by search. */
  tags: readonly string[];
}

export const STYLE_GROUPS: readonly StyleGroup[] = ['ASCII & text', 'Shapes', 'Print'];

export const STYLES: readonly StyleInfo[] = [
  { id: 'characters', label: 'ASCII', icon: '@', group: 'ASCII & text', tags: ['classic', 'text'], blurb: 'Classic ASCII art: brighter areas get denser characters.' },
  { id: 'braille', label: 'Braille', icon: '⣿', group: 'ASCII & text', tags: ['fine', 'dots'], blurb: 'Eight dots per character: the sharpest text style.' },
  { id: 'blocks', label: 'Blocks', icon: '▓', group: 'ASCII & text', tags: ['bold', 'terminal'], blurb: 'Shaded block characters for a solid, terminal look.' },
  { id: 'lines', label: 'Lines', icon: '▌', group: 'ASCII & text', tags: ['stripes', 'minimal'], blurb: 'Vertical bars that thin out in the shadows.' },
  { id: 'diagonal', label: 'Diagonal', icon: '╲', group: 'ASCII & text', tags: ['hatch', 'sketch'], blurb: 'Slanted strokes, like quick pen hatching.' },
  { id: 'cross', label: 'Cross', icon: '╋', group: 'ASCII & text', tags: ['grid', 'geometric'], blurb: 'Box-drawing crosses that fade to plus signs.' },
  { id: 'diamond', label: 'Diamond', icon: '◆', group: 'ASCII & text', tags: ['geometric', 'gem'], blurb: 'Filled and hollow diamonds.' },
  { id: 'mixed', label: 'Mixed', icon: '※', group: 'ASCII & text', tags: ['noisy', 'texture'], blurb: 'Every cell picks a different glyph family.' },
  { id: 'dots', label: 'Dots', icon: '●', group: 'Shapes', tags: ['halftone', 'print'], blurb: 'Halftone-style dots sized by brightness.' },
  { id: 'pixel', label: 'Pixel', icon: '▣', group: 'Shapes', tags: ['retro', 'color'], blurb: 'Chunky pixels with a limited color depth.' },
  { id: 'mosaic', label: 'Mosaic', icon: '▢', group: 'Shapes', tags: ['tiles', 'color'], blurb: 'Rounded tiles with grout between them.' },
  { id: 'lego', label: 'Bricks', icon: '◉', group: 'Shapes', tags: ['toy', 'color'], blurb: 'Toy bricks with studs, seen from above.' },
  { id: 'disco', label: 'Disco', icon: '✦', group: 'Shapes', tags: ['shiny', 'party'], blurb: 'Mirror-ball tiles with sparkles.' },
  { id: 'voxel', label: 'Cubes', icon: '⬢', group: 'Shapes', tags: ['3d', 'geometric'], blurb: 'Isometric cubes shaded from the photo.' },
  { id: 'dither', label: 'Dither', icon: '▚', group: 'Print', tags: ['retro', 'palette'], blurb: 'Retro dithering with classic palettes.' },
];
