// /api/conversation.js
// Returns all chat messages for a given visitorID using REST API (no @vercel/kv)
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

/**
 * 🔎 SCAN all keys matching chat:{visitorID}:*
 */
async function scanKeysForVisitor(visitorID, batchSize = 100, maxRounds = 30) {
  const keys = [];
  let cursor = '0';
  let rounds = 0;
  const pattern = `chat:${visitorID}:*`;

  try {
    do {
      const url = `${KV_REST_API_URL}/scan/${cursor}?match=${encodeURIComponent(pattern)}&count=${batchSize}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`❌ KV SCAN failed:`, text);
        break;
      }

      const json = await res.json();
      console.log("🔍 Raw scan result:", JSON.stringify(json));

      // 🔍 Handle both Upstash v1 and Redis style responses
      let newCursor = '0';
      let batch = [];

      if (Array.isArray(json.result) && json.result.length === 2) {
        // Redis style
        newCursor = json.result[0];
        batch = json.result[1];
      } else if (typeof json.cursor === 'string' && Array.isArray(json.keys)) {
        // Upstash v1 fallback
        newCursor = json.cursor;
        batch = json.keys;
      } else {
        console.warn("⚠️ Unknown scan result format. Skipping.");
        break;
      }

      cursor = newCursor;
      keys.push(...batch);
      rounds++;
    } while (cursor !== '0' && rounds < maxRounds);
  } catch (err) {
    console.error("❌ scanKeysForVisitor error:", err);
  }

  return keys;
}

/**
 * 🧼 Safely get a single message from KV and parse it
 */
async function safeGetKV(key) {
  try {
    const res = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!res.ok) {
      console.warn(`❌ Failed to fetch key ${key}:`, await res.text());
      return null;
    }

    const json = await res.json();
    let value = json;

    // 🧪 Detect if result is wrapped
    if (value?.result) value = value.result;

    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (e) {
        console.warn(`⚠️ Failed to parse stringified message for ${key}`);
        return null;
      }
    }

    if (value && value.sender && value.message && typeof value.timestamp === 'number') {
      return value;
    } else {
      console.warn(`⚠️ Skipping invalid message format for key: ${key}`, value);
      return null;
    }
  } catch (err) {
    console.error(`❌ Error retrieving/parsing key ${key}:`, err.message);
    return null;
  }
}

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!visitorID || typeof visitorID !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid visitorID' });
  }

  try {
    const keys = await scanKeysForVisitor(visitorID);
    console.log(`🔑 Found ${keys.length} keys for ${visitorID}`);

    const messages = [];

    for (const key of keys) {
      const msg = await safeGetKV(key);
      if (msg) messages.push(msg);
    }

    messages.sort((a, b) => a.timestamp - b.timestamp);

    res.status(200).json({ visitorID, messages });
  } catch (err) {
    console.error(`❌ Error while loading messages:`, err.message);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}