import Growatt from "growatt";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import path from "path";

// ─────────────────────────────────────────────────────────────
// PATH HELPERS (ESM-safe __dirname)
// ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES
// ─────────────────────────────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const GROWATT_USER = process.env.GROWATT_USERNAME;
const GROWATT_PASSWORD = process.env.GROWATT_PASSWORD;
const GROWATT_DEVICE_ID = process.env.DEVICE_SN;

const LATITUDE = process.env.LATITUDE;
const LONGITUDE = process.env.LONGITUDE;

const POWER_THRESHOLD_PERCENT = Number(process.env.POWER_THRESHOLD_PERCENT || 70);
const SUNNY_THRESHOLD = Number(process.env.SUNNY_THRESHOLD || 20);

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
  try {
    await transporter.sendMail({ from: GMAIL_USER, to: EMAIL_RECIPIENT, subject, text });
    console.log(`✓ Email sent: ${subject}`);
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// GROWATT API (using growatt npm package)
// ─────────────────────────────────────────────────────────────
async function getGrowattData() {
  if (!GROWATT_USER || !GROWATT_PASSWORD || !GROWATT_DEVICE_ID) {
    console.error("Missing Growatt credentials: GROWATT_USERNAME, GROWATT_PASSWORD, DEVICE_SN");
    return null;
  }

  const growatt = new Growatt({});

  try {
    await growatt.login(GROWATT_USER, GROWATT_PASSWORD);
    console.log("✓ Growatt login successful");

    const plantData = await growatt.getAllPlantData({
      plantData: false,
      deviceData: true,
      deviceTyp: true,
      weather: false,
    });

    await growatt.logout();

    // Search all plants for our device SN
    for (const plant of Object.values(plantData)) {
      for (const [sn, device] of Object.entries(plant.devices || {})) {
        if (sn === GROWATT_DEVICE_ID || device.deviceSn === GROWATT_DEVICE_ID) {
          return {
            currentPower: device.pac ?? device.ppv ?? 0,
            dailyEnergy: device.eToday ?? device.etoday ?? 0,
            totalEnergy: device.eTotal ?? device.etotal ?? 0,
            status: device.status ?? "unknown",
            statusText: getGrowattStatusText(device.status),
          };
        }
      }
    }

    // Device SN not matched — fall back to first device found
    console.warn(`⚠️  Device SN "${GROWATT_DEVICE_ID}" not found — using first available device`);
    for (const plant of Object.values(plantData)) {
      const firstDevice = Object.values(plant.devices || {})[0];
      if (firstDevice) {
        return {
          currentPower: firstDevice.pac ?? firstDevice.ppv ?? 0,
          dailyEnergy: firstDevice.eToday ?? firstDevice.etoday ?? 0,
          totalEnergy: firstDevice.eTotal ?? firstDevice.etotal ?? 0,
          status: firstDevice.status ?? "unknown",
          statusText: getGrowattStatusText(firstDevice.status),
        };
      }
    }

    console.error("No devices found in Growatt account");
    return null;
  } catch (err) {
    console.error("Error fetching Growatt data:", err.message);
    await growatt.logout().catch(() => {});
    return null;
  }
}

function getGrowattStatusText(statusCode) {
  const statusMap = { 0: "Waiting", 1: "Normal", 2: "Fault", 3: "Offline" };
  return statusMap[statusCode] || `Unknown (${statusCode})`;
}

// ─────────────────────────────────────────────────────────────
// WEATHER FUNCTIONS
// ─────────────────────────────────────────────────────────────
async function getWeatherData() {
  if (!LATITUDE || !LONGITUDE) {
    console.error("Missing location: LATITUDE and LONGITUDE");
    return null;
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,cloud_cover,weather_code,is_day&timezone=auto`
    );
    if (!res.ok) throw new Error(`Weather API failed: ${res.status}`);
    const data = await res.json();
    return {
      temperature: data.current.temperature_2m,
      cloudCover: data.current.cloud_cover,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day,
      isSunny: data.current.cloud_cover < SUNNY_THRESHOLD,
    };
  } catch (err) {
    console.error("Error fetching weather data:", err.message);
    return null;
  }
}

function getWeatherDescription(weatherCode) {
  const weatherMap = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Foggy (depositing rime)",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
  };
  return weatherMap[weatherCode] || `Unknown (${weatherCode})`;
}

// ─────────────────────────────────────────────────────────────
// POWER ANALYSIS
// ─────────────────────────────────────────────────────────────
function calculateExpectedPower(weather) {
  const hour = new Date().getHours();
  const month = new Date().getMonth() + 1;

  let basePower = 0;
  if (hour >= 6 && hour < 9)        basePower = 1000;
  else if (hour >= 9 && hour < 12)  basePower = 3000;
  else if (hour >= 12 && hour < 15) basePower = 4000;
  else if (hour >= 15 && hour < 18) basePower = 2000;
  else if (hour >= 18 && hour < 21) basePower = 500;

  const seasonalFactor = month >= 6 && month <= 8 ? 1.2 : 0.8;
  const cloudFactor = Math.max(0, 1 - weather.cloudCover / 100);

  return Math.round(basePower * seasonalFactor * cloudFactor);
}

// ─────────────────────────────────────────────────────────────
// MAIN MONITORING FUNCTION
// ─────────────────────────────────────────────────────────────
async function checkSolarPower() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🌞 Solar Panel Power Check");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  const [growattData, weatherData] = await Promise.all([
    getGrowattData(),
    getWeatherData(),
  ]);

  if (!growattData) {
    console.error("❌ Failed to get Growatt data");
    return;
  }
  if (!weatherData) {
    console.error("⚠️  Failed to get weather data - proceeding with caution");
  }

  console.log("📊 Current Status:");
  console.log(`   Power Output: ${growattData.currentPower}W`);
  console.log(`   Daily Energy: ${growattData.dailyEnergy}kWh`);
  console.log(`   Inverter Status: ${growattData.statusText}`);

  if (weatherData) {
    console.log(`\n🌤️  Weather Conditions:`);
    console.log(`   Temperature: ${weatherData.temperature}°C`);
    console.log(`   Cloud Cover: ${weatherData.cloudCover}%`);
    console.log(`   Condition: ${getWeatherDescription(weatherData.weatherCode)}`);
    console.log(`   Is Sunny: ${weatherData.isSunny ? "YES ☀️" : "NO ☁️"}`);
  }

  const hour = new Date().getHours();
  const isDaytime = hour >= 6 && hour <= 20;

  if (!isDaytime) {
    console.log("\n🌙 It's nighttime - skipping power check");
    return;
  }

  if (weatherData && weatherData.isSunny) {
    const expectedPower = calculateExpectedPower(weatherData);
    const powerRatio = (growattData.currentPower / expectedPower) * 100;

    console.log(`\n⚡ Power Analysis:`);
    console.log(`   Expected Power: ~${expectedPower}W`);
    console.log(`   Current Power: ${growattData.currentPower}W`);
    console.log(`   Efficiency: ${powerRatio.toFixed(1)}%`);

    if (powerRatio < POWER_THRESHOLD_PERCENT) {
      console.log(`\n⚠️  ALERT: Power output is only ${powerRatio.toFixed(1)}% of expected!`);
      await sendEmail(
        "🚨 Growatt Solar Panel Alert - Low Power Output",
        `
🚨 GROWATT SOLAR PANEL ALERT 🚨

Your solar panels are not producing enough power on a sunny day.

📊 Details:
   Timestamp: ${new Date().toISOString()}
   Current Power: ${growattData.currentPower}W
   Expected Power: ~${expectedPower}W
   Efficiency: ${powerRatio.toFixed(1)}%
   Threshold: ${POWER_THRESHOLD_PERCENT}%

🌤️  Weather:
   Cloud Cover: ${weatherData.cloudCover}%
   Temperature: ${weatherData.temperature}°C
   Condition: ${getWeatherDescription(weatherData.weatherCode)}

⚡ Inverter Status: ${growattData.statusText}

✅ Possible Issues:
   • Panel shading or obstruction
   • Panel surface dirt/dust
   • Cable/connection issues
   • Inverter malfunction
   • Panel degradation

Recommendation: Check your installation and panels for any issues.
`
      );
    } else {
      console.log(`\n✅ Power output is healthy (${powerRatio.toFixed(1)}% of expected)`);
    }
  } else if (weatherData) {
    console.log("\n☁️  Cloud cover is too high - power check skipped (not sunny)");
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────────────
checkSolarPower().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
