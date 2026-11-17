import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Must stay last: turns off every stylistic rule that Prettier already
  // owns, so ESLint reports bugs and Prettier alone decides formatting.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Local-only data and tool output
    'coverage/**',
    '.playwright-mcp/**',
    // The Chrome extension is plain browser JavaScript with its own globals
    // (`chrome`); it is checked by its own tests, not by the app's lint.
    'extension/**',
  ]),
]);

export default eslintConfig;
