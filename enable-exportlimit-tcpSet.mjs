
// enable-exportlimit-tcpSet.mjs
// Replays ShineServer "Advanced Set" -> tcpSet.do for TL-X:
//   action=tlxSet, type=backflow_setting, serialNum, param1..3
// Adds browser-like headers, follows redirects, visits Referer first,
// always includes today's installer password growattYYYYMMDD (not secret),
// retries with UTC+8 date, and supports extra token/plant fields if your portal uses them.
//
// References:
// - Replay tcpSet.do with action/type/parameters captured from DevTools (Growatt .NET example)  https://github.com/ealse/GrowattApi
// - Many ShineServer flows accept daily installer password growattYYYYMMDD for Advanced-Set writes (community reports)  https://github.com/johanmeijer/grott/issues/645
// - Export limit via Advanced Set documented in Growatt guides (historically register 202 => 1/0)  https://bimblesolar.com/docs/growatt-export-limitation-guide.pdf

import fetch from 'node-fetch';

const BASE = (process.env.GW_SERVER_BASE || 'https://server.growatt.com').replace(/\/+$/, '');

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,

  // Required (from DevTools)
  GW_TCPSET_ACTION,   // tlxSet
  GW_TCPSET_TYPE,     // backflow_setting
  GW_TCPSET_SN_KEY,   // serialNum
  GW_TCPSET_SN_VALUE, // QDL3CMN0DK

  // Per-run values (Enable -> 1,0,1 | Disable -> 0,0,0)
  GW_TCPSET_PARAM1,
  GW_TCPSET_PARAM2,
  GW_TCPSET_PARAM3,

  // Optional: explicit Advanced-Set password (we auto-compute if not provided)
  GW_TCPSET_ADV_PWD,

  // Optional: plant or token fields (only if your DevTools form shows them)
  GW_TCPSET_PLANT_KEY,     // e.g., plantId
  GW_TCPSET_PLANT_VALUE,   // e.g., 2198292
  GW_TCPSET_TOKEN_KEY,     // e.g., token, tokenId, csrf
  GW_TCPSET_TOKEN_VALUE,   // value from DevTools

  // Optional: exact Referer you saw in DevTools (Advanced Set page URL)
  GW_TCPSET_REFERER,

  // Optional: JSON with any extra form fields your portal posts (key/value)
  GW_TCPSET_EXTRA_JSON,    // e.g., {"lang":"en"}

  // Optional: set to 'true' to disable auto daily password
  GW_TCPSET_NO_AUTO_PWD
} = process.env;

// Helpers
function params(obj) { return new URLSearchParams(obj); }
function dailyPwd(tzHours = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const shifted = new Date(utc + tzHours * 3600000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `growatt${y}${m}${d}`;
}
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
  // legacy login form fields
  const body = params({ account: GROWATT_USERNAME, password: GROWATT_PASSWORD });
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

  // visit the *exact* Referer page first (so any tokens/cookies are set)
  const refererUrl = GW_TCPSET_REFERER || `${BASE}/index`;
  const ref = await fetch(refererUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie }
  });
  cookie = mergeCookies(ref.headers, cookie);

  return { cookie, refererUrl };
}

function buildPayload(passwordCandidate) {
  const extra = {};
  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) extra[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;
  if (GW_TCPSET_TOKEN_KEY && GW_TCPSET_TOKEN_VALUE) extra[GW_TCPSET_TOKEN_KEY] = GW_TCPSET_TOKEN_VALUE;
  if (GW_TCPSET_EXTRA_JSON) {
    try {
      Object.assign(extra, JSON.parse(GW_TCPSET_EXTRA_JSON));
    } catch {
      // ignore invalid JSON
    }
  }

  const base = {
    action: GW_TCPSET_ACTION,
    type:   GW_TCPSET_TYPE,
    [GW_TCPSET_SN_KEY]: GW_TCPSET_SN_VALUE,
    param1: GW_TCPSET_PARAM1,
    param2: GW_TCPSET_PARAM2,
    param3: GW_TCPSET_PARAM3,
    ...extra
  };

  if (passwordCandidate) base.password = passwordCandidate;
  return base;
}

async function postTcpSet(cookie, refererUrl, passwordCandidate) {
  const payload = buildPayload(passwordCandidate);

  const resp = await fetch(`${BASE}/tcpSet.do`, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE,
      'Referer': refererUrl,
      'User-Agent': 'Mozilla/5.0',
      'Cookie': cookie
    },
    body: params(payload)
  });

  const text = await resp.text();
  const ok = resp.ok && (
    /"success"\s*:\s*true/i.test(text) ||
    /"result"\s*:\s*1\b/.test(text) ||
    /"msg"\s*:\s*"success"/i.test(text)
  );
  return { ok, status: resp.status, body: text };
}

(async () => {
  const required = [
    ['GROWATT_USERNAME', GROWATT_USERNAME],
    ['GROWATT_PASSWORD', GROWATT_PASSWORD],
    ['GW_TCPSET_ACTION',  GW_TCPSET_ACTION],
    ['GW_TCPSET_TYPE',    GW_TCPSET_TYPE],
    ['GW_TCPSET_SN_KEY',  GW_TCPSET_SN_KEY],
    ['GW_TCPSET_SN_VALUE',GW_TCPSET_SN_VALUE],
    ['GW_TCPSET_PARAM1',  GW_TCPSET_PARAM1],
    ['GW_TCPSET_PARAM2',  GW_TCPSET_PARAM2],
    ['GW_TCPSET_PARAM3',  GW_TCPSET_PARAM3]
  ];
  for (const [k, v] of required) {
    if (v === undefined) throw new Error(`Missing env: ${k}`);
  }

  const { cookie, refererUrl } = await login();

  // Build candidate passwords:
  // 1) explicit secret (if provided)
  // 2) daily growattYYYYMMDD (LOCAL)
  // 3) daily growattYYYYMMDD (UTC+8)
  // If NO_AUTO_PWD=true, only use explicit or none.
  const candidates = [];
  if (GW_TCPSET_ADV_PWD) candidates.push(GW_TCPSET_ADV_PWD);

  const localPwd = dailyPwd(0);
  const utc8Pwd  = dailyPwd(8);

  if (GW_TCPSET_NO_AUTO_PWD !== 'true') {
    candidates.push(localPwd);
    if (utc8Pwd !== localPwd) candidates.push(utc8Pwd);
  } else {
    candidates.push(undefined); // single attempt without password
  }

  let last = { ok: false, status: 0, body: '' };
  for (const pwd of candidates) {
    last = await postTcpSet(cookie, refererUrl, pwd);
    if (last.ok) {
      const tag = pwd
        ? (pwd === localPwd ? 'daily (local)' : (pwd === utc8Pwd ? 'daily (UTC+8)' : 'explicit'))
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
