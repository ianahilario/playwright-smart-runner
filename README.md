# playwright-smart-runner

Print the Playwright arguments for tests affected by changes since a base branch. The command does not launch Playwright.

```bash
npx playwright-smart-runner
npx playwright-smart-runner --list
npx playwright-smart-runner --config ./playwright-smart-runner.config.ts
npx playwright-smart-runner --base origin/main
```

`--base` overrides `baseBranch` from the config. Leave it off to use the branch named in the config, usually `main`. Pass `--base origin/main` only when that remote ref is already fetched and local `main` is missing or stale.

## Config

`playwright-smart-runner.config.ts`:

```ts
import { defineConfig } from 'playwright-smart-runner';

export default defineConfig({
  testDir: './tests',
  baseBranch: 'main',
  alwaysRunOnChange: ['@smoke'],
  ignorePaths: ['docs/**', '**/*.md'],
  passWithNoMappedTest: false,
  runChangedTests: true,
  unmappedChangeRun: ['@smoke'],
  runMapping: [
    {
      changedPaths: ['src/checkout/**'],
      runTests: ['@checkout', 'tests/checkout/', 'completes checkout'],
    },
  ],
});
```

`changedPaths` and `ignorePaths` match git paths from the repo root. `tests/checkout/` matches that directory and everything inside it, the same as `tests/checkout/**`. Other patterns are globs.

`runTests` entries are a tag (`@checkout`), a directory (`tests/checkout/`), a spec file, or an exact test title. A directory or spec file runs every test in it. A tag or title becomes `file:line`, and `file:line:column` when two tests share a line.

`alwaysRunOnChange` is included only when a change is outside `ignorePaths`. An empty diff, or a diff that only touches `ignorePaths`, prints nothing and exits 0. Those tags are not resolved.

`passWithNoMappedTest` looks only at `runMapping`. A changed spec file does not count as a mapped test. When no `changedPaths` entry matches, `false` exits 1 with `no mapped tests`. `true` uses `unmappedChangeRun`, or prints `testDir` once when that list is omitted.

`runChangedTests` defaults to `false`. When it is `true`, each changed `.spec.ts` file under `testDir` is added to the run list. A deleted spec is left out. If those spec files are the only relevant changes, they run with `alwaysRunOnChange` and do not count as an unmapped change.

A missing config file, `testDir`, or a tag, directory, spec, or title that this run uses exits 1 and prints no arguments.

## Run the selection

```bash
args=$(npx playwright-smart-runner)
status=$?
if [ "$status" -ne 0 ]; then
  exit "$status"
fi
if [ -n "$args" ]; then
  eval "npx playwright test $args"
fi
```

A mapped checkout change can print:

```text
tests/checkout/ tests/auth.spec.ts:12 tests/auth.spec.ts:40
```

which runs as:

```bash
npx playwright test tests/checkout/ tests/auth.spec.ts:12 tests/auth.spec.ts:40
```

`tests/checkout/` runs every test in that directory. `tests/auth.spec.ts:12` runs only the test at that line. Extra Playwright flags go on the same command:

```bash
eval "npx playwright test $args --project=chromium"
```

`--list` prints the same arguments, one per line.

The empty check is required. An ignore-only diff exits 0 with no output, and `npx playwright test` without arguments would run the whole suite. A missing config value also exits 1 with no output, so check the status before treating empty output as a skip.

## Sample

`sample/` is a small Playwright app used by the end-to-end test. It maps `src/checkout/**` to `tests/checkout/` and always runs `@smoke`.

## CI

The diff uses `git merge-base` against the base branch, then `git diff` from that commit. It does not diff against the tip of `main`. A shallow checkout often does not contain the merge base:

```bash
git fetch --unshallow origin main
```

`--base origin/main` works only after that ref has been fetched.
