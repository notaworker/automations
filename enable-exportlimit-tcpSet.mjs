
// enable-exportlimit-tcpSet.mjs
// Logs in to ShineServer, then replays the exact tcpSet.do payload your browser sends.
// It also supports optional fields (serial number / plant id) if your account requires them.

import fetch from 'node-fetch';

const BASE = 'https://server.growatt.com';

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_DEVICE_SN,       // only for an optional sanity check

  // Required (from DevTools -> the tcpSet.do request captured once)
  GW_TCPSET_ACTION,        // e.g., "inverterParamSet"  (copy verbatim from your request)
  GW_TCPSET_TYPE,          // e.g., "tlx"               (copy verbatim)

  // We compute the parameters [["202","1"]] in the workflow, so this env is provided by Actions:
  GW_TCPSET_PARAMETERS,    // e.g., '["202","1"]' or '["202","0"]'  (quotes included)

  // Optional (if present in your DevTools request)
  GW_TCPSET_ADV_PWD,       // e.g., growattYYYYMMDD for the day

  // Optional extra fields (depends on your portal payload)
  GW_TCPSET_SN_KEY,        // e.g., "serialNumber", "deviceSn", "sn"
  GW_TCPSET_SN_VALUE,      // usually your inverter S/N (paste from the request)
  GW_TCPSET_PLANT_KEY,     // e.g., "plantId"
  GW_TCPSET_PLANT_VALUE    // plant id (paste from the request)
} = process.env;

// --- small cookie jar ---
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

  // Warm-up GET to pick initial cookies
  {
    const r = await fetch(`${BASE}/login.do`, { redirect: 'manual' });
    cookie = collectCookies(r.headers, cookie);
  }

  // Actual login POST (ShineServer legacy login uses form fields "account" and "password")
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

  // Touch index to finalize the session (some deployments require this)
  const idx = await fetch(`${BASE}/index`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Cookie': cookie
    }
  });
  cookie = collectCookies(idx.headers, cookie);

  return cookie;
}

async function tcpSet(cookie) {
  // Build payload exactly like the browser form — all values are strings
  const payload = {
    action: GW_TCPSET_ACTION,
    type: GW_TCPSET_TYPE,
    parameters: GW_TCPSET_PARAMETERS
  };
  if (GW_TCPSET_ADV_PWD) payload.password = GW_TCPSET_ADV_PWD;

  // Extra fields if your portal includes them
  if (GW_TCPSET_SN_KEY && GW_TCPSET_SN_VALUE) payload[GW_TCPSET_SN_KEY] = GW_TCPSET_SN_VALUE;
  if (GW_TCPSET_PLANT_KEY && GW_TCPSET_PLANT_VALUE) payload[GW_TCPSET_PLANT_KEY] = GW_TCPSET_PLANT_VALUE;

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
  // Server returns various shapes, attempt detection:
  const isOk = resp.ok && (
    /"success"\s*:\s*true/i.test(text) ||
    /"result"\s*:\s*1/.test(text) ||
    /"msg"\s*:\s*"success"/i.test(text)
  );

  if (!isOk) {
    throw new Error(`tcpSet failed. HTTP ${resp.status}. Body: ${text}`);
  }
  console.log('✓ tcpSet OK:', text.slice(0, 300));
}

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD) {
    throw new Error('Missing GROWATT_USERNAME or GROWATT_PASSWORD');
  }
  if (!GW_TCPSET_ACTION || !GW_TCPSET_TYPE || !GW_TCPSET_PARAMETERS) {
    throw new Error('Missing one of GW_TCPSET_ACTION / GW_TCPSET_TYPE / GW_TCPSET_PARAMETERS');
  }

  const cookie = await login();

  // Optional sanity check: try to load a device page (non-fatal)
  try {
    const page = await fetch(`${BASE}/device/deviceList.do`, { headers: { Cookie: cookie } });
    await page.text();
  } catch { /* ignore */ }

  await tcpSet(cookie);
})().catch(err => {
  console.error('❌ Error:', err?.message || err);
  process.exit(1);
});
