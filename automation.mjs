
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import fs from "fs";
import { execFile } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────
// PATH HELPERS (ESM-safe __dirname)
// ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// State file path: default next to this script, override via env
const STATE_PATH = process.env.GROWATT_STATE_PATH
  ? path.resolve(process.env.GROWATT_STATE_PATH)
  : path.join(__dirname, ".growatt_state");

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 15000); // kept for future reuse

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

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
// STATE MEMORY (robust, absolute path, atomic write)
// ─────────────────────────────────────────────────────────────

function ensureDirFor(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLastState() {
  try {
    const content = fs.readFileSync(STATE_PATH, "utf8").trim();
    return content || "LIMIT_100";
  } catch {
    // File missing on first run
    return "LIMIT_100";
  }
}

function saveStateAtomic(state) {
  ensureDirFor(STATE_PATH);
  const tmpPath = `${STATE_PATH}.tmp`;

  // Write to temp, fsync, then rename for atomicity
  const fd = fs.openSync(tmpPath, "w");
  try {
    fs.writeFileSync(fd, state, { encoding: "utf8" });
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, STATE_PATH);
}

// ─────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("State file path:", STATE_PATH);
  console.log("Fetching price...");

  const price = await getCurrentPrice();

  if (price === null || typeof price !== "number" || Number.isNaN(price)) {
    console.error("No valid price available right now. Exiting without change.");
    try {
      await sendEmail(
        "⚠️ Price unavailable — no change made",
        "The script could not obtain a valid electricity price and did not change the export limit."
      );
    } catch {}
    return;
  }

  console.log("Price:", price, "SEK/kWh");

  if (price < 0) {
    try {
      await sendEmail(
        "⚠️ Negative electricity price detected",
        `The electricity price is negative.\nPrice: ${price} SEK/kWh`
      );
    } catch {}
  }

  // Decision purely on price:
  // price < 0 -> LIMIT_0 ; price >= 0 -> LIMIT_100
  const desired = price < 0 ? "LIMIT_0" : "LIMIT_100";

  const last = getLastState();
  console.log("Last state (read from file):", last);
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

  try {
    saveStateAtomic(desired);
    // Re-read to verify
    const verify = getLastState();
    console.log("State saved. Verified state on disk:", verify);
    if (verify !== desired) {
      console.warn(
        `Warning: state verification mismatch (expected ${desired}, got ${verify}).`
      );
    }
  } catch (err) {
    console.error("Failed to save state file:", err);
  }

  try {
    await sendEmail(
      `Growatt export limit changed → ${desired}`,
      `Price: ${price} SEK/kWh\nNew export limit: ${
        desired === "LIMIT_0" ? "0%" : "100%"
      }`
    );
  } catch {}
}

main().catch((err) => console.error("Fatal:", err));
