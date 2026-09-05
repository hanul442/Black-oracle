import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = String(process.env.LOCAL_QA_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const outputDir = path.resolve(process.env.LOCAL_QA_OUTPUT_DIR || 'artifacts/local-operator-qa');

const result = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  desktop: { status: 'NOT_RUN', screenshots: [], errors: [] },
  mobile: { status: 'NOT_RUN', screenshots: [], errors: [] },
  overall: 'FAIL',
};

const deviceCases = [
  {
    id: 'desktop',
    viewport: { width: 1440, height: 1000 },
    nav: [
      ['Monitor', 'monitor'],
      ['Positions', 'positions'],
      ['Audit', 'audit'],
      ['Lab', 'lab'],
    ],
  },
  {
    id: 'mobile',
    viewport: { width: 390, height: 844 },
    nav: [
      ['MONITOR', 'monitor'],
      ['POSITIONS', 'positions'],
      ['AUDIT', 'audit'],
      ['LAB', 'lab'],
    ],
  },
];

const ensureNoHorizontalOverflow = async (page, label) => {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  if (metrics.scrollWidth > metrics.width + 2) {
    throw new Error(`${label}: horizontal overflow ${metrics.scrollWidth}px > ${metrics.width}px`);
  }
};

const runDevice = async (browser, device) => {
  const deviceResult = result[device.id];
  const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1 });
  await context.addInitScript(() => localStorage.setItem('oracle_tutorial_seen', 'true'));
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response || !response.ok()) throw new Error(`Local app returned HTTP ${response?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('Authenticate', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await ensureNoHorizontalOverflow(page, `${device.id} login`);

    await page.locator('input[autocomplete="username"]').fill('admin');
    await page.locator('input[autocomplete="current-password"]').fill('oracle');
    await page.getByRole('button', { name: 'Enter command' }).click();

    if (device.id === 'mobile') {
      await page.getByRole('button', { name: 'MONITOR' }).waitFor({ state: 'visible', timeout: 15_000 });
    } else {
      await page.getByText('Monitor', { exact: true }).first().waitFor({ state: 'visible', timeout: 15_000 });
    }

    for (const [label, slug] of device.nav) {
      if (device.id === 'mobile') {
        const button = page.getByRole('button', { name: label });
        await button.click();
        await button.waitFor({ state: 'visible' });
      } else {
        await page.getByText(label, { exact: true }).first().click();
      }
      await page.waitForTimeout(800);
      await ensureNoHorizontalOverflow(page, `${device.id} ${label}`);
      const screenshotName = `${device.id}-${slug}.png`;
      await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: false });
      deviceResult.screenshots.push(screenshotName);
    }

    if (pageErrors.length) throw new Error(`page errors: ${pageErrors.join(' | ')}`);
    deviceResult.status = 'PASS';
  } catch (error) {
    deviceResult.status = 'FAIL';
    deviceResult.errors.push(error instanceof Error ? error.message : String(error));
    deviceResult.errors.push(...pageErrors);
    try {
      const screenshotName = `${device.id}-failure.png`;
      await page.screenshot({ path: path.join(outputDir, screenshotName), fullPage: false });
      deviceResult.screenshots.push(screenshotName);
    } catch {
      // Preserve primary error.
    }
  } finally {
    await context.close();
  }
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const device of deviceCases) await runDevice(browser, device);
} finally {
  await browser.close();
}

result.overall = result.desktop.status === 'PASS' && result.mobile.status === 'PASS' ? 'PASS' : 'FAIL';
await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
if (result.overall !== 'PASS') process.exitCode = 1;
