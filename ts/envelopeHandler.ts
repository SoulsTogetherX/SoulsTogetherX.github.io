//#region Constant Values
const ACTIVE_ENVELOPE_CLASSNAME = 'active-envelope';
//#endregion

//#region Constant Queries
const ENVELOPE_BG = document.getElementById('envelope-bg');
const ENVELOPE = document.getElementById('envelope');
//#endregion

//#region Listeners
ENVELOPE_BG?.addEventListener('click', (_: Event) => {
  toggleEnvelope(false);
});
ENVELOPE?.addEventListener('click', (_: Event) => {
  toggleEnvelope(true);
});

window.addEventListener('wheel', (event) => {
  changePagesOffset(event.deltaY);
});
//#endregion

//#region Internal Methods
function changePagesOffset(deltaY: number): void {
  const targetDivs: Array<HTMLElement> = Array.from(
    document.querySelectorAll('.sliding-div')
  );

  const envelope_height: number = ENVELOPE?.offsetHeight ?? 0;

  for (const target of targetDivs) {
    changePageOffset(deltaY, envelope_height, target);
  }
}

function changePageOffset(
  deltaY: number,
  envelopeHeight: number,
  page: HTMLElement
): void {
  const currentY: number = parseFloat(page.dataset.y || '0') - deltaY * 0.5;
  const clampedY: number = Math.min(
    Math.max(-page.offsetHeight + 0.5 * envelopeHeight, currentY),
    0
  );

  page.style.transform = `translateY(${clampedY}px)`;
  page.dataset.y = clampedY.toString();
}

function scrollHelper(
  frameInterpolate: number,
  frameDelta: number,
  targetStartHeights: number[],
  targetDivs: HTMLElement[]
): void {
  if (frameInterpolate > 0) {
    requestAnimationFrame(() =>
      scrollHelper(frameInterpolate, frameDelta, targetStartHeights, targetDivs)
    );
  }

  for (let i = 0; i < targetDivs.length; i++) {
    changePageOffset(
      targetStartHeights[i] * frameInterpolate,
      Infinity,
      targetDivs[i]
    );
  }
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
  ENVELOPE.classList.remove(ACTIVE_ENVELOPE_CLASSNAME);
}

export function isEnvelopeClosed(): boolean {
  if (!ENVELOPE) {
    return true;
  }
  return !ENVELOPE.classList.contains(ACTIVE_ENVELOPE_CLASSNAME);
}

export function scrollToTop(frames: number = 10): void {
  const targetDivs: HTMLElement[] = Array.from(
    document.querySelectorAll('.sliding-div')
  );
  const targetStartHeights: number[] = new Array(targetDivs.length);

  for (let i = 0; i < targetDivs.length; i++) {
    targetStartHeights[i] = targetDivs[i].offsetHeight;
  }

  let frameDelta: number = 1 / frames;

  scrollHelper(1.0, frameDelta, targetStartHeights, targetDivs);
}
//#endregion
