// api/saveMessage.js
import { saveMessageInKV } from '../utils/kvUtils.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { visitorID, sender, message, timestamp } = req.body;

  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log('💾 saveMessage called:', {
    visitorID,
    sender,
    snippet: message?.slice(0, 30),
    timestamp
  });

  try {
    console.print('Calling save message to KV:');
    await saveMessageInKV(visitorID, { sender, message, timestamp });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Failed to save message to KV:', err);
    res.status(500).json({ error: 'Internal error saving message' });
  }
}