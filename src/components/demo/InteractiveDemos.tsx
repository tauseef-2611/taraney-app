// Small islands for the design page: reading surface, interactive controls, theme/motion switch.
import { useEffect, useState } from 'preact/hooks';
import { expandSung, scriptsOf } from '../../lib/song-shape';
import type { SongDoc } from '../../lib/types';
import { Lyrics } from '../ui/content';
import { Chip, ModeSwitch, SearchField, TabBar, Progress, type ReadingMode } from '../ui/controls';

export function ReaderDemo({ doc }: { doc: SongDoc }) {
  const [mode, setMode] = useState<ReadingMode>('both');
  const [surface, setSurface] = useState<'paper' | 'dark'>('paper');
  const [compact, setCompact] = useState(true);
  const blocks = expandSung(doc);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
        <ModeSwitch mode={mode} scripts={scriptsOf(doc)} onChange={setMode} />
        <Chip selected={surface === 'paper'} icon="sun" onClick={() => setSurface(surface === 'paper' ? 'dark' : 'paper')}>Ivory surface</Chip>
        <Chip selected={compact} icon="repeat" onClick={() => setCompact(!compact)}>Compact repeats</Chip>
      </div>
      <Lyrics blocks={blocks} mode={mode} surface={surface} compactRepeats={compact} />
    </div>
  );
}

export function ControlsDemo() {
  const [tab, setTab] = useState('home');
  const [q, setQ] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({ Tarana: true });
  const toggle = (k: string) => setChips({ ...chips, [k]: !chips[k] });
  const [p, setP] = useState(0.62);
  useEffect(() => {
    const id = setInterval(() => setP((x) => (x >= 1 ? 0 : x + 0.01)), 120);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
      <SearchField value={q} onInput={setQ} placeholder="تلاش کریں · Search taraney" />
      {q && <p class="t-body-sm c-muted">Searching for “{q}” across Urdu and Roman (folded spelling).</p>}
      <div class="chip-row">
        {['Tarana', 'Hamd', 'Naat', 'Dua', 'Nazm', 'Ghazal'].map((k) => (
          <Chip selected={!!chips[k]} icon="tag" onClick={() => toggle(k)}>{k}</Chip>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <Progress value={p} label="Loading" />
        <Progress value={0.84} label="Downloaded" />
        <Progress value={0.55} tone="tertiary" label="Offline storage" />
      </div>
      <TabBar active={tab} onSelect={setTab} variant="floating" />
      <TabBar active={tab} onSelect={setTab} variant="icons" />
    </div>
  );
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);
  const apply = (t: 'dark' | 'light') => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('taraney_theme', t); } catch { /* ignore */ }
    setTheme(t);
  };
  const motion = () => {
    const r = !reduced;
    if (r) document.documentElement.dataset.motion = 'reduced'; else delete document.documentElement.dataset.motion;
    setReduced(r);
  };
  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <Chip icon={theme === 'dark' ? 'moon' : 'sun'} selected={theme === 'light'} onClick={() => apply(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? 'Dark' : 'Light'}
      </Chip>
      <Chip icon="sparkles" selected={reduced} onClick={motion}>{reduced ? 'Motion off' : 'Motion on'}</Chip>
    </div>
  );
}
