import 'dotenv/config';
import fs from 'fs';
import { chromium } from 'playwright';
import { SELECTORS } from './selectors.js';

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_INSTALLER_PASSWORD, // computed in the workflow (growattYYYYMMDD)
  DEVICE_SN,
  EXPORT_REGISTER,            // e.g., 202
  EXPORT_VALUE,               // e.g., 1 (enable) or 0 (disable)
  HEADLESS = 'true',
  BASE_URL = 'https://server.growatt.com'
} = process.env;

async function run() {
  const defaultTimeout = 60000;
  const browser = await chromium.launch({
    headless: HEADLESS === 'true',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36'
  });
  const page = await context.newPage();
  page.setDefaultTimeout(defaultTimeout);

  // capture page console messages to workflow logs
  page.on('console', msg => {
    try {
      console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
    } catch {}
  });

  // auto-accept dialogs (if any)
  page.on('dialog', async dialog => {
    console.log('PAGE DIALOG:', dialog.type(), dialog.message());
    try { await dialog.accept(); } catch {}
  });

  // helper: search main page and frames for a list of selectors (with retries)
  async function findInContexts(selectors, timeout = 15000, pollInterval = 500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // check main page
      for (const sel of selectors) {
        try {
          const el = await page.$(sel);
          if (el) return { context: page, selector: sel };
        } catch {}
      }
      // check frames
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

  // common candidate selectors for login
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

  try {
    // 1) Navigate to login page
    console.log('Navigating to login page:', `${BASE_URL}/login`);
    const response = await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    console.log('Navigation finished. URL:', page.url(), 'Status:', response ? response.status() : 'no-response');

    // Try to locate username (searches main page and frames)
    console.log('Searching for username field...');
    const usernameTarget = await findInContexts(usernameCandidates, 20000);
    if (!usernameTarget) {
      console.error('Login selector not found. Saving debug artifacts...');
      try {
        await page.screenshot({ path: 'login-not-found.png', fullPage: true });
        const html = await page.content();
        fs.writeFileSync('login-page.html', html);
        console.log('Saved login-not-found.png and login-page.html to workspace.');
      } catch (saveErr) {
        console.error('Failed to save debug artifacts:', saveErr);
      }
      throw new Error('Username field not found');
    }
    console.log('Found username selector:', usernameTarget.selector, 'in', usernameTarget.context === page ? 'page' : 'frame');

    // Find password and submit button
    console.log('Searching for password field...');
    const passwordTarget = await findInContexts(passwordCandidates, 20000);
    if (!passwordTarget) throw new Error('Password field not found');

    console.log('Searching for submit button...');
    const submitTarget = await findInContexts(submitCandidates, 10000);

    // Fill credentials
    const fillContext = async (ctx, selector, value) => {
      // Both Page and Frame support fill()
      await ctx.fill(selector, value);
    };

    await fillContext(usernameTarget.context, usernameTarget.selector, GROWATT_USERNAME);
    await fillContext(passwordTarget.context, passwordTarget.selector, GROWATT_PASSWORD);

    // Submit: prefer clicking a button, fall back to pressing Enter in password field
    if (submitTarget) {
      console.log('Clicking submit:', submitTarget.selector, 'in', submitTarget.context === page ? 'page' : 'frame');
      // Trigger click and wait for navigation (if any)
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {}),
        submitTarget.context.click(submitTarget.selector).catch(() => {})
      ]);
    } else {
      console.log('No submit button found, pressing Enter on password field as fallback');
      try {
        await (passwordTarget.context).press(passwordTarget.selector, 'Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
      } catch {}
    }

    // Wait for a post-login indicator used elsewhere in the script
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 20000 });
    console.log('Login appears successful; nav guard found.');

    // 2) Go to devices
    await page.click(SELECTORS.deviceTab).catch(() => {});
    await page.waitForSelector(SELECTORS.deviceTable, { timeout: 15000 });

    // 3) Filter by device SN
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
    await page.waitForSelector(SELECTORS.registerField, { timeout: 15000 });

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
      page.waitForTimeout(2000) // write is queued; response may be asynchronous
    ]);

    console.log(`Advanced Set submitted: register=${EXPORT_REGISTER}, value=${EXPORT_VALUE}`);
  } catch (err) {
    console.error('Advanced Set failed:', err);
    try {
      await page.screenshot({ path: 'advanced-set-error.png', fullPage: true });
      const html = await page.content();
      fs.writeFileSync('advanced-set-error.html', html);
      console.log('Saved advanced-set-error.png and advanced-set-error.html');
    } catch (saveErr) {
      console.error('Failed to save error artifacts:', saveErr);
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await run();
