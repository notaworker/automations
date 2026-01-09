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
  // increase default timeout for slow CI environments
  const defaultTimeout = 60000;

  const browser = await chromium.launch({
    headless: HEADLESS === 'true',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(defaultTimeout);

  // capture page console messages to workflow logs
  page.on('console', msg => {
    try {
      console.log(`PAGE LOG [${msg.type()}]: ${msg.text()}`);
    } catch {}
  });

  // auto-accept dialogs (if installer password prompt appears as a dialog)
  page.on('dialog', async dialog => {
    console.log('PAGE DIALOG:', dialog.type(), dialog.message());
    try { await dialog.accept(); } catch {}
  });

  try {
    // 1) Login
    console.log('Navigating to login page:', `${BASE_URL}/login`);
    const response = await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    console.log('Navigation finished. URL:', page.url(), 'Status:', response ? response.status() : 'no-response');

    // wait for the username input, but capture debug artifacts if it doesn't appear
    try {
      const usernameSelector = SELECTORS.login.username;
      console.log('Waiting for login selector:', usernameSelector);
      await page.waitForSelector(usernameSelector, { timeout: 15000 });
    } catch (waitErr) {
      console.error('Login selector not found within timeout. Saving debug artifacts...');
      try {
        await page.screenshot({ path: 'login-not-found.png', fullPage: true });
        const html = await page.content();
        fs.writeFileSync('login-page.html', html);
        console.log('Saved login-not-found.png and login-page.html to workspace.');
      } catch (saveErr) {
        console.error('Failed to save debug artifacts:', saveErr);
      }
      throw waitErr;
    }

    // fill login form
    await page.fill(SELECTORS.login.username, GROWATT_USERNAME);
    await page.fill(SELECTORS.login.password, GROWATT_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click(SELECTORS.login.submit),
    ]);
    await page.waitForSelector(SELECTORS.navGuard, { timeout: 15000 });

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
