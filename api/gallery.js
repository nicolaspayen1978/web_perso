// /api/gallery.js
// Handles photo gallery operations via Vercel KV: public loading, secure editing, and updates
import fs from 'node:fs';
import path from 'node:path';
import updateGallery from '../lib/updateGallery.js';

const fetch = globalThis.fetch || (await import('node-fetch')).default;

// 🌍 Determine environment
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// Helper: safe recursive parse
function safeParse(value) {
  try {
    while (typeof value === 'string') {
      value = JSON.parse(value);
    }
  } catch (err) {
    console.warn('❌ Failed recursive parse:', err.message);
    return null;
  }
  return value;
}

// KV helpers using fetch
async function kvGet(key) {
  const res = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
  });

  if (!res.ok) {
    console.warn(`⚠️ Failed to get ${key}:`, await res.text());
    return null;
  }

  const result = await res.json();
  return safeParse(result);
}

async function kvSet(key, value) {
  const res = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ KV set failed for ${key}:`, err);
  }
}

// Scan backup keys (sorted)
async function kvScanBackups() {
  let cursor = 0;
  let allKeys = [];

  do {
    const res = await fetch(`${KV_REST_API_URL}/scan/${cursor}?match=gallery:backup:*&count=100`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!res.ok) {
      console.warn("⚠️ Failed to scan gallery backups:", await res.text());
      break;
    }

    const json = await res.json();
    const nextCursor = json?.cursor ?? 0;
    const keys = Array.isArray(json?.keys) ? json.keys : [];

    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== 0);

  if (allKeys.length === 0) {
    console.warn("⚠️ No gallery backups found in KV.");
  }

  return allKeys.sort().reverse();
}

// Main API handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || req.body?.action;

  // ✅ Public load route
  if (req.method === 'GET' && action === 'public-load') {
    try {
      const rawGallery = await kvGet('gallery:json');

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
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(500).json({ error: 'Unable to fetch gallery data.' });
    }
  }

  // 🔐 Backoffice: protected routes
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET' && action === 'load') {
      let current = await kvGet('gallery:json');
      let fallback = [];

      try {
        const fallbackPath = path.join(process.cwd(), 'gallery.json');
        const fallbackContent = fs.readFileSync(fallbackPath, 'utf-8');
        fallback = JSON.parse(fallbackContent);
        console.warn("⚠️ Using fallback gallery.json instead of KV");
      } catch (err) {
        console.warn("⚠️ Failed to load local gallery.json fallback:", err.message);
      }

      const backupKeys = await kvScanBackups();
      let previous = backupKeys.length ? await kvGet(backupKeys[0]) : [];
      if (typeof previous === 'string') {
        try {
          previous = JSON.parse(previous);
        } catch (err) {
          console.warn("⚠️ Failed to parse previous backup as array:", err.message);
          previous = [];
        }
      }

      return res.status(200).json({ current: Array.isArray(current) ? current : fallback, previous });
    }

    if (req.method === 'POST' && action === 'save') {
      const { json } = req.body;
      if (!Array.isArray(json)) {
        return res.status(400).json({ error: 'Invalid gallery format. Must be an array.' });
      }

      const existing = await kvGet('gallery:json');
      if (Array.isArray(existing) && existing.length > 0) {
        const timestamp = Date.now();
        await kvSet(`gallery:backup:${timestamp}`, existing);
        console.log(`💾 Backup saved as gallery:backup:${timestamp}`);
      } else {
        console.log("ℹ️ No backup created — existing gallery was empty or missing.");
      }

      await kvSet('gallery:json', json);
      return res.status(200).json({ message: 'Gallery updated successfully.' });
    }

    if (req.method === 'POST' && action === 'clear') {
      const current = await kvGet('gallery:json');
      if (Array.isArray(current) && current.length > 0) {
        const timestamp = Date.now();
        await kvSet(`gallery:backup:${timestamp}`, current);
        console.log(`💾 Backup saved as gallery:backup:${timestamp}`);
      }
      await kvSet('gallery:json', []);
      return res.status(200).json({ message: 'Gallery cleared and backup saved.' });
    }

    if (req.method === 'POST' && action === 'run-update') {
      const count = await updateGallery();
      return res.status(200).json({ message: `Gallery updated with ${count} photos.` });
    }

    return res.status(400).json({ error: 'Invalid action or method.' });
  } catch (err) {
    console.error("❌ Gallery API error:", err);
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}