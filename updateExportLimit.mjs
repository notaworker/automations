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

async function login() {
  const payload = new URLSearchParams({
    account: USERNAME,
    password: PASSWORD,
    validateCode: ''
  });

  const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload.toString(),
    redirect: 'manual'
  });

  if (!response.ok) throw new Error(`Login failed: ${response.status}`);

  return response.headers.get('set-cookie') || '';
}

async function sendCommand(cookie, action, param) {
  const payload = new URLSearchParams({
    deviceSN: DEVICE_SN,
    action,
    param,
    pwd: INVERTER_PASSWORD
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
  return { ok: response.ok, text };
}

async function tryAll(cookie, percentValue) {
  const wattValue = Math.round((percentValue / 100) * 10000); // assume 10kW inverter

  const actions = ['maxSet', 'maxSet2'];
  const meterTypes = [1, 2];
  const params = [
    (v, m) => `plimitPer:${v},plimitEnable:1,meterType:${m}`,
    (v, m) => `plimit:${Math.round((v / 100) * 10000)},plimitEnable:1,meterType:${m}`
  ];

  for (const action of actions) {
    for (const meterType of meterTypes) {
      for (const buildParam of params) {
        const param = buildParam(percentValue, meterType);

        console.log(`Trying: action=${action}, meterType=${meterType}, param=${param}`);

        const result = await sendCommand(cookie, action, param);

        if (result.ok && (result.text.includes('success') || result.text.includes('Successful'))) {
          console.log(`✓ Success using action=${action}, meterType=${meterType}`);
          return true;
        }
      }
    }
  }

  return false;
}

async function main() {
  console.log('=== Growatt Auto‑Detect Export Limit Updater ===');

  try {
    const cookie = await login();
    const percent = Number(EXPORT_LIMIT_VALUE);

    const success = await tryAll(cookie, percent);

    if (success) {
      console.log(`\n=== Export limit updated to ${percent}% ===`);
    } else {
      console.log('\n✗ Could not update export limit — inverter rejected all combinations');
    }
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    process.exit(1);
  }
}

main();
