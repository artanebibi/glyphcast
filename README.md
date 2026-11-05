# glyphcast

Turn photos into ASCII art, braille, dots, pixels, toy bricks, isometric cubes and dithered prints, right in your browser. Nothing is uploaded: every image is processed on your own device.

## Styles

| Group | Styles |
|---|---|
| Text | ASCII (with character presets or your own), Blocks, Braille, Lines, Diagonal, Cross, Diamond, Mixed |
| Shapes | Dots, Pixel, Mosaic, Bricks, Disco, Cubes |
| Print | Dither (Bayer 2/4/8, Floyd–Steinberg, Atkinson, Stucki, Sierra Lite; 11 palettes) |

Effects you can stack on any style: glow, scanlines, RGB split, glitch, CRT curve, vignette, film grain.

## Features

- Style browser with live previews of your own picture in every style, search, and favorites.
- Undo/redo, hold-to-compare with the original, zoom, and a Shuffle button for random looks.
- Settings grouped by Style, Tone, Color & backdrop, Effects and Output.
- On phones: a swipeable style strip, a bottom action bar, and settings in a slide-up sheet.
- Open, drag in, or paste (Ctrl/Cmd+V) any image.
- Brightness, contrast, shadow cutoff, coverage, invert, photo colors or a single ink color.
- Background: blurred photo, solid color, or transparent.
- Export PNG at up to 3200 px. Text styles also export TXT and colored HTML, or copy to the clipboard.
- The address bar always holds a share link (`?r=…`) for the current look. It stores only the settings you changed.

## Develop

Requires Node.js 22+.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

## How it is built

- `src/engine/`: the renderer, written as plain TypeScript with no UI code.
  - `settings.ts`: every option, its default and its allowed range. `sanitize()` cleans untrusted input such as share links.
  - `recipe.ts`: share-link encoding (base64url JSON of the changed settings, versioned).
  - `cells.ts`: splits the picture into cells and measures each cell's brightness and color.
  - `glyphs.ts`: character ramps and braille encoding.
  - `render.ts`: draws each style on a canvas, then applies effects.
  - `dither.ts`, `fx.ts`: pure pixel algorithms, unit tested.
  - `export.ts`: TXT and HTML export.
- `src/App.tsx`: the editor layout, shortcuts and export actions.
- `src/ui/`: editor parts.
  - `StylesPanel.tsx`: style browser and the phone style strip.
  - `SettingsPanel.tsx`: the settings rail and panels.
  - `Stage.tsx`: canvas with zoom and before/after compare.
  - `thumbnails.ts`: live style previews.
  - `useHistory.ts`: undo/redo.

See [docs/how-it-works.md](docs/how-it-works.md) for the algorithms.

## Ideas for later

- Video input and GIF/MP4 export
- Per-cell animation
- Edge-aware glyphs
- More GPU effects (halftone CMYK, LED matrix, hex mosaic)
