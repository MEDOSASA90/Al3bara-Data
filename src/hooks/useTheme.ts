import { useCallback, useEffect, useState } from 'react';
import { THEME_STORAGE_KEY } from '../domain/constants';
import type { Theme } from '../domain/types';

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
