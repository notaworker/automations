
// growatt-login-test.mjs
// Logs in, then tries multiple device-info endpoints by inverter serial (GW_DEVICE_SN),
// and prints a normalized "Connection Status" (Online/Offline/Unknown) with diagnostics.

import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import crypto from 'crypto';

const GW_SERVER_BASE = process.env.GW_SERVER_BASE || 'https://server.growatt.com';
const USER = process.env.GW_USER;
const PASS = process.env.GW_PASS;
const CAPTCHA = (process.env.GW_VALIDATE_CODE || '').toUpperCase();
const DEVICE_SN = process.env.GW_DEVICE_SN;

function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

async function loginOnce(client, { account, password, useMd5, validateCode, isReadPact }) {
  const form = new URLSearchParams();
  form.set('account', account);
  if (useMd5) {
    form.set('password', '');                   // site behavior: blank when sending hash
    form.set('passwordCrc', md5Hex(password));  // MD5 of plaintext password
  } else {
    form.set('password', password);             // fallback when server returns result == 8
    form.set('passwordCrc', '');
  }
  form.set('validateCode', validateCode || ''); // optional captcha
  form.set('isReadPact', isReadPact ? '1' : '0');

  const res = await client.post('/login', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': GW_SERVER_BASE,
      'Referer': `${GW_SERVER_BASE}/login`,
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json, text/javascript, */*; q=0.01'
    },
    validateStatus: () => true
  });

  let body;
  try { body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data; } catch { body = res.data; }
  return { status: res.status, body };
}

function normalizeDeviceStatus(payload) {
  // Accept different shapes: {obj:{...}}, {data:{...}}, direct object, arrays, etc.
  const candidates = [];
  if (!payload) return { statusCode: undefined, isOnline: undefined, source: 'no-payload' };

  const tryPush = (obj, source) => { if (obj && typeof obj === 'object') candidates.push({ obj, source }); };

  // Common containers
  tryPush(payload.obj, 'payload.obj');
  tryPush(payload.data, 'payload.data');
  tryPush(payload.device, 'payload.device');

  // List-type responses
  if (Array.isArray(payload.list)) tryPush(payload.list[0], 'payload.list[0]');
  if (Array.isArray(payload.rows)) tryPush(payload.rows[0], 'payload.rows[0]');
  if (Array.isArray(payload.dataList)) tryPush(payload.dataList[0], 'payload.dataList[0]');
  if (Array.isArray(payload.devices)) tryPush(payload.devices[0], 'payload.devices[0]');
  if (Array.isArray(payload.objList)) tryPush(payload.objList[0], 'payload.objList[0]');

  // If none of the above, treat payload itself as candidate
  tryPush(payload, 'payload');

  for (const { obj, source } of candidates) {
    const status = obj.status ?? obj.deviceStatus ?? obj.devStatus ?? obj.connectStatus;
    const onlineFlag = obj.isOnline ?? obj.online ?? obj.connected;
    if (status !== undefined || onlineFlag !== undefined) {
      const statusCode = Number.isFinite(status) ? status : undefined;
      const isOnline = onlineFlag !== undefined
        ? (onlineFlag === true || onlineFlag === 1 || onlineFlag === '1')
        : (statusCode !== undefined ? (statusCode === 1) : undefined);
      return { statusCode, isOnline, source, raw: obj };
    }
  }
  return { statusCode: undefined, isOnline: undefined, source: 'no-match', raw: payload };
}

async function tryDeviceInfoEndpoints(client, sn) {
  // Try several endpoint/param combinations commonly seen across Growatt deployments.
  const attempts = [
    // Legacy paths
    { url: '/device/getDeviceInfo', params: { deviceSn: sn } },
    { url: '/device/getDeviceInfo', params: { devSN: sn } },
    { url: '/device/getDeviceInfo', params: { sn } },
    { url: '/device/getDevInfo', params: { deviceSn: sn } },
    { url: '/device/getDevInfo', params: { sn } },

    // v3 paths
    { url: '/v3/device/getDeviceInfo', params: { deviceSn: sn } },
    { url: '/v3/device/getDeviceInfo', params: { sn } },
    { url: '/v3/device/getDevInfo', params: { deviceSn: sn } },

    // Device list with filter, sometimes returns the full device object
    { url: '/device/getDeviceList', params: { deviceSn: sn } },
    { url: '/v3/device/getDeviceList', params: { deviceSn: sn } },

    // Sometimes device detail is under plant pages; we’ll include SN so server may narrow
    { url: '/newShineWeb/device/getDeviceInfo', params: { deviceSn: sn } },
    { url: '/newShineWeb/device/getDeviceInfo', params: { sn } },
  ];

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': `${GW_SERVER_BASE}/index` };

  const results = [];

  for (const attempt of attempts) {
    try {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(attempt.params)) form.set(k, v);
      const res = await client.post(attempt.url, form, { headers, validateStatus: () => true });
      // Accept both JSON and stringified JSON
      let payload;
      try { payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data; } catch { payload = res.data; }

      const norm = normalizeDeviceStatus(payload);
      const okHttp = res.status >= 200 && res.status < 300;
      const likelyOk = okHttp && (payload && (payload.success === true || payload.result === 1 || payload.code === 200 || payload.status === 'success' || payload.msg === 'success' || payload.message === 'success' || payload.ok === true));

      results.push({
        endpoint: attempt.url,
        params: attempt.params,
        httpStatus: res.status,
        successFlag: likelyOk,
        norm,
        sample: typeof payload === 'object' ? JSON.stringify(payload).slice(0, 500) : String(payload).slice(0, 500),
      });

      // If we got a status or online flag, return immediately
      if (norm.statusCode !== undefined || norm.isOnline !== undefined) {
        return { best: results[results.length - 1], all: results };
      }
    } catch (e) {
      results.push({
        endpoint: attempt.url,
        params: attempt.params,
        httpStatus: 'ERR',
        error: e?.message || String(e),
      });
    }
  }

  return { best: null, all: results };
}

async function main() {
  if (!USER || !PASS || !DEVICE_SN) {
    console.error('Missing GW_USER, GW_PASS, or GW_DEVICE_SN env vars');
    process.exit(2);
  }

  const jar = new tough.CookieJar();
  const client = wrapper(axios.create({
    baseURL: GW_SERVER_BASE,
    jar,
    withCredentials: true,
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json, text/html;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: () => true
  }));

  // Preflight GET
  await client.get('/login');

  // Login
  let { body } = await loginOnce(client, {
    account: USER,
    password: PASS,
    useMd5: true,
    validateCode: CAPTCHA,
    isReadPact: true
  });
  console.log('POST /login →', body?.result);

  if (body?.result !== 1) {
    // MD5 mismatch → retry plaintext
    if (body?.result === 8) {
      ({ body } = await loginOnce(client, {
        account: USER,
        password: PASS,
        useMd5: false,
        validateCode: CAPTCHA,
        isReadPact: true
      }));
      console.log('POST /login (plaintext retry) →', body?.result);
    }
    if (body?.result !== 1) {
      console.error('❌ Login failed. Result:', body?.result);
      process.exit(2);
    }
  }
  console.log('✅ Logged in successfully.');

  // Try multiple device-info endpoints
  const { best, all } = await tryDeviceInfoEndpoints(client, DEVICE_SN);

  if (!best) {
    console.error('❌ Could not fetch device info from any known endpoint.');
    console.error('🔎 Diagnostics (first few attempts):');
    for (const r of all.slice(0, 6)) {
      console.error(`• ${r.endpoint} ${JSON.stringify(r.params)} → status=${r.httpStatus} err=${r.error || '—'} sample=${r.sample || '—'}`);
    }
    console.error('💡 Tips:\n  - Verify GW_DEVICE_SN is correct.\n  - Your tenant may use a plant-scoped API; if you can share a sample device page URL after login, I can tailor the exact endpoint.\n  - Some endpoints require extra params (plant id); we can add plant discovery in a next step.');
    process.exit(2);
  }

  const { endpoint, params, httpStatus, norm } = best;
  const statusCode = norm.statusCode;
  const isOnline = norm.isOnline;

  let statusText = 'Unknown';
  if (typeof isOnline === 'boolean') {
    statusText = isOnline ? 'Online' : 'Offline';
  } else if (statusCode === 1) {
    statusText = 'Online';
  } else if (statusCode === 0) {
    statusText = 'Offline';
  }

  console.log(`🔌 Inverter ${DEVICE_SN} Connection Status: ${statusText} (source: ${norm.source}, endpoint: ${endpoint}, http=${httpStatus})`);

  // Optional: fail if offline/unknown
  if (statusText !== 'Online') {
    console.error(`❌ Status is ${statusText}.`);
    process.exit(2);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
