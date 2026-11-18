import { test } from '@playwright/test';

test.skip('dashboard UI arrives in Phase 13', async ({ page }) => {
  await page.goto('/');
});
