import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = String(process.env.PREVIEW_URL || '').replace(/\/+$/, '');
const expectedHeadSha = String(process.env.EXPECTED_HEAD_SHA || '').trim();
const qaEmail = String(process.env.BLACK_ORACLE_QA_EMAIL || '').trim();
const qaPassword = String(process.env.BLACK_ORACLE_QA_PASSWORD || '');
const bypassSecret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '').trim();
const outputDir = path.resolve(process.env.PREVIEW_QA_OUTPUT_DIR || 'artifacts/preview-qa');

const result = {
  generatedAt: new Date().toISOString(),
  previewUrlHost: null,
  readiness: {
    reachable: false,
    safeResponse: false,
    previewReady: false,
    productionRolloutReady: false,
    blockers: [],
  },
  revision: {
    expectedHeadSha: expectedHeadSha || null,
    deployedHeadSha: null,
    environment: null,
    verified: false,
    reason: null,
  },
  desktop: { loginSurface: 'NOT_RUN', operatorWorkspace: 'NOT_RUN', screenshots: [] },
  mobile: { loginSurface: 'NOT_RUN', operatorWorkspace: 'NOT_RUN', screenshots: [] },
  operatorCredentialsConfigured: Boolean(qaEmail && qaPassword),
  pageErrors: [],
  consoleErrors: [],
  overall: 'BLOCKED',
  releaseGateClosed: false,
};

const save = async () => {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
};

const validateBaseUrl = () => {
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.vercel.app')) {
    throw new Error('PREVIEW_URL must be an HTTPS vercel.app deployment.');
  }
  result.previewUrlHost = parsed.hostname;
};

const requestHeaders = () => {
  const headers = { accept: 'application/json' };
  if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret;
  return headers;
};

const inspectReadiness = async () => {
  const response = await fetch(`${baseUrl}/api/trading-readiness`, {
    method: 'GET',
    headers: requestHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  result.readiness.reachable = response.ok;
  const text = await response.text();
  await writeFile(path.join(outputDir, 'readiness-response.json'), text || '{}', 'utf8');
  if (!response.ok) {
    result.readiness.blockers = [`HTTP_${response.status}`];
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    result.readiness.blockers = ['INVALID_JSON'];
    return false;
  }

  result.readiness.safeResponse = payload?.success === true && payload?.secretValuesExposed === false;
  result.readiness.previewReady = payload?.deploymentPreflight?.readyForPaperPreview === true;
  result.readiness.productionRolloutReady = payload?.deploymentPreflight?.readyForProductionPaperRollout === true;
  result.readiness.blockers = Array.isArray(payload?.deploymentPreflight?.blockers)
    ? payload.deploymentPreflight.blockers.slice(0, 20).map(String)
    : [];

  result.revision.deployedHeadSha = typeof payload?.deployment?.gitCommitSha === 'string'
    ? payload.deployment.gitCommitSha
    : null;
  result.revision.environment = typeof payload?.deployment?.environment === 'string'
    ? payload.deployment.environment
    : null;

  if (!expectedHeadSha) {
    result.revision.reason = 'EXPECTED_HEAD_SHA_MISSING';
  } else if (!result.revision.deployedHeadSha) {
    result.revision.reason = 'VERCEL_GIT_COMMIT_SHA_UNAVAILABLE';
  } else if (result.revision.deployedHeadSha !== expectedHeadSha) {
    result.revision.reason = 'DEPLOYED_REVISION_MISMATCH';
  } else {
    result.revision.verified = true;
  }

  return result.readiness.safeResponse;
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

const captureDevice = async (browser, device) => {
  const extraHTTPHeaders = {};
  if (bypassSecret) extraHTTPHeaders['x-vercel-protection-bypass'] = bypassSecret;
  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: 1,
    extraHTTPHeaders,
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('oracle_tutorial_seen', 'true');
    } catch {
      // Ignore storage denial and let the screenshot surface the actual state.
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => result.pageErrors.push(`${device.id}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(`${device.id}: ${message.text()}`);
  });

  const deviceResult = result[device.id];
  try {
    const response = await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    if (!response || !response.ok()) throw new Error(`Preview page returned HTTP ${response?.status() ?? 'NO_RESPONSE'}`);
    await page.getByText('Authenticate', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(600);

    const metrics = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    }));
    if (metrics.scrollWidth > metrics.width + 2) {
      throw new Error(`Horizontal overflow detected: ${metrics.scrollWidth}px > ${metrics.width}px`);
    }

    const loginShot = path.join(outputDir, `${device.id}-login.png`);
    await page.screenshot({ path: loginShot, fullPage: false });
    deviceResult.screenshots.push(path.basename(loginShot));
    deviceResult.loginSurface = 'PASS';

    if (!qaEmail || !qaPassword) {
      deviceResult.operatorWorkspace = 'BLOCKED_AUTH';
      return;
    }

    await page.locator('input[autocomplete="username"]').fill(qaEmail);
    await page.locator('input[autocomplete="current-password"]').fill(qaPassword);
    await page.getByRole('button', { name: 'Enter command' }).click();

    if (device.id === 'mobile') {
      await page.getByRole('button', { name: 'MONITOR' }).waitFor({ state: 'visible', timeout: 20_000 });
    } else {
      await page.getByText('Monitor', { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 });
    }

    for (const [label, slug] of device.nav) {
      if (device.id === 'mobile') {
        await page.getByRole('button', { name: label }).click();
        await page.getByRole('button', { name: label }).waitFor({ state: 'visible' });
      } else {
        await page.getByText(label, { exact: true }).first().click();
      }
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
      if (overflow) throw new Error(`${label} has horizontal viewport overflow on ${device.id}.`);
      const shot = path.join(outputDir, `${device.id}-${slug}.png`);
      await page.screenshot({ path: shot, fullPage: false });
      deviceResult.screenshots.push(path.basename(shot));
    }
    deviceResult.operatorWorkspace = 'PASS';
  } catch (error) {
    if (deviceResult.loginSurface === 'NOT_RUN') deviceResult.loginSurface = 'FAIL';
    if (deviceResult.operatorWorkspace === 'NOT_RUN') deviceResult.operatorWorkspace = 'FAIL';
    result.pageErrors.push(`${device.id}: ${error instanceof Error ? error.message : String(error)}`);
    try {
      const failureShot = path.join(outputDir, `${device.id}-failure.png`);
      await page.screenshot({ path: failureShot, fullPage: false });
      deviceResult.screenshots.push(path.basename(failureShot));
    } catch {
      // Preserve the original failure.
    }
  } finally {
    await context.close();
  }
};

try {
  await mkdir(outputDir, { recursive: true });
  validateBaseUrl();
  const readinessSafe = await inspectReadiness();

  const browser = await chromium.launch({ headless: true });
  try {
    for (const device of deviceCases) await captureDevice(browser, device);
  } finally {
    await browser.close();
  }

  const publicSurfacesPass =
    readinessSafe &&
    result.revision.verified &&
    result.desktop.loginSurface === 'PASS' &&
    result.mobile.loginSurface === 'PASS' &&
    result.pageErrors.length === 0;
  const operatorPass =
    result.desktop.operatorWorkspace === 'PASS' &&
    result.mobile.operatorWorkspace === 'PASS';

  if (publicSurfacesPass && operatorPass) {
    result.overall = 'PASS';
    result.releaseGateClosed = true;
  } else if (publicSurfacesPass && !result.operatorCredentialsConfigured) {
    result.overall = 'PARTIAL_BLOCKED_AUTH';
  } else if (publicSurfacesPass) {
    result.overall = 'PARTIAL_OPERATOR_QA_FAILED';
  } else {
    result.overall = 'BLOCKED_OR_FAILED';
  }
} catch (error) {
  result.pageErrors.push(`harness: ${error instanceof Error ? error.message : String(error)}`);
  result.overall = 'BLOCKED_OR_FAILED';
} finally {
  await save();
  console.log(JSON.stringify({
    overall: result.overall,
    releaseGateClosed: result.releaseGateClosed,
    revision: result.revision,
    readiness: result.readiness,
    desktop: result.desktop,
    mobile: result.mobile,
    pageErrors: result.pageErrors,
  }, null, 2));
}
