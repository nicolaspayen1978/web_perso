// utils/notify.js
//we use pushover service to send live Notification to Nicolas 
require("dotenv").config();

async function notifyNicolas(message = "🚀 Someone just messaged NicoAI!") {
  const fetch = (await import('node-fetch')).default;

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    body: new URLSearchParams({
      token: process.env.PUSHOVER_APP_TOKEN,
      user: process.env.PUSHOVER_USER_KEY,
      message,
    }),
  });

  const data = await res.json();
  if (data.status !== 1) {
    console.error("❌ Pushover notification failed:", data);
  } else {
    console.log("✅ Pushover notification sent.");
  }
}

module.exports = notifyNicolas;