import path from 'node:path';
import type {NextConfig} from 'next';

/**
 * This folder, pinned. Left to infer it, Next walks up to the first lockfile it
 * finds — a stray one in a parent directory makes that the root, which nests
 * the standalone output under the parent's path and leaves module resolution
 * and file watching rooted somewhere this project does not live.
 */
const PROJECT_ROOT = path.resolve(__dirname);

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {root: PROJECT_ROOT},
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
