// Home hero: a swipeable carousel of random taraney (re-shuffled on each visit), auto-advancing.
import { useEffect, useRef, useState } from 'preact/hooks';
import { Artwork, type CardSong } from '../components/ui/content';
import { Icon } from '../components/ui/Icon';

type Slide = CardSong & { slug: string; line_ur?: string | null };

export default function HeroCarousel({ pool }: { pool: Slide[] }) {
  const [slides, setSlides] = useState(pool.slice(0, 6));
  const [idx, setIdx] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 6);
    setSlides(shuffled);
  }, []);
  useEffect(() => {
    const el = track.current!;
    const onScroll = () => setIdx(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', onScroll, { passive: true });
    const timer = setInterval(() => {
      if (paused.current || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth });
    }, 5500);
    return () => { el.removeEventListener('scroll', onScroll); clearInterval(timer); };
  }, [slides.length]);
  const go = (i: number) => track.current?.scrollTo({ left: i * track.current.clientWidth });

  return (
    <section class="hero-carousel" aria-roledescription="carousel" aria-label="Featured taraney"
      onPointerEnter={() => { paused.current = true; }} onPointerLeave={() => { paused.current = false; }} onTouchStart={() => { paused.current = true; }}>
      <div class="hero-track" ref={track}>
        {slides.map((s, i) => (
          <a class="hero-slide" href={`/t/${s.slug}/`} aria-label={s.title_ro || s.title_ur || 'Tarana'} aria-roledescription="slide" aria-hidden={i !== idx}>
            <Artwork song={s} animated={i === idx} />
            <span class="hero-slide__veil" />
            {s.has_audio && <span class="hero-slide__play icon-btn icon-btn--primary"><Icon name="play" /></span>}
            <span class="hero-slide__text">
              <span class="hero-slide__kicker">{s.has_audio ? 'Listen with lyrics' : 'Read'}</span>
              {s.title_ur && <span class="hero-slide__ur" lang="ur">{s.title_ur}</span>}
              {s.title_ro && <span class="hero-slide__ro">{s.title_ro}</span>}
            </span>
          </a>
        ))}
      </div>
      <div class="hero-dots">{slides.map((_, i) => <button aria-label={`Slide ${i + 1}`} aria-current={i === idx ? 'true' : 'false'} onClick={() => go(i)} />)}</div>
    </section>
  );
}
