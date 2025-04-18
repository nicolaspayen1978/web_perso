// scripts/uploadResources.js
// This script uploads resources.json to the Vercel KV database

import fs from 'node:fs';
//import fetch from 'node-fetch'; // Only if you're running locally on Node <18 — see note below

// 🌍 Determine environment
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error("❌ Missing Vercel KV credentials.");
  process.exit(1);
}

console.log("📥 Loading resources.json...");
const resources = JSON.parse(fs.readFileSync('./resources.json', 'utf-8'));

try {
  console.log("📤 Uploading resources.json to Vercel KV...");

  const response = await fetch(`${KV_REST_API_URL}/set/resources`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(resources)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('❌ Failed to upload to Vercel KV:', errText);
    process.exit(1);
  }

  console.log('✅ Successfully uploaded resources to Vercel KV!');
} catch (err) {
  console.error('❌ Unexpected error during upload:', err);
  process.exit(1);
}