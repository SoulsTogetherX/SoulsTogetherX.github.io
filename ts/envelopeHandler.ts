import { getCurrentPage, isBusy } from './pageNavigation.js';

//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';

const PAGE_DRAGGING_CLASSNAME = 'page-dragging';
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Public Variables
let currentPagePos: number = 0;
let lastPageY: number = 0;
//#endregion

//#region Listeners
//#region Envelope Listeners
ENVELOPE_BG?.addEventListener('click', (_: Event) => {
  toggleEnvelope(false);
});
ENVELOPE?.addEventListener('click', (_: Event) => {
  toggleEnvelope(true);
});
//#endregion

//#region Page Movement Listeners
export function initializePagePosition(page: HTMLElement | null): void {
  if (!page) {
    return;
  }

  const height = page.getBoundingClientRect().height;
  const startPos = height - window.innerHeight * 0.2;
  setPageOffsetDirect(page, startPos);
}

export function settupPointerListener(page: HTMLElement | null): void {
  if (!page) {
    return;
  }

  setPageOffsetDirect(
    page,
    page.getBoundingClientRect().height - window.innerHeight * 0.2
  );

  page.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      setPageOffsetDirect(page, currentPagePos - event.deltaY * 0.5);
    },
    false
  );

  page.addEventListener('pointerdown', (event: PointerEvent) => {
    page.setPointerCapture(event.pointerId);
    page.classList.add(PAGE_DRAGGING_CLASSNAME);

    lastPageY = event.pageY;

    page.addEventListener('pointermove', setPageOffset);
    page.addEventListener(
      'pointerup',
      () => {
        page.classList.remove(PAGE_DRAGGING_CLASSNAME);
        page.removeEventListener('pointermove', setPageOffset);
      },
      { once: true }
    );
  });
}
//#endregion
//#endregion

//#region Pointer Helper Methods
function setPageOffset(event: PointerEvent): void {
  const page = event.currentTarget as HTMLElement;
  setPageOffsetDirect(page, currentPagePos + event.pageY - lastPageY);
  lastPageY = event.pageY;
}

function setPageOffsetDirect(page: HTMLElement, direct: number): void {
  const height: number = page.getBoundingClientRect().height;
  const upperbound: number = Math.max(
    page.offsetHeight,
    ENVELOPE?.offsetHeight ?? 0
  );

  currentPagePos = Math.max(Math.min(direct, upperbound), 0);
  console.log(currentPagePos);
  page.style.setProperty('--page-offset-y', `${currentPagePos - height}px`);
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

export function scrollToTop(frames: number = 10): void {}
//#endregion
