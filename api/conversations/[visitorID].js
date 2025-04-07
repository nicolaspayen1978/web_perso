// /api/conversations/[visitorID].js
// This dynamic API route returns all chat messages for a specific visitorID using the @vercel/kv SDK.

import { kv } from '@vercel/kv';
import { getParsedKV } from '../../utils/kvUtils.js';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  // 🔐 Security check
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔍 List all message keys for this visitor
    const keys = await kv.keys(`chat:${visitorID}:*`);
    const messages = [];

    for (const key of keys) {
      const parsed = await getParsedKV(key);
      if (parsed) {
        messages.push(parsed);
      }
    }

    // 🕒 Sort messages by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);

    res.status(200).json({ visitorID, messages });

  } catch (err) {
    console.error(`❌ Failed to load messages for visitorID ${visitorID}:`, err);
    res.status(500).json({ error: 'KV fetch error', details: err.message });
  }
}