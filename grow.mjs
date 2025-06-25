import fetch, { Headers } from "node-fetch";
import nodemailer from "nodemailer";

// Use the same secret names as send-email.js for consistency:
const user = process.env.GMAIL_USER;              // GMAIL_USER
const pass = process.env.GMAIL_APP_PASSWORD;      // GMAIL_APP_PASSWORD
const recipient = process.env.EMAIL_RECIPIENT;    // EMAIL_RECIPIENT

const API_URL = process.env.API_URL; // Optionally set this as a secret too!

async function sendEmail(priceValue) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  });

  const mailOptions = {
    from: user,
    to: recipient,
    subject: "Negative Electricity Price Alert",
    text: `Alert: The electricity price is negative (${priceValue} SEK/kWh). Powering off the device.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully.");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

async function sendTrigger(value) {
  // Placeholder: implement your own trigger logic here
  console.log(`Trigger sent with value: ${value}`);
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

    if (priceValue < -0.10) {
      console.log("Negative price detected. Powering off the device.");
      await sendTrigger("0");
      await sendEmail(priceValue);
    } else {
      console.log("The value is not significantly negative, so let's chill");
      await sendTrigger("1");
    }
  } catch (error) {
    console.error("Error fetching price data:", error);
  }
}

getCurrentHourPrice();
