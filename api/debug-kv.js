// /api/debug-chatkv.js
// Lists all KV entries starting with "chat:*" using Upstash REST API
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// 🔍 SCAN all keys starting with chat:
async function scanChatKeys(prefix = 'chat:', batchSize = 100, maxRounds = 30) {
  const keys = [];
  let cursor = 0;
  let rounds = 0;

  try {
    do {
      const url = `${KV_REST_API_URL}/scan/${cursor}?match=${encodeURIComponent(prefix + '*')}&count=${batchSize}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });

      if (!res.ok) break;

      const [next, batch] = await res.json();
      cursor = next;
      keys.push(...batch);
      rounds++;
    } while (cursor !== 0 && rounds < maxRounds);

    return keys;
  } catch (err) {
    console.error("❌ KV SCAN failed:", err);
    return [];
  }
}

// 📦 Fetch a key's value
async function getKVValue(key) {
  try {
    const res = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!res.ok) return "⚠️ Fetch error";

    const val = await res.json();
    return typeof val === 'string' ? JSON.parse(val) : val;
  } catch (err) {
    console.warn(`⚠️ Error fetching key ${key}:`, err);
    return "⚠️ Error";
  }
}

export default async function handler(req, res) {
  try {
    const keys = await scanChatKeys();
    const values = {};

    for (const key of keys) {
      values[key] = await getKVValue(key);
    }

    res.status(200).json({ keys, values });
  } catch (err) {
    console.error("❌ KV debug failed:", err);
    res.status(500).json({ error: "KV debug failed", details: err.message });
  }
}