import { directoryCovers, normalizeRepoPath, pathMatches } from './paths.js';
import type { ResolvedConfig, SelectResult, TestCase } from './types.js';

export interface SelectOptions {
  isDirectory(repoRelativePath: string): boolean;
  fileExists(repoRelativePath: string): boolean;
}

interface Piece {
  kind: 'dir' | 'file' | 'loc';
  path: string;
  line?: number;
  column?: number;
  trailingSlash: boolean;
}

export function selectArgs(
  changedPaths: string[],
  config: ResolvedConfig,
  tests: TestCase[],
  options: SelectOptions,
): SelectResult {
  const relevant = changedPaths.filter(
    (file) => !config.ignorePaths.some((pattern) => pathMatches(pattern, file)),
  );
  if (relevant.length === 0) return { status: 'skip' };

  const always = resolveTagList(config.alwaysRunOnChange, 'alwaysRunOnChange', tests);
  if (always.error) return { status: 'error', message: always.error };

  const matchedMappings = config.runMapping.filter((mapping) =>
    relevant.some((file) => mapping.changedPaths.some((pattern) => pathMatches(pattern, file))),
  );
  const specPieces: Piece[] = config.runChangedTests
    ? changedSpecs(relevant, config.testDir, tests, options.fileExists).map((file) => ({
        kind: 'file',
        path: file,
        trailingSlash: false,
      }))
    : [];

  if (matchedMappings.length === 0) {
    const hasNonSpecChange = relevant.some((file) => !isChangedSpec(file, config.testDir, tests));
    if (specPieces.length > 0 && !hasNonSpecChange) {
      return finish(always.tests, { pieces: specPieces }, tests);
    }
    if (!config.passWithNoMappedTest) return { status: 'error', message: 'no mapped tests' };
    const extra = fallbackPieces(config, tests);
    return finish(always.tests, { pieces: [...specPieces, ...extra.pieces], error: extra.error }, tests);
  }

  const pieces: Piece[] = [...specPieces];

  for (const mapping of matchedMappings) {
    for (const selector of mapping.runTests) {
      const resolved = resolveSelector(selector, 'runTests', tests, options.isDirectory);
      if (resolved.error) return { status: 'error', message: resolved.error };
      pieces.push(...resolved.pieces);
    }
  }

  const unmapped = relevant.filter(
    (file) => !isSpec(file, tests) && !matchesAnyMapping(file, config),
  );
  if (unmapped.length > 0) {
    const extra = fallbackPieces(config, tests);
    if (extra.error) return { status: 'error', message: extra.error };
    pieces.push(...extra.pieces);
  }

  return finish(always.tests, { pieces }, tests);
}

function finish(
  alwaysTests: TestCase[],
  extra: { pieces: Piece[]; error?: string },
  inventory: TestCase[],
): SelectResult {
  if (extra.error) return { status: 'error', message: extra.error };
  const pieces = [
    ...testsToLocations(alwaysTests, inventory),
    ...extra.pieces,
  ];
  const args = piecesToArgs(pieces);
  if (args.length === 0) return { status: 'error', message: 'testDir contains no tests' };
  return { status: 'run', args };
}

function fallbackPieces(
  config: ResolvedConfig,
  tests: TestCase[],
): { pieces: Piece[]; error?: string } {
  if (config.unmappedChangeRun) {
    const resolved = resolveTagList(config.unmappedChangeRun, 'unmappedChangeRun', tests);
    if (resolved.error) return { pieces: [], error: resolved.error };
    if (resolved.tests.length === 0) {
      return { pieces: [], error: 'unmappedChangeRun resolved to 0 tests' };
    }
    return { pieces: testsToLocations(resolved.tests, tests) };
  }

  const covered = tests.some((test) => directoryCovers(config.testDir, test.file));
  if (!covered) return { pieces: [], error: 'testDir contains no tests' };
  return {
    pieces: [{ kind: 'dir', path: normalizeRepoPath(config.testDir), trailingSlash: false }],
  };
}

function changedSpecs(
  changedPaths: string[],
  testDir: string,
  tests: TestCase[],
  fileExists: (repoRelativePath: string) => boolean,
): string[] {
  const specs = new Set<string>();
  for (const file of changedPaths) {
    const normalized = normalizeRepoPath(file);
    if (!isChangedSpec(normalized, testDir, tests) || !fileExists(normalized)) continue;
    specs.add(normalized);
  }
  return [...specs];
}

function isChangedSpec(file: string, testDir: string, tests: TestCase[]): boolean {
  const normalized = normalizeRepoPath(file);
  if (!directoryCovers(testDir, normalized) || !normalized.endsWith('.spec.ts')) return false;
  return tests.some((test) => test.file === normalized);
}

function isSpec(file: string, tests: TestCase[]): boolean {
  const normalized = normalizeRepoPath(file);
  return tests.some((test) => test.file === normalized);
}

function matchesAnyMapping(file: string, config: ResolvedConfig): boolean {
  return config.runMapping.some((mapping) =>
    mapping.changedPaths.some((pattern) => pathMatches(pattern, file)),
  );
}

function resolveTagList(
  tags: string[],
  field: string,
  tests: TestCase[],
): { tests: TestCase[]; error?: string } {
  if (tags.length === 0) return { tests: [] };
  const matched: TestCase[] = [];
  for (const tag of tags) {
    if (!tag.startsWith('@')) return { tests: [], error: `${field}: ${tag} is not a tag` };
    const found = tests.filter((test) => test.tags.includes(tag));
    if (found.length === 0) return { tests: [], error: `${field}: ${tag} not found` };
    matched.push(...found);
  }
  return { tests: matched };
}

function resolveSelector(
  selector: string,
  field: string,
  tests: TestCase[],
  isDirectory: (repoRelativePath: string) => boolean,
): { pieces: Piece[]; error?: string } {
  if (selector.startsWith('@')) {
    const resolved = resolveTagList([selector], field, tests);
    if (resolved.error) return { pieces: [], error: resolved.error };
    return { pieces: testsToLocations(resolved.tests, tests) };
  }

  const normalized = normalizeRepoPath(selector);
  if (selector.endsWith('/') || isDirectory(normalized)) {
    const covered = tests.filter((test) => directoryCovers(normalized, test.file));
    if (covered.length === 0) return { pieces: [], error: `${field}: ${selector} not found` };
    return {
      pieces: [{ kind: 'dir', path: normalized, trailingSlash: true }],
    };
  }

  if (looksLikeSpec(selector) || tests.some((test) => test.file === normalized)) {
    const covered = tests.filter((test) => test.file === normalized);
    if (covered.length === 0) return { pieces: [], error: `${field}: ${selector} not found` };
    return { pieces: [{ kind: 'file', path: normalized, trailingSlash: false }] };
  }

  const named = tests.filter((test) => test.title === selector);
  if (named.length === 0) return { pieces: [], error: `${field}: ${selector} not found` };
  return { pieces: testsToLocations(named, tests) };
}

function testsToLocations(selected: TestCase[], inventory: TestCase[]): Piece[] {
  return selected.map((test) => {
    const sharedLine = inventory.filter(
      (candidate) => candidate.file === test.file && candidate.line === test.line,
    );
    return {
      kind: 'loc' as const,
      path: test.file,
      line: test.line,
      column: sharedLine.length > 1 ? test.column : undefined,
      trailingSlash: false,
    };
  });
}

function piecesToArgs(pieces: Piece[]): string[] {
  const dirs = dedupe(pieces.filter((piece) => piece.kind === 'dir'), (piece) => piece.path);
  const files = dedupe(pieces.filter((piece) => piece.kind === 'file'), (piece) => piece.path);
  const locs = dedupe(
    pieces.filter((piece) => piece.kind === 'loc'),
    (piece) => `${piece.path}:${piece.line}:${piece.column ?? ''}`,
  );

  const keptDirs = dirs.filter(
    (dir) => !dirs.some((other) => other !== dir && directoryCovers(other.path, dir.path)),
  );
  const keptFiles = files.filter((file) => !keptDirs.some((dir) => directoryCovers(dir.path, file.path)));
  const keptLocs = locs.filter((loc) => {
    if (keptDirs.some((dir) => directoryCovers(dir.path, loc.path))) return false;
    return !keptFiles.some((file) => file.path === loc.path);
  });

  const args = [
    ...keptDirs.map((dir) => dir.trailingSlash ? `${dir.path}/` : dir.path),
    ...keptFiles.map((file) => file.path),
    ...keptLocs.map((loc) => loc.column === undefined
      ? `${loc.path}:${loc.line}`
      : `${loc.path}:${loc.line}:${loc.column}`),
  ];
  return [...new Set(args)].sort();
}

function dedupe<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}

function looksLikeSpec(selector: string): boolean {
  return /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(selector);
}
