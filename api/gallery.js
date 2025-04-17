// api/gallery.js
// Handles photo gallery operations via Vercel KV: public loading, secure editing, and updates

import { kv } from '@vercel/kv';
import updateGallery from '../lib/updateGallery.js';
import fs from 'node:fs';
import path from 'node:path';

// 🌍 Determine environment
const isDevEnv = process.env.VERCEL_ENV !== 'production';

// 🔐 Load correct KV credentials based on environment
const KV_REST_API_URL = isDevEnv
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevEnv
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); // ✅ Preflight success
  }
  
  const action = req.query.action || req.body?.action;

  // ✅ Public GET route — loads only valid/visible photos for frontend
  if (req.method === 'GET' && action === 'public-load') {
    try {
      const rawGallery = await kv.get('gallery:json');

      // Filter for safe client-side usage (no corrupted entries)
      const gallery = Array.isArray(rawGallery)
        ? rawGallery.filter(p =>
            p &&
            typeof p.filename === 'string' &&
            p.filename.trim() !== '' &&
            typeof p.thumbnail === 'string' &&
            typeof p.id === 'string' &&
            p.id.trim() !== '' &&
            typeof p.width === 'number' &&
            typeof p.height === 'number'
          )
        : [];

      return res.status(200).json(gallery);
    } catch (err) {
      console.error("❌ Failed to fetch gallery:", err);
      return res.status(500).json({ error: 'Unable to fetch gallery data.' });
    }
  }

  // 🔐 Private routes — everything below requires authorization
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 🔁 Load both current and latest backup from KV (for backoffice)
    if (req.method === 'GET' && action === 'load') {
      const current = await kv.get('gallery:json');

      // Fallback from local file if KV missing (only for editing view)
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

    // 💾 Save current gallery to KV, back up the existing one first
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

    // 🧹 Clear gallery.json (and backup current before doing so)
    if (req.method === 'POST' && action === 'clear') {
      const currentGallery = await kv.get('gallery:json');
      if (currentGallery) {
        const timestamp = Date.now();
        await kv.set(`gallery:backup:${timestamp}`, currentGallery);
      }
      await kv.set('gallery:json', []);
      return res.status(200).json({ message: 'Gallery cleared and backup saved.' });
    }

    // 🔄 Run full update: merge local metadata with KV (via lib/updateGallery.js)
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