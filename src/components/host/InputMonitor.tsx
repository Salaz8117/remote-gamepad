import {
  BUTTON_BITS,
  BUTTONS,
  BUTTON_LABELS,
  type InputFrame,
} from "@/lib/controller";
import { cn } from "@/lib/utils";

function StickPlot({
  label,
  x,
  y,
}: {
  label: string;
  x: number;
  y: number;
}) {
  const cx = 50 + (x / 127) * 34;
  const cy = 50 + (y / 127) * 34;
  const active = Math.abs(x) > 6 || Math.abs(y) > 6;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="micro text-muted-foreground">{label}</span>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {x >= 0 ? "+" : ""}
          {x} / {y >= 0 ? "+" : ""}
          {y}
        </span>
      </div>
      <div className="relative aspect-square w-full max-w-[8.5rem] rounded-md border border-border bg-background">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
          <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
          <circle cx="50" cy="50" r="17" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.1" />
        </svg>
        <span
          className={cn(
            "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
            active ? "bg-foreground" : "bg-muted-foreground/50",
          )}
          style={{ left: `${cx}%`, top: `${cy}%` }}
        />
      </div>
    </div>
  );
}

function TriggerBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 255) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="micro text-muted-foreground">{label}</span>
        <span className="tnum font-mono text-[10px] text-muted-foreground">
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-border bg-background">
        <div
          className="h-full bg-foreground transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function InputMonitor({
  frame,
  activeKeys,
}: {
  frame: InputFrame;
  activeKeys: Set<string>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-5">
        <StickPlot label="Left" x={frame.lx} y={frame.ly} />
        <StickPlot label="Right" x={frame.rx} y={frame.ry} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TriggerBar label="L2" value={frame.lt} />
        <TriggerBar label="R2" value={frame.rt} />
      </div>

      <div>
        <div className="micro mb-2.5 text-muted-foreground">Buttons</div>
        <div className="flex flex-wrap gap-1.5">
          {BUTTONS.map((id) => {
            const on = (frame.b & BUTTON_BITS[id]) !== 0;
            return (
              <span
                key={id}
                className={cn(
                  "inline-flex h-6 items-center rounded-md border px-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {BUTTON_LABELS[id]}
              </span>
            );
          })}
        </div>
      </div>

      <div>
        <div className="micro mb-2 text-muted-foreground">Sent to desktop</div>
        <div className="rounded-md border border-border bg-background px-3 py-3 font-mono text-[12px] leading-relaxed">
          {activeKeys.size > 0 ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {[...activeKeys].map((code) => (
                <span key={code} className="rounded bg-muted px-1.5 py-0.5">
                  {code}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">idle</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
        {[
          ["Tilt X", frame.gx],
          ["Tilt Y", frame.gy],
          ["Frame", frame.seq],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <div className="micro text-muted-foreground">{label}</div>
            <div className="tnum mt-1.5 font-mono text-[15px]">
              {value === 0 ? "0" : String(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
