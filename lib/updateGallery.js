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
 * Pricing logic includes:
 * - Base cost (supplier cost, incl. VAT) is used as the starting point.
 * - Large formats get a 45% margin, others 41%.
 * - Enforces a minimum net margin of €100.
 * - Then adds 21% VAT on top.
 * - Print size follows 'Fit' mode based on aspect ratio: L = 50cm longest side, XL = 110cm longest side.
 *
 * The final print description is customized as per the artist's discretion.
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

/**
 * Calculates the final customer price using the following rules:
 * - Start with a supplier (WhiteWall) cost (gross, including 21% VAT).
 * - For XL formats (longest side = 110cm) use a 45% margin; otherwise use 41%.
 * - Enforce a minimum net margin of €100.
 * - Finally, add 21% VAT on the resultant total.
 */
function calculateFinalPrice(grossCost, isXL, minMargin = 100, vatRate = 0.21) {
  const marginRate = isXL ? 0.45 : 0.41;
  const computedMargin = grossCost * marginRate;
  const netMargin = Math.max(computedMargin, minMargin);
  const subtotal = grossCost + netMargin;
  const finalPrice = subtotal * (1 + vatRate);
  return Math.round(finalPrice);
}

function determinePrintSize(aspectRatio) {
  const formatL = 50;
  const formatXL = 110;
  return {
    L: {
      format: "L",
      long: formatL,
      short: +(formatL / aspectRatio).toFixed(1)
    },
    XL: {
      format: "XL",
      long: formatXL,
      short: +(formatXL / aspectRatio).toFixed(1)
    }
  };
}

async function extractMetadata(filePath) {
  let metadata = {};
  const buffer = fs.readFileSync(filePath);

  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    if (result.tags?.DateTimeOriginal) {
      metadata.year = new Date(result.tags.DateTimeOriginal * 1000).getFullYear();
    }
  } catch (e) {
    console.warn(`⚠️ No EXIF date found in ${filePath}`);
  }

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

    if (!metadata.width || !metadata.height) {
      console.warn(`⏭️ Skipping ${file}: no dimensions available`);
      continue;
    }

    const title = path.parse(file).name.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const sizeOptions = determinePrintSize(metadata.aspectRatio);

    // Use XL if long side is >= 110cm, else L
    const isXL = sizeOptions.XL.long === 110;
    const chosen = isXL ? sizeOptions.XL : sizeOptions.L;
    const format = chosen.format;
    const dimensionsStr = `${chosen.long}×${chosen.short}cm`;

    const grossCost = format === "XL" ? 250 * (110 / 50) : 250;
    const finalPrice = calculateFinalPrice(grossCost, isXL);

    gallery.push({
      id: path.parse(file).name,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: "",
      description: "",
      print_formats: [format],
      available_prints: 3,
      print_description: `Printed on Mat Hahnemühle FineArt Baryta Print on alu-Dibond with Art box & white rand (at the artist's discretion). Format: ${dimensionsStr}. Price: €${finalPrice} incl.`,
      year: metadata.year || null,
      aspect_ratio: metadata.aspectRatio,
      print_editions: {
        L: { total: 5, sold: 0 },
        XL: { total: 3, sold: 0 },
        artist: { total: 2, sold: 0 }
      }
    });
  }

  const existing = await kv.get('gallery:json');
  if (existing) {
    const timestamp = Date.now();
    await kv.set(`gallery:backup:${timestamp}`, existing);
    console.log(`🛟 KV backup saved: gallery:backup:${timestamp}`);
  }

  await kv.set('gallery:json', gallery);
  console.log(`✅ Gallery saved to KV. Total items: ${gallery.length}`);
  return gallery.length;
}

module.exports = updateGallery;
