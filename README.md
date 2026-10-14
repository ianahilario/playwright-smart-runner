# playwright-smart-runner

Lists tests based on configured mapping for changes. The command does not launch Playwright.

[npm package](https://www.npmjs.com/package/playwright-smart-runner)

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

`alwaysRunOnChange` is included only when a change is outside `ignorePaths`. Omit it, or leave it empty, and no extra tests are added. An empty diff, or a diff that only touches `ignorePaths`, prints nothing and exits 0. Those tags are not resolved.

`passWithNoMappedTest` looks only at `runMapping`. A changed spec file does not count as a mapped test. When no `changedPaths` entry matches, `false` exits 1 with `no mapped tests`. `true` uses `unmappedChangeRun`, or prints `testDir` once when that list is omitted.

`runChangedTests` defaults to `false`. When it is `true`, each changed `.spec.ts` file under `testDir` is added to the run list. A deleted spec is left out. If those spec files are the only relevant changes, they run with `alwaysRunOnChange` and do not count as an unmapped change.

A missing config file, `testDir`, or a tag, directory, spec, or title that this run uses exits 1 and prints no arguments.

## CI

The command lists changes on your branch since the commit where it split from the base branch. Later commits on that base branch are left out. A CI checkout often keeps only the latest commit, so the split commit is missing and the command fails. Fetch the base branch history first, then pass that ref with `--base`.

GitHub Actions, on a pull request:

```yaml
name: tests
on:
  pull_request:

jobs:
  playwright:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Run changed tests
        run: |
          TEST_RUN_LIST=$(npx playwright-smart-runner --base "origin/${{ github.base_ref }}")
          status=$?
          if [ "$status" -ne 0 ]; then
            exit "$status"
          fi
          if [ -n "$TEST_RUN_LIST" ]; then
            eval "npx playwright test $TEST_RUN_LIST"
          fi
```

`fetch-depth: 0` downloads every branch, including the pull request base. `github.base_ref` is that base branch name, such as `main`.

Jenkins:

```groovy
pipeline {
  agent any
  stages {
    stage('Run changed tests') {
      steps {
        sh '''
          if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
            git fetch --unshallow origin main
          else
            git fetch origin main
          fi
          TEST_RUN_LIST=$(npx playwright-smart-runner --base origin/main)
          status=$?
          if [ "$status" -ne 0 ]; then
            exit "$status"
          fi
          if [ -n "$TEST_RUN_LIST" ]; then
            eval "npx playwright test $TEST_RUN_LIST"
          fi
        '''
      }
    }
  }
}
```

`--unshallow` fills in the missing history when the Git plugin used a shallow clone. A full clone only needs `git fetch origin main`.
