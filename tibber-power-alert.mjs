
// tibber-power-once.mjs
// Node 18+ (ESM). Dependencies: graphql-ws, ws, node-fetch v3.
//
// Behavior:
// - Calls Tibber HTTPS endpoint to get websocketSubscriptionUrl
// - Opens WebSocket subscription to liveMeasurement
// - Prints the FIRST reading's power & timestamp, then immediately exits

import { createClient } from 'graphql-ws';
import fetch from 'node-fetch';
import WebSocket from 'ws';

// --- Required environment variables ---
const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

// Optional timeout safety (ms) if no reading arrives
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000); // 15 seconds default

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

// Tibber HTTPS GraphQL endpoint to bootstrap the subscription URL
// (Queries/Mutations happen here; subscriptions require the returned wss URL.)
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// 1) Fetch the websocketSubscriptionUrl over HTTPS (Bearer token)
//    Doc flow: call /v1-beta/gql to get viewer.websocketSubscriptionUrl,
//    then connect to that URL via WebSocket for subscriptions.
async function getWebsocketSubscriptionUrl() {
  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TIBBER_TOKEN}`,
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

async function main() {
  const wsUrl = await getWebsocketSubscriptionUrl();

  const client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,                 // Node needs an explicit WebSocket impl
    // Tibber requires the token in connection_init payload for subscriptions
    // (payload: { token: "<access token>" }).
    connectionParams: { token: TIBBER_TOKEN },
  });

  const SUBSCRIPTION = `
    subscription OnePower {
      liveMeasurement(homeId: "${TIBBER_HOME_ID}") {
        timestamp
        power
      }
    }
  `;

  // Promise that resolves on first reading or rejects on error/timeout
  const firstReading = new Promise((resolve, reject) => {
    let settled = false;

    // Timeout guard in case no reading comes in
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`No liveMeasurement received within ${TIMEOUT_MS}ms`));
      }
    }, TIMEOUT_MS);

    // Start the subscription
    const dispose = client.subscribe(
      { query: SUBSCRIPTION },
      {
        next: (payload) => {
          if (settled) return;
          const m = payload?.data?.liveMeasurement;
          if (m && typeof m.power !== 'undefined') {
            settled = true;
            clearTimeout(timer);
            // Print a single snapshot and exit
            console.log(`${m.timestamp} power=${m.power} W`);
            // Dispose the subscription and close
            dispose(); // close this subscription
            resolve(null);
          }
        },
        error: (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        },
        complete: () => {
          // Server closed; if we haven’t received a reading, let timeout handle it
          if (!settled) {
            // no-op; wait for timeout or another event
          }
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
