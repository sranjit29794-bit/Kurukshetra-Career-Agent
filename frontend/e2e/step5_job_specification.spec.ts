import { test, expect } from '@playwright/test';

test.describe('Step 5: Job specification, real and stored', () => {
  test('user pastes job text, extracts requirements, edits, and proceeds', async ({ page }) => {
    // Navigate directly to add-job wizard
    console.log('Navigating to /add-job...');
    await page.goto('/add-job');
    await expect(page.locator('text=Step 1:')).toBeVisible();
    console.log('Step 1 visible');

    // Verify no default job text or requirements
    await expect(page.getByText('No technical requirements extracted yet')).toBeVisible();
    const nextBtn = page.getByTestId('next-to-resume-btn');
    await expect(nextBtn).toBeDisabled();
    console.log('Verified empty requirements');

    // Test LinkedIn warning
    const urlInput = page.locator('[data-testid="job-url-input"]');
    await urlInput.fill('https://www.linkedin.com/jobs/view/123456');
    const fetchBtn = page.locator('[data-testid="fetch-preview-btn"]');
    await fetchBtn.click();
    await expect(page.getByText(/LinkedIn prevents automated scraping/i)).toBeVisible();
    console.log('Verified LinkedIn warning');

    // Enter Job Title & Company
    const titleInput = page.locator('[data-testid="job-title-input"]');
    await titleInput.fill('Lead Platform Engineer');

    const companyInput = page.locator('[data-testid="job-company-input"]');
    await companyInput.fill('LiveCorp');

    // Paste realistic job description
    const jobTextInput = page.locator('[data-testid="job-text-input"]');
    await jobTextInput.fill(`
      We are looking for a Lead Platform Engineer at LiveCorp.
      Requirements:
      - Deep expertise in Python and FastAPI for building microservices.
      - Strong experience with PostgreSQL database optimization and schema design.
      - Experience with Docker containerization and CI/CD pipelines.
      - Production experience with Redis caching.
    `);
    console.log('Filled job description');

    // Click "Extract Requirements from Text"
    const extractBtn = page.locator('[data-testid="extract-text-btn"]');
    console.log('Clicking extract button...');
    await extractBtn.click();
    console.log('Clicked extract button');

    // Requirements should appear and Next button should become enabled
    await expect(page.getByText('No technical requirements extracted yet')).not.toBeVisible();
    await expect(nextBtn).toBeEnabled();

    // Check extracted requirement
    await expect(page.locator('input[value*="Python"]').or(page.locator('input[value*="FastAPI"]')).first()).toBeVisible();

    // Edit a requirement name
    const firstReqInput = page.locator('input[value*="Python"]').or(page.locator('input[value*="FastAPI"]')).first();
    await firstReqInput.fill('Python Core & FastAPI');

    // Proceed to Step 2
    await nextBtn.click();
    await expect(page.locator('text=Step 2:')).toBeVisible();
    await expect(page.getByText('Candidate Resume (E0 Claims)')).toBeVisible();
  });
});
