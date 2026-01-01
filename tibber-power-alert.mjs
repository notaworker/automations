
// tibber-power-alert.mjs
// Node.js 18+ (ESM). Requires: graphql-ws, node-fetch v3, ws.
//
// Behavior:
// - Fetch websocketSubscriptionUrl via HTTPS (Bearer + User-Agent).
// - Open GraphQL subscription over WebSocket (graphql-transport-ws) with User-Agent.
// - Print the FIRST power reading and exit immediately (or timeout).

import { createClient } from 'graphql-ws';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// ── Env configuration ──────────────────────────────────────────────────────────
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

// Tibber requires a versioned User-Agent on BOTH HTTPS and WS handshakes.
// Provide via workflow env; fallback is acceptable but you can customize it.
const USER_AGENT =
  process.env.USER_AGENT ||
  'automations/1.0 (GitHub Actions) graphql-ws/6.0.6 ws/8.17.0';

// Optional: fail fast if no reading arrives within this time (ms)
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000); // 15s default

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

// ── HTTPS endpoint (queries/mutations) to bootstrap subscriptions ──────────────
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// Fetch websocketSubscriptionUrl via HTTPS (Bearer + User-Agent)
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

// ── WebSocket impl with headers (graphql-ws expects a constructor/class) ───────
class HeaderWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });
  }
}

// ── Main (one-shot) ────────────────────────────────────────────────────────────
async function main() {
  const wsUrl = await getWebsocketSubscriptionUrl();
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  const client = createClient({
    url: wsUrl,
    webSocketImpl: HeaderWebSocket,    // constructor with UA header
    // Tibber expects the token in connection_init payload (not WS header)
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
        // Close client before rejecting
        try { client.dispose(); } catch {}
        reject(new Error(`No liveMeasurement received within ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);

    disposeSub = client.subscribe(
      { query: SUB },
      {
        next: (payload) => {
          if (settled) return;
          const m = payload?.data?.liveMeasurement;
          if (m && typeof m.power !== 'undefined') {
            settled = true;
            clearTimeout(timer);
            // Print ONE snapshot and stop
            console.log(`${m.timestamp} power=${m.power} W`);
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
          // If server completes without a reading, let timeout handle it
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
