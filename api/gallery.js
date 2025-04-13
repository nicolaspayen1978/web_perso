import { kv } from '@vercel/kv';
import updateGallery from '../lib/updateGallery.js';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const action = req.query.action || req.body?.action;

  // Public load (no auth)
  if (req.method === 'GET' && action === 'public-load') {
    try {
      const gallery = await kv.get('gallery:json');
      return res.status(200).json(gallery || []);
    } catch (err) {
      console.error("❌ Failed to fetch gallery:", err);
      return res.status(500).json({ error: 'Unable to fetch gallery data.' });
    }
  }

  // Everything else requires auth
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET' && action === 'load') {
      const current = await kv.get('gallery:json');

      // Optional fallback to file
      let fallback = [];
      try {
        const fallbackPath = path.join(process.cwd(), 'gallery.json');
        const fallbackContent = fs.readFileSync(fallbackPath, 'utf-8');
        fallback = JSON.parse(fallbackContent);
      } catch {}

      const backupKeys = await kv.keys('gallery:backup:*');
      const sorted = backupKeys.sort().reverse();
      const previous = sorted.length ? await kv.get(sorted[0]) : [];

      return res.status(200).json({ current: current || fallback, previous });
    }

    if (req.method === 'POST' && action === 'save') {
      const { json } = req.body;
      if (!Array.isArray(json)) {
        return res.status(400).json({ error: 'Invalid gallery format. Must be an array.' });
      }

      const existing = await kv.get('gallery:json');
      if (existing) {
        const timestamp = Date.now();
        await kv.set(`gallery:backup:${timestamp}`, existing);
      }

      await kv.set('gallery:json', json);
      return res.status(200).json({ message: 'Gallery updated successfully.' });
    }

    if (req.method === 'POST' && action === 'clear') {
      const currentGallery = await kv.get('gallery:json');
      if (currentGallery) {
        const timestamp = Date.now();
        await kv.set(`gallery:backup:${timestamp}`, currentGallery);
      }
      await kv.set('gallery:json', []);
      return res.status(200).json({ message: 'Gallery cleared and backup saved.' });
    }

    if (req.method === 'POST' && action === 'run-update') {
      const count = await updateGallery();
      return res.status(200).json({ message: `Gallery updated with ${count} photos.` });
    }

    return res.status(400).json({ error: 'Invalid action or method.' });
  } catch (err) {
    console.error("❌ Gallery API error:", err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}