import fetch, { Headers } from "node-fetch";
import nodemailer from "nodemailer";
import { createClient } from "graphql-ws";
import WebSocket from "ws";
import fs from "fs";

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const GROWATT_USERNAME = process.env.GROWATT_USERNAME;
const GROWATT_PASSWORD = process.env.GROWATT_PASSWORD;
const GROWATT_DEVICE_SN = process.env.GROWATT_DEVICE_SN;
const INVERTER_PASSWORD = process.env.INVERTER_PASSWORD || "";

const TIBBER_TOKEN = process.env.TIBBER_TOKEN;
const TIBBER_HOME_ID = process.env.TIBBER_HOME_ID;

const USER_AGENT =
  process.env.USER_AGENT ||
  "automations/1.0 (GitHub Actions) graphql-ws/6.0.6 ws/8.17.0";

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000);

// ─────────────────────────────────────────────────────────────
// EMAIL TRANSPORT
// ─────────────────────────────────────────────────────────────

const transporter =
  GMAIL_USER && GMAIL_PASS && EMAIL_RECIPIENT
    ? nodemailer.createTransport({
        service: "gmail",
        auth: { user: GMAIL_USER, pass: GMAIL_PASS },
      })
    : null;

async function sendEmail(subject, text) {
  if (!transporter) {
    console.warn("Email disabled: missing Gmail credentials.");
    return;
  }

  await transporter.sendMail({
    from: GMAIL_USER,
    to: EMAIL_RECIPIENT,
    subject,
    text,
  });
}

// ─────────────────────────────────────────────────────────────
// GROWATT LOGIN + EXPORT LIMIT SETTER
// ─────────────────────────────────────────────────────────────

async function growattLogin() {
  const payload = new URLSearchParams({
    account: GROWATT_USERNAME,
    password: GROWATT_PASSWORD,
    validateCode: "",
  });

  const res = await fetch("https://server.growatt.com/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: payload.toString(),
    redirect: "manual",
  });

  if (!res.ok) throw new Error("Growatt login failed");

  return res.headers.get("set-cookie") || "";
}

async function setExportLimitPercent(percent) {
  console.log(`Setting Growatt export limit to ${percent}%...`);

  const cookie = await growattLogin();

  const payload = new URLSearchParams({
    action: "tlxSet",
    serialNum: GROWATT_DEVICE_SN,
    type: "backflow_setting",
    param1: "1", // enable export limit
    param2: String(percent), // percentage
    param3: "0",
    pwd: INVERTER_PASSWORD,
  });

  const res = await fetch("https://server.growatt.com/tcpSet.do", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookie,
    },
    body: payload.toString(),
  });

  const text = await res.text();
  console.log("Growatt response:", text);
}

// ─────────────────────────────────────────────────────────────
// PRICE FETCH (Elprisetjustnu)
// ─────────────────────────────────────────────────────────────

async function getCurrentPrice() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const API_URL = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`;

  try {
    const res = await fetch(API_URL);
    const data = await res.json();

    const hour = new Date().getHours();
    const entry = data.find(
      (x) => new Date(x.time_start).getHours() === hour
    );

    if (!entry) return null;

    return entry.SEK_per_kWh;
  } catch (err) {
    console.error("Price fetch failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// TIBBER POWER FETCH (one-shot)
// ─────────────────────────────────────────────────────────────

async function getTibberPower() {
  const HTTP_GRAPHQL_ENDPOINT = "https://api.tibber.com/v1-beta/gql";

  const res = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TIBBER_TOKEN}`,
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      query: `query { viewer { websocketSubscriptionUrl } }`,
    }),
  });

  const json = await res.json();
  const wsUrl = json?.data?.viewer?.websocketSubscriptionUrl;

  if (!wsUrl) throw new Error("No Tibber WebSocket URL");

  class HeaderWebSocket extends WebSocket {
    constructor(url, protocols) {
      super(url, protocols, {
        headers: { "User-Agent": USER_AGENT },
      });
    }
  }

  const client = createClient({
    url: wsUrl,
    webSocketImpl: HeaderWebSocket,
    connectionParams: { token: TIBBER_TOKEN },
  });

  const SUB = `
    subscription {
      liveMeasurement(homeId: "${TIBBER_HOME_ID}") {
        timestamp
        power
      }
    }
  `;

  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        client.dispose();
        reject(new Error("Tibber timeout"));
      }
    }, TIMEOUT_MS);

    client.subscribe(
      { query: SUB },
      {
        next: (payload) => {
          if (settled) return;
          const m = payload?.data?.liveMeasurement;
          if (m && typeof m.power === "number") {
            settled = true;
            clearTimeout(timer);
            client.dispose();
            resolve(m.power);
          }
        },
        error: (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            client.dispose();
            reject(err);
          }
        },
      }
    );
  });
}

// ─────────────────────────────────────────────────────────────
// STATE MEMORY
// ─────────────────────────────────────────────────────────────

function getLastState() {
  try {
    return fs.readFileSync(".growatt_state", "utf8").trim();
  } catch {
    return "LIMIT_100"; // default
  }
}

function saveState(state) {
  fs.writeFileSync(".growatt_state", state);
}

// ─────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching price and power...");

  const price = await getCurrentPrice();
  const power = await getTibberPower();

  console.log("Price:", price, "SEK/kWh");
  console.log("Power:", power, "W");

  if (price < 0) {
    await sendEmail(
      "⚠️ Negative electricity price detected",
      `The electricity price is negative.\nPrice: ${price} SEK/kWh`
    );
  }

  const priceNegative = price < 0;
  const powerNegative = power < -50;

  let desired = "LIMIT_100";
  if (priceNegative && powerNegative) {
    desired = "LIMIT_0";
  }

  const last = getLastState();
  console.log("Last state:", last);
  console.log("Desired state:", desired);

  if (desired === last) {
    console.log("No change needed.");
    return;
  }

  if (desired === "LIMIT_0") {
    await setExportLimitPercent(0);
  } else {
    await setExportLimitPercent(100);
  }

  saveState(desired);

  await sendEmail(
    `Growatt export limit changed → ${desired}`,
    `Price: ${price} SEK/kWh\nPower: ${power} W\nNew export limit: ${
      desired === "LIMIT_0" ? "0%" : "100%"
    }`
  );
}

main().catch((err) => console.error("Fatal:", err));
