import { test, expect } from '@playwright/test';
import path from 'path';

test('Step 4: real GitHub repo selector, scope validation, badges, and Not Mine warning', async ({ page }) => {
  await page.goto('/add-job');
  await expect(page.locator('text=Step 1:')).toBeVisible();

  // Step 1 -> Step 2 via stepper
  await page.getByText('Resume', { exact: true }).click();
  await expect(page.locator('text=Step 2:')).toBeVisible();

  // Upload resume_a.pdf which contains sranjit29794-bit
  const resumeAPath = path.resolve(process.cwd(), '../docs/demo/resume_a.pdf');
  await page.locator('input[data-testid="resume-file-input"]').setInputFiles(resumeAPath);
  await expect(page.getByText('Source: resume_a.pdf')).toBeVisible({ timeout: 10000 });

  // Step 2 -> Step 3
  await page.locator('button', { hasText: 'Next: Select Repositories' }).click();
  await expect(page.locator('text=Step 3:')).toBeVisible();

  // Verify username input is prefilled with sranjit29794-bit from resume
  const usernameInput = page.locator('[data-testid="github-username-input"]');
  await expect(usernameInput).toHaveValue('sranjit29794-bit');

  // Trigger fetch if not auto-fetched
  const fetchBtn = page.locator('[data-testid="fetch-repos-btn"]');
  await fetchBtn.click();

  // Expect real repository student-api to appear with Python language chip
  const studentApiItem = page.locator('[data-testid="repo-item-student-api"]');
  await expect(studentApiItem).toBeVisible({ timeout: 15000 });
  await expect(studentApiItem).toContainText('Python');

  // Select student-api and verify Scope Report appears
  await studentApiItem.click();
  const scopeReport = page.locator('[data-testid="scope-report-student-api"]');
  await expect(scopeReport).toBeVisible({ timeout: 15000 });
  await expect(scopeReport).toContainText('Scope Report:');
  await expect(scopeReport).toContainText('SHA:');

  // Test "Not mine?" warning by changing username to another user
  await usernameInput.fill('torvalds');
  const notMineWarning = page.locator('[data-testid="owner-mismatch-warning"]');
  await expect(notMineWarning).toBeVisible();
  await expect(notMineWarning).toContainText('Not mine?');

  // Test custom repo URL connection with missing repo (expect error)
  const customUrlInput = page.locator('[data-testid="custom-repo-url-input"]');
  await customUrlInput.fill('https://github.com/sranjit29794-bit/non-existent-repo-12345');
  await page.locator('[data-testid="connect-custom-repo-btn"]').click();
  const customErrorBanner = page.locator('[data-testid="custom-repo-error-banner"]');
  await expect(customErrorBanner).toBeVisible({ timeout: 15000 });
});
