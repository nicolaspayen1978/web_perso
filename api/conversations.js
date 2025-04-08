// This API route returns a summary of all stored conversations in Vercel KV.
// Each conversation is grouped by visitorID, with a count of messages and the timestamp of the last one.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { authorization } = req.headers;

  // 🔐 Protect with BACKOFFICE_PASSWORD
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 📥 Fetch all keys from KV matching "chat:*"
    const keys = await kv.keys("chat:*");

    const grouped = {};

    // 🔁 Group keys by visitorID and collect timestamps
    for (const key of keys) {
      const parts = key.split(":");

      // Skip malformed keys that don't follow "chat:<visitorID>:<timestamp>"
      if (parts.length !== 3) {
        console.warn(`⚠️ Skipping malformed key: ${key}`);
        continue;
      }

      const [, visitorID, timestamp] = parts;

      if (!visitorID || isNaN(parseInt(timestamp))) {
        console.warn(`⚠️ Invalid visitorID or timestamp in key: ${key}`);
        continue;
      }

      if (!grouped[visitorID]) {
        grouped[visitorID] = [];
      }

      grouped[visitorID].push(parseInt(timestamp));
    }

    // 📊 Build summary list: one entry per visitor
    const summary = Object.entries(grouped).map(([id, timestamps]) => ({
      visitorID: id,
      messages: timestamps.length,
      lastMessage: Math.max(...timestamps)
    }));

    // 🔽 Sort summaries by most recent lastMessage
    summary.sort((a, b) => b.lastMessage - a.lastMessage);

    console.log("📊 Visitor summary:", summary);

    // ✅ Return the structured and sorted summary
    res.status(200).json(summary);

  } catch (err) {
    // 🧯 Catch unexpected errors
    console.error("❌ Error reading KV:", err);
    res.status(500).json({ error: "KV read failed", details: err.message });
  }
}