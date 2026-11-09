import { useEffect, useState } from 'preact/hooks';
import { IconButton } from '../components/ui/controls';

export default function ThemeSwitchCompact() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => { setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'); }, []);
  const flip = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('taraney_theme', t); } catch { /* ignore */ }
    setTheme(t);
  };
  return <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Light theme' : 'Dark theme'} onClick={flip} />;
}
