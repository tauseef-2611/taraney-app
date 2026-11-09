// Couplet of the day: picked by date from build-time candidates; shareable as a status image.
import { useEffect, useState } from 'preact/hooks';
import { Button } from '../components/ui/controls';
import ShareSheet from './ShareSheet';

export interface Couplet { id: string; slug: string; mood: string; title_ur: string | null; title_ro: string | null; lines: { ur: string; ro: string }[] }

export default function CoupletOfDay({ candidates }: { candidates: Couplet[] }) {
  const [c, setC] = useState(candidates[0]);
  const [share, setShare] = useState(false);
  useEffect(() => {
    const day = Math.floor(Date.now() / 86400000);
    setC(candidates[day % candidates.length]);
  }, []);
  if (!c) return null;
  const options = c.lines.map((l, i) => ({ key: `${i}`, ur: l.ur, ro: l.ro }));
  return (
    <section class="couplet-card">
      <p class="t-label-sm">Couplet of the day</p>
      {c.lines.some((l) => l.ur) && <div>{c.lines.map((l) => l.ur && <p lang="ur">{l.ur}</p>)}</div>}
      <div>{c.lines.map((l) => l.ro && <p class="couplet-card__ro">{l.ro}</p>)}</div>
      <a class="couplet-card__src" href={`/t/${c.slug}/`}>{c.title_ro || c.title_ur} →</a>
      <div class="form-actions"><Button icon="share" onClick={() => setShare(true)}>Share as status</Button></div>
      {share && <ShareSheet song={c} options={options} initial={options.map((o) => o.key)} onClose={() => setShare(false)} />}
    </section>
  );
}
