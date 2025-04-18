// scripts/generateResourcesContent.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

// Polyfill fetch (for Node <18)
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ESM __dirname workaround
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const RESOURCES_PATH = path.join(__dirname, '../resources.json');
const OUTPUT_PATH = path.join(__dirname, '../resourcesContent.json');
const ROOT_DIR = path.join(__dirname, '../');

// Trusted sources (relative or remote)
const TRUSTED_DOMAINS = [
  '/',
  'https://nicolaspayen1978.github.io/Resumes/',
  'https://nicolaspayen1978.github.io/Articles/'
];

// Check if a URL is trusted
function isTrusted(url) {
  return TRUSTED_DOMAINS.some(prefix => url.startsWith(prefix));
}

// Convert /about.html → full web URL
function resolveUrl(url) {
  if (url.startsWith('/')) {
    return `https://web-perso.vercel.app${url}`;
  }
  return url;
}

// Read <main> or <body> and extract clean text
async function fetchHtmlContent(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const main = doc.querySelector('main') || doc.body;
    if (!main) return '';

    const text = main.textContent.trim();

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

// Try to extract the <title> from an HTML page
async function fetchTitleFromUrl(url) {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const dom = new JSDOM(html);
    const title = dom.window.document.querySelector('title')?.textContent?.trim();
    return title || null;
  } catch {
    return null;
  }
}

// Auto-detect all .html pages in root
async function getLocalRootHtmlPages() {
  const filenames = fs.readdirSync(ROOT_DIR)
    .filter(name => name.endsWith('.html') && !name.startsWith('_'));

  const entries = [];

  for (const file of filenames) {
    const relativeUrl = '/' + file;
    const fullUrl = resolveUrl(relativeUrl);
    const title = await fetchTitleFromUrl(fullUrl) || file.replace(/\.html$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    entries.push({ title, url: relativeUrl });
  }

  return entries;
}

// Main script
async function main() {
  console.log('📚 Starting resource content generation...');
  const raw = fs.readFileSync(RESOURCES_PATH, 'utf-8');
  const userResources = JSON.parse(raw);
  const output = {};

  const localRootPages = await getLocalRootHtmlPages();

  const mergedResources = {
    ...userResources,
    rootHtml: localRootPages  // Add new pseudo-category
  };

  for (const [category, items] of Object.entries(mergedResources)) {
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