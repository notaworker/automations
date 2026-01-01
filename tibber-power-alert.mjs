
// tibber-power-alert.mjs
// Node.js 18+ (ESM). Requires: graphql-ws, ws, node-fetch v3, nodemailer.
//
// Behavior:
// - Fetch websocketSubscriptionUrl via HTTPS (Bearer + User-Agent).
// - Open GraphQL subscription over WebSocket (graphql-transport-ws) with User-Agent.
// - Print the FIRST power reading and exit immediately.
// - Send an email via Gmail SMTP with that reading (regardless of sign).

import { createClient } from 'graphql-ws';
import WebSocket from 'ws';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

// ── Required Tibber env ────────────────────────────────────────────────────────
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

// Tibber requires a versioned User-Agent on BOTH HTTPS and WS handshakes.
const USER_AGENT =
  process.env.USER_AGENT ||
  'automations/1.0 (GitHub Actions) graphql-ws/6.0.6 ws/8.17.0';

// Optional: timeout if no reading arrives (ms)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

// ── Gmail secrets ─────────────────────────────────────────────────────────────
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
const recipient = process.env.EMAIL_RECIPIENT; // Now uses the secret variable
const mailFrom = process.env.MAIL_FROM || user;
const SMTP_HOST = 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 465); // 465 SSL by default

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

// ── HTTPS endpoint (bootstrap for subscriptions) ───────────────────────────────
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// Get websocketSubscriptionUrl via HTTPS (Bearer + User-Agent)
async function getWebsocketSubscriptionUrl() {
  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TIBBER_TOKEN}`,
      'User-Agent': USER_AGENT,
    },
    body: JSON.stringify({
      query: `query { viewer { websocketSubscriptionUrl } }`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get ws url: HTTP ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const url = json?.data?.viewer?.websocketSubscriptionUrl;
  if (!url || !url.startsWith('wss://')) {
    throw new Error(`Invalid websocketSubscriptionUrl: ${url ?? '(none)'}`);
  }
  return url;
}

// ── WebSocket class that injects headers (graphql-ws expects a constructor) ────
class HeaderWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
  }
}

// ── Email (used for first reading) ─────────────────────────────────────────────
function createMailTransporter() {
  if (!user || !pass || !recipient) {
    console.warn(
      '⚠️ Email secrets missing (GMAIL_USER / GMAIL_APP_PASSWORD / EMAIL_RECIPIENT); email will be skipped.'
    );
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // true for SSL on 465; false for 587 STARTTLS
    auth: { user, pass },
  });
}

async function sendPowerEmail({ timestamp, power }) {
  const transporter = createMailTransporter();
  if (!transporter) return;

  const subject = `⚡ Tibber: Power reading (${power} W)`;
  const text = `Power reading\nHome: ${TIBBER_HOME_ID}\nTime: ${timestamp}\nPower: ${power} W`;
  const html = `
    <p><strong>Tibber Power Reading</strong></p>
    <ul>
      <li><b>Power:</b> ${power} W</li>
      <li><b>Timestamp:</b> ${timestamp}</li>
      <li><b>Home ID:</b> ${TIBBER_HOME_ID}</li>
    </ul>
  `;

  await transporter.sendMail({
    from: mailFrom,
    to: recipient,
    subject,
    text,
    html,
  });

  console.log(`📧 Power email sent → ${recipient} (power=${power}W)`);
}

// ── Main (one-shot) ────────────────────────────────────────────────────────────
async function main() {
  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  const client = createClient({
    url: wsUrl,
    webSocketImpl: HeaderWebSocket, // constructor that sets User-Agent header
    // Tibber expects token in connection_init payload (not WS header)
    connectionParams: { token: TIBBER_TOKEN },
  });

  const SUB = `
    subscription OnePower {
      liveMeasurement(homeId: "${TIBBER_HOME_ID}") {
        timestamp
        power
      }
    }
  `;

  // Resolve on first reading or reject on error/timeout
  const firstReading = new Promise((resolve, reject) => {
    let settled = false;
    let disposeSub = () => {};

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { client.dispose(); } catch {}
        reject(new Error(`No liveMeasurement received within ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);

    disposeSub = client.subscribe(
      { query: SUB },
      {
        next: async (payload) => {
          if (settled) return;
          const m = payload?.data?.liveMeasurement;
          if (m && typeof m.power !== 'undefined') {
            settled = true;
            clearTimeout(timer);

            // Print one snapshot
            console.log(`${m.timestamp} power=${m.power} W`);

            // Send an email on the first reading (best-effort)
            if (typeof m.power === 'number') {
              try {
                await sendPowerEmail({ timestamp: m.timestamp, power: m.power });
              } catch (err) {
                console.error('Email send failed:', err);
              }
            }

            // Clean up and exit
            try { disposeSub(); } catch {}
            try { client.dispose(); } catch {}
            resolve();
          }
        },
        error: (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { client.dispose(); } catch {}
            reject(err);
          }
        },
        complete: () => {
          // If server completes without a reading, timeout handles it
        },
      }
    );
  });

  await firstReading;
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
