export type Theme = 'paper' | 'night' | 'mono';

export const THEMES: { value: Theme; label: string; hint: string }[] = [
  { value: 'paper', label: 'Paper', hint: '温润纸感' },
  { value: 'night', label: 'Night', hint: '深夜纸感' },
  { value: 'mono', label: 'Mono', hint: '极简黑白' },
];

export const THEME_STORAGE_KEY = 'muimemo:theme';

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove('dark', 'theme-mono');
  if (theme === 'night') root.classList.add('dark');
  else if (theme === 'mono') root.classList.add('theme-mono');
}

export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'paper';
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'night' || raw === 'mono' ? raw : 'paper';
}

export function writeTheme(theme: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var r=document.documentElement;if(t==="night")r.classList.add("dark");else if(t==="mono")r.classList.add("theme-mono");}catch(e){}})();`;
