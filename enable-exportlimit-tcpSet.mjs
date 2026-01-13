
// enable-exportlimit-tcpSet.mjs
// Purpose: Log in to Growatt portal and call tcpSet.do to change an Advanced-Set value
// (e.g., export-limit "backflow_setting").
//
// Improvements:
// - Uses /login with MD5-first, plaintext fallback, isReadPact=1
// - Preserves cookies via axios + tough-cookie
// - Optional captcha support via GW_VALIDATE_CODE (3 uppercase letters) if needed
// - Optional token scraping from Referer page (hidden inputs + meta[csrf-token])
// - Tries advanced-set password (explicit, daily local, daily UTC+8), then no password (if allowed)
// - Reads your secrets: GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN
//
// Required envs (most common):
//   GW_SERVER_BASE            default: https://server.growatt.com  (use your region host; e.g., https://shineserver.growatt.com)
//   GROWATT_USERNAME          your login (or use GW_USER)
//   GROWATT_PASSWORD          your password (or use GW_PASS)
//   GW_TCPSET_ACTION          e.g., 'tlxSet'
//   GW_TCPSET_TYPE            e.g., 'backflow_setting'
//   GW_TCPSET_SN_KEY          e.g., 'serialNum'
//   GW_TCPSET_SN_VALUE        device serial number (or fallback to GROWATT_DEVICE_SN)
//   GW_TCPSET_PARAM1          per your DevTools capture (value to set)
//   GW_TCPSET_PARAM2          per your DevTools capture (or blank)
//   GW_TCPSET_PARAM3          per your DevTools capture (or blank)
//
// Optional envs:
//   GW_VALIDATE_CODE          3-char captcha (uppercase) if server currently shows verification code
//   GW_TCPSET_REFERER         exact Referer page URL captured in DevTools for tcpSet.do (recommended)
//   GW_TCPSET_PLANT_KEY       extra key (e.g., 'plantId')
//   GW_TCPSET_PLANT_VALUE     value for GW_TCPSET_PLANT_KEY
//   GW_TCPSET_TOKEN_KEY       extra token key if the endpoint requires
//   GW_TCPSET_TOKEN_VALUE     value for GW_TCPSET_TOKEN_KEY
//   GW_TCPSET_ADV_PWD         explicit Advanced-Set password to try first
//   GW_TCPSET_NO_AUTO_PWD     set to 'true' to skip daily password attempts
//
// Exit codes:
//   0 = success; 1/2 = failure

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import crypto from 'crypto';
import cheerio from 'cheerio';

// ----------------- ENV & CONSTANTS -----------------

const BASE = (process.env.GW_SERVER_BASE || 'https://server.growatt.com').replace(/\/+$/, '');
const USER = process.env.GW_USER || process.env.GROWATT_USERNAME;
const PASS = process.env.GW_PASS || process.env.GROWATT_PASSWORD;
const CAPTCHA = (process.env.GW_VALIDATE_CODE || '').toUpperCase();

const {
  GW_TCPSET_ACTION,      // e.g., 'tlxSet'
  GW_TCPSET_TYPE,        // e.g., 'backflow_setting'
  GW_TCPSET_SN_KEY,      // e.g., 'serialNum'
  GW_TCPSET_SN_VALUE,    // preferred SN
  GW_TCPSET_PARAM1,
  GW_TCPSET_PARAM2,
  GW_TCPSET_PARAM3,
  GW_TCPSET_REFERER,     // exact Referer from DevTools (best)
  // Optional extras:
  GW_TCPSET_PLANT_KEY, GW_TCPSET_PLANT_VALUE,
  GW_TCPSET_TOKEN_KEY, GW_TCPSET_TOKEN_VALUE,
  GW_TCPSET_ADV_PWD,
  GW_TCPSET_NO_AUTO_PWD
} = process.env;

const FALLBACK_SN = process.env.GROWATT_DEVICE_SN;

// ----------------- UTILS -----------------

function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function dailyPwd(tzHours = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const d = new Date(utc + tzHours * 3600000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `growatt${yyyy}${mm}${dd}`;
}

function toForm(obj) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) sp.set(k, String(v));
  }
  return sp;
}

function parseHiddenTokens(html) {
  const $ = cheerio.load(html || '');
  const hidden = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value') ?? '';
    if (name) hidden[name] = value;
  });
  const metaCsrf = $('meta[name="csrf-token"]').attr('content');
  if (metaCsrf) hidden['csrf-token'] = metaCsrf;
  return hidden;
}

function isLoginHtml(html) {
  const first300 = String(html || '').slice(0, 300);
  return /data-name="login"|<title>\s*Login\s*<\/title>/i.test(first300);
}

// ----------------- HTTP CLIENT -----------------

const jar = new tough.CookieJar();
const client = wrapper(axios.create({
  baseURL: BASE,
  jar,
  withCredentials: true,
  maxRedirects: 5,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
  },
  validateStatus: () => true
}));

async function loginOnce({ useMd5, isReadPact }) {
  const form = toForm({
    account: USER,
    password: useMd5 ? '' : PASS,
    passwordCrc: useMd5 ? md5Hex(PASS) : '',
    validateCode: CAPTCHA,
    isReadPact: isReadPact ? '1' : '0'
  });

  const res = await client.post('/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'Origin': BASE,
      'Referer': `${BASE}/login`
    }
  });
  let body;
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data; } catch { body = res.data; }
  return { status: res.status, body };
}

async function ensureLoggedIn() {
  if (!USER || !PASS) {
    throw new Error('Missing credentials: set GROWATT_USERNAME/GROWATT_PASSWORD (or GW_USER/GW_PASS)');
  }

  // preflight
  await client.get('/login', { headers: { Referer: `${BASE}/` } });

  // MD5-first
  let { body } = await loginOnce({ useMd5: true, isReadPact: true });
  console.log('POST /login (MD5) →', body?.result);

  if (body?.result === 8) {
    // MD5 mismatch → plaintext
    ({ body } = await loginOnce({ useMd5: false, isReadPact: true }));
    console.log('POST /login (plaintext retry) →', body?.result);
  } else if (body?.result === -4) {
    // Privacy accept then retry
    try {
      await client.post('/login/updateProtocolStatusByUser', toForm({ accountName: USER }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      ({ body } = await loginOnce({ useMd5: true, isReadPact: true }));
      console.log('POST /login (after privacy accept) →', body?.result);
    } catch (e) {
      console.warn('Privacy acceptance failed:', e?.message || e);
    }
  } else if (body?.result === -1) {
    throw new Error('Server requires verification code. Set GW_VALIDATE_CODE (3 chars, uppercase).');
  } else if (body?.result === -2) {
    throw new Error('Username or password error (server may now require captcha).');
  } else if (body?.result === 3 || body?.result === '3') {
    throw new Error('Region selection flow detected. Use the correct regional base URL.');
  }

  // sanity: fetch /index
  const idx = await client.get('/index', { headers: { Referer: `${BASE}/login` } });
  if (isLoginHtml(idx.data)) {
    throw new Error('Login did not validate (still seeing Login page).');
  }
}

async function visitRefererAndTokens() {
  const refererUrl = GW_TCPSET_REFERER || `${BASE}/index`;
  const res = await client.get(refererUrl, {
    headers: { Referer: `${BASE}/login` }
  });
  const html = String(res.data || '');
  const tokens = parseHiddenTokens(html);
  return { refererUrl, tokens };
}

function buildPayload(password, scrapedTokens) {
  const snVal = GW_TCPSET_SN_VALUE || FALLBACK_SN;
  if (!snVal) throw new Error('Missing device SN: set GW_TCPSET_SN_VALUE or GROWATT_DEVICE_SN');

  const extra = {};

  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) {
    extra[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;
  }

  // merge scraped hidden tokens
  if (scrapedTokens) {
    for (const [k, v] of Object.entries(scrapedTokens)) {
      if (v && extra[k] === undefined) extra[k] = v;
    }
  }

  // allow explicit token override
  if (GW_TCPSET_TOKEN_KEY && GW_TCPSET_TOKEN_VALUE && extra[GW_TCPSET_TOKEN_KEY] === undefined) {
    extra[GW_TCPSET_TOKEN_KEY] = GW_TCPSET_TOKEN_VALUE;
  }

  const base = {
    action: GW_TCPSET_ACTION,
    type:   GW_TCPSET_TYPE,
    [GW_TCPSET_SN_KEY]: snVal,
    param1: GW_TCPSET_PARAM1,
    param2: GW_TCPSET_PARAM2,
    param3: GW_TCPSET_PARAM3,
    ...extra
  };
  if (password) base.password = password;
  return base;
}

function isTcpOk(resp) {
  // Try structured JSON first
  if (resp && typeof resp === 'object') {
    if (resp.success === true) return true;
    if (resp.result === 1) return true;
    if (typeof resp.msg === 'string' && /success/i.test(resp.msg)) return true;
  }
  // Then string heuristics
  const s = String(resp || '');
  if (/"success"\s*:\s*true/i.test(s)) return true;
  if (/"result"\s*:\s*1\b/.test(s)) return true;
  if (/"msg"\s*:\s*"success"/i.test(s)) return true;
  return false;
}

async function postTcpSet(refererUrl, payload) {
  const res = await client.post('/tcpSet.do', toForm(payload), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE,
      'Referer': refererUrl
    }
  });
  let data = res.data;
  // Some portals return text/json inconsistently
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { /* keep as string */ }
  }
  return { ok: isTcpOk(data), status: res.status, body: data };
}

// ----------------- MAIN -----------------

(async () => {
  // Validate required envs
  const required = [
    ['GROWATT_USERNAME or GW_USER', USER],
    ['GROWATT_PASSWORD or GW_PASS', PASS],
    ['GW_TCPSET_ACTION',  GW_TCPSET_ACTION],
    ['GW_TCPSET_TYPE',    GW_TCPSET_TYPE],
    ['GW_TCPSET_SN_KEY',  GW_TCPSET_SN_KEY],
    ['GW_TCPSET_SN_VALUE or GROWATT_DEVICE_SN', (GW_TCPSET_SN_VALUE || FALLBACK_SN)],
    ['GW_TCPSET_PARAM1',  GW_TCPSET_PARAM1],
    // PARAM2/PARAM3 are often optional but we check anyway if your replay used them:
    // ['GW_TCPSET_PARAM2',  GW_TCPSET_PARAM2],
    // ['GW_TCPSET_PARAM3',  GW_TCPSET_PARAM3],
  ];
  for (const [k, v] of required) {
    if (v === undefined || v === null || v === '') {
      throw new Error(`Missing env: ${k}`);
    }
  }

  await ensureLoggedIn();
  const { refererUrl, tokens } = await visitRefererAndTokens();

  const attempts = [];

  // 1) Explicit password (installer/advanced set) if you provided one
  if (GW_TCPSET_ADV_PWD) attempts.push({ pwd: GW_TCPSET_ADV_PWD, tag: 'explicit' });

  // 2) Daily password(s), unless disabled
  if (GW_TCPSET_NO_AUTO_PWD !== 'true') {
    const local = dailyPwd(0);
    const utc8  = dailyPwd(8);
    attempts.push({ pwd: local, tag: 'daily (local)' });
    if (utc8 !== local) attempts.push({ pwd: utc8, tag: 'daily (UTC+8)' });
  }

  // 3) Optional last attempt with no password (rare cases)
  if (GW_TCPSET_NO_AUTO_PWD === 'true') {
    attempts.push({ pwd: undefined, tag: 'no password' });
  }

  let last = { ok: false, status: 0, body: '' };
  for (const a of attempts) {
    const payload = buildPayload(a.pwd, tokens);
    console.log('Posting tcpSet.do with', { action: payload.action, type: payload.type, snKey: GW_TCPSET_SN_KEY, sn: payload[GW_TCPSET_SN_KEY], param1: payload.param1, param2: payload.param2, param3: payload.param3, tag: a.tag });
    last = await postTcpSet(refererUrl, payload);
    if (last.ok) {
      const preview = typeof last.body === 'string' ? last.body.slice(0, 300) : JSON.stringify(last.body).slice(0, 300);
      console.log(`✓ tcpSet OK with ${a.tag}. Response: ${preview}`);
      process.exit(0);
    } else {
      const preview = typeof last.body === 'string' ? last.body.slice(0, 300) : JSON.stringify(last.body).slice(0, 300);
      console.warn(`Attempt with ${a.tag} not accepted. HTTP ${last.status}. Preview: ${preview}`);
    }
  }

  const preview = typeof last.body === 'string' ? last.body.slice(0, 500) : JSON.stringify(last.body, null, 2);
  throw new Error(`tcpSet failed after ${attempts.length} attempt(s). HTTP ${last.status}. Body: ${preview}`);
})().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
