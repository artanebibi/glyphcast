import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PALETTES } from './engine/dither';
import { toHtml, toPlainText } from './engine/export';
import { CHARSET_PRESETS } from './engine/glyphs';
import { decodeRecipe, encodeRecipe, settingsDelta } from './engine/recipe';
import { isTextStyle, render, type RenderResult, type SourceImage } from './engine/render';
import { DEFAULTS, DITHER_ALGOS, sanitize, type Settings } from './engine/settings';
import { STYLES } from './engine/styles';
import { ColorField, Section, Segmented, Select, Slider, Toggle } from './ui/controls';
import { createDemoImage, downloadBlob, loadImageFile } from './ui/source';

const DITHER_LABELS: Record<(typeof DITHER_ALGOS)[number], string> = {
  bayer2: 'Bayer 2×2',
  bayer4: 'Bayer 4×4',
  bayer8: 'Bayer 8×8',
  floyd: 'Floyd–Steinberg',
  atkinson: 'Atkinson',
  stucki: 'Stucki',
  sierraLite: 'Sierra Lite',
};

function initialSettings(): Settings {
  const fromUrl = new URLSearchParams(window.location.search).get('r');
  if (fromUrl) {
    const decoded = decodeRecipe(fromUrl);
    if (decoded.ok) return decoded.settings;
  }
  return { ...DEFAULTS };
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [source, setSource] = useState<SourceImage>(() => createDemoImage());
  const [fileName, setFileName] = useState('glyphcast');
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => sanitize({ ...prev, [key]: value }));
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  // Redraw on the next frame whenever the settings or the picture change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      try {
        setResult(render(canvas, source, settings));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Rendering failed.');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [settings, source]);

  // Keep the address bar in sync so the URL is always shareable.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hasChanges = Object.keys(settingsDelta(settings)).length > 0;
      const url = hasChanges ? `${window.location.pathname}?r=${encodeRecipe(settings)}` : window.location.pathname;
      window.history.replaceState(null, '', url);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const openFile = useCallback(
    async (file: File | Blob, name?: string) => {
      try {
        const img = await loadImageFile(file);
        setSource(img);
        setFileName((name ?? 'image').replace(/\.[^.]+$/, '') || 'image');
        setError(null);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Couldn't open that file.");
      }
    },
    [notify],
  );

  // Paste an image from the clipboard anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        void openFile(file, 'pasted');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [openFile]);

  const baseName = `${fileName}-${settings.style}`;
  const textGrid = result?.text ?? null;

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${baseName}.png`);
      else notify('Could not create the PNG.');
    }, 'image/png');
  };

  const downloadText = () => {
    if (!textGrid) return;
    downloadBlob(new Blob([toPlainText(textGrid)], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`);
  };

  const downloadHtml = () => {
    if (!textGrid) return;
    const bg = settings.background === 'none' ? '#000000' : settings.bgColor;
    downloadBlob(new Blob([toHtml(textGrid, bg, baseName)], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);
  };

  const copyText = async () => {
    if (!textGrid) return;
    try {
      await navigator.clipboard.writeText(toPlainText(textGrid));
      notify('Text copied');
    } catch {
      notify('Your browser blocked clipboard access.');
    }
  };

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}?r=${encodeRecipe(settings)}`;
    try {
      await navigator.clipboard.writeText(link);
      notify('Link copied');
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  const charsetPreset = useMemo(
    () => CHARSET_PRESETS.find((p) => p.chars === settings.charset)?.id ?? 'custom',
    [settings.charset],
  );

  const s = settings;
  const textStyle = isTextStyle(s.style);
  const styleInfo = STYLES.find((x) => x.id === s.style);

  return (
    <div
      className={`app${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) void openFile(file, file.name);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ⣿
          </span>
          glyphcast
        </div>
        <div className="topbar-actions">
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            Open image
          </button>
          <button type="button" className="btn" onClick={copyLink}>
            Copy link
          </button>
          <button type="button" className="btn btn-primary" onClick={downloadPng}>
            Download PNG
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void openFile(file, file.name);
            e.target.value = '';
          }}
        />
      </header>

      <main className="stage">
        <div className="canvas-wrap">
          <canvas ref={canvasRef} id="output" aria-label={`Image rendered in the ${styleInfo?.label ?? s.style} style`} />
        </div>
        <p className="stage-meta">
          {error
            ? error
            : result
              ? `${result.width}×${result.height} · ${Math.round(result.ms)} ms${
                  result.cellSize !== s.cellSize ? ` · cell size raised to ${result.cellSize} to stay fast` : ''
                } · drop or paste an image to use your own`
              : 'Rendering…'}
        </p>
      </main>

      <aside className="panel">
        <Section title="Style">
          <div className="style-grid" role="radiogroup" aria-label="Style">
            {STYLES.map((st) => (
              <button
                key={st.id}
                type="button"
                role="radio"
                aria-checked={s.style === st.id}
                className={`style-card${s.style === st.id ? ' active' : ''}`}
                onClick={() => set('style', st.id)}
                title={st.blurb}
              >
                <span className="style-icon" aria-hidden="true">
                  {st.icon}
                </span>
                <span className="style-label">{st.label}</span>
              </button>
            ))}
          </div>
          {styleInfo && <p className="hint">{styleInfo.blurb}</p>}
        </Section>

        <Section title="Adjust">
          {s.style !== 'voxel' && s.style !== 'dither' && (
            <Slider label="Cell size" value={s.cellSize} min={4} max={48} suffix=" px" onChange={(v) => set('cellSize', v)} />
          )}
          {s.style === 'voxel' && (
            <Slider label="Cube size" value={s.voxelSize} min={4} max={64} suffix=" px" onChange={(v) => set('voxelSize', v)} />
          )}
          <Slider label="Brightness" value={s.brightness} min={-100} max={100} onChange={(v) => set('brightness', v)} />
          <Slider label="Contrast" value={s.contrast} min={-100} max={100} onChange={(v) => set('contrast', v)} />
          {(textStyle || s.style === 'dots') && (
            <Slider label="Shadow cutoff" value={s.darkCutoff} min={0} max={100} onChange={(v) => set('darkCutoff', v)} />
          )}
          {s.style !== 'dither' && (
            <Slider label="Coverage" value={s.coverage} min={0} max={100} suffix="%" onChange={(v) => set('coverage', v)} />
          )}
          <Toggle label="Invert" checked={s.invert} onChange={(v) => set('invert', v)} />
        </Section>

        {s.style === 'characters' && (
          <Section title="Characters">
            <Select
              label="Preset"
              value={charsetPreset}
              options={[...CHARSET_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Custom' }]}
              onChange={(id) => {
                const preset = CHARSET_PRESETS.find((p) => p.id === id);
                if (preset) set('charset', preset.chars);
              }}
            />
            <div className="field">
              <label htmlFor="charset">
                <span>Characters, densest first</span>
              </label>
              <input
                id="charset"
                className="text-input"
                value={s.charset}
                spellCheck={false}
                onChange={(e) => e.target.value && set('charset', e.target.value)}
              />
            </div>
          </Section>
        )}

        {s.style === 'pixel' && (
          <Section title="Pixel">
            <Slider label="Color levels" value={s.pixelLevels} min={2} max={16} onChange={(v) => set('pixelLevels', v)} />
          </Section>
        )}

        {s.style === 'mosaic' && (
          <Section title="Mosaic">
            <Segmented
              label="Tile shape"
              value={s.mosaicShape}
              options={[
                { value: 'square', label: 'Square' },
                { value: 'wide', label: 'Wide' },
                { value: 'tall', label: 'Tall' },
              ]}
              onChange={(v) => set('mosaicShape', v)}
            />
          </Section>
        )}

        {s.style === 'disco' && (
          <Section title="Disco">
            <Slider label="Tile variation" value={s.discoVariation} min={0} max={100} onChange={(v) => set('discoVariation', v)} />
            <button type="button" className="btn btn-small" onClick={() => set('discoSeed', 1 + Math.floor(Math.random() * 9998))}>
              Shuffle tiles
            </button>
          </Section>
        )}

        {s.style === 'dither' && (
          <Section title="Dither">
            <Select
              label="Pattern"
              value={s.ditherAlgo}
              options={DITHER_ALGOS.map((a) => ({ value: a, label: DITHER_LABELS[a] }))}
              onChange={(v) => set('ditherAlgo', v)}
            />
            <Select
              label="Palette"
              value={s.ditherPalette}
              options={Object.entries(PALETTES).map(([value, p]) => ({ value, label: p.label }))}
              onChange={(v) => set('ditherPalette', v)}
            />
            <Slider label="Pixel scale" value={s.ditherScale} min={1} max={12} suffix="×" onChange={(v) => set('ditherScale', v)} />
          </Section>
        )}

        {s.style !== 'dither' && (
          <Section title="Color">
            <Segmented
              label="Glyph color"
              value={s.colorMode}
              options={[
                { value: 'source', label: 'From photo' },
                { value: 'mono', label: 'Single color' },
              ]}
              onChange={(v) => set('colorMode', v)}
            />
            {s.colorMode === 'mono' && <ColorField label="Ink" value={s.inkColor} onChange={(v) => set('inkColor', v)} />}
            <Slider label="Opacity" value={s.glyphOpacity} min={0} max={100} suffix="%" onChange={(v) => set('glyphOpacity', v)} />
          </Section>
        )}

        {s.style !== 'dither' && (
          <Section title="Background">
            <Segmented
              label="Behind the glyphs"
              value={s.background}
              options={[
                { value: 'blur', label: 'Blurred photo' },
                { value: 'solid', label: 'Solid' },
                { value: 'none', label: 'Transparent' },
              ]}
              onChange={(v) => set('background', v)}
            />
            {s.background !== 'none' && <ColorField label="Color" value={s.bgColor} onChange={(v) => set('bgColor', v)} />}
            {s.background === 'blur' && (
              <>
                <Slider label="Photo strength" value={s.bgOpacity} min={0} max={100} suffix="%" onChange={(v) => set('bgOpacity', v)} />
                <Slider label="Blur" value={s.bgBlur} min={0} max={12} onChange={(v) => set('bgBlur', v)} />
              </>
            )}
          </Section>
        )}

        <Section title="Effects">
          <EffectRow label="Glow" on={s.fxGlow} onToggle={(v) => set('fxGlow', v)}>
            <Slider label="Amount" value={s.fxGlowAmount} min={0} max={100} onChange={(v) => set('fxGlowAmount', v)} />
          </EffectRow>
          <EffectRow label="Scanlines" on={s.fxScanlines} onToggle={(v) => set('fxScanlines', v)}>
            <Slider label="Darkness" value={s.fxScanlinesAmount} min={0} max={100} onChange={(v) => set('fxScanlinesAmount', v)} />
            <Slider label="Spacing" value={s.fxScanlinesSpacing} min={2} max={12} suffix=" px" onChange={(v) => set('fxScanlinesSpacing', v)} />
          </EffectRow>
          <EffectRow label="RGB split" on={s.fxRgbSplit} onToggle={(v) => set('fxRgbSplit', v)}>
            <Slider label="Offset" value={s.fxRgbSplitOffset} min={0} max={30} suffix=" px" onChange={(v) => set('fxRgbSplitOffset', v)} />
          </EffectRow>
          <EffectRow label="Glitch" on={s.fxGlitch} onToggle={(v) => set('fxGlitch', v)}>
            <Slider label="Amount" value={s.fxGlitchAmount} min={0} max={100} onChange={(v) => set('fxGlitchAmount', v)} />
            <button type="button" className="btn btn-small" onClick={() => set('fxGlitchSeed', 1 + Math.floor(Math.random() * 9998))}>
              Reroll glitch
            </button>
          </EffectRow>
          <EffectRow label="CRT curve" on={s.fxCrt} onToggle={(v) => set('fxCrt', v)}>
            <Slider label="Curve" value={s.fxCrtAmount} min={0} max={100} onChange={(v) => set('fxCrtAmount', v)} />
          </EffectRow>
          <EffectRow label="Vignette" on={s.fxVignette} onToggle={(v) => set('fxVignette', v)}>
            <Slider label="Amount" value={s.fxVignetteAmount} min={0} max={100} onChange={(v) => set('fxVignetteAmount', v)} />
          </EffectRow>
          <EffectRow label="Film grain" on={s.fxGrain} onToggle={(v) => set('fxGrain', v)}>
            <Slider label="Amount" value={s.fxGrainAmount} min={0} max={100} onChange={(v) => set('fxGrainAmount', v)} />
          </EffectRow>
        </Section>

        <Section title="Export">
          <Select
            label="Output size (long side)"
            value={String(s.outputSize)}
            options={[800, 1200, 1600, 2400, 3200].map((n) => ({ value: String(n), label: `${n} px` }))}
            onChange={(v) => set('outputSize', Number(v))}
          />
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={downloadPng}>
              PNG
            </button>
            <button type="button" className="btn" disabled={!textGrid} onClick={downloadText}>
              TXT
            </button>
            <button type="button" className="btn" disabled={!textGrid} onClick={downloadHtml}>
              HTML
            </button>
            <button type="button" className="btn" disabled={!textGrid} onClick={copyText}>
              Copy text
            </button>
          </div>
          {!textGrid && <p className="hint">Text export works with the text styles (ASCII to Mixed).</p>}
          <button type="button" className="btn btn-ghost" onClick={() => setSettings({ ...DEFAULTS })}>
            Reset all settings
          </button>
        </Section>
      </aside>

      {dragging && <div className="drop-overlay">Drop your image</div>}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function EffectRow(props: { label: string; on: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <div className={`effect${props.on ? ' on' : ''}`}>
      <Toggle label={props.label} checked={props.on} onChange={props.onToggle} />
      {props.on && <div className="effect-body">{props.children}</div>}
    </div>
  );
}
