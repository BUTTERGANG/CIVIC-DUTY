// Light/dark theme management. Persists user choice in localStorage and applies
// via data-theme on <html> (CSS in index.css flips the token set). Defaults to
// dark (the brand), respects a stored preference.
const STORAGE_KEY = "civicduty_theme";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") root?.setAttribute("data-theme", "light");
  else root?.removeAttribute("data-theme");
}

export function setTheme(theme: Theme): Theme {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
  return theme;
}

export function initTheme(): void {
  applyTheme(getTheme());
}