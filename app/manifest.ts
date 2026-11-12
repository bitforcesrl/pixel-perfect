import type { MetadataRoute } from 'next';

/**
 * Web app manifest: makes Pixel Perfect installable as a desktop app
 * (Chrome/Edge "Install app", Safari "Add to Dock").
 *
 * It opens straight on the tool, in its own window, on the same ink surface
 * the app paints, so there is no white flash while the first frame loads.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app',
    name: 'Pixel Perfect',
    short_name: 'Pixel Perfect',
    description:
      'Compare a live website screenshot with your Figma design, pixel by pixel.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#090b11',
    theme_color: '#090b11',
    categories: ['design', 'developer', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
