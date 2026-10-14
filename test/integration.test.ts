import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { listChangedPaths } from '../src/git.js';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
};

describe('git diff and playwright', () => {
  it('diffs from the merge base and runs the selected tests', { timeout: 180_000 }, () => {
    const root = mkdtempSync(path.join(tmpdir(), 'playwright-smart-runner-'));
    symlinkSync(path.join(packageRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    writeProject(root);

    git(root, ['init', '-b', 'main']);
    git(root, ['add', '.']);
    git(root, ['commit', '-m', 'initial']);
    git(root, ['checkout', '-b', 'feature']);
    git(root, ['checkout', 'main']);
    writeFileSync(path.join(root, 'main-only.txt'), 'later\n');
    git(root, ['add', 'main-only.txt']);
    git(root, ['commit', '-m', 'main moves ahead']);
    git(root, ['checkout', 'feature']);
    writeFileSync(path.join(root, 'src/checkout/pay.ts'), 'export const amount = 2;\n');
    git(root, ['add', 'src/checkout/pay.ts']);
    git(root, ['commit', '-m', 'change checkout']);

    const changed = listChangedPaths(root, 'main');
    assert.ok(changed.includes('src/checkout/pay.ts'));
    assert.equal(changed.includes('main-only.txt'), false);

    const listed = runRunner(root, ['--list']);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /^tests\/checkout\/$/m);
    assert.match(listed.stdout, /^tests\/auth\.spec\.ts:\d+$/m);
    assert.doesNotMatch(listed.stdout, /other\.spec\.ts/);

    const printed = runRunner(root);
    assert.equal(printed.status, 0, printed.stderr);
    const args = printed.stdout.trim().split(/\s+/);
    const ran = path.join(root, 'ran.txt');
    const playwright = spawnSync(
      path.join(packageRoot, 'node_modules', '.bin', 'playwright'),
      ['test', ...args],
      { cwd: root, encoding: 'utf8', env: { ...process.env, RAN_FILE: ran } },
    );
    assert.equal(playwright.status, 0, `${playwright.stdout}\n${playwright.stderr}`);

    const hits = readRan(ran);
    assert.deepEqual(hits, ['completes checkout', 'pays with a card', 'signs in', 'signs out']);
  });
});

function writeProject(root: string): void {
  mkdirSync(path.join(root, 'src/checkout'), { recursive: true });
  mkdirSync(path.join(root, 'tests/checkout'), { recursive: true });
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFileSync(path.join(root, '.gitignore'), 'node_modules/\nran.txt\n');
  writeFileSync(path.join(root, 'src/checkout/pay.ts'), 'export const amount = 1;\n');
  writeFileSync(path.join(root, 'docs/guide.md'), '# guide\n');
  writeFileSync(path.join(root, 'playwright.config.ts'), `import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  reporter: 'line',
  workers: 1,
  projects: [{ name: 'chromium' }],
});
`);
  writeFileSync(path.join(root, 'playwright-smart-runner.config.ts'), `export default {
  testDir: './tests',
  baseBranch: 'main',
  alwaysRunOnChange: ['@smoke'],
  ignorePaths: ['docs/**', '**/*.md'],
  passWithNoMappedTest: false,
  unmappedChangeRun: ['@smoke'],
  runMapping: [
    {
      changedPaths: ['src/checkout/**'],
      runTests: ['tests/checkout/', 'completes checkout'],
    },
  ],
};
`);
  writeFileSync(path.join(root, 'tests/checkout/pay.spec.ts'), `import { test } from '@playwright/test';
import { hit } from '../record';
test('completes checkout', () => hit('completes checkout'));
test('pays with a card', () => hit('pays with a card'));
`);
  writeFileSync(path.join(root, 'tests/auth.spec.ts'), `import { test } from '@playwright/test';
import { hit } from './record';
test('signs in', { tag: '@smoke' }, () => hit('signs in'));
test('signs out', { tag: '@smoke' }, () => hit('signs out'));
test('shows help', () => hit('shows help'));
`);
  writeFileSync(path.join(root, 'tests/other.spec.ts'), `import { test } from '@playwright/test';
import { hit } from './record';
test('should stay quiet', () => hit('should stay quiet'));
`);
  writeFileSync(path.join(root, 'tests/record.ts'), `import { appendFileSync } from 'node:fs';
export function hit(name: string): void {
  appendFileSync(process.env.RAN_FILE ?? 'ran.txt', name + '\\n');
}
`);
}

function runRunner(cwd: string, args: string[] = []): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    path.join(packageRoot, 'node_modules', '.bin', 'tsx'),
    [path.join(packageRoot, 'src/cli.ts'), ...args],
    { cwd, encoding: 'utf8', env: process.env },
  );
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: gitEnv });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed\n${result.stderr}`);
  }
}

function readRan(file: string): string[] {
  return spawnSync('cat', [file], { encoding: 'utf8' }).stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();
}
