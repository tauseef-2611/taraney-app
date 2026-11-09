// On-device library: saved and recent taraney (localStorage). Works without an account.
import { useEffect, useState } from 'preact/hooks';

export interface LibItem { id: string; slug: string; title_ur: string | null; title_ro: string | null; mood: string; genre: string | null; has_audio?: boolean; at: number }
const KEYS = { saved: 'taraney_saved', recent: 'taraney_recent' } as const;
type Kind = keyof typeof KEYS;

const read = (k: Kind): LibItem[] => { try { return JSON.parse(localStorage.getItem(KEYS[k]) || '[]'); } catch { return []; } };
const write = (k: Kind, v: LibItem[]) => { try { localStorage.setItem(KEYS[k], JSON.stringify(v)); } catch { /* private mode */ } window.dispatchEvent(new Event('taraney:library')); };

export const library = {
  list: read,
  isSaved: (id: string) => read('saved').some((x) => x.id === id),
  toggleSave(item: Omit<LibItem, 'at'>) {
    const cur = read('saved');
    write('saved', cur.some((x) => x.id === item.id) ? cur.filter((x) => x.id !== item.id) : [{ ...item, at: Date.now() }, ...cur]);
  },
  visit(item: Omit<LibItem, 'at'>) {
    write('recent', [{ ...item, at: Date.now() }, ...read('recent').filter((x) => x.id !== item.id)].slice(0, 30));
  },
  clearRecent: () => write('recent', []),
};

export function useLibrary(kind: Kind): LibItem[] {
  const [v, setV] = useState<LibItem[]>([]);
  useEffect(() => {
    const on = () => setV(read(kind));
    on();
    window.addEventListener('taraney:library', on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener('taraney:library', on); window.removeEventListener('storage', on); };
  }, [kind]);
  return v;
}
