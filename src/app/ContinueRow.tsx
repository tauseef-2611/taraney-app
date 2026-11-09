import { TaranaCard } from '../components/ui/content';
import { useLibrary } from './library';

export default function ContinueRow() {
  const recent = useLibrary('recent').slice(0, 8);
  if (!recent.length) return null;
  return (
    <section class="sec">
      <div class="sec__head"><h2>Continue</h2><a class="sec__more" href="/library/">Library</a></div>
      <div class="hscroll">{recent.map((s) => <TaranaCard song={s} href={`/t/${s.slug}/`} />)}</div>
    </section>
  );
}
