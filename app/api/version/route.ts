import { APP_VERSION } from '@/lib/app-version';

/**
 * GET /api/version — the version of the deployment answering the request.
 *
 * Never cached anywhere (browser, CDN, service worker): its only job is to
 * tell an open tab, as of right now, whether it is running an old build.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { version: APP_VERSION },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'CDN-Cache-Control': 'no-store',
        'Vercel-CDN-Cache-Control': 'no-store',
      },
    },
  );
}
