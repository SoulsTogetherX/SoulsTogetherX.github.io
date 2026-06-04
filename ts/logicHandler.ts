//#region Type Defs
enum MOVEMENT_AXES {
  STATIONARY = 0b00,
  HORIZONTAL = 0b01,
  VERTICAL = 0b10,
  BOTH = 0b11,
}

type Vector2 = [number, number]; // [x, y];
type Rect2 = [number, number, number, number]; // [x, y, width, height];

type NavKind = 'push' | 'pop';

type NavRequest = {
  url: URL;
  kind: NavKind;
  force: boolean;
};

type MoveableObject = {
  root: HTMLElement;
  visual: HTMLElement;

  axes: MOVEMENT_AXES;

  collision: Rect2;
  limits?: Rect2;

  origin: Vector2;
  pos: Vector2;

  slowdownId?: number;
};
//#endregion

//#region Constant ClassNames
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';

const PAGE_ENTERING_CLASS_NAME = 'page-is-entering';
const PAGE_EXITING_CLASS_NAME = 'page-is-exiting';

const MOVING_WRAPPER_CLASS_NAME = 'moving-wrapper';
const DISABLE_MOVE_WRAPPER_CLASS_NAME = 'disable-move-wrapper';
//#endregion

//#region Constant Property Names
const TRANSLATE_OFFSET_X = '--translate-offset-x';
const TRANSLATE_OFFSET_Y = '--translate-offset-y';

const ORIGIN_OFFSET_X = '--origin-offset-x';
const ORIGIN_OFFSET_Y = '--origin-offset-y';
//#endregion

//#region Constant Values (Constants)
const BOUNCE_FACTOR = 0.1;

const SLOWDOWN_FACTOR = 0.9;
const SLOWDOWN_FLAT = 0.05;
const SLOWDOWN_THRESHOLD = 0.01;

const PAGE_STARTING_FACTOR = 0.3;
const PAGE_SCROLL_TIMEOUt = 100;

const DRAG_THRESHOLD = 2;
//#endregion

//#region Constant Values (Helper)
const FALLBACK_REDIRECTS = ['/', '/about'];

const movableObjects: Record<string, MoveableObject> = {};
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE_WAPPER = document.getElementById('envelope-wrapper');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Public Variables
let pointerId: number | undefined = undefined;

let busy: boolean = false;
let isDragging: boolean = false;

let pendingNav: NavRequest | undefined = undefined;
let navSeq: number = 0;

let pageId: number = 0;
//#endregion

//#region Public Queries
let prevMain: HTMLElement | undefined;

let currentMain: HTMLElement | undefined;
let unregisterMovableElement = () => {};
//#endregion

//#region Initialization Methods (Called)
registerAllMovableElements();
initializePages();
//#endregion

//#region Misc Methods
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

//#region Listeners
// Navigation
document.addEventListener('click', onLinkClickCheck, true);
window.addEventListener('popstate', () => {
  queueNavigation(new URL(location.href), 'pop', isEnvelopeClosed());
});

// Resize
document.addEventListener('resize', renderAllMovableElements);

// Envelope
ENVELOPE_BG?.addEventListener('click', (_) => {
  toggleEnvelope(false);
});
//#endregion

//#region Movable Rendering and Registering
function registerAllMovableElements(): void {
  if (ENVELOPE_WAPPER) {
    registerMovableElement(
      ENVELOPE_WAPPER,
      ENVELOPE_WAPPER.firstElementChild as HTMLElement,
      MOVEMENT_AXES.BOTH,
      [50, 50],
      [0.5, 0.5],
      undefined,
      () => toggleEnvelope(true)
    );
  }
  renderAllMovableElements();
}

function renderAllMovableElements(): void {
  for (const obj of Object.values(movableObjects)) {
    renderMovableElement(obj);
  }
}

function createMovableElement(
  root: HTMLElement,
  visual: HTMLElement,
  axes: MOVEMENT_AXES,
  pos: Vector2,
  origin: Vector2,
  limits: Rect2 | undefined
): MoveableObject {
  const obj: MoveableObject = {
    root,
    visual,
    limits,
    collision: [0, 0, 0, 0],
    axes,
    pos,
    origin,
  };

  renderMovableElement(obj);

  return obj;
}
function registerMovableElement(
  root: HTMLElement,
  visual: HTMLElement,
  axes: MOVEMENT_AXES,
  pos: Vector2,
  origin: Vector2,
  limits: Rect2 | undefined,
  onClick: (() => void) | undefined = undefined
): () => void {
  const obj: MoveableObject = createMovableElement(
    root,
    visual,
    axes,
    pos,
    origin,
    limits
  );

  const unregister = makeDraggable(obj, onClick);

  visual.addEventListener('resize', () => defineMovableElementCollision(obj));

  defineMovableElementOrigin(obj);
  defineMovableElementCollision(obj);

  movableObjects[root.id] = obj;
  return () => {
    visual.removeEventListener('resize', () =>
      defineMovableElementCollision(obj)
    );
    unregister();

    delete movableObjects[root.id];
  };
}

function defineMovableElementCollision(obj: MoveableObject): void {
  const visual = obj.visual;

  const posX = (visual.clientLeft / window.innerWidth) * 100;
  const posY = (visual.clientTop / window.innerHeight) * 100;
  const width = (visual.clientWidth / window.innerWidth) * 100;
  const height = (visual.clientHeight / window.innerHeight) * 100;

  obj.collision = [posX, posY, width, height];
}
function defineMovableElementOrigin(obj: MoveableObject): void {
  const style = obj.visual.style;
  style.setProperty(ORIGIN_OFFSET_X, `-${obj.origin[0] * 100}%`);
  style.setProperty(ORIGIN_OFFSET_Y, `-${obj.origin[1] * 100}%`);
}
function renderMovableElement(obj: MoveableObject): void {
  const style = obj.root.style;
  style.setProperty(TRANSLATE_OFFSET_X, `${obj.pos[0]}vw`);
  style.setProperty(TRANSLATE_OFFSET_Y, `${obj.pos[1]}vh`);
}

function moveMovableElement(
  obj: MoveableObject,
  deltaX: number,
  deltaY: number
): void {
  if (obj.axes & MOVEMENT_AXES.HORIZONTAL) {
    obj.pos[0] += (deltaX / window.innerWidth) * 100;
  }
  if (obj.axes & MOVEMENT_AXES.VERTICAL) {
    obj.pos[1] += (deltaY / window.innerHeight) * 100;
  }
}

// [Left, Top, Right, Bottom]
function getClampLimits(obj: MoveableObject): Rect2 {
  if (obj.limits === undefined) {
    const origin = obj.origin;
    const width = obj.collision[2];
    const height = obj.collision[3];

    return [
      width * origin[0],
      height * origin[1],
      100 - width * (1.0 - origin[0]),
      100 - height * (1.0 - origin[1]),
    ];
  }

  const limits = obj.limits;
  const width = obj.collision[2];
  const height = obj.collision[3];

  return [
    width * limits[0],
    height * limits[1],
    width * limits[2],
    height * limits[3],
  ];
}
function clampMovableElement(obj: MoveableObject, limits: Rect2): void {
  obj.pos[0] = Math.max(limits[0], Math.min(obj.pos[0], limits[2]));
  obj.pos[1] = Math.max(limits[1], Math.min(obj.pos[1], limits[3]));
}
//#endregion

//#region Movable Logic
function makeDraggable(
  obj: MoveableObject,
  onClick: (() => void) | undefined = undefined
): () => void {
  const pos = obj.root;
  const visual = obj.visual;

  let prevX = 0,
    prevY = 0;
  let lastDeltaX = 0,
    lastDeltaY = 0;

  function onPointerDown(e: PointerEvent) {
    if (isDragging) {
      return;
    }
    if (pos.classList.contains(DISABLE_MOVE_WRAPPER_CLASS_NAME)) {
      return;
    }

    cancelSlowdown(obj);

    prevX = e.pageX;
    prevY = e.pageY;
    lastDeltaX = 0;
    lastDeltaY = 0;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancle', onCancle);
    document.body.addEventListener('pointerleave', onCancle);
  }
  function onPointerMove(e: PointerEvent) {
    lastDeltaX = e.pageX - prevX;
    lastDeltaY = e.pageY - prevY;
    prevX = e.pageX;
    prevY = e.pageY;

    if (!isDragging) {
      if (Math.abs(lastDeltaX) + Math.abs(lastDeltaY) < DRAG_THRESHOLD) {
        return;
      }
      pos.classList.add(MOVING_WRAPPER_CLASS_NAME);
      isDragging = true;
    }

    moveMovableElement(obj, lastDeltaX, lastDeltaY);
    clampMovableElement(obj, getClampLimits(obj));
    renderMovableElement(obj);
  }
  function onPointerUp() {
    if (!isDragging && onClick) {
      onClick();
    }

    onSlowdown(obj, getClampLimits(obj), lastDeltaX, lastDeltaY);
    clearBehavior();
  }

  function onCancle() {
    pos.classList.remove(MOVING_WRAPPER_CLASS_NAME);
    clearBehavior();
  }
  function clearBehavior() {
    isDragging = false;

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancle', onCancle);
    document.body.removeEventListener('pointerleave', onCancle);
  }

  visual.addEventListener('pointerdown', onPointerDown);

  return () => {
    visual.removeEventListener('pointerdown', onPointerDown);
    clearBehavior();
  };
}
//#endregion

//#region Movable Slowdown Logic
function onSlowdown(
  obj: MoveableObject,
  limits: Rect2,
  velcX: number,
  velcY: number
): void {
  if (Math.abs(velcX) + Math.abs(velcY) < SLOWDOWN_THRESHOLD) {
    cancelSlowdown(obj);
    return;
  }

  if (velcX > 0) {
    velcX = Math.max(0, velcX - SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  } else if (velcX < 0) {
    velcX = Math.min(0, velcX + SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  }
  if (velcY > 0) {
    velcY = Math.max(0, velcY - SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  } else if (velcY < 0) {
    velcY = Math.min(0, velcY + SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  }

  moveMovableElement(obj, velcX, velcY);
  clampMovableElement(obj, limits);
  renderMovableElement(obj);

  if (obj.pos[0] === limits[0] || obj.pos[0] === limits[2]) {
    velcX *= -BOUNCE_FACTOR;
  }
  if (obj.pos[1] === limits[1] || obj.pos[1] === limits[3]) {
    velcY *= -BOUNCE_FACTOR;
  }

  obj.slowdownId = requestAnimationFrame(() => {
    onSlowdown(obj, limits, velcX, velcY);
  });
}
function cancelSlowdown(obj: MoveableObject) {
  if (obj.slowdownId) {
    cancelAnimationFrame(obj.slowdownId);
  }

  obj.root.classList.remove(MOVING_WRAPPER_CLASS_NAME);
  obj.slowdownId = undefined;
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

function buildIncomingMain(nextDoc: Document): HTMLElement {
  const next = nextDoc.querySelector('main');
  if (!next) {
    throw new Error('Missing main in fetched page');
  }

  const incoming = document.createElement('main');
  incoming.innerHTML = next.innerHTML;

  incoming.setAttribute('id', `page-${pageId}`);
  pageId += 1;

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

  prevMain?.remove();

  const incoming = buildIncomingMain(nextDoc);
  parent.insertBefore(incoming, currentMain);

  unregisterMovableElement();
  unregisterMovableElement = initializePage(incoming);

  incoming.classList.add(PAGE_ENTERING_CLASS_NAME);
  currentMain.classList.add(PAGE_EXITING_CLASS_NAME);

  await waitForEvent(incoming, 'animationend');

  incoming.classList.remove(PAGE_ENTERING_CLASS_NAME);

  prevMain = currentMain;
  prevMain.setAttribute('aria-hidden', 'true');
  currentMain = incoming;
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

  unregisterMovableElement();
  unregisterMovableElement = initializePage(incoming);

  prevMain = currentMain;
  prevMain.setAttribute('aria-hidden', 'true');
  currentMain = incoming;
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
  if (url.href === location.href) {
    toggleEnvelope(true);
    return;
  }

  queueNavigation(url, 'push', isEnvelopeClosed());
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

    if (req.url.href === location.href) {
      return;
    }

    scrollPage(currentMain, 0);

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
function scrollPage(page: HTMLElement | undefined, posY: number): void {
  if (!page) {
    return;
  }

  const obj = movableObjects[page.id];
  if (obj) {
    obj.pos[1] = posY;
    renderMovableElement(obj);
  }
}

function toggleEnvelope(toggle: boolean): void {
  if (!ENVELOPE || !ENVELOPE_WAPPER) {
    return;
  }

  if (toggle) {
    if (!ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME)) {
      scrollPage(currentMain, -30);

      prevMain?.classList.add('animation-delay');
      currentMain?.classList.add('animation-delay');

      waitForEvent(ENVELOPE, 'transitionend').then(() => {
        prevMain?.classList.remove('animation-delay');
        currentMain?.classList.remove('animation-delay');
      });
    }

    ENVELOPE_WAPPER.classList.add(DISABLE_MOVE_WRAPPER_CLASS_NAME);
    cancelSlowdown(movableObjects[ENVELOPE_WAPPER.id]);

    if (!ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME)) {
      ENVELOPE.classList.add(ACTIVE_ENVELOPE_CLASSNAME);
    }
    return;
  }

  ENVELOPE_WAPPER.classList.remove(DISABLE_MOVE_WRAPPER_CLASS_NAME);
  ENVELOPE.classList.remove(ACTIVE_ENVELOPE_CLASSNAME);
}
function isEnvelopeClosed(): boolean {
  if (!ENVELOPE) {
    return true;
  }

  return !ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME);
}
//#endregion

//#region Initialization Methods (Defined)
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
  currentMain = document.querySelector('main') as HTMLElement | undefined;

  if (!currentMain) {
    throw new Error('Missing current main');
  }

  const parent = currentMain.parentElement;
  if (!parent) {
    throw new Error('Missing parent element for main');
  }

  const pathname =
    FALLBACK_REDIRECTS[
      FALLBACK_REDIRECTS[0] !== window.location.pathname ? 0 : 1
    ];
  const nextDoc = await fetchDocument(pathname);

  prevMain = buildIncomingMain(nextDoc);
  parent.insertBefore(prevMain, currentMain);

  unregisterMovableElement = initializePage(currentMain);
  initializePage(prevMain, false);

  prevMain.setAttribute('aria-hidden', 'true');
}

//#endregion
