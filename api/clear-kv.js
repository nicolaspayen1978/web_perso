// /api/clear-kv.js
// This API route clears all stored chat messages from Vercel KV using the @vercel/kv SDK.
// Only accessible with a valid Authorization header using BACKOFFICE_PASSWORD.

import { kv } from "@vercel/kv";

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
  const auth = req.headers.authorization;

  // 🔐 Validate Authorization header
  if (auth !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 📥 Fetch all chat-related keys (format: chat:<visitorID>:<timestamp>)
    const keys = await kv.keys("chat:*");
    const deleted = [];

    // 🗑 Delete each key one by one and track
    for (const key of keys) {
      await kv.del(key);
      deleted.push(key);
    }

    // ✅ Respond with success and list of deleted keys
    res.status(200).json({ success: true, deleted });

  } catch (err) {
    // 🧯 Handle unexpected KV errors
    console.error("❌ Failed to clear KV:", err);
    res.status(500).json({ error: "Failed to clear KV", details: err.message });
  }
}