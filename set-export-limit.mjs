
// set-export-limit.mjs
// Usage examples:
//   EXPORT_LIMIT_ENABLE=1 node set-export-limit.mjs
//   EXPORT_LIMIT_ENABLE=0 node set-export-limit.mjs
//
// Required env (set as GitHub Secrets):
//   GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN
// Optional:
//   GROWATT_SERVER_BASE (defaults to https://server.growatt.com)
//   GROWATT_FUNC, GROWATT_REG_PARAM, GROWATT_VAL_PARAM  // override autodetect if needed

import pkg from 'growatt';               // CommonJS package; import compat:
const Growatt = pkg.default || pkg;

const {
  GROWATT_USERNAME,
  GROWATT_PASSWORD,
  GROWATT_DEVICE_SN,
  GROWATT_SERVER_BASE = 'https://server.growatt.com',
  EXPORT_LIMIT_ENABLE,
  GROWATT_FUNC,
  GROWATT_REG_PARAM,
  GROWATT_VAL_PARAM
} = process.env;

// Export Limit “enable” register used by ShineServer Advanced Set (0=off, 1=on)
const ENABLE_REGISTER = 202; // per Growatt Export Limitation docs (ShineServer/Advanced Set)
// Sources (ShineServer “Advanced Set” shows Register 202 → 1/0):
// https://bimblesolar.com/docs/growatt-export-limitation-guide.pdf
// https://www.arsaenergy.com/growatt/wp-content/uploads/2022/09/Export-Limitation-Guide-for-S-version-inverter.pdf

function fail(msg, code = 1) { console.error(msg); process.exit(code); }
function pick(obj, keys) {
  return keys.reduce((acc, k) => (obj && obj[k] !== undefined ? (acc[k] = obj[k], acc) : acc), {});
}

(async () => {
  if (!GROWATT_USERNAME || !GROWATT_PASSWORD || !GROWATT_DEVICE_SN) {
    fail('Missing env: set GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_SN');
  }
  if (EXPORT_LIMIT_ENABLE !== '0' && EXPORT_LIMIT_ENABLE !== '1') {
    fail('Set EXPORT_LIMIT_ENABLE to "1" (enable) or "0" (disable).');
  }
  const enableValue = Number(EXPORT_LIMIT_ENABLE);

  const api = new Growatt({ server: GROWATT_SERVER_BASE });

  console.log(`→ Logging in to ${GROWATT_SERVER_BASE} as ${GROWATT_USERNAME} …`);
  await api.login(GROWATT_USERNAME, GROWATT_PASSWORD);

  // Discover devices so we can determine inverter type
  const all = await api.getAllPlantData({
    plantData: false, weather: false, totalData: false,
    statusData: false, historyLast: false, deviceData: true
  });

  // Find your inverter by serial number across all plants
  let found = null;
  for (const plantId of Object.keys(all)) {
    const devs = all[plantId]?.devices || {};
    if (GROWATT_DEVICE_SN in devs) {
      found = { plantId, sn: GROWATT_DEVICE_SN, info: devs[GROWATT_DEVICE_SN] };
      break;
    }
  }
  if (!found) {
    fail(`Could not find inverter SN ${GROWATT_DEVICE_SN} in your Growatt account.`, 2);
  }

  const inverterType = found.info.growattType;
  console.log(`✓ Found inverter ${found.sn} (type: ${inverterType}) in plant ${found.plantId}`);

  // Map of writable functions for this model (from 'growatt' lib)  ⟶ lets us write registers
  // NPM package reference: https://www.npmjs.com/package/growatt
  const comm = api.getInverterCommunication(inverterType);

  // Try to autodetect a function that writes a single register (looks for params like "reg"/"register" + "val"/"value")
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
    console.error('Could not auto-detect a “write register” function for this model/firmware.');
    console.error('Tip: set overrides: GROWATT_FUNC, GROWATT_REG_PARAM, GROWATT_VAL_PARAM');
    console.error('Or capture a single ShineServer write in DevTools (request to tcpSet.do) and map the fields.'); // See Growatt API community docs
    await api.logout();
    process.exit(3);
  }

  console.log(`→ Writing register ${ENABLE_REGISTER}=${enableValue} using func "${funcName}" with params { ${regField}, ${valField} }`);

  const payload = { [regField]: ENABLE_REGISTER, [valField]: enableValue };
  const result = await api.setInverterSetting(inverterType, funcName, found.sn, payload);

  console.log('Write result:', JSON.stringify(pick(result, ['success', 'msg']) || result));

  // Best-effort read back (not all firmwares echo raw registers)
  try {
    const rb = await api.getInverterSetting(inverterType, funcName, found.sn);
    console.log('Read-back (best effort):', rb);
  } catch {
    console.log('Read-back not available for this func on this model (normal for some firmwares).');
  }

  await api.logout();
  console.log(`✓ Export Limit ${enableValue ? 'ENABLED' : 'DISABLED'} (register ${ENABLE_REGISTER}=${enableValue}).`);
})().catch((err) => {
  console.error('❌ Error:', err?.response?.data || err?.message || err);
  process.exit(10);
});
