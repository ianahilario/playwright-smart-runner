import { test } from '@playwright/test';
import { hit } from '../record';

test('completes checkout', () => hit('completes checkout'));
test('pays with a card', () => hit('pays with a card'));
