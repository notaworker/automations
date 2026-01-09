// login.mjs
import fetch from "node-fetch";
import HttpsProxyAgent from "https-proxy-agent";

const USERNAME = process.env.GROWATT_USER;
const PASSWORD = process.env.GROWATT_PASS;
const PROXY_URL = process.env.PROXY_URL;

if (!USERNAME || !PASSWORD) {
  console.error("Missing GROWATT_USER or GROWATT_PASS env vars");
  process.exit(1);
}

const agent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;

async function login() {
  const url = "https://server.growatt.com/newLoginAPI.do";

  const body = new URLSearchParams({
    userName: USERNAME,
    password: PASSWORD,
    validateCode: "",
    isRememberMe: "0",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    agent,
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

  const cookies = res.headers.raw()["set-cookie"];
  console.log("Cookies:", cookies);
}

login().catch(console.error);
