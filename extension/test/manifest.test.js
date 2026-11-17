import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = () =>
  JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

const APP_MATCHES = [
  'https://pixelperfect.fit/*',
  'https://www.pixelperfect.fit/*',
  'http://localhost:*/*',
  'http://127.0.0.1:*/*',
];

describe('manifest', () => {
  it('asks for exactly the permissions the store listing justifies', () => {
    const manifest = read();
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.permissions).toEqual([
      'debugger',
      'activeTab',
      'storage',
      'scripting',
    ]);
    expect(manifest.host_permissions).toEqual(APP_MATCHES);
    expect(manifest.optional_host_permissions).toEqual([
      'https://*/*',
      'http://*/*',
    ]);
  });

  it('injects the bridge only on the app origins', () => {
    const manifest = read();
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].matches).toEqual(APP_MATCHES);
    expect(manifest.content_scripts[0].js).toEqual(['src/bridge.js']);
  });

  it('never asks for every site up front', () => {
    expect(JSON.stringify(read())).not.toContain('<all_urls>');
  });

  it('references only files that exist', () => {
    const manifest = read();
    const files = [
      manifest.background.service_worker,
      manifest.action.default_popup,
      manifest.options_page,
      ...manifest.content_scripts.flatMap((script) => script.js),
      ...Object.values(manifest.icons),
      ...Object.values(manifest.action.default_icon),
    ];
    for (const file of files) {
      expect(existsSync(join(root, file)), file).toBe(true);
    }
  });
});
