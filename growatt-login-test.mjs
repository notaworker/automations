
// growatt-login-test.mjs
// Purpose: Log in to Growatt (ShineServer or server.growatt.com), keep session cookies,
// and verify that /index returns an authenticated dashboard (not the login page).

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import crypto from 'crypto';

const GW_SERVER_BASE = process.env.GW_SERVER_BASE || 'https://shineserver.growatt.com';
const USER = process.env.GW_USER;
const PASS = process.env.GW_PASS;
const CAPTCHA = (process.env.GW_VALIDATE_CODE || '').toUpperCase();

function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function looksAuthenticated(html) {
  const s = String(html || '');
  const first300 = s.slice(0, 300);
  // If it still looks like the login page, treat as unauthenticated
  if (/data-name="login"|<title>\s*Login\s*<\/title>/i.test(first300)) return { ok: false, first300 };
  return { ok: true, first300 };
}

async function loginOnce(client, { account, password, useMd5, validateCode, isReadPact }) {
  const form = new URLSearchParams();
  form.set('account', account);
  if (useMd5) {
    form.set('password', '');                   // site behavior: blank when sending hash
    form.set('passwordCrc', md5Hex(password));  // MD5 hash of plaintext password
  } else {
    form.set('password', password);             // plaintext fallback when server returns result == 8
    form.set('passwordCrc', '');
  }
  form.set('validateCode', validateCode || ''); // optional 3-char captcha (uppercase)
  form.set('isReadPact', isReadPact ? '1' : '0');

  const res = await client.post('/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': GW_SERVER_BASE,
      'Referer': `${GW_SERVER_BASE}/login`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    },
    validateStatus: () => true
  });

  let body;
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data; } catch { body = res.data; }
  return { status: res.status, body };
}

async function main() {
  if (!USER || !PASS) {
    console.error('Missing GW_USER or GW_PASS env vars');
    process.exit(2);
  }

  const jar = new tough.CookieJar();
  const client = wrapper(axios.create({
    baseURL: GW_SERVER_BASE,
    jar,
    withCredentials: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    },
    validateStatus: () => true
  }));

  // Preflight GET to establish cookies
  let res = await client.get('/login', { headers: { Referer: GW_SERVER_BASE + '/' } });
  console.log(`GET ${GW_SERVER_BASE}/login → ${res.status}`);

  // 1) Try MD5-first (default page behavior)
  let { body } = await loginOnce(client, {
    account: USER,
    password: PASS,
    useMd5: true,
    validateCode: CAPTCHA,
    isReadPact: true // pre-acknowledge privacy policy
  });
  console.log('POST /login (MD5) →', body?.result);

  // 2) Handle server result codes
  if (body?.result === 8) {
    // Server says MD5 mismatch → retry with plaintext
    ({ body } = await loginOnce(client, {
      account: USER,
      password: PASS,
      useMd5: false,
      validateCode: CAPTCHA,
      isReadPact: true
    }));
    console.log('POST /login (plaintext retry) →', body?.result);
  } else if (body?.result === -4) {
    // Privacy policy prompt; attempt to mark accepted then retry
    try {
      await client.post('/login/updateProtocolStatusByUser', new URLSearchParams({ accountName: USER }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      ({ body } = await loginOnce(client, {
        account: USER,
        password: PASS,
        useMd5: true,
        validateCode: CAPTCHA,
        isReadPact: true
      }));
      console.log('POST /login (after privacy accept) →', body?.result);
    } catch (e) {
      console.warn('Privacy acceptance call failed:', e?.message || e);
    }
  } else if (body?.result === -1) {
    console.error('❌ Server requires verification code (captcha). Provide GW_VALIDATE_CODE (3 chars, uppercase).');
    process.exit(2);
  } else if (body?.result === -2) {
    console.error('❌ Username or password error (server may now require captcha).');
    process.exit(2);
  } else if (body?.result === 3 || body?.result === '3') {
    console.error('❌ Region selection flow detected. Use the correct regional base URL for your account.');
    process.exit(2);
  }

  // 3) Verify session by fetching /index
  res = await client.get('/index', { headers: { Referer: `${GW_SERVER_BASE}/login` } });
  console.log(`GET ${GW_SERVER_BASE}/index → ${res.status}`);

  const { ok, first300 } = looksAuthenticated(res.data);
  if (!ok) {
    console.error('❌ Login did not validate. Still seeing login page.');
    console.info(`ℹ️ First 300 chars: ${first300}`);
    process.exit(2);
  }

  console.log('✅ Logged in. Session appears valid.');
  console.log(first300);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
