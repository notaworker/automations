
// enable-exportlimit-tcpSet.mjs
// Replays the ShineServer tcpSet.do form your browser sends.
// Supports either "parameters" (legacy) or discrete param1/param2/param3 (TL-X portal style).

import fetch from 'node-fetch';

const BASE = 'https://server.growatt.com';

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,

  // Required (from DevTools request you captured)
  GW_TCPSET_ACTION,        // e.g., tlxSet
  GW_TCPSET_TYPE,          // e.g., backflow_setting

  // We'll supply these per-run from the workflow:
  GW_TCPSET_PARAM1,        // e.g., "1" or "0"
  GW_TCPSET_PARAM2,        // e.g., "0"
  GW_TCPSET_PARAM3,        // e.g., "1" or "0"

  // Optional if your portal still uses the legacy array form (not used for TL-X you showed)
  GW_TCPSET_PARAMETERS,    // e.g., '["202","1"]'

  // Optional fields your portal might require
  GW_TCPSET_SN_KEY,        // e.g., "serialNum"
  GW_TCPSET_SN_VALUE,      // e.g., your inverter SN "QDL3CMN0DK"
  GW_TCPSET_PLANT_KEY,     // e.g., "plantId"
  GW_TCPSET_PLANT_VALUE,   // e.g., "2198292"
  GW_TCPSET_ADV_PWD        // e.g., growattYYYYMMDD (if your portal asks for it)
} = process.env;

// --- small cookie jar helper ---
function collectCookies(headers, cookie) {
  const setCookies = headers.raw()['set-cookie'] || [];
  const entries = (cookie ? cookie.split(';').map(c => c.trim()).filter(Boolean) : []);
  const jar = new Map(entries.map(c => [c.split('=')[0], c]));
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    if (!first) continue;
    const [name] = first.split('=');
    jar.set(name, first);
  }
  return Array.from(jar.values()).join('; ');
}

async function login() {
  let cookie = '';

  // Warm-up GET to pick up initial cookies
  {
    const r = await fetch(`${BASE}/login.do`, { redirect: 'manual' });
    cookie = collectCookies(r.headers, cookie);
  }

  // Legacy Shine login uses form fields "account" and "password"
  const body = new URLSearchParams({
    account: GROWATT_USERNAME,
    password: GROWATT_PASSWORD
  });

  const resp = await fetch(`${BASE}/login.do`, {
    method: 'POST',
    redirect: 'manual',
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

  cookie = collectCookies(resp.headers, cookie);

  // Touch index to finalize session on some deployments
  const idx = await fetch(`${BASE}/index`, {
    method: 'GET',
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie }
  });
  cookie = collectCookies(idx.headers, cookie);

  return cookie;
}

async function tcpSet(cookie) {
  const payload = {
    action: GW_TCPSET_ACTION,
    type: GW_TCPSET_TYPE
  };

  // Include SN/Plant if provided
  if (GW_TCPSET_SN_KEY && GW_TCPSET_SN_VALUE) payload[GW_TCPSET_SN_KEY] = GW_TCPSET_SN_VALUE;
  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) payload[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;

  // Include password if your portal requires it
  if (GW_TCPSET_ADV_PWD) payload.password = GW_TCPSET_ADV_PWD;

  // Prefer discrete param1/2/3 for TL-X; fall back to legacy array if provided
  if (GW_TCPSET_PARAM1 !== undefined) payload.param1 = GW_TCPSET_PARAM1;
  if (GW_TCPSET_PARAM2 !== undefined) payload.param2 = GW_TCPSET_PARAM2;
  if (GW_TCPSET_PARAM3 !== undefined) payload.param3 = GW_TCPSET_PARAM3;

  if (!payload.param1 && !payload.param2 && !payload.param3 && GW_TCPSET_PARAMETERS) {
    payload.parameters = GW_TCPSET_PARAMETERS; // legacy array form
  }

  const resp = await fetch(`${BASE}/tcpSet.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': BASE,
      'Referer': `${BASE}/`,
      'User-Agent': 'Mozilla/5.0',
      'Cookie': cookie
    },
    body: new URLSearchParams(payload)
  });

  const text = await resp.text();
  const ok = resp.ok && (
    /"success"\s*:\s*true/i.test(text) ||
    /"result"\s*:\s*1/.test(text) ||
    /"msg"\s*:\s*"success"/i.test(text)
  );

  if (!ok) {
    throw new Error(`tcpSet failed. HTTP ${resp.status}. Body: ${text}`);
  }
  console.log('✓ tcpSet OK:', text.slice(0, 300));
}

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD) {
    throw new Error('Missing GROWATT_USERNAME or GROWATT_PASSWORD');
  }
  if (!GW_TCPSET_ACTION || !GW_TCPSET_TYPE) {
    throw new Error('Missing GW_TCPSET_ACTION or GW_TCPSET_TYPE');
  }

  const cookie = await login();
  await tcpSet(cookie);
})().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
