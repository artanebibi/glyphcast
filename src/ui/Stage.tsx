import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { SourceImage } from '../engine/render';

/** Space kept clear around the picture; set per layout in CSS (--pad-*). */
interface Pads {
  x: number;
  top: number;
  bottom: number;
}

function readPads(el: HTMLElement): Pads {
  const css = getComputedStyle(el);
  const num = (name: string, fallback: number) => parseFloat(css.getPropertyValue(name)) || fallback;
  return { x: num('--pad-x', 28), top: num('--pad-top', 28), bottom: num('--pad-bottom', 28) };
}

/**
 * The picture area: fits the output to the window (or shows it at a fixed
 * zoom), and can lay the original photo on top for a before/after compare.
 */
export function Stage(props: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  source: SourceImage;
  width: number;
  height: number;
  zoom: number | null;
  comparing: boolean;
  label: string;
  onScale: (scale: number) => void;
  overlay?: ReactNode;
}) {
  const { canvasRef, source, width, height, zoom, comparing, label, onScale, overlay } = props;
  const viewRef = useRef<HTMLDivElement>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0, pads: { x: 28, top: 28, bottom: 28 } as Pads });

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight, pads: readPads(el) });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { pads } = box;
  const fit =
    width && height && box.w && box.h
      ? Math.min((box.w - pads.x * 2) / width, (box.h - pads.top - pads.bottom) / height, 2)
      : 1;
  const scale = Math.max(0.05, zoom ?? fit);

  useEffect(() => onScale(scale), [scale, onScale]);

  // The "before" picture, drawn at the same size as the output.
  useEffect(() => {
    const c = originalRef.current;
    if (!c || !width || !height) return;
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.image, 0, 0, width, height);
  }, [source, width, height]);

  const cssW = Math.round(width * scale);
  const cssH = Math.round(height * scale);

  return (
    <div className="stage">
      <div className="stage-view" ref={viewRef}>
        <div className="stage-inner" style={{ minWidth: cssW + pads.x * 2, minHeight: cssH + pads.top + pads.bottom }}>
          <div className={`frame${scale >= 1.5 ? ' crisp' : ''}`} style={{ width: cssW, height: cssH }}>
            <canvas ref={canvasRef} id="output" aria-label={label} />
            <canvas ref={originalRef} className={`original${comparing ? ' show' : ''}`} aria-hidden="true" />
            {comparing && <span className="compare-tag">Original</span>}
          </div>
        </div>
      </div>
      {overlay}
    </div>
  );
}
