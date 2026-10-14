import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDirectInvocation } from '../src/cli.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('isDirectInvocation', () => {
  it('matches a bin symlink to the file node actually runs', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'smart-runner-bin-'));
    const target = path.join(dir, 'cli.js');
    const link = path.join(dir, 'playwright-smart-runner');
    writeFileSync(target, '');
    symlinkSync(target, link);

    assert.equal(isDirectInvocation(link, pathToFileURL(target).href), true);
    assert.equal(isDirectInvocation(undefined, pathToFileURL(target).href), false);

    rmSync(dir, { recursive: true, force: true });
  });

  it('prints help when the built cli is started through a symlink', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'smart-runner-bin-'));
    const link = path.join(dir, 'playwright-smart-runner');
    symlinkSync(path.join(packageRoot, 'dist', 'cli.js'), link);
    const result = spawnSync(process.execPath, [link, '--help'], { encoding: 'utf8' });
    rmSync(dir, { recursive: true, force: true });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /--list/);
  });
});
