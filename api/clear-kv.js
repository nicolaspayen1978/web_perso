// This API route clears (deletes) all stored chat messages from Vercel KV using the @vercel/kv SDK.
// Requires a valid Authorization header with BACKOFFICE_PASSWORD.

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔍 Step 1: Get all keys starting with "chat:"
    const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      },
    });

    const { result: keys = [] } = await listRes.json();

    if (keys.length === 0) {
      return res.status(200).json({ success: true, deleted: [] });
    }

    // 🧹 Step 2: Delete all keys in parallel
    const deletePromises = keys.map(key =>
      fetch(`${process.env.KV_REST_API_URL}/del/${key}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
        },
      }).then(() => key) // return key on success
    );

    const deleted = await Promise.all(deletePromises);

    res.status(200).json({ success: true, deleted });
  } catch (err) {
    console.error("❌ Error clearing KV:", err);
    res.status(500).json({ error: 'KV clear failed', details: err.message });
  }
}