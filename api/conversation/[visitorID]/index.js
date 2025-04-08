// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.
// Example: GET /api/conversation/abc123 → returns all chat messages from that visitor.
//update src and dest in vercel.json

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  console.log("req.query:", req.query);
  console.log("VisitorID param:", req.query.visitorID);

  // 🔐 Check access
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pattern = `chat:${visitorID}:*`;
    const keys = await kv.keys(pattern);
    console.log(`🔍 Found ${keys.length} keys for visitorID: ${visitorID}`);

    const messages = [];

    for (const key of keys) {
      try {
        const raw = await kv.get(key);
        console.log(`📦 Raw value from key "${key}":`, raw);

        // Handle both stringified and parsed JSON
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

        if (
          parsed?.sender &&
          parsed?.message &&
          parsed?.timestamp
        ) {
          messages.push(parsed);
        } else {
          console.warn(`⚠️ Skipping malformed value for key: ${key}`, parsed);
        }
      } catch (err) {
        console.error(`❌ Error parsing value for key: ${key}`, err);
      }
    }

    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // ✅ Return
    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Error loading messages for ${visitorID}:`, err);
    res.status(500).json({ error: 'KV fetch error', details: err.message });
  }
}