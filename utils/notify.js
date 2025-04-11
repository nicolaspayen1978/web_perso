// utils/notify.js
//we use pushover service to send live Notification to Nicolas 
const fetch = require("node-fetch");
require("dotenv").config();

async function notifyNicoAI(message = "🚀 Someone just messaged NicoAI!") {
  const response = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    body: new URLSearchParams({
      token: process.env.PUSHOVER_APP_TOKEN,
      user: process.env.PUSHOVER_USER_KEY,
      message,
    }),
  });

  const data = await response.json();
  if (data.status !== 1) {
    console.error("❌ Failed to send notification:", data);
  } else {
    console.log("✅ Notification sent successfully.");
  }
}

module.exports = notifyNicoAI;