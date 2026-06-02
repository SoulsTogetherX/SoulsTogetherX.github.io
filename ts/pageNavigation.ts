//#region Imports
import {
  scrollToTop,
  toggleEnvelope,
  isEnvelopeClosed,
  initializePagePosition,
  settupPointerListener,
} from './envelopeHandler.js';
//#endregion

//#region Type Definitions
type NavKind = 'push' | 'pop';

type NavRequest = {
  url: URL;
  kind: NavKind;
  force: boolean;
};
//#endregion

//#region Constant Values
const PAGE_ENTERING_CLASS_NAME = 'page-is-entering';
const PAGE_EXITING_CLASS_NAME = 'page-is-exiting';
//#endregion

//#region Public Queries
let inertMain: HTMLElement | null;
let currentMain = document.querySelector('main') as HTMLElement | null;
//#endregion

//#region Public Variables
let busy = false;

let pendingNav: NavRequest | null = null;
let navSeq = 0;
//#endregion

//#region Event Listeners
document.addEventListener(
  'click',
  (event) => {
    const target = event.target as Element | null;
    const anchor = target?.closest('a') as HTMLAnchorElement | null;

    if (
      !anchor ||
      !isInternalLink(anchor) ||
      isModifierClick(event as MouseEvent)
    ) {
      return;
    }

    event.preventDefault();

    const url = new URL(anchor.href);
    if (url.href === location.href) {
      toggleEnvelope(true);
      return;
    }

    queueNavigation(url, 'push', isEnvelopeClosed());
    toggleEnvelope(true);
  },
  true
);

window.addEventListener('popstate', () => {
  queueNavigation(new URL(location.href), 'pop', isEnvelopeClosed());
});
//#endregion

//#region Public Methods (Checker Helpers)
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

function waitForEvent(
  el: HTMLElement,
  type: keyof HTMLElementEventMap
): Promise<void> {
  return new Promise((resolve) => {
    el.addEventListener(type, () => resolve(), { once: true });
  });
}
//#endregion

//#region Public Methods (Document)
async function fetchDocument(url: string): Promise<Document> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, 'text/html');
}

function buildIncomingMain(nextDoc: Document): HTMLElement {
  const next = nextDoc.querySelector('main');
  if (!next) {
    throw new Error('Missing main in fetched page');
  }

  const incoming = document.createElement('main');
  incoming.innerHTML = next.innerHTML;

  incoming.removeAttribute('id');

  if (next.className) {
    incoming.className = next.className;
  }

  return incoming;
}

async function transitionMain(nextDoc: Document): Promise<void> {
  if (!currentMain) {
    throw new Error('Missing current main');
  }

  const parent = currentMain.parentElement;
  if (!parent) {
    throw new Error('Missing main parent element');
  }

  inertMain?.remove();
  scrollToTop();

  const incoming = buildIncomingMain(nextDoc);
  parent.insertBefore(incoming, currentMain);
  initializePagePosition(incoming);

  incoming.classList.add(PAGE_ENTERING_CLASS_NAME);
  currentMain.classList.add(PAGE_EXITING_CLASS_NAME);

  await waitForEvent(incoming, 'animationend');

  incoming.classList.remove(PAGE_ENTERING_CLASS_NAME);

  inertMain = currentMain;
  inertMain.inert = true;
  inertMain.setAttribute('aria-hidden', 'true');
  currentMain = incoming;

  settupPointerListener(currentMain);
}
function forceMain(nextDoc: Document): void {
  if (!currentMain) {
    throw new Error('Missing current main');
  }

  const parent = currentMain.parentElement;
  if (!parent) {
    throw new Error('Missing parent element for main');
  }

  const incoming = buildIncomingMain(nextDoc);
  parent.insertBefore(incoming, currentMain.nextSibling);
  initializePagePosition(incoming);

  currentMain.remove();
  currentMain = incoming;

  settupPointerListener(currentMain);
}
//#endregion

//#region Public Methods (Navigation)
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

    if (req.url.href === location.href) {
      return;
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
      pendingNav = null;
      await runNavigation(next);
    }

    busy = false;
  }
}
//#endregion

//#region Export Methods
export function getCurrentPage(): HTMLElement | undefined {
  return currentMain?.getElementsByTagName('section')[0];
}

export function isBusy(): boolean {
  return busy;
}
//#endregion

//#region Export Methods
initializePagePosition(currentMain);
settupPointerListener(currentMain);
//#endregion
