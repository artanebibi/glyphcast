import { useMemo } from 'react';
import { Dices, Image as ImageIcon, Palette, Sparkles, Sun, Type, type LucideIcon } from 'lucide-react';
import { PALETTES } from '../engine/dither';
import { CHARSET_PRESETS } from '../engine/glyphs';
import { isTextStyle } from '../engine/render';
import { DITHER_ALGOS, type Settings } from '../engine/settings';
import { STYLES } from '../engine/styles';
import { ColorRow, Section, SegmentedRow, SelectRow, SliderRow, ToggleRow } from './controls';

export type SettingsTab = 'style' | 'tone' | 'color' | 'effects' | 'output';

export const SETTINGS_TABS: ReadonlyArray<{ id: SettingsTab; label: string; icon: LucideIcon }> = [
  { id: 'style', label: 'Style', icon: Type },
  { id: 'tone', label: 'Tone', icon: Sun },
  { id: 'color', label: 'Color & backdrop', icon: Palette },
  { id: 'effects', label: 'Effects', icon: Sparkles },
  { id: 'output', label: 'Output', icon: ImageIcon },
];

const DITHER_LABELS: Record<(typeof DITHER_ALGOS)[number], string> = {
  bayer2: 'Bayer 2×2',
  bayer4: 'Bayer 4×4',
  bayer8: 'Bayer 8×8',
  floyd: 'Floyd–Steinberg',
  atkinson: 'Atkinson',
  stucki: 'Stucki',
  sierraLite: 'Sierra Lite',
};

type SetFn = <K extends keyof Settings>(key: K, value: Settings[K]) => void;

export function SettingsRail({ tab, onTab }: { tab: SettingsTab; onTab: (t: SettingsTab) => void }) {
  return (
    <nav className="rail" aria-label="Settings groups" role="tablist" aria-orientation="vertical">
      {SETTINGS_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          aria-label={label}
          title={label}
          className={`rail-btn${tab === id ? ' active' : ''}`}
          onClick={() => onTab(id)}
        >
          <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

export function SettingsBody(props: { tab: SettingsTab; s: Settings; set: SetFn; onReset: () => void }) {
  const { tab, s, set, onReset } = props;
  const textStyle = isTextStyle(s.style);
  const charsetPreset = useMemo(
    () => CHARSET_PRESETS.find((p) => p.chars === s.charset)?.id ?? 'custom',
    [s.charset],
  );

  switch (tab) {
    case 'style':
      return (
        <>
          <Section title="Style">
            <SelectRow
              label="Look"
              value={s.style}
              options={STYLES.map((x) => ({ value: x.id, label: x.label }))}
              onChange={(v) => set('style', v)}
            />
            <p className="hint">{STYLES.find((x) => x.id === s.style)?.blurb}</p>
          </Section>

          {s.style === 'characters' && (
            <Section title="Characters">
              <SelectRow
                label="Preset"
                value={charsetPreset}
                options={[...CHARSET_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Custom' }]}
                onChange={(id) => {
                  const preset = CHARSET_PRESETS.find((p) => p.id === id);
                  if (preset) set('charset', preset.chars);
                }}
              />
              <div className="row">
                <label className="row-label" htmlFor="charset">
                  Characters, densest first
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

          {s.style === 'dither' ? (
            <Section title="Dither">
              <SelectRow
                label="Pattern"
                value={s.ditherAlgo}
                options={DITHER_ALGOS.map((a) => ({ value: a, label: DITHER_LABELS[a] }))}
                onChange={(v) => set('ditherAlgo', v)}
              />
              <SelectRow
                label="Palette"
                value={s.ditherPalette}
                options={Object.entries(PALETTES).map(([value, p]) => ({ value, label: p.label }))}
                onChange={(v) => set('ditherPalette', v)}
              />
              <SliderRow label="Pixel scale" value={s.ditherScale} min={1} max={12} unit="×" onChange={(v) => set('ditherScale', v)} />
            </Section>
          ) : (
            <Section title="Grid">
              {s.style === 'voxel' ? (
                <SliderRow label="Cube size" value={s.voxelSize} min={4} max={64} unit="px" onChange={(v) => set('voxelSize', v)} />
              ) : (
                <SliderRow label="Cell size" value={s.cellSize} min={4} max={48} unit="px" onChange={(v) => set('cellSize', v)} />
              )}
              <SliderRow label="Coverage" value={s.coverage} min={0} max={100} unit="%" onChange={(v) => set('coverage', v)} />
              {s.style === 'pixel' && (
                <SliderRow label="Color levels" value={s.pixelLevels} min={2} max={16} onChange={(v) => set('pixelLevels', v)} />
              )}
              {s.style === 'mosaic' && (
                <SegmentedRow
                  label="Tile shape"
                  value={s.mosaicShape}
                  options={[
                    { value: 'square', label: 'Square' },
                    { value: 'wide', label: 'Wide' },
                    { value: 'tall', label: 'Tall' },
                  ]}
                  onChange={(v) => set('mosaicShape', v)}
                />
              )}
              {s.style === 'disco' && (
                <>
                  <SliderRow label="Tile variation" value={s.discoVariation} min={0} max={100} onChange={(v) => set('discoVariation', v)} />
                  <button type="button" className="btn btn-quiet" onClick={() => set('discoSeed', 1 + Math.floor(Math.random() * 9998))}>
                    <Dices size={15} strokeWidth={1.6} aria-hidden="true" /> Shuffle tiles
                  </button>
                </>
              )}
            </Section>
          )}
        </>
      );

    case 'tone':
      return (
        <Section title="Tone">
          <SliderRow label="Brightness" value={s.brightness} min={-100} max={100} onChange={(v) => set('brightness', v)} />
          <SliderRow label="Contrast" value={s.contrast} min={-100} max={100} onChange={(v) => set('contrast', v)} />
          {(textStyle || s.style === 'dots') && (
            <SliderRow label="Shadow cutoff" value={s.darkCutoff} min={0} max={100} onChange={(v) => set('darkCutoff', v)} />
          )}
          <ToggleRow label="Invert" checked={s.invert} onChange={(v) => set('invert', v)} />
        </Section>
      );

    case 'color':
      if (s.style === 'dither') {
        return (
          <Section title="Color">
            <p className="hint">Dither uses its palette for every pixel. Pick one under Style.</p>
          </Section>
        );
      }
      return (
        <>
          <Section title="Glyphs">
            <SegmentedRow
              label="Color"
              value={s.colorMode}
              options={[
                { value: 'source', label: 'From photo' },
                { value: 'mono', label: 'Single ink' },
              ]}
              onChange={(v) => set('colorMode', v)}
            />
            {s.colorMode === 'mono' && <ColorRow label="Ink" value={s.inkColor} onChange={(v) => set('inkColor', v)} />}
            <SliderRow label="Opacity" value={s.glyphOpacity} min={0} max={100} unit="%" onChange={(v) => set('glyphOpacity', v)} />
          </Section>
          <Section title="Backdrop">
            <SelectRow
              label="Mode"
              value={s.background}
              options={[
                { value: 'blur', label: 'Blurred image' },
                { value: 'solid', label: 'Solid color' },
                { value: 'none', label: 'Transparent' },
              ]}
              onChange={(v) => set('background', v)}
            />
            {s.background !== 'none' && <ColorRow label="Color" value={s.bgColor} onChange={(v) => set('bgColor', v)} />}
            {s.background === 'blur' && (
              <>
                <SliderRow label="Softness" value={s.bgBlur} min={0} max={12} onChange={(v) => set('bgBlur', v)} />
                <SliderRow label="Opacity" value={s.bgOpacity} min={0} max={100} unit="%" onChange={(v) => set('bgOpacity', v)} />
              </>
            )}
          </Section>
        </>
      );

    case 'effects':
      return (
        <>
          <Section title="Light">
            <ToggleRow label="Glow" checked={s.fxGlow} onChange={(v) => set('fxGlow', v)} />
            {s.fxGlow && <SliderRow label="Glow amount" value={s.fxGlowAmount} min={0} max={100} onChange={(v) => set('fxGlowAmount', v)} />}
            <ToggleRow label="Vignette" checked={s.fxVignette} onChange={(v) => set('fxVignette', v)} />
            {s.fxVignette && (
              <SliderRow label="Vignette amount" value={s.fxVignetteAmount} min={0} max={100} onChange={(v) => set('fxVignetteAmount', v)} />
            )}
          </Section>
          <Section title="Screen">
            <ToggleRow label="Scanlines" checked={s.fxScanlines} onChange={(v) => set('fxScanlines', v)} />
            {s.fxScanlines && (
              <>
                <SliderRow label="Darkness" value={s.fxScanlinesAmount} min={0} max={100} onChange={(v) => set('fxScanlinesAmount', v)} />
                <SliderRow label="Spacing" value={s.fxScanlinesSpacing} min={2} max={12} unit="px" onChange={(v) => set('fxScanlinesSpacing', v)} />
              </>
            )}
            <ToggleRow label="CRT curve" checked={s.fxCrt} onChange={(v) => set('fxCrt', v)} />
            {s.fxCrt && <SliderRow label="Curve" value={s.fxCrtAmount} min={0} max={100} onChange={(v) => set('fxCrtAmount', v)} />}
          </Section>
          <Section title="Distort">
            <ToggleRow label="RGB split" checked={s.fxRgbSplit} onChange={(v) => set('fxRgbSplit', v)} />
            {s.fxRgbSplit && (
              <SliderRow label="Offset" value={s.fxRgbSplitOffset} min={0} max={30} unit="px" onChange={(v) => set('fxRgbSplitOffset', v)} />
            )}
            <ToggleRow label="Glitch" checked={s.fxGlitch} onChange={(v) => set('fxGlitch', v)} />
            {s.fxGlitch && (
              <>
                <SliderRow label="Glitch amount" value={s.fxGlitchAmount} min={0} max={100} onChange={(v) => set('fxGlitchAmount', v)} />
                <button type="button" className="btn btn-quiet" onClick={() => set('fxGlitchSeed', 1 + Math.floor(Math.random() * 9998))}>
                  <Dices size={15} strokeWidth={1.6} aria-hidden="true" /> Reroll glitch
                </button>
              </>
            )}
            <ToggleRow label="Film grain" checked={s.fxGrain} onChange={(v) => set('fxGrain', v)} />
            {s.fxGrain && <SliderRow label="Grain" value={s.fxGrainAmount} min={0} max={100} onChange={(v) => set('fxGrainAmount', v)} />}
          </Section>
        </>
      );

    case 'output':
      return (
        <>
          <Section title="Output">
            <SelectRow
              label="Size (long side)"
              value={String(s.outputSize)}
              options={[800, 1200, 1600, 2400, 3200].map((n) => ({ value: String(n), label: `${n} px` }))}
              onChange={(v) => set('outputSize', Number(v))}
            />
            <p className="hint">Bigger sizes keep more detail in exports but redraw more slowly.</p>
          </Section>
          <Section title="Reset">
            <button type="button" className="btn btn-quiet" onClick={onReset}>
              Reset every setting
            </button>
          </Section>
        </>
      );
  }
}
