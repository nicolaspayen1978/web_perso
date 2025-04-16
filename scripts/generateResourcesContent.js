// generateResourcesContent.js
// This script reads resources.json and extracts full text content from pages considered "trusted"
// (either internal or from whitelisted external domains). The extracted content is saved to
// resourcesContent.json and used to improve NicoAI's context when answering questions.
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// File paths
const RESOURCES_PATH = path.join(__dirname, '../resources.json');
const OUTPUT_PATH = path.join(__dirname, '../resourcesContent.json');

// List of trusted sources to be fetched at build time
const TRUSTED_DOMAINS = [
  '/',
  'https://nicolaspayen1978.github.io/Resumes/',
  'https://nicolaspayen1978.github.io/Articles/'
];

// Check if the URL is trusted based on prefix
function isTrusted(url) {
  return TRUSTED_DOMAINS.some(prefix => url.startsWith(prefix));
}

// Convert relative URLs to full URLs for fetch
function resolveUrl(url) {
  if (url.startsWith('/')) {
    return `https://web-perso.vercel.app${url}`;
  }
  return url;
}

// Fetch HTML and extract readable text content from <main> or fallback to <body>
async function fetchHtmlContent(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Try to extract meaningful content
    let main = doc.querySelector('main') || doc.body;
    if (!main) return '';

    let text = main.textContent.trim();

    // Extract <img> alt and src info if present
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

// Main process
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
