# How glyphcast works

Every render runs these steps on a `<canvas>`.

## 1. Size and grid

- The output is the source picture scaled so its long side equals **Output size** (default 1600 px).
- Text styles use monospace-shaped cells: height = **cell size**, width = 0.6 × cell size.
- Shape styles (dots, pixel, mosaic, bricks, disco) use square cells.
- If a grid would exceed about 160,000 cells, the cell size is raised so a redraw stays fast. The status line says when this happens.

## 2. Sampling

- To get one value per cell, the picture is downscaled straight to `cols × rows` pixels.
- It shrinks in halving steps, so each cell's color is an average of its area rather than a single pixel. Single-step browser downscaling aliases badly.
- Braille samples a second, `2·cols × 4·rows` image, one pixel per dot.

## 3. Tone

For each cell:

1. Brightness and contrast are applied per channel: `v' = f·(v − 128) + 128 + 2.55·brightness`, where `f = 259(c+255) / (255(259−c))` and `c = 2.55·contrast`.
2. Luma is `0.299 R + 0.587 G + 0.114 B`.
3. Auto-levels stretch the luma range to 0..1, ignoring the darkest and brightest 1% of cells. **Invert** flips the result.

## 4. Drawing

**Text styles**
- Each style has a ramp written densest first, e.g. `@%#*+=-:. `.
- The glyph is `ramp[floor((1 − level) · length)]`, so bright cells get dense glyphs on the dark background.
- **Shadow cutoff** fades out cells below a threshold, with a smoothstep, leaving clean negative space. The rest of the ramp is then spread over the cells that remain.
- Glyphs are drawn with `fillText`, centered in their cell, in the cell's photo color or the chosen ink.
- **Mixed** picks a glyph family per cell with a stable hash.

**Braille**
- Each character is a 2×4 grid of dots. A dot is on when its level beats an ordered-dither threshold, so mid-tones become dot patterns instead of all-or-nothing.
- Dots map to Unicode braille bits `[1,2,3,7,4,5,6,8]`, and the character is `U+2800 + bits`.

**Shape styles**
- **Dots:** radius grows with brightness.
- **Pixel:** each channel is quantized to N levels.
- **Mosaic:** rounded tiles with grout; square, wide or tall.
- **Bricks:**
  - Colors are quantized to 8 levels per channel, so a few hundred brick sprites (plate, stud shadow, stud, highlight) are drawn once and reused.
- **Disco:**
  - Each tile's brightness varies by a seeded hash.
  - Tiles get a diagonal gradient and rare sparkles.
- **Cubes:**
  - A hex-offset grid of isometric cubes.
  - Each cube's three faces are shaded at about 130%, 90% and 55% of the sampled color.

**Dither**
- The picture is shrunk by **pixel scale** and mapped to the palette. Pixels are then scaled back up without smoothing.
- Two kinds of method:
  - **Ordered dithering:** Bayer matrices built recursively.
  - **Error diffusion:** Floyd–Steinberg, Atkinson, Stucki or Sierra Lite, scanned in serpentine order.
- Nearest color uses luma-weighted RGB distance.

## 5. Effects

Applied after drawing, in this order:

1. **Glow:** a blurred copy added with the `lighter` blend.
2. Pixel passes on the image data:
   - **RGB split:** red and blue shifted apart.
   - **Glitch:** random bands slid sideways, seeded so the picture doesn't change on every redraw.
   - **CRT curve:** barrel distortion.
   - **Film grain:** seeded noise.
3. **Scanlines.**
4. **Vignette.**

## 6. Share links

- `?r=` holds base64url(JSON), with `{"v":1}` plus only the settings that differ from the defaults.
- Decoding re-pads the code, checks the version, and passes everything through `sanitize()`. Unknown keys, wrong types and out-of-range values fall back to defaults.
