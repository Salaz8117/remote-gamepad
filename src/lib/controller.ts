/**
 * Shared vocabulary between the phone (controller) and the PC (receiver):
 * button ids, the frame shape that crosses the wire, and the keymap that
 * turns a frame into real keyboard events.
 */

export const BUTTONS = [
  "a",
  "b",
  "x",
  "y",
  "l1",
  "r1",
  "l2",
  "r2",
  "select",
  "start",
  "l3",
  "r3",
  "dup",
  "ddown",
  "dleft",
  "dright",
] as const;

export type ButtonId = (typeof BUTTONS)[number];

export const BUTTON_BITS: Record<ButtonId, number> = {
  a: 1 << 0,
  b: 1 << 1,
  x: 1 << 2,
  y: 1 << 3,
  l1: 1 << 4,
  r1: 1 << 5,
  l2: 1 << 6,
  r2: 1 << 7,
  select: 1 << 8,
  start: 1 << 9,
  l3: 1 << 10,
  r3: 1 << 11,
  dup: 1 << 12,
  ddown: 1 << 13,
  dleft: 1 << 14,
  dright: 1 << 15,
};

export const BUTTON_LABELS: Record<ButtonId, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  l1: "L1",
  r1: "R1",
  l2: "L2",
  r2: "R2",
  select: "Select",
  start: "Start",
  l3: "L3",
  r3: "R3",
  dup: "D-Up",
  ddown: "D-Down",
  dleft: "D-Left",
  dright: "D-Right",
};

/** The buttons that exist as physical clusters on the pad UI. */
export const FACE_BUTTONS: ButtonId[] = ["a", "b", "x", "y"];
export const SHOULDER_BUTTONS: ButtonId[] = ["l1", "r1", "l2", "r2"];
export const SYSTEM_BUTTONS: ButtonId[] = ["select", "start"];
export const DPAD_BUTTONS: ButtonId[] = ["dup", "ddown", "dleft", "dright"];

/** One complete controller snapshot. Whole-frame by design: latest wins, so a
 *  dropped packet on the peer channel costs nothing. */
export interface InputFrame {
  seq: number;
  b: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  lt: number;
  rt: number;
  gx: number;
  gy: number;
  t: number;
}

export const emptyFrame = (): InputFrame => ({
  seq: 0,
  b: 0,
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  lt: 0,
  rt: 0,
  gx: 0,
  gy: 0,
  t: 0,
});

export const clamp = (n: number, min: number, max: number) =>
  n < min ? min : n > max ? max : n;

export function buttonsFromMask(mask: number): ButtonId[] {
  return BUTTONS.filter((id) => (mask & BUTTON_BITS[id]) !== 0);
}

export interface AxisKeys {
  up: string;
  down: string;
  left: string;
  right: string;
}

export interface Keymap {
  /** below this the stick reports neutral */
  deadzone: number;
  /** above this an axis direction counts as a key press */
  threshold: number;
  leftStick: AxisKeys;
  rightStick: AxisKeys;
  buttons: Record<ButtonId, string>;
}

export const DEFAULT_KEYMAP: Keymap = {
  deadzone: 0.16,
  threshold: 0.42,
  leftStick: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" },
  rightStick: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
  },
  buttons: {
    a: "Space",
    b: "ShiftLeft",
    x: "KeyR",
    y: "KeyQ",
    l1: "KeyF",
    r1: "KeyE",
    l2: "KeyZ",
    r2: "KeyX",
    select: "Escape",
    start: "Enter",
    l3: "",
    r3: "",
    dup: "ArrowUp",
    ddown: "ArrowDown",
    dleft: "ArrowLeft",
    dright: "ArrowRight",
  },
};

const KEYMAP_STORAGE = "nullpad.keymap.v1";
const SETTINGS_STORAGE = "nullpad.settings.v1";

export function loadKeymap(): Keymap {
  if (typeof localStorage === "undefined") return structuredClone(DEFAULT_KEYMAP);
  try {
    const raw = localStorage.getItem(KEYMAP_STORAGE);
    if (!raw) return structuredClone(DEFAULT_KEYMAP);
    const parsed = JSON.parse(raw) as Partial<Keymap>;
    return {
      ...DEFAULT_KEYMAP,
      ...parsed,
      leftStick: { ...DEFAULT_KEYMAP.leftStick, ...parsed.leftStick },
      rightStick: { ...DEFAULT_KEYMAP.rightStick, ...parsed.rightStick },
      buttons: { ...DEFAULT_KEYMAP.buttons, ...parsed.buttons },
    };
  } catch {
    return structuredClone(DEFAULT_KEYMAP);
  }
}

export function saveKeymap(keymap: Keymap) {
  try {
    localStorage.setItem(KEYMAP_STORAGE, JSON.stringify(keymap));
  } catch {
    /* storage may be unavailable in private mode */
  }
}

export interface PadSettings {
  leftCluster: "stick" | "dpad";
  turbo: boolean;
  haptics: boolean;
  tilt: boolean;
  sensitivity: number;
  invertY: boolean;
}

export const DEFAULT_SETTINGS: PadSettings = {
  leftCluster: "stick",
  turbo: false,
  haptics: true,
  tilt: false,
  sensitivity: 1,
  invertY: false,
};

export function loadSettings(): PadSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<PadSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PadSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

const NEUTRAL = 128;

function applyAxis(
  out: Set<string>,
  x: number,
  y: number,
  axis: AxisKeys,
  deadzone: number,
  threshold: number,
) {
  const mag = Math.hypot(x, y) / NEUTRAL;
  if (mag < deadzone) return;
  const n = threshold;
  if (y < -n * NEUTRAL) out.add(axis.up);
  if (y > n * NEUTRAL) out.add(axis.down);
  if (x < -n * NEUTRAL) out.add(axis.left);
  if (x > n * NEUTRAL) out.add(axis.right);
}

/** Every keyboard code this frame wants held down right now. */
export function activeKeys(frame: InputFrame, keymap: Keymap): Set<string> {
  const out = new Set<string>();
  applyAxis(
    out,
    frame.lx,
    frame.ly,
    keymap.leftStick,
    keymap.deadzone,
    keymap.threshold,
  );
  applyAxis(
    out,
    frame.rx,
    frame.ry,
    keymap.rightStick,
    keymap.deadzone,
    keymap.threshold,
  );
  for (const id of BUTTONS) {
    if ((frame.b & BUTTON_BITS[id]) !== 0) {
      const code = keymap.buttons[id];
      if (code) out.add(code);
    }
  }
  return out;
}

const KEY_TEXT: Record<string, string> = {
  Space: " ",
  Enter: "Enter",
  Escape: "Escape",
  Tab: "Tab",
  Backspace: "Backspace",
  ArrowUp: "ArrowUp",
  ArrowDown: "ArrowDown",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  ShiftLeft: "Shift",
  ShiftRight: "Shift",
  ControlLeft: "Control",
  ControlRight: "Control",
  AltLeft: "Alt",
  AltRight: "Alt",
  MetaLeft: "Meta",
  MetaRight: "Meta",
  CapsLock: "CapsLock",
};

/** Human `key` value to accompany a `code`, so listeners reading either work. */
export function keyFromCode(code: string): string {
  if (KEY_TEXT[code]) return KEY_TEXT[code];
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return code.slice(6);
  if (code.startsWith("Bracket")) return code.slice(6);
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "'";
  if (code === "Comma") return ",";
  if (code === "Period") return ".";
  if (code === "Slash") return "/";
  if (code === "Backslash") return "\\";
  if (code === "Backquote") return "`";
  return code;
}

function fire(type: "keydown" | "keyup", code: string) {
  const event = new KeyboardEvent(type, {
    code,
    key: keyFromCode(code),
    bubbles: true,
    cancelable: true,
    repeat: false,
  });
  document.body.dispatchEvent(event);
}

/** Diff two key sets and emit the minimum number of real keyboard events. */
export function reconcileKeys(prev: Set<string>, next: Set<string>) {
  for (const code of next) {
    if (!prev.has(code)) fire("keydown", code);
  }
  for (const code of prev) {
    if (!next.has(code)) fire("keyup", code);
  }
}

export function releaseAllKeys(prev: Set<string>) {
  for (const code of prev) fire("keyup", code);
}

/** Cheap change signature used to decide whether a relay write is worth it. */
export function frameSignature(frame: InputFrame): string {
  return `${frame.b},${frame.lx},${frame.ly},${frame.rx},${frame.ry},${frame.lt},${frame.rt},${frame.gx},${frame.gy}`;
}

export const ROOM_CODE_RE = /^[A-Z2-9]{4}$/;

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[01OIL]/g, "")
    .slice(0, 4);
}
