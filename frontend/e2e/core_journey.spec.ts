import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

test.describe('SkillBridge AI - Microsoft Edge E2E Core Journey', () => {
  test.describe.configure({ mode: 'serial' });

  test('navigates through tabs and verifies view rendering in Microsoft Edge', async ({ page }) => {

    // 1. Visit root URL
    await page.goto('/');

    // 2. Check Navbar Brand specifically in header
    await expect(page.locator('header').getByText('SkillBridge AI')).toBeVisible();

    // 3. Switch to Profile & Evidence tab
    await page.click('button:has-text("Profile & Evidence")');
    await expect(page.locator('h1:has-text("Learner Career Profile & Evidence")')).toBeVisible();

    // 4. Switch to Job Analysis tab
    await page.click('button:has-text("Job & Goal Analysis")');
    await expect(page.locator('h1:has-text("Target Requirement Analysis & Feasibility")')).toBeVisible();

    // 5. Test filling job description input
    const textarea = page.locator('textarea');
    await textarea.fill('Backend developer required with Python, Django, PostgreSQL, and API testing.');
    await page.click('button:has-text("Extract Requirements")');

    // 6. Switch to Skill Gap Report tab
    await page.click('button:has-text("Skill Gap Report")');
    await expect(page.locator('h1:has-text("Skill Gap Matching & Feasibility Report")')).toBeVisible();

    // 7. Switch to Practical Tasks tab
    await page.click('button:has-text("Practical Tasks")');
    await expect(page.locator('h1:has-text("Controlled API Testing Assessment"), h1:has-text("Practical")')).toBeVisible();

    // 8. Switch to Roadmap tab
    await page.click('button:has-text("Roadmap")');
    await expect(page.locator('h1:has-text("Learner Roadmap & Progress Plan")')).toBeVisible();
  });

  test('uploads resume and activates S3 and SQS cloud pipeline', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto('/');
    await page.click('button:has-text("Profile & Evidence")');
    await expect(page.locator('h1:has-text("Learner Career Profile & Evidence")')).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'react_frontend_resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 React Frontend E2E Resume Content')
    });

    await page.click('button:has-text("Upload & Parse CV")');

    await expect(page.getByText('Cloud Pipeline Activated')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Amazon S3 Storage:')).toBeVisible();
    await expect(page.getByText('Amazon SQS Queue ➔ Lambda:')).toBeVisible();
  });
});

