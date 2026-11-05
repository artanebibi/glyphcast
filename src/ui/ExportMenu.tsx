import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Code2, Copy, Download, FileText, ImageDown } from 'lucide-react';

export interface ExportActions {
  png: () => void;
  txt: () => void;
  html: () => void;
  copyText: () => void;
  hasText: boolean;
}

/** The primary Export button with a menu of formats that opens upward. */
export function ExportMenu({ actions, children, className = '' }: { actions: ExportActions; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className={`export ${className}`} ref={ref}>
      <button type="button" className="btn-export" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {children}
      </button>
      {open && (
        <div className="menu" role="menu">
          <button type="button" role="menuitem" onClick={run(actions.png)}>
            <ImageDown size={16} strokeWidth={1.6} aria-hidden="true" /> Download PNG
          </button>
          <button type="button" role="menuitem" disabled={!actions.hasText} onClick={run(actions.txt)}>
            <FileText size={16} strokeWidth={1.6} aria-hidden="true" /> Download TXT
          </button>
          <button type="button" role="menuitem" disabled={!actions.hasText} onClick={run(actions.html)}>
            <Code2 size={16} strokeWidth={1.6} aria-hidden="true" /> Download HTML
          </button>
          <button type="button" role="menuitem" disabled={!actions.hasText} onClick={run(actions.copyText)}>
            <Copy size={16} strokeWidth={1.6} aria-hidden="true" /> Copy as text
          </button>
          {!actions.hasText && <p className="menu-note">Text formats work with the ASCII &amp; text styles.</p>}
        </div>
      )}
    </div>
  );
}

export const ExportIcon = Download;
