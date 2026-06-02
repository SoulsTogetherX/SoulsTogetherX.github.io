import { waitForEvent, getCurrentPage, isBusy } from './pageNavigation.js';

//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';

const PAGE_DRAGGING_CLASSNAME = 'page-dragging';
const PAGE_SCROLLING_CLASSNAME = 'page-scrolling';
const PAGE_SCROLL_TIMEOUt = 100;
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Public Variables
let currentPageOffsetY: number = 0;
let lastPageY: number = 0;

let pointerId: number | undefined = undefined;
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
  console.trace();
}

export function settupPointerListener(page: HTMLElement | null): void {
  if (!page) {
    return;
  }

  let wheelEventEndTimeout: number | undefined = undefined;
  setToDefaultOffet(page);

  window.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (isBusy()) {
        return;
      }

      page.classList.add(PAGE_SCROLLING_CLASSNAME);
      setPageOffsetDirect(page, currentPageOffsetY - event.deltaY * 0.5);

      clearTimeout(wheelEventEndTimeout);
      wheelEventEndTimeout = setTimeout(() => {
        page.classList.remove(PAGE_SCROLLING_CLASSNAME);
        wheelEventEndTimeout = undefined;
      }, PAGE_SCROLL_TIMEOUt);
    },
    false
  );

  page.addEventListener('pointerdown', (event: PointerEvent) => {
    if (pointerId === undefined) {
      pointerId = event.pointerId;
    }
    if (isBusy() || pointerId !== event.pointerId) {
      return;
    }

    page.setPointerCapture(event.pointerId);
    page.classList.add(PAGE_DRAGGING_CLASSNAME);

    lastPageY = event.pageY;

    page.addEventListener('pointermove', onPointerMove);
    page.addEventListener(
      'pointerup',
      () => {
        page.removeEventListener('pointermove', onPointerMove);
        page.classList.remove(PAGE_DRAGGING_CLASSNAME);
        pointerId = undefined;
      },
      { once: true }
    );
  });
}
//#endregion
//#endregion

//#region Pointer Helper Methods
function onPointerMove(event: PointerEvent): void {
  if (isBusy() || pointerId !== event.pointerId) {
    return;
  }

  const page = event.currentTarget as HTMLElement;
  setPageOffsetDirect(page, currentPageOffsetY + event.pageY - lastPageY);
  lastPageY = event.pageY;
}
function setToDefaultOffet(page: HTMLElement): void {
  setPageOffsetDirect(
    page,
    page.getBoundingClientRect().height - window.innerHeight * 0.2
  );
}

function setPageOffsetDirect(page: HTMLElement, direct: number): void {
  const height: number = page.getBoundingClientRect().height;
  const upperbound: number = Math.max(
    page.offsetHeight,
    ENVELOPE?.offsetHeight ?? 0
  );

  currentPageOffsetY = Math.max(Math.min(direct, upperbound), 0);
  page.style.setProperty('--page-offset-y', `${currentPageOffsetY - height}px`);
}
//#endregion

//#region Exported Methods
export function toggleEnvelope(toggle: boolean) {
  if (!ENVELOPE) {
    return;
  }

  if (toggle) {
    if (!ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME)) {
      waitForEvent(ENVELOPE, 'transitionend').then(() => {
        const page = getCurrentPage();
        if (page) {
          initializePagePosition(page);
          settupPointerListener(page);
        }
      });

      ENVELOPE.classList.add(ACTIVE_ENVELOPE_CLASSNAME);
    }
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

export function scrollToTop(): void {
  const page: HTMLElement | null = getCurrentPage();
  if (!page) {
    return;
  }
  setToDefaultOffet(page);
}
//#endregion
