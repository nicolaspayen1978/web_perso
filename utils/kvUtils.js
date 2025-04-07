import { kv } from '@vercel/kv';

/**
 * Reads and safely parses a message from KV.
 * Handles both raw object and stringified formats.
 */
export async function getParsedKV(key) {
  try {
    const raw = await kv.get(key);
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;

    if (
      typeof value === 'object' &&
      typeof value.sender === 'string' &&
      typeof value.message === 'string' &&
      typeof value.timestamp === 'number'
    ) {
      return value;
    }

    console.warn(`⚠️ Skipping malformed KV data for key: ${key}`);
    return null;

  } catch (err) {
    console.error(`❌ Error in getParsedKV(${key}):`, err);
    return null;
  }
}

/**
 * Safely saves a message in KV, correcting format if needed.
 * Accepts either { sender, message, timestamp } or a full object.
 */
export async function saveMessageInKV(visitorID, rawData) {
  if (!visitorID || typeof visitorID !== 'string') {
    console.error("❌ Invalid visitorID:", visitorID);
    return;
  }

  // Normalize message structure
  const { sender, message, timestamp } = rawData;

  if (
    typeof sender !== 'string' ||
    typeof message !== 'string' ||
    typeof timestamp !== 'number'
  ) {
    console.error("❌ Invalid message format:", rawData);
    return;
  }

  const key = `chat:${visitorID}:${timestamp}`;
  const value = { sender, message, timestamp };

  try {
    await kv.set(key, value);
    console.log(`✅ Message saved in KV: ${key}`);
  } catch (err) {
    console.error(`❌ Failed to save message to KV for ${key}:`, err);
  }
}