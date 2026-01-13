
// enable-exportlimit-tcpSet.mjs
// Replays ShineServer's tcpSet.do (TL-X style: action=tlxSet, type=backflow_setting, serialNum, param1..3)
// Always includes the Growatt daily password "growattYYYYMMDD" by default (not secret).
// If needed, auto-retries using UTC+8 date. Allows explicit override or disabling via env.
//
// References:
// - Growatt community docs: use daily password growattYYYYMMDD for Advanced Set writes
//   https://github.com/ealse/GrowattApi (README says: "if you need a password please enter: growattYYYYMMDD")
// - Reports that portals still accept the daily password for settings
//   https://github.com/johanmeijer/grott/issues/645

import fetch from 'node-fetch';

const BASE = 'https://server.growatt.com';

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,

  // Required (from your DevTools capture)
  GW_TCPSET_ACTION,     // tlxSet
  GW_TCPSET_TYPE,       // backflow_setting
  GW_TCPSET_SN_KEY,     // serialNum
  GW_TCPSET_SN_VALUE,   // e.g. QDL3CMN0DK

  // Per-run values from the workflow (Enable → 1,0,1 | Disable → 0,0,0)
  GW_TCPSET_PARAM1,
  GW_TCPSET_PARAM2,
  GW_TCPSET_PARAM3,

  // Optional: explicit Advanced-Set password if you want to supply one
  GW_TCPSET_ADV_PWD,

  // Optional: plant id (if your DevTools request included it)
  GW_TCPSET_PLANT_KEY,
  GW_TCPSET_PLANT_VALUE,

  // Optional: the exact Referer captured in DevTools for your Advanced-Set page
  GW_TCPSET_REFERER,

  // Optional: set to "true" to skip auto daily password
  GW_TCPSET_NO_AUTO_PWD
} = process.env;

function toParams(obj) { return new URLSearchParams(obj); }

// Tiny cookie jar
function mergeCookies(headers, cookieStr) {
  const setCookies = headers.raw()['set-cookie'] || [];
  const jar = new Map();
  if (cookieStr) {
    for (const c of cookieStr.split(';').map(s => s.trim()).filter(Boolean)) {
      const name = c.split('=')[0];
      jar.set(name, c);
    }
  }
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    if (!first) continue;
    const name = first.split('=')[0];
    jar.set(name, first);
  }
  return Array.from(jar.values()).join('; ');
}

async function login() {
  let cookie = '';

  // warm-up
  {
    const r = await fetch(`${BASE}/login.do`, { redirect: 'follow' });
    cookie = mergeCookies(r.headers, cookie);
  }

  // legacy login: form fields are "account" and "password"
  const body = toParams({ account: GROWATT_USERNAME, password: GROWATT_PASSWORD });
  const resp = await fetch(`${BASE}/login.do`, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0',
      'Origin': BASE,
      'Referer': `${BASE}/login.do`,
      'Cookie': cookie
    },
    body
  });
  cookie = mergeCookies(resp.headers, cookie);

  // Touch index/dashboard to stabilize session
  const idx = await fetch(`${BASE}/index`, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie }
  });
  cookie = mergeCookies(idx.headers, cookie);

  return cookie;
}

function makeDailyPwd(tzOffsetHours = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const shifted = new Date(utc + tzOffsetHours * 3600000);
  const yyyy = shifted.getFullYear().toString();
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `growatt${yyyy}${mm}${dd}`;
}

async function postTcpSet(cookie, passwordCandidate) {
  const payload = {
    action: GW_TCPSET_ACTION,
    type:   GW_TCPSET_TYPE,
    [GW_TCPSET_SN_KEY]: GW_TCPSET_SN_VALUE,
    param1: GW_TCPSET_PARAM1,
    param2: GW_TCPSET_PARAM2,
    param3: GW_TCPSET_PARAM3
  };
  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) {
    payload[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;
  }
  if (passwordCandidate) {
    payload.password = passwordCandidate;
  }

  const resp = await fetch(`${BASE}/tcpSet.do`, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE,
      'Referer': GW_TCPSET_REFERER || `${BASE}/`,
      'User-Agent': 'Mozilla/5.0',
      'Cookie': cookie
    },
    body: toParams(payload)
  });

  const text = await resp.text();
  const ok = resp.ok && (
    /"success"\s*:\s*true/i.test(text) ||
    /"result"\s*:\s*1/.test(text) ||
    /"msg"\s*:\s*"success"/i.test(text)
  );
  return { ok, status: resp.status, body: text };
}

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD) {
    throw new Error('Missing GROWATT_USERNAME or GROWATT_PASSWORD');
  }
  if (!GW_TCPSET_ACTION || !GW_TCPSET_TYPE || !GW_TCPSET_SN_KEY || !GW_TCPSET_SN_VALUE) {
    throw new Error('Missing GW_TCPSET_ACTION / GW_TCPSET_TYPE / GW_TCPSET_SN_KEY / GW_TCPSET_SN_VALUE');
  }

  const cookie = await login();

  // Build a prioritized list of password candidates:
  // 1) Explicit secret (if provided)
  // 2) Auto daily password (LOCAL)
  // 3) Auto daily password (UTC+8)
  // 4) No password (only if NO_AUTO_PWD=true)
  const candidates = [];
  if (GW_TCPSET_ADV_PWD) candidates.push(GW_TCPSET_ADV_PWD);

  const autoPwdLocal = makeDailyPwd(0);
  const autoPwdUTC8  = makeDailyPwd(8);

  if (GW_TCPSET_NO_AUTO_PWD !== 'true') {
    candidates.push(autoPwdLocal);
    if (autoPwdUTC8 !== autoPwdLocal) candidates.push(autoPwdUTC8);
  } else {
    // If auto password is disabled, still allow an empty attempt
    candidates.push(undefined);
  }

  // Try candidates until one succeeds
  let last = { ok: false, status: 0, body: '' };
  for (const pwd of candidates) {
    last = await postTcpSet(cookie, pwd);
    if (last.ok) {
      const tag = pwd
        ? (pwd === autoPwdLocal ? 'daily (local)' : (pwd === autoPwdUTC8 ? 'daily (UTC+8)' : 'explicit'))
        : 'no password';
      console.log(`✓ tcpSet OK with ${tag}:`, last.body.slice(0, 300));
      return;
    }
  }

  throw new Error(`tcpSet failed. HTTP ${last.status}. Body: ${last.body}`);
})().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
