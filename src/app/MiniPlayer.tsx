// Persistent mini-player (survives navigation via transition:persist). Tap it to expand into the
// full player. Shows only while a hosted recording is loaded.
import { useMemo } from 'preact/hooks';
import { Artwork } from '../components/ui/content';
import { IconButton } from '../components/ui/controls';
import { expandSung } from '../lib/song-shape';
import { activeCue, buildTimeline } from '../lib/timeline';
import type { Recording } from '../lib/types';
import { player, usePlayer } from './store';
import FullPlayer from './FullPlayer';

export default function MiniPlayer() {
  const s = usePlayer();
  const cues = useMemo(() => (s.rec ? buildTimeline(s.rec as unknown as Recording) : []), [s.rec]);
  const blocks = useMemo(() => (s.song ? expandSung(s.song.doc, s.rec?.structure || s.song.doc.structure) : []), [s.song, s.rec]);
  if (!s.song || !s.rec) return null;

  const cue = activeCue(cues, s.t);
  const line = cue ? blocks.find((b) => b.occ === cue.occ)?.lines[cue.line] : null;
  const pct = s.duration ? Math.min(100, (s.t / s.duration) * 100) : 0;
  const open = () => player.expand(true);

  return (
    <>
      {!s.expanded && (
        <div class="app-mini">
          <div class="mini-player interactive" role="button" tabIndex={0} aria-label="Open player" onClick={open}
            onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
            <Artwork song={s.song} size="sm" />
            <span class="mini-player__text">
              <span class="mini-player__title" lang="ur-Latn">{s.song.title_ro || s.song.title_ur}</span>
              {line
                ? (line.ur ? <span class="mini-player__line" lang="ur">{line.ur}</span> : <span class="mini-player__line">{line.ro}</span>)
                : <span class="mini-player__line">{s.playing ? 'Playing' : 'Paused'}</span>}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <IconButton icon={s.playing ? 'pause' : 'play'} label={s.playing ? 'Pause' : 'Play'} variant="primary" onClick={() => player.toggle()} />
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <IconButton icon="close" label="Close player" size="sm" onClick={() => player.close()} />
            </span>
            <div class="mini-player__progress"><span style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      )}
      {s.expanded && <FullPlayer />}
    </>
  );
}
