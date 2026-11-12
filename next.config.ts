import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * This folder, pinned. Left to infer it, Next walks up to the first lockfile it
 * finds — a stray one in a parent directory makes that the root, which nests
 * the standalone output under the parent's path and leaves module resolution
 * and file watching rooted somewhere this project does not live.
 */
const PROJECT_ROOT = path.resolve(__dirname);

/**
 * One value per deploy, baked into both the browser bundle and the server.
 * The open tab compares its own value with `/api/version` to detect a new
 * deploy. On Vercel the deployment id changes even when the same commit is
 * redeployed; locally the build time is used.
 */
const APP_VERSION =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  `local-${Date.now()}`;

const nextConfig: NextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_APP_VERSION: APP_VERSION },
  /**
   * The service worker must always be fetched fresh, otherwise a cached copy
   * could keep browsers on an old worker after a deploy.
   */
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  turbopack: { root: PROJECT_ROOT },
  outputFileTracingRoot: PROJECT_ROOT,
  allowedDevOrigins: ['localhost'],
  serverExternalPackages: ['playwright', 'playwright-core'],
  /**
   * `playwright-core` loads its browser registry with
   * `require(path.join(packageRoot, 'browsers.json'))`. The path is built at
   * runtime, so the build-time tracer never sees it and the file is left out of
   * the serverless bundle — the import then dies with "Cannot find module
   * '/var/task/node_modules/playwright-core/browsers.json'" before the route can
   * even reach Browserless. Name it explicitly so it ships with the function.
   *
   * The route pattern must match the *normalized* App Router route (e.g.
   * `/api/screenshot`), not a filesystem glob.  `picomatch` with `contains:true`
   * is used internally, so `/api/screenshot` also matches deeper routes under it
   * should any be added later.
   */
  outputFileTracingIncludes: {
    '/api/screenshot': [
      './node_modules/playwright-core/browsers.json',
      './node_modules/playwright-core/package.json',
    ],
  },
};

export default nextConfig;
