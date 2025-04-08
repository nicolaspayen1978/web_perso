//functions usefull to manage the KV database
import { kv } from '@vercel/kv';

/**
 * Save a chat message to Vercel KV under a unique key.
 * @param {string} visitorID - Unique ID representing the user.
 * @param {object} messageObj - Chat message with sender, message, and timestamp.
 */
export async function saveMessageInKV(visitorID, messageObj) {
  if (!visitorID || !messageObj || typeof messageObj.timestamp !== 'number') {
    console.warn("⚠️ Invalid input: visitorID or timestamp missing");
    return;
  }

  const key = `chat:${visitorID}:${messageObj.timestamp}`;
  try {
    await kv.set(key, messageObj); // Store raw object (no JSON.stringify)
    console.log(`✅ Message saved to KV: ${key}`);
  } catch (err) {
    console.error(`❌ Failed to save message to KV: ${key}`, err);
  }
}

/**
 * Safe wrapper around kv.get() that parses stringified values if needed.
 * @param {string} key - KV key to fetch.
 * @returns {object|null} Parsed message object, or null if malformed.
 */
export async function safeGetKV(key) {
  try {
    const value = await kv.get(key);

    if (!value) return null;

    // Handle both raw objects and double-stringified JSON
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