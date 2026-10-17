import { test, expect } from '@playwright/test';
import path from 'path';

test('Defect 4: resume upload reproduces resume_a, resume_b, and resume_c_scanned', async ({ page }) => {
  // Navigate to add job wizard and proceed to Step 2 (Resume)
  await page.goto('/add-job');
  await expect(page.locator('text=Step 1:')).toBeVisible();

  const nextToResumeBtn = page.locator('button', { hasText: 'Next: Upload Resume' });
  await expect(nextToResumeBtn).toBeVisible();
  await nextToResumeBtn.click();
  await expect(page.locator('text=Step 2:')).toBeVisible();

  const fileInput = page.locator('input[data-testid="resume-file-input"]');

  // 1. Upload resume_a.pdf (visible text contains GitHub URL)
  const resumeAPath = path.resolve(process.cwd(), '../docs/demo/resume_a.pdf');
  await fileInput.setInputFiles(resumeAPath);

  // Verify extracted visible link and skills
  const githubLinksSection = page.locator('[data-testid="extracted-github-links"]');
  await expect(githubLinksSection).toContainText('https://github.com/sranjit29794-bit/student-api', { timeout: 10000 });
  await expect(githubLinksSection).toContainText('text');
  await expect(page.getByText('Source: resume_a.pdf')).toBeVisible();

  // 2. Upload resume_b.pdf (hyperlink annotation /Annots contains GitHub URL)
  const resumeBPath = path.resolve(process.cwd(), '../docs/demo/resume_b.pdf');
  await fileInput.setInputFiles(resumeBPath);

  // Verify extracted hyperlink annotation
  await expect(githubLinksSection).toContainText('https://github.com/sranjit29794-bit/student-api', { timeout: 10000 });
  await expect(githubLinksSection).toContainText('hyperlink');
  await expect(page.getByText('Source: resume_b.pdf')).toBeVisible();

  // 3. Upload resume_c_scanned.pdf (scanned/image PDF with 0 selectable text)
  const resumeCPath = path.resolve(process.cwd(), '../docs/demo/resume_c_scanned.pdf');
  await fileInput.setInputFiles(resumeCPath);

  // Verify scanned PDF warning is displayed
  const scannedWarning = page.locator('[data-testid="scanned-pdf-warning"]');
  await expect(scannedWarning).toBeVisible({ timeout: 10000 });
  await expect(scannedWarning).toContainText('No selectable text found in this PDF (likely scanned or image-only)');

  // Verify switch to paste-text option is shown and switches view
  const switchToPasteBtn = page.locator('[data-testid="scanned-switch-to-paste-btn"]');
  await expect(switchToPasteBtn).toBeVisible();
  await switchToPasteBtn.click();

  // Confirm paste textarea is now visible
  const pasteTextarea = page.locator('[data-testid="resume-paste-textarea"]');
  await expect(pasteTextarea).toBeVisible();
});
