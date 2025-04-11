// api/gallery/public-load.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const gallery = await kv.get('gallery:json');
    res.status(200).json(gallery || []);
  } catch (err) {
    console.error("❌ Failed to fetch gallery:", err);
    res.status(500).json({ error: 'Unable to fetch gallery data.' });
  }
}