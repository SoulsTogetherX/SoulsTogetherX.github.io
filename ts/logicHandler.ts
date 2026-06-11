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
//#endregion

//#region Constant Values (Helper)
const FALLBACK_REDIRECTS = ['/', '/about'];

const PENCIL_ROTATION = 50;
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
//#endregion

//#region Public Variables
let busy: boolean = false;

let pendingNav: NavRequest | undefined = undefined;
let navSeq: number = 0;

let pageId: number = 0;
//#endregion

//#region Public Queries
let mobileMain: HTMLElement | undefined;

let prevDesktopMain: HTMLElement | undefined;
let currentDesktopMain: HTMLElement | undefined;
let unregisterMovableElement = () => {};
//#endregion

//#region Initialization Methods (Called)
registerAllMovableElements();
initializePages();
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
function onLinkClickCheck(event: PointerEvent) {
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

    if (comparePaths(req.url.pathname, location.pathname)) {
      return;
    }

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
    }

    busy = false;
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
    if (!isActive()) {
      if (prevDesktopMain) {
        moveObjTo(prevDesktopMain, 0, -30);
      }
      if (currentDesktopMain) {
        moveObjTo(currentDesktopMain, 0, -30);
      }

      if (ENVELOPE.checkVisibility()) {
        prevDesktopMain?.classList.add('ease-delay-page');
        currentDesktopMain?.classList.add('ease-delay-page');

        awaitAnyEvent(ENVELOPE, ['transitionend', 'transitioncancel']).then(
          () => {
            prevDesktopMain?.classList.remove('ease-delay-page');
            currentDesktopMain?.classList.remove('ease-delay-page');
          }
        );
      }
    }

    ENVELOPE_WRAPPER.classList.add(DISABLE_MOVE_WRAPPER_CLASS_NAME);
    document.body.classList.add(ACTIVE_CLASSNAME);
    return;
  }

  if (ENVELOPE.checkVisibility()) {
    prevDesktopMain?.classList.add('ease-page');
    currentDesktopMain?.classList.add('ease-page');

    awaitAnyEvent(ENVELOPE, ['transitionend', 'transitioncancel']).then(() => {
      prevDesktopMain?.classList.remove('ease-page');
      currentDesktopMain?.classList.remove('ease-page');
    });
  }

  ENVELOPE_WRAPPER.classList.remove(DISABLE_MOVE_WRAPPER_CLASS_NAME);
  document.body.classList.remove(ACTIVE_CLASSNAME);
}
function isActive(): boolean {
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
    Math.min(pencilRotationSpeed + pencilRotationAcceleration, PENCIL_ROTATION),
    0
  );
  pencilRotation += pencilRotationSpeed;
  PENCIL.style.setProperty('--pencil-rotation', `${pencilRotation}deg`);
});
//#endregion

//#region Initialization Methods (Defined)
function settupPrevPageClick(page: HTMLElement, url: URL): void {
  page.addEventListener('click', () => {
    queueNavigation(url, 'push', false);
  });
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
      () => toggleEnvelope(true)
    );
  }
  if (PENCIL_WRAPPER && PENCIL) {
    registerMovableElement(
      PENCIL_WRAPPER,
      PENCIL,
      MOVEMENT_AXES.HORIZONTAL | MOVEMENT_AXES.VERTICAL,
      [50, 70],
      [0.5, 0.5],
      undefined
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
      toggleThemeMode
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
    [0, -1, 1, 0]
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
