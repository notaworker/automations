import fetch from "node-fetch";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ─────────────────────────────────────────────────────────────
// PATH HELPERS (ESM-safe __dirname)
// ─────────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES (using your existing secrets)
// ─────────────────────────────────────────────────────────────
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

// Growatt API credentials
const GROWATT_USER = process.env.GROWATT_USERNAME;
const GROWATT_PASSWORD = process.env.GROWATT_PASSWORD;
const GROWATT_DEVICE_ID = process.env.GROWATT_DEVICE_ID;

// Weather API (Open-Meteo is free and doesn't require auth)
const LATITUDE = process.env.LATITUDE;
const LONGITUDE = process.env.LONGITUDE;

// Power threshold: alert if current power is below X% of expected on sunny day
const POWER_THRESHOLD_PERCENT = Number(
  process.env.POWER_THRESHOLD_PERCENT || 70
);

// Cloud cover threshold: consider it sunny if cloud cover is below X%
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
    await transporter.sendMail({
      from: GMAIL_USER,
      to: EMAIL_RECIPIENT,
      subject,
      text,
    });
    console.log(`✓ Email sent: ${subject}`);
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// GROWATT API FUNCTIONS
// ─────────────────────────────────────────────────────────────

async function getGrowattData() {
  if (!GROWATT_USER || !GROWATT_PASSWORD || !GROWATT_DEVICE_ID) {
    console.error(
      "Missing Growatt credentials: GROWATT_USERNAME, GROWATT_PASSWORD, GROWATT_DEVICE_ID"
    );
    console.error(
      `Current values - User: ${GROWATT_USER}, Device ID: ${GROWATT_DEVICE_ID}`
    );
    return null;
  }

  try {
    // Growatt API login
    const loginRes = await fetch("https://api.growatt.com/newApiUser/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: GROWATT_USER,
        password: GROWATT_PASSWORD,
      }),
    });

    if (!loginRes.ok) {
      throw new Error(`Growatt login failed: ${loginRes.status}`);
    }

    const loginData = await loginRes.json();

    if (!loginData.data || !loginData.data.token) {
      throw new Error("Failed to get Growatt token");
    }

    const token = loginData.data.token;

    // Query device data
    const deviceRes = await fetch(
      "https://api.growatt.com/newApiDevice/queryDeviceData",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          deviceId: GROWATT_DEVICE_ID,
        }),
      }
    );

    if (!deviceRes.ok) {
      throw new Error(`Failed to query device: ${deviceRes.status}`);
    }

    const deviceData = await deviceRes.json();

    if (deviceData.data) {
      return {
        currentPower: deviceData.data.pac || 0, // Current AC power in Watts
        dailyEnergy: deviceData.data.etoday || 0, // Daily energy in kWh
        totalEnergy: deviceData.data.etotal || 0, // Lifetime energy
        status: deviceData.data.status || "unknown",
        statusText: getGrowattStatusText(deviceData.data.status),
      };
    }

    return null;
  } catch (err) {
    console.error("Error fetching Growatt data:", err.message);
    return null;
  }
}

function getGrowattStatusText(statusCode) {
  const statusMap = {
    0: "Waiting",
    1: "Normal",
    2: "Fault",
    3: "Offline",
  };
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
    // Using Open-Meteo API (free, no auth required)
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}&current=temperature_2m,cloud_cover,weather_code,is_day&hourly=cloud_cover&timezone=auto`
    );

    if (!weatherRes.ok) {
      throw new Error(`Weather API failed: ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();

    return {
      temperature: weatherData.current.temperature_2m,
      cloudCover: weatherData.current.cloud_cover,
      weatherCode: weatherData.current.weather_code,
      isDay: weatherData.current.is_day,
      isSunny: weatherData.current.cloud_cover < SUNNY_THRESHOLD,
    };
  } catch (err) {
    console.error("Error fetching weather data:", err.message);
    return null;
  }
}

function getWeatherDescription(weatherCode) {
  // WMO Weather interpretation codes
  const weatherMap = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy (depositing rime)",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return weatherMap[weatherCode] || `Unknown (${weatherCode})`;
}

// ─────────────────────────────────────────────────────────────
// POWER ANALYSIS
// ─────────────────────────────────────────────────────────────

function calculateExpectedPower(weather) {
  // Estimate expected power based on time of day and cloud cover
  // This is a simplified model - you may want to refine it

  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth() + 1;

  // Base power curve (rough estimate for different hours)
  // Peak is typically at solar noon (12:00)
  let basePower = 0;

  if (hour >= 6 && hour < 9) {
    basePower = 1000; // Morning ramp up
  } else if (hour >= 9 && hour < 12) {
    basePower = 3000; // Climbing to peak
  } else if (hour >= 12 && hour < 15) {
    basePower = 4000; // Peak hours
  } else if (hour >= 15 && hour < 18) {
    basePower = 2000; // Afternoon decline
  } else if (hour >= 18 && hour < 21) {
    basePower = 500; // Evening ramp down
  } else {
    basePower = 0; // Night
  }

  // Adjust for seasonal variation (very rough)
  const seasonalFactor = month >= 6 && month <= 8 ? 1.2 : 0.8;

  // Adjust for cloud cover
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

  // Get current data
  const [growattData, weatherData] = await Promise.all([
    getGrowattData(),
    getWeatherData(),
  ]);

  if (!growattData) {
    console.error("❌ Failed to get Growatt data");
    return;
  }

  if (!weatherData) {
    console.error("⚠️ Failed to get weather data - proceeding with caution");
  }

  // Log current status
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

  // Only check power output during daylight hours
  const now = new Date();
  const hour = now.getHours();
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
      console.log(
        `\n⚠️  ALERT: Power output is only ${powerRatio.toFixed(1)}% of expected!`
      );

      const alertMessage = `
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
`;

      await sendEmail(
        "🚨 Growatt Solar Panel Alert - Low Power Output",
        alertMessage
      );
    } else {
      console.log(
        `\n✅ Power output is healthy (${powerRatio.toFixed(1)}% of expected)`
      );
    }
  } else if (weatherData) {
    console.log(
      "\n☁️  Cloud cover is too high - power check skipped (not sunny)"
    );
  }

  console.log("\n═══════════════════════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────
// RUN SCRIPT
// ─────────────────────────────────────────────────────────────
checkSolarPower().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
