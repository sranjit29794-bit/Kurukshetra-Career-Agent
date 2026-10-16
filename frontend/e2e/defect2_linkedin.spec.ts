import { test, expect } from '@playwright/test';

test('LinkedIn URL returns needs_paste and UI switches to User-provided with preserved URL', async ({ page }) => {
  // Navigate to Add Job Wizard
  await page.goto('/add-job');

  const urlInput = page.locator('input[type="url"]');
  await expect(urlInput).toBeVisible();

  // Enter LinkedIn job URL
  const linkedinUrl = 'https://www.linkedin.com/jobs/view/4478865041/';
  await urlInput.fill(linkedinUrl);

  // Click Fetch Preview button
  const fetchBtn = page.locator('button', { hasText: 'Fetch Preview' });
  await fetchBtn.click();

  // Verify the badge updates to "User-provided"
  const badge = page.locator('[data-testid="source-badge"]');
  await expect(badge).toBeVisible({ timeout: 10000 });
  await expect(badge).toHaveText(/User-provided/i);

  // Verify URL input still retains the LinkedIn URL as the visible source
  await expect(urlInput).toHaveValue(linkedinUrl);

  // Verify banner or instruction message explains login authentication required
  const banner = page.locator('text=login authentication');
  await expect(banner).toBeVisible();

  // Verify paste textarea is available for text entry
  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
});
