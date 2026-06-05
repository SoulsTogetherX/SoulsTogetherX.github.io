//#region Type Defs
type Vec2 = [number, number];
type Rect2 = [number, number, number, number];

export enum MOVEMENT_AXES {
  STATIONARY = 0b00,
  HORIZONTAL = 0b01,
  VERTICAL = 0b10,
  ROTATION = 0b100,
}

type MoveableObject = {
  // Elements
  root: HTMLElement;
  visual: HTMLElement;

  // Position & Velocity in viewport units
  pos: Vec2;
  vel: Vec2;

  // Origin inside the visual, from 0..1
  origin: Vec2;

  // Limits how this object may move
  axes: number;

  // Object is on another collistion space
  limits?: Rect2;

  // Other
  isDragged?: boolean;
};
//#endregion

//#region Constant ClassNames
const UNTOUCHED_CLASS_NAME = 'untouched';
//#endregion

//#region Constant Property Names
const TRANSLATE_OFFSET_X = '--translate-offset-x';
const TRANSLATE_OFFSET_Y = '--translate-offset-y';

const ORIGIN_OFFSET_X = '--origin-offset-x';
const ORIGIN_OFFSET_Y = '--origin-offset-y';
//#endregion

//#region Constants (Values)
const RESTITUTION = 0.4;

const SLOWDOWN_FACTOR = 0.9;
const SLOWDOWN_FLAT = 0.1;

const DRAG_THRESHOLD = 2;
//#endregion

//#region Constants (Holders)
const objects: MoveableObject[] = [];
//#endregion

//#region Public Variables
let pointerId: number | undefined = undefined;

let zIndex: number = 0;
//#endregion

//#region Converstion Methods
function VwToPx(vw: number): number {
  return (vw * window.innerWidth) / 100;
}

function VhToPx(vh: number): number {
  return (vh * window.innerHeight) / 100;
}
//#endregion

//#region Object Define Methods
export function createMovableElement(
  root: HTMLElement,
  visual: HTMLElement,
  axes: MOVEMENT_AXES,
  pos: Vec2,
  origin: Vec2,
  limits: Rect2 | undefined
): MoveableObject {
  const obj: MoveableObject = {
    root,
    visual,
    pos: [VwToPx(pos[0]), VhToPx(pos[1])],
    vel: [0, 0],
    origin,
    axes,
    limits,
  };

  root.classList.add(UNTOUCHED_CLASS_NAME);

  defineMovableElementOrigin(obj);
  renderMovableElement(obj);

  return obj;
}
export function registerMovableElement(
  root: HTMLElement,
  visual: HTMLElement,
  axes: MOVEMENT_AXES,
  pos: Vec2,
  origin: Vec2,
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
  objects.push(obj);

  return () => {
    unregister();

    const index = objects.findIndex((val) => val === obj);
    if (index > -1) {
      objects.splice(index, 1);
    }
  };
}

export function makeDraggable(
  obj: MoveableObject,
  onClick: (() => void) | undefined = undefined
): () => void {
  const root = obj.root;
  const visual = obj.visual;

  let prevX = 0,
    prevY = 0;
  let lastDeltaX = 0,
    lastDeltaY = 0;

  function onPointerEnter(_: PointerEvent) {
    root.style.zIndex = String(++zIndex);
  }

  function onPointerDown(e: PointerEvent) {
    if (obj.isDragged) {
      return;
    }

    if (pointerId === undefined) {
      pointerId = e.pointerId;
    } else if (pointerId !== e.pointerId) {
      return;
    }

    prevX = e.pageX;
    prevY = e.pageY;
    lastDeltaX = 0;
    lastDeltaY = 0;
    freezeObj(obj);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.body.addEventListener('pointerleave', onPointerUp);
    window.addEventListener('pointercancle', clearBehavior);
  }
  function onPointerMove(e: PointerEvent) {
    lastDeltaX = e.pageX - prevX;
    lastDeltaY = e.pageY - prevY;
    prevX = e.pageX;
    prevY = e.pageY;

    if (!obj.isDragged) {
      if (Math.abs(lastDeltaX) + Math.abs(lastDeltaY) < DRAG_THRESHOLD) {
        return;
      }
      root.classList.remove(UNTOUCHED_CLASS_NAME);
      obj.isDragged = true;
    }

    moveMovableElement(obj);
    moveMovableElementManual(obj, [lastDeltaX, lastDeltaY]);
    renderMovableElement(obj);
  }
  function onPointerUp() {
    if (!obj.isDragged) {
      if (onClick) {
        onClick();
      }
      obj.vel = [0, 0];
    } else {
      // Nice Accident. Not converting to viewport units weirdly feels good.
      obj.vel = [lastDeltaX, lastDeltaY];
    }

    clearBehavior();
  }

  function clearBehavior() {
    pointerId = undefined;
    obj.isDragged = false;

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.body.removeEventListener('pointerleave', onPointerUp);
    window.removeEventListener('pointercancle', clearBehavior);
  }

  visual.addEventListener('pointerenter', onPointerEnter);
  visual.addEventListener('pointerdown', onPointerDown);

  return () => {
    visual.removeEventListener('pointerenter', onPointerEnter);
    visual.removeEventListener('pointerdown', onPointerDown);
    clearBehavior();
  };
}

function defineMovableElementOrigin(obj: MoveableObject): void {
  const style = obj.visual.style;
  style.setProperty(ORIGIN_OFFSET_X, `-${obj.origin[0] * 100}%`);
  style.setProperty(ORIGIN_OFFSET_Y, `-${obj.origin[1] * 100}%`);
}

export function getObj(visual: HTMLElement): MoveableObject | undefined {
  return objects.find((val: MoveableObject) => {
    return val.visual == visual;
  });
}

export function makedUntouched(el: HTMLElement): void {
  el.classList.add(UNTOUCHED_CLASS_NAME);
}
//#endregion

//#region Physics
function renderMovableElement(obj: MoveableObject): void {
  const style = obj.root.style;
  style.setProperty(TRANSLATE_OFFSET_X, `${obj.pos[0]}px`);
  style.setProperty(TRANSLATE_OFFSET_Y, `${obj.pos[1]}px`);
}
function moveMovableElement(obj: MoveableObject): void {
  if (obj.axes & MOVEMENT_AXES.HORIZONTAL) {
    obj.pos[0] += obj.vel[0];
  }
  if (obj.axes & MOVEMENT_AXES.VERTICAL) {
    obj.pos[1] += obj.vel[1];
  }
}
function moveMovableElementManual(obj: MoveableObject, delta: Vec2): void {
  if (obj.axes & MOVEMENT_AXES.HORIZONTAL) {
    obj.pos[0] += delta[0];
  }
  if (obj.axes & MOVEMENT_AXES.VERTICAL) {
    obj.pos[1] += delta[1];
  }
}
function slowdownVelocity(obj: MoveableObject): void {
  if (obj.isDragged) {
    return;
  }

  const vel = obj.vel;
  if (vel[0] > 0) {
    vel[0] = Math.max(0, vel[0] - SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  } else if (vel[0] < 0) {
    vel[0] = Math.min(0, vel[0] + SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  }
  if (vel[1] > 0) {
    vel[1] = Math.max(0, vel[1] - SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  } else if (vel[1] < 0) {
    vel[1] = Math.min(0, vel[1] + SLOWDOWN_FLAT) * SLOWDOWN_FACTOR;
  }
}

export function freezeObj(obj: MoveableObject): void {
  obj.vel[0] = 0;
  obj.vel[1] = 0;
}
export function moveObjTo(
  visual: HTMLElement,
  posX: number,
  posY: number
): void {
  const obj = getObj(visual);
  if (!obj) {
    return;
  }

  obj.pos[0] = posX;
  obj.pos[1] = posY;
  obj.vel = [0, 0];

  makedUntouched(obj.root);
  renderMovableElement(obj);
}
export function shiftByPixel(visual: HTMLElement, delta: Vec2): void {
  const obj = getObj(visual);
  if (!obj) {
    return;
  }

  moveMovableElementManual(obj, [delta[0], delta[1]]);
  obj.vel = [0, 0];
}
//#endregion

//#region Collision
function getWallLimits(obj: MoveableObject): Rect2 {
  const rect = obj.visual.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (obj.limits === undefined) {
    const origin = obj.origin;
    return [
      width * origin[0],
      height * origin[1],
      window.innerWidth - width * (1.0 - origin[0]),
      window.innerHeight - height * (1.0 - origin[1]),
    ];
  }

  const limits = obj.limits;
  return [
    width * limits[0],
    height * limits[1],
    width * limits[2],
    height * limits[3],
  ];
}

function resolveWallCollision(obj: MoveableObject): void {
  const limits = getWallLimits(obj);

  if (obj.pos[0] > limits[2]) {
    obj.pos[0] = limits[2];
    obj.vel[0] = Math.abs(obj.vel[0]) * -RESTITUTION;
  } else if (obj.pos[0] < limits[0]) {
    obj.pos[0] = limits[0];
    obj.vel[0] = Math.abs(obj.vel[0]) * RESTITUTION;
  }

  if (obj.pos[1] > limits[3]) {
    obj.pos[1] = limits[3];
    obj.vel[1] = Math.abs(obj.vel[1]) * -RESTITUTION;
  } else if (obj.pos[1] < limits[1]) {
    obj.pos[1] = limits[1];
    obj.vel[1] = Math.abs(obj.vel[1]) * RESTITUTION;
  }
}

function resolveObjectCollision(a: MoveableObject, b: MoveableObject): void {
  if (a.isDragged || b.isDragged || a.limits || b.limits) {
    return;
  }

  const aRect = a.visual.getBoundingClientRect();
  const bRect = b.visual.getBoundingClientRect();

  const overlapX =
    Math.min(aRect.right, bRect.right) - Math.max(aRect.left, bRect.left);
  const overlapY =
    Math.min(aRect.bottom, bRect.bottom) - Math.max(aRect.top, bRect.top);

  if (overlapX <= 0 || overlapY <= 0) {
    return;
  }

  const centerAX = (aRect.left + aRect.right) / 2;
  const centerAY = (aRect.top + aRect.bottom) / 2;
  const centerBX = (bRect.left + bRect.right) / 2;
  const centerBY = (bRect.top + bRect.bottom) / 2;

  if (overlapX < overlapY) {
    const push = overlapX;
    const direction = centerAX < centerBX ? -1 : 1;

    a.pos[0] += (push / 2) * direction;
    b.pos[0] += (push / 2) * -direction;

    const relativeVx = b.vel[0] - a.vel[0];
    if (relativeVx * direction < 0) {
      const impulse = (-relativeVx * (1 + RESTITUTION)) / 2;
      a.vel[0] -= impulse * direction;
      b.vel[0] += impulse * direction;
    }
  } else {
    const push = overlapY;
    const direction = centerAY < centerBY ? -1 : 1;

    a.pos[1] += (push / 2) * direction;
    b.pos[1] += (push / 2) * -direction;

    const relativeVy = b.vel[1] - a.vel[1];
    if (relativeVy * direction < 0) {
      const impulse = (-relativeVy * (1 + RESTITUTION)) / 2;
      a.vel[1] -= impulse * direction;
      b.vel[1] += impulse * direction;
    }
  }
}
function resolveAllObjectCollisions(): void {
  for (let i = 0; i < objects.length; i++) {
    for (let j = i + 1; j < objects.length; j++) {
      resolveObjectCollision(objects[i], objects[j]);
    }
  }
}
//#endregion

//#region Slide
function updatePhysicsAll(): void {
  for (const obj of objects) {
    slowdownVelocity(obj);
    moveMovableElement(obj);
    resolveWallCollision(obj);
  }

  resolveAllObjectCollisions();

  for (const obj of objects) {
    renderMovableElement(obj);
  }
}

function physicsLoop(): void {
  updatePhysicsAll();
  requestAnimationFrame(() => physicsLoop());
}
physicsLoop();
//#endregion
