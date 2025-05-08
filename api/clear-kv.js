// /api/clear-kv.js
// Clears all chat messages from Upstash KV using fetch (no @vercel/kv)
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// 🔍 SCAN all chat keys with pagination
async function scanChatKeys(prefix = 'chat:', batchSize = 100, maxRounds = 30) {
  const keys = [];
  let cursor = 0;
  let rounds = 0;

  do {
    const url = `${KV_REST_API_URL}/scan/${cursor}?match=${encodeURIComponent(prefix + '*')}&count=${batchSize}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!res.ok) break;

    const json = await res.json();
    cursor = json?.cursor ?? 0;
    const batch = Array.isArray(json?.keys) ? json.keys : [];
    keys.push(...batch);

    rounds++;
  } while (cursor !== 0 && rounds < maxRounds);

  return keys;
}

// 🧽 Bulk delete using REST API
async function deleteKey(key) {
  const res = await fetch(`${KV_REST_API_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
  });

  return res.ok;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const keys = await scanChatKeys();
    const deleted = [];

    for (const key of keys) {
      const success = await deleteKey(key);
      if (success) deleted.push(key);
      else console.warn(`⚠️ Failed to delete key: ${key}`);
    }

    res.status(200).json({ success: true, deleted });

  } catch (err) {
    console.error("❌ Failed to clear KV:", err);
    res.status(500).json({ error: "Failed to clear KV", details: err.message });
  }
}