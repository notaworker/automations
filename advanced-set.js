
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
  LOGIN_MODE = 'monitor',     // 'monitor' (ShineServer) or 'oss' (installer)
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
    // Dev/CI-only: relax CORS & site isolation
    launchArgs.push('--disable-web-security', '--disable-features=IsolateOrigins,site-per-process');
  }

  const browser = await chromium.launch({
    headless: HEADLESS === 'true',
    args: launchArgs
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
    bypassCSP: DISABLE_WEB_SECURITY === 'true', // relax CSP only if needed
  });

  const page = await context.newPage();
  page.setDefaultTimeout(defaultTimeout);

  // ---- Logging ----
  page.on('console', msg => {
    try {
      console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
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

  // Search main page and frames for selectors (with retries)
  async function findInContexts(selectors, timeout = 15000, pollInterval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // main page
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) return { context: page, selector: sel };
        } catch {}
      }
      // frames
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

  // Common candidate selectors for login
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

  // Ensure we click the correct login variant
  async function forceMonitorLoginUI() {
    // Try to select a tab or toggle for "Monitor"/"ShineServer"
    await page.locator('text=/Monitor|ShineServer/i').first().click().catch(() => {});
    // Sometimes there is a "Monitor/Oss Login" switcher
    await page.locator('.login-tab >> text=/Monitor/i').first().click().catch(() => {});
  }

  // Fill inside the form that contains the username field (scoped submit)
  async function fillAndSubmitInSameForm(targets, timeout = 30000) {
    const { usernameTarget, passwordTarget } = targets;

    // Scope to the form that contains the username input
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

    // Fallback: fill the two fields in their respective contexts and click a global submit candidate
    const fill = async (ctx, selector, value) => ctx.fill(selector, value);
    await fill(usernameTarget.context, usernameTarget.selector, GROWATT_USERNAME);
    await fill(passwordTarget.context, passwordTarget.selector, GROWATT_PASSWORD);

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

    // Stronger post-login signals
    await page.waitForURL(/\/panel|\/index/i, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 30000 });
    console.log('Login appears successful (monitor); nav guard found.');
  }

  async function loginOSS() {
    console.log('Navigating to login page (OSS):', `${effectiveBaseUrl}/login`);
    const response = await page.goto(`${effectiveBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
    console.log('Navigation finished. URL:', page.url(), 'Status:', response ? response.status() : 'no-response');
    await page.waitForLoadState('networkidle').catch(() => {});

    console.log('Searching for username field (oss)...');
    const usernameTarget = await findInContexts(usernameCandidates, 20000);
    if (!usernameTarget) {
      console.error('Login selector not found on oss page. Saving debug artifacts...');
      await saveArtifacts('login-oss-not-found');
      throw new Error('Username field not found (oss)');
    }
    console.log(
      'Found username selector (oss):',
      usernameTarget.selector,
      'in',
      usernameTarget.context === page ? 'page' : 'frame'
    );

    console.log('Searching for password field (oss)...');
    const passwordTarget = await findInContexts(passwordCandidates, 20000);
    if (!passwordTarget) throw new Error('Password field not found (oss)');

    await fillAndSubmitInSameForm({ usernameTarget, passwordTarget }, 30000);

    await page.waitForURL(/\/panel|\/index|\/home|\/dashboard/i, { timeout: 30000 }).catch(() => {});
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 30000 });
    console.log('Login appears successful (oss); nav guard found.');
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
      page.waitForTimeout(2000) // write is queued; response may be async
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
