
// tibber-power-alert.mjs
// Node.js 18+ (ESM). Requires: graphql-ws, nodemailer, node-fetch v3, ws.
//
// Behavior:
// - Fetch websocketSubscriptionUrl via HTTPS (Bearer + User-Agent).
// - Open GraphQL subscription over WebSocket (graphql-transport-ws) with User-Agent.
// - Log power values; email when power > threshold.
// - Auto-exit after MAX_RUNTIME_SEC to keep CI jobs finite.

import { createClient } from 'graphql-ws';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// ───────────────────────────────────────────────────────────────────────────────
// Environment configuration
// ───────────────────────────────────────────────────────────────────────────────

// Tibber
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const HOME_ID = process.env.TIBBER_HOME_ID;

// Gmail-based email (optional alert)
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

// REQUIRED by Tibber: a versioned User-Agent for HTTPS & WS handshakes
// Set this in your workflow env; adjust to identify your client + versions.
const USER_AGENT =
  process.env.USER_AGENT ||
  'automations/1.0 (GitHub Actions) graphql-ws/6.0.6 ws/8.17.0';

// SMTP (Gmail)
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465); // 465 (SSL) default
const MAIL_FROM = process.env.MAIL_FROM || GMAIL_USER;

// Behavior
const POWER_THRESHOLD = Number(process.env.POWER_THRESHOLD || 100); // W
const MAX_RUNTIME_SEC = Number(process.env.MAX_RUNTIME_SEC || 600); // 10 min
const ALERT_COOLDOWN_SEC = Number(process.env.ALERT_COOLDOWN_SEC || 0); // seconds
let lastAlertTs = 0;

// ───────────────────────────────────────────────────────────────────────────────
// Validations
// ───────────────────────────────────────────────────────────────────────────────
function assertEnv() {
  const missing = [];

  if (!TIBBER_TOKEN) missing.push('TIBBER_TOKEN');
  if (!HOME_ID) missing.push('TIBBER_HOME_ID');

  // Email alert requires these (skip if not provided)
  const emailConfigProvided =
    EMAIL_RECIPIENT && GMAIL_USER && GMAIL_APP_PASSWORD;

  if (!emailConfigProvided) {
    console.log(
      'ℹ️ Email alerts disabled (missing EMAIL_RECIPIENT/GMAIL_USER/GMAIL_APP_PASSWORD).'
    );
  }

  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// HTTPS endpoint to bootstrap subscriptions (queries/mutations live here)
// Per Tibber docs, use this HTTPS endpoint to obtain websocketSubscriptionUrl. [1](https://tibberpy.readthedocs.io/en/latest/getting_started.html)
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// Fetch Tibber websocketSubscriptionUrl via HTTPS (with Bearer + User-Agent)
async function getWebsocketSubscriptionUrl() {
  const body = {
    query: `
      query GetSubUrl {
        viewer {
          websocketSubscriptionUrl
        }
      }
    `,
  };

  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TIBBER_TOKEN}`,
      'User-Agent': USER_AGENT, // <- Tibber requires a versioned UA
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to get websocketSubscriptionUrl: ${res.status} ${res.statusText}`
    );
  }

  const json = await res.json();
  const url = json?.data?.viewer?.websocketSubscriptionUrl;
  if (!url || !url.startsWith('wss://')) {
    throw new Error(`Invalid websocketSubscriptionUrl: ${url ?? '(none)'}`);
  }
  return url;
}

// ───────────────────────────────────────────────────────────────────────────────
// Email (Gmail SMTP)
// ───────────────────────────────────────────────────────────────────────────────
function createMailTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // SSL on 465; for 587 STARTTLS set secure:false
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

async function sendAlertEmail({ timestamp, power }) {
  // Cooldown guard
  const now = Date.now();
  if (ALERT_COOLDOWN_SEC > 0 && now - lastAlertTs < ALERT_COOLDOWN_SEC * 1000) {
    console.log(`⏳ Alert suppressed by cooldown (${ALERT_COOLDOWN_SEC}s).`);
    return;
  }

  const transporter = createMailTransporter();
  const subject = `⚡ Tibber Alert: Power ${power}W @ ${new Date(
    timestamp
  ).toLocaleString()}`;
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
    html,
  });

  lastAlertTs = now;
  console.log(`📧 Sent alert → ${EMAIL_RECIPIENT} (power=${power}W)`);
}

// ───────────────────────────────────────────────────────────────────────────────
// WebSocket implementation with headers (constructor expected by graphql-ws)
//
// graphql-ws expects a *constructor/class* it can `new`. To inject Tibber's
// required User-Agent header, we subclass ws and set headers in super(...). 
class HeaderWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────────
async function run() {
  assertEnv();

  // 1) Get the correct WSS endpoint via HTTPS (with User-Agent)
  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  // 2) Open subscription over WebSocket using graphql-transport-ws
  //    Pass the HeaderWebSocket class as webSocketImpl (constructor).
  const client = createClient({
    url: wsUrl,
    webSocketImpl: HeaderWebSocket, // <- valid constructor, injects headers
    // Tibber expects the token in connection_init payload (not as a WS header)
    connectionParams: { token: TIBBER_TOKEN },
    retryAttempts: 10,
    shouldRetry: () => true,
  });

  // Subscription: liveMeasurement for this home
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
          // Always print the measurement
          console.log(`📡 ${timestamp}: power=${power}W`);

          // Optional email alert when power exceeds threshold
          const emailConfigProvided =
            EMAIL_RECIPIENT && GMAIL_USER && GMAIL_APP_PASSWORD;
          if (
            emailConfigProvided &&
            typeof power === 'number' &&
            power > POWER_THRESHOLD
          ) {
            try {
              await sendAlertEmail({ timestamp, power });
            } catch (err) {
              console.error('Email send failed:', err);
            }
          }

          // Stop when time limit is reached
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
        },
      }
    );
  });

  console.log('⏹️ MAX_RUNTIME reached, exiting.');
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
``
