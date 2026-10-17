import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Step 7: End-to-End Real Stack Verification', () => {
  test('full flow with real data, DB persistence, reload, and screenshots', async ({ page }) => {
    test.setTimeout(90000);

    const screenshotsDir = path.resolve(process.cwd(), '../docs/demo/real');

    // 1. Navigate to /add-job
    console.log('Step 7.1: Navigating to Add Job wizard...');
    await page.goto('/add-job');
    await expect(page.locator('text=Step 1:')).toBeVisible();

    // 2. Step 1: Job setup with pasted real job text
    const titleInput = page.locator('[data-testid="job-title-input"]');
    await titleInput.fill('Senior Backend Engineer');

    const companyInput = page.locator('[data-testid="job-company-input"]');
    await companyInput.fill('RealCorp Platforms');

    const jobTextInput = page.locator('[data-testid="job-text-input"]');
    await jobTextInput.fill(`
      We are looking for a Senior Backend Engineer at RealCorp.
      Requirements:
      - Deep expertise in Python and FastAPI for building microservices.
      - Strong experience with SQL database optimization, schema design, and SQLite/PostgreSQL.
      - Experience with Docker containerization and CI/CD pipelines.
      - Unit testing and test-driven development.
    `);

    // Click Extract Requirements
    const extractBtn = page.locator('[data-testid="extract-text-btn"]');
    await extractBtn.click();

    // Verify extracted requirements appear
    await expect(page.getByText('No technical requirements extracted yet')).not.toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('next-to-resume-btn')).toBeEnabled({ timeout: 20000 });
    await page.screenshot({ path: path.join(screenshotsDir, '01_job_extracted.png') });
    console.log('Saved 01_job_extracted.png');

    // 3. Step 2: Upload resume_a.pdf
    const nextToResumeBtn = page.getByTestId('next-to-resume-btn');
    await expect(nextToResumeBtn).toBeEnabled();
    await nextToResumeBtn.click();
    await expect(page.locator('text=Step 2:')).toBeVisible();

    const resumeAPath = path.resolve(process.cwd(), '../docs/demo/resume_a.pdf');
    await page.locator('input[data-testid="resume-file-input"]').setInputFiles(resumeAPath);

    // Verify visible GitHub link and E0 claim
    await expect(page.getByText('Source: resume_a.pdf')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=E0 Claim').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '02_resume_uploaded.png') });
    console.log('Saved 02_resume_uploaded.png');

    // 4. Step 3: Select real GitHub repository
    const nextToReposBtn = page.locator('button', { hasText: 'Next: Select Repositories' });
    await nextToReposBtn.click();
    await expect(page.locator('text=Step 3:')).toBeVisible();

    // Expect repos list loaded for sranjit29794-bit
    const studentApiItem = page.locator('[data-testid="repo-item-student-api"]');
    await expect(studentApiItem).toBeVisible({ timeout: 15000 });

    // Click repo to select and trigger Scope Report
    await studentApiItem.click();
    const scopeReport = page.locator('[data-testid="scope-report-student-api"]');
    await expect(scopeReport).toBeVisible({ timeout: 15000 });
    await expect(scopeReport).toContainText('Scope Report:');
    await page.screenshot({ path: path.join(screenshotsDir, '03_repo_scoped.png') });
    console.log('Saved 03_repo_scoped.png');

    // 5. Step 4: Run Analysis
    const nextToAnalysisBtn = page.locator('button', { hasText: 'Next: Run Analysis' });
    await nextToAnalysisBtn.click();
    await expect(page.locator('text=Step 4: Automated Verification Pipeline')).toBeVisible();

    // Wait for analysis to complete and results button to appear
    const viewResultsBtn = page.locator('button', { hasText: 'View Full Assessment Results' });
    await expect(viewResultsBtn).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(screenshotsDir, '04_analysis_complete.png') });
    console.log('Saved 04_analysis_complete.png');

    // 6. View Results View
    await viewResultsBtn.click();

    // Verify Results View elements per Step 6:
    // - Summary row with plain counts
    // - Persistent Invariant #10 banner
    // - Evidence rung / citations / "what would raise this"
    await expect(page.getByText('Assessment Summary:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Not demonstrated means not found in the analyzed scope/i)).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '05_results_cards.png') });
    console.log('Saved 05_results_cards.png');

    // 7. Page Reload test: Data persists from real DB
    console.log('Reloading page to verify DB persistence...');
    await page.reload();
    await expect(page.getByText('Assessment Summary:')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Not demonstrated means not found in the analyzed scope/i)).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '06_reloaded_cards.png') });
    console.log('Saved 06_reloaded_cards.png');

    // 8. Dashboard verification
    console.log('Navigating to Dashboard...');
    await page.goto('/');
    await expect(page.getByText('Tracked Opportunities')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Senior Backend Engineer').first()).toBeVisible();
    await expect(page.getByText('RealCorp Platforms').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '07_dashboard_tracks.png') });
    console.log('Saved 07_dashboard_tracks.png');
  });
});
