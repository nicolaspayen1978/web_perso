/**
 * updateGallery.js
 *
 * This script scans the /photos and /photos/thumbs directories for matching image pairs,
 * extracts EXIF metadata and dimensions from the medium-sized images,
 * calculates aspect ratios, suggests print formats, and estimates print prices.
 *
 * It builds a fresh gallery dataset and saves it to Vercel KV instead of the file system.
 * The previous version is backed up in KV under a timestamped key.
 *
 * Intended for use in Vercel serverless functions.
 *
 * Requires: sharp, exif-parser
 * Uses: @vercel/kv
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifParser = require('exif-parser');
const { kv } = require('@vercel/kv');

const PHOTOS_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');

function getPrintFormats(width, height) {
  const ratio = width / height;
  if (ratio > 1.2) return ["30x40", "50x70"];
  if (ratio < 0.8) return ["30x30", "50x50"];
  return ["30x45", "60x90"];
}

function estimatePrice(width, height, scale = 0.1) {
  const area = width * height;
  return Math.round(area * scale / 1000); // € estimate
}

async function extractMetadata(filePath) {
  let metadata = {};
  const buffer = fs.readFileSync(filePath);

  // Extract EXIF date
  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    if (result.tags?.DateTimeOriginal) {
      metadata.year = new Date(result.tags.DateTimeOriginal * 1000).getFullYear();
    }
  } catch (e) {
    console.warn(`⚠️ No EXIF date found in ${filePath}`);
  }

  // Extract image dimensions
  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    metadata.width = width;
    metadata.height = height;
    metadata.aspectRatio = +(width / height).toFixed(2);
  } catch (err) {
    console.error(`❌ Could not get image dimensions for ${filePath}:`, err.message);
  }

  return metadata;
}

async function updateGallery() {
  // Ensure the folders exist
  if (!fs.existsSync(PHOTOS_DIR) || !fs.existsSync(THUMBS_DIR)) {
    throw new Error('Missing photos or thumbs directory.');
  }

  const mediumFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g)$/i.test(f));
  const thumbFiles = fs.readdirSync(THUMBS_DIR).filter(f => /\.(jpe?g)$/i.test(f));
  const validFiles = mediumFiles.filter(f => thumbFiles.includes(f));

  const gallery = [];

  for (const file of validFiles) {
    const filePath = path.join(PHOTOS_DIR, file);
    const metadata = await extractMetadata(filePath);

    // Skip if dimensions are missing
    if (!metadata.width || !metadata.height) {
      console.warn(`⏭️ Skipping ${file}: no dimensions`);
      continue;
    }

    const title = path.parse(file).name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const print_formats = getPrintFormats(metadata.width, metadata.height);
    const priceEstimate = estimatePrice(metadata.width, metadata.height);

    gallery.push({
      id: path.parse(file).name,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: "",
      description: "",
      print_formats,
      available_prints: 3,
      print_description: `Printed on Hahnemühle FineArt Baryta, signed and numbered. Estimated price: €${priceEstimate}.`,
      year: metadata.year || null,
      aspect_ratio: metadata.aspectRatio
    });
  }

  // Backup current gallery in KV if it exists
  const existing = await kv.get('gallery:json');
  if (existing) {
    const timestamp = Date.now();
    await kv.set(`gallery:backup:${timestamp}`, existing);
    console.log(`🛟 KV backup saved: gallery:backup:${timestamp}`);
  }

  // Save new gallery to KV
  await kv.set('gallery:json', gallery);
  console.log(`✅ Gallery saved to KV. Total items: ${gallery.length}`);
  return gallery.length;
}

module.exports = updateGallery;