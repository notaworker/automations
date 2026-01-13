
// enable-exportlimit-tcpSet.mjs
// Purpose: Log into ShineServer with your credentials, then POST the same payload
// your browser sends to tcpSet.do to write register 202 (enable/disable ExportLimit).
//
// Required env (GitHub Secrets):
//   GROWATT_USERNAME, GROWATT_PASSWORD
//   GROWATT_DEVICE_SN   // target inverter SN, used to sanity-check device presence
//
// Required env (from DevTools → Network → the tcpSet.do request you captured once):
//   GW_TCPSET_ACTION       // e.g. "inverterParamSet" (value taken from the actual request)
//   GW_TCPSET_TYPE         // e.g. "tlx" or similar (from the actual request)
//   GW_TCPSET_PARAMETERS   // exactly the string the request sent, e.g. '["202","1"]'  (quotes included)
// Optional (only if your request shows a password field):
//   GW_TCPSET_ADV_PWD      // e.g. growattYYYYMMDD for that day, if your account requires it

import fetch from 'node-fetch';

const BASE = 'https://server.growatt.com';
const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_DEVICE_SN,
  GW_TCPSET_ACTION,
  GW_TCPSET_TYPE,
  GW_TCPSET_PARAMETERS,
  GW_TCPSET_ADV_PWD
} = process.env;

function reqBody(obj) {
  return new URLSearchParams(obj);
}

function parseSetCookie(headers) {
  const setCookies = headers.raw()['set-cookie'] || [];
  // Keep JSESSIONID and any additional session cookies
  const cookies = [];
  for (const sc of setCookies) {
    const semi = sc.split(';')[0];
    if (semi) cookies.push(semi.trim());
  }
  return cookies.join('; ');
}

async function login() {
  // ShineServer expects an initial GET to set cookies, then a login POST
  let cookie = '';

  // 1) warm-up GET
  {
    const r = await fetch(`${BASE}/login.do`, { redirect: 'manual' });
    cookie = parseSetCookie(r.headers);
  }

  // 2) POST login with form-encoded body
  const body = reqBody({
    account: GROWATT_USERNAME,
    password: GROWATT_PASSWORD
  });
  const resp = await fetch(`${BASE}/login.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': cookie
    },
    body
  });

  // Merge any new cookies
  cookie = [cookie, parseSetCookie(resp.headers)].filter(Boolean).join('; ');

  const text = await resp.text();
  if (!resp.ok || (!text.includes('ok') && !text.includes('success') && !text.includes('index'))) {
    throw new Error(`Login failed: HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }
  return cookie;
}

async function ensureDevice(cookie) {
  // Optional sanity check: confirm the device SN is visible under your account
  const resp = await fetch(`${BASE}/device/deviceList.do`, {
    headers: { 'Cookie': cookie }
  });
  const html = await resp.text();
  if (GROWATT_DEVICE_SN && !html.includes(GROWATT_DEVICE_SN)) {
    console.warn('⚠️ Device SN not found in device list page. Proceeding anyway (this check is best-effort).');
  }
}

async function tcpSet(cookie) {
  const payload = {
    action: GW_TCPSET_ACTION,
    type: GW_TCPSET_TYPE,
    parameters: GW_TCPSET_PARAMETERS
  };
  if (GW_TCPSET_ADV_PWD) payload.password = GW_TCPSET_ADV_PWD;

  const resp = await fetch(`${BASE}/tcpSet.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': cookie
    },
    body: reqBody(payload)
  });
  const text = await resp.text();
  if (!resp.ok || (!text.includes('success') && !text.includes('"result":1'))) {
    throw new Error(`tcpSet failed: HTTP ${resp.status} — ${text.slice(0, 500)}`);
  }
  console.log('✓ tcpSet success:', text.slice(0, 200));
}

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD) {
    throw new Error('Missing GROWATT_USERNAME or GROWATT_PASSWORD');
  }
  if (!GW_TCPSET_ACTION || !GW_TCPSET_TYPE || !GW_TCPSET_PARAMETERS) {
    throw new Error('Missing one of GW_TCPSET_ACTION, GW_TCPSET_TYPE, GW_TCPSET_PARAMETERS (from DevTools capture).');
  }

  const cookie = await login();
  await ensureDevice(cookie);
  await tcpSet(cookie);
})().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
``
