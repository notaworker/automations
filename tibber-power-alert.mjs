
// tibber-power-query.mjs
// Node 18+ (ESM). Dependencies: node-fetch v3 (already in your package.json).

import fetch from 'node-fetch';

const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

// Tibber HTTPS GraphQL endpoint (queries & mutations)
const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// This is a QUERY (no websocket). It returns the latest HOURLY energy consumption (kWh),
// NOT the instantaneous power (W). Tibber exposes live power only via Subscription.  [2](https://developer.tibber.com/docs/reference)
const QUERY = `
  query LastHourlyConsumption($homeId: ID!) {
    viewer {
      home(id: $homeId) {
        consumption(resolution: HOURLY, last: 1) {
          nodes {
            from
            to
            consumption   # kWh consumed in this hour
            cost
            currency
          }
        }
      }
    }
  }
`;

async function main() {
  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Tibber requires Bearer token on HTTPS calls.  [1](https://developer.tibber.com/docs/guides/calling-api)
      Authorization: `Bearer ${TIBBER_TOKEN}`,
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { homeId: TIBBER_HOME_ID },
    }),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }

  const json = await res.json();

  // Handle GraphQL errors (if any)
  if (json.errors) {
    console.error('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  const nodes = json?.data?.viewer?.home?.consumption?.nodes ?? [];
  if (nodes.length === 0) {
    console.log('No consumption data returned.');
    return;
  }

  const last = nodes[0];
  // This is energy (kWh) over the hour window, not instantaneous power.
  console.log(`Last hourly consumption: ${last.consumption} kWh, window: ${last.from} → ${last.to}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
