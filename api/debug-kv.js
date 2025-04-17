// /api/debug-chatkv.js
// This API route returns all KV entries starting with "chat:*" — for admin debugging.
// It uses the @vercel/kv SDK (no need to manage headers or manual fetch).
// 🔐 Optionally, you can add auth protection if needed.

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    // 📥 Step 1: Fetch all keys that start with "chat:"
    const keys = await kv.keys("chat:*");
    const values = {};

    // 🔁 Step 2: Fetch the value for each key
    for (const key of keys) {
      try {
        const value = await kv.get(key);
        values[key] = value ?? null;
      } catch (err) {
        console.warn(`⚠️ Could not get value for key ${key}:`, err);
        values[key] = "⚠️ Error fetching";
      }
    }

    // ✅ Return result for inspection (keys + values)
    res.status(200).json({ keys, values });

  } catch (err) {
    // 🧯 Handle unexpected errors
    console.error("❌ Failed to load debug KV data:", err);
    res.status(500).json({ error: "KV debug failed", details: err.message });
  }
}