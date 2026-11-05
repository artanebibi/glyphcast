import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** A panel section with a "/ TITLE" heading. */
export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <header className="section-head">
        <h3>
          <span aria-hidden="true">/ </span>
          {title}
        </h3>
        {action}
      </header>
      <div className="section-body">{children}</div>
    </section>
  );
}

export function SliderRow(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const { label, value, min, max, step = 1, unit = '', onChange } = props;
  const pct = ((value - min) / (max - min || 1)) * 100;
  return (
    <div className="row row-slider">
      <div className="row-line">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {value}
          {unit}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="row row-line">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="check" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function SelectRow<T extends string>(props: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="row row-line">
      <label htmlFor={id}>{props.label}</label>
      <div className="select">
        <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function SegmentedRow<T extends string>(props: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="row">
      <span className="row-label">{props.label}</span>
      <div className="segmented" role="radiogroup" aria-label={props.label}>
        {props.options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={props.value === o.value}
            className={props.value === o.value ? 'active' : ''}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="row row-line">
      <label htmlFor={id}>{label}</label>
      <span className="color">
        <code>{value.toUpperCase()}</code>
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </div>
  );
}

/** Square icon-only button with a tooltip. */
export function IconButton({
  icon: Icon,
  label,
  active,
  className = '',
  ...rest
}: { icon: LucideIcon; label: string; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`icon-btn${active ? ' active' : ''} ${className}`}
      {...rest}
    >
      <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
    </button>
  );
}
