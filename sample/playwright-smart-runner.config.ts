export default {
  testDir: './tests',
  baseBranch: 'main',
  alwaysRunOnChange: ['@smoke'],
  ignorePaths: ['docs/**', '**/*.md'],
  passWithNoMappedTest: false,
  unmappedChangeRun: ['@smoke'],
  runMapping: [
    {
      changedPaths: ['src/checkout/**'],
      runTests: ['tests/checkout/', 'completes checkout'],
    },
  ],
};
