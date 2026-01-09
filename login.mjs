// login.mjs
import fetch from "node-fetch";

const USERNAME = process.env.GROWATT_USER;
const PASSWORD = process.env.GROWATT_PASS;

if (!USERNAME || !PASSWORD) {
  console.error("Missing GROWATT_USER or GROWATT_PASS env vars");
  process.exit(1);
}

async function login() {
  const url = "https://server.growatt.com/newLoginAPI.do";

  const body = new URLSearchParams({
    userName: USERNAME,
    password: PASSWORD,
    validateCode: "",
    isRememberMe: "0",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await res.json();
  console.log("Login response:", data);

  if (!data.success) {
    console.error("Login failed");
    process.exit(1);
  }

  // Hämta cookies
  const cookies = res.headers.raw()["set-cookie"];
  console.log("Cookies:", cookies);

  return cookies;
}

login();
