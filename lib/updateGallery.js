
/**
 * updateGallery.js (new version using local metadata)
 *
 * This script:
 * - Loads originals_metadata.json (from local script)
 * - Verifies required files exist in /photos and /photos/thumbs
 * - Transforms the structure into gallery.json format
 * - Saves to KV for gallery display
 */

import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

const METADATA_PATH = path.join(process.cwd(), 'originals_metadata.json');
const PHOTOS_DIR = path.join(process.cwd(), 'public', 'photos');
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

export default async function updateGallery() {
  const raw = fs.readFileSync(METADATA_PATH, 'utf-8');
  const originalData = JSON.parse(raw);

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
    const title = id.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    const dimensions = {};
    const price_details = {};
    const print_editions = {
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

    if (printSizes.L) {
      const { long, short } = printSizes.L;
      const priceL = calculateFinalPrice(250, false);
      dimensions.L = `${long} × ${short} cm`;
      price_details.L = `€${priceL} incl.`;
      formatDescription.push(`Gallery edition (L): ${dimensions.L} — €${priceL} incl.`);
    }

    if (printSizes.XL) {
      const { long, short } = printSizes.XL;
      const priceXL = calculateFinalPrice(250 * (110 / 50), true);
      dimensions.XL = `${long} × ${short} cm`;
      price_details.XL = `€${priceXL} incl.`;
      formatDescription.push(`Collector edition (XL): ${dimensions.XL} — €${priceXL} incl.`);
    }

    price_details.artist = null;

    gallery.push({
      id,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: '',
      description: '',
      print_formats: Object.keys(printSizes),
      format_labels,
      print_description: [
        descriptionText,
        ...formatDescription,
        `Artist’s proof: price upon request.`
      ].join(' '),
      year: null,
      aspect_ratio: +(width / height).toFixed(2),
      width,
      height,
      dimensions,
      price_details,
      print_editions,
      resolution_warnings: resolutionWarnings
    });
  }

  const existing = await kv.get('gallery:json');
  if (existing) {
    const timestamp = Date.now();
    await kv.set(`gallery:backup:${timestamp}`, existing);
  }

  await kv.set('gallery:json', gallery);
  return gallery.length;
}
