import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, Search, Star, X } from 'lucide-react';
import type { StyleId } from '../engine/settings';
import { STYLE_GROUPS, STYLES, type StyleInfo } from '../engine/styles';
import { IconButton } from './controls';

type Thumbs = Partial<Record<StyleId, string>>;

const FAVORITES_KEY = 'glyphcast:favorites';

/** Favorite styles, remembered in this browser only. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<ReadonlySet<StyleId>>(() => {
    try {
      const raw = window.localStorage.getItem(FAVORITES_KEY);
      return new Set(raw ? (JSON.parse(raw) as StyleId[]) : []);
    } catch {
      return new Set();
    }
  });
  const toggle = (id: StyleId) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // Storage can be blocked (private mode); favorites then last for this visit only.
      }
      return next;
    });
  };
  return { favorites, toggle };
}

function Thumb({ info, src }: { info: StyleInfo; src?: string }) {
  return src ? (
    <img src={src} alt="" draggable={false} />
  ) : (
    <span className="thumb-placeholder" aria-hidden="true">
      {info.icon}
    </span>
  );
}

function StyleCard(props: {
  info: StyleInfo;
  thumb?: string;
  active: boolean;
  favorite: boolean;
  featured?: boolean;
  onPick: () => void;
  onFavorite: () => void;
}) {
  const { info, thumb, active, favorite, featured, onPick, onFavorite } = props;
  return (
    <div className={`card${active ? ' active' : ''}${featured ? ' featured' : ''}`}>
      <button type="button" className="card-main" onClick={onPick} aria-pressed={active} title={info.blurb}>
        <span className="card-thumb">
          <Thumb info={info} src={thumb} />
          {featured && <span className="badge">Current</span>}
        </span>
        <span className="card-title">{info.label}</span>
        <span className="card-tags">{info.tags.join(' · ')}</span>
      </button>
      <button
        type="button"
        className={`fav${favorite ? ' on' : ''}`}
        aria-label={favorite ? `Remove ${info.label} from favorites` : `Add ${info.label} to favorites`}
        aria-pressed={favorite}
        onClick={onFavorite}
      >
        <Star size={13} strokeWidth={1.8} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </div>
  );
}

export function StylesPanel(props: {
  style: StyleId;
  thumbs: Thumbs;
  favorites: ReadonlySet<StyleId>;
  onToggleFavorite: (id: StyleId) => void;
  onPick: (id: StyleId) => void;
  onCollapse: () => void;
}) {
  const { style, thumbs, favorites, onToggleFavorite, onPick, onCollapse } = props;
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'all' | 'favorites'>('all');

  const q = query.trim().toLowerCase();
  const matches = (s: StyleInfo) =>
    !q || s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q));
  const current = STYLES.find((s) => s.id === style)!;

  const card = (info: StyleInfo, featured = false) => (
    <StyleCard
      key={`${info.id}${featured ? '-featured' : ''}`}
      info={info}
      thumb={thumbs[info.id]}
      active={info.id === style}
      favorite={favorites.has(info.id)}
      featured={featured}
      onPick={() => onPick(info.id)}
      onFavorite={() => onToggleFavorite(info.id)}
    />
  );

  let body;
  if (tab === 'favorites') {
    const favs = STYLES.filter((s) => favorites.has(s.id) && matches(s));
    body = favs.length ? (
      <div className="cards">{favs.map((s) => card(s))}</div>
    ) : (
      <p className="empty">Star a style to keep it here.</p>
    );
  } else if (q) {
    const found = STYLES.filter(matches);
    body = found.length ? (
      <div className="cards">{found.map((s) => card(s))}</div>
    ) : (
      <p className="empty">No style matches “{query}”.</p>
    );
  } else {
    body = (
      <>
        <div className="cards cards-featured">{card(current, true)}</div>
        {STYLE_GROUPS.map((group) => (
          <div key={group} className="group">
            <h3 className="group-title">{group}</h3>
            <div className="cards">{STYLES.filter((s) => s.group === group).map((s) => card(s))}</div>
          </div>
        ))}
      </>
    );
  }

  return (
    <aside className="styles-panel" aria-label="Styles">
      <header className="panel-head">
        <h2>Styles</h2>
        <IconButton icon={PanelLeftClose} label="Hide styles" onClick={onCollapse} />
      </header>
      <div className="search">
        <Search size={15} strokeWidth={1.7} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search name or tag"
          aria-label="Search styles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'all'} onClick={() => setTab('all')}>
          Explore
        </button>
        <button type="button" role="tab" aria-selected={tab === 'favorites'} onClick={() => setTab('favorites')}>
          Favorites{favorites.size ? ` (${favorites.size})` : ''}
        </button>
      </div>
      <div className="styles-scroll">{body}</div>
    </aside>
  );
}

/** Phone layout: a sideways strip of previews with the current style centered. */
export function StyleStrip({ style, thumbs, onPick }: { style: StyleId; thumbs: Thumbs; onPick: (id: StyleId) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const current = useMemo(() => STYLES.find((s) => s.id === style)!, [style]);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [style]);

  return (
    <div className="strip">
      <div className="strip-scroll" ref={ref}>
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`strip-item${s.id === style ? ' active' : ''}`}
            aria-pressed={s.id === style}
            aria-label={s.label}
            onClick={() => onPick(s.id)}
          >
            <Thumb info={s} src={thumbs[s.id]} />
          </button>
        ))}
      </div>
      <p className="strip-label">{current.label}</p>
    </div>
  );
}
