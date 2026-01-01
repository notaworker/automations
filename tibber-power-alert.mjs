
// tibber-power-alert.mjs
// Node.js 18+ (ESM). Requires: graphql-ws, nodemailer, node-fetch v3, ws.

import { createClient } from 'graphql-ws';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import WebSocket from 'ws'; // <-- IMPORTANT: import ws for Node

// ── Env configuration ──────────────────────────────────────────────────────────
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const HOME_ID = process.env.TIBBER_HOME_ID;

// Gmail-based email
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;

const POWER_THRESHOLD = Number(process.env.POWER_THRESHOLD || 100);
const MAX_RUNTIME_SEC = Number(process.env.MAX_RUNTIME_SEC || 600);
const ALERT_COOLDOWN_SEC = Number(process.env.ALERT_COOLDOWN_SEC || 0);
let lastAlertTs = 0;

function assertEnv() {
  const missing = [];
  if (!TIBBER_TOKEN)       missing.push('TIBBER_TOKEN');
  if (!HOME_ID)            missing.push('TIBBER_HOME_ID');
  if (!EMAIL_RECIPIENT)    missing.push('EMAIL_RECIPIENT');
  if (!GMAIL_USER)         missing.push('GMAIL_USER');
  if (!GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ── Fetch Tibber websocketSubscriptionUrl (HTTPS) ──────────────────────────────
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

// ── Email helpers (Gmail SMTP) ─────────────────────────────────────────────────
function createMailTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for 465 (SSL), false for 587 (STARTTLS)
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
  });
}

async function sendAlertEmail({ timestamp, power }) {
  const now = Date.now();
  if (ALERT_COOLDOWN_SEC > 0 && now - lastAlertTs < ALERT_COOLDOWN_SEC * 1000) {
    console.log(`⏳ Alert suppressed by cooldown (${ALERT_COOLDOWN_SEC}s).`);
    return;
  }

  const transporter = createMailTransporter();
  const subject = `⚡ Tibber Alert: Power ${power}W @ ${new Date(timestamp).toLocaleString()}`;
  const text = `Power exceeded ${POWER_THRESHOLD}W
Home: ${HOME_ID}
Time: ${timestamp}
Value: ${power}W`;
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

  lastAlertTs = now;
  console.log(`📧 Sent alert → ${EMAIL_RECIPIENT} (power=${power}W)`);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function run() {
  assertEnv();

  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  // Provide WebSocket implementation for Node via ws
  const client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,           // <-- CRITICAL: this resolves your error
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
