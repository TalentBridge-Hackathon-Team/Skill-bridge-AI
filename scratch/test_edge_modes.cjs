const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\9122a6a6-59ed-46f3-b228-1caea70b7372';

(async () => {
  console.log('--- Launching Microsoft Edge via Playwright ---');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:5173/?tab=gaps ...');
  await page.goto('http://localhost:5173/?tab=gaps', { waitUntil: 'domcontentloaded' });

  // 1. Initial live Neon DB match
  console.log('Waiting for initial live Neon DB match...');
  await page.waitForSelector('text=Target Role Readiness', { timeout: 45000 });
  await page.waitForTimeout(1000);

  // 2. Mode A Capture
  console.log('Clicking Mode A filter...');
  const modeAButton = page.locator('button:has-text("Mode A: Job-Specific")');
  await modeAButton.click();
  await page.waitForTimeout(1000);
  const modeAPath = path.join(ARTIFACT_DIR, 'edge_mode_a_live.png');
  await page.screenshot({ path: modeAPath, fullPage: true });
  console.log('Saved Mode A screenshot to:', modeAPath);

  // 3. Mode B Capture
  console.log('Clicking Mode B filter...');
  const modeBButton = page.locator('button:has-text("Mode B: Goal-Based")');
  await modeBButton.click();
  
  console.log('Waiting for Mode B calculation to finish in Neon DB...');
  await page.waitForSelector('text=Calculating deterministic skill match...', { state: 'detached', timeout: 45000 });
  await page.waitForSelector('text=Target Role Readiness', { timeout: 45000 });
  await page.waitForTimeout(1000);

  const modeBPath = path.join(ARTIFACT_DIR, 'edge_mode_b_live.png');
  await page.screenshot({ path: modeBPath, fullPage: true });
  console.log('Saved Mode B screenshot to:', modeBPath);

  // 4. Custom Role Modal
  console.log('Opening Custom Role Modal...');
  const customRoleButton = page.locator('button:has-text("Analyze Custom Role")');
  await customRoleButton.click();
  await page.waitForTimeout(1000);

  const presetBtn = page.locator('button:has-text("Senior Frontend Engineer")').first();
  if (await presetBtn.isVisible()) {
    await presetBtn.click();
  }
  await page.waitForTimeout(800);

  const customModalPath = path.join(ARTIFACT_DIR, 'edge_custom_modal_live.png');
  await page.screenshot({ path: customModalPath, fullPage: true });
  console.log('Saved Custom Modal screenshot to:', customModalPath);

  // 5. Submit Custom Role and Wait for AI Analysis
  console.log('Submitting custom role to AI extraction backend + Neon DB...');
  const submitBtn = page.locator('button:has-text("Analyze with AI & Match")');
  await submitBtn.click();

  console.log('Waiting for AI extraction and calculation to complete in Neon DB...');
  await page.waitForSelector('text=Calculating deterministic skill match...', { state: 'detached', timeout: 45000 });
  await page.waitForSelector('text=Target Role Readiness', { timeout: 45000 });
  await page.waitForTimeout(1500);

  const customAnalyzedPath = path.join(ARTIFACT_DIR, 'edge_custom_role_analyzed_live.png');
  await page.screenshot({ path: customAnalyzedPath, fullPage: true });
  console.log('Saved Custom Role Analyzed screenshot to:', customAnalyzedPath);

  await browser.close();
  console.log('--- All Edge Verifications Completed Successfully ---');
})();
