
#!/usr/bin/env node
// set-export-limit.mjs
// Usage: EXPORT_LIMIT_ENABLE=1 node set-export-limit.mjs
// Required env: GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN
// Optional env: GROWATT_SERVER_BASE (default https://server.growatt.com)
// Advanced override (only if autodetect fails): GROWATT_FUNC, GROWATT_REG_PARAM, GROWATT_VAL_PARAM

import pkg from 'growatt'; // CommonJS package; default export may vary
const Growatt = pkg.default || pkg;

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_DEVICE_SN,
  GROWATT_SERVER_BASE = 'https://server.growatt.com',
  EXPORT_LIMIT_ENABLE,
  // Optional overrides:
  GROWATT_FUNC,
  GROWATT_REG_PARAM,
  GROWATT_VAL_PARAM
} = process.env;

// Basic validation
if (!GROWATT_USERNAME || !GROWATT_PASSWORD || !GROWATT_DEVICE_SN) {
  console.error('Missing required env. Set GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN');
  process.exit(1);
}
if (EXPORT_LIMIT_ENABLE !== '0' && EXPORT_LIMIT_ENABLE !== '1') {
  console.error('Set EXPORT_LIMIT_ENABLE to "1" (enable) or "0" (disable).');
  process.exit(1);
}

const ENABLE_REGISTER = 202; // ExportLimit enable/disable (0=off, 1=on), per Growatt docs
const enableValue = Number(EXPORT_LIMIT_ENABLE);

function pick(obj, keys) {
  return keys.reduce((acc, k) => (obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});
}

(async () => {
  const api = new Growatt({ server: GROWATT_SERVER_BASE });

  console.log(`→ Logging in to ${GROWATT_SERVER_BASE} as ${GROWATT_USERNAME} …`);
  await api.login(GROWATT_USERNAME, GROWATT_PASSWORD);

  // Fetch devices to identify inverter type and confirm SN
  const all = await api.getAllPlantData({
    plantData: false, weather: false, totalData: false, statusData: false, historyLast: false, deviceData: true
  });

  // The response groups devices by plant; flatten to find the SN
  let found = null;
  for (const plantId of Object.keys(all)) {
    const devs = all[plantId]?.devices || {};
    if (GROWATT_DEVICE_SN in devs) {
      found = { plantId, sn: GROWATT_DEVICE_SN, info: devs[GROWATT_DEVICE_SN] };
      break;
    }
  }
  if (!found) {
    console.error(`Could not find device with SN ${GROWATT_DEVICE_SN} in your account.`);
    process.exit(2);
  }
  const inverterType = found.info.growattType;
  console.log(`✓ Found inverter ${found.sn} (type: ${inverterType}) in plant ${found.plantId}`);

  // Discover available setting functions for this model
  const comm = api.getInverterCommunication(inverterType);

  // Try to auto-detect a "write register" style function:
  // we look for any "func" whose param set contains fields like "reg"/"register" and "val"/"value".
  let funcName = GROWATT_FUNC || null;
  let regField = GROWATT_REG_PARAM || null;
  let valField = GROWATT_VAL_PARAM || null;

  if (!funcName || !regField || !valField) {
    for (const [name, def] of Object.entries(comm)) {
      const params = def?.param || {};
      const keys = Object.keys(params);
      const rKey = regField || keys.find(k => /reg(ister)?/i.test(k));
      const vKey = valField || keys.find(k => /val(ue)?/i.test(k));
      if (rKey && vKey) {
        funcName = funcName || name;
        regField = regField || rKey;
        valField = valField || vKey;
        break;
      }
    }
  }

  if (!funcName || !regField || !valField) {
    console.error('Could not auto-detect a “write single register” function for this inverter model.');
    console.error('Tip: Re-run with overrides: GROWATT_FUNC, GROWATT_REG_PARAM, GROWATT_VAL_PARAM.');
    console.error('Also consider capturing the request once in the web UI (DevTools→Network) and mapping those fields.');
    await api.logout();
    process.exit(3);
  }

  console.log(`→ Using func "${funcName}" with params { ${regField}, ${valField} } to write register ${ENABLE_REGISTER}=${enableValue}`);

  // Write the enable/disable flag
  const payload = { [regField]: ENABLE_REGISTER, [valField]: enableValue };
  const result = await api.setInverterSetting(inverterType, funcName, found.sn, payload);

  // Many Growatt endpoints respond “success” even if the inverter is busy; the library retries internally,
  // but we still log the raw outcome for visibility.
  console.log('Write result:', JSON.stringify(pick(result, ['success', 'msg']) || result));

  // Optional: read back the same func (if supported) – not all models echo raw registers.
  try {
    const readBack = await api.getInverterSetting(inverterType, funcName, found.sn);
    console.log('Read-back (best effort):', readBack);
  } catch (e) {
    console.log('Read-back not available for this func; this is normal on some models.');
  }

  await api.logout();
  console.log(`✓ Export Limit ${enableValue ? 'ENABLED' : 'DISABLED'} (register ${ENABLE_REGISTER}=${enableValue}).`);
})().catch(async (err) => {
  console.error('❌ Error:', err?.response?.data || err?.message || err);
  process.exit(10);
});
