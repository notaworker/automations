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

// Tracks whether a negative-price alert has already been sent for the current slot
const ALERT_STATE_PATH = process.env.GROWATT_ALERT_STATE_PATH
  ? path.resolve(process.env.GROWATT_ALERT_STATE_PATH)
  : path.join(__dirname, ".growatt_alert_state");

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
// TIME FORMATTING (Europe/Stockholm)
// ─────────────────────────────────────────────────────────────

function toStockholmTime(isoString) {
  return new Date(isoString).toLocaleString("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
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
// The API returns 15-minute price slots. We fetch today's data
// and also tomorrow's if we need lookahead slots past midnight.
// ─────────────────────────────────────────────────────────────

async function fetchPricesForDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const API_URL = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`;

  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Price fetch failed for ${year}-${month}-${day}:`, err);
    return [];
  }
}

async function getPriceData() {
  const now = new Date();
  const today = await fetchPricesForDate(now);

  // Also fetch tomorrow in case we need lookahead slots past midnight
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowData = await fetchPricesForDate(tomorrow);

  // Merge and sort all slots chronologically
  const all = [...today, ...tomorrowData].sort(
    (a, b) => new Date(a.time_start) - new Date(b.time_start)
  );

  return all.length > 0 ? all : null;
}

// Returns the current slot and the next 3 slots (4 total = 1 hour)
function getCurrentAndLookaheadSlots(data) {
  const now = new Date();

  // Find the slot whose window contains the current time
  const currentIndex = data.findIndex((slot, i) => {
    const start = new Date(slot.time_start);
    const end = data[i + 1]
      ? new Date(data[i + 1].time_start)
      : new Date(start.getTime() + 15 * 60 * 1000);
    return now >= start && now < end;
  });

  if (currentIndex === -1) return null;

  // Grab current + next 3 slots (4 x 15 min = 1 hour)
  return data.slice(currentIndex, currentIndex + 4);
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
// ALERT STATE — tracks which slot key we last sent a negative
// price alert for, so we don't re-send every 15 minutes.
// Key format: "YYYY-MM-DDTHH:MM" (slot start, minute precision)
// ─────────────────────────────────────────────────────────────

function getLastAlertSlot() {
  try {
    return fs.readFileSync(ALERT_STATE_PATH, "utf8").trim() || "";
  } catch {
    return "";
  }
}

function saveAlertSlot(slotKey) {
  ensureDirFor(ALERT_STATE_PATH);
  const tmpPath = `${ALERT_STATE_PATH}.tmp`;
  const fd = fs.openSync(tmpPath, "w");
  try {
    fs.writeFileSync(fd, slotKey, { encoding: "utf8" });
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, ALERT_STATE_PATH);
}

// ─────────────────────────────────────────────────────────────
// DESIRED STATE LOGIC
//
// Only restrict export when ALL 4 consecutive 15-minute slots
// (current + next 3) are ≤ -0.20 SEK/kWh. This ensures the
// price is deeply negative for a full hour before we act.
//
//   all 4 slots ≤ -0.20 SEK/kWh  →  LIMIT_5  (5%)
//   anything else                 →  LIMIT_100 (100%)
// ─────────────────────────────────────────────────────────────

function determineDesiredState(slots) {
  if (!slots || slots.length < 4) return "LIMIT_100";

  const allDeepNegative = slots.every((s) => s.SEK_per_kWh <= -0.20);
  return allDeepNegative ? "LIMIT_5" : "LIMIT_100";
}

// ─────────────────────────────────────────────────────────────
// MAIN LOGIC
// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("State file path:", STATE_PATH);
  console.log("Fetching prices...");

  const data = await getPriceData();

  if (!data) {
    console.error("No price data available. Exiting without change.");
    try {
      await sendEmail(
        "⚠️ Price unavailable — no change made",
        "The script could not obtain valid electricity prices and did not change the export limit."
      );
    } catch {}
    return;
  }

  const slots = getCurrentAndLookaheadSlots(data);

  if (!slots || slots.length === 0) {
    console.error("Could not find current price slot. Exiting without change.");
    try {
      await sendEmail(
        "⚠️ Price unavailable — no change made",
        "The script could not find a valid price slot for the current time and did not change the export limit."
      );
    } catch {}
    return;
  }

  const currentPrice = slots[0].SEK_per_kWh;
  console.log(`Found ${slots.length} slot(s) starting from now:`);
  slots.forEach((s, i) =>
    console.log(`  Slot ${i + 1}: ${toStockholmTime(s.time_start)} → ${s.SEK_per_kWh} SEK/kWh`)
  );

  if (slots.length < 4) {
    console.log(
      `Only ${slots.length}/4 slots available (near end of day and tomorrow's prices not yet published) — not limiting export.`
    );
  } else if (slots.some((s) => s.SEK_per_kWh > -0.20)) {
    console.log(
      "Not all 4 upcoming slots are ≤ -0.20 SEK/kWh — not limiting export."
    );
  }

  // ── Negative price alert (fires once per slot, regardless of export limit) ──
  // Sends an email whenever the current slot price is < -0.10 SEK/kWh,
  // but only once per slot so repeated runs don't spam.
  const NEGATIVE_ALERT_THRESHOLD = -0.10;
  if (currentPrice < NEGATIVE_ALERT_THRESHOLD) {
    const currentSlotKey = slots[0].time_start; // ISO string, unique per slot
    const lastAlertSlot = getLastAlertSlot();

    if (lastAlertSlot !== currentSlotKey) {
      console.log(
        `Price ${currentPrice} SEK/kWh is below ${NEGATIVE_ALERT_THRESHOLD} — sending alert email.`
      );
      try {
        await sendEmail(
          `⚡ Negative electricity price alert: ${currentPrice} SEK/kWh`,
          `The current electricity price has dropped below ${NEGATIVE_ALERT_THRESHOLD} SEK/kWh.\n\nCurrent slot: ${toStockholmTime(currentSlotKey)}\nPrice: ${currentPrice} SEK/kWh\n\nThis alert is sent once per 15-minute slot.`
        );
        saveAlertSlot(currentSlotKey);
      } catch (err) {
        console.error("Failed to send negative price alert email:", err);
      }
    } else {
      console.log(
        `Price ${currentPrice} SEK/kWh is below threshold but alert already sent for this slot (${currentSlotKey}).`
      );
    }
  }

  const desired = determineDesiredState(slots);

  const last = getLastState();
  console.log("Last state (read from file):", last);
  console.log("Desired state:", desired);

  if (desired === last) {
    console.log("No change needed.");
    return;
  }

  // Apply the new limit
  const limitMap = { LIMIT_5: 5, LIMIT_100: 100 };
  await callGrowattLimit(limitMap[desired]);

  try {
    saveStateAtomic(desired);
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

  const limitLabel = { LIMIT_5: "5%", LIMIT_100: "100%" };
  const slotSummary = slots
    .map((s, i) => `  Slot ${i + 1}: ${toStockholmTime(s.time_start)} → ${s.SEK_per_kWh} SEK/kWh`)
    .join("\n");
  const reason =
    desired === "LIMIT_100"
      ? `Not all 4 upcoming 15-min slots are ≤ -0.20 SEK/kWh.`
      : `All 4 upcoming 15-min slots are ≤ -0.20 SEK/kWh (price will stay deeply negative for at least 1 hour).`;

  try {
    await sendEmail(
      `Growatt export limit changed → ${limitLabel[desired]}`,
      `Current price: ${currentPrice} SEK/kWh\n\nNext 4 slots (1 hour):\n${slotSummary}\n\n${reason}\n\nNew export limit: ${limitLabel[desired]}`
    );
  } catch {}
}

main().catch((err) => console.error("Fatal:", err));
