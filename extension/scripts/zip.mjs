/**
 * Build the package to upload to the Chrome Web Store.
 *
 * Zips what the browser needs — manifest.json, src/ and icons/ — and nothing
 * else (no tests, scripts, store texts or README) into
 * extension/dist/pixel-perfect-capture-<version>.zip, the version read from
 * the manifest. Refuses to package uncommitted changes, so the zip always
 * matches a commit; pass --force to package anyway.
 *
 * Usage: npm run extension:zip [-- --force]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const force = process.argv.includes('--force');
const { version } = JSON.parse(
  readFileSync(join(root, 'manifest.json'), 'utf8'),
);

const dirty = execFileSync(
  'git',
  ['status', '--porcelain', '--', 'manifest.json', 'src', 'icons'],
  { cwd: root, encoding: 'utf8' },
).trim();
if (dirty && !force) {
  console.error(
    'The extension has uncommitted changes:\n' +
      dirty +
      '\nCommit them first, or run with --force.',
  );
  process.exit(1);
}

const dist = join(root, 'dist');
mkdirSync(dist, { recursive: true });
const zip = join(dist, `pixel-perfect-capture-${version}.zip`);
if (existsSync(zip)) rmSync(zip);

execFileSync(
  'zip',
  ['-r', '-X', '-q', zip, 'manifest.json', 'src', 'icons', '-x', '*.DS_Store'],
  { cwd: root, stdio: 'inherit' },
);
console.log(`extension/dist/pixel-perfect-capture-${version}.zip`);
