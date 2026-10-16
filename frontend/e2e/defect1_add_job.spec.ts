import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test('add job via UI path and confirm row exists in SQLite DB', async ({ page, request }) => {
  // Navigate to add job wizard
  await page.goto('/add-job');

  // Verify Step 1 is loaded
  await expect(page.locator('text=Step 1:')).toBeVisible();

  // Click Step 1 -> Next: Upload Resume
  const nextToResumeBtn = page.locator('button', { hasText: 'Next: Upload Resume' });
  await expect(nextToResumeBtn).toBeVisible();
  await nextToResumeBtn.click();

  // Verify Step 2 is loaded
  await expect(page.locator('text=Step 2:')).toBeVisible();

  // Click Step 2 -> Next: Select Repositories
  const nextToReposBtn = page.locator('button', { hasText: 'Next: Select Repositories' });
  await expect(nextToReposBtn).toBeVisible();
  await nextToReposBtn.click();

  // Verify Step 3 is loaded
  await expect(page.locator('text=Step 3:')).toBeVisible();

  // Click Step 3 -> Next: Run Analysis
  const nextToAnalysisBtn = page.locator('button', { hasText: 'Next: Run Analysis' });
  await expect(nextToAnalysisBtn).toBeVisible();
  await nextToAnalysisBtn.click();

  // Step 4: Verification Pipeline - wait for completion
  const viewResultsBtn = page.locator('button', { hasText: 'View Full Assessment Results' });
  await expect(viewResultsBtn).toBeVisible({ timeout: 15000 });
  await viewResultsBtn.click();

  // Verify redirected away from /add-job
  await expect(page).not.toHaveURL(/\/add-job/);

  // 1. Confirm through API health diagnostics
  const healthResp = await request.get('http://127.0.0.1:8000/api/health');
  expect(healthResp.ok()).toBeTruthy();
  const healthData = await healthResp.json();
  expect(healthData.row_counts.jobs).toBeGreaterThan(0);

  // 2. Direct SQLite validation
  const dbPath = path.resolve(process.cwd(), '../devproof.db');
  const pythonCmd = `python -c "import sqlite3; conn = sqlite3.connect(r'${dbPath}'); cur = conn.cursor(); cur.execute('SELECT count(*) FROM jobs'); print(cur.fetchone()[0])"`;
  const countOutput = execSync(pythonCmd, { encoding: 'utf-8' }).trim();
  const jobRowCount = parseInt(countOutput, 10);
  expect(jobRowCount).toBeGreaterThan(0);
});
