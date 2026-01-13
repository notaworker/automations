
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
    form.set('password', '');
    form.set('passwordCrc', md5Hex(password));
  } else {
    form.set('password', password);
    form.set('passwordCrc', '');
  }
  form.set('validateCode', validateCode || '');
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
    headers: { 'User-Agent': 'Mozilla/5.0' },
    validateStatus: () => true
  }));

  // Preflight
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
    console.error('❌ Login failed. Result:', body?.result);
    process.exit(2);
  }

  console.log('✅ Logged in successfully.');

  // Fetch device details by serial number
  const res = await client.post('/device/getDeviceInfo', new URLSearchParams({ deviceSn: DEVICE_SN }), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  const data = res.data;
  if (!data || !data.obj) {
    console.error('❌ Could not fetch device info.');
    process.exit(2);
  }

  const status = data.obj.status; // Usually 1 = online, 0 = offline
  const statusText = status === 1 ? 'Online' : 'Offline';
  console.log(`🔌 Inverter ${DEVICE_SN} Connection Status: ${statusText}`);

  // Optional: fail if offline
  if (status !== 1) {
    console.error('❌ Inverter is offline.');
    process.exit(2);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
