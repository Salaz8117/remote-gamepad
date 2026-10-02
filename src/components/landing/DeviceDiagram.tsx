/**
 * Hairline schematic of the whole product: phone on the left, machine on the
 * right, one direct link between them. Drawn rather than screenshotted so it
 * stays crisp at any size and needs no imagery.
 */
export function DeviceDiagram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 400"
      role="img"
      aria-label="A phone paired directly with a laptop over the local network"
      className={className}
      fill="none"
      stroke="currentColor"
    >
      {/* phone */}
      <rect
        x="40"
        y="52"
        width="160"
        height="296"
        rx="20"
        strokeWidth="1.5"
        opacity="0.75"
      />
      <rect
        x="98"
        y="66"
        width="44"
        height="6"
        rx="3"
        strokeWidth="1.2"
        opacity="0.5"
      />

      {/* shoulders */}
      <rect
        x="58"
        y="96"
        width="58"
        height="12"
        rx="6"
        strokeWidth="1.2"
        opacity="0.55"
      />
      <rect
        x="124"
        y="96"
        width="58"
        height="12"
        rx="6"
        strokeWidth="1.2"
        opacity="0.55"
      />

      {/* left stick */}
      <circle cx="92" cy="278" r="34" strokeWidth="1.2" opacity="0.45" />
      <circle cx="92" cy="278" r="15" strokeWidth="1.5" opacity="0.9" />
      <line x1="92" y1="236" x2="92" y2="320" strokeWidth="1" opacity="0.2" />
      <line x1="50" y1="278" x2="134" y2="278" strokeWidth="1" opacity="0.2" />

      {/* face buttons */}
      <circle cx="160" cy="250" r="11" strokeWidth="1.5" opacity="0.9" />
      <circle cx="186" cy="278" r="11" strokeWidth="1.5" opacity="0.9" />
      <circle cx="160" cy="306" r="11" strokeWidth="1.5" opacity="0.9" />
      <circle cx="134" cy="278" r="11" strokeWidth="1.5" opacity="0.9" />

      {/* machine */}
      <rect
        x="404"
        y="96"
        width="204"
        height="132"
        rx="8"
        strokeWidth="1.5"
        opacity="0.75"
      />
      <path
        d="M392 238 H620 L632 254 H380 Z"
        strokeWidth="1.5"
        opacity="0.75"
        strokeLinejoin="round"
      />
      {/* the arena running on the machine */}
      <rect x="452" y="150" width="18" height="18" strokeWidth="1.3" />
      <circle cx="536" cy="186" r="7" strokeWidth="1.3" opacity="0.8" />
      <circle cx="498" cy="126" r="5" strokeWidth="1.3" opacity="0.6" />
      <circle cx="574" cy="140" r="5" strokeWidth="1.3" opacity="0.6" />
      <path d="M452 196 L486 168" strokeWidth="1.3" opacity="0.5" />

      {/* link */}
      <path
        d="M206 200 H396"
        strokeWidth="1.5"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="206" cy="200" r="3.5" fill="currentColor" stroke="none" />
      <circle cx="396" cy="200" r="3.5" fill="currentColor" stroke="none" />
      <circle r="4" fill="currentColor" stroke="none" opacity="0.9">
        <animate
          attributeName="cx"
          values="206;396;206"
          dur="3.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="200;200;200"
          dur="3.4s"
          repeatCount="indefinite"
        />
      </circle>

      <text
        x="301"
        y="178"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontSize="11"
        letterSpacing="3.4"
        opacity="0.7"
      >
        PEER CHANNEL
      </text>
      <text
        x="301"
        y="228"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-mono)"
        fontSize="12"
        letterSpacing="1"
        opacity="0.55"
      >
        no server in the loop
      </text>
    </svg>
  );
}
