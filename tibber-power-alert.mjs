
// tibber-power-alert.mjs
// Node.js 18+ compatible (you already use ES modules). Uses node-fetch v3 for HTTPS calls.

import { createClient } from 'graphql-ws';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

// --- Env config ---
// Required secrets:
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const HOME_ID = process.env.TIBBER_HOME_ID;      // now secret-only (no fallback)
const MAIL_TO = process.env.MAIL_TO;             // now secret-only (no fallback)

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER;

// Behavior (can be repo variables or hard-coded in workflow env section)
const POWER_THRESHOLD = Number(process.env.POWER_THRESHOLD || 100);
const MAX_RUNTIME_SEC = Number(process.env.MAX_RUNTIME_SEC || 600); // 10 min

function assertEnv() {
  const missing = [];
  if (!TIBBER_TOKEN)   missing.push('TIBBER_TOKEN');
  if (!HOME_ID)        missing.push('TIBBER_HOME_ID');
  if (!MAIL_TO)        missing.push('MAIL_TO');
  if (!SMTP_HOST)      missing.push('SMTP_HOST');
  if (!SMTP_USER)      missing.push('SMTP_USER');
  if (!SMTP_PASS)      missing.push('SMTP_PASS');
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function getWebsocketSubscriptionUrl() {
  const httpEndpoint = 'https://api.tibber.com/v1-beta/gql';
  const body = {
    query: `
      query GetSubUrl {
        viewer {
          websocketSubscriptionUrl
        }
      }
    `
  };
  const res = await fetch(httpEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TIBBER_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    throw new Error(`Failed to get websocketSubscriptionUrl: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const url = json?.data?.viewer?.websocketSubscriptionUrl;
  if (!url || !url.startsWith('wss://')) {
    throw new Error(`Invalid websocketSubscriptionUrl: ${url ?? '(none)'}`);
  }
  return url;
}

function createMailTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendAlertEmail({ timestamp, power }) {
  const transporter = createMailTransporter();
  const subject = `⚡ Tibber Alert: Power ${power}W @ ${new Date(timestamp).toLocaleString()}`;
  const text = `Power exceeded ${POWER_THRESHOLD}W\nHome: ${HOME_ID}\nTime: ${timestamp}\nValue: ${power}W`;
  const html = `
    <p><strong>Tibber Power Alert</strong></p>
    <ul>
      <li><b>Power:</b> ${power} W</li>
      <li><b>Timestamp:</b> ${timestamp}</li>
      <li><b>Home ID:</b> ${HOME_ID}</li>
      <li><b>Threshold:</b> ${POWER_THRESHOLD} W</li>
    </ul>
  `;
  await transporter.sendMail({ from: MAIL_FROM, to: MAIL_TO, subject, text, html });
  console.log(`📧 Sent alert → ${MAIL_TO} (power=${power}W)`);
}

async function run() {
  assertEnv();

  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  const client = createClient({
    url: wsUrl,
    // Tibber auth for subscriptions: connection_init payload with { token }
    connectionParams: { token: TIBBER_TOKEN },
    retryAttempts: 10,
    shouldRetry: () => true
  });

  const SUBSCRIPTION = `
    subscription {
      liveMeasurement(homeId: "${HOME_ID}") {
        timestamp
        power
      }
    }
  `;

  const stopAt = Date.now() + MAX_RUNTIME_SEC * 1000;

  await new Promise((resolve, reject) => {
    let settled = false;

    client.subscribe(
      { query: SUBSCRIPTION },
      {
        next: async (payload) => {
          const lm = payload?.data?.liveMeasurement;
          if (!lm) return;
          const { timestamp, power } = lm;
          console.log(`📡 ${timestamp}: power=${power}W`);

          if (typeof power === 'number' && power > POWER_THRESHOLD) {
            try {
              await sendAlertEmail({ timestamp, power });
            } catch (err) {
              console.error('Email send failed:', err);
            }
          }

          if (Date.now() >= stopAt && !settled) {
            settled = true;
            resolve();
          }
        },
        error: (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
        },
        complete: () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }
      }
    );
  });

  console.log('⏹️ MAX_RUNTIME reached, exiting.');
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
