// /api/gallery.js
// Handles photo gallery operations via Vercel KV: public loading, secure editing, and updates
//debug 21 april
import fs from 'node:fs';
import path from 'node:path';
import updateGallery from '../lib/updateGallery.js';
import { kvGetGallery, kvSetGallery } from '../lib/kvGalleryHelpers.js'; 

const fetch = globalThis.fetch || (await import('node-fetch')).default;

// 🌍 Determine environment
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

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
      console.log("API/gallery.js - public-load gallery from KV");
      const kvGallery = await kvGetGallery('gallery:json');

      const gallery = Array.isArray(kvGallery)
        ? kvGallery.filter(p =>
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
      console.log(`✅ Public load: returned ${gallery.length} photos.`);
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
      console.warn("📡 [API/gallery] Load request received - trying to load gallery from KV");

      let current = await kvGetGallery('gallery:json');
      console.warn("📦 KV loaded. Is current an array? ", Array.isArray(current));

      let fallback = [];

      try {
        const fallbackPath = path.join(process.cwd(), 'gallery.json');
        const fallbackContent = fs.readFileSync(fallbackPath, 'utf-8');
        fallback = JSON.parse(fallbackContent);
        if (!Array.isArray(current)) {
          console.warn("⚠️ Using fallback gallery.json instead of KV");
        }
      } catch (err) {
        console.warn("❌ Failed to load local fallback gallery.json:", err.message);
      }

      // Load previous backup if any
      let previous = [];
      try {
        const backupKeys = await kvScanBackups();
        if (backupKeys.length) {
          previous = await kvGetGallery(backupKeys[0]);
        }
      } catch (err) {
        console.warn("⚠️ Failed to load or parse previous backup:", err.message);
        previous = [];
      }

      return res.status(200).json({
        current: Array.isArray(current) ? current : fallback,
        previous
      });
    }

    if (req.method === 'POST' && action === 'save') {
      const { json } = req.body;
      if (!Array.isArray(json)) {
        return res.status(400).json({ error: 'Invalid gallery format. Must be an array.' });
      }

      const existing = await kvGetGallery('gallery:json');
      if (Array.isArray(existing) && existing.length > 0) {
        const timestamp = Date.now();
        await kvSetGallery(`gallery:backup:${timestamp}`, existing);
        console.log(`💾 Backup saved as gallery:backup:${timestamp}`);
      } else {
        console.log("ℹ️ No backup created — existing gallery was empty or missing.");
      }

      await kvSetGallery('gallery:json', json);
      return res.status(200).json({ message: 'Gallery updated successfully.' });
    }

    if (req.method === 'POST' && action === 'clear') {
      const current = await kvGetGallery('gallery:json');
      if (Array.isArray(current) && current.length > 0) {
        const timestamp = Date.now();
        await kvSetGallery(`gallery:backup:${timestamp}`, current);
        console.log(`💾 Backup saved as gallery:backup:${timestamp}`);
      }
      await kvSetGallery('gallery:json', []);
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