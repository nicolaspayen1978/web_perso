// scripts/fixGalleryKV.js
// One-time safe repair script to restore gallery.json in KV
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
 *
 * 🔧 HOW IT WORKS
 * 1. Loads and parses local `gallery.json`
 * 2. If KV already has a gallery, creates a backup snapshot
 * 3. Uploads the local `gallery.json` as the new value for `gallery:json`
 * 4. Logs progress clearly (success, backups, errors)
 *
 * ✅ RECOMMENDED USAGE
 * - Run manually once per environment after deploying your site to Vercel
 * - Can be used as a fallback when `runGalleryUpdate.js` or `updateGallery()` fail
 *
 * 🛑 CAUTION
 * - Ensure `gallery.json` is up-to-date before running
 * - This script does NOT regenerate metadata — it uses what's already in `gallery.json`
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import fetch from 'node-fetch';
import { kvGetGallery, kvSetGallery } from '../lib/kvGalleryHelpers.js'; 

const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

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

  // Check if KV already has gallery data
  const existing = await kvGetGallery('gallery:json');
  if (Array.isArray(existing) && existing.length > 0) {
    const timestamp = Date.now();
    await kvSetGallery(`gallery:backup:${timestamp}`, JSON.stringify(existing));
    console.log(`💾 Existing KV gallery backed up as gallery:backup:${timestamp}`);
  }

  const success = await kvSet('gallery:json', gallery);
  if (success) {
    console.log('✅ KV repaired: gallery.json restored to KV.');
  } else {
    console.error('❌ Failed to update KV.');
  }
}

main();