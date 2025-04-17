// /api/conversations.js
// This API route returns a summary of all stored conversations in Vercel KV.
// Each conversation is grouped by visitorID, showing the number of messages and the timestamp of the last message.

// /api/conversations.js
import { kv } from '@vercel/kv';

// 🌍 Determine environment
const isDevEnv = process.env.VERCEL_ENV !== 'production';

// 🔐 Load correct KV credentials based on environment
const KV_REST_API_URL = isDevEnv
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevEnv
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ✅ Use SCAN instead of KEYS
  const scanKeys = async (prefix = 'chat:', batchSize = 100) => {
    const keys = [];
    let cursor = 0;

    do {
      const result = await kv.scan(cursor, {
        match: `${prefix}*`,
        count: batchSize
      });

      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== 0);

    return keys;
  };

  try {
    const keys = await scanKeys('chat:');
    const visitorMap = new Map();

    for (const key of keys) {
      const match = key.match(/^chat:([^:]+):(\d+)$/);
      if (!match) continue;

      const [, visitorID, timestamp] = match;
      const ts = parseInt(timestamp, 10);

      const existing = visitorMap.get(visitorID) || { visitorID, lastMessage: 0, messages: 0 };
      existing.messages += 1;
      existing.lastMessage = Math.max(existing.lastMessage, ts);
      visitorMap.set(visitorID, existing);
    }

    const visitors = Array.from(visitorMap.values());
    visitors.sort((a, b) => b.lastMessage - a.lastMessage); // Latest first

    res.status(200).json(visitors);
  } catch (err) {
    console.error("❌ Error reading from KV:", err);
    res.status(500).json({ error: "Failed to read conversations." });
  }
}