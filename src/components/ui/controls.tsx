// Basic controls. Each maps 1:1 to a class in styles/components.css.
import type { ComponentChildren, JSX } from 'preact';
import { Icon, type IconName } from './Icon';

type BtnVariant = 'primary' | 'secondary' | 'inverted' | 'outlined' | 'tonal' | 'text';
type ButtonProps = Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon' | 'size'> & {
  variant?: BtnVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  block?: boolean;
  disabled?: boolean;
  children?: ComponentChildren;
};

export function Button({ variant = 'primary', size = 'md', icon, block, children, class: cls, ...rest }: ButtonProps) {
  const c = ['btn', 'interactive', `btn--${variant}`, size !== 'md' && `btn--${size}`, block && 'btn--block', cls].filter(Boolean).join(' ');
  return (
    <button type="button" class={c} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

type IconBtnVariant = 'standard' | 'primary' | 'secondary' | 'tertiary' | 'error' | 'tonal' | 'outlined';
type IconButtonProps = Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon' | 'size' | 'label'> & {
  icon: IconName;
  label: string;
  variant?: IconBtnVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
};

export function IconButton({ icon, label, variant = 'standard', size = 'md', class: cls, ...rest }: IconButtonProps) {
  const c = ['icon-btn', 'interactive', variant !== 'standard' && `icon-btn--${variant}`, size !== 'md' && `icon-btn--${size}`, cls].filter(Boolean).join(' ');
  return (
    <button type="button" class={c} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}

export function Fab({ icon, label, extended, primary }: { icon: IconName; label: string; extended?: boolean; primary?: boolean }) {
  return (
    <button type="button" class={`fab interactive${primary ? ' fab--primary' : ''}`} aria-label={extended ? undefined : label}>
      <Icon name={icon} />
      {extended && <span>{label}</span>}
    </button>
  );
}

export function Chip({ children, icon, selected, accent, onClick }: {
  children: ComponentChildren; icon?: IconName; selected?: boolean; accent?: boolean; onClick?: () => void;
}) {
  const interactive = selected !== undefined || !!onClick;
  const c = ['chip', interactive && 'interactive', accent && 'chip--accent'].filter(Boolean).join(' ');
  if (!interactive) return <span class={c}>{icon && <Icon name={icon} />}{children}</span>;
  return (
    <button type="button" class={c} aria-pressed={selected ? 'true' : 'false'} onClick={onClick}>
      {icon && <Icon name={selected ? 'check' : icon} />}
      {children}
    </button>
  );
}

export function Badge({ children, tone, icon }: { children: ComponentChildren; tone?: 'primary' | 'tertiary'; icon?: IconName }) {
  return <span class={`badge${tone ? ` badge--${tone}` : ''}`}>{icon && <Icon name={icon} />}{children}</span>;
}

export function SearchField({ placeholder = 'Search taraney, poets, lines…', value, onInput }: {
  placeholder?: string; value?: string; onInput?: (v: string) => void;
}) {
  return (
    <label class="search">
      <Icon name="search" />
      <span class="visually-hidden">Search</span>
      <input type="search" placeholder={placeholder} value={value} onInput={(e) => onInput?.((e.target as HTMLInputElement).value)} />
    </label>
  );
}

export function Progress({ value, tone, thin, label }: { value: number; tone?: 'tertiary'; thin?: boolean; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div class={['progress', tone && `progress--${tone}`, thin && 'progress--thin'].filter(Boolean).join(' ')}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div class="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface Tab { key: string; label: string; icon: IconName; href?: string }
export const APP_TABS: Tab[] = [
  { key: 'home', label: 'Home', icon: 'home', href: '/' },
  { key: 'explore', label: 'Explore', icon: 'explore', href: '/explore' },
  { key: 'library', label: 'Library', icon: 'library', href: '/library' },
];

export function TabBar({ active, tabs = APP_TABS, variant, onSelect }: {
  active: string; tabs?: Tab[]; variant?: 'floating' | 'icons'; onSelect?: (key: string) => void;
}) {
  const c = ['tabbar', variant === 'floating' && 'tabbar--floating', variant === 'icons' && 'tabbar--floating tabbar--icons'].filter(Boolean).join(' ');
  return (
    <nav class={c} aria-label="Main">
      {tabs.map((t) => (
        <button type="button" class="tab interactive" style={{ borderRadius: 'var(--radius-full)' }}
          aria-current={t.key === active ? 'page' : undefined} onClick={() => onSelect?.(t.key)}>
          <span class="tab__icon"><Icon name={t.icon} /></span>
          <span class="tab__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export type ReadingMode = 'ur' | 'both' | 'ro';

/** Shows only the modes the song supports; renders nothing when there is one script. */
export function ModeSwitch({ mode, scripts, onChange }: {
  mode: ReadingMode; scripts: { ur: boolean; ro: boolean }; onChange: (m: ReadingMode) => void;
}) {
  if (!(scripts.ur && scripts.ro)) return null;
  const opts: { key: ReadingMode; label: ComponentChildren }[] = [
    { key: 'ur', label: <span class="ur-label" lang="ur">اردو</span> },
    { key: 'both', label: 'Both' },
    { key: 'ro', label: 'Roman' },
  ];
  return (
    <div class="segmented" role="group" aria-label="Reading mode">
      {opts.map((o) => (
        <button type="button" class="interactive" aria-pressed={mode === o.key ? 'true' : 'false'} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
