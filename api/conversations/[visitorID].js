// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.
// Example: GET /api/conversations/abc123 → returns all chat messages from that visitor.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;               // 🧾 Extract from URL
  const { authorization } = req.headers;         // 🔐 Auth header

  // 🔐 Validate access with your backoffice password
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔍 Fetch all message keys for this visitor
    const keys = await kv.keys(`chat:${visitorID}:*`);

    const messages = [];

    // ⏬ Loop through each key and fetch the associated message
    for (const key of keys) {
      const value = await kv.get(key);

      try {
        // ✅ Handle both stringified and raw objects
        const parsed = typeof value === "string" ? JSON.parse(value) : value;

        if (parsed?.sender && parsed?.message && parsed?.timestamp) {
          messages.push(parsed);
        } else {
          console.warn(`⚠️ Skipping malformed message for key: ${key}`);
        }
      } catch (err) {
        console.error(`❌ Error parsing message for key ${key}:`, err);
      }
    }

    // 📅 Sort messages chronologically
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // ✅ Return full chat history
    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Error fetching messages for ${visitorID}:`, err);
    res.status(500).json({ error: 'KV fetch error', details: err.message });
  }
}