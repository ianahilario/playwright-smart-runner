#!/usr/bin/env node
import { existsSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ConfigError, loadConfig, resolveConfig, resolveConfigPath } from './config.js';
import { listChangedPaths, repoRoot } from './git.js';
import { listTests } from './list-tests.js';
import { formatArgs } from './output.js';
import { pathMatches } from './paths.js';
import { selectArgs } from './resolve.js';

export async function runCli(argv: string[]): Promise<number> {
  let values: { base?: string; config?: string; list?: boolean; help?: boolean };
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        base: { type: 'string' },
        config: { type: 'string' },
        list: { type: 'boolean', default: false },
        help: { type: 'boolean', default: false },
      },
      strict: true,
    });
    values = parsed.values;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n${helpText()}`);
    return 1;
  }

  if (values.help) {
    process.stdout.write(helpText());
    return 0;
  }

  try {
    const cwd = process.cwd();
    const root = repoRoot(cwd);
    const configPath = resolveConfigPath(cwd, values.config);
    if (!existsSync(configPath)) {
      throw new ConfigError(`config not found: ${configPath}`);
    }

    const loaded = await loadConfig(configPath);
    const config = resolveConfig(loaded, configPath, root);
    const changed = listChangedPaths(root, values.base ?? config.baseBranch);
    const relevant = changed.filter(
      (file) => !config.ignorePaths.some((pattern) => pathMatches(pattern, file)),
    );
    if (relevant.length === 0) return 0;

    const tests = listTests(root, config.testDir);
    const selected = selectArgs(changed, config, tests, {
      isDirectory: (repoRelativePath) => isDirectory(root, repoRelativePath),
      fileExists: (repoRelativePath) => existsSync(path.resolve(root, repoRelativePath)),
    });

    if (selected.status === 'skip') return 0;
    if (selected.status === 'error') {
      process.stderr.write(`${selected.message}\n`);
      return 1;
    }

    const formatted = formatArgs(selected.args, values.list ?? false);
    if (formatted) process.stdout.write(formatted);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

function isDirectory(root: string, repoRelativePath: string): boolean {
  const absolute = path.resolve(root, repoRelativePath);
  return existsSync(absolute) && statSync(absolute).isDirectory();
}

function helpText(): string {
  return `playwright-smart-runner [--base <ref>] [--config <path>] [--list]

Print Playwright test arguments for changes since the base branch.

  --base <ref>     Override the config baseBranch
  --config <path>  Config file (default: playwright-smart-runner.config.ts)
  --list           Print one argument per line
  --help           Show this help
`;
}

export function isDirectInvocation(entry: string | undefined, moduleUrl: string): boolean {
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(entry);
  } catch {
    return false;
  }
}

function invokedDirectly(): boolean {
  return isDirectInvocation(process.argv[1], import.meta.url);
}

if (invokedDirectly()) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    },
  );
}
