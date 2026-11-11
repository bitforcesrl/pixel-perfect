/**
 * Shell for the tool routes (`/app`, `/demo`).
 *
 * The workspace is an instrument panel, not a document: it fills the viewport
 * exactly and scrolls inside its own panes, never the page. That lock lives
 * here rather than on <body> so the public site can scroll normally.
 */
export default function ToolLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="press-bar" aria-hidden="true" />
      {children}
    </div>
  );
}
