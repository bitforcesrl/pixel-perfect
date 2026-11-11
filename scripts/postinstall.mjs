/**
 * Downloads the Firefox that local captures launch (lib/browser.ts), so a
 * fresh `npm i` is enough to capture.
 *
 * Skipped on Vercel, which drives Browserless and has no use for a local
 * browser, and wherever PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD is set — the Docker
 * builder stage, which runs on Alpine where Playwright has no Firefox build;
 * the runner stage installs its own.
 *
 * A failed download only warns: being offline should not fail the install.
 */
import { execSync } from 'node:child_process';

const skip = process.env.VERCEL || process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;

if (!skip) {
  try {
    execSync('npx playwright install firefox', { stdio: 'inherit' });
  } catch {
    console.warn(
      '\nCould not download Firefox for local captures. Run `npm run playwright:install` later.\n',
    );
  }
}
