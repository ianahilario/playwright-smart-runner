import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatArgs } from '../src/output.js';

describe('formatArgs', () => {
  it('prints one shell line', () => {
    assert.equal(
      formatArgs(['tests/checkout/', 'tests/auth.spec.ts:12'], false),
      'tests/checkout/ tests/auth.spec.ts:12\n',
    );
  });

  it('prints one argument per line for --list', () => {
    assert.equal(
      formatArgs(['tests/checkout/', 'tests/auth.spec.ts:12'], true),
      'tests/checkout/\ntests/auth.spec.ts:12\n',
    );
  });

  it('quotes arguments that the shell would split', () => {
    assert.equal(formatArgs(['tests/my spec.ts:4'], false), "'tests/my spec.ts:4'\n");
  });

  it('prints nothing when there are no arguments', () => {
    assert.equal(formatArgs([], false), '');
    assert.equal(formatArgs([], true), '');
  });
});
