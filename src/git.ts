import { execFileSync } from 'node:child_process';
import { normalizeRepoPath } from './paths.js';

export class GitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitError';
  }
}

export function repoRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}

export function listChangedPaths(repoRootPath: string, base: string): string[] {
  if (!refExists(repoRootPath, base)) {
    throw new GitError(
      `base ref '${base}' not found. Fetch it first, for example: git fetch origin ${base}`,
    );
  }

  let mergeBase: string;
  try {
    mergeBase = git(repoRootPath, ['merge-base', 'HEAD', base]).trim();
  } catch {
    throw new GitError(
      `cannot find merge base with '${base}'. Fetch it first, for example: git fetch --unshallow origin ${base}`,
    );
  }

  const diff = git(repoRootPath, [
    'diff',
    '--name-only',
    '--diff-filter=ACMRD',
    mergeBase,
  ]);
  const untracked = git(repoRootPath, ['ls-files', '--others', '--exclude-standard']);
  const paths = new Set<string>();
  for (const line of `${diff}\n${untracked}`.split('\n')) {
    const trimmed = line.trim();
    if (trimmed) paths.add(normalizeRepoPath(trimmed));
  }
  return [...paths];
}

function refExists(repoRootPath: string, ref: string): boolean {
  try {
    git(repoRootPath, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error instanceof Error && 'stderr' in error
      ? String((error as { stderr?: unknown }).stderr ?? '')
      : '';
    throw new GitError(stderr.trim() || `git ${args.join(' ')} failed`);
  }
}
