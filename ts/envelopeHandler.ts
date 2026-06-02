//#region Imports
import { getCurrentPage, isBusy } from './pageNavigation.js';
//#endregion

//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';
const NO_SELECT_CLASSNAME = 'no-select';

const DRAG_THRESHOLD_PX = 6;
const TOUCH_HOLD_MS = 180;
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Public Variables
let latestY: number = 0;
let startY: number = 0;

let holdTimer: number | null = null;
let pointerId: number | null = null;
let rafId = 0;

let isDragging: boolean = false;
let pendingDrag: boolean = false;

let currentOffset = 0;
let startDragX = 0;
let startDragY = 0;
//#endregion

//#region Private Global Variables
let currentPage: HTMLElement | undefined;
let envelopeHeight: number;
//#endregion

//#region Listeners
ENVELOPE_BG?.addEventListener('click', (_: Event) => {
  toggleEnvelope(false);
});
ENVELOPE?.addEventListener('click', (_: Event) => {
  toggleEnvelope(true);
});

window.addEventListener('wheel', (event) => {
  setGlobalVariables();
  applyOffset(-event.deltaY * 0.5);
});

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);
window.addEventListener('lostpointercapture', () => {
  cancelHold();
  isDragging = false;
  pointerId = null;
  document.body.style.userSelect = '';
});
//#endregion

//#region Internal Helper Methods
function setGlobalVariables(): void {
  currentPage = getCurrentPage();
  envelopeHeight = ENVELOPE?.offsetHeight ?? Infinity;
}
function applyOffset(deltaY: number): void {
  if (!currentPage) {
    return;
  }

  currentOffset = Math.min(
    Math.max(
      currentOffset + deltaY,
      -currentPage.offsetHeight + 0.8 * envelopeHeight
    ),
    0
  );

  currentPage.style.transform = `translateY(${currentOffset}px)`;
}

function schedulePointerUpdate(): void {
  if (rafId !== 0) {
    return;
  }

  rafId = requestAnimationFrame(() => {
    rafId = 0;

    if (!isDragging || isBusy() || isEnvelopeClosed()) {
      return;
    }

    const deltaY = latestY - startY;
    startY = latestY;

    applyOffset(deltaY);
  });
}

function scrollHelper(
  frameInterpolate: number,
  frameDelta: number,
  targetStartHeight: number,
  target: HTMLElement
): void {
  if (frameInterpolate > 0) {
    requestAnimationFrame(() =>
      scrollHelper(
        frameInterpolate - frameDelta,
        frameDelta,
        targetStartHeight,
        target
      )
    );
  }

  applyOffset(targetStartHeight * frameDelta);
}
//#endregion

//#region Pointer Helper Methods
function cancelHold(): void {
  if (holdTimer !== null) {
    window.clearTimeout(holdTimer);
    holdTimer = null;
  }

  currentPage?.classList.remove(NO_SELECT_CLASSNAME);

  isDragging = false;
  pendingDrag = false;
  pointerId = null;
  document.body.style.userSelect = '';
}
function onPointerDownHelper(event: PointerEvent): void {
  if (isBusy() || isEnvelopeClosed() || !currentPage) {
    return;
  }

  isDragging = true;
  pointerId = event.pointerId;
  startY = event.clientY;
  latestY = event.clientY;

  currentPage.setPointerCapture(event.pointerId);
  document.body.style.userSelect = 'none';
}

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || isBusy() || isEnvelopeClosed()) {
    return;
  }

  setGlobalVariables();
  if (!currentPage) {
    return;
  }

  const rect = currentPage.getBoundingClientRect();
  const isOverlapping =
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom;

  if (!isOverlapping) {
    return;
  }

  startDragX = event.clientX;
  startDragY = event.clientY;
  pendingDrag = true;

  envelopeHeight = ENVELOPE?.offsetHeight ?? Infinity;

  if (event.pointerType === 'touch') {
    cancelHold();
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      pendingDrag = false;
      onPointerDownHelper(event);
    }, TOUCH_HOLD_MS);
    return;
  }
}
function onPointerMove(event: PointerEvent): void {
  if (pointerId !== null && event.pointerId === pointerId) {
    if (!isDragging) return;

    latestY = event.clientY;
    schedulePointerUpdate();
    return;
  }

  if (!pendingDrag) {
    return;
  }

  const dx = Math.abs(event.clientX - startDragX);
  const dy = Math.abs(event.clientY - startDragY);

  if (dx >= DRAG_THRESHOLD_PX || dy >= DRAG_THRESHOLD_PX) {
    pendingDrag = false;
    if (!currentPage) return;

    currentPage.classList.add(NO_SELECT_CLASSNAME);
    onPointerDownHelper(event);
  }
}
function endPointer(event: PointerEvent): void {
  if (pointerId !== null && event.pointerId !== pointerId) {
    return;
  }
  cancelHold();
}
//#endregion

//#region Exported Methods
export function toggleEnvelope(toggle: boolean) {
  if (!ENVELOPE) {
    return;
  }

  if (toggle) {
    ENVELOPE.classList.add(ACTIVE_ENVELOPE_CLASSNAME);
    return;
  }
  scrollToTop();
  ENVELOPE.classList.remove(ACTIVE_ENVELOPE_CLASSNAME);
}

export function isEnvelopeClosed(): boolean {
  if (!ENVELOPE) {
    return true;
  }
  return !ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME);
}

export function scrollToTop(frames: number = 10): void {
  const target: HTMLElement | undefined = getCurrentPage();
  if (target == null) {
    return;
  }
  scrollHelper(1.0, 1 / frames, target.offsetHeight, target);
}
//#endregion
