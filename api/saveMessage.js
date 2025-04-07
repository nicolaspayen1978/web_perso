import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { visitorID, sender, message, timestamp } = req.body;

  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const key = `chat:${visitorID}:${timestamp}`;

  await kv.set(key, JSON.stringify({ sender, message, timestamp }));

  res.status(200).json({ success: true });
}