import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { api } from './api';

interface Stats {
  songs: Record<string, number>; pending: Record<string, number>; issues: number;
  recordings: { total: number; synced: number };
  activity: { actor: string; action: string; entity: string; created_at: string }[];
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { api.get<Stats>('/admin/stats').then(setS); }, []);
  if (!s) return <div class="admin-loading">Loading…</div>;
  const total = Object.values(s.songs).reduce((a, b) => a + b, 0);
  const tiles = [
    { label: 'Taraney', value: total, href: '#/songs', icon: 'library' as const },
    { label: 'Published', value: s.songs.published || 0, href: '#/songs?state=published', icon: 'check' as const },
    { label: 'Drafts to review', value: (s.songs.draft || 0) + (s.songs.review || 0), href: '#/songs?state=review', icon: 'edit' as const },
    { label: 'Need fixing', value: s.issues, href: '#/songs?state=issues', icon: 'info' as const },
    { label: 'Synced recordings', value: `${s.recordings.synced}/${s.recordings.total}`, href: '#/songs', icon: 'music' as const },
  ];
  const inbox = [
    { key: 'lyrics_fix', label: 'Lyric corrections' },
    { key: 'audio', label: 'Audio submissions' },
    { key: 'tarana', label: 'New tarana submissions' },
  ];
  return (
    <div class="admin-page">
      <header class="admin-head">
        <h1 class="t-headline-md">Dashboard</h1>
        <div class="form-actions">
          <button class="btn btn--secondary interactive" onClick={async () => {
            if (!confirm('Rebuild and deploy the public site with all published taraney?')) return;
            try { await api.post('/admin/publish'); alert('Publishing on GitHub. The site updates in about 2 minutes.'); }
            catch (x) { alert((x as Error).message); }
          }}><Icon name="share" />Publish site</button>
          <a class="btn btn--primary interactive" href="#/new"><Icon name="edit" />New tarana</a>
        </div>
      </header>
      <div class="stat-grid">
        {tiles.map((t) => (
          <a class="stat card interactive" href={t.href}>
            <span class="stat__icon"><Icon name={t.icon} /></span>
            <span class="stat__value">{t.value}</span>
            <span class="stat__label">{t.label}</span>
          </a>
        ))}
      </div>
      <div class="admin-cols">
        <section class="card admin-card">
          <h2 class="t-title-md">Waiting for you</h2>
          {inbox.map((i) => (
            <a class="inbox-row interactive" href={`#/inbox/${i.key}`}>
              <span>{i.label}</span>
              <span class={`badge${s.pending[i.key] ? ' badge--primary' : ''}`}>{s.pending[i.key] || 0}</span>
            </a>
          ))}
        </section>
        <section class="card admin-card">
          <h2 class="t-title-md">Recent activity</h2>
          {s.activity.length ? s.activity.map((a) => (
            <p class="activity"><span class="t-label-md">{a.action}</span> <span class="c-variant">{a.entity}</span><span class="t-body-sm c-muted">{a.created_at.slice(5, 16)}</span></p>
          )) : <p class="t-body-md c-muted">Nothing yet.</p>}
        </section>
      </div>
    </div>
  );
}
