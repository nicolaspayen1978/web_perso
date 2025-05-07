// /api/conversations.js
// Lists all conversations from KV using raw REST API + SCAN, grouped by visitorID

// 🌍 Determine environment
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// 📡 SCAN helper using Upstash REST API
async function scanKeys(prefix = 'chat:', batchSize = 100, maxRounds = 30) {
  const keys = [];
  let cursor = 0;
  let rounds = 0;

  try {
    do {
      const url = `${KV_REST_API_URL}/scan/${cursor}?match=${encodeURIComponent(prefix + '*')}&count=${batchSize}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });

      if (!res.ok) {
        console.error("❌ KV SCAN failed:", await res.text());
        break;
      }

      const { cursor: newCursor, keys: batch = [] } = await res.json();
      cursor = newCursor;
      keys.push(...batch);
      rounds++;
    } while (cursor !== 0 && rounds < maxRounds);
  } catch (err) {
    console.error("❌ scanKeys error:", err);
  }

  console.log(`🔍 scanKeys found ${keys.length} keys`);
  console.log("🔑 Sample keys:", keys.slice(0, 5));
  return keys;
}

export default async function handler(req, res) {
  // 🛡️ Allow CORS for testing/debug
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const keys = await scanKeys('chat:');
    const visitorMap = new Map();

    for (const key of keys) {
      const match = key.match(/^chat:([^:]+):(\d+)$/);
      if (!match) {
        console.warn("⛔️ Key skipped (no match):", key);
        continue;
      }

      const [, visitorID, timestamp] = match;
      const ts = parseInt(timestamp, 10);
      if (isNaN(ts)) {
        console.warn("⚠️ Invalid timestamp in key:", key);
        continue;
      }

      const existing = visitorMap.get(visitorID) || { visitorID, lastMessage: 0, messages: 0 };
      existing.messages += 1;
      existing.lastMessage = Math.max(existing.lastMessage, ts);
      visitorMap.set(visitorID, existing);
    }

    const visitors = Array.from(visitorMap.values());
    visitors.sort((a, b) => b.lastMessage - a.lastMessage); // Latest first

    console.log(`✅ Returning ${visitors.length} visitors`);
    res.status(200).json(visitors);
  } catch (err) {
    console.error("❌ Error reading from KV:", err);
    res.status(500).json({ error: "Failed to read conversations." });
  }
}