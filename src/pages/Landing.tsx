import logo from "@/assets/logo.svg";
import { DeviceDiagram } from "@/components/landing/DeviceDiagram";
import { Eyebrow, Reveal } from "@/components/landing/Reveal";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router";

const NAV = [
  { href: "#method", label: "Method" },
  { href: "#link", label: "Link" },
  { href: "#controls", label: "Controls" },
  { href: "#spec", label: "Spec" },
];

const STEPS = [
  {
    n: "01",
    title: "Open the console",
    body: "On the computer you want to drive, open the console. It allocates a four-character room code and starts listening. Nothing installs.",
  },
  {
    n: "02",
    title: "Open the controller",
    body: "On your phone, open the controller and type the code — or follow the pairing link straight there. The two devices find each other on the network.",
  },
  {
    n: "03",
    title: "Play",
    body: "Sticks, buttons and triggers stream across a direct peer channel. The console turns them into the keys your game already listens for.",
  },
];

const LINKS = [
  {
    k: "Wi-Fi / LAN",
    v: "The default. Both devices share a network, so input travels phone → computer and nowhere else. Lowest latency, no metering.",
  },
  {
    k: "Across the internet",
    v: "Not on the same network? Frames fall back to the relay automatically. The pairing code is identical; only a few milliseconds change.",
  },
  {
    k: "USB & Bluetooth",
    v: "Tether the phone over USB, or join a Bluetooth personal-area network, and the peer channel simply rides that link instead. No configuration either way.",
  },
  {
    k: "Wired sanity",
    v: "If the peer channel cannot be formed at all — locked-down corporate Wi-Fi, captive portal — the relay keeps the pad usable rather than dead.",
  },
];

const CONTROLS = [
  ["Analog sticks", "Full-range, with an adjustable dead zone so resting thumbs read as neutral."],
  ["Shoulder triggers", "Pressure-mapped: where your thumb lands in the strip becomes the analog value."],
  ["D-pad or second stick", "The left cluster swaps between a directional pad and a stick in one tap."],
  ["Tilt aiming", "Optional gyroscope steering for games that want a flick rather than a push."],
  ["Turbo", "Hold once, fire repeatedly. Per-button, with a rate you choose."],
  ["Custom keymap", "Every input maps to a real keyboard code. Edit it live, export it as JSON."],
  ["Latency meter", "Round-trip time measured continuously and shown on both devices."],
  ["Input monitor", "Watch each axis and button arrive in real time before you trust it."],
  ["Haptics", "Short taps on button press where the browser allows vibration."],
];

const USES = [
  ["Browser games", "Anything running in a tab is controlled the moment you pair — no bridge, no setup."],
  ["Living-room machines", "The phone is already in your hand; the desktop is across the room."],
  ["Presentations & media", "Map the pad to arrows and space and it becomes a slide clicker."],
  ["Input testing", "Verify a keymap visually on the monitor before launching anything serious."],
];

const SPEC: [string, string][] = [
  ["Transport", "WebRTC data channel, unordered, latest-frame-wins"],
  ["Fallback", "Convex relay, throttled to change"],
  ["Pairing", "4 characters from a 31-character alphabet"],
  ["Inputs", "16 buttons · 2 sticks · 2 analog triggers · tilt"],
  ["Output", "Synthetic KeyboardEvent, code + key"],
  ["Platforms", "iOS 15+, Android 10+, Chrome / Edge / Safari / Firefox"],
  ["Cost", "Free, no account required on the phone"],
];

function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-3">
            <img src={logo} alt="" className="size-7 rounded-[6px]" />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">
              NULLPAD
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="micro text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              to="/controller"
              className="micro hidden text-muted-foreground transition-colors hover:text-foreground sm:block"
            >
              Use this phone
            </Link>
            <Link
              to={isAuthenticated ? "/dashboard" : "/auth?returnTo=/dashboard"}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-[13px] font-medium text-background transition-opacity hover:opacity-80"
            >
              {isLoading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : isAuthenticated ? (
                "Console"
              ) : (
                "Sign in"
              )}
            </Link>
          </div>
        </Container>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden">
        <div
          aria-hidden
          className="hairgrid pointer-events-none absolute inset-0 opacity-90 [mask-image:radial-gradient(120%_90%_at_50%_0%,black,transparent_75%)]"
        />
        <Container className="relative grid items-center gap-14 pb-24 pt-20 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pb-32 md:pt-28">
          <div>
            <Reveal>
              <Eyebrow index="00" label="Universal touch controller" />
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="mt-7 text-[clamp(2.75rem,8.5vw,5.75rem)] font-medium leading-[0.92] tracking-[-0.045em]">
                Your phone
                <br />
                is the
                <span className="italic font-light"> controller.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mt-8 max-w-lg text-[17px] leading-[1.65] text-muted-foreground">
                NULLPAD pairs the screen in your pocket with the computer in
                front of you. One four-character code, no app store, no driver —
                inputs stream straight across the network you already have.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth?returnTo=/dashboard"
                  className="group inline-flex h-12 items-center gap-3 rounded-md bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  Open the console
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/controller"
                  className="inline-flex h-12 items-center rounded-md border border-border px-6 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Use this phone as the pad
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <p className="mt-6 text-[13px] text-muted-foreground">
                The phone never needs an account. The machine does — it owns the
                keymap.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="md:pt-4">
            <DeviceDiagram className="w-full text-foreground" />
          </Reveal>
        </Container>
      </section>

      {/* ── Stat strip ─────────────────────────────────────────── */}
      <section className="border-b border-border bg-muted/40 md:border-t">
        <Container className="grid grid-cols-2 gap-x-6 md:grid-cols-4 md:gap-x-10">
          {[
            ["4", "characters to pair"],
            ["0", "apps to install"],
            ["16", "mappable inputs"],
            ["1", "direct link"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="border-t border-border pb-8 pt-6 md:border-t-0 md:pb-10 md:pt-10"
            >
              <div className="tnum font-mono text-4xl font-medium tracking-[-0.04em]">
                {value}
              </div>
              <div className="micro mt-3 text-muted-foreground">{label}</div>
            </div>
          ))}
        </Container>
      </section>

      {/* ── Method ─────────────────────────────────────────────── */}
      <section id="method" className="py-24 md:py-32">
        <Container>
          <Reveal>
            <Eyebrow index="01" label="Method" />
            <h2 className="mt-7 max-w-2xl text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em]">
              Three steps, then you are playing.
            </h2>
          </Reveal>

          <div className="mt-16 grid gap-px border-t border-border md:grid-cols-3">
            {STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div className="h-full pt-7 md:pr-8">
                  <div className="font-mono text-sm tnum text-muted-foreground">
                    {step.n}
                  </div>
                  <h3 className="mt-5 text-xl font-medium tracking-[-0.02em]">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Link ───────────────────────────────────────────────── */}
      <section id="link" className="border-t border-border bg-muted/30 py-24 md:py-32">
        <Container>
          <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <Eyebrow index="02" label="Link" />
              <h2 className="mt-7 text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                Whatever wire
                <br />
                you already have.
              </h2>
              <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
                The pad does not care how the two devices reach each other. It
                prefers the shortest path and quietly takes a longer one when it
                must.
              </p>
            </Reveal>

            <div>
              {LINKS.map(({ k, v }, i) => (
                <Reveal key={k} delay={i * 0.05}>
                  <div className="grid gap-3 border-t border-border py-7 sm:grid-cols-[9.5rem_1fr] sm:gap-8">
                    <div className="micro pt-1 text-foreground">{k}</div>
                    <p className="text-[15px] leading-relaxed text-muted-foreground">
                      {v}
                    </p>
                  </div>
                </Reveal>
              ))}
              <div aria-hidden className="border-t border-border" />
            </div>
          </div>
        </Container>
      </section>

      {/* ── Controls ───────────────────────────────────────────── */}
      <section id="controls" className="py-24 md:py-32">
        <Container>
          <Reveal>
            <Eyebrow index="03" label="Controls" />
            <div className="mt-7 flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                Sixteen inputs.
                <br />
                None wasted.
              </h2>
              <p className="max-w-xs text-[15px] leading-relaxed text-muted-foreground">
                Everything on the glass is a real control with a real keyboard
                code behind it. Nothing is decorative.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {CONTROLS.map(([title, body], i) => (
              <Reveal key={title} delay={(i % 3) * 0.05}>
                <div className="border-t border-border py-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] tnum text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="text-[15px] font-medium tracking-[-0.01em]">
                      {title}
                    </h3>
                  </div>
                  <p className="mt-3 pl-8 text-[14px] leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Examples ───────────────────────────────────────────── */}
      <section className="border-t border-border bg-muted/30 py-24 md:py-32">
        <Container>
          <div className="grid gap-12 md:grid-cols-[0.85fr_1.15fr]">
            <Reveal>
              <Eyebrow index="04" label="In practice" />
              <h2 className="mt-7 text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em]">
                A pad for the
                <br />
                machine in front of you.
              </h2>
            </Reveal>

            <div className="grid gap-px sm:grid-cols-2">
              {USES.map(([title, body], i) => (
                <Reveal key={title} delay={i * 0.06}>
                  <div className="h-full border-t border-border py-6 sm:pr-6">
                    <h3 className="text-[15px] font-medium">{title}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.1}>
            <div className="mt-16 flex flex-col items-start justify-between gap-6 border border-border bg-background p-8 sm:flex-row sm:items-center sm:p-10">
              <div>
                <div className="micro text-muted-foreground">Try it first</div>
                <p className="mt-3 max-w-xl text-lg leading-snug tracking-[-0.015em]">
                  The console ships with a small arena you can drive from your
                  phone in under a minute — pair, move, shoot, watch the latency
                  readout while you do it.
                </p>
              </div>
              <Link
                to="/auth?returnTo=/dashboard"
                className="inline-flex h-11 shrink-0 items-center gap-3 rounded-md bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85"
              >
                Open the console
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ── Spec ───────────────────────────────────────────────── */}
      <section id="spec" className="py-24 md:py-32">
        <Container>
          <Reveal>
            <Eyebrow index="05" label="Spec" />
            <h2 className="mt-7 text-[clamp(1.75rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.035em]">
              The whole sheet.
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <dl className="mt-12 border-t border-border">
              {SPEC.map(([k, v]) => (
                <div
                  key={k}
                  className="grid gap-1 border-b border-border py-5 sm:grid-cols-[11rem_1fr] sm:gap-8"
                >
                  <dt className="micro pt-1 text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-[14px] leading-relaxed">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </Container>
      </section>

      {/* ── Closing ────────────────────────────────────────────── */}
      <section className="border-t border-border bg-foreground py-24 text-background md:py-32">
        <Container className="text-center">
          <Reveal>
            <div className="micro opacity-60">Ready</div>
            <h2 className="mx-auto mt-6 max-w-3xl text-[clamp(2rem,5.5vw,4rem)] font-medium leading-[1.02] tracking-[-0.04em]">
              Give your phone a job.
            </h2>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/auth?returnTo=/dashboard"
                className="inline-flex h-12 items-center gap-3 rounded-md bg-background px-7 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
              >
                Open the console
                <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/controller"
                className="inline-flex h-12 items-center rounded-md border border-background/30 px-7 text-sm font-medium transition-colors hover:bg-background/10"
              >
                Pair this phone
              </Link>
            </div>
          </Reveal>
        </Container>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-12">
        <Container className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="size-6 rounded-[5px]" />
            <span className="text-sm font-medium tracking-[-0.02em]">
              NULLPAD
            </span>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
            <span className="text-[13px] text-muted-foreground">
              Built for the machine in front of you.
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-6">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/controller"
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Controller
            </Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}
