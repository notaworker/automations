
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import { createClient } from "graphql-ws";
import WebSocket from "ws";
import fs from "fs";
import { execFile } from "child_process";
import path from "path";

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

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
// CALL WORKING GROWATT SCRIPT
// ─────────────────────────────────────────────────────────────

function callGrowattLimit(percent) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve("./updateExportLimit.mjs");

    const env = {
      ...process.env,
      EXPORT_LIMIT_VALUE: String(percent),
    };

    execFile("node", [scriptPath], { env }, (error, stdout, stderr) => {
      console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// PRICE FETCH
// ─────────────────────────────────────────────────────────────

async function getCurrentPrice() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const API_URL = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const hour = new Date().getHours();
    const entry = data.find((x) => new Date(x.time_start).getHours() === hour);
    if (!entry) return null;

    const value =
      typeof entry.SEK_per_kWh === "number"
        ? entry.SEK_per_kWh
        : parseFloat(entry.SEK_per_kWh);

   ────────────
// TIBBER POWER FETCH
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
    return "LIMIT_100";
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

  const priceNegative = typeof price === "number" && price < 0;
  const priceNonNegative = typeof price === "number" && price >= 0;
  const powerNegative = typeof power === "number" && power < -50;

  if (priceNegative) {
    await sendEmail(
      "⚠️ Negative electricity price detected",
      `The electricity price is negative.\nPrice: ${price} SEK/kWh`
    );
  }

  // Decision logic
  let desired = "LIMIT_100";
  if (priceNegative && powerNegative) {
    desired = "LIMIT_0";
  } else if (priceNonNegative) {
    desired = "LIMIT_100";
  } else {
    console.warn("Price unavailable; defaulting to LIMIT_100.");
    desired = "LIMIT_100";
  }

  const last = getLastState();
  console.log("Last state:", last);
  console.log("Desired state:", desired);

  if (desired === last) {
    console.log("No change needed.");
    return;
  }

  if (desired === "LIMIT_0") {
    await callGrowattLimit(0);
  } else {
    await callGrowattLimit(100);
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
