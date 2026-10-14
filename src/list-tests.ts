import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { normalizeRepoPath, repoRelative } from './paths.js';
import type { TestCase } from './types.js';

interface JsonSuite {
  title?: string;
  file?: string;
  tags?: string[];
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

interface JsonSpec {
  title?: string;
  file?: string;
  line?: number;
  column?: number;
  tags?: string[];
}

export function listTests(repoRootPath: string, testDir: string): TestCase[] {
  const command = playwrightCommand(repoRootPath);
  const result = spawnSync(command.cmd, [...command.argsPrefix, 'test', '--list', '--reporter=json'], {
    cwd: repoRootPath,
    encoding: 'utf8',
  });

  if (result.error) {
    throw new Error(`failed to run Playwright: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(detail || 'playwright test --list failed');
  }

  const parsed = parseListJson(result.stdout);
  return dedupeTests(flattenSuites(parsed.suites ?? [], repoRootPath, testDir, []));
}

function playwrightCommand(repoRootPath: string): { cmd: string; argsPrefix: string[] } {
  const local = path.join(repoRootPath, 'node_modules', '.bin', 'playwright');
  if (existsSync(local)) return { cmd: local, argsPrefix: [] };
  return { cmd: 'npx', argsPrefix: ['--no-install', 'playwright'] };
}

function parseListJson(stdout: string): { suites?: JsonSuite[] } {
  const start = stdout.indexOf('{');
  if (start === -1) throw new Error('playwright test --list did not return JSON');
  return JSON.parse(stdout.slice(start)) as { suites?: JsonSuite[] };
}

function flattenSuites(
  suites: JsonSuite[],
  repoRootPath: string,
  testDir: string,
  parentTags: string[],
): TestCase[] {
  const tests: TestCase[] = [];
  for (const suite of suites) {
    const tags = unique([...parentTags, ...(suite.tags ?? []).map(normalizeTag)]);
    for (const spec of suite.specs ?? []) {
      const file = spec.file ?? suite.file;
      if (!file || spec.line === undefined || !spec.title) continue;
      tests.push({
        file: specFile(repoRootPath, testDir, file),
        line: spec.line,
        column: spec.column ?? 0,
        title: spec.title,
        tags: unique([...tags, ...(spec.tags ?? []).map(normalizeTag)]),
      });
    }
    tests.push(...flattenSuites(suite.suites ?? [], repoRootPath, testDir, tags));
  }
  return tests;
}

function specFile(repoRootPath: string, testDir: string, file: string): string {
  const relative = repoRelative(repoRootPath, file);
  const directory = normalizeRepoPath(testDir);
  if (directory === '.' || directory === '') return relative;
  if (relative === directory || relative.startsWith(`${directory}/`)) return relative;
  return normalizeRepoPath(`${directory}/${relative}`);
}

function normalizeTag(tag: string): string {
  return tag.startsWith('@') ? tag : `@${tag}`;
}

function dedupeTests(tests: TestCase[]): TestCase[] {
  const byKey = new Map<string, TestCase>();
  for (const test of tests) {
    const key = `${test.file}:${test.line}:${test.column}:${test.title}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, test);
      continue;
    }
    existing.tags = unique([...existing.tags, ...test.tags]);
  }
  return [...byKey.values()];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
