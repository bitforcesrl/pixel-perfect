import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import AppUpdater from './components/pwa/AppUpdater';
import { KEYWORDS, OPEN_GRAPH_BASE, SHARE_IMAGE } from '@/lib/seo';
import { SITE } from '@/lib/site';
import './globals.css';

// Display — the wordmark and nothing else, set tight and loud like a plate label
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
});

// UI — drawn for instrument panels: open apertures and unambiguous letterforms,
// which is what 10-12px of dense label copy actually needs
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

// Data — offsets, dimensions, percentages
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  // Makes relative Open Graph / canonical URLs absolute on the public domain
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: KEYWORDS,
  authors: [{ name: SITE.author, url: SITE.githubUrl }],
  creator: SITE.author,
  category: 'design',
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: '/',
    title: SITE.name,
    description: SITE.description,
  },
  // The large card on X, with the same image as Open Graph
  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: SITE.description,
    images: [SHARE_IMAGE],
  },
  // Installed on macOS/iOS via "Add to Dock" / "Add to Home Screen"
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: 'black-translucent',
  },
  // Points AI crawlers at the plain-text summary of the site
  other: { 'llms.txt': `${SITE.url}/llms.txt` },
};

// Title bar of the installed app matches the ink surface
export const viewport: Viewport = {
  themeColor: '#090b11',
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
      {/* The body stays neutral: the tool locks itself to the viewport in its
          own layout, while the public site scrolls like any other page. */}
      <body className="min-h-full bg-ink-void">
        {children}
        {/* Service worker + "new version available" toast, on every route */}
        <AppUpdater />
      </body>
    </html>
  );
}
