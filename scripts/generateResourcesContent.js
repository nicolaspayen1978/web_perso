// scripts/generateResourcesContent.js
// This script reads resources.json and extracts full text content from trusted pages.
// The result is saved to resourcesContent.json for use by NicoAI.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Polyfill fetch if needed (for Node <18)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const RESOURCES_PATH = path.join(__dirname, '../resources.json');
const OUTPUT_PATH = path.join(__dirname, '../resourcesContent.json');

// Trusted domains for static fetch
const TRUSTED_DOMAINS = [
  '/',
  'https://nicolaspayen1978.github.io/Resumes/',
  'https://nicolaspayen1978.github.io/Articles/'
];

// Check if a URL is from a trusted source
function isTrusted(url) {
  return TRUSTED_DOMAINS.some(prefix => url.startsWith(prefix));
}

// Convert relative paths to full URLs
function resolveUrl(url) {
  if (url.startsWith('/')) {
    return `https://web-perso.vercel.app${url}`;
  }
  return url;
}

// Fetch HTML and extract content from <main> or <body>
async function fetchHtmlContent(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    let main = doc.querySelector('main') || doc.body;
    if (!main) return '';

    let text = main.textContent.trim();

    // Include image alt+src for context
    const images = [...main.querySelectorAll('img')].map(img => {
      const alt = img.getAttribute('alt') || '';
      const src = img.src || '';
      return alt ? `Image: [${src}] — "${alt}"` : '';
    }).filter(Boolean);

    return text + (images.length ? '\n\n' + images.join('\n') : '');
  } catch (e) {
    console.warn(`⚠️ Failed to fetch or parse ${url}:`, e.message);
    return '';
  }
}

// Main script
async function main() {
  console.log('📚 Starting resource content generation...');
  const raw = fs.readFileSync(RESOURCES_PATH, 'utf-8');
  const resources = JSON.parse(raw);
  const output = {};

  for (const [category, items] of Object.entries(resources)) {
    const list = Array.isArray(items)
      ? items
      : Object.entries(items).map(([title, url]) => ({ title, url }));

    for (const item of list) {
      const url = item.url;
      if (!url || !isTrusted(url)) continue;

      const resolved = resolveUrl(url);
      console.log(`📥 Fetching content from: ${resolved}`);
      const content = await fetchHtmlContent(resolved);

      if (content) {
        output[url] = {
          title: item.title,
          content
        };
        console.log(`✅ Content extracted for: ${item.title}`);
      } else {
        console.log(`⚠️ Skipped (no content): ${item.title}`);
      }
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ Done! Saved ${Object.keys(output).length} entries to resourcesContent.json.`);
}

main();