// /api/gallery/clear.js
import { kv } from '@vercel/kv';
import { requireAuth } from '../../utils/auth';

export default async function handler(req, res) {
  const authResult = requireAuth(req);
  if (!authResult.authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentGallery = await kv.get('gallery:json');

  if (currentGallery) {
    const timestamp = Date.now();
    await kv.set(`gallery:backup:${timestamp}`, currentGallery);
    console.log(`🛟 KV backup created before clear: gallery:backup:${timestamp}`);
  }

  await kv.set('gallery:json', []);
  res.status(200).json({ message: 'Gallery cleared and backup saved.' });
}