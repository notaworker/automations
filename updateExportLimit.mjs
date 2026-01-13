#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'https://server.growatt.com';
const LOGIN_ENDPOINT = '/login';
const DEVICE_SETTING_ENDPOINT = '/tcpSet.do';

const USERNAME = process.env.GROWATT_USERNAME || '';
const PASSWORD = process.env.GROWATT_PASSWORD || '';
const DEVICE_SN = process.env.DEVICE_SN || '';
const EXPORT_LIMIT_VALUE = process.env.EXPORT_LIMIT_VALUE || '50';
const INVERTER_PASSWORD = process.env.INVERTER_PASSWORD || '';

if (!USERNAME || !PASSWORD) {
  console.error('ERROR: Missing Growatt username or password');
  process.exit(1);
}

async function loginToGrowatt(username, password) {
  console.log('Step 1: Logging in to Growatt...');

  const payload = new URLSearchParams({
    account: username,
    password: password,
    validateCode: ''
  });

  const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    redirect: 'manual'
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  console.log('✓ Login successful');
  return response;
}

async function setExportLimit(sessionResponse, deviceSN, limitValue, inverterPassword) {
  console.log(`Step 2: Setting export limit to ${limitValue}% for device ${deviceSN}...`);

  const cookie = sessionResponse.headers.get('set-cookie') || '';

  const payload = new URLSearchParams({
    deviceSN: deviceSN,
    action: 'maxSet',
    param: `plimitPer:${limitValue},plimitEnable:1,meterType:1`,
    pwd: inverterPassword
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
    console.log(`✓ Export limit updated to ${limitValue}%`);
  } else {
    console.warn('⚠ Response received but unclear:', text.substring(0, 200));
  }
}

async function main() {
  console.log('=== Growatt Export Limit Updater ===\n');

  try {
    const loginResponse = await loginToGrowatt(USERNAME, PASSWORD);
    await setExportLimit(loginResponse, DEVICE_SN, EXPORT_LIMIT_VALUE, INVERTER_PASSWORD);
    console.log('\n=== Completed successfully ===');
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  }
}

main();
