/**
 * Points git at the versioned hooks in scripts/git-hooks, so every
 * contributor gets the gitleaks pre-commit check after a plain `npm i`.
 *
 * Silently skipped where there is no git repository (Vercel build,
 * Docker builder stage, npm tarball installs): hooks only matter locally.
 */
import { execSync } from 'node:child_process';
import { chmodSync, existsSync } from 'node:fs';

const HOOKS_DIR = 'scripts/git-hooks';

/** True when the current directory is inside a git work tree. */
function isGitRepo() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (process.env.VERCEL || !existsSync(HOOKS_DIR) || !isGitRepo()) {
  process.exit(0);
}

// Hooks must be executable, otherwise git ignores them silently.
chmodSync(`${HOOKS_DIR}/pre-commit`, 0o755);
execSync(`git config core.hooksPath ${HOOKS_DIR}`);
console.log(`Git hooks enabled from ${HOOKS_DIR} (gitleaks pre-commit).`);
