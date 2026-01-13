
// growatt-login-test.mjs
// Purpose: Attempt a plain login to ShineServer and report success/failure.
// Works with legacy ShineServer login form at /login.do using fields "account" and "password".
// Usage (local):
//   GROWATT_USERNAME="you@example.com" GROWATT_PASSWORD="pass" node growatt-login-test.mjs
//
// Usage (GitHub Actions):
//   Add the two secrets and run `node growatt-login-test.mjs`

import fetch from 'node-fetch';

const BASE = (process.env.GW_SERVER_BASE || 'https://server.growatt.com').replace(/\/+$/, '');

const { GROWATT_USERNAME, GROWATT_PASSWORD } = process.env;

if (!GROWATT_USERNAME || !GROWATT_PASSWORD) {
  console.error('❌ Missing env: set GROWATT_USERNAME and GROWATT_PASSWORD');
  process.exit(1);
}

// Small cookie-jar helper
function mergeCookies(headers, jarStr) {
  const setCookies = headers.raw()['set-cookie'] || [];
  const jar = new Map();
  if (jarStr) {
    for (const c of jarStr.split(';').map(s => s.trim()).filter(Boolean)) {
      const name = c.split('=')[0];
      jar.set(name, c);
    }
  }
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    if (!first) continue;
    jar.set(first.split('=')[0], first);
  }
  return Array.from(jar.values()).join('; ');
}

function form(data) {
  return new URLSearchParams(data);
}

(async () => {
  let cookie = '';
  const logs = [];

  try {
    // 1) Warm-up GET to /login.do (common entry point on ShineServer)
    {
      const url = `${BASE}/login.do`;
      const r = await fetch(url, { redirect: 'follow' });
      cookie = mergeCookies(r.headers, cookie);
      logs.push(`GET ${url} → ${r.status} ${r.statusText}`);
    }

    // 2) POST credentials (legacy form uses account + password)
    const postUrl = `${BASE}/login.do`;
    const resp = await fetch(postUrl, {
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
      body: form({ account: GROWATT_USERNAME, password: GROWATT_PASSWORD })
    });
    cookie = mergeCookies(resp.headers, cookie);
    logs.push(`POST ${postUrl} → ${resp.status} ${resp.statusText}`);

    // 3) Try hitting the index/dashboard to verify session
    const idxUrl = `${BASE}/index`;
    const idx = await fetch(idxUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookie }
    });
    const idxText = await idx.text();
    logs.push(`GET ${idxUrl} → ${idx.status} ${idx.statusText}`);

    // Heuristics: if we can load /index and HTML contains common post-login markers
    const loggedIn =
      idx.ok &&
      (
        /Plant|Device|Dashboard|Logout|退出|电站|设备/i.test(idxText) || // common UI markers
        /\/logout\.do|\/index\/getPlantListTitle|\/device\/deviceList\.do/.test(idxText)
      );

    console.log(logs.join('\n'));
    if (loggedIn) {
      console.log('✅ Login appears to be SUCCESSFUL (session cookies valid and /index loaded).');
      process.exit(0);
    } else {
      // Print a short snippet for debugging
      const snippet = idxText.slice(0, 300).replace(/\s+/g, ' ');
      console.log('ℹ️  /index did not show post-login content. First 300 chars:', snippet);
      console.error('❌ Login did not validate. Check credentials, region host (GW_SERVER_BASE), or account status.');
      process.exit(2);
    }
  } catch (err) {
    console.error('❌ Error during login test:', err?.message || err);
    if (logs.length) console.log('\nTrace:\n' + logs.join('\n'));
    process.exit(3);
  }
})();
