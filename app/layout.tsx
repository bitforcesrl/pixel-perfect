import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

// Display — the wordmark and nothing else, set tight and loud like a plate label
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

// UI — drawn for instrument panels: open apertures and unambiguous letterforms,
// which is what 10-12px of dense label copy actually needs
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Data — offsets, dimensions, percentages
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Pixel Perfect — Figma vs Site Diff",
  description:
    "Compare a live website screenshot with your Figma design, pixel by pixel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // No `antialiased` here on purpose: it forces grayscale smoothing and
      // thins light-on-dark type. The platform's own subpixel rendering is
      // sharper for the 11-12px labels this app is built from.
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col overflow-hidden bg-ink-void">
        <div className="press-bar" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
