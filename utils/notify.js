// utils/notify.js
// 📢 Sends live Pushover notifications to Nicolas when a visitor interacts with NicoAI

/**
 * Sends a push notification via Pushover to Nicolas.
 *
 * @param {string} message - The message to be sent. Defaults to a generic alert.
 */
async function notifyNicolas(message = "🚀 Someone just messaged NicoAI!") {
  const fetch = (await import('node-fetch')).default;

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    body: new URLSearchParams({
      token: process.env.PUSHOVER_APP_TOKEN, // App token from Pushover
      user: process.env.PUSHOVER_USER_KEY,   // Nicolas's Pushover user key
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