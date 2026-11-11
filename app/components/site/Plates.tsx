/**
 * Drawn stand-ins for the comparison modes: two "plates" — magenta for Figma,
 * cyan for the site — that miss each other the way a real implementation
 * does. Pure markup, so they cost nothing to load and never go stale.
 */

type Mode = 'split' | 'overlay' | 'tap' | 'side';

/** A fake page layout: header, hero block, three cards, a text column. */
function Mock({ color, shift = 0 }: { color: string; shift?: number }) {
  const line = { borderColor: color };
  return (
    <div
      className="absolute inset-0 p-[7%]"
      style={{ transform: `translate(${shift}px, ${shift * 0.6}px)` }}
    >
      <div className="mb-[6%] h-[7%] w-full border-b" style={line} />
      <div className="mb-[6%] h-[28%] w-[70%] rounded-sm border" style={line} />
      <div className="mb-[6%] grid h-[24%] grid-cols-3 gap-[4%]">
        <div className="rounded-sm border" style={line} />
        <div className="rounded-sm border" style={line} />
        <div className="rounded-sm border" style={line} />
      </div>
      <div className="space-y-[3%]">
        <div className="h-[2px] w-[90%]" style={{ background: color }} />
        <div className="h-[2px] w-[75%]" style={{ background: color }} />
        <div className="h-[2px] w-[82%]" style={{ background: color }} />
      </div>
    </div>
  );
}

const FIGMA = 'var(--color-press-magenta)';
const SITE = 'var(--color-press-cyan)';

export default function Plates({ mode }: { mode: Mode }) {
  if (mode === 'side') {
    return (
      <div className="absolute inset-0 grid grid-cols-2 gap-px bg-ink-800">
        <div className="relative bg-ink-950">
          <Mock color={FIGMA} />
        </div>
        <div className="relative bg-ink-950">
          <Mock color={SITE} shift={3} />
        </div>
      </div>
    );
  }
  if (mode === 'split') {
    return (
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{ clipPath: 'inset(0 50% 0 0)' }}
        >
          <Mock color={FIGMA} />
        </div>
        <div
          className="absolute inset-0"
          style={{ clipPath: 'inset(0 0 0 50%)' }}
        >
          <Mock color={SITE} shift={3} />
        </div>
        <div className="absolute inset-y-0 left-1/2 w-px bg-press-violet" />
        <div className="absolute top-1/2 left-1/2 h-6 w-6 -translate-1/2 rounded-full border border-press-violet bg-ink-950" />
      </div>
    );
  }
  if (mode === 'tap') {
    return (
      <div className="absolute inset-0">
        <div className="plate-tap-a absolute inset-0">
          <Mock color={FIGMA} />
        </div>
        <div className="plate-tap-b absolute inset-0">
          <Mock color={SITE} shift={3} />
        </div>
      </div>
    );
  }
  // overlay: both plates at once, where they miss is where the colour splits
  return (
    <div className="absolute inset-0" style={{ mixBlendMode: 'screen' }}>
      <Mock color={FIGMA} />
      <Mock color={SITE} shift={3} />
    </div>
  );
}
