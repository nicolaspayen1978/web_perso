// utils/kvUtils.js
// 📦 Utility functions to manage the Vercel KV database (chat history, safe retrieval)

import { kv } from '@vercel/kv';

/**
 * 📝 Save a chat message to Vercel KV under a unique key.
 * The key is structured as `chat:<visitorID>:<timestamp>`.
 * 
 * @param {string} visitorID - Unique ID representing the user session.
 * @param {object} messageObj - Chat message containing:
 *   - sender {string}
 *   - message {string}
 *   - timestamp {number} (Unix epoch in ms)
 */
export async function saveMessageInKV(visitorID, messageObj) {
  if (!visitorID || !messageObj || typeof messageObj.timestamp !== 'number') {
    console.warn("⚠️ Invalid input: visitorID or timestamp missing");
    return;
  }

  const key = `chat:${visitorID}:${messageObj.timestamp}`;
  try {
    await kv.set(key, messageObj); // Store as raw object (no stringify needed)
    console.log(`✅ Message saved to KV: ${key}`);
  } catch (err) {
    console.error(`❌ Failed to save message to KV: ${key}`, err);
  }
}

/**
 * 🔍 Safely retrieves a KV entry by key and ensures it's a valid message.
 * Handles both raw object and stringified JSON formats.
 *
 * @param {string} key - KV key to retrieve (e.g. `chat:abc123:1713472280000`)
 * @returns {object|null} Parsed message object or null if malformed or missing
 */
export async function safeGetKV(key) {
  try {
    const value = await kv.get(key);
    if (!value) return null;

    const parsed = typeof value === 'string' ? JSON.parse(value) : value;

    if (parsed?.sender && parsed?.message && parsed?.timestamp) {
      return parsed;
    } else {
      console.warn(`⚠️ Invalid message format in key: ${key}`);
      return null;
    }

  } catch (err) {
    console.error(`❌ Error reading/parsing key ${key}:`, err);
    return null;
  }
}