import { waitForEvent, getCurrentPage, isBusy } from './pageNavigation.js';

//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';

const PAGE_DRAGGING_CLASSNAME = 'page-dragging';
const PAGE_SCROLLING_CLASSNAME = 'page-scrolling';
const PAGE_SCROLL_TIMEOUt = 100;
//#endregion

//#region Constant Values (SLOWDOWN)
const BOUNCE_FACTOR = 0.4;

const SLOWDOWN_FACTOR = 0.9;
const SLOWDOWN_FLAT = 0.5;
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Public Variables
let currentPageOffsetY: number = 0;
let lastPageY: number = 0;
let lastDelta: number = 0;

let pointerId: number | undefined = undefined;
let slowdownId: number | undefined = undefined;
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

  let wheelEventEndTimeout: number | undefined = undefined;
  setToDefaultOffet(page);

  window.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      if (isBusy() || page.inert) {
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
    if (slowdownId) {
      cancelAnimationFrame(slowdownId);
    }

    page.addEventListener('pointermove', onPointerMove);
    page.addEventListener(
      'pointerup',
      () => {
        pointerId = undefined;
        page.removeEventListener('pointermove', onPointerMove);
        slowdownAnimation(page, lastDelta);
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
  lastDelta = event.pageY - lastPageY;

  setPageOffsetDirect(page, currentPageOffsetY + lastDelta);
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

function slowdownAnimation(page: HTMLElement, velocity: number): void {
  // Exit Condition
  if (Math.abs(velocity) < 0.1) {
    slowdownAnimationFinish(page);
    return;
  }

  // Slowdown
  if (velocity > 0) {
    velocity = Math.max(0, velocity - SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  } else if (velocity < 0) {
    velocity = Math.min(0, velocity + SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  }

  // Bounce
  const upperbound: number = Math.max(
    page.offsetHeight,
    ENVELOPE?.offsetHeight ?? 0
  );
  const nextPos: number = currentPageOffsetY + velocity;
  if (nextPos <= 0 || nextPos >= upperbound) {
    velocity *= -BOUNCE_FACTOR;
  }
  console.log(currentPageOffsetY);

  // Page Offset Setter
  setPageOffsetDirect(page, currentPageOffsetY + velocity);

  // Next Frame
  slowdownId = requestAnimationFrame(() => {
    slowdownAnimation(page, velocity);
  });
}
function slowdownAnimationFinish(page: HTMLElement): void {
  page.classList.remove(PAGE_DRAGGING_CLASSNAME);
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
