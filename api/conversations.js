// /api/conversations.js
// Lists all conversations from KV using raw REST API + SCAN, grouped by visitorID
// 🌍 Determine environment
// This allows switching between dev/staging and prod Upstash instances using an env flag
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// 📡 SCAN helper using Upstash REST API
// Redis-compatible scan operation with fallback for Upstash format variants
async function scanKeys(prefix = 'chat:', batchSize = 100, maxRounds = 30) {
  const keys = [];
  let cursor = '0'; // ✅ Must be a string to avoid "invalid cursor" errors
  let rounds = 0;

  try {
    do {
      const url = `${KV_REST_API_URL}/scan/${cursor}?match=${encodeURIComponent(prefix + '*')}&count=${batchSize}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ KV SCAN failed:", errorText);
        break;
      }

      const json = await res.json();
      console.log("🔎 Raw scan response:", JSON.stringify(json));

      // 🧠 Format detection:
      // Upstash changed response structure over time (v1: { cursor, keys }, v2+: { result: [cursor, keys[]] })
      let newCursor = '0';
      let batch = [];

      if (Array.isArray(json.result) && json.result.length === 2) {
        // ✅ Format: { result: [cursor, keys[]] }
        newCursor = json.result[0];
        batch = json.result[1];
      } else if (typeof json.cursor === 'string' && Array.isArray(json.keys)) {
        // ✅ Legacy format: { cursor, keys }
        newCursor = json.cursor;
        batch = json.keys;
      } else {
        // ⚠️ Unknown or malformed response structure
        console.warn("⚠️ Unknown scan result format. Skipping.");
        break;
      }

      cursor = newCursor;
      keys.push(...batch);
      rounds++;
    } while (cursor !== '0' && rounds < maxRounds); // ⏳ Scan up to maxRounds or until cursor reaches '0' (end)
  } catch (err) {
    console.error("❌ scanKeys error:", err);
  }

  console.log(`🔍 scanKeys found ${keys.length} keys`);
  return keys;
}

export default async function handler(req, res) {
  // 🛡️ CORS setup to allow testing from other tools or environments
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end(); // Preflight request
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const keys = await scanKeys('chat:'); // 🗝️ Only scan keys related to chat messages
    const visitorMap = new Map(); // To group all messages per visitor

    for (const key of keys) {
      // 🎯 Expected key format: chat:<visitorID>:<timestamp>
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

      // 🧮 Group stats per visitor
      const existing = visitorMap.get(visitorID) || { visitorID, lastMessage: 0, messages: 0 };
      existing.messages += 1;
      existing.lastMessage = Math.max(existing.lastMessage, ts);
      visitorMap.set(visitorID, existing);
    }

    // 📦 Return the list of visitors with conversation metadata
    const visitors = Array.from(visitorMap.values());
    visitors.sort((a, b) => b.lastMessage - a.lastMessage); // 🕒 Sort by recency

    console.log(`✅ Returning ${visitors.length} visitors`);
    res.status(200).json(visitors);
  } catch (err) {
    console.error("❌ Error reading from KV:", err);
    res.status(500).json({ error: "Failed to read conversations." });
  }
}