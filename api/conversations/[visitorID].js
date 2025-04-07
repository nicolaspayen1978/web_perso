// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.
// Example: GET /api/conversations/abc123 → returns all chat messages from that visitor.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;              // 🧾 From the dynamic route
  const { authorization } = req.headers;        // 🔐 Security header

  // 🔐 Validate access using BACKOFFICE_PASSWORD
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔍 Get all keys for this visitor
    const keys = await kv.keys(`chat:${visitorID}:*`);
    const messages = [];

    // 🔁 Fetch and parse each message
    for (const key of keys) {
      const data = await kv.get(key);
      if (data) {
        messages.push(data);
      } else {
        console.warn(`⚠️ No data found for key: ${key}`);
      }
    }

    // 🕒 Sort messages chronologically
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // ✅ Return full chat history
    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Error fetching conversation for ${visitorID}:`, err);
    res.status(500).json({ error: 'KV read error', details: err.message });
  }
}