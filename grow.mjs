import fetch, { Headers } from "node-fetch";
import nodemailer from "nodemailer";

// Build today's date in format YYYY/MM-DD
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, "0");
const day = String(today.getDate()).padStart(2, "0");
const API_URL = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`;

console.log("Fetching data from:", API_URL);

// Email setup (Gmail SMTP)
// Be sure to set GMAIL_USER, GMAIL_APP_PASSWORD, and EMAIL_RECIPIENT in your environment
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

async function sendEmail(subject, text) {
  if (!GMAIL_USER || !GMAIL_PASS || !EMAIL_RECIPIENT) {
    console.error("Missing GMAIL_USER, GMAIL_APP_PASSWORD, or EMAIL_RECIPIENT environment variables.");
    return;
  }

  const mailOptions = {
    from: GMAIL_USER,
    to: EMAIL_RECIPIENT,
    subject,
    text,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function sendTrigger(value) {
  const token = process.env.GROWATT_API_TOKEN;
  const deviceSn = process.env.GROWATT_DEVICE_SN;

  if (!token || !deviceSn) {
    console.error("Missing required environment variables.");
    return;
  }

  const myHeaders = new Headers();
  myHeaders.append("token", token);
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("deviceSn", deviceSn);
  urlencoded.append("deviceType", "inv");
  urlencoded.append("value", value); // "0" or "1"

  const requestOptions = {
    method: "POST",
    headers: myHeaders,
    body: urlencoded,
    redirect: "follow",
  };

   // Extra debug info
  console.log("=== Growatt API Debug Info ===");
  console.log("Endpoint: https://openapi.growatt.com/v4/new-api/setOnOrOff");
  console.log("Request Headers:", Object.fromEntries(myHeaders.entries()));
  console.log("Request Body:", urlencoded.toString());
  console.log("Request Method:", requestOptions.method);

  try {
    const response = await fetch("https://openapi.growatt.com/v4/new-api/setOnOrOff", requestOptions);
    const resultText = await response.text();
    let result;
    try {
      result = JSON.parse(resultText);
    } catch (parseErr) {
      result = resultText;
    }
    console.log("HTTP Status:", response.status, response.statusText);
    console.log("Trigger Response (value=" + value + "):", result);
    if (response.status !== 200) {
      console.error("Non-200 status from Growatt API:", response.status);
    }
  } catch (error) {
    console.error("Error sending trigger:", error);
  }
}

async function getCurrentHourPrice() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    const currentHour = new Date().getHours();
    const priceInfo = data.find(item => new Date(item.time_start).getHours() === currentHour);

    if (!priceInfo) {
      console.log("No price data available for this hour.");
      return;
    }

    const priceValue = priceInfo.SEK_per_kWh;
    console.log("Current price:", priceValue);

    if (priceValue < 0) {
      // Negative price
      console.log("The price is negative!");
      await sendEmail(
        "Alert: The electricity price is negative. Powering off the device.",
        `The electricity price is negative (${priceValue} SEK/kWh).`
      );
      await sendTrigger("0");
    } else {
      // Positive price
      console.log("The price is positive or zero.");
      await sendEmail(
        "The electricity price is Positive. Lets Powering on the Solar Inverter",
        `The electricity price is positive (${priceValue} SEK/kWh).`
      );
      await sendTrigger("1");
    }
  } catch (error) {
    console.error("Error fetching price data:", error);
  }
}

getCurrentHourPrice();
