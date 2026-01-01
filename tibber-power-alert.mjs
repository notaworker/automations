
// tibber-power-subscribe.mjs
// Node 18+ (ESM).
// Dependencies: graphql-ws, ws, node-fetch (v3).

import { createClient } from 'graphql-ws';
import fetch from 'node-fetch';
import WebSocket from 'ws'; // Node WebSocket implementation (required on Node)

const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;
const MAX_RUNTIME_SEC = Number(process.env.MAX_RUNTIME_SEC || 300); // default: 5 minutes

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

// Tibber HTTPS GraphQL endpoint used to fetch the WebSocket subscription URL
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// 1) Fetch the websocketSubscriptionUrl over HTTPS
async function getWebsocketSubscriptionUrl() {
  const body = { query: `query { viewer { websocketSubscriptionUrl } }` };

  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Tibber requires Bearer token on HTTPS calls
      Authorization: `Bearer ${TIBBER_TOKEN}`,
    },
    body: JSON.stringify(body),
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
  console.log(`Connecting to Tibber WebSocket: ${wsUrl}`);

  // 2) Open the GraphQL subscription over WebSocket (Node needs ws as webSocketImpl)
  const client = createClient({
    url: wsUrl,
    webSocketImpl: WebSocket,
    // Tibber expects the token in the connection_init payload as { token: "<ACCESS_TOKEN>" }
    connectionParams: { token: TIBBER_TOKEN },
  });

  // 3) Subscribe to liveMeasurement for the chosen home and print only power
  const SUBSCRIPTION = `
    subscription LivePower {
      liveMeasurement(homeId: "${TIBBER_HOME_ID}") {
        timestamp
        power
      }
    }
  `;

  const stopAt = Date.now() + MAX_RUNTIME_SEC * 1000;

  await new Promise((resolve, reject) => {
    let done = false;

    client.subscribe(
      { query: SUBSCRIPTION },
      {
        next: (payload) => {
          const lm = payload?.data?.liveMeasurement;
          if (lm) {
            // Print only the power (and timestamp for context)
            console.log(`${lm.timestamp}  power=${lm.power} W`);
          }

          // Auto-exit after MAX_RUNTIME_SEC to keep workflows finite
          if (Date.now() >= stopAt && !done) {
            done = true;
            resolve();
          }
        },
        error: (err) => {
          if (!done) {
            done = true;
            reject(err);
          }
        },
        complete: () => {
          if (!done) {
            done = true;
            resolve();
          }
        },
      }
    );
  });

  console.log('Done (MAX_RUNTIME reached).');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
