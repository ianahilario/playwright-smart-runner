import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { createJiti } from 'jiti';
import { normalizeRepoPath } from './paths.js';
import type { ResolvedConfig, RunMapping, SmartRunnerConfig } from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export const defaultConfigName = 'playwright-smart-runner.config.ts';

export async function loadConfig(configPath: string): Promise<SmartRunnerConfig> {
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loaded: unknown = await jiti.import(configPath);
  const config = unwrapConfig(loaded);
  if (!config || typeof config !== 'object') {
    throw new ConfigError(`config did not export an object: ${configPath}`);
  }
  return config;
}

export function resolveConfig(config: SmartRunnerConfig, configPath: string, repoRoot: string): ResolvedConfig {
  if (!config.testDir || typeof config.testDir !== 'string') {
    throw new ConfigError('testDir is required');
  }

  const absoluteTestDir = path.resolve(path.dirname(configPath), config.testDir);
  if (!existsSync(absoluteTestDir) || !statSync(absoluteTestDir).isDirectory()) {
    throw new ConfigError(`testDir does not exist: ${absoluteTestDir}`);
  }

  const relativeTestDir = path.relative(repoRoot, absoluteTestDir);
  const testDir = relativeTestDir === '' ? '.' : normalizeRepoPath(relativeTestDir);

  return {
    testDir,
    baseBranch: config.baseBranch?.trim() || 'main',
    alwaysRunOnChange: stringList(config.alwaysRunOnChange, 'alwaysRunOnChange'),
    ignorePaths: stringList(config.ignorePaths, 'ignorePaths'),
    passWithNoMappedTest: config.passWithNoMappedTest ?? false,
    runChangedTests: config.runChangedTests ?? false,
    unmappedChangeRun: config.unmappedChangeRun === undefined
      ? undefined
      : stringList(config.unmappedChangeRun, 'unmappedChangeRun'),
    runMapping: mappingList(config.runMapping),
  };
}

export function resolveConfigPath(cwd: string, configArg: string | undefined): string {
  if (configArg) return path.resolve(cwd, configArg);
  return path.join(cwd, defaultConfigName);
}

function unwrapConfig(loaded: unknown): SmartRunnerConfig | undefined {
  if (!loaded || typeof loaded !== 'object') return undefined;
  const record = loaded as Record<string, unknown>;
  const candidate = 'default' in record ? record.default : loaded;
  if (candidate && typeof candidate === 'object' && 'default' in (candidate as Record<string, unknown>)) {
    const nested = (candidate as { default?: unknown }).default;
    if (nested && typeof nested === 'object') return nested as SmartRunnerConfig;
  }
  return candidate as SmartRunnerConfig;
}

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new ConfigError(`${field} must be an array of strings`);
  }
  return value;
}

function mappingList(value: unknown): RunMapping[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ConfigError('runMapping must be an array');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new ConfigError(`runMapping[${index}] must be an object`);
    }
    const mapping = entry as Partial<RunMapping>;
    return {
      changedPaths: stringList(mapping.changedPaths, `runMapping[${index}].changedPaths`),
      runTests: stringList(mapping.runTests, `runMapping[${index}].runTests`),
    };
  });
}
