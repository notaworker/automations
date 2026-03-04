import Growatt from "growatt";
import nodemailer from "nodemailer";
import { fileURLToPath } from "url";
import path from "path";

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

// Threshold: 50% Oct–Apr (winter), 70% May–Sep (summer)
const _BASE_THRESHOLD = Number(process.env.POWER_THRESHOLD_PERCENT || 70);
const _month = new Date().getMonth() + 1;
const POWER_THRESHOLD_PERCENT = (_month >= 10 || _month <= 4) ? 40 : _BASE_THRESHOLD;
const SUNNY_THRESHOLD = Number(process.env.SUNNY_THRESHOLD || 20);

// ─────────────────────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────────────────────
const transporter =
  GMAIL_USER && GMAIL_PASS && EMAIL_RECIPIENT
    ? nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_PASS } })
    : null;

async function sendEmail(subject, text) {
  if (!transporter) { console.warn("Email disabled: missing Gmail credentials."); return; }
  try {
    await transporter.sendMail({ from: GMAIL_USER, to: EMAIL_RECIPIENT, subject, text });
    console.log(`✓ Email sent: ${subject}`);
  } catch (err) { console.error("Failed to send email:", err); }
}

// ─────────────────────────────────────────────────────────────
// SOLAR ELEVATION (Sigtuna 59.62°N)
// ─────────────────────────────────────────────────────────────
function getSolarElevation() {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const declination = 23.45 * Math.sin((Math.PI / 180) * (360 / 365 * (dayOfYear - 81)));
  const hourAngleDeg = 15 * (hour - 12);
  const latR = 59.62 * Math.PI / 180;
  const decR = declination * Math.PI / 180;
  const haR = hourAngleDeg * Math.PI / 180;
  const sinElev = Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  return Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;
}

// ─────────────────────────────────────────────────────────────
// GROWATT API
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
    const plantData = await growatt.getAllPlantData({ plantData: false, deviceData: true, deviceTyp: true, weather: false });
    await growatt.logout();

    for (const plant of Object.values(plantData)) {
      for (const [sn, device] of Object.entries(plant.devices || {})) {
        if (sn === GROWATT_DEVICE_ID || device.deviceSn === GROWATT_DEVICE_ID) {
          const d = device.deviceData || {};
          const s = device.statusData || {};
          return {
            currentPower: parseFloat(d.pac ?? s.ppv ?? 0),
            dailyEnergy: parseFloat(d.eToday ?? 0),
            totalEnergy: parseFloat(d.eTotal ?? 0),
            status: d.status ?? "unknown",
            statusText: getGrowattStatusText(d.status),
          };
        }
      }
    }

    console.warn(`⚠️  Device SN "${GROWATT_DEVICE_ID}" not found — using first available device`);
    for (const plant of Object.values(plantData)) {
      const firstDevice = Object.values(plant.devices || {})[0];
      if (firstDevice) {
        const d = firstDevice.deviceData || {};
        const s = firstDevice.statusData || {};
        return {
          currentPower: parseFloat(d.pac ?? s.ppv ?? 0),
          dailyEnergy: parseFloat(d.eToday ?? 0),
          totalEnergy: parseFloat(d.eTotal ?? 0),
          status: d.status ?? "unknown",
          statusText: getGrowattStatusText(d.status),
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
// WEATHER
// ─────────────────────────────────────────────────────────────
async function getWeatherData() {
  if (!LATITUDE || !LONGITUDE) { console.error("Missing location: LATITUDE and LONGITUDE"); return null; }
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
  } catch (err) { console.error("Error fetching weather data:", err.message); return null; }
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
// Physics-based model for Sigtuna, Sweden (59.62°N)
// SE array: 24 x 400W (azimuth 134°), NW array: 12 x 400W (azimuth 335°)
// ─────────────────────────────────────────────────────────────
function calculateExpectedPower(weather) {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

  const LAT = 59.62;
  const SE_AZ = 134, NW_AZ = 335;
  const SE_CAP = 9600, NW_CAP = 4800;
  const INVERTER_CAP = 10000;
  const EFFICIENCY = 0.80;
  const PANEL_TILT = 30;

  const declination = 23.45 * Math.sin((Math.PI / 180) * (360 / 365 * (dayOfYear - 81)));
  const hourAngleDeg = 15 * (hour - 12);
  const latR = LAT * Math.PI / 180;
  const decR = declination * Math.PI / 180;
  const haR = hourAngleDeg * Math.PI / 180;
  const sinElev = Math.sin(latR) * Math.sin(decR) + Math.cos(latR) * Math.cos(decR) * Math.cos(haR);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180 / Math.PI;

  if (elevation <= 0) return 0;

  const cosAz = (Math.sin(decR) - Math.sin(latR) * sinElev) / (Math.cos(latR) * Math.cos(elevation * Math.PI / 180));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * 180 / Math.PI;
  if (hourAngleDeg > 0) azimuth = 360 - azimuth;

  const airMass = 1 / Math.sin(Math.max(5, elevation) * Math.PI / 180);
  const dni = 1000 * Math.pow(0.7, Math.pow(airMass, 0.678));

  function panelFactor(sunAz, sunEl, panelAz) {
    const sunAzR = sunAz * Math.PI / 180;
    const sunElR = sunEl * Math.PI / 180;
    const panAzR = panelAz * Math.PI / 180;
    const tiltR = PANEL_TILT * Math.PI / 180;
    return Math.max(0,
      Math.cos(sunElR) * Math.cos(tiltR) +
      Math.sin(sunElR) * Math.sin(tiltR) * Math.cos(sunAzR - panAzR)
    );
  }

  const sePower = SE_CAP * panelFactor(azimuth, elevation, SE_AZ) * (dni / 1000) * EFFICIENCY;
  const nwPower = NW_CAP * panelFactor(azimuth, elevation, NW_AZ) * (dni / 1000) * EFFICIENCY;
  const clearSkyPower = Math.min(sePower + nwPower, INVERTER_CAP);
  const cloudFactor = Math.max(0, 1 - (weather.cloudCover / 100) * 0.85);

  return Math.round(clearSkyPower * cloudFactor);
}

// ─────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────
async function checkSolarPower() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("🌞 Solar Panel Power Check");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // Check if sun is actually above the horizon in Sigtuna before doing anything
  const solarElevation = getSolarElevation();
  console.log(`   Solar Elevation: ${solarElevation.toFixed(1)}°`);
  if (solarElevation <= 3) {
    console.log("\n🌙 Sun is not up in Sigtuna - skipping power check");
    return;
  }

  const [growattData, weatherData] = await Promise.all([getGrowattData(), getWeatherData()]);

  if (!growattData) { console.error("❌ Failed to get Growatt data"); return; }
  if (!weatherData) { console.error("⚠️  Failed to get weather data - proceeding with caution"); }

  console.log("📊 Current Status:");
  console.log(`   Power Output:    ${growattData.currentPower}W`);
  console.log(`   Daily Energy:    ${growattData.dailyEnergy}kWh`);
  console.log(`   Inverter Status: ${growattData.statusText}`);
  console.log(`   Alert Threshold: ${POWER_THRESHOLD_PERCENT}% (${(_month >= 10 || _month <= 4) ? "winter" : "summer"} mode)`);

  if (weatherData) {
    console.log(`\n🌤️  Weather Conditions:`);
    console.log(`   Temperature: ${weatherData.temperature}°C`);
    console.log(`   Cloud Cover: ${weatherData.cloudCover}%`);
    console.log(`   Condition:   ${getWeatherDescription(weatherData.weatherCode)}`);
    console.log(`   Is Sunny:    ${weatherData.isSunny ? "YES ☀️" : "NO ☁️"}`);
  }

  if (weatherData && weatherData.isSunny) {
    const expectedPower = calculateExpectedPower(weatherData);
    const powerRatio = (growattData.currentPower / expectedPower) * 100;

    console.log(`\n⚡ Power Analysis:`);
    console.log(`   Expected Power: ~${expectedPower}W`);
    console.log(`   Current Power:  ${growattData.currentPower}W`);
    console.log(`   Efficiency:     ${powerRatio.toFixed(1)}%`);

    if (powerRatio < POWER_THRESHOLD_PERCENT) {
      console.log(`\n⚠️  ALERT: Power output is only ${powerRatio.toFixed(1)}% of expected!`);
      await sendEmail(
        "🚨 Growatt Solar Panel Alert - Low Power Output",
        `
🚨 GROWATT SOLAR PANEL ALERT 🚨

Your solar panels are not producing enough power on a sunny day.

📊 Details:
   Timestamp:      ${new Date().toISOString()}
   Current Power:  ${growattData.currentPower}W
   Expected Power: ~${expectedPower}W
   Efficiency:     ${powerRatio.toFixed(1)}%
   Threshold:      ${POWER_THRESHOLD_PERCENT}%

🌤️  Weather:
   Cloud Cover:    ${weatherData.cloudCover}%
   Temperature:    ${weatherData.temperature}°C
   Condition:      ${getWeatherDescription(weatherData.weatherCode)}

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

checkSolarPower().catch((err) => { console.error("Fatal error:", err); process.exit(1); });
