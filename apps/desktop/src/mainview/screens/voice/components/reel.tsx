/**
 * Cassette tape reel — SVG hub with spoke holes + square spindle.
 * Rotation is driven by the parent `<Reel $active>` wrapper (CSS keyframe).
 */
export function ReelSvg() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full"
      aria-hidden="true"
      focusable="false"
    >
      {/* outer ring with bezel */}
      <defs>
        <radialGradient id="reel-hub" cx="50%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#2a2520" />
          <stop offset="55%" stopColor="#1a1814" />
          <stop offset="100%" stopColor="#0e0c09" />
        </radialGradient>
        <radialGradient id="reel-rim" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#3a342b" />
          <stop offset="100%" stopColor="#1a1612" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#reel-rim)" />
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="url(#reel-hub)"
        stroke="#0a0807"
        strokeWidth="1"
      />

      {/* 6 spoke holes */}
      {spokes.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r="4.5" fill="#050402" />
      ))}

      {/* center spindle */}
      <rect
        x="42"
        y="42"
        width="16"
        height="16"
        rx="1.5"
        fill="#050402"
        stroke="#1a1612"
        strokeWidth="0.5"
      />
      {/* spindle cross teeth */}
      <rect x="49" y="38" width="2" height="24" fill="#1a1612" />
      <rect x="38" y="49" width="24" height="2" fill="#1a1612" />
    </svg>
  );
}

const spokes = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
  const radius = 30;
  return {
    x: 50 + Math.cos(angle) * radius,
    y: 50 + Math.sin(angle) * radius,
  };
});
