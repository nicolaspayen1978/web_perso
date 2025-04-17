// /api/conversations.js
// This API route returns a summary of all stored conversations in Vercel KV.
// Each conversation is grouped by visitorID, showing the number of messages and the timestamp of the last message.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { authorization } = req.headers;

  // 🔐 Require correct BACKOFFICE_PASSWORD
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 📥 Retrieve all conversation keys (format: chat:<visitorID>:<timestamp>)
    const keys = await kv.keys("chat:*");

    const grouped = {};

    // 🔁 Process each key and group by visitorID
    for (const key of keys) {
      const parts = key.split(":");

      // Skip keys not matching expected format
      if (parts.length !== 3) {
        console.warn(`⚠️ Skipping malformed key: ${key}`);
        continue;
      }

      const [, visitorID, timestamp] = parts;

      // Skip entries with missing/invalid data
      if (!visitorID || isNaN(parseInt(timestamp))) {
        console.warn(`⚠️ Invalid visitorID or timestamp in key: ${key}`);
        continue;
      }

      if (!grouped[visitorID]) {
        grouped[visitorID] = [];
      }

      grouped[visitorID].push(parseInt(timestamp));
    }

    // 📊 Prepare summary: total messages and most recent message per visitor
    const summary = Object.entries(grouped).map(([visitorID, timestamps]) => ({
      visitorID,
      messages: timestamps.length,
      lastMessage: Math.max(...timestamps)
    }));

    // 🔽 Sort summaries by most recent activity
    summary.sort((a, b) => b.lastMessage - a.lastMessage);

    console.log("📊 Visitor summary:", summary);

    // ✅ Return structured and sorted data
    res.status(200).json(summary);

  } catch (err) {
    // 🧯 Handle unexpected KV errors
    console.error("❌ Error reading from KV:", err);
    res.status(500).json({ error: "KV read failed", details: err.message });
  }
}