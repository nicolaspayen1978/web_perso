// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.
// Example: GET /api/conversations/abc123 → returns all chat messages from that visitor.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  // 🔐 Check auth token
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔑 Fetch all keys related to this visitor
    const keys = await kv.keys(`chat:${visitorID}:*`);
    console.log(`🔍 Found ${keys.length} keys for visitor ${visitorID}`);

    const messages = [];

    for (const key of keys) {
      try {
        const raw = await kv.get(key);
        console.log(`📦 Raw value for key "${key}":`, raw);

        // If kv.get() returns { value: {...} }, unwrap it — otherwise use raw
        const value = raw?.value ?? raw;

        if (
          typeof value === "object" &&
          value?.sender &&
          value?.message &&
          value?.timestamp
        ) {
          messages.push(value);
        } else {
          console.warn(`⚠️ Skipping malformed value for key: ${key}`, value);
        }
      } catch (err) {
        console.error(`❌ Failed to process key ${key}:`, err);
      }
    }

    // 🕒 Sort messages chronologically
    messages.sort((a, b) => a.timestamp - b.timestamp);

    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Error loading messages for ${visitorID}:`, err);
    res.status(500).json({ error: 'Failed to fetch conversation', details: err.message });
  }
}