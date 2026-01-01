
// tibber-query.mjs (HTTPS only)
// Prints the raw JSON returned by https://api.tibber.com/v1-beta/gql for the query you choose.
// Requires: node-fetch v3 (ESM). Node 18+.

import fetch from 'node-fetch';

const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

if (!TIBBER_TOKEN || !TIBBER_HOME_ID) {
  console.error('Missing env: TIBBER_TOKEN and/or TIBBER_HOME_ID');
  process.exit(1);
}

const HTTP_GRAPHQL_ENDPOINT = 'https://api.tibber.com/v1-beta/gql';

// Example HTTPS QUERY (customize this to what you want over HTTPS)
// NOTE: This is NOT liveMeasurement (that is subscription-only).
const QUERY = `
  query Example($homeId: ID!) {
    viewer {
      home(id: $homeId) {
        id
        address { address1 postalCode city }
        currentSubscription {
          priceInfo {
            current { total energy tax currency }
          }
        }
      }
    }
  }
`;

async function run() {
  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
  // Print exactly what the endpoint returned
  console.log(JSON.stringify(json, null, 2));
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
