// /api/debug-kv.js
// Returns all KV entries starting with "chat:*" — for debugging purposes.
// Uses the @vercel/kv SDK (no need for manual fetch, headers, or parsing).

import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    // 1. Get all keys that start with "chat:"
    const keys = await kv.keys("chat:*");

    // 2. Fetch values for all keys
    const values = {};

    for (const key of keys) {
      try {
        const value = await kv.get(key);
        values[key] = value ?? null;
      } catch (err) {
        console.warn(`⚠️ Could not get value for key ${key}:`, err);
        values[key] = "⚠️ Error fetching";
      }
    }

    // ✅ Return keys + values for inspection
    res.status(200).json({ keys, values });
  } catch (err) {
    console.error("❌ Failed to load debug KV data:", err);
    res.status(500).json({ error: "KV debug failed", details: err.message });
  }
}