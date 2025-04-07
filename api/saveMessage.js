// This API route saves a single chat message to Vercel KV using the @vercel/kv SDK.
// No need to manage tokens or regions manually.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // ✅ Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).end('Method not allowed');
  }

  // 📥 Extract fields from request body
  const { visitorID, sender, message, timestamp } = req.body;

  // 🛑 Validate required fields
  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🗝 Construct key and value
  const key = `chat:${visitorID}:${timestamp}`;
  const value = { sender, message, timestamp };

  try {
    console.log("📤 Saving to KV:", key, value);

    // 💾 Store in Vercel KV
    await kv.set(key, value);

    console.log("✅ Message saved to KV successfully");
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("❌ Error saving to KV:", err);
    return res.status(500).json({ error: 'KV save failed', details: err.message });
  }
}