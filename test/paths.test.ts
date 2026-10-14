import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { directoryCovers, pathMatches } from '../src/paths.js';

describe('pathMatches', () => {
  it('treats a trailing slash as the directory and everything inside it', () => {
    assert.equal(pathMatches('tests/checkout/', 'tests/checkout/pay.spec.ts'), true);
    assert.equal(pathMatches('tests/checkout/', 'tests/checkout'), true);
    assert.equal(pathMatches('tests/checkout/', 'tests/checkout-extra/a.ts'), false);
  });

  it('matches glob ignore patterns', () => {
    assert.equal(pathMatches('docs/**', 'docs/guide.md'), true);
    assert.equal(pathMatches('**/*.md', 'README.md'), true);
    assert.equal(pathMatches('**/*.md', 'docs/guide.md'), true);
    assert.equal(pathMatches('docs/**', 'src/app.ts'), false);
  });
});

describe('directoryCovers', () => {
  it('covers nested files and not sibling directories', () => {
    assert.equal(directoryCovers('tests', 'tests/auth.spec.ts'), true);
    assert.equal(directoryCovers('tests/checkout', 'tests/checkout/pay.spec.ts'), true);
    assert.equal(directoryCovers('tests/checkout', 'tests/auth.spec.ts'), false);
  });
});
