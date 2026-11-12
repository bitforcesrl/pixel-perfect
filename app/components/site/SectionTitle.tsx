/** A section heading of the public site: a mono kicker over a display title. */
export default function SectionTitle({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-3 font-mono text-xs tracking-[0.18em] text-press-violet uppercase">
        {kicker}
      </p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-100 sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}
