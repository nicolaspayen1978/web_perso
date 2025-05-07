// /api/conversation/[visitorID].js
// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.
// Example: GET /api/conversation/abc123 → returns all chat messages from that visitor.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  console.log("🔍 Incoming request for visitorID:", visitorID);

  // 🔐 Simple access control with shared password (used by backoffice)
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 📦 Scan all keys for this visitor (format: chat:<visitorID>:<timestamp>)
    const pattern = `chat:${visitorID}:*`;
    const keys = await kv.keys(pattern);
    console.log(`📌 Found ${keys.length} keys for visitorID: ${visitorID}`);

    const messages = [];

    for (const key of keys) {
      try {
        const raw = await kv.get(key);
        console.log(`📦 Raw value from key "${key}":`, raw);

        let parsed;

        // 🧪 Step 1: parse raw response
        if (typeof raw === 'string') {
          try {
            parsed = JSON.parse(raw);
          } catch (err) {
            console.warn(`⚠️ Could not parse stringified value for ${key}:`, err.message);
            continue;
          }
        } else {
          parsed = raw;
        }

        // 🧪 Step 2: detect common wrapping: { result: {...} }
        if (parsed?.result && typeof parsed.result === 'object') {
          parsed = parsed.result;
        }

        // 🧪 Step 3: defensive check on expected message structure
        if (
          typeof parsed === 'object' &&
          parsed?.sender &&
          parsed?.message &&
          typeof parsed.timestamp === 'number'
        ) {
          messages.push(parsed);
        } else {
          console.warn(`⚠️ Skipping malformed or incomplete message at key: ${key}`, parsed);
        }

      } catch (err) {
        console.error(`❌ Error retrieving/parsing key ${key}:`, err.message);
      }
    }

    // 🕒 Sort all messages chronologically by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    // ✅ Return visitorID and full conversation
    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Error while processing conversation for ${visitorID}:`, err.message);
    res.status(500).json({ error: 'KV fetch error', details: err.message });
  }
}