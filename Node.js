const fetch = require("node-fetch");
const { Headers } = fetch;

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, "0");
const day = String(today.getDate()).padStart(2, "0");
const API_URL = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_SE3.json`;

console.log("Fetching data from:", API_URL);

async function sendTrigger(value) {
  const myHeaders = new Headers();
  const token = process.env.GROWATT_API_TOKEN;

  myHeaders.append("token", token);
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("deviceSn", "QDL3CMN0DK");
  urlencoded.append("deviceType", "inv");
  urlencoded.append("value", value);

  const requestOptions = {
    method: "POST",
   Headers,
    body: urlencoded,
    redirect: "follow",
  };

  try {
    const response = await fetch("https://openapi.growatt.com/v4/new-api/setOnOrOff", requestOptions);
    const result = await response.text();
    console.log(`Trigger Response (value=${value}):`, result);
  } catch (error) {
    console.error("Error sending trigger:", error);
  }
}

async function getCurrentHourPrice() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

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
      await sendTrigger("0");
    } else {
      console.log("The value is positive so let's chill");
      await sendTrigger("1");
    }
  } catch (error) {
    console.error("Error fetching price data:", error);
  }
}

getCurrentHourPrice();
