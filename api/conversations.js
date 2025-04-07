import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  const pwd = process.env.BACKOFFICE_PASSWORD;

  if (authorization !== `Bearer ${pwd}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const keys = await kv.keys('chat:*');
  const grouped = {};

  for (const key of keys) {
    const [, visitorID, timestamp] = key.split(':');
    if (!grouped[visitorID]) {
      grouped[visitorID] = [];
    }
    grouped[visitorID].push(parseInt(timestamp));
  }

  const summary = Object.entries(grouped).map(([id, timestamps]) => ({
    visitorID: id,
    messages: timestamps.length,
    lastMessage: Math.max(...timestamps)
  }));

  res.status(200).json(summary);
}