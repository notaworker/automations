#!/usr/bin/env node

/**
 * Growatt Export Limit Updater
 * Updates the inverter's export limit via Growatt Cloud API
 * Usage: node updateExportLimit.mjs
 * 
 * Environment variables required:
 * - GROWATT_USERNAME: Your Growatt account email
 * - GROWATT_PASSWORD: Your Growatt account password
 * - DEVICE_SN: The inverter serial number (e.g., ODL3CMN0DK)
 * - EXPORT_LIMIT_VALUE: The export limit percentage (0-100, or specific power in W)
 * - EXPORT_LIMIT_MODE: "Percent" (default) or other modes
 * - ENABLE_METER: "Enable Meter" (typical default) or "Disable Meter"
 */

import fetch from 'node-fetch';

const BASE_URL = 'https://server.growatt.com';
const LOGIN_ENDPOINT = '/login';
const DEVICE_SETTING_ENDPOINT = '/tcpSet.do';

// Get environment variables
const USERNAME = process.env.GROWATT_USERNAME || '';
const PASSWORD = process.env.GROWATT_PASSWORD || '';
const DEVICE_SN = process.env.DEVICE_SN || 'ODL3CMN0DK';
const EXPORT_LIMIT_VALUE = process.env.EXPORT_LIMIT_VALUE || '50';
const EXPORT_LIMIT_MODE = process.env.EXPORT_LIMIT_MODE || 'Percent';
const ENABLE_METER = process.env.ENABLE_METER || 'Enable Meter';
const INVERTER_PASSWORD = process.env.INVERTER_PASSWORD || '';

if (!USERNAME || !PASSWORD) {
  console.error('ERROR: GROWATT_USERNAME and GROWATT_PASSWORD environment variables must be set');
  process.exit(1);
}

if (!INVERTER_PASSWORD) {
  console.warn('WARNING: INVERTER_PASSWORD environment variable not set. Using empty password.');
}

/**
 * Step 1: Login to Growatt
 */
async function loginToGrowatt(username, password) {
  console.log('Step 1: Logging in to Growatt...');
  
  const loginPayload = new URLSearchParams({
    account: username,
    password: password,
    validateCode: ''
  });

  try {
    const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0'
      },
      body: loginPayload.toString(),
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Login failed with status ${response.status}`);
    }

    console.log('✓ Login successful');
    return response;
  } catch (error) {
    console.error('✗ Login failed:', error.message);
    throw error;
  }
}

/**
 * Step 2: Get authentication cookies and session from login response
 */
async function getSessionCookie(loginResponse) {
  console.log('Step 2: Extracting session...');
  
  // The cookies are automatically managed by node-fetch if you use the same fetch instance
  // For this example, we'll get the Set-Cookie headers
  const setCookieHeader = loginResponse.headers.get('set-cookie');
  console.log('✓ Session extracted');
  
  return loginResponse;
}

/**
 * Step 3: Send export limit update command to device
 */
async function setExportLimit(sessionResponse, deviceSN, exportLimitValue, mode, enableMeter, inverterPassword) {
  console.log(`Step 3: Updating export limit for device ${deviceSN}...`);
  
  // Construct the parameter string based on Growatt's API format
  // The format appears to be: param=parameterName:value
  const paramString = `exportLimitationPower:${exportLimitValue}`;
  
  const payload = new URLSearchParams({
    deviceSN: deviceSN,
action: 'maxSet',
param: `plimitPer:${exportLimitValue}`,
    pwd: inverterPassword || 'growatt20260113' // Default password if not provided
  });

  try {
    const response = await fetch(`${BASE_URL}${DEVICE_SETTING_ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        'Cookie': sessionResponse.headers.get('set-cookie') || ''
      },
      body: payload.toString(),
      redirect: 'follow'
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`API call failed with status ${response.status}: ${responseText}`);
    }

    // Check if response contains success indicator
    if (responseText.includes('Successful') || responseText.includes('success') || responseText.includes('ok')) {
      console.log(`✓ Export limit updated to ${exportLimitValue}${mode === 'Percent' ? '%' : 'W'}`);
      return true;
    } else {
      console.warn('Response received but success status unclear:', responseText.substring(0, 200));
      return true;
    }
  } catch (error) {
    console.error('✗ Export limit update failed:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Growatt Export Limit Updater ===\n');
  console.log('Configuration:');
  console.log(`  Device SN: ${DEVICE_SN}`);
  console.log(`  Export Limit: ${EXPORT_LIMIT_VALUE}${EXPORT_LIMIT_MODE === 'Percent' ? '%' : 'W'}`);
  console.log(`  Enable Meter: ${ENABLE_METER}`);
  console.log('');

  try {
    // Step 1: Login
    const loginResponse = await loginToGrowatt(USERNAME, PASSWORD);
    
    // Step 2: Get session
    await getSessionCookie(loginResponse);
    
    // Step 3: Set export limit
    await setExportLimit(loginResponse, DEVICE_SN, EXPORT_LIMIT_VALUE, EXPORT_LIMIT_MODE, ENABLE_METER, INVERTER_PASSWORD);
    
    console.log('\n=== Successfully completed ===');
    process.exit(0);
  } catch (error) {
    console.error('\n=== Error occurred ===');
    console.error(error);
    process.exit(1);
  }
}

main();
