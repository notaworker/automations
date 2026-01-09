
import 'dotenv/config';
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
  const browser = await chromium.launch({ headless: HEADLESS === 'true' });
  const page = await browser.newPage();

  try {
    // 1) Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
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
    } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await run();
