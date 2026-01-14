
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import fs from "fs";
import { execFile } from "child_process";
import path from "path";

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000); // kept in case you want to reuse

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
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) reject(error);
      else resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// PRICE FETCH (SE3, elprisetjustnu.se)
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

    return entry.SEK_per_kWh;
  } catch (err) {
    console.error("Price fetch failed:", err);
    return null;
  }
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
  console.log("Fetching price...");
  const price = await getCurrentPrice();

  if (price === null || typeof price !== "number" || Number.isNaN(price)) {
    console.error("No valid price available right now. Exiting without change.");
    await sendEmail(
      "⚠️ Price unavailable — no change made",
      "The script could not obtain a valid electricity price and did not change the export limit."
    ).catch(() => {});
    return;
  }

  console.log("Price:", price, "SEK/kWh");

  // Notify separately if price is negative (optional but kept from your original script)
  if (price < 0) {
    await sendEmail(
      "⚠️ Negative electricity price detected",
      `The electricity price is negative.\nPrice: ${price} SEK/kWh`
    ).catch(() => {});
  }

  // Desired behavior:
  // - LIMIT_0  when price < 0
  // - LIMIT_100 when price >= 0 (i.e., positive or zero)
  const desired = price < 0 ? "LIMIT_0" : "LIMIT_100";

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
    `Price: ${price} SEK/kWh\nNew export limit: ${desired === "LIMIT_0" ? "0%" : "100%"}`
  ).catch(() => {});
}

main().catch((err) => console.error("Fatal:", err));
