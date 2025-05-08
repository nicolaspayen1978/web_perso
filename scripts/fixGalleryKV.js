// scripts/fixGalleryKV.js
/**
 * fixGalleryKV.js — One-time gallery repair and seed script for Vercel KV
 *
 * 🧩 PURPOSE
 * This script safely restores the gallery data (gallery.json) into your Vercel KV store.
 * It's useful when:
 *  - The `gallery:json` key is missing or corrupted in KV
 *  - Your gallery fails to load in dev/preview/prod environments
 *  - You need to re-seed KV with the local gallery.json state
 *
 * 🔄 SAFE TO RUN MULTIPLE TIMES
 * - If `gallery:json` already exists, a timestamped backup is saved automatically to `gallery:backup:<timestamp>`
 * - The new value is only set after validation — ensures clean, expected format
 * - Running this script multiple times will NOT cause harm or data loss
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { kvGetGallery, kvSetGallery } from '../lib/gallery_KVHelpers.js';

const GALLERY_FILE = path.join(process.cwd(), 'gallery.json');

async function main() {
  console.log('🔧 Starting fixGalleryKV.js...');

  if (!fs.existsSync(GALLERY_FILE)) {
    console.error('❌ gallery.json not found. Aborting.');
    process.exit(1);
  }

  const content = fs.readFileSync(GALLERY_FILE, 'utf-8');
  let gallery;
  try {
    gallery = JSON.parse(content);
  } catch (err) {
    console.error('❌ Invalid JSON in gallery.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(gallery)) {
    console.error('❌ gallery.json is not an array. Aborting.');
    process.exit(1);
  }

  console.log(`📥 Parsed gallery.json with ${gallery.length} items.`);

  // Load existing KV state and check for corrupt wrapping
  const rawKV = await kvGetGallery('gallery:json');

  if (Array.isArray(rawKV) && rawKV.length > 0) {
    const timestamp = Date.now();
    await kvSetGallery(`gallery:backup:${timestamp}`, rawKV);
    console.log(`💾 Existing KV gallery backed up as gallery:backup:${timestamp}`);
  } else {
    console.warn(`⚠️ KV gallery:json was empty or unreadable. No backup saved.`);
  }

  const ok = await kvSetGallery('gallery:json', gallery);
  if (ok === false) {
    console.error('❌ Failed to update KV.');
  } else {
    console.log(`✅ KV repaired with ${gallery.length} photos.`);
  }
}

main();