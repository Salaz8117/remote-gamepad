import { prettyCode } from "@/components/host/KeymapEditor";
import { type Keymap } from "@/lib/controller";
import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "ready" | "playing" | "over";

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  spin: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}
interface World {
  w: number;
  h: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  dashCd: number;
  dashT: number;
  fireCd: number;
  prevDash: boolean;
  bullets: Bullet[];
  shards: Shard[];
  parts: Particle[];
  spawnIn: number;
  elapsed: number;
  score: number;
}

const INK = "#0a0a0a";
const PAPER = "#fcfcfc";
const BEST_KEY = "nullpad.arena.best";

const makeWorld = (): World => ({
  w: 0,
  h: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  dashCd: 0,
  dashT: 0,
  fireCd: 0,
  prevDash: false,
  bullets: [],
  shards: [],
  parts: [],
  spawnIn: 1.2,
  elapsed: 0,
  score: 0,
});

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function Arena({ keymap }: { keymap: Keymap }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World>(makeWorld());
  const keysRef = useRef<Set<string>>(new Set());
  const keymapRef = useRef(keymap);
  const phaseRef = useRef<Phase>("ready");
  const scoreRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  keymapRef.current = keymap;

  useEffect(() => setBest(readBest()), []);

  const start = useCallback(() => {
    const previous = worldRef.current;
    const w = makeWorld();
    w.w = previous.w;
    w.h = previous.h;
    w.px = previous.w / 2;
    w.py = previous.h / 2;
    worldRef.current = w;
    scoreRef.current = 0;
    setScore(0);
    phaseRef.current = "playing";
    setPhase("playing");
  }, []);

  const end = useCallback(() => {
    phaseRef.current = "over";
    setPhase("over");
    const final = worldRef.current.score;
    if (final > readBest()) {
      try {
        localStorage.setItem(BEST_KEY, String(final));
      } catch {
        /* ignore */
      }
      setBest(final);
    }
  }, []);

  /* ── input ─────────────────────────────────────────────── */
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const km = keymapRef.current;
      const startCode = km.buttons.start || "Enter";
      const shootCode = km.buttons.a || "Space";

      if (event.code === startCode || event.code === shootCode) {
        if (phaseRef.current !== "playing") {
          event.preventDefault();
          start();
          return;
        }
      }
      if (phaseRef.current === "playing") {
        if (
          event.code === "Space" ||
          event.code.startsWith("Arrow") ||
          event.code.startsWith("Key")
        ) {
          event.preventDefault();
        }
      }
      keysRef.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => keysRef.current.delete(event.code);
    const blur = () => keysRef.current.clear();

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [start]);

  /* ── loop ──────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const world = worldRef.current;
      const first = world.w === 0;
      world.w = w;
      world.h = h;
      if (first) {
        world.px = w / 2;
        world.py = h / 2;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const spawnShard = (world: World) => {
      const edge = Math.floor(Math.random() * 4);
      const margin = 26;
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = Math.random() * world.w;
        y = -margin;
      } else if (edge === 1) {
        x = world.w + margin;
        y = Math.random() * world.h;
      } else if (edge === 2) {
        x = Math.random() * world.w;
        y = world.h + margin;
      } else {
        x = -margin;
        y = Math.random() * world.h;
      }
      const toward = Math.atan2(world.py - y, world.px - x);
      const jitter = (Math.random() - 0.5) * 0.7;
      const speed = 68 + Math.min(96, world.elapsed * 1.7) + Math.random() * 26;
      const r = 9 + Math.random() * 8;
      world.shards.push({
        x,
        y,
        vx: Math.cos(toward + jitter) * speed,
        vy: Math.sin(toward + jitter) * speed,
        r,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 1.6,
      });
    };

    const burst = (world: World, x: number, y: number) => {
      for (let i = 0; i < 9; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 40 + Math.random() * 130;
        world.parts.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 0.45,
          max: 0.45,
        });
      }
    };

    const axis = (negative: string[], positive: string[]) => {
      const keys = keysRef.current;
      let value = 0;
      for (const code of negative) if (keys.has(code)) value -= 1;
      for (const code of positive) if (keys.has(code)) value += 1;
      return value;
    };

    const step = (dt: number) => {
      const world = worldRef.current;
      if (world.w === 0) return;
      const km = keymapRef.current;
      const playing = phaseRef.current === "playing";

      const mx = axis(
        [km.leftStick.left],
        [km.leftStick.right],
      );
      const my = axis([km.leftStick.up], [km.leftStick.down]);
      const ax = axis(
        [km.rightStick.left],
        [km.rightStick.right],
      );
      const ay = axis([km.rightStick.up], [km.rightStick.down]);

      const mag = Math.hypot(mx, my);
      const nx = mag > 0 ? mx / mag : 0;
      const ny = mag > 0 ? my / mag : 0;

      if (ax !== 0 || ay !== 0) world.angle = Math.atan2(ay, ax);
      else if (mag > 0) world.angle = Math.atan2(ny, nx);

      const dashDown = keysRef.current.has(km.buttons.b || "ShiftLeft");
      if (playing) {
        if (dashDown && !world.prevDash && world.dashCd <= 0 && mag > 0) {
          world.dashT = 0.17;
          world.dashCd = 1.15;
        }
        world.prevDash = dashDown;

        const speed = world.dashT > 0 ? 660 : 250;
        world.vx = nx * speed;
        world.vy = ny * speed;
        world.px += world.vx * dt;
        world.py += world.vy * dt;

        const pad = 12;
        world.px = Math.max(pad, Math.min(world.w - pad, world.px));
        world.py = Math.max(pad, Math.min(world.h - pad, world.py));

        world.dashCd = Math.max(0, world.dashCd - dt);
        world.dashT = Math.max(0, world.dashT - dt);

        world.fireCd -= dt;
        if (keysRef.current.has(km.buttons.a || "Space") && world.fireCd <= 0) {
          world.fireCd = 0.15;
          const dx = Math.cos(world.angle);
          const dy = Math.sin(world.angle);
          world.bullets.push({
            x: world.px + dx * 15,
            y: world.py + dy * 15,
            vx: dx * 540,
            vy: dy * 540,
            life: 1.1,
          });
        }

        world.elapsed += dt;
        world.spawnIn -= dt;
        if (world.spawnIn <= 0) {
          world.spawnIn = Math.max(0.5, 1.5 - world.elapsed * 0.012);
          spawnShard(world);
        }
      }

      for (const bullet of world.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
      }
      world.bullets = world.bullets.filter(
        (b) =>
          b.life > 0 &&
          b.x > -20 &&
          b.y > -20 &&
          b.x < world.w + 20 &&
          b.y < world.h + 20,
      );

      for (const shard of world.shards) {
        shard.x += shard.vx * dt;
        shard.y += shard.vy * dt;
        shard.rot += shard.spin * dt;
      }

      for (const part of world.parts) {
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        part.vx *= 0.94;
        part.vy *= 0.94;
        part.life -= dt;
      }
      world.parts = world.parts.filter((p) => p.life > 0);

      if (!playing) return;

      // bullets × shards
      world.shards = world.shards.filter((shard) => {
        for (let i = 0; i < world.bullets.length; i++) {
          const bullet = world.bullets[i];
          if (bullet.life <= 0) continue;
          if (Math.hypot(bullet.x - shard.x, bullet.y - shard.y) < shard.r + 3) {
            bullet.life = 0;
            burst(world, shard.x, shard.y);
            world.score += 10;
            if (world.score !== scoreRef.current) {
              scoreRef.current = world.score;
              setScore(world.score);
            }
            return false;
          }
        }
        return true;
      });

      // player × shards
      for (let i = world.shards.length - 1; i >= 0; i--) {
        const shard = world.shards[i];
        if (Math.hypot(world.px - shard.x, world.py - shard.y) < 11 + shard.r) {
          if (world.dashT > 0) {
            burst(world, shard.x, shard.y);
            world.shards.splice(i, 1);
            world.score += 10;
            if (world.score !== scoreRef.current) {
              scoreRef.current = world.score;
              setScore(world.score);
            }
          } else {
            burst(world, world.px, world.py);
            end();
            return;
          }
        }
      }
    };

    const draw = () => {
      const world = worldRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, world.w, world.h);

      // hairline grid
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.05;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 44; x < world.w; x += 44) {
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, world.h);
      }
      for (let y = 44; y < world.h; y += 44) {
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(world.w, Math.round(y) + 0.5);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // particles
      for (const part of world.parts) {
        ctx.globalAlpha = Math.max(0, part.life / part.max) * 0.8;
        ctx.fillStyle = INK;
        ctx.fillRect(part.x - 1.5, part.y - 1.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      // shards
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      for (const shard of world.shards) {
        ctx.save();
        ctx.translate(shard.x, shard.y);
        ctx.rotate(shard.rot);
        ctx.globalAlpha = 0.85;
        ctx.strokeRect(-shard.r, -shard.r, shard.r * 2, shard.r * 2);
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // bullets
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (const bullet of world.bullets) {
        ctx.moveTo(bullet.x, bullet.y);
        ctx.lineTo(bullet.x - bullet.vx * 0.014, bullet.y - bullet.vy * 0.014);
      }
      ctx.stroke();

      // player
      ctx.save();
      ctx.translate(world.px, world.py);
      if (world.dashT > 0) {
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = INK;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.restore();

      // aim line
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(
        world.px + Math.cos(world.angle) * 13,
        world.py + Math.sin(world.angle) * 13,
      );
      ctx.lineTo(
        world.px + Math.cos(world.angle) * 34,
        world.py + Math.sin(world.angle) * 34,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        step(dt);
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [end]);

  const bindings = [
    [
      keymap.leftStick.up,
      keymap.leftStick.left,
      keymap.leftStick.down,
      keymap.leftStick.right,
    ]
      .map(prettyCode)
      .join(" "),
    `${prettyCode(keymap.buttons.a)} fire`,
    `${prettyCode(keymap.buttons.b)} dash`,
    `${prettyCode(keymap.buttons.start)} restart`,
  ];

  return (
    <div>
      <div className="flex items-baseline justify-between pb-3">
        <div className="flex items-baseline gap-5">
          <span className="micro text-muted-foreground">Score</span>
          <span className="tnum font-mono text-2xl font-medium">
            {String(score).padStart(3, "0")}
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="micro text-muted-foreground">Best</span>
          <span className="tnum font-mono text-sm text-muted-foreground">
            {String(best).padStart(3, "0")}
          </span>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-md border border-border"
        style={{ background: PAPER }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {phase !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/70 px-6 text-center backdrop-blur-[2px]">
            <p className="max-w-sm text-[15px] leading-relaxed text-foreground">
              {phase === "ready"
                ? "A small arena you can drive from your phone the moment it pairs."
                : `Run ended at ${score}.`}
            </p>
            <button
              type="button"
              onClick={start}
              className="inline-flex h-10 items-center rounded-md bg-foreground px-5 text-[13px] font-medium text-background transition-opacity hover:opacity-85"
            >
              {phase === "ready" ? "Start run" : "Try again"}
            </button>
            <p className="micro text-muted-foreground">
              {phase === "ready"
                ? "or press start on the pad"
                : "press start or fire to replay"}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        {bindings.map((binding) => (
          <span key={binding} className="font-mono">
            {binding}
          </span>
        ))}
      </div>
    </div>
  );
}
