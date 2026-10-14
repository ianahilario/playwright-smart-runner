import { test } from '@playwright/test';
import { hit } from './record';

test('signs in', { tag: '@smoke' }, () => hit('signs in'));
test('signs out', { tag: '@smoke' }, () => hit('signs out'));
test('shows help', () => hit('shows help'));
