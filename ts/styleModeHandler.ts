//#region Type Defs
export type StylePreference = 'simple' | 'complex';
//#endregion

//#region Constant Keys
const STYLE_MODE_CLASSNAME = 'complex';

const STYLE_KEY = 'simple';
//#endregion

//#region Export Methods
export function getSavedStyleMode(): StylePreference {
  const savedTheme = localStorage.getItem(STYLE_KEY);
  if (savedTheme === null) {
    return 'complex';
  }
  return savedTheme as StylePreference;
}

export function setStyleMode(theme: StylePreference): void {
  toggleStyleMode(theme === 'simple');
}
export function toggleStyleMode(toggle?: boolean): void {
  if (toggle === undefined) {
    const newTheme =
      localStorage.getItem(STYLE_KEY) === 'simple' ? 'complex' : 'simple';

    document.body.classList.toggle(STYLE_MODE_CLASSNAME);
    localStorage.setItem(STYLE_KEY, newTheme);
    return;
  }

  if (toggle) {
    document.body.classList.remove(STYLE_MODE_CLASSNAME);
    localStorage.setItem(STYLE_KEY, 'simple');
    return;
  }
  document.body.classList.add(STYLE_MODE_CLASSNAME);
  localStorage.setItem(STYLE_KEY, 'complex');
}
//#endregion

//#region Initialization
function initializeStyleMode(): void {
  setStyleMode('complex');
}
initializeStyleMode();
//#endregion
