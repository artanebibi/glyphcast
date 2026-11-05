import { useCallback, useRef, useState } from 'react';

/** Changes closer together than this merge into one undo step (e.g. a slider drag). */
const MERGE_MS = 600;
const LIMIT = 100;

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/**
 * State with undo/redo. Rapid successive updates are grouped into a single
 * step so dragging a slider doesn't flood the history.
 */
export function useHistory<T>(initial: () => T) {
  const [history, setHistory] = useState<History<T>>(() => ({ past: [], present: initial(), future: [] }));
  const lastChange = useRef(0);

  const set = useCallback((update: (prev: T) => T) => {
    setHistory((h) => {
      const next = update(h.present);
      if (Object.is(next, h.present)) return h;
      const now = Date.now();
      const merge = now - lastChange.current < MERGE_MS && h.past.length > 0;
      lastChange.current = now;
      const past = merge ? h.past : [...h.past, h.present].slice(-LIMIT);
      return { past, present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    lastChange.current = 0;
    setHistory((h) => {
      if (!h.past.length) return h;
      const previous = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    lastChange.current = 0;
    setHistory((h) => {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest };
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
