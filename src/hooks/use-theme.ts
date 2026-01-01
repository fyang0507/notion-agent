'use client';

import { useTheme as useNextTheme } from 'next-themes';

export function useTheme() {
  const { theme, setTheme: setNextTheme, systemTheme } = useNextTheme();

  // Resolve the actual theme (system could be either light or dark)
  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  const toggleTheme = () => {
    setNextTheme(resolvedTheme === 'light' ? 'dark' : 'light');
  };

  return {
    theme: resolvedTheme as 'light' | 'dark',
    setTheme: setNextTheme,
    toggleTheme,
  };
}
