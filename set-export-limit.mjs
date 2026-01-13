
// list-functions.mjs
// Prints the writable function map for your inverter type, with parameter keys.
// Use this to pick GROWATT_FUNC, GROWATT_REG_PARAM, GROWATT_VAL_PARAM overrides.

import pkg from 'growatt';
const Growatt = pkg.default || pkg;

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_DEVICE_SN,
  GROWATT_SERVER_BASE = 'https://server.growatt.com'
} = process.env;

function fail(msg, code = 1) { console.error(msg); process.exit(code); }

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD || !GROWATT_DEVICE_SN) {
    fail('Missing env: set GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN');
  }

  const api = new Growatt({ server: GROWATT_SERVER_BASE });
  await api.login(GROWATT_USERNAME, GROWATT_PASSWORD);

  const all = await api.getAllPlantData({
    plantData: false, weather: false, totalData: false,
    statusData: false, historyLast: false, deviceData: true
  });

  let found = null;
  for (const plantId of Object.keys(all)) {
    const devs = all[plantId]?.devices || {};
    if (GROWATT_DEVICE_SN in devs) {
      found = { plantId, sn: GROWATT_DEVICE_SN, info: devs[GROWATT_DEVICE_SN] };
      break;
    }
  }
  if (!found) fail(`Could not find inverter SN ${GROWATT_DEVICE_SN} in your account.`, 2);

  const inverterType = found.info.growattType;
  console.log(`Inverter type: ${inverterType}`);
  const comm = api.getInverterCommunication(inverterType);

  console.log('--- Writable functions and their parameter keys ---');
  for (const [name, def] of Object.entries(comm)) {
    const params = def?.param || {};
    const paramKeys = Object.keys(params);
    // Skip purely read-only entries (no param keys)
    if (paramKeys.length === 0) continue;
    console.log(`FUNC: ${name}`);
    console.log(`PARAM KEYS: ${paramKeys.join(', ')}`);
    // Show a sample param definition
    for (const k of paramKeys) {
      const p = params[k];
      const type = p?.type || typeof p;
      const unit = p?.unit || '';
      console.log(`  - ${k} (type: ${type}${unit ? `, unit: ${unit}` : ''})`);
    }
    console.log('--------------------------------------------------');
  }

  await api.logout();
})().catch(err => {
  console.error('❌ list-functions error:', err?.response?.data || err?.message || err);
  process.exit(10);
});
