import { clamp, type ButtonId } from "@/lib/controller";
import { cn } from "@/lib/utils";
import { useRef, useState, type PointerEvent } from "react";

/**
 * Touch primitives for the pad. Every control keeps its own visual state and
 * reports only semantic changes upward, so dragging a stick never re-renders
 * the page.
 */

const PLATE =
  "relative rounded-full border border-border bg-foreground/[0.04] pad-hit";

/* ── Analog stick ─────────────────────────────────────────── */

export function Stick({
  name,
  onChange,
}: {
  name: string;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const travel = Math.max(24, rect.width / 2 - rect.width * 0.19);
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const distance = Math.hypot(dx, dy);
    const scale = distance > travel ? travel / distance : 1;
    const x = dx * scale;
    const y = dy * scale;
    setKnob({ x, y });
    onChange(x / travel, y / travel);
  };

  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    setActive(true);
    update(event);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    update(event);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={ref}
      role="button"
      aria-label={name}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        PLATE,
        "aspect-square w-[min(42vw,30vh,11.5rem)] touch-none select-none",
        active && "border-foreground/40",
      )}
    >
      {/* travel ring */}
      <span
        aria-hidden
        className="absolute rounded-full border border-dashed border-border"
        style={{ inset: "19%" }}
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-px w-6 -translate-x-1/2 -translate-y-1/2 bg-border"
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-border"
      />
      {/* knob */}
      <span
        aria-hidden
        className={cn(
          "absolute left-1/2 top-1/2 flex items-center justify-center rounded-full transition-[width,height] duration-150",
          "bg-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.06)]",
          active ? "h-[38%] w-[38%]" : "h-[34%] w-[34%]",
        )}
        style={{
          transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
        }}
      >
        <span className="size-1 rounded-full bg-background/70" />
      </span>
    </div>
  );
}

/* ── Directional pad ──────────────────────────────────────── */

export function DPad({
  onChange,
}: {
  onChange: (state: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const [dir, setDir] = useState({ up: false, down: false, left: false, right: false });

  const update = (event: PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    const next = {
      up: dy < -0.28,
      down: dy > 0.28,
      left: dx < -0.28,
      right: dx > 0.28,
    };
    setDir(next);
    onChange(next);
  };

  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    update(event);
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    update(event);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    const next = { up: false, down: false, left: false, right: false };
    setDir(next);
    onChange(next);
  };

  const arms = [
    { key: "up", glyph: "▲", cls: "left-1/2 top-[6%] -translate-x-1/2" },
    { key: "down", glyph: "▼", cls: "left-1/2 bottom-[6%] -translate-x-1/2" },
    { key: "left", glyph: "◀", cls: "left-[6%] top-1/2 -translate-y-1/2" },
    { key: "right", glyph: "▶", cls: "right-[6%] top-1/2 -translate-y-1/2" },
  ] as const;

  return (
    <div
      ref={ref}
      role="button"
      aria-label="Directional pad"
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        PLATE,
        "aspect-square w-[min(42vw,30vh,11.5rem)] touch-none select-none",
        (dir.up || dir.down || dir.left || dir.right) && "border-foreground/40",
      )}
    >
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-border"
      />
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/70"
      />
      {arms.map((arm) => (
        <span
          key={arm.key}
          aria-hidden
          className={cn(
            "absolute text-[11px] leading-none transition-colors",
            arm.cls,
            dir[arm.key] ? "text-foreground" : "text-border",
          )}
        >
          {arm.glyph}
        </span>
      ))}
    </div>
  );
}

/* ── Face buttons ─────────────────────────────────────────── */

const FACE: { id: ButtonId; label: string; cls: string }[] = [
  { id: "y", label: "Y", cls: "left-1/2 top-[4%] -translate-x-1/2" },
  { id: "x", label: "X", cls: "left-[4%] top-1/2 -translate-y-1/2" },
  { id: "a", label: "A", cls: "left-1/2 bottom-[4%] -translate-x-1/2" },
  { id: "b", label: "B", cls: "right-[4%] top-1/2 -translate-y-1/2" },
];

export function FaceButtons({
  onDown,
  onUp,
}: {
  onDown: (id: ButtonId) => void;
  onUp: (id: ButtonId) => void;
}) {
  const [held, setHeld] = useState<Set<ButtonId>>(new Set());

  const press = (id: ButtonId, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHeld((prev) => new Set(prev).add(id));
    onDown(id);
  };

  const release = (id: ButtonId, event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setHeld((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onUp(id);
  };

  return (
    <div className="relative aspect-square w-[min(46vw,32vh,12.5rem)]">
      {FACE.map((button) => {
        const down = held.has(button.id);
        return (
          <button
            key={button.id}
            type="button"
            aria-label={button.id.toUpperCase()}
            onPointerDown={(event) => press(button.id, event)}
            onPointerUp={(event) => release(button.id, event)}
            onPointerCancel={(event) => release(button.id, event)}
            onContextMenu={(event) => event.preventDefault()}
            className={cn(
              "absolute flex h-[36%] w-[36%] items-center justify-center rounded-full border font-mono text-[13px] transition-[transform,background-color,border-color] duration-100 pad-hit select-none",
              down
                ? "scale-95 border-foreground bg-foreground text-background"
                : "border-border bg-foreground/[0.05] text-muted-foreground",
              button.cls,
            )}
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Analog shoulder strip ────────────────────────────────── */

export function ShoulderStrip({
  label,
  analog,
  onChange,
  onDown,
  onUp,
}: {
  label: string;
  analog: boolean;
  onChange?: (value: number) => void;
  onDown: () => void;
  onUp: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const originRef = useRef(0);
  const [level, setLevel] = useState(0);

  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    originRef.current = event.clientY;
    setLevel(analog ? 0.45 : 1);
    if (analog) onChange?.(0.45);
    onDown();
  };

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId || !analog) return;
    const element = ref.current;
    if (!element) return;
    const height = element.getBoundingClientRect().height || 60;
    const value = clamp(
      0.45 + (event.clientY - originRef.current) / (height * 0.75),
      0,
      1,
    );
    setLevel(value);
    onChange?.(value);
  };

  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    setLevel(0);
    if (analog) onChange?.(0);
    onUp();
  };

  return (
    <div
      ref={ref}
      role="button"
      aria-label={label}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        "relative overflow-hidden rounded-md border border-border bg-foreground/[0.04] pad-hit select-none",
        "h-[clamp(2rem,6vh,2.75rem)]",
        analog && "h-[clamp(2.75rem,9vh,4rem)]",
        level > 0 && "border-foreground/40",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-foreground/85 transition-[height] duration-75"
        style={{ height: `${level * 100}%` }}
      />
      <span
        className={cn(
          "relative z-10 flex h-full items-center justify-center font-mono text-[11px] tracking-[0.18em] transition-colors",
          level > 0.35 ? "text-background" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Small utility button ─────────────────────────────────── */

export function MicroButton({
  label,
  active,
  onClick,
  onDown,
  onUp,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  onDown?: () => void;
  onUp?: () => void;
}) {
  const [held, setHeld] = useState(false);
  const lit = active || held;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={
        onDown
          ? (event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setHeld(true);
              onDown();
            }
          : undefined
      }
      onPointerUp={
        onUp
          ? () => {
              setHeld(false);
              onUp();
            }
          : undefined
      }
      onPointerCancel={
        onUp
          ? () => {
              setHeld(false);
              onUp();
            }
          : undefined
      }
      className={cn(
        "h-9 rounded-md border px-4 font-mono text-[11px] tracking-[0.16em] uppercase transition-colors pad-hit select-none",
        lit
          ? "border-foreground bg-foreground text-background"
          : "border-border text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
