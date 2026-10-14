export interface RunMapping {
  changedPaths: string[];
  runTests: string[];
}

export interface SmartRunnerConfig {
  testDir: string;
  baseBranch?: string;
  alwaysRunOnChange?: string[];
  ignorePaths?: string[];
  passWithNoMappedTest?: boolean;
  runChangedTests?: boolean;
  unmappedChangeRun?: string[];
  runMapping?: RunMapping[];
}

export interface ResolvedConfig {
  testDir: string;
  baseBranch: string;
  alwaysRunOnChange: string[];
  ignorePaths: string[];
  passWithNoMappedTest: boolean;
  runChangedTests: boolean;
  unmappedChangeRun?: string[];
  runMapping: RunMapping[];
}

export interface TestCase {
  file: string;
  line: number;
  column: number;
  title: string;
  tags: string[];
}

export type SelectResult =
  | { status: 'skip' }
  | { status: 'error'; message: string }
  | { status: 'run'; args: string[] };
