import { test } from '@playwright/test';
import { hit } from './record';

test('should stay quiet', () => hit('should stay quiet'));
