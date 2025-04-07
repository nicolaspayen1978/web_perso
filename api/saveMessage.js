// This API route saves a single chat message to Vercel KV using the @vercel/kv SDK.
// No need to manage tokens or regions manually.
import { saveMessageInKV } from '@/utils/kvUtils';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { visitorID, sender, message, timestamp } = req.body;

  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  await saveMessageInKV(visitorID, { sender, message, timestamp });

  res.status(200).json({ success: true });
}