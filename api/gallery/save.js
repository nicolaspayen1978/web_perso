// api/gallery/save.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { json } = req.body;

    if (!Array.isArray(json)) {
      return res.status(400).json({ error: 'Invalid gallery format. Must be an array.' });
    }

    // Backup current version
    const existing = await kv.get('gallery:json');
    if (existing) {
      const timestamp = Date.now();
      await kv.set(`gallery:backup:${timestamp}`, existing);
    }

    // Save new version
    await kv.set('gallery:json', json);
    res.status(200).json({ message: 'Gallery updated successfully.' });

  } catch (err) {
    console.error("❌ Failed to save gallery to KV:", err);
    res.status(500).json({ error: 'Save failed', details: err.message });
  }
}