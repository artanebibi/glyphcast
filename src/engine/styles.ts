import type { StyleId } from './settings';

export interface StyleInfo {
  id: StyleId;
  label: string;
  /** A glyph shown on the style's button. */
  icon: string;
  blurb: string;
  group: 'Text' | 'Shapes' | 'Print';
}

export const STYLES: readonly StyleInfo[] = [
  { id: 'characters', label: 'ASCII', icon: '@', group: 'Text', blurb: 'Classic ASCII art: brighter areas get denser characters.' },
  { id: 'blocks', label: 'Blocks', icon: '▓', group: 'Text', blurb: 'Shaded block characters for a solid, terminal look.' },
  { id: 'braille', label: 'Braille', icon: '⣿', group: 'Text', blurb: 'Eight dots per character: the sharpest text style.' },
  { id: 'lines', label: 'Lines', icon: '▌', group: 'Text', blurb: 'Vertical bars that thin out in the shadows.' },
  { id: 'diagonal', label: 'Diagonal', icon: '╲', group: 'Text', blurb: 'Slanted strokes, like quick pen hatching.' },
  { id: 'cross', label: 'Cross', icon: '╋', group: 'Text', blurb: 'Box-drawing crosses that fade to plus signs.' },
  { id: 'diamond', label: 'Diamond', icon: '◆', group: 'Text', blurb: 'Filled and hollow diamonds.' },
  { id: 'mixed', label: 'Mixed', icon: '※', group: 'Text', blurb: 'Every cell picks a different glyph family.' },
  { id: 'dots', label: 'Dots', icon: '●', group: 'Shapes', blurb: 'Halftone-style dots sized by brightness.' },
  { id: 'pixel', label: 'Pixel', icon: '▣', group: 'Shapes', blurb: 'Chunky pixels with a limited color depth.' },
  { id: 'mosaic', label: 'Mosaic', icon: '▢', group: 'Shapes', blurb: 'Rounded tiles with grout between them.' },
  { id: 'lego', label: 'Bricks', icon: '◉', group: 'Shapes', blurb: 'Toy bricks with studs, seen from above.' },
  { id: 'disco', label: 'Disco', icon: '✦', group: 'Shapes', blurb: 'Mirror-ball tiles with sparkles.' },
  { id: 'voxel', label: 'Cubes', icon: '⬢', group: 'Shapes', blurb: 'Isometric cubes shaded from the photo.' },
  { id: 'dither', label: 'Dither', icon: '▚', group: 'Print', blurb: 'Retro dithering with classic palettes.' },
];
