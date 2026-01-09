// login.mjs
import fetch from "node-fetch";

const USERNAME = process.env.GROWATT_USER;
const PASSWORD = process.env.GROWATT_PASS;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

if (!USERNAME || !PASSWORD || !SCRAPER_API_KEY) {
  console.error("Missing environment variables");
  process.exit(1);
}

async function login() {
  const targetUrl = "https://server.growatt.com/newLoginAPI.do";

  const scraperUrl =
    `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=` +
    encodeURIComponent(targetUrl);

  const body = new URLSearchParams({
    userName: USERNAME,
    password: PASSWORD,
    validateCode: "",
    isRememberMe: "0",
  });

  const res = await fetch(scraperUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const raw = await res.text();
  console.log("RAW RESPONSE:", raw);

  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Could not parse JSON. Growatt likely blocked the request.");
    process.exit(1);
  }

  console.log("Parsed JSON:", data);

  if (!data.success) {
    console.error("Login failed");
    process.exit(1);
  }

  console.log("Login OK");
}

login().catch(console.error);
