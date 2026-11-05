import { useEffect, useState } from 'react';
import { render, type SourceImage } from '../engine/render';
import { sanitize, type Settings, type StyleId } from '../engine/settings';
import { STYLES } from '../engine/styles';

const THUMB_SIZE = 280;

/** Settings for a small preview of `style`, keeping the user's tone and color choices. */
export function thumbnailSettings(style: StyleId, current: Settings): Settings {
  return sanitize({
    ...current,
    style,
    outputSize: THUMB_SIZE,
    cellSize: style === 'lego' ? 9 : 5,
    voxelSize: 9,
    ditherScale: 1,
    // Effects are tuned for full-size images; previews look cleaner without them.
    fxGlow: false,
    fxScanlines: false,
    fxRgbSplit: false,
    fxGlitch: false,
    fxCrt: false,
    fxVignette: false,
    fxGrain: false,
    coverage: 100,
  });
}

/**
 * Renders a small preview of the current picture in every style, so the
 * gallery shows what each style will look like before you pick it.
 * Previews are drawn a few at a time to keep the page responsive.
 */
export function useThumbnails(source: SourceImage, settings: Settings): Partial<Record<StyleId, string>> {
  const [thumbs, setThumbs] = useState<Partial<Record<StyleId, string>>>({});
  const { brightness, contrast, invert, colorMode, inkColor, background, bgColor, charset } = settings;

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const base = { ...settings };
    const queue = STYLES.map((s) => s.id);
    const results: Partial<Record<StyleId, string>> = {};

    const step = () => {
      if (cancelled) return;
      const started = performance.now();
      while (queue.length && performance.now() - started < 24) {
        const id = queue.shift()!;
        try {
          render(canvas, source, thumbnailSettings(id, base));
          results[id] = canvas.toDataURL('image/jpeg', 0.82);
        } catch {
          // A failed preview just stays blank.
        }
      }
      setThumbs({ ...results });
      if (queue.length) timer = window.setTimeout(step, 16);
    };
    // Wait for typing/dragging to settle before re-rendering all previews.
    let timer = window.setTimeout(step, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Only settings that change every preview trigger a redraw; style-specific
    // sliders would otherwise re-render all previews on every drag.
  }, [source, brightness, contrast, invert, colorMode, inkColor, background, bgColor, charset]);

  return thumbs;
}
