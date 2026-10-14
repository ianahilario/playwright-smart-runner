import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { selectArgs, type SelectOptions } from '../src/resolve.js';
import type { ResolvedConfig, TestCase } from '../src/types.js';

const options: SelectOptions = {
  isDirectory: (file) => file === 'tests/checkout' || file === 'tests',
  fileExists: (file) => file !== 'tests/deleted.spec.ts',
};

const inventory: TestCase[] = [
  { file: 'tests/checkout/pay.spec.ts', line: 4, column: 3, title: 'completes checkout', tags: ['@checkout'] },
  { file: 'tests/checkout/pay.spec.ts', line: 8, column: 3, title: 'pays with a card', tags: ['@checkout'] },
  { file: 'tests/auth.spec.ts', line: 12, column: 3, title: 'signs in', tags: ['@smoke'] },
  { file: 'tests/auth.spec.ts', line: 40, column: 3, title: 'signs out', tags: ['@smoke'] },
  { file: 'tests/auth.spec.ts', line: 50, column: 3, title: 'shows help', tags: [] },
  { file: 'tests/same-line.spec.ts', line: 5, column: 3, title: 'left', tags: ['@pair'] },
  { file: 'tests/same-line.spec.ts', line: 5, column: 20, title: 'right', tags: ['@pair'] },
];

function config(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    testDir: 'tests',
    baseBranch: 'main',
    alwaysRunOnChange: ['@smoke'],
    ignorePaths: ['docs/**', '**/*.md'],
    passWithNoMappedTest: false,
    runChangedTests: false,
    unmappedChangeRun: ['@smoke'],
    runMapping: [
      {
        changedPaths: ['src/checkout/**'],
        runTests: ['@checkout', 'tests/checkout/', 'completes checkout'],
      },
    ],
    ...overrides,
  };
}

describe('selectArgs', () => {
  it('skips an empty diff and an ignore-only diff', () => {
    assert.deepEqual(selectArgs([], config(), inventory, options), { status: 'skip' });
    assert.deepEqual(selectArgs(['docs/guide.md', 'README.md'], config(), inventory, options), { status: 'skip' });
  });

  it('adds no extra tests when alwaysRunOnChange is omitted', () => {
    const result = selectArgs(['src/checkout/pay.ts'], config({ alwaysRunOnChange: [] }), inventory, options);
    assert.deepEqual(result, { status: 'run', args: ['tests/checkout/'] });
  });

  it('fails when a used tag does not exist', () => {
    const result = selectArgs(
      ['src/checkout/pay.ts'],
      config({ alwaysRunOnChange: ['@missing'] }),
      inventory,
      options,
    );
    assert.deepEqual(result, { status: 'error', message: 'alwaysRunOnChange: @missing not found' });
  });

  it('prints the directory and smoke locations for a mapped change', () => {
    const result = selectArgs(['src/checkout/pay.ts'], config(), inventory, options);
    assert.deepEqual(result, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40', 'tests/checkout/'],
    });
  });

  it('drops line locations covered by a selected file', () => {
    const result = selectArgs(
      ['src/checkout/pay.ts'],
      config({
        runMapping: [{ changedPaths: ['src/checkout/**'], runTests: ['tests/auth.spec.ts', '@smoke'] }],
      }),
      inventory,
      options,
    );
    assert.deepEqual(result, { status: 'run', args: ['tests/auth.spec.ts'] });
  });

  it('does not count a changed spec as a mapped test', () => {
    const result = selectArgs(['tests/auth.spec.ts'], config(), inventory, options);
    assert.deepEqual(result, { status: 'error', message: 'no mapped tests' });
  });

  it('includes changed spec files under the test directory when runChangedTests is true', () => {
    const alone = selectArgs(
      ['tests/checkout/pay.spec.ts'],
      config({ runChangedTests: true }),
      inventory,
      options,
    );
    assert.deepEqual(alone, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40', 'tests/checkout/pay.spec.ts'],
    });

    const withMapping = selectArgs(
      ['src/checkout/pay.ts', 'tests/same-line.spec.ts'],
      config({ runChangedTests: true }),
      inventory,
      options,
    );
    assert.deepEqual(withMapping, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40', 'tests/checkout/', 'tests/same-line.spec.ts'],
    });

    const deleted = selectArgs(
      ['tests/deleted.spec.ts'],
      config({ runChangedTests: true }),
      inventory,
      options,
    );
    assert.deepEqual(deleted, { status: 'error', message: 'no mapped tests' });
  });

  it('uses the unmapped fallback when passWithNoMappedTest is true', () => {
    const withTags = selectArgs(
      ['src/other/file.ts'],
      config({ passWithNoMappedTest: true }),
      inventory,
      options,
    );
    assert.deepEqual(withTags, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40'],
    });

    const full = selectArgs(
      ['src/other/file.ts'],
      config({ passWithNoMappedTest: true, unmappedChangeRun: undefined }),
      inventory,
      options,
    );
    assert.deepEqual(full, { status: 'run', args: ['tests'] });
  });

  it('runs the whole test directory when an unmapped file accompanies a mapping and unmappedChangeRun is omitted', () => {
    const result = selectArgs(
      ['src/checkout/pay.ts', 'tests/fixtures/auth.ts'],
      config({ unmappedChangeRun: undefined }),
      inventory,
      options,
    );
    assert.deepEqual(result, { status: 'run', args: ['tests'] });
  });

  it('prints one location when the same tag is selected twice', () => {
    const result = selectArgs(
      ['src/checkout/pay.ts'],
      config({
        unmappedChangeRun: ['@smoke'],
        runMapping: [{ changedPaths: ['src/checkout/**'], runTests: ['@smoke'] }],
      }),
      inventory,
      options,
    );
    assert.deepEqual(result, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40'],
    });
  });

  it('adds the column when two tests share a line', () => {
    const result = selectArgs(
      ['src/pair/**'],
      config({
        runMapping: [{ changedPaths: ['src/pair/**'], runTests: ['@pair'] }],
      }),
      inventory,
      options,
    );
    assert.deepEqual(result, {
      status: 'run',
      args: [
        'tests/auth.spec.ts:12',
        'tests/auth.spec.ts:40',
        'tests/same-line.spec.ts:5:20',
        'tests/same-line.spec.ts:5:3',
      ],
    });
  });

  it('selects every file with the same leaf title', () => {
    const titled = [
      ...inventory,
      { file: 'tests/again.spec.ts', line: 9, column: 1, title: 'completes checkout', tags: [] },
    ];
    const result = selectArgs(
      ['src/checkout/pay.ts'],
      config({
        runMapping: [{ changedPaths: ['src/checkout/**'], runTests: ['completes checkout'] }],
      }),
      titled,
      options,
    );
    assert.deepEqual(result, {
      status: 'run',
      args: ['tests/again.spec.ts:9', 'tests/auth.spec.ts:12', 'tests/auth.spec.ts:40', 'tests/checkout/pay.spec.ts:4'],
    });
  });

  it('does not pass a deleted spec path to Playwright', () => {
    const result = selectArgs(
      ['src/checkout/pay.ts', 'tests/deleted.spec.ts'],
      config({
        runMapping: [{ changedPaths: ['src/checkout/**'], runTests: ['tests/checkout/pay.spec.ts'] }],
      }),
      inventory,
      options,
    );
    assert.deepEqual(result, {
      status: 'run',
      args: ['tests/auth.spec.ts:12', 'tests/auth.spec.ts:40', 'tests/checkout/pay.spec.ts'],
    });
  });
});
