// This API route saves a single chat message to Vercel KV using the @vercel/kv SDK.
// No need to manage tokens or regions manually!
const { saveMessageInKV } = require('../utils/kvUtils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { visitorID, sender, message, timestamp } = req.body;

  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  saveMessageInKV(visitorID, { sender, message, timestamp });

  res.status(200).json({ success: true });
};