/**
 * Global auth setup for Playwright E2E tests.
 *
 * Currently pages render mock data and do not require authentication.
 * This file writes empty storage-state files so that future plans can
 * swap in real auth (dev-login stub) without changing the test structure.
 */

import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(__dirname, '.auth');
const EMPTY_STATE = JSON.stringify({ cookies: [], origins: [] });

function writeState(filename: string) {
  const target = path.join(STORAGE_DIR, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, EMPTY_STATE, 'utf-8');
}

setup('create lead auth state', () => {
  writeState('lead.json');
});

setup('create head auth state', () => {
  writeState('head.json');
});

setup('create admin auth state', () => {
  writeState('admin.json');
});

setup('create viewer auth state', () => {
  writeState('viewer.json');
});
