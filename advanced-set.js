permissions:
  contents: read
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
  EXPORT_REGISTER,
  EXPORT_VALUE,
  HEADLESS = 'true',
  LOGIN_MODE = 'monitor', // monitor | oss
  DISABLE_WEB_SECURITY = 'false',
} = process.env;

async function run() {
  const browserArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
  if (DISABLE_WEB_SECURITY === 'true') {
    browserArgs.push(
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    );
  }

  const browser = await chromium.launch({
    headless: HEADLESS === 'true',
    args: browserArgs,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    bypassCSP: DISABLE_WEB_SECURITY === 'true',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  let ossHintDetected = false;

  page.on('console', msg => {
    const text = msg.text();
    console.log(`PAGE LOG [${msg.type()}]: ${text}`);
    if (/loginOSS\s+true/i.test(text)) {
      ossHintDetected = true;
    }
  });

  page.on('requestfailed', req => {
    console.log('REQUEST FAILED:', req.url(), req.failure()?.errorText);
  });

  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err?.message ?? err);
  });

  const saveArtifacts = async name => {
    try {
      await page.screenshot({ path: `${name}.png`, fullPage: true });
      fs.writeFileSync(`${name}.html`, await page.content());
      console.log(`Saved ${name}.png and ${name}.html`);
    } catch {}
  };

  async function findInContexts(selectors, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      for (const s of selectors) {
        try {
          const el = await page.$(s);
          if (el) return { context: page, selector: s };
        } catch {}
      }
      for (const f of page.frames()) {
        for (const s of selectors) {
          try {
            const el = await f.$(s);
            if (el) return { context: f, selector: s };
          } catch {}
        }
      }
      await page.waitForTimeout(400);
    }
    return null;
  }

  const USERNAME_SELECTORS = [
    'input[name="username"]',
    'input[name="userName"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
  ];

  const PASSWORD_SELECTORS = [
    'input[type="password"]',
    'input[name="password"]',
    'input[autocomplete="current-password"]',
  ];

  async function submitLogin(usernameTarget, passwordTarget) {
    await usernameTarget.context.fill(
      usernameTarget.selector,
      GROWATT_USERNAME
    );
    await passwordTarget.context.fill(
      passwordTarget.selector,
      GROWATT_PASSWORD
    );

    const form = usernameTarget.context.locator(
      `form:has(${usernameTarget.selector})`
    );

    if ((await form.count()) > 0) {
      const submit = form.locator(
        'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("登录")'
      );
      if ((await submit.count()) > 0) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
          submit.first().click(),
        ]);
        return;
      }
    }

    await passwordTarget.context.press(passwordTarget.selector, 'Enter');
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
  }

  async function loginMonitor() {
    console.log('Navigating to login page (Monitor)');
    await page.goto('https://server.growatt.com/login', {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForLoadState('networkidle');

    const usernameTarget = await findInContexts(USERNAME_SELECTORS);
    const passwordTarget = await findInContexts(PASSWORD_SELECTORS);

    if (!usernameTarget || !passwordTarget) {
      await saveArtifacts('login-monitor-failed');
      throw new Error('Monitor login fields not found');
    }

    await submitLogin(usernameTarget, passwordTarget);

    await page.waitForURL(/\/(panel|index)/i).catch(() => {});
    console.log('Monitor login completed (or redirected)');
  }

  async function loginOSS() {
    console.log('Navigating to login page (OSS)');
    await page.goto('https://oss.growatt.com/login', {
      waitUntil: 'domcontentloaded',
    });

    await page.waitForLoadState('networkidle');

    const usernameTarget = await findInContexts(USERNAME_SELECTORS);
    const passwordTarget = await findInContexts(PASSWORD_SELECTORS);

    if (!usernameTarget || !passwordTarget) {
      await saveArtifacts('login-oss-failed');
      throw new Error('OSS login fields not found');
    }

    await submitLogin(usernameTarget, passwordTarget);

    await page.waitForURL(/\/(panel|index|home|dashboard)/i).catch(() => {});
    console.log('OSS login successful');
  }

  try {
    if (LOGIN_MODE === 'oss') {
      await loginOSS();
    } else {
      await loginMonitor();
      if (ossHintDetected && DISABLE_WEB_SECURITY !== 'true') {
        console.log('OSS flow detected → switching to OSS login');
        await loginOSS();
      }
    }

    // === Device navigation ===
    await page.click(SELECTORS.deviceTab);
    await page.waitForSelector(SELECTORS.deviceTable);

    if (DEVICE_SN) {
      await page.fill(SELECTORS.searchBySN, DEVICE_SN);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
    }

    await page.click(SELECTORS.rowSettingsButton(DEVICE_SN || ''));

    await page.click(SELECTORS.advancedSetTab);
    await page.waitForSelector(SELECTORS.registerField);

    await page.fill(
      SELECTORS.registerField,
      String(EXPORT_REGISTER ?? '202')
    );
    await page.fill(SELECTORS.valueField, String(EXPORT_VALUE ?? '1'));

    const pwdField = await page.$(SELECTORS.installerPasswordField);
    if (pwdField) {
      await pwdField.fill(GROWATT_INSTALLER_PASSWORD ?? '');
    }

    await Promise.all([
      page.click(SELECTORS.saveButton),
      page.waitForTimeout(2000),
    ]);

    console.log(
      `✅ Advanced Set complete (register=${EXPORT_REGISTER}, value=${EXPORT_VALUE})`
    );
  } catch (err) {
    console.error('❌ Advanced Set failed:', err);
    await saveArtifacts('advanced-set-error');
    process.exit(1);
  } finally {
    await browser.close();
  }
}

await run();
