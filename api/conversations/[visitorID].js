// /api/conversations/[visitorID].js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  // 🔐 Check access token
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔑 List keys matching this visitor
    const keys = await kv.keys(`chat:${visitorID}:*`);
    console.log(`🔍 Found ${keys.length} keys for visitorID ${visitorID}`, keys);

    const messages = [];

    for (const key of keys) {
      try {
        const value = await kv.get(key);

        // 👀 Log raw value for debugging
        console.log(`📦 Raw value for key "${key}":`, value);

        // 🧠 Handle multiple value formats
        const parsed =
          typeof value === 'string'
            ? JSON.parse(value)
            : typeof value === 'object'
            ? value
            : JSON.parse(String(value));

        if (parsed?.sender && parsed?.message && parsed?.timestamp) {
          messages.push(parsed);
        } else {
          console.warn(`⚠️ Incomplete or malformed message for key "${key}":`, parsed);
        }
      } catch (err) {
        console.error(`❌ Failed to parse value for key "${key}":`, err);
      }
    }

    // 🕒 Sort messages by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // ✅ Return messages
    return res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ KV error while loading visitorID ${visitorID}:`, err);
    return res.status(500).json({ error: 'KV fetch failed', details: err.message });
  }
}