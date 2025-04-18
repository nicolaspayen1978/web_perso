// utils/kvUtils.js
// 📦 Utility functions to manage the Vercel KV database (chat history, safe retrieval)

// 🌍 Determine environment
const isDevEnv = process.env.VERCEL_ENV !== 'production';

// 🔐 Load correct KV credentials based on environment
const KV_REST_API_URL = isDevEnv
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevEnv
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

/**
 * 📝 Save a chat message to KV using REST API
 * @param {string} visitorID
 * @param {object} messageObj { sender, message, timestamp }
 */
export async function saveMessageInKV(visitorID, messageObj) {

  console.log("🔍 Enter saveMessageInKV:", KV_REST_API_URL);

  if (!visitorID || !messageObj || typeof messageObj.timestamp !== 'number') {
    console.warn("⚠️ Invalid input: visitorID or timestamp missing");
    return;
  }

  const key = `chat:${visitorID}:${messageObj.timestamp}`;
  console.log("🔍 Saving to KV URL:", KV_REST_API_URL);

  try {
    const response = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageObj)
    });

    const result = await response.json();
    if (!response.ok) {
      console.error(`❌ Failed to save message: ${result.error || result}`);
    } else {
      console.log(`✅ Message saved to KV: ${key}`);
    }
  } catch (err) {
    console.error(`❌ Network error saving message to KV: ${key}`, err);
  }
}

/**
 * 🔍 Retrieve and parse a message from KV
 * @param {string} key
 * @returns {object|null}
 */
export async function safeGetKV(key) {
  try {
    const response = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`
      }
    });

    if (!response.ok) {
      console.error(`❌ KV GET failed: ${response.status}`);
      return null;
    }

    const result = await response.json();
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    if (parsed?.sender && parsed?.message && parsed?.timestamp) {
      return parsed;
    } else {
      console.warn(`⚠️ Invalid message format in key: ${key}`);
      return null;
    }
  } catch (err) {
    console.error(`❌ Error fetching/parsing KV key ${key}:`, err);
    return null;
  }
}