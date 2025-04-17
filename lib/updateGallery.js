/**
 * updateGallery.js (now preserves manual edits)
 *
 * This script:
 * - Loads originals_metadata.json (from local script)
 * - Verifies required files exist in /photos and /photos/thumbs
 * - Merges with existing gallery.json from KV to preserve manual edits (title, tags, etc.)
 * - Regenerates all computed fields (dimensions, pricing, etc.)
 * - Saves updated gallery.json to KV
 */

import fs from 'node:fs';
import path from 'node:path';
import { kv } from '@vercel/kv';

const METADATA_PATH = path.join(process.cwd(), 'originals_metadata.json');
const PHOTOS_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');

const DPI = 250;
const CM_TO_INCHES = 2.54;

function fileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function roundToStep(value, step = 0.5) {
  return Math.round(value / step) * step;
}

function calculateDimensions(width, height) {
  const aspectRatio = width / height;
  const orientation = aspectRatio >= 1 ? 'landscape' : 'portrait';
  const longPx = Math.max(width, height);
  const shortPx = Math.min(width, height);
  const longCm = roundToStep((longPx / DPI) * CM_TO_INCHES);
  const shortCm = roundToStep((shortPx / DPI) * CM_TO_INCHES);
  return { longCm, shortCm, orientation };
}

function calculateFinalPrice(grossCost, isXL, minMargin = 100, vatRate = 0.21) {
  const marginRate = isXL ? 0.45 : 0.41;
  const computedMargin = grossCost * marginRate;
  const netMargin = Math.max(computedMargin, minMargin);
  const subtotal = grossCost + netMargin;
  return Math.round(subtotal * (1 + vatRate));
}

 function cleanUnicode(obj) {
    return JSON.parse(
      JSON.stringify(obj).normalize("NFKC") // Normalize all Unicode to canonical form
        .replace(/[\u2028\u2029]/g, '')     // Remove line/paragraph separators
        .replace(/\u00A0/g, ' ')            // Convert non-breaking space to normal space
    );
}

export default async function updateGallery() {
  // Load new metadata from local script
  const raw = fs.readFileSync(METADATA_PATH, 'utf-8');
  const originalData = JSON.parse(raw);

  // Load existing gallery.json from KV to preserve manual edits
  const previous = await kv.get('gallery:json') || [];
  const previousMap = Object.fromEntries(previous.map(p => [p.id, p]));

  const gallery = [];

  for (const item of originalData) {
    const { file, width, height, printSizes = {}, resolutionWarnings = {} } = item;

    const photoPath = path.join(PHOTOS_DIR, file);
    const thumbPath = path.join(THUMBS_DIR, file);

    if (!fileExists(photoPath) || !fileExists(thumbPath)) {
      console.warn(`⚠️ Skipped ${file}: missing image or thumbnail`);
      continue;
    }

    const id = path.parse(file).name;
    const prev = previousMap[id] || {}; // Lookup previous entry (if any)

    const title = prev.title || id.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const dimensions = {};
    const price_details = {};

    // Preserve previous print edition status (esp. sold counts)
    const print_editions = prev.print_editions || {
      L: { total: 5, sold: 0 },
      XL: { total: 3, sold: 0 },
      artist: { total: 2, sold: 0 }
    };

    const format_labels = {
      L: 'Gallery (large)',
      XL: 'Collector (extra large)'
    };

    const descriptionText = `Printed on Mat Hahnemühle FineArt Baryta Print on alu-Dibond with Art box & white rand (at the artist's discretion).`;

    let formatDescription = [];

    // Calculate L edition dimensions and pricing if available
    if (printSizes.L) {
      const { long, short } = printSizes.L;
      const priceL = calculateFinalPrice(250, false);
      dimensions.L = `${long} × ${short} cm`;
      price_details.L = `€${priceL} incl.`;
      formatDescription.push(`Gallery edition (L): ${dimensions.L} — €${priceL} incl.`);
    }

    // Calculate XL edition dimensions and pricing if available
    if (printSizes.XL) {
      const { long, short } = printSizes.XL;
      const priceXL = calculateFinalPrice(250 * (110 / 50), true);
      dimensions.XL = `${long} × ${short} cm`;
      price_details.XL = `€${priceXL} incl.`;
      formatDescription.push(`Collector edition (XL): ${dimensions.XL} — €${priceXL} incl.`);
    }

    price_details.artist = null; // Artist proof price not shown

    gallery.push({
      id,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: prev.location || '',
      description: prev.description || '',
      print_formats: Object.keys(printSizes).filter(k => k === 'L' || k === 'XL'),
      format_labels,
      print_description: [
        descriptionText,
        ...formatDescription,
        `Artist’s proof: price upon request.`
      ].join(' '),
      year: item.year || prev.year || null,
      aspect_ratio: +(width / height).toFixed(2),
      width,
      height,
      dimensions,
      price_details,
      print_editions,
      resolution_warnings: resolutionWarnings,
      tags: prev.tags || [],
      exhibitions: prev.exhibitions || [],
      visible: prev.visible !== undefined ? prev.visible : true
    });
  }

  // Safety check: compare previous and new entries
  const oldIds = new Set(previous.map(p => p.id));
  const newIds = new Set(gallery.map(p => p.id));
  const missing = [...oldIds].filter(id => !newIds.has(id));

  if (missing.length > 0) {
    console.warn(`⚠️ Warning: ${missing.length} photo(s) were present in the previous gallery but are missing now:`);
    console.warn(missing.join(', '));
  }

  // Backup current gallery.json before overwriting
  if (previous.length) {
    const timestamp = Date.now();
    await kv.set(`gallery:backup:${timestamp}`, previous);
  }

  const jsonStr = JSON.stringify(cleanUnicode(gallery));
  const sizeKb = Buffer.byteLength(jsonStr, 'utf8') / 1024;
  console.log(`📦 Final gallery.json size: ${sizeKb.toFixed(2)} KB`);

  // Store updated gallery
  await kv.set('gallery:json', JSON.parse(jsonStr));
  return gallery.length;
  
}
