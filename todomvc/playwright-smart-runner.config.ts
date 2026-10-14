export default {
  testDir: './tests',
  baseBranch: 'main',
  alwaysRunOnChange: ['@smoke'],
  ignorePaths: ['docs/**', '**/*.md'],
  passWithNoMappedTest: false,
  unmappedChangeRun: ['@smoke'],
  runMapping: [
    {
      changedPaths: ['src/todos/**'],
      runTests: ['tests/todos/', 'adds a todo'],
    },
  ],
};
