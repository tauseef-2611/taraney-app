import { useEffect, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { api } from './api';

interface Stats {
  songs: Record<string, number>; pending: Record<string, number>; issues: number;
  recordings: { total: number; synced: number };
  queued_jobs: number;
  activity: { actor: string; action: string; entity: string; created_at: string }[];
}

export default function Dashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [pending, setPending] = useState<{ pending: number; last_published_at: string | null }>({ pending: 0, last_published_at: null });
  useEffect(() => {
    api.get<Stats>('/admin/stats').then(setS);
    api.get<typeof pending>('/admin/publish/pending').then(setPending).catch(() => {});
  }, []);
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
          <a class="btn btn--secondary interactive" href="#/queue">
            <Icon name="download" />Job Queue{s.queued_jobs > 0 && <span class="admin__count">{s.queued_jobs}</span>}
          </a>
          <button class={`btn ${pending.pending ? 'btn--primary' : 'btn--secondary'} interactive`} disabled={publishing}
            title={pending.last_published_at ? `Last published ${pending.last_published_at} (UTC)` : 'Not published from the admin yet'}
            onClick={async () => {
              if (!confirm(`Rebuild the public site with all published taraney${pending.pending ? ` (${pending.pending} change${pending.pending === 1 ? '' : 's'} waiting)` : ''}?`)) return;
              setPublishing(true);
              try {
                const result = await api.post<{ site?: string; note?: string }>('/admin/publish');
                alert(result.site === 'rebuilding'
                  ? 'Publishing on GitHub. The public site updates in about 2 minutes.'
                  : result.note || 'GitHub Actions publishing is not configured.');
                if (result.site === 'rebuilding') setPending({ ...pending, pending: 0 });
              } catch (e) {
                alert((e as Error).message);
              } finally {
                setPublishing(false);
              }
            }}><Icon name="share" />{publishing ? 'Starting…' : 'Publish site'}{pending.pending > 0 && <span class="admin__count">{pending.pending}</span>}</button>
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
