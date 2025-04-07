// This API route clears (deletes) all stored chat messages from Vercel KV using the @vercel/kv SDK.
// Requires a valid Authorization header with BACKOFFICE_PASSWORD.

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  // 🔐 Check if the request includes a valid bearer token
  if (req.headers.authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 📥 Fetch all chat-related keys
    const keys = await kv.keys("chat:*");
    const deleted = [];

    // 🗑 Delete all keys one by one
    for (const key of keys) {
      await kv.del(key);
      deleted.push(key);
    }

    // ✅ Return confirmation + list of deleted keys
    res.status(200).json({ success: true, deleted });

  } catch (err) {
    console.error("❌ Failed to clear KV:", err);
    res.status(500).json({ error: 'Failed to clear KV', details: err.message });
  }
}