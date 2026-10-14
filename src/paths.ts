import path from 'node:path';
import picomatch from 'picomatch';

export function toPosix(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

export function normalizeRepoPath(filePath: string): string {
  const posix = toPosix(filePath).replace(/^\.\//, '');
  const parts: string[] = [];
  for (const part of posix.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

export function repoRelative(repoRoot: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    const relative = path.relative(repoRoot, filePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return normalizeRepoPath(filePath);
    return normalizeRepoPath(relative);
  }
  return normalizeRepoPath(filePath);
}

export function pathMatches(pattern: string, file: string): boolean {
  const normalizedFile = normalizeRepoPath(file);
  if (pattern.endsWith('/')) {
    return matchesDirectoryPrefix(pattern, normalizedFile);
  }
  if (picomatch(pattern, { dot: true })(normalizedFile)) return true;
  if (pattern.endsWith('/**')) {
    return matchesDirectoryPrefix(pattern.slice(0, -2), normalizedFile);
  }
  return false;
}

function matchesDirectoryPrefix(pattern: string, file: string): boolean {
  const prefix = normalizeRepoPath(pattern);
  return file === prefix || file.startsWith(`${prefix}/`);
}

export function directoryCovers(directory: string, file: string): boolean {
  const prefix = normalizeRepoPath(directory);
  const normalizedFile = normalizeRepoPath(file);
  return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
}
