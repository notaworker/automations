#!/usr/bin/env node

/**
 * Growatt Export Limit Updater (MOD 10KTL3-XH)
 * Uses the same API call as the Growatt Web UI.
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://server.growatt.com';
const LOGIN_ENDPOINT = '/login';
const DEVICE_SETTING_ENDPOINT = '/tcpSet.do';

// Environment variables
const USERNAME = process.env.GROWATT_USERNAME || '';
const PASSWORD = process.env.GROWATT_PASSWORD || '';
const DEVICE_SN = process.env.DEVICE_SN || '';
const EXPORT_LIMIT_VALUE = process.env.EXPORT_LIMIT_VALUE || '50';
const INVERTER_PASSWORD = process.env.INVERTER_PASSWORD || '';

if (!USERNAME || !PASSWORD) {
  console.error('ERROR: Missing Growatt username or password');
  process.exit(1);
}

if (!DEVICE_SN) {
  console.error('ERROR: Missing DEVICE_SN');
  process.exit(1);
}

/**
 * Step 1: Login to Growatt
 */
async function loginToGrowatt(username, password) {
  console.log('Step 1: Logging in to Growatt...');

  const payload = new URLSearchParams({
    account: username,
    password: password,
    validateCode: ''
  });

  const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload.toString(),
    redirect: 'manual'
  });

  if (!response.ok) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  console.log('✓ Login successful');
  return response;
}

/**
 * Step 2: Send export limit update using the exact UI API format
 */
async function setExportLimit(sessionResponse, deviceSN, exportLimitValue, inverterPassword) {
  console.log(`Step 2: Setting export limit to ${exportLimitValue}% for device ${deviceSN}...`);

  const cookie = sessionResponse.headers.get('set-cookie') || '';

  // This matches the UI request EXACTLY:
  // action=tlxSet
  // type=backflow_setting
  // param1 = enable (1)
  // param2 = percentage
  // param3 = mode (0)
  const payload = new URLSearchParams({
    action: 'tlxSet',
    serialNum: deviceSN,
    type: 'backflow_setting',
    param1: '1',
    param2: exportLimitValue,
    param3: '0',
    pwd: inverterPassword || ''
  });

  const response = await fetch(`${BASE_URL}${DEVICE_SETTING_ENDPOINT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie
    },
    body: payload.toString(),
    redirect: 'manual'
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${text}`);
  }

  if (text.includes('success') || text.includes('Successful')) {
    console.log(`✓ Export limit updated to ${exportLimitValue}%`);
  } else {
    console.warn('⚠ Response unclear:', text.substring(0, 200));
  }
}

/**
 * Main
 */
async function main() {
  console.log('=== Growatt Export Limit Updater ===\n');
  console.log(`Device SN: ${DEVICE_SN}`);
  console.log(`New Export Limit: ${EXPORT_LIMIT_VALUE}%\n`);

  try {
    const loginResponse = await loginToGrowatt(USERNAME, PASSWORD);
    await setExportLimit(loginResponse, DEVICE_SN, EXPORT_LIMIT_VALUE, INVERTER_PASSWORD);

    console.log('\n=== Completed successfully ===');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  }
}

main();
