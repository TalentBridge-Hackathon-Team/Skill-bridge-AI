import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1250 } });

  console.log('Navigating to http://localhost:5173/?tab=gaps ...');
  await page.goto('http://localhost:5173/?tab=gaps', { waitUntil: 'domcontentloaded' });

  // Wait for initial load to finish
  await page.waitForSelector('text=Target Role Readiness', { timeout: 20000 });
  console.log('Initial page loaded!');

  // Click Mode B
  console.log('Clicking Mode B tab...');
  await page.click('button:has-text("Mode B: Goal-Based")');

  // Wait for Mode B calculation to complete
  await page.waitForTimeout(3000);
  await page.waitForSelector('text=Target Role Readiness', { timeout: 20000 });
  console.log('Mode B analysis loaded!');

  const pathModeBFull = 'C:\\Users\\hp\\.gemini\\antigravity-ide\\brain\\9122a6a6-59ed-46f3-b228-1caea70b7372\\edge_mode_b_full_loaded.png';
  await page.screenshot({ path: pathModeBFull, fullPage: true });
  console.log('Saved fully loaded Mode B screenshot to:', pathModeBFull);

  await browser.close();
})();
