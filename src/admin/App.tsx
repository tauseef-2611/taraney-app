// Admin single-page app. Hash routes: #/ dashboard, #/songs, #/songs/:id/:tab, #/new, #/inbox/:type
import { useEffect, useState } from 'preact/hooks';
import { Icon, type IconName } from '../components/ui/Icon';
import { Button } from '../components/ui/controls';
import { api, AuthError } from './api';
import Dashboard from './Dashboard';
import Songs from './Songs';
import SongEditor from './SongEditor';
import NewSong from './NewSong';
import Inbox from './Inbox';

export const go = (hash: string) => { location.hash = hash; };
const route = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);

export function useToast() {
  return (msg: string, tone: 'ok' | 'err' = 'ok') => window.dispatchEvent(new CustomEvent('toast', { detail: { msg, tone } }));
}

function Toasts() {
  const [list, setList] = useState<{ id: number; msg: string; tone: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { msg, tone } = (e as CustomEvent).detail;
      const id = Date.now() + Math.random();
      setList((l) => [...l, { id, msg, tone }]);
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), tone === 'err' ? 6000 : 2600);
    };
    window.addEventListener('toast', on);
    return () => window.removeEventListener('toast', on);
  }, []);
  return <div class="toasts" role="status">{list.map((t) => <div class={`toast toast--${t.tone}`}>{t.msg}</div>)}</div>;
}

function Login({ onDone }: { onDone: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { const r = await api.post<{ email: string }>('/auth/login', { email, passphrase: pass }); onDone(r.email); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <main class="login">
      <form class="card card--glow login__card" onSubmit={submit}>
        <p class="login__brand"><span lang="ur">ترانے</span> Taraney admin</p>
        <label class="field"><span class="field__label">Email</span><input class="input" type="email" autoComplete="username" value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required /></label>
        <label class="field"><span class="field__label">Passphrase</span><input class="input" type="password" autoComplete="current-password" value={pass} onInput={(e) => setPass((e.target as HTMLInputElement).value)} required /></label>
        {err && <p class="field__error">{err}</p>}
        <Button type="submit" block disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
    </main>
  );
}

const NAV: { key: string; label: string; icon: IconName; hash: string }[] = [
  { key: '', label: 'Dashboard', icon: 'home', hash: '#/' },
  { key: 'songs', label: 'Taraney', icon: 'library', hash: '#/songs' },
  { key: 'new', label: 'New tarana', icon: 'edit', hash: '#/new' },
  { key: 'inbox', label: 'Suggestions', icon: 'sparkles', hash: '#/inbox' },
];

export default function App() {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  const [parts, setParts] = useState(route());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const on = () => setParts(route());
    window.addEventListener('hashchange', on);
    const onAuth = (e: PromiseRejectionEvent) => { if (e.reason instanceof AuthError) setMe(null); };
    window.addEventListener('unhandledrejection', onAuth);
    api.get<{ email: string }>('/auth/me').then((r) => setMe(r.email)).catch(() => setMe(null));
    return () => { window.removeEventListener('hashchange', on); window.removeEventListener('unhandledrejection', onAuth); };
  }, []);

  useEffect(() => {
    if (!me) return;
    api.get<{ pending: Record<string, number> }>('/admin/stats').then((s) => setPending(Object.values(s.pending).reduce((a, b) => a + b, 0))).catch(() => {});
  }, [me, parts.join('/')]);

  if (me === undefined) return <div class="admin-loading">Loading…</div>;
  if (me === null) return <><Login onDone={setMe} /><Toasts /></>;

  const [section = '', a, b] = parts;
  const logout = async () => { await api.post('/auth/logout'); setMe(null); };

  let page;
  if (section === 'songs' && a) page = <SongEditor id={a} tab={b || 'details'} />;
  else if (section === 'songs') page = <Songs />;
  else if (section === 'new') page = <NewSong />;
  else if (section === 'inbox') page = <Inbox type={a || 'lyrics_fix'} />;
  else page = <Dashboard />;

  return (
    <div class="admin">
      <aside class="admin__nav">
        <a class="admin__brand" href="#/"><span lang="ur">ترانے</span><span>Admin</span></a>
        <nav>
          {NAV.map((n) => (
            <a href={n.hash} class={`admin__link interactive${section === n.key ? ' is-active' : ''}`}>
              <Icon name={n.icon} /><span>{n.label}</span>
              {n.key === 'inbox' && pending > 0 && <span class="admin__count">{pending}</span>}
            </a>
          ))}
        </nav>
        <div class="admin__me">
          <span class="t-body-sm c-muted">{me}</span>
          <button class="btn btn--text btn--sm interactive" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <main class="admin__main">{page}</main>
      <Toasts />
    </div>
  );
}
