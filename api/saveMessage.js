// api/saveMessage.js
// This API route saves a single chat message to Vercel KV using the @vercel/kv SDK.
// It is called by the frontend after each user or AI message.

import { saveMessageInKV } from '../utils/kvUtils.js';

export default async function handler(req, res) {

  // Allow CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Vercel only supports GET/POST by default — reject other methods
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Extract required fields from request body
  const { visitorID, sender, message, timestamp } = req.body;

  // Validate input
  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log('💾 saveMessage called:', { visitorID, sender, snippet: message?.slice(0, 30), timestamp });

  // Save the message in KV using a helper utility
  try {
    await saveMessageInKV(visitorID, { sender, message, timestamp });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Failed to save message to KV:', err);
    res.status(500).json({ error: 'Internal error saving message' });
  }
}