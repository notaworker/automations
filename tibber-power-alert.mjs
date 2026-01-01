
// tibber-power-alert.mjs
// Node.js 18+ compatible (ESM). Uses node-fetch v3 for HTTPS calls.

import { createClient } from 'graphql-ws';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';

// --- Tibber secrets ---
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const HOME_ID = process.env.TIBBER_HOME_ID; // keep as secret-only (no fallback)

// --- Gmail-based email configuration (as requested) ---
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;   // recipient
const GMAIL_USER = process.env.GMAIL_USER;             // your Gmail address
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD; // app-specific password

// SMTP details for Gmail
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465); // 465 (SSL) by default
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;  // optional override

// Behavior knobs
const POWER_THRESHOLD = Number(process.env.POWER_THRESHOLD || 100);
const MAX_RUNTIME_SEC = Number(process.env.MAX_RUNTIME_SEC || 600); // 10 minutes

function assertEnv() {
  const missing = [];
  if (!TIBBER_TOKEN)           missing.push('TIBBER_TOKEN');
  if (!HOME_ID)                missing.push('TIBBER_HOME_ID');
  if (!EMAIL_RECIPIENT)        missing.push('EMAIL_RECIPIENT');
  if (!GMAIL_USER)             missing.push('GMAIL_USER');
  if (!GMAIL_APP_PASSWORD)     missing.push('GMAIL_APP_PASSWORD');
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
      // Tibber HTTPS auth requires Bearer token
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
    secure: SMTP_PORT === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
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
  await transporter.sendMail({
    from: MAIL_FROM,
    to: EMAIL_RECIPIENT,
    subject,
    text,
    html
  });
  console.log(`📧 Sent alert → ${EMAIL_RECIPIENT} (power=${power}W)`);
}

async function run() {
  assertEnv();

  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  const client = createClient({
    url: wsUrl,
    // Tibber subscription auth via connection_init payload { token: <your token> }
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
