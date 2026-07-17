'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'fumadocs-ui/provider/base';
import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

export function SiteThemeToggle({ className = '' }: Readonly<{ className?: string }>) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const dark = mounted && resolvedTheme === 'dark';

  return (
    <button
      aria-label={dark ? 'Use light mode' : 'Use dark mode'}
      className={`site-theme-toggle ${className}`.trim()}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      type="button"
    >
      {mounted ? (dark ? <Sun aria-hidden /> : <Moon aria-hidden />) : <span aria-hidden />}
    </button>
  );
}
