import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DEFAULT_KEYMAP,
  type AxisKeys,
  type ButtonId,
  type Keymap,
  BUTTONS,
  BUTTON_LABELS,
} from "@/lib/controller";
import { cn } from "@/lib/utils";
import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

const DIRECTIONS: { key: keyof AxisKeys; glyph: string; label: string }[] = [
  { key: "up", glyph: "↑", label: "Up" },
  { key: "down", glyph: "↓", label: "Down" },
  { key: "left", glyph: "←", label: "Left" },
  { key: "right", glyph: "→", label: "Right" },
];

/** A key readout that rebinds itself: click, then press any key. */
function KeyChip({
  value,
  onChange,
  glyph,
}: {
  value: string;
  onChange: (next: string) => void;
  glyph?: string;
}) {
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === "Escape") {
        setCapturing(false);
        return;
      }
      onChange(event.code);
      setCapturing(false);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [capturing, onChange]);

  return (
    <button
      type="button"
      onClick={() => setCapturing(true)}
      onBlur={() => setCapturing(false)}
      title="Click, then press a key"
      className={cn(
        "inline-flex h-7 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-md border px-2 font-mono text-[11px] transition-colors",
        capturing
          ? "border-foreground bg-foreground text-background"
          : value
            ? "border-border bg-background hover:border-foreground/40"
            : "border-dashed border-border text-muted-foreground hover:border-foreground/40",
      )}
    >
      {glyph && <span className="text-[12px] opacity-60">{glyph}</span>}
      {capturing ? "press…" : value ? prettyCode(value) : "none"}
    </button>
  );
}

export function prettyCode(code: string): string {
  if (!code) return "none";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `N${code.slice(6)}`;
  if (code.startsWith("Arrow")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "ShiftLeft") return "L-Shift";
  if (code === "ShiftRight") return "R-Shift";
  if (code === "ControlLeft") return "L-Ctrl";
  if (code === "ControlRight") return "R-Ctrl";
  if (code === "AltLeft") return "L-Alt";
  if (code === "AltRight") return "R-Alt";
  return code;
}

export function KeymapEditor({
  keymap,
  onChange,
}: {
  keymap: Keymap;
  onChange: (next: Keymap) => void;
}) {
  const [copied, setCopied] = useState(false);

  const setAxis = (
    side: "leftStick" | "rightStick",
    dir: keyof AxisKeys,
    code: string,
  ) => onChange({ ...keymap, [side]: { ...keymap[side], [dir]: code } });

  const setButton = (id: ButtonId, code: string) =>
    onChange({ ...keymap, buttons: { ...keymap.buttons, [id]: code } });

  const exportJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(keymap, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Axes */}
      <div>
        <div className="micro text-muted-foreground">Axes</div>
        <div className="mt-4 space-y-4">
          {(["leftStick", "rightStick"] as const).map((side) => (
            <div key={side}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[13px] font-medium">
                  {side === "leftStick" ? "Left stick" : "Right stick"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  digitalised at threshold
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DIRECTIONS.map(({ key, glyph, label }) => (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    <span className="w-4 text-center text-[13px] text-muted-foreground">
                      {glyph}
                    </span>
                    <KeyChip
                      value={keymap[side][key]}
                      onChange={(code) => setAxis(side, key, code)}
                    />
                    <span className="sr-only">{label}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] font-medium">Dead zone</span>
              <span className="tnum font-mono text-[11px] text-muted-foreground">
                {(keymap.deadzone * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[keymap.deadzone * 100]}
              min={0}
              max={45}
              step={1}
              onValueChange={([v]) =>
                onChange({ ...keymap, deadzone: v / 100 })
              }
            />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] font-medium">Threshold</span>
              <span className="tnum font-mono text-[11px] text-muted-foreground">
                {(keymap.threshold * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[keymap.threshold * 100]}
              min={10}
              max={90}
              step={1}
              onValueChange={([v]) =>
                onChange({ ...keymap, threshold: v / 100 })
              }
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div>
        <div className="flex items-center justify-between">
          <div className="micro text-muted-foreground">Buttons</div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
              onClick={exportJson}
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : null}
              {copied ? "Copied" : "Copy JSON"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
              onClick={() => onChange(structuredClone(DEFAULT_KEYMAP))}
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
          {BUTTONS.map((id) => {
            const value = keymap.buttons[id];
            return (
              <div
                key={id}
                className="flex items-center justify-between gap-3 border-t border-border py-2"
              >
                <span className="text-[13px] text-muted-foreground">
                  {BUTTON_LABELS[id]}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <KeyChip value={value} onChange={(code) => setButton(id, code)} />
                  <button
                    type="button"
                    aria-label={`Clear ${BUTTON_LABELS[id]}`}
                    onClick={() => setButton(id, "")}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted-foreground">
          Click a chip and press the key you want that input to send. Escape
          cancels a capture. The arena above reads this map live.
        </p>
      </div>
    </div>
  );
}
