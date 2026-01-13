
// enable-exportlimit-tcpSet.mjs
// TL-X Advanced-Set write: action=tlxSet, type=backflow_setting, serialNum, param1..3
// - Logs in, visits Referer, scrapes tokens, adds growattYYYYMMDD automatically,
// - retries with UTC+8 daily password if needed,
// - replays tcpSet.do with browser-like headers.
//
// References:
// - Replay tcpSet.do (capture action/type/parameters in DevTools)  https://github.com/ealse/GrowattApi
// - Daily installer password growattYYYYMMDD widely used for Advanced-Set writes  https://github.com/johanmeijer/grott/issues/645
// - Export-limit via Advanced-Set (historically register 202 → 1/0)  https://bimblesolar.com/docs/growatt-export-limitation-guide.pdf

import fetch from 'node-fetch';

const BASE = (process.env.GW_SERVER_BASE || 'https://server.growatt.com').replace(/\/+$/, '');
const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GW_TCPSET_ACTION,      // tlxSet
  GW_TCPSET_TYPE,        // backflow_setting
  GW_TCPSET_SN_KEY,      // serialNum
  GW_TCPSET_SN_VALUE,    // your SN
  GW_TCPSET_PARAM1,
  GW_TCPSET_PARAM2,
  GW_TCPSET_PARAM3,
  GW_TCPSET_REFERER,     // exact Referer URL from DevTools (recommended)
  // Optional fallback envs if portal needs them:
  GW_TCPSET_PLANT_KEY, GW_TCPSET_PLANT_VALUE,
  GW_TCPSET_TOKEN_KEY, GW_TCPSET_TOKEN_VALUE,
  GW_TCPSET_ADV_PWD,          // explicit password if you prefer
  GW_TCPSET_NO_AUTO_PWD       // 'true' to disable daily pwd
} = process.env;

function params(obj) { return new URLSearchParams(obj); }
function dailyPwd(tz = 0) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const d = new Date(utc + tz * 3600000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `growatt${yyyy}${mm}${dd}`;
}
function mergeCookies(headers, jarStr) {
  const setCookies = headers.raw()['set-cookie'] || [];
  const jar = new Map();
  if (jarStr) {
    for (const c of jarStr.split(';').map(s => s.trim()).filter(Boolean)) {
      jar.set(c.split('=')[0], c);
    }
  }
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    if (!first) continue;
    jar.set(first.split('=')[0], first);
  }
  return Array.from(jar.values()).join('; ');
}

async function loginAndVisitReferer() {
  let cookie = '';
  // warm-up
  {
    const r = await fetch(`${BASE}/login.do`, { redirect: 'follow' });
    cookie = mergeCookies(r.headers, cookie);
  }
  // login
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

  const refererUrl = GW_TCPSET_REFERER || `${BASE}/index`;
  const ref = await fetch(refererUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie }
  });
  cookie = mergeCookies(ref.headers, cookie);
  const html = await ref.text();

  // Scrape common token names from Referer page
  const tokens = {};
  for (const name of ['token', 'tokenId', '_csrf']) {
    const m = html.match(new RegExp(`name=["']${name}["'][^>]*value="'["']`, 'i'));
    if (m) tokens[name] = m[1];
  }

  return { cookie, refererUrl, tokens };
}

function buildPayload(password, scrapedTokens) {
  const extra = {};
  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) extra[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;

  // prefer scraped tokens; fallback to env if provided
  if (scrapedTokens.token)   extra.token = scrapedTokens.token;
  if (scrapedTokens.tokenId) extra.tokenId = scrapedTokens.tokenId;
  if (scrapedTokens._csrf)   extra._csrf = scrapedTokens._csrf;
  if (GW_TCPSET_TOKEN_KEY && GW_TCPSET_TOKEN_VALUE && !extra[GW_TCPSET_TOKEN_KEY]) {
    extra[GW_TCPSET_TOKEN_KEY] = GW_TCPSET_TOKEN_VALUE;
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
  if (password) base.password = password;
  return base;
}

async function postTcpSet(cookie, refererUrl, payload) {
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
  for (const [k, v] of required) if (v === undefined) throw new Error(`Missing env: ${k}`);

  const { cookie, refererUrl, tokens } = await loginAndVisitReferer();

  const candidates = [];
  if (GW_TCPSET_ADV_PWD) candidates.push(GW_TCPSET_ADV_PWD);

  const localPwd = dailyPwd(0);
  const utc8Pwd  = dailyPwd(8);

  if (GW_TCPSET_NO_AUTO_PWD !== 'true') {
    candidates.push(localPwd);
    if (utc8Pwd !== localPwd) candidates.push(utc8Pwd);
  } else {
    candidates.push(undefined); // allow no password attempt
  }

  let last = { ok: false, status: 0, body: '' };
  for (const pwd of candidates) {
    const payload = buildPayload(pwd, tokens);
    last = await postTcpSet(cookie, refererUrl, payload);
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
