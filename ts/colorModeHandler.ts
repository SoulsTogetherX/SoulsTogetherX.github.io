//#region Type Defs
export type ThemePreference = 'dark' | 'light';
//#endregion

//#region Constant Keys
const DARK_MODE_CLASSNAME = 'dark-mode';

const THEME_KEY = 'theme';
//#endregion

//#region Export Methods
export function getColorPreference(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const isDark: boolean = window.matchMedia(
    '(prefers-color-scheme: dark)'
  ).matches;
  return isDark ? 'dark' : 'light';
}

export function getSavedTheme(): ThemePreference {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme === null) {
    return 'light';
  }
  return savedTheme as ThemePreference;
}

export function setThemeMode(theme: ThemePreference): void {
  toggleThemeMode(theme === 'dark');
}
export function toggleThemeMode(toggle?: boolean): void {
  if (toggle === undefined) {
    const newTheme =
      localStorage.getItem(THEME_KEY) === 'dark' ? 'light' : 'dark';

    document.body.classList.toggle(DARK_MODE_CLASSNAME);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    return;
  }

  if (toggle) {
    document.body.classList.add(DARK_MODE_CLASSNAME);
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem(THEME_KEY, 'dark');
    return;
  }
  document.body.classList.remove(DARK_MODE_CLASSNAME);
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.setItem(THEME_KEY, 'light');
}
//#endregion

//#region Initialization
function initializeColorTheme(): void {
  setThemeMode(getSavedTheme());
}
initializeColorTheme();
//#endregion
