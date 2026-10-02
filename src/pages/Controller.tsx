import {
  DPad,
  FaceButtons,
  MicroButton,
  ShoulderStrip,
  Stick,
} from "@/components/controller/controls";
import { Slider } from "@/components/ui/slider";
import { api } from "@/convex/_generated/api";
import {
  BUTTON_BITS,
  type ButtonId,
  type InputFrame,
  type PadSettings,
  DEFAULT_SETTINGS,
  clamp,
  frameSignature,
  loadSettings,
  normalizeCode,
  saveSettings,
} from "@/lib/controller";
import { ControllerLink } from "@/lib/peer";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Loader2,
  Settings2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

type Mode = "connecting" | "rtc" | "relay";

function deviceLabel() {
  if (typeof navigator === "undefined") return "Controller";
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : "device";
  const form = /iPad|Tablet/i.test(ua)
    ? "Tablet"
    : /Mobile|Android/i.test(ua)
      ? "Phone"
      : "Laptop";
  return `${form} · ${os}`;
}

/* ── Join screen ──────────────────────────────────────────── */

function Join({
  error,
  onJoin,
  busy,
}: {
  error: string | null;
  onJoin: (code: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = (next: string) => {
    const code = normalizeCode(next);
    setValue(code);
    if (code.length === 4) onJoin(code);
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <Link to="/" className="absolute left-5 top-5 text-muted-foreground">
        <ArrowLeft className="size-4" />
      </Link>

      <img src={logo} alt="" className="size-10 rounded-[9px]" />
      <p className="micro mt-6 text-muted-foreground">Nullpad</p>
      <h1 className="mt-3 text-center text-2xl font-medium tracking-[-0.03em]">
        Enter the room code
      </h1>
      <p className="mt-2 max-w-xs text-center text-[13px] leading-relaxed text-muted-foreground">
        It is the four characters showing on the console.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
        className="mt-8 w-full max-w-[19rem]"
      >
        <input
          autoFocus
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={4}
          value={value}
          onChange={(event) => submit(event.target.value)}
          aria-label="Room code"
          placeholder="····"
          className={cn(
            "h-20 w-full rounded-lg border bg-foreground/[0.04] text-center font-mono text-4xl tracking-[0.42em] text-foreground outline-none transition-colors",
            error ? "border-destructive" : "border-border focus:border-foreground/50",
          )}
        />

        {error && (
          <p className="mt-3 text-center text-[13px] text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={value.length < 4 || busy}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-foreground text-sm font-medium text-background transition-opacity disabled:opacity-40"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Connect
        </button>
      </form>

      <p className="mt-8 max-w-xs text-center text-[12px] leading-relaxed text-muted-foreground">
        No account, no install. Open the console on your computer to get a code.
      </p>
      <Link
        to="/dashboard"
        className="micro mt-5 text-muted-foreground underline-offset-4 hover:underline"
      >
        Open the console
      </Link>
    </div>
  );
}

/* ── Pad ──────────────────────────────────────────────────── */

export default function Controller() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<PadSettings>(() => loadSettings());
  const [mode, setMode] = useState<Mode>("connecting");
  const [latency, setLatency] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const code = normalizeCode(searchParams.get("room") ?? "");
  const activeCode = code.length === 4 ? code : null;

  const controllerIdRef = useRef(
    `pad-${Math.random().toString(36).slice(2, 10)}`,
  );
  const labelRef = useRef(deviceLabel());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const modeRef = useRef<Mode>("connecting");
  const linkRef = useRef<ControllerLink | null>(null);
  const relayRef = useRef<((args: {
    code: string;
    controllerId: string;
    frame: InputFrame;
  }) => Promise<unknown>) | null>(null);
  const beatRef = useRef<
    ((args: { code: string; rtt: number }) => Promise<unknown>) | null
  >(null);
  const transportRef = useRef<
    ((args: {
      code: string;
      transport: "rtc" | "relay";
    }) => Promise<unknown>) | null
  >(null);
  const rttRef = useRef<number | null>(null);
  const joinedRef = useRef<string | null>(null);
  const baselineRef = useRef<number | null>(null);

  const inputRef = useRef({
    held: new Set<ButtonId>(),
    lx: 0,
    ly: 0,
    rx: 0,
    ry: 0,
    lt: 0,
    rt: 0,
    tiltX: 0,
    tiltY: 0,
    dpad: { up: false, down: false, left: false, right: false },
  });

  const joinRoom = useMutation(api.rooms.join);
  const setControllerSdp = useMutation(api.rooms.setControllerSdp);
  const addControllerCandidate = useMutation(api.rooms.addControllerCandidate);
  const setTransport = useMutation(api.rooms.setTransport);
  const relay = useMutation(api.rooms.relay);
  const beat = useMutation(api.rooms.beat);

  relayRef.current = relay;
  beatRef.current = beat;
  transportRef.current = setTransport;

  const room = useQuery(api.rooms.byCode, activeCode ? { code: activeCode } : "skip");

  /** True only once this phone has actually claimed the room, so the peer
   *  link is never created before the room will accept its signalling. */
  const claimed =
    Boolean(activeCode) && room?.controllerId === controllerIdRef.current;

  const setModeBoth = useCallback((next: Mode) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const update = useCallback((patch: Partial<typeof inputRef.current>) => {
    Object.assign(inputRef.current, patch);
  }, []);

  const haptic = useCallback((duration = 8) => {
    if (!settingsRef.current.haptics) return;
    try {
      navigator.vibrate?.(duration);
    } catch {
      /* unsupported */
    }
  }, []);

  const press = useCallback(
    (id: ButtonId) => {
      inputRef.current.held.add(id);
      haptic(8);
    },
    [haptic],
  );

  const release = useCallback((id: ButtonId) => {
    inputRef.current.held.delete(id);
  }, []);

  const setSettings = useCallback((next: PadSettings) => {
    settingsRef.current = next;
    setSettingsState(next);
    saveSettings(next);
  }, []);

  /* ── leave / invalid room ───────────────────────────────── */
  const leave = useCallback(() => {
    linkRef.current?.close();
    linkRef.current = null;
    joinedRef.current = null;
    setModeBoth("connecting");
    setLatency(null);
    const next = new URLSearchParams(searchParams);
    next.delete("room");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, setModeBoth]);

  useEffect(() => {
    if (!activeCode) return;
    if (room === null) {
      const timer = setTimeout(() => {
        setError("No room with that code");
        leave();
      }, 700);
      return () => clearTimeout(timer);
    }
    if (room && room.status === "closed") {
      const timer = setTimeout(() => {
        setError("That room has closed");
        leave();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeCode, room, leave]);

  /* ── peer link ──────────────────────────────────────────── */
  useEffect(() => {
    if (!activeCode || !claimed) return;
    const controllerId = controllerIdRef.current;
    setModeBoth("connecting");

    const link = new ControllerLink({
      onLocalSdp: (sdp) => {
        void setControllerSdp({ code: activeCode, controllerId, sdp });
      },
      onLocalCandidate: (candidate) => {
        void addControllerCandidate({ code: activeCode, candidate });
      },
      onFrame: () => undefined,
      onControl: (message) => {
        if (message.k === "p" && typeof message.r === "number") {
          const rtt = Date.now() - message.r;
          rttRef.current = rtt;
          setLatency(rtt);
        }
      },
      onOpen: () => {
        setModeBoth("rtc");
        transportRef.current?.({
          code: activeCode,
          transport: "rtc",
        });
      },
      onClose: () => {
        if (modeRef.current === "rtc") setModeBoth("connecting");
      },
    });
    linkRef.current = link;

    const fallback = setTimeout(() => {
      if (link.isOpen) return;
      setModeBoth("relay");
      transportRef.current?.({ code: activeCode, transport: "relay" });
    }, 7000);

    return () => {
      clearTimeout(fallback);
      link.close();
      linkRef.current = null;
    };
  }, [activeCode, claimed, setControllerSdp, addControllerCandidate, setModeBoth]);  const seenRef = useRef(new Set<string>());
  useEffect(() => {
    if (!claimed || !room) return;
    if (room.hostSDP) {
      void linkRef.current?.acceptRemoteSdp(room.hostSDP);
    }
    const link = linkRef.current;
    if (!link) return;
    for (const candidate of room.hostCandidates ?? []) {
      if (seenRef.current.has(candidate)) continue;
      seenRef.current.add(candidate);
      link.addRemoteCandidate(candidate);
    }
  }, [claimed, room]);

  /* ── join once the room resolves ────────────────────────── */
  useEffect(() => {
    if (!activeCode || !room) return;
    if (room.status === "closed") return;
    if (room.controllerId === controllerIdRef.current) return;
    if (joinedRef.current === activeCode) return;
    joinedRef.current = activeCode;
    void joinRoom({
      code: activeCode,
      controllerId: controllerIdRef.current,
      controllerLabel: labelRef.current,
    }).catch(() => {
      joinedRef.current = null;
      setError("Could not join that room");
      leave();
    });
  }, [activeCode, room, joinRoom, leave]);

  /* ── out of frame: release everything on the host ───────── */
  const releaseAll = useCallback(() => {
    const input = inputRef.current;
    input.held.clear();
    input.lx = 0;
    input.ly = 0;
    input.rx = 0;
    input.ry = 0;
    input.lt = 0;
    input.rt = 0;
    input.dpad = { up: false, down: false, left: false, right: false };
  }, []);

  /* ── outbound loop ──────────────────────────────────────── */
  useEffect(() => {
    let raf = 0;
    let lastSend = 0;
    let lastSignature = "";
    let lastReport = 0;
    let seq = 0;

    const tick = (time: number) => {
      raf = requestAnimationFrame(tick);
      const input = inputRef.current;
      const current = settingsRef.current;

      let b = 0;
      for (const id of input.held) b |= BUTTON_BITS[id];
      if (input.dpad.up) b |= BUTTON_BITS.dup;
      if (input.dpad.down) b |= BUTTON_BITS.ddown;
      if (input.dpad.left) b |= BUTTON_BITS.dleft;
      if (input.dpad.right) b |= BUTTON_BITS.dright;
      if (input.lt > 0.4) b |= BUTTON_BITS.l2;
      if (input.rt > 0.4) b |= BUTTON_BITS.r2;
      if (current.turbo && Math.floor(time / 95) % 2 === 1) {
        b &= ~(
          BUTTON_BITS.a |
          BUTTON_BITS.b |
          BUTTON_BITS.x |
          BUTTON_BITS.y
        );
      }

      const gain = current.sensitivity;
      const gx = clamp(Math.round(input.tiltX * 127), -127, 127);
      const gy = clamp(
        Math.round((current.invertY ? -1 : 1) * input.tiltY * 127),
        -127,
        127,
      );
      let rx = clamp(Math.round(input.rx * 127 * gain), -127, 127);
      let ry = clamp(Math.round(input.ry * 127 * gain), -127, 127);
      if (current.tilt && Math.hypot(rx, ry) < 12) {
        rx = gx;
        ry = gy;
      }

      const frame: InputFrame = {
        seq,
        b,
        lx: clamp(Math.round(input.lx * 127 * gain), -127, 127),
        ly: clamp(Math.round(input.ly * 127 * gain), -127, 127),
        rx,
        ry,
        lt: clamp(Math.round(input.lt * 255), 0, 255),
        rt: clamp(Math.round(input.rt * 255), 0, 255),
        gx,
        gy,
        t: Date.now(),
      };

      const link = linkRef.current;
      const currentMode = modeRef.current;

      if (currentMode === "rtc" && link?.isOpen) {
        if (time - lastSend >= 14) {
          lastSend = time;
          seq += 1;
          frame.seq = seq;
          link.sendFrame(frame);
        }
        return;
      }

      if (currentMode === "relay" && activeCode) {
        const signature = frameSignature(frame);
        const changed = signature !== lastSignature;
        const due = time - lastSend;
        if ((changed && due >= 45) || due >= 400) {
          lastSend = time;
          lastSignature = signature;
          seq += 1;
          frame.seq = seq;
          const started = Date.now();
          void relayRef
            .current?.({
              code: activeCode,
              controllerId: controllerIdRef.current,
              frame,
            })
            .then(() => {
              if (time - lastReport < 2000) return;
              lastReport = time;
              const measured = Date.now() - started;
              rttRef.current = measured;
              setLatency(measured);
              void beatRef.current?.({ code: activeCode, rtt: measured });
            })
            .catch(() => undefined);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeCode]);

  /* ── ping + heartbeat ───────────────────────────────────── */
  useEffect(() => {
    if (!activeCode) return;
    const ping = setInterval(() => {
      if (modeRef.current !== "rtc") return;
      linkRef.current?.sendPing(Date.now());
    }, 1000);

    const heart = setInterval(() => {
      if (modeRef.current !== "rtc") return;
      if (rttRef.current === null) return;
      void beatRef.current?.({ code: activeCode, rtt: rttRef.current });
    }, 2000);

    return () => {
      clearInterval(ping);
      clearInterval(heart);
    };
  }, [activeCode]);

  /* ── wake lock ──────────────────────────────────────────── */
  useEffect(() => {
    const wake = (
      navigator as Navigator & {
        wakeLock?: {
          request: (type: "screen") => Promise<{ release?: () => Promise<void> }>;
        };
      }
    ).wakeLock;
    if (!wake) return;
    let sentinel: { release?: () => Promise<void> } | null = null;
    const acquire = () => {
      void wake
        .request("screen")
        .then((lock) => {
          sentinel = lock;
        })
        .catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release?.();
    };
  }, []);

  /* ── lock the page while playing ────────────────────────── */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overscrollBehavior = previousOverscroll;
      releaseAll();
    };
  }, [releaseAll]);

  /* ── tilt ───────────────────────────────────────────────── */
  const tiltHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(
    null,
  );

  const enableTilt = useCallback(async () => {
    if (typeof DeviceOrientationEvent === "undefined") return false;
    const ctor = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    if (typeof ctor.requestPermission === "function") {
      try {
        const result = await ctor.requestPermission();
        if (result !== "granted") return false;
      } catch {
        return false;
      }
    }
    if (!tiltHandlerRef.current) {
      const handler = (event: DeviceOrientationEvent) => {
        if (event.gamma === null || event.beta === null) return;
        if (baselineRef.current === null) baselineRef.current = event.beta;
        inputRef.current.tiltX = clamp(event.gamma / 40, -1, 1);
        inputRef.current.tiltY = clamp(
          (event.beta - baselineRef.current) / 40,
          -1,
          1,
        );
      };
      tiltHandlerRef.current = handler;
    }
    window.addEventListener(
      "deviceorientation",
      tiltHandlerRef.current,
      true,
    );
    baselineRef.current = null;
    return true;
  }, []);

  const disableTilt = useCallback(() => {
    if (tiltHandlerRef.current) {
      window.removeEventListener(
        "deviceorientation",
        tiltHandlerRef.current,
        true,
      );
    }
    inputRef.current.tiltX = 0;
    inputRef.current.tiltY = 0;
  }, []);

  useEffect(() => () => disableTilt(), [disableTilt]);

  const toggleTilt = async () => {
    if (settings.tilt) {
      setSettings({ ...settings, tilt: false });
      disableTilt();
      return;
    }
    const ok = await enableTilt();
    if (ok) setSettings({ ...settings, tilt: true });
  };

  const switchCluster = () => {
    inputRef.current.dpad = { up: false, down: false, left: false, right: false };
    inputRef.current.lx = 0;
    inputRef.current.ly = 0;
    setSettings({
      ...settings,
      leftCluster: settings.leftCluster === "stick" ? "dpad" : "stick",
    });
    haptic(6);
  };

  /* ── render ─────────────────────────────────────────────── */
  if (activeCode && room === undefined) {
    return (
      <div className="dark pad-root fixed inset-0 flex flex-col items-center justify-center gap-4">
        <Loader2 className="size-5 animate-spin text-foreground" />
        <p className="micro text-muted-foreground">Room {activeCode}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            leave();
          }}
          className="micro text-muted-foreground underline-offset-4 hover:underline"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (!activeCode || !room) {
    return (
      <div className="dark pad-root fixed inset-0 overflow-y-auto">
        <Join
          error={error}
          busy={Boolean(activeCode)}
          onJoin={(next) => {
            setError(null);
            const params = new URLSearchParams(searchParams);
            params.set("room", next);
            setSearchParams(params, { replace: true });
          }}
        />
      </div>
    );
  }

  const connected = mode !== "connecting";

  return (
    <div className="dark pad-root fixed inset-0 flex flex-col overflow-hidden">
      {/* header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            leave();
          }}
          aria-label="Leave room"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[13px] tracking-[0.24em]">{room.code}</span>
          <span className="h-3 w-px bg-border" />
          <span
            className={cn(
              "size-1.5 rounded-full",
              mode === "rtc"
                ? "bg-foreground"
                : mode === "relay"
                  ? "bg-foreground/50"
                  : "animate-pulse bg-foreground/30",
            )}
          />
          <span className="micro text-muted-foreground">
            {mode === "rtc" ? "peer" : mode === "relay" ? "relay" : "linking"}
          </span>
          <span className="tnum font-mono text-[11px] text-muted-foreground">
            {latency === null ? "--" : latency} ms
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Pad settings"
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <Settings2 className="size-4" />
        </button>
      </header>

      {/* pad */}
      <main className="relative flex min-h-0 flex-1 flex-col justify-between gap-4 p-3">
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <div className="space-y-2">
            <ShoulderStrip
              label="L1"
              analog={false}
              onDown={() => press("l1")}
              onUp={() => release("l1")}
            />
            <ShoulderStrip
              label="L2"
              analog
              onChange={(value) => update({ lt: value })}
              onDown={() => haptic(6)}
              onUp={() => undefined}
            />
          </div>
          <div className="space-y-2">
            <ShoulderStrip
              label="R1"
              analog={false}
              onDown={() => press("r1")}
              onUp={() => release("r1")}
            />
            <ShoulderStrip
              label="R2"
              analog
              onChange={(value) => update({ rt: value })}
              onDown={() => haptic(6)}
              onUp={() => undefined}
            />
          </div>
        </div>

        <div className="flex min-h-0 items-end justify-between gap-3">
          <div className="flex flex-col items-start gap-2">
            {settings.leftCluster === "stick" ? (
              <Stick
                name="Left stick"
                onChange={(x, y) => update({ lx: x, ly: y })}
              />
            ) : (
              <DPad
                onChange={(state) => update({ dpad: state })}
              />
            )}
            <button
              type="button"
              onClick={switchCluster}
              className="micro text-muted-foreground transition-colors hover:text-foreground"
            >
              {settings.leftCluster === "stick" ? "D-pad" : "Stick"}
            </button>
          </div>

          <div className="flex flex-col items-end gap-2">
            <FaceButtons onDown={press} onUp={release} />
            <span className="micro text-muted-foreground">
              {settings.turbo ? "Turbo on" : "A · B · X · Y"}
            </span>
          </div>
        </div>

        {!connected && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
            <Loader2 className="size-5 animate-spin text-foreground" />
            <p className="text-[15px] text-foreground">
              Pairing with the console…
            </p>
            <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              Both devices need to reach each other. Same Wi-Fi is enough — if
              they cannot, the relay takes over in a moment.
            </p>              <button
                type="button"
                onClick={() => {
                  setError(null);
                  leave();
                }}
                className="micro text-muted-foreground underline-offset-4 hover:underline"
              >
                Cancel
              </button>
          </div>
        )}
      </main>

      {/* footer */}
      <footer className="flex h-14 shrink-0 items-center justify-between border-t border-border px-4">
        <MicroButton
          label="Select"
          onDown={() => press("select")}
          onUp={() => release("select")}
        />
        <span className="micro text-muted-foreground">{labelRef.current}</span>
        <MicroButton
          label="Start"
          onDown={() => press("start")}
          onUp={() => release("start")}
        />
      </footer>

      {/* settings sheet */}
      {sheetOpen && (
        <div            className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-border bg-background pb-8">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-5 py-4">
              <span className="micro text-foreground">Pad settings</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-7 px-5 pt-5">
              <div>
                <div className="micro mb-3 text-muted-foreground">
                  Left cluster
                </div>
                <div className="flex gap-2">
                  <MicroButton
                    label="Stick"
                    active={settings.leftCluster === "stick"}
                    onClick={() =>
                      setSettings({ ...settings, leftCluster: "stick" })
                    }
                  />
                  <MicroButton
                    label="D-pad"
                    active={settings.leftCluster === "dpad"}
                    onClick={() =>
                      setSettings({ ...settings, leftCluster: "dpad" })
                    }
                  />
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="micro text-muted-foreground">
                    Sensitivity
                  </span>
                  <span className="tnum font-mono text-[11px] text-muted-foreground">
                    {settings.sensitivity.toFixed(2)}×
                  </span>
                </div>
                <Slider
                  value={[settings.sensitivity]}
                  min={0.4}
                  max={1.8}
                  step={0.05}
                  onValueChange={([value]) =>
                    setSettings({ ...settings, sensitivity: value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <MicroButton
                  label="Turbo"
                  active={settings.turbo}
                  onClick={() =>
                    setSettings({ ...settings, turbo: !settings.turbo })
                  }
                />
                <MicroButton
                  label="Haptics"
                  active={settings.haptics}
                  onClick={() =>
                    setSettings({ ...settings, haptics: !settings.haptics })
                  }
                />
                <MicroButton
                  label="Tilt"
                  active={settings.tilt}
                  onClick={() => void toggleTilt()}
                />
                <MicroButton
                  label="Invert Y"
                  active={settings.invertY}
                  onClick={() =>
                    setSettings({ ...settings, invertY: !settings.invertY })
                  }
                />
              </div>

              <div className="border-t border-border pt-5">
                <div className="micro mb-3 text-muted-foreground">Keymap</div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  This pad sends raw input — sticks, buttons, triggers and tilt.
                  The console owns the mapping and turns them into keystrokes,
                  so edit it there rather than here.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSettings({ ...DEFAULT_SETTINGS });
                  haptic(12);
                }}
                className="h-11 w-full rounded-md border border-border text-[13px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                Reset pad settings
              </button>

              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  setError(null);
                  leave();
                }}
                className="h-11 w-full rounded-md border border-destructive/40 text-[13px] text-destructive transition-colors hover:bg-destructive/10"
              >
                Leave room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function inputSnapshotUnused() {
  return null;
}
