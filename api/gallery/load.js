// api/gallery/load.js
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Try to load from KV first
    const current = await kv.get('gallery:json');

    // If KV is empty, fall back to file system on first deploy
    let fallback = [];
    try {
      const fallbackPath = path.join(process.cwd(), 'gallery.json');
      const fallbackContent = fs.readFileSync(fallbackPath, 'utf-8');
      fallback = JSON.parse(fallbackContent);
    } catch (e) {
      console.warn("⚠️ No fallback gallery.json found or invalid");
    }

    const backupKeys = await kv.keys('gallery:backup:*');
    const sorted = backupKeys.sort().reverse();
    const previous = sorted.length ? await kv.get(sorted[0]) : [];

    res.status(200).json({
      current: current || fallback,
      previous
    });
  } catch (err) {
    console.error("❌ Failed to load gallery from KV:", err);
    res.status(500).json({ error: 'Failed to load gallery', details: err.message });
  }
}