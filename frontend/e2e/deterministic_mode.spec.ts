import { test, expect } from '@playwright/test';
import path from 'path';

test('verify deterministic-only mode in running UI', async ({ page }) => {
  const screenshotsDir = path.resolve(process.cwd(), '../docs/demo/real');
  await page.goto('/');

  // Verify the deterministic mode chip in the header
  const deterministicChip = page.getByText('Deterministic mode');
  await expect(deterministicChip).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: path.join(screenshotsDir, '08_deterministic_mode_ui.png') });
  console.log('Saved 08_deterministic_mode_ui.png');
});
