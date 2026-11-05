import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CircleHelp,
  Columns2,
  Download,
  Link2,
  PanelLeftOpen,
  Redo2,
  Shuffle,
  SlidersHorizontal,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toHtml, toPlainText } from './engine/export';
import { decodeRecipe, encodeRecipe, settingsDelta } from './engine/recipe';
import { outputDimensions, render, type RenderResult, type SourceImage } from './engine/render';
import { DEFAULTS, sanitize, type Settings, type StyleId } from './engine/settings';
import { STYLES } from './engine/styles';
import { IconButton } from './ui/controls';
import { ExportMenu, type ExportActions } from './ui/ExportMenu';
import { SETTINGS_TABS, SettingsBody, SettingsRail, type SettingsTab } from './ui/SettingsPanel';
import { shuffleSettings } from './ui/shuffle';
import { createDemoImage, downloadBlob, loadImageFile } from './ui/source';
import { Stage } from './ui/Stage';
import { StylesPanel, StyleStrip, useFavorites } from './ui/StylesPanel';
import { useThumbnails } from './ui/thumbnails';
import { useHistory } from './ui/useHistory';

const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4];

function initialSettings(): Settings {
  const fromUrl = new URLSearchParams(window.location.search).get('r');
  if (fromUrl) {
    const decoded = decodeRecipe(fromUrl);
    if (decoded.ok) return decoded.settings;
  }
  return { ...DEFAULTS };
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export default function App() {
  const history = useHistory(initialSettings);
  const settings = history.state;
  const [source, setSource] = useState<SourceImage>(() => createDemoImage());
  const [fileName, setFileName] = useState('glyphcast');
  const [result, setResult] = useState<RenderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<SettingsTab>('style');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stylesOpen, setStylesOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [comparing, setComparing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const thumbs = useThumbnails(source, settings);

  const update = history.set;
  const set = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => update((prev) => sanitize({ ...prev, [key]: value })),
    [update],
  );

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
        setZoom(null);
        setError(null);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Couldn't open that file.");
      }
    },
    [notify],
  );

  const zoomBy = useCallback(
    (dir: 1 | -1) => {
      const current = zoom ?? scale;
      const next = dir > 0 ? ZOOM_STEPS.find((z) => z > current + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < current - 0.001);
      setZoom(next ?? current);
    },
    [zoom, scale],
  );

  // Paste an image anywhere on the page.
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

  // Keyboard shortcuts.
  const { undo, redo } = history;
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (!mod && (e.key === '+' || e.key === '=')) {
        zoomBy(1);
      } else if (!mod && e.key === '-') {
        zoomBy(-1);
      } else if (!mod && e.key === '0') {
        setZoom(null);
      } else if (!mod && e.key.toLowerCase() === 'c' && !e.repeat) {
        setComparing(true);
      } else if (e.key === 'Escape') {
        setSheetOpen(false);
        setHelpOpen(false);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'c') setComparing(false);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [undo, redo, zoomBy]);

  const pickStyle = (id: StyleId) => set('style', id);
  const shuffle = () => update((prev) => shuffleSettings(prev));
  const reset = () => update(() => ({ ...DEFAULTS }));

  const baseName = `${fileName}-${settings.style}`;
  const textGrid = result?.text ?? null;

  const exportActions: ExportActions = {
    hasText: !!textGrid,
    png: () =>
      canvasRef.current?.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${baseName}.png`);
        else notify('Could not create the PNG.');
      }, 'image/png'),
    txt: () => textGrid && downloadBlob(new Blob([toPlainText(textGrid)], { type: 'text/plain;charset=utf-8' }), `${baseName}.txt`),
    html: () => {
      if (!textGrid) return;
      const bg = settings.background === 'none' ? '#000000' : settings.bgColor;
      downloadBlob(new Blob([toHtml(textGrid, bg, baseName)], { type: 'text/html;charset=utf-8' }), `${baseName}.html`);
    },
    copyText: async () => {
      if (!textGrid) return;
      try {
        await navigator.clipboard.writeText(toPlainText(textGrid));
        notify('Text copied');
      } catch {
        notify('Your browser blocked clipboard access.');
      }
    },
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

  const dims = outputDimensions(source.width, source.height, settings.outputSize);
  const styleInfo = STYLES.find((x) => x.id === settings.style)!;
  const tabLabel = SETTINGS_TABS.find((t) => t.id === tab)!.label;
  const compareHandlers = {
    onPointerDown: () => setComparing(true),
    onPointerUp: () => setComparing(false),
    onPointerLeave: () => setComparing(false),
    onBlur: () => setComparing(false),
  };

  return (
    <div
      className={`app${stylesOpen ? '' : ' styles-closed'}`}
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
          <span>glyphcast</span>
        </div>

        <div className="toolbar" role="toolbar" aria-label="View">
          <div className="tool-group zoom-group">
            <IconButton icon={ZoomOut} label="Zoom out (-)" onClick={() => zoomBy(-1)} />
            <button type="button" className="zoom-value" title="Fit to window (0)" onClick={() => setZoom(null)}>
              {Math.round(scale * 100)}%
            </button>
            <IconButton icon={ZoomIn} label="Zoom in (+)" onClick={() => zoomBy(1)} />
          </div>
          <span className="tool-sep" aria-hidden="true" />
          <IconButton icon={Columns2} label="Hold to compare with the original (C)" active={comparing} {...compareHandlers} />
          <span className="tool-sep" aria-hidden="true" />
          <IconButton icon={Undo2} label="Undo (Ctrl+Z)" disabled={!history.canUndo} onClick={undo} />
          <IconButton icon={Redo2} label="Redo (Ctrl+Shift+Z)" disabled={!history.canRedo} onClick={redo} />
        </div>

        <div className="topbar-right">
          <button type="button" className="btn btn-outline hide-sm" onClick={copyLink}>
            <Link2 size={15} strokeWidth={1.7} aria-hidden="true" /> Share
          </button>
          <div className="help">
            <IconButton icon={CircleHelp} label="Help and shortcuts" active={helpOpen} onClick={() => setHelpOpen((v) => !v)} />
            {helpOpen && (
              <div className="popover" role="dialog" aria-label="Help">
                <p className="popover-title">Getting started</p>
                <p>Drop, paste or upload a picture, then pick a style. Everything runs in your browser; nothing is uploaded.</p>
                <p className="popover-title">Shortcuts</p>
                <dl>
                  <dt>Ctrl Z / Ctrl Shift Z</dt>
                  <dd>Undo / redo</dd>
                  <dt>Hold C</dt>
                  <dd>Compare with original</dd>
                  <dt>+ / − / 0</dt>
                  <dd>Zoom in / out / fit</dd>
                  <dt>Ctrl V</dt>
                  <dd>Paste an image</dd>
                </dl>
              </div>
            )}
          </div>
        </div>
      </header>

      {stylesOpen ? (
        <StylesPanel
          style={settings.style}
          thumbs={thumbs}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onPick={pickStyle}
          onCollapse={() => setStylesOpen(false)}
        />
      ) : null}

      <main className="main">
        {!stylesOpen && (
          <button type="button" className="btn btn-outline reopen" onClick={() => setStylesOpen(true)}>
            <PanelLeftOpen size={15} strokeWidth={1.7} aria-hidden="true" /> Styles
          </button>
        )}
        <Stage
          canvasRef={canvasRef}
          source={source}
          width={dims.width}
          height={dims.height}
          zoom={zoom}
          comparing={comparing}
          label={`Your picture in the ${styleInfo.label} style`}
          onScale={setScale}
          overlay={
            <div className="dock" role="toolbar" aria-label="Actions">
              <button type="button" className="dock-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} strokeWidth={1.7} aria-hidden="true" /> Upload
              </button>
              <button type="button" className="dock-btn" onClick={shuffle}>
                <Shuffle size={16} strokeWidth={1.7} aria-hidden="true" /> Shuffle
              </button>
              <button type="button" className="dock-btn" onClick={copyLink}>
                <Link2 size={16} strokeWidth={1.7} aria-hidden="true" /> Copy link
              </button>
              <ExportMenu actions={exportActions}>
                <Download size={16} strokeWidth={1.8} aria-hidden="true" /> Export
              </ExportMenu>
            </div>
          }
        />
        <p className="status" aria-live="polite">
          {error
            ? error
            : result
              ? `${result.width} × ${result.height}px · ${Math.round(result.ms)} ms${
                  result.cellSize !== settings.cellSize ? ` · cell size raised to ${result.cellSize}px to stay fast` : ''
                }`
              : 'Rendering…'}
        </p>
        <StyleStrip style={settings.style} thumbs={thumbs} onPick={pickStyle} />
      </main>

      <aside className={`settings${sheetOpen ? ' open' : ''}`} aria-label="Settings">
        <SettingsRail tab={tab} onTab={setTab} />
        <div className="settings-body">
          <header className="settings-head">
            <span>{tabLabel}</span>
            <IconButton icon={X} label="Close settings" className="sheet-close" onClick={() => setSheetOpen(false)} />
          </header>
          <div className="settings-scroll">
            <SettingsBody tab={tab} s={settings} set={set} onReset={reset} />
          </div>
        </div>
      </aside>
      {sheetOpen && <div className="scrim" onClick={() => setSheetOpen(false)} aria-hidden="true" />}

      <nav className="mobile-bar" aria-label="Actions">
        <IconButton icon={Upload} label="Upload a picture" onClick={() => fileInputRef.current?.click()} />
        <IconButton icon={Shuffle} label="Shuffle the look" onClick={shuffle} />
        <button type="button" className="tune" onClick={() => setSheetOpen(true)}>
          <span className="tune-name">{styleInfo.label}</span>
          <span className="tune-hint">
            <SlidersHorizontal size={12} strokeWidth={1.8} aria-hidden="true" /> Tap to tune
          </span>
        </button>
        <ExportMenu actions={exportActions} className="export-square">
          <Download size={20} strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">Export</span>
        </ExportMenu>
      </nav>

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
      {dragging && <div className="drop-overlay">Drop your picture</div>}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
