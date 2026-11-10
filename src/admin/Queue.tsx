// Admin Job Queue: shows all ingest jobs (queued, running, done, failed) with retry/cancel/delete.
// Polls every 3 s while any job is active so the step column refreshes live.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { api } from './api';
import { useToast } from './App';

interface Job {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  step: string | null;
  error: string | null;
  input: { recording_id?: string; timing?: boolean };
  song_id: string | null;
  title_ro: string | null;
  title_ur: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CLASS: Record<string, string> = {
  queued: 'badge badge--warning',
  running: 'badge badge--info badge--pulse',
  done: 'badge badge--success',
  failed: 'badge badge--error',
  cancelled: 'badge',
};
const STATUS_LABEL: Record<string, string> = {
  queued: '⏳ Queued',
  running: '⚡ Running',
  done: '✓ Done',
  failed: '✗ Failed',
  cancelled: '— Cancelled',
};

function fmt(iso: string) {
  const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function age(iso: string) {
  const s = Math.round((Date.now() - new Date(iso + (iso.endsWith('Z') ? '' : 'Z')).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function Queue() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const toast = useToast();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => api.get<Job[]>('/admin/jobs').then(setJobs).catch(() => {});

  useEffect(() => {
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-poll while there are active jobs
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const hasActive = jobs?.some((j) => j.status === 'queued' || j.status === 'running');
    if (hasActive) timerRef.current = setInterval(load, 3000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [jobs]);

  const retry = async (id: string) => {
    try { await api.post(`/admin/jobs/${id}/retry`); toast('Job re-queued — run `npm run worker` to process it'); load(); }
    catch (x) { toast((x as Error).message, 'err'); }
  };
  const cancel = async (id: string) => {
    try { await api.post(`/admin/jobs/${id}/cancel`); load(); }
    catch (x) { toast((x as Error).message, 'err'); }
  };
  const del = async (id: string) => {
    if (!confirm('Delete this job record?')) return;
    try { await api.del(`/admin/jobs/${id}`); load(); }
    catch (x) { toast((x as Error).message, 'err'); }
  };

  if (!jobs) return <div class="admin-loading">Loading…</div>;

  const queued = jobs.filter((j) => j.status === 'queued').length;
  const running = jobs.filter((j) => j.status === 'running').length;

  return (
    <div class="admin-page">
      <header class="admin-head">
        <h1 class="t-headline-md">Job Queue</h1>
        <div class="form-actions">
          <button class="btn btn--secondary interactive" onClick={load}><Icon name="check" />Refresh</button>
        </div>
      </header>

      {/* Worker instructions */}
      <div class="card admin-card" style="margin-bottom: 1.5rem; background: var(--c-surface-variant)">
        <h2 class="t-title-md" style="margin-bottom: .5rem">Your PC runs the ingest</h2>
        <p class="t-body-sm c-muted" style="margin-bottom: .75rem">
          GitHub Actions is blocked by YouTube. Run one or more workers on your local machine — each terminal picks the next queued job
          and you get a prompt to approve it before it runs.
        </p>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <code class="code-pill">npm run worker</code>
          <span class="t-body-sm c-muted" style="align-self:center">— interactive, asks permission per job</span>
        </div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-top:.5rem">
          <code class="code-pill">npm run worker:auto</code>
          <span class="t-body-sm c-muted" style="align-self:center">— unattended, processes all queued jobs automatically</span>
        </div>
        <p class="t-body-sm c-muted" style="margin-top:.5rem">Open 2–3 terminals in parallel to ingest multiple recordings at once.</p>
      </div>

      {/* Live status bar */}
      {(queued > 0 || running > 0) && (
        <div class="card admin-card" style="margin-bottom:1rem;display:flex;gap:1rem;align-items:center">
          {running > 0 && <span class="badge badge--info badge--pulse">⚡ {running} running</span>}
          {queued > 0 && <span class="badge badge--warning">⏳ {queued} queued</span>}
          <span class="t-body-sm c-muted">Auto-refreshing every 3 s…</span>
        </div>
      )}

      {jobs.length === 0 ? (
        <div class="card admin-card">
          <p class="t-body-md c-muted">No jobs yet. Trigger ingestion from a recording in the song editor.</p>
        </div>
      ) : (
        <div class="card" style="overflow:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Song</th>
                <th>Recording</th>
                <th>Step / Error</th>
                <th>Queued</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} class={j.status === 'running' ? 'row--active' : ''}>
                  <td><span class={STATUS_CLASS[j.status] || 'badge'}>{STATUS_LABEL[j.status] || j.status}</span></td>
                  <td>
                    {j.song_id
                      ? <a href={`#/songs/${j.song_id}`} class="interactive">{j.title_ro || j.title_ur || j.song_id}</a>
                      : <span class="c-muted">—</span>}
                  </td>
                  <td><code class="t-body-sm">{j.input.recording_id || '—'}</code></td>
                  <td>
                    {j.status === 'failed' && j.error
                      ? <span class="t-body-sm c-error">{j.error.slice(0, 120)}{j.error.length > 120 ? '…' : ''}</span>
                      : <span class="t-body-sm c-muted">{j.step || '—'}</span>}
                  </td>
                  <td><span class="t-body-sm c-muted" title={j.created_at}>{fmt(j.created_at)}</span></td>
                  <td><span class="t-body-sm c-muted" title={j.updated_at}>{age(j.updated_at)}</span></td>
                  <td>
                    <div style="display:flex;gap:.25rem">
                      {(j.status === 'failed' || j.status === 'cancelled') && (
                        <button class="btn btn--secondary btn--sm interactive" onClick={() => retry(j.id)}>Retry</button>
                      )}
                      {(j.status === 'queued' || j.status === 'running') && (
                        <button class="btn btn--text btn--sm interactive" onClick={() => cancel(j.id)}>Cancel</button>
                      )}
                      {(j.status === 'done' || j.status === 'failed' || j.status === 'cancelled') && (
                        <button class="icon-btn icon-btn--sm interactive" aria-label="Delete job" onClick={() => del(j.id)}><Icon name="trash" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
