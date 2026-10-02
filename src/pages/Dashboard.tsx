import { Arena } from "@/components/host/Arena";
import { InputMonitor } from "@/components/host/InputMonitor";
import { KeymapEditor } from "@/components/host/KeymapEditor";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  type InputFrame,
  type Keymap,
  activeKeys,
  emptyFrame,
  frameSignature,
  loadKeymap,
  reconcileKeys,
  releaseAllKeys,
  saveKeymap,
} from "@/lib/controller";
import { HostLink } from "@/lib/peer";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Check,
  Copy,
  LogOut,
  Plus,
  Radio,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

function Panel({
  title,
  meta,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-background",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="micro text-foreground">{title}</h2>
        {meta}
      </header>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

function StatusDot({ tone }: { tone: "on" | "wait" | "off" }) {
  return (
    <span className="relative flex size-2">
      <span
        className={cn(
          "absolute inline-flex size-full rounded-full",
          tone === "on" && "bg-foreground",
          tone === "wait" && "bg-muted-foreground/50",
          tone === "off" && "border border-border",
        )}
      />
      {tone === "on" && (
        <span className="relative inline-flex size-2 animate-ping rounded-full bg-foreground opacity-40" />
      )}
    </span>
  );
}

export default function Dashboard() {
  const { user, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [hostId] = useState(() => `host-${Math.random().toString(36).slice(2, 10)}`);
  const [code, setCode] = useState<string | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keymap, setKeymap] = useState<Keymap>(() => loadKeymap());
  const [monitor, setMonitor] = useState<InputFrame>(() => emptyFrame());
  const [linkEpoch, setLinkEpoch] = useState(0);

  const creatingRef = useRef(false);
  const linkRef = useRef<HostLink | null>(null);
  const seenCandidatesRef = useRef(new Set<string>());
  const remoteSdpRef = useRef<string | null>(null);
  const skipReuseRef = useRef(false);
  const lastSeqRef = useRef(-1);
  const frameRef = useRef<InputFrame>(emptyFrame());
  const keysRef = useRef<Set<string>>(new Set());
  const keymapRef = useRef(keymap);

  keymapRef.current = keymap;

  const createRoom = useMutation(api.rooms.create);
  const closeRoom = useMutation(api.rooms.close);
  const reclaimRoom = useMutation(api.rooms.reclaim);
  const setHostSdp = useMutation(api.rooms.setHostSdp);
  const addHostCandidate = useMutation(api.rooms.addHostCandidate);

  const room = useQuery(api.rooms.byCode, code ? { code } : "skip");
  const existingRoom = useQuery(
    api.rooms.activeForOwner,
    user ? { ownerId: user._id } : "skip",
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ── allocate a room ────────────────────────────────────── */
  const bootstrapRoom = useCallback(
    async (allowReuse: boolean) => {
      if (!user) {
        creatingRef.current = false;
        return;
      }
      if (allowReuse && existingRoom) {
        try {
          await reclaimRoom({
            code: existingRoom.code,
            ownerId: user._id,
            hostId,
          });
          setCode(existingRoom.code);
          creatingRef.current = false;
          return;
        } catch (error) {
          console.error("room reclaim failed, opening a fresh room", error);
        }
      }
      try {
        const next = await createRoom({ hostId, ownerId: user._id });
        setCode(next);
      } catch (error) {
        console.error("room create failed", error);
      } finally {
        creatingRef.current = false;
      }
    },
    [user, existingRoom, reclaimRoom, createRoom, hostId],
  );

  useEffect(() => {
    if (isLoading || !user || code || creatingRef.current) return;
    if (existingRoom === undefined) return;
    const allowReuse = !skipReuseRef.current;
    skipReuseRef.current = false;
    creatingRef.current = true;
    void bootstrapRoom(allowReuse);
  }, [isLoading, user, code, hostId, existingRoom, bootstrapRoom]);

  /* ── apply incoming frames ──────────────────────────────── */
  const applyFrame = useCallback((frame: InputFrame) => {
    if (frame.seq <= lastSeqRef.current) return;
    lastSeqRef.current = frame.seq;
    frameRef.current = frame;
    const next = activeKeys(frame, keymapRef.current);
    reconcileKeys(keysRef.current, next);
    keysRef.current = next;
  }, []);

  /* ── peer link ──────────────────────────────────────────── */
  useEffect(() => {
    if (!code) return;
    seenCandidatesRef.current.clear();
    lastSeqRef.current = -1;

    const link = new HostLink({
      onLocalSdp: (sdp) => {
        void setHostSdp({ code, hostId, sdp });
      },
      onLocalCandidate: (candidate) => {
        void addHostCandidate({ code, candidate });
      },
      onFrame: applyFrame,
      onControl: (message) => {
        if (message.k === "p" && typeof message.t === "number") {
          link.pong(message.t);
        }
      },
      onOpen: () => setChannelOpen(true),
      onClose: () => setChannelOpen(false),
    });
    linkRef.current = link;

    return () => {
      link.close();
      linkRef.current = null;
      setChannelOpen(false);
      releaseAllKeys(keysRef.current);
      keysRef.current = new Set();
    };
  }, [code, applyFrame, setHostSdp, addHostCandidate, linkEpoch]);

  /* A new code means a new handshake — forget the previous remote SDP. */
  useEffect(() => {
    remoteSdpRef.current = null;
  }, [code]);

  const controllerSdp = room?.controllerSDP;
  useEffect(() => {
    if (!controllerSdp || controllerSdp === remoteSdpRef.current) return;
    const link = linkRef.current;
    if (!link) return;
    remoteSdpRef.current = controllerSdp;
    if (link.appliedRemote) {
      // The phone restarted its peer link — offer again from scratch.
      setLinkEpoch((value) => value + 1);
      return;
    }
    void link.acceptRemoteSdp(controllerSdp);
  }, [controllerSdp, linkEpoch]);

  const candidates = room?.controllerCandidates;
  useEffect(() => {
    if (!candidates) return;
    const link = linkRef.current;
    if (!link) return;
    for (const candidate of candidates) {
      if (seenCandidatesRef.current.has(candidate)) continue;
      seenCandidatesRef.current.add(candidate);
      link.addRemoteCandidate(candidate);
    }
  }, [candidates, linkEpoch]);

  const relayFrame = room?.lastInput;
  useEffect(() => {
    if (relayFrame) applyFrame(relayFrame);
  }, [relayFrame, applyFrame]);

  /* ── mirror the frame for the monitor at a sane rate ────── */
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let signature = "";
    const tick = (time: number) => {
      if (time - last > 60) {
        last = time;
        const next = frameSignature(frameRef.current);
        if (next !== signature) {
          signature = next;
          setMonitor({ ...frameRef.current });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const heartbeat = room?.heartbeat;
  const stale = Boolean(heartbeat) && now - (heartbeat?.at ?? 0) > 10_000;
  useEffect(() => {
    if (stale) {
      releaseAllKeys(keysRef.current);
      keysRef.current = new Set();
      frameRef.current = emptyFrame();
      setMonitor(emptyFrame());
    }
  }, [stale]);

  useEffect(() => {
    return () => {
      releaseAllKeys(keysRef.current);
      linkRef.current?.close();
    };
  }, []);

  const handleNewCode = useCallback(async () => {
    const previous = code;
    skipReuseRef.current = true;
    setCode(null);
    if (previous) void closeRoom({ code: previous }).catch(() => undefined);
  }, [code, closeRoom]);

  const handleCopy = async () => {
    if (!pairUrl) return;
    try {
      await navigator.clipboard.writeText(pairUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleSignOut = async () => {
    if (code) void closeRoom({ code }).catch(() => undefined);
    await signOut();
    navigate("/");
  };

  const pairUrl =
    typeof window !== "undefined" && code
      ? `${window.location.origin}/controller?room=${code}`
      : "";

  const connected = Boolean(room?.controllerId);
  const linked = channelOpen || room?.transport === "relay";
  const live = connected && linked && !stale;
  const transport = channelOpen
    ? "Peer-to-peer"
    : room?.transport === "relay"
      ? "Relay"
      : connected
        ? "Connecting"
        : "Waiting";
  const rtt = heartbeat?.rtt;
  const ago = heartbeat ? Math.max(0, Math.round((now - heartbeat.at) / 1000)) : null;

  const monitorKeys = activeKeys(monitor, keymap);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="micro text-muted-foreground">Nullpad</span>
            <span aria-hidden className="h-4 w-px bg-border" />
            <span className="text-[13px] font-medium">Console</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 sm:flex">
              <StatusDot tone={live ? "on" : "wait"} />
              <span className="micro text-muted-foreground">{transport}</span>
            </span>
            {rtt !== undefined && (
              <span className="tnum font-mono text-[12px] text-muted-foreground">
                {rtt} ms
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="h-8 gap-2 px-2 text-[12px] text-muted-foreground"
            >
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl space-y-5 px-5 py-6 sm:px-8 sm:py-8">
        {/* Pairing */}
        <Panel
          title="Pair"
          className="bg-muted/30"
          meta={
            <div className="flex items-center gap-2">
              <StatusDot tone={live ? "on" : "wait"} />
              <span className="micro text-muted-foreground">
                {live
                  ? "Controller live"
                  : stale
                    ? "Controller idle"
                    : connected
                      ? "Handshaking"
                      : "Waiting"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNewCode}
                className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground"
              >
                <Plus className="size-3.5" />
                New code
              </Button>
            </div>
          }
        >
          <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-12">
            <div>
              <div className="micro text-muted-foreground">Room code</div>
              <div className="mt-3 flex gap-2">
                {code ? (
                  code.split("").map((character, index) => (
                    <span
                      key={`${character}-${index}`}
                      className="flex size-12 items-center justify-center rounded-md border border-border bg-background font-mono text-2xl font-medium sm:size-14 sm:text-3xl"
                    >
                      {character}
                    </span>
                  ))
                ) : (
                  Array.from({ length: 4 }).map((_, index) => (
                    <span
                      key={index}
                      className="size-12 animate-pulse rounded-md border border-border bg-background sm:size-14"
                    />
                  ))
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <div className="micro text-muted-foreground">Pairing link</div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    readOnly
                    value={pairUrl}
                    onFocus={(event) => event.currentTarget.select()}
                    placeholder="allocating…"
                    className="h-10 min-w-0 flex-1 truncate rounded-md border border-border bg-background px-3 font-mono text-[12px] outline-none"
                  />
                  <Button
                    type="button"
                    onClick={handleCopy}
                    disabled={!pairUrl}
                    className="h-10 shrink-0 gap-2 rounded-md bg-foreground px-4 text-[13px] text-background hover:bg-foreground/90"
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
                <div>
                  <dt className="micro text-muted-foreground">Device</dt>
                  <dd className="mt-1.5 truncate text-[13px]">
                    {room?.controllerLabel || (connected ? "Paired phone" : "—")}
                  </dd>
                </div>
                <div>
                  <dt className="micro text-muted-foreground">Transport</dt>
                  <dd className="mt-1.5 text-[13px]">{transport}</dd>
                </div>
                <div>
                  <dt className="micro text-muted-foreground">Round trip</dt>
                  <dd className="tnum mt-1.5 font-mono text-[13px]">
                    {rtt !== undefined ? `${rtt} ms` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="micro text-muted-foreground">Last seen</dt>
                  <dd className="tnum mt-1.5 font-mono text-[13px]">
                    {ago === null ? "—" : ago === 0 ? "now" : `${ago}s`}
                  </dd>
                </div>
              </dl>

              {!connected && (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Open{" "}
                  <span className="font-mono text-foreground">/controller</span>{" "}
                  on your phone and enter the code — or send the pairing link.
                  Both devices need to be able to reach each other; the same
                  Wi-Fi network is enough.
                </p>
              )}
            </div>
          </div>
        </Panel>

        {/* Arena + monitor */}
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel
            title="Arena"
            meta={
              <span className="micro text-muted-foreground">
                playable test target
              </span>
            }
            bodyClassName="p-5"
          >
            <Arena keymap={keymap} />
          </Panel>

          <Panel
            title="Input monitor"
            meta={
              <span className="flex items-center gap-2">
                <Radio
                  className={cn(
                    "size-3.5",
                    live ? "text-foreground" : "text-muted-foreground/50",
                  )}
                />
                <span className="micro text-muted-foreground">
                  {live ? "receiving" : "idle"}
                </span>
              </span>
            }
          >
            <InputMonitor frame={monitor} activeKeys={monitorKeys} />
          </Panel>
        </div>

        {/* Keymap */}
        <Panel
          title="Keymap"
          meta={
            <span className="micro text-muted-foreground">
              pad → keyboard
            </span>
          }
        >
          <KeymapEditor
            keymap={keymap}
            onChange={(next) => {
              setKeymap(next);
              saveKeymap(next);
            }}
          />
        </Panel>

        {/* Honest note about native games */}
        <Panel
          title="Desktop games"
          meta={<span className="micro text-muted-foreground">scope</span>}
        >
          <div className="grid gap-6 md:grid-cols-2">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Everything on this page — the arena above, any game running in a
              tab on this machine — receives the pad&apos;s keystrokes as real{" "}
              <span className="font-mono text-foreground">KeyboardEvent</span>s
              the instant they arrive.
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              A browser cannot inject keys into other applications. To drive a
              native title, export the keymap as JSON and hand it to a helper
              running with accessibility permissions; the transport, pairing and
              packet format stay exactly as they are here.
            </p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
