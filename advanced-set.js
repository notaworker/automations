
// advanced-set.js
import 'dotenv/config';
import fs from 'fs';
import { chromium } from 'playwright';
import { SELECTORS } from './selectors.js';

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_INSTALLER_PASSWORD, // growattYYYYMMDD
  DEVICE_SN,
  EXPORT_REGISTER,            // e.g., 202
  EXPORT_VALUE,               // e.g., 1 (enable) or 0 (disable)
  HEADLESS = 'true',
  LOGIN_MODE = 'monitor',     // 'monitor' or 'oss'
  DISABLE_WEB_SECURITY = 'false',
  BASE_URL                    // optional override
} = process.env;

const effectiveBaseUrl =
  BASE_URL ??
  (LOGIN_MODE === 'oss' ? 'https://oss.growatt.com' : 'https://server.growatt.com');

async function run() {
  const defaultTimeout = 60000;

  // ---- Browser launch (optionally relax CORS for CI) ----
  const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (DISABLE_WEB_SECURITY === 'true') {
    launchArgs.push(
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    );
  }

  const browser = await chromium.launch({
    headless: HEADLESS === 'true',
    args: launchArgs
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
    bypassCSP: DISABLE_WEB_SECURITY === 'true',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(defaultTimeout);

  // ---- Logging ----
  let ossHintDetected = false;
  page.on('console', msg => {
    const text = msg.text();
    try {
      console.log(`PAGE LOG [${msg.type()}]: ${text}`);
      if (/loginOSS\s+true/i.test(text)) {
        ossHintDetected = true;
      }
    } catch {}
  });
  page.on('dialog', async dialog => {
    console.log('PAGE DIALOG:', dialog.type(), dialog.message());
    try { await dialog.accept(); } catch {}
  });
  page.on('requestfailed', req => {
    console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
  });
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err?.message ?? err);
  });

  // ---- Helpers ----
  async function saveArtifacts(prefix) {
    try {
      await page.screenshot({ path: `${prefix}.png`, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(`${prefix}.html`, html);
      console.log(`Saved ${prefix}.png and ${prefix}.html`);
    } catch (e) {
      console.error(`Failed to save artifacts for ${prefix}:`, e);
    }
  }

  async function findInContexts(selectors, timeout = 15000, pollInterval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) return { context: page, selector: sel };
        } catch {}
      }
      for (const frame of page.frames()) {
        for (const sel of selectors) {
          try {
            const el = await frame.$(sel);
            if (el) return { context: frame, selector: sel };
          } catch {}
        }
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }
    return null;
  }

  const usernameCandidates = [
    'input[name="userName"]',
    'input[name="username"]',
    'input[name="user"]',
    'input#userName',
    'input[type="email"]',
    'input[placeholder*="用户名"]',
    'input[placeholder*="账号"]',
    'input[placeholder*="Account"]',
    'input[placeholder*="Username"]',
    'input[autocomplete="username"]'
  ];
  const passwordCandidates = [
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="密码"]',
    'input[autocomplete="current-password"]'
  ];
  const submitCandidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("登录")',
    'button:has-text("Login")',
    'button:has-text("Sign in")'
  ];

  async function forceMonitorLoginUI() {
    await page.locator('text=/Monitor|ShineServer/i').first().click().catch(() => {});
    await page.locator('.login-tab >> text=/Monitor/i').first().click().catch(() => {});
  }

  async function fillAndSubmitInSameForm(targets, timeout = 30000) {
    const { usernameTarget, passwordTarget } = targets;

    const ctx = usernameTarget.context;
    const form = ctx.locator(`form:has(${usernameTarget.selector})`);
    const hasForm = await form.count().catch(() => 0);

    if (hasForm > 0) {
      await form.locator(usernameTarget.selector).fill(GROWATT_USERNAME);
      await form.locator('input[type="password"], input[name="password"]').first().fill(GROWATT_PASSWORD);

      const submitLocator = form.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("登录")'
      );
      const submitCount = await submitLocator.count();
      if (submitCount > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout }).catch(() => {}),
          submitLocator.first().click()
        ]);
        return;
      }
    }

    // Fallback
    await usernameTarget.context.fill(usernameTarget.selector, GROWATT_USERNAME);
    await passwordTarget.context.fill(passwordTarget.selector, GROWATT_PASSWORD);

    const submitTarget = await findInContexts(submitCandidates, 8000);
    if (submitTarget) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout }).catch(() => {}),
        submitTarget.context.click(submitTarget.selector).catch(() => {})
      ]);
    } else {
      try {
        await passwordTarget.context.press(passwordTarget.selector, 'Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout }).catch(() => {});
      } catch {}
    }
  }

  // Login flows
  async function loginMonitor() {
    console.log('Navigating to login page (Monitor):', `${effectiveBaseUrl}/login`);
    const response = await page.goto(`${effectiveBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
    console.log('Navigation finished. URL:', page.url(), 'Status:', response ? response.status() : 'no-response');
    await page.waitForLoadState('networkidle').catch(() => {});

    await forceMonitorLoginUI();

    console.log('Searching for username field (monitor)...');
    const usernameTarget = await findInContexts(usernameCandidates, 20000);
    if (!usernameTarget) {
      console.error('Login selector not found on monitor page. Saving debug artifacts...');
      await saveArtifacts('login-not-found');
      throw new Error('Username field not found (monitor)');
    }
    console.log(
      'Found username selector:',
      usernameTarget.selector,
      'in',
      usernameTarget.context === page ? 'page' : 'frame'
    );

    console.log('Searching for password field...');
    const passwordTarget = await findInContexts(passwordCandidates, 20000);
    if (!passwordTarget) throw new Error('Password field not found');

    await fillAndSubmitInSameForm({ usernameTarget, passwordTarget }, 30000);

    // Stronger post-login signals: advance if URL is routed to /panel even if header isn't visible yet
    await page.waitForURL(/\/panel|\/index/i, { timeout: 30000 }).catch(() => {});

    // If page announced OSS flow, fallback to OSS login to avoid CORS deadlock
    if (ossHintDetected && LOGIN_MODE !== 'oss' && DISABLE_WEB_SECURITY !== 'true') {
      console.log('OSS flow detected by page; switching to direct OSS login to avoid CORS.');
      await loginOSS();
      return;
    }

    // Try app shell guards, but don't block progression if they fail — continue to devices
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 15000 }).catch(() => {});
    console.log('Login appears successful (monitor) or URL advanced; proceeding.');
  }

  async function loginOSS() {
    const ossBase = BASE_URL ?? 'https://oss.growatt.com';
    console.log('Navigating to login page (OSS):', `${ossBase}/login`);
    const response = await page.goto(`${ossBase}/login`, { waitUntil: 'domcontentloaded' });
    console.log('Navigation finished. URL:', page.url(), 'Status:', response ? response.status() : 'no-response');
    await page.waitForLoadState('networkidle').catch(() => {});

    console.log('Searching for username field (oss)...');
    const usernameTarget = await findInContexts(usernameCandidates, 20000);
    if (!usernameTarget) {
      console.error('Login selector not found on oss page. Saving debug artifacts...');
      await saveArtifacts('login-oss-not-found');
      throw new Error('Username field not found (oss)');
    }

    console.log('Searching for password field (oss)...');
    const passwordTarget = await findInContexts(passwordCandidates, 20000);
    if (!passwordTarget) throw new Error('Password field not found (oss)');

    await fillAndSubmitInSameForm({ usernameTarget, passwordTarget }, 30000);

    await page.waitForURL(/\/panel|\/index|\/home|\/dashboard/i, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 15000 }).catch(() => {});
    console.log('Login appears successful (oss); proceeding.');
  }

  try {
    // 1) Login (monitor or oss)
    if (LOGIN_MODE === 'oss') {
      await loginOSS();
    } else {
      await loginMonitor();
    }

    // 2) Go to devices tab
    await page.click(SELECTORS.deviceTab).catch(() => {});
    await page.waitForSelector(SELECTORS.deviceTable, { timeout: 20000 });

    // 3) Filter by device SN (if provided)
    if (DEVICE_SN) {
      await page.fill(SELECTORS.searchBySN, DEVICE_SN);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
    }

    // 4) Open settings (row gear)
    const rowSettings = SELECTORS.rowSettingsButton(DEVICE_SN || '');
    await page.click(rowSettings);

    // 5) Open "Advanced Set"
    await page.click(SELECTORS.advancedSetTab);
    await page.waitForSelector(SELECTORS.registerField, { timeout: 20000 });

    // 6) Enter register/value
    await page.fill(SELECTORS.registerField, String(EXPORT_REGISTER ?? '202'));
    await page.fill(SELECTORS.valueField, String(EXPORT_VALUE ?? '1'));

    // Optional installer password prompt
    const installerPwdField = await page.$(SELECTORS.installerPasswordField);
    if (installerPwdField) {
      await installerPwdField.fill(GROWATT_INSTALLER_PASSWORD ?? '');
    }

    // 7) Save
    await Promise.all([
      page.click(SELECTORS.saveButton),
      page.waitForTimeout(2000)
    ]);

    console.log(`Advanced Set submitted: register=${EXPORT_REGISTER}, value=${EXPORT_VALUE}`);
  } catch (err) {
    console.error('Advanced Set failed:', err);
    await saveArtifacts('advanced-set-error');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await run();
