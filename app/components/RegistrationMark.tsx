/**
 * The printer's registration mark: one ring per ink, laid over a crosshair.
 *
 * The rings are drawn deliberately out of register — that misalignment is the
 * whole subject of this tool, and it is what the empty canvas is waiting for
 * you to fix. `registered` pulls them onto the same centre.
 */
export default function RegistrationMark({
  size = 72,
  registered = false,
  className = "",
}: {
  size?: number;
  registered?: boolean;
  className?: string;
}) {
  // Ring centres, in viewBox units, off-centre until registered. cx/cy are
  // animatable CSS properties, so the snap into register comes for free.
  const drift = registered ? 0 : 3.4;
  const inks = [
    { color: "var(--color-press-cyan)", dx: -drift, dy: -drift * 0.55 },
    { color: "var(--color-press-magenta)", dx: drift, dy: -drift * 0.55 },
    { color: "var(--color-press-amber)", dx: 0, dy: drift },
  ];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {inks.map((ink) => (
        <circle
          key={ink.color}
          className="reg-ring"
          cx={24 + ink.dx}
          cy={24 + ink.dy}
          r="11"
          stroke={ink.color}
          strokeWidth="1.6"
        />
      ))}
      {/* Crosshair — the true centre both plates are measured against */}
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <path d="M24 2v11M24 35v11M2 24h11M35 24h11" />
      </g>
    </svg>
  );
}
