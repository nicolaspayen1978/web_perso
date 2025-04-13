/**
 * updateGallery.js
 *
 * This script processes the image gallery by:
 * - Scanning /photos/originals for full-res JPEGs
 * - Creating medium-size display images in /photos if missing
 * - Creating thumbnails in /photos/thumbs if missing
 * - Extracting metadata (year, dimensions, aspect ratio)
 * - Calculating recommended print formats and prices
 * - Verifying if resolution matches required DPI (default 300)
 * - Saving structured gallery info into Vercel KV
 *
 * Requirements: sharp, exif-parser, @vercel/kv
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifParser = require('exif-parser');
const { kv } = require('@vercel/kv');

// Folder structure
const ORIGINALS_DIR = path.join(process.cwd(), 'photos', 'originals');
const MEDIUM_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(MEDIUM_DIR, 'thumbs');

// Resolution check settings
const dpi_settings = {
  dpi: 300,
  cm_to_inches: 2.54
};

function isResolutionSufficient(width, height, targetCmLong, targetCmShort) {
  const requiredLongPx = Math.round((targetCmLong / dpi_settings.cm_to_inches) * dpi_settings.dpi);
  const requiredShortPx = Math.round((targetCmShort / dpi_settings.cm_to_inches) * dpi_settings.dpi);

  return (
    (width >= requiredLongPx && height >= requiredShortPx) ||
    (height >= requiredLongPx && width >= requiredShortPx)
  );
}

// Generate resized image
async function generateResized(originalPath, targetPath, maxSize) {
  await sharp(originalPath)
    .resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(targetPath);
}

// Compute print sizes
function determinePrintSize(aspectRatio) {
  const formats = {};
  for (const size of [{ format: 'L', longest: 50 }, { format: 'XL', longest: 110 }]) {
    const isLandscape = aspectRatio >= 1;
    const long = size.longest;
    const short = isLandscape
      ? +(long / aspectRatio).toFixed(1)
      : +(long * aspectRatio).toFixed(1);

    formats[size.format] = {
      format: size.format,
      long,
      short,
      orientation: isLandscape ? 'landscape' : 'portrait'
    };
  }
  return formats;
}

// Pricing logic
function calculateFinalPrice(grossCost, isXL, minMargin = 100, vatRate = 0.21) {
  const marginRate = isXL ? 0.45 : 0.41;
  const computedMargin = grossCost * marginRate;
  const netMargin = Math.max(computedMargin, minMargin);
  const subtotal = grossCost + netMargin;
  const finalPrice = subtotal * (1 + vatRate);
  return Math.round(finalPrice);
}

// Extract EXIF metadata + image dimensions
async function extractMetadata(filePath) {
  let metadata = {};
  const buffer = fs.readFileSync(filePath);

  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    if (result.tags?.DateTimeOriginal) {
      metadata.year = new Date(result.tags.DateTimeOriginal * 1000).getFullYear();
    }
  } catch {}

  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    metadata.width = width;
    metadata.height = height;
    metadata.aspectRatio = +(width / height).toFixed(2);
  } catch {}

  return metadata;
}

// Main update logic
async function updateGallery() {
  if (!fs.existsSync(ORIGINALS_DIR)) throw new Error('Missing photos/originals directory.');

  const originalFiles = fs.readdirSync(ORIGINALS_DIR).filter(f => /\.(jpe?g)$/i.test(f));
  const gallery = [];

  for (const file of originalFiles) {
    const base = path.parse(file).name;
    const originalPath = path.join(ORIGINALS_DIR, file);
    const mediumPath = path.join(MEDIUM_DIR, file);
    const thumbPath = path.join(THUMBS_DIR, file);

    // Auto-generate medium if missing
    if (!fs.existsSync(mediumPath)) {
      await generateResized(originalPath, mediumPath, 2048);
    }

    // Auto-generate thumbnail if missing
    if (!fs.existsSync(thumbPath)) {
      await generateResized(originalPath, thumbPath, 480);
    }

    const metadata = await extractMetadata(originalPath);
    if (!metadata.width || !metadata.height) continue;

    const title = base.replace(/[-_]/g, ' ').replace(/\w/g, l => l.toUpperCase());
    const sizeOptions = determinePrintSize(metadata.aspectRatio);

    const grossCostL = 250;
    const grossCostXL = 250 * (110 / 50);
    const priceL = calculateFinalPrice(grossCostL, false);
    const priceXL = calculateFinalPrice(grossCostXL, true);

    const resolutionWarnings = {
      L: !isResolutionSufficient(metadata.width, metadata.height, sizeOptions.L.long, sizeOptions.L.short),
      XL: !isResolutionSufficient(metadata.width, metadata.height, sizeOptions.XL.long, sizeOptions.XL.short)
    };

    gallery.push({
      id: base,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: "",
      description: "",
      print_formats: ['L', 'XL'],
      format_labels: {
        L: 'Gallery (large)',
        XL: 'Collector (extra large)'
      },
      print_description: [
        `Printed on Mat Hahnemühle FineArt Baryta Print on alu-Dibond with Art box & white rand (at the artist's discretion).`,
        `Gallery edition (L): ${sizeOptions.L.long}×${sizeOptions.L.short}cm — €${priceL} incl.`,
        `Collector edition (XL): ${sizeOptions.XL.long}×${sizeOptions.XL.short}cm — €${priceXL} incl.`,
        `Artist’s proof: price upon request.`
      ].join(' '),
      year: metadata.year || null,
      aspect_ratio: metadata.aspectRatio,
      width: metadata.width,
      height: metadata.height,
      dimensions: {
        L: `${sizeOptions.L.long} × ${sizeOptions.L.short} cm`,
        XL: `${sizeOptions.XL.long} × ${sizeOptions.XL.short} cm`
      },
      price_details: {
        L: `€${priceL} incl.`,
        XL: `€${priceXL} incl.`,
        artist: null
      },
      print_editions: {
        L: { total: 5, sold: 0 },
        XL: { total: 3, sold: 0 },
        artist: { total: 2, sold: 0 }
      },
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

module.exports = updateGallery;
