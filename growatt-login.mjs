import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class GrowattLogin {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.browser = null;
    this.page = null;
  }

  async login() {
    try {
      console.log('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: process.env.HEADLESS !== 'false',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      this.page = await this.browser.newPage();
      
      // Set viewport and user agent
      await this.page.setViewport({ width: 1280, height: 720 });
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      console.log('Navigating to Growatt login page...');
      await this.page.goto('https://server.growatt.com/login?lang=en', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for and fill username field
      console.log('Filling in credentials...');
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });
      await this.page.type('input[name="username"]', this.username, { delay: 50 });

      // Fill password field
      await this.page.waitForSelector('input[name="password"]', { timeout: 10000 });
      await this.page.type('input[name="password"]', this.password, { delay: 50 });

      // Click login button
      console.log('Clicking login button...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        this.page.click('button[type="submit"]')
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('login')) {
        throw new Error('Login failed - still on login page');
      }

      console.log('✓ Login successful!');
      console.log('Current URL:', currentUrl);

      // Keep browser open to maintain session if needed
      if (process.env.KEEP_OPEN === 'true') {
        console.log('Browser kept open. Press Ctrl+C to exit.');
        await new Promise(() => {}); // Never resolves, keeps process alive
      }

      return {
        success: true,
        url: currentUrl,
        cookies: await this.page.cookies()
      };

    } catch (error) {
      console.error('✗ Login failed:', error.message);
      throw error;
    } finally {
      if (!process.env.KEEP_OPEN || process.env.KEEP_OPEN !== 'true') {
        await this.closeBrowser();
      }
    }
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      console.log('Browser closed.');
    }
  }

  async getSessionCookies() {
    if (this.page) {
      return await this.page.cookies();
    }
    return null;
  }
}

// Export for use as a module
export { GrowattLogin };

// Run directly if called as main script
if (import.meta.url === `file://${process.argv[1]}`) {
  const username = process.env.GROWATT_USERNAME;
  const password = process.env.GROWATT_PASSWORD;

  if (!username || !password) {
    console.error('Error: GROWATT_USERNAME and GROWATT_PASSWORD environment variables are required');
    process.exit(1);
  }

  const loginInstance = new GrowattLogin(username, password);
  loginInstance.login()
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
