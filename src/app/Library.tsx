import { useState } from 'preact/hooks';
import { Icon } from '../components/ui/Icon';
import { TaranaCard } from '../components/ui/content';
import { useLibrary, library } from './library';

export default function Library() {
  const [tab, setTab] = useState<'saved' | 'recent'>('saved');
  const saved = useLibrary('saved');
  const recent = useLibrary('recent');
  const list = tab === 'saved' ? saved : recent;
  return (
    <div class="stack-lg">
      <nav class="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'saved'} class="tabs__tab interactive" style={{ border: 0, background: 'none' }} onClick={() => setTab('saved')}>Saved · {saved.length}</button>
        <button role="tab" aria-selected={tab === 'recent'} class="tabs__tab interactive" style={{ border: 0, background: 'none' }} onClick={() => setTab('recent')}>Recent · {recent.length}</button>
        {tab === 'recent' && recent.length > 0 && <><span class="spacer" /><button class="btn btn--text btn--sm interactive" onClick={() => library.clearRecent()}>Clear</button></>}
      </nav>
      {list.length ? (
        <div class="rows">{list.map((s) => <TaranaCard song={s} layout="row" href={`/t/${s.slug}/`} />)}</div>
      ) : (
        <div class="empty-state">
          <Icon name={tab === 'saved' ? 'heart' : 'library'} />
          <p class="t-title-md">{tab === 'saved' ? 'Nothing saved yet' : 'No history yet'}</p>
          <p>{tab === 'saved' ? 'Tap the heart on any tarana to keep it here. Your library stays on this device.' : 'Taraney you open will appear here.'}</p>
          <a class="btn btn--primary interactive" href="/explore/">Explore taraney</a>
        </div>
      )}
      <p class="t-body-sm c-muted">Saved for offline: open a tarana and tap the download icon. Lyrics and audio then work without internet.</p>
    </div>
  );
}
