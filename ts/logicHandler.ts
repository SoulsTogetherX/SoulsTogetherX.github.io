import {
  playPresetSFX,
  playSoundEffectRandom,
  toggleSoundMode,
} from './audioHandler.js';
import { toggleThemeMode } from './colorModeHandler.js';
import {
  MOVEMENT_AXES,
  createMovableElement,
  registerMovableElement,
  moveObjTo,
  shiftByPixel,
  makedUntouched,
  registerToPhysicsUpdate,
} from './moveableHandler.js';

//#region Type Defs
type NavKind = 'push' | 'pop';

type NavRequest = {
  url: URL;
  kind: NavKind;
  force: boolean;
};
//#endregion

//#region Constant ClassNames
const ACTIVE_CLASSNAME = 'active';

const PAGE_ENTERING_CLASS_NAME = 'page-is-entering';
const PAGE_EXITING_CLASS_NAME = 'page-is-exiting';

const DISABLE_MOVE_WRAPPER_CLASS_NAME = 'disable-move-wrapper';

const HIDE_GUIDE_CLASS_NAME = 'hide';

const CLIPBOARD_COPY = 'clipboard-copy';
const CLIPBOARD_CLICKED = 'clicked';

const AUDIO_BUTTON_CLASSNAME: string = 'audio-button';
//#endregion

//#region Constant Values (Bubble)
const BUBBLE_CLASSNAME: string = 'bubble-pop';
const BUBBLE_TIMEOUT: number = 50;

const BUBBLE_VOLUME: number = 0.3;

const MAX_BUBBLE_PITCH: number = 1.3;
const MIN_BUBBLE_PITCH: number = 0.5;
const INC_BUBBLE_PITCH: number = 0.05;
const RANGE_BUBBLE_PITCH: number = 0.05;
//#endregion

//#region Constant Values (Pencil Woosh)
const MAX_PENCIL_VOLUME: number = 0.7;
const MIN_PENCIL_VOLUME: number = 0.0;

const MAX_PENCIL_DELAY: number = 500;
const MIN_PENCIL_DELAY: number = 100;
//#endregion

//#region Constant Values (Helper)
const FALLBACK_REDIRECTS = ['/', '/about'];

const PENCIL_MAX_ROTATION_SPEED = 50;
//#endregion

//#region Constant Queries
const BG = document.getElementById('bg');
const CLOSE_BUTTON = document.getElementById('close-button');

const DESKTOP_PAGE_HOLDER = document.getElementById('desktop-page-holder')!;
const MOBILE_PAGE_HOLDER = document.getElementById('mobile-page-holder')!;

const ENVELOPE_GUIDE = document.getElementById('envelope-helper-guide');

const ENVELOPE_WRAPPER = document.getElementById('envelope-wrapper');
const ENVELOPE = document.getElementById('envelope');

const PENCIL_WRAPPER = document.getElementById('pencil-wrapper');
const PENCIL = document.getElementById('pencil');

const COLOR_TOKEN_WRAPPER = document.getElementById('color-token-wrapper');
const SOUND_TOKEN_WRAPPER = document.getElementById('sound-token-wrapper');

const MOBILE_COLOR_TOGGLE = document.getElementById('dark-mode-toggle');
const MOBILE_SOUND_TOGGLE = document.getElementById('sound-mode-toggle');
//#endregion

//#region Public Variables
let busy: boolean = false;

let pendingNav: NavRequest | undefined = undefined;
let navSeq: number = 0;

let pageId: number = 0;

let bubbleEscalation: number = MIN_BUBBLE_PITCH;
let bubbleTimerId: number | undefined = undefined;

let wooshEscalation: number = MIN_PENCIL_VOLUME;
let wooshDelay: number = MAX_PENCIL_DELAY;
let wooshTimerId: number | undefined = undefined;
//#endregion

//#region Public Queries
let mobileMain: HTMLElement | undefined;

let prevDesktopMain: HTMLElement | undefined;
let currentDesktopMain: HTMLElement | undefined;
let unregisterMovableElement = () => {};
//#endregion

//#region Misc Methods
function comparePaths(path1: string, path2: string): boolean {
  const clean = (p: string) => p.replace(/[^a-zA-Z0-9/]|\/$/g, '');
  return clean(path1) === clean(path2);
}

function isModifierClick(event: MouseEvent): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  );
}
function isInternalLink(anchor: HTMLAnchorElement): boolean {
  const url = new URL(anchor.href, location.href);
  return url.origin === location.origin;
}

export function awaitAnyEvent(
  el: HTMLElement,
  types: (keyof HTMLElementEventMap)[]
): Promise<string> {
  return new Promise((resolve) => {
    const unregisterAll = () => {
      for (const type of types) {
        el.removeEventListener(type, resolveDefer);
      }
    };
    const resolveDefer = (e: Event) => {
      unregisterAll();
      resolve(e.type);
    };

    for (const type of types) {
      el.addEventListener(type, resolveDefer);
    }
  });
}
//#endregion

//#region Listeners
// Navigation
document.addEventListener('click', onLinkClickCheck, true);
document.addEventListener('popstate', () => {
  queueNavigation(new URL(location.href), 'pop', !isActive());
});

// Envelope
{
  const toggle = () => toggleEnvelope(false);
  BG?.addEventListener('click', toggle);
  CLOSE_BUTTON?.addEventListener('click', toggle);
}

if (ENVELOPE_GUIDE && ENVELOPE) {
  ENVELOPE.addEventListener(
    'click',
    (_) => {
      ENVELOPE_GUIDE.classList.add(HIDE_GUIDE_CLASS_NAME);
    },
    { once: true }
  );
}

// Toggles
MOBILE_COLOR_TOGGLE?.addEventListener('click', toggleThemeWithSFX);
MOBILE_SOUND_TOGGLE?.addEventListener('click', toggleSoundWithSFX);
//#endregion

//#region Document Methods
async function fetchDocument(url: string): Promise<Document> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function buildIncomingMain(nextDoc: Document): [HTMLElement, HTMLElement] {
  const next = nextDoc.querySelector('main');
  if (!next) {
    throw new Error('Missing main in fetched page');
  }

  const desktop = document.createElement('main');
  desktop.innerHTML = next.innerHTML;

  desktop.setAttribute('id', `page-${pageId}`);
  pageId += 1;

  const mobile = desktop.cloneNode(true) as HTMLElement;
  mobile.setAttribute('id', `page-${pageId}`);
  pageId += 1;

  desktop.className = currentDesktopMain?.className ?? '';
  mobile.className = mobileMain?.className ?? '';

  return [desktop, mobile];
}

async function transitionMain(nextDoc: Document): Promise<void> {
  if (!currentDesktopMain) {
    throw new Error('Missing current main');
  }

  prevDesktopMain?.remove();

  const [desktop, mobile] = buildIncomingMain(nextDoc);

  if (mobileMain) {
    mobileMain.remove();
  }
  MOBILE_PAGE_HOLDER.insertBefore(mobile, null);
  mobileMain = mobile;

  DESKTOP_PAGE_HOLDER.insertBefore(desktop, currentDesktopMain);

  unregisterMovableElement();
  unregisterMovableElement = initializeCurrentPage(desktop);

  currentDesktopMain.classList.add(PAGE_EXITING_CLASS_NAME);

  if (desktop.checkVisibility()) {
    playPresetSFX('page-change');

    desktop.classList.add(PAGE_ENTERING_CLASS_NAME);
    await awaitAnyEvent(desktop, ['animationend', 'animationcancel']);
    desktop.classList.remove(PAGE_ENTERING_CLASS_NAME);
  }

  prevDesktopMain = currentDesktopMain;
  prevDesktopMain.setAttribute('aria-hidden', 'true');
  currentDesktopMain = desktop;
}
function forceMain(nextDoc: Document): void {
  if (!currentDesktopMain) {
    throw new Error('Missing current main');
  }

  const [desktop, mobile] = buildIncomingMain(nextDoc);

  // Mobile
  if (mobileMain) {
    mobileMain.remove();
  }
  MOBILE_PAGE_HOLDER.insertBefore(mobile, null);
  mobileMain = mobile;

  // Desktop
  DESKTOP_PAGE_HOLDER.insertBefore(desktop, currentDesktopMain.nextSibling);

  unregisterMovableElement();
  unregisterMovableElement = initializeCurrentPage(desktop);

  prevDesktopMain = currentDesktopMain;
  prevDesktopMain.setAttribute('aria-hidden', 'true');
  currentDesktopMain = desktop;
}
//#endregion

//#region Navigation Methods
function onLinkClickCheck(event: PointerEvent): void {
  const target = event.target as Element | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;

  if (
    !anchor ||
    !anchor.href ||
    !isInternalLink(anchor) ||
    isModifierClick(event as MouseEvent)
  ) {
    return;
  }

  event.preventDefault();

  const url = new URL(anchor.href);
  if (comparePaths(url.pathname, location.pathname)) {
    if (!isActive()) {
      toggleEnvelope(true);
    } else if (currentDesktopMain) {
      moveObjTo(currentDesktopMain, 0, -30);
    }
    return;
  }

  queueNavigation(url, 'push', !isActive());
  toggleEnvelope(true);
}

function queueNavigation(url: URL, kind: NavKind, force: boolean): void {
  const req: NavRequest = {
    url,
    kind,
    force,
  };

  if (busy) {
    pendingNav = req;
    return;
  }
  runNavigation(req);
}
async function runNavigation(req: NavRequest): Promise<void> {
  busy = true;
  const mySeq = ++navSeq;

  try {
    const nextDoc = await fetchDocument(req.url.href);
    if (mySeq !== navSeq) return;

    if (currentDesktopMain) {
      settupPrevPageClick(currentDesktopMain, new URL(window.location.href));
    }

    if (currentDesktopMain) {
      moveObjTo(currentDesktopMain, 0, -30);
    }

    if (req.force) {
      forceMain(nextDoc);
    } else {
      await transitionMain(nextDoc);
      if (mySeq !== navSeq) return;
    }

    document.title = nextDoc.title || document.title;
    if (req.kind == 'push') {
      history.pushState({}, '', req.url.href);
    }
  } catch (err) {
    console.error(err);
    window.location.href = req.url.href;
  } finally {
    if (pendingNav) {
      const next = pendingNav;
      pendingNav = undefined;
      await runNavigation(next);
      return;
    }

    busy = false;
    initalizeElementClasses();
  }
}
//#endregion

//#region Envelope Methods
function toggleEnvelope(toggle: boolean): void {
  if (!ENVELOPE || !ENVELOPE_WRAPPER) {
    return;
  }

  makedUntouched(ENVELOPE_WRAPPER);

  if (toggle) {
    if (isActive()) {
      return;
    }

    if (prevDesktopMain) {
      moveObjTo(prevDesktopMain, 0, -30);
    }
    if (currentDesktopMain) {
      moveObjTo(currentDesktopMain, 0, -30);
    }

    if (ENVELOPE.checkVisibility()) {
      playPresetSFX('envelope-open');

      prevDesktopMain?.classList.add('ease-delay-page');
      currentDesktopMain?.classList.add('ease-delay-page');

      awaitAnyEvent(ENVELOPE, ['transitionend', 'transitioncancel']).then(
        () => {
          prevDesktopMain?.classList.remove('ease-delay-page');
          currentDesktopMain?.classList.remove('ease-delay-page');
        }
      );
    } else {
      playPresetSFX('open-window');
    }

    ENVELOPE_WRAPPER.classList.add(DISABLE_MOVE_WRAPPER_CLASS_NAME);
    document.body.classList.add(ACTIVE_CLASSNAME);
    return;
  }

  if (!isActive()) {
    return;
  }

  if (ENVELOPE.checkVisibility()) {
    playPresetSFX('drop');

    prevDesktopMain?.classList.add('ease-page');
    currentDesktopMain?.classList.add('ease-page');

    awaitAnyEvent(ENVELOPE, ['transitionend', 'transitioncancel']).then(() => {
      prevDesktopMain?.classList.remove('ease-page');
      currentDesktopMain?.classList.remove('ease-page');
    });
  } else {
    playPresetSFX('close-window');
  }

  ENVELOPE_WRAPPER.classList.remove(DISABLE_MOVE_WRAPPER_CLASS_NAME);
  document.body.classList.remove(ACTIVE_CLASSNAME);
}
export function isActive(): boolean {
  return document.body.classList.contains(ACTIVE_CLASSNAME);
}
//#endregion

//#region Pencil Rotate
let pencilRotationAcceleration: number = 0;
let pencilRotationSpeed: number = 0;
let pencilRotation: number = 0;

if (PENCIL) {
  PENCIL.addEventListener('pointerdown', () => {
    pencilRotationAcceleration = 0.1;
    pencilRotationSpeed = 1;

    pencilWooshLoopStart();
  });
  document.addEventListener('pointerup', () => {
    pencilRotationAcceleration = -0.5;
  });
}

registerToPhysicsUpdate((): void => {
  if (!PENCIL) {
    return;
  }

  pencilRotationSpeed = Math.max(
    Math.min(
      pencilRotationSpeed + pencilRotationAcceleration,
      PENCIL_MAX_ROTATION_SPEED
    ),
    0
  );
  pencilRotation += pencilRotationSpeed;
  PENCIL.style.setProperty('--pencil-rotation', `${pencilRotation}deg`);
});

function pencilWooshLoopStart(): void {
  wooshDelay = MAX_PENCIL_DELAY;
  wooshEscalation = MIN_PENCIL_VOLUME;

  clearTimeout(wooshTimerId);
  wooshTimerId = setTimeout(pencilWoosh, wooshDelay);
}
function pencilWoosh(): void {
  const ratio = pencilRotationSpeed / PENCIL_MAX_ROTATION_SPEED;

  playSoundEffectRandom('woosh', 0.9, 1.1, ratio * MAX_PENCIL_VOLUME);
  wooshTimerId = setTimeout(
    pencilWoosh,
    MAX_PENCIL_DELAY + (MIN_PENCIL_DELAY - MAX_PENCIL_DELAY) * ratio
  );
}
//#endregion

//#region Element Methods
function initalizeElementClasses(): void {
  Array.from(document.getElementsByClassName(CLIPBOARD_COPY)).forEach((el) => {
    if (!(el instanceof HTMLElement)) {
      return;
    }

    el.addEventListener(
      'pointerenter',
      (_) => {
        el.classList.add('played');
      },
      { once: true }
    );

    el.addEventListener('click', () => {
      el.classList.add(CLIPBOARD_CLICKED);
      setClipboard(el.getAttribute('clipboard') ?? '');
    });
  });

  Array.from(document.getElementsByClassName(BUBBLE_CLASSNAME)).forEach(
    bubblePop
  );
  Array.from(document.getElementsByClassName(AUDIO_BUTTON_CLASSNAME)).forEach(
    buttonSounds
  );
}
//#endregion

//#region Clipboard Methods
async function setClipboard(text: string): Promise<void> {
  const type = 'text/plain';
  const clipboardItemData = {
    [type]: text,
  };
  const clipboardItem = new ClipboardItem(clipboardItemData);

  await navigator.clipboard.write([clipboardItem]);
}
//#endregion

//#region Audio Methods
function playBubbleSFX(): void {
  if (bubbleTimerId) {
    return;
  }

  bubbleTimerId = setTimeout(() => {
    bubbleTimerId = undefined;
  }, BUBBLE_TIMEOUT);

  playSoundEffectRandom(
    'pop',
    bubbleEscalation - RANGE_BUBBLE_PITCH,
    bubbleEscalation + RANGE_BUBBLE_PITCH,
    BUBBLE_VOLUME
  );

  bubbleEscalation += INC_BUBBLE_PITCH;
  if (bubbleEscalation > MAX_BUBBLE_PITCH) {
    bubbleEscalation = MIN_BUBBLE_PITCH;
  }
}
function bubblePop(el: Element): void {
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.addEventListener('pointerenter', playBubbleSFX);
}

function playButtonClickSFX(): void {
  playPresetSFX('button-click');
}
function playLinkButtonHoverSFX(): void {
  playPresetSFX('link-button-hover');
}
function playButtonHoverSFX(): void {
  playPresetSFX('button-hover');
}
function buttonSounds(el: Element): void {
  if (!(el instanceof HTMLElement)) {
    return;
  }

  if (!el.hasAttribute('no-press')) {
    el.addEventListener('click', playButtonClickSFX);
  }
  if (el.hasAttribute('link-button')) {
    el.addEventListener('pointerenter', playLinkButtonHoverSFX);
    return;
  }
  el.addEventListener('pointerenter', playButtonHoverSFX);
}
//#endregion

//#region Initialization Methods (Defined)
function settupPrevPageClick(page: HTMLElement, url: URL): void {
  page.addEventListener('click', () => {
    queueNavigation(url, 'push', false);
  });
}

function toggleThemeWithSFX(): void {
  toggleThemeMode();
  playPresetSFX('light-switch');
}
function toggleSoundWithSFX(): void {
  toggleSoundMode();
  playPresetSFX('sound-toggle-on');
}
function registerAllMovableElements(): void {
  if (ENVELOPE_WRAPPER && ENVELOPE) {
    registerMovableElement(
      ENVELOPE_WRAPPER,
      ENVELOPE,
      MOVEMENT_AXES.HORIZONTAL | MOVEMENT_AXES.VERTICAL,
      [50, 50],
      [0.5, 0.5],
      undefined,
      () => toggleEnvelope(true),
      true
    );
  }
  if (PENCIL_WRAPPER && PENCIL) {
    registerMovableElement(
      PENCIL_WRAPPER,
      PENCIL,
      MOVEMENT_AXES.HORIZONTAL | MOVEMENT_AXES.VERTICAL,
      [50, 30],
      [0.5, 0.5],
      undefined,
      undefined,
      true
    );
  }
  if (COLOR_TOKEN_WRAPPER) {
    registerMovableElement(
      COLOR_TOKEN_WRAPPER,
      COLOR_TOKEN_WRAPPER.firstElementChild as HTMLElement,
      MOVEMENT_AXES.HORIZONTAL | MOVEMENT_AXES.VERTICAL,
      [76, 50],
      [0.5, 0.5],
      undefined,
      toggleThemeWithSFX,
      true
    );
  }
  if (SOUND_TOKEN_WRAPPER) {
    registerMovableElement(
      SOUND_TOKEN_WRAPPER,
      SOUND_TOKEN_WRAPPER.firstElementChild as HTMLElement,
      MOVEMENT_AXES.HORIZONTAL | MOVEMENT_AXES.VERTICAL,
      [24, 50],
      [0.5, 0.5],
      undefined,
      toggleSoundWithSFX,
      true
    );
  }
}

function initializeCurrentPage(
  curr: HTMLElement,
  movable: boolean = true
): () => void {
  const unregisterPage = initializePage(curr, movable);
  const handleWheel = (e: WheelEvent) => {
    shiftByPixel(curr, [0, e.deltaY * 0.5]);
  };

  document.addEventListener('wheel', handleWheel);
  return () => {
    document.removeEventListener('wheel', handleWheel);
    unregisterPage();
  };
}
function initializePage(
  page: HTMLElement,
  movable: boolean = true
): () => void {
  if (!movable) {
    createMovableElement(
      page,
      page,
      MOVEMENT_AXES.VERTICAL,
      [0, 0],
      [0, 0],
      [0, -1, 1, 0]
    );
    return () => {};
  }

  return registerMovableElement(
    page,
    page,
    MOVEMENT_AXES.VERTICAL,
    [0, -30],
    [0, 0],
    [0, -1, 1, 0],
    undefined,
    false
  );
}

async function initializePages(): Promise<void> {
  // Desktop
  currentDesktopMain = DESKTOP_PAGE_HOLDER.querySelector('main') as
    | HTMLElement
    | undefined;
  // Mobile
  mobileMain = MOBILE_PAGE_HOLDER.querySelector('main') as
    | HTMLElement
    | undefined;

  if (!currentDesktopMain || !mobileMain) {
    throw new Error('Missing current main');
  }

  const pathname =
    FALLBACK_REDIRECTS[
      FALLBACK_REDIRECTS[0] !== window.location.pathname ? 0 : 1
    ];
  const nextDoc = await fetchDocument(pathname);

  const [desktop, _] = buildIncomingMain(nextDoc);

  // Desktop
  prevDesktopMain = desktop;
  DESKTOP_PAGE_HOLDER.insertBefore(prevDesktopMain, currentDesktopMain);
  settupPrevPageClick(
    prevDesktopMain,
    new URL(pathname, window.location.origin)
  );

  unregisterMovableElement = initializeCurrentPage(currentDesktopMain);
  initializePage(prevDesktopMain, false);

  prevDesktopMain.setAttribute('aria-hidden', 'true');
}
//#endregion

//#region Initialization Methods (Called)
registerAllMovableElements();
initializePages();
initalizeElementClasses();
//#endregion
