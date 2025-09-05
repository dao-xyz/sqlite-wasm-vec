// @ts-check
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => console.log('[page]', msg.type(), msg.text()));
});

test.describe('sqlite-wasm-vec', () => {
  test.setTimeout(30000);
  test('import-only exposes default and worker promiser', async ({ page }) => {
    await page.goto('http://127.0.0.1:4321/tests/test-import-only.html');
    await expect(page.locator('body')).toHaveAttribute('data-default', 'yes');
    await expect(page.locator('body')).toHaveAttribute('data-promiser', 'yes');
  });

  test('imports and exposes sqlite-vec (main thread)', async ({ page }) => {
    await page.goto('http://127.0.0.1:4321/tests/test-page.html');
    // Wait for WASM to initialize and test script to run
    await expect(page.locator('body')).toHaveAttribute('data-vec', /.+/);
    await expect(page.locator('body')).toHaveAttribute('data-vec-demo', 'ok');
  });

  test('unified API (wasm mode) works', async ({ page }) => {
    await page.goto('http://127.0.0.1:4321/tests/test-unified.html');
    await expect(page.locator('body')).toHaveAttribute('data-unified', 'ok');
  });
});
