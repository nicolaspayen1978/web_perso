/**
 * updateGallery.js
 * 
 * This script scans the /photos and /photos/thumbs directories for matching image pairs,
 * extracts EXIF metadata and dimensions from the medium-sized images,
 * calculates aspect ratios, suggests print formats, and estimates print prices.
 * 
 * It builds a fresh gallery.json file containing only valid image entries and backs up
 * the previous version before overwriting it.
 * 
 * Intended for use on the server to keep the photo gallery in sync automatically.
 * 
 * Requires: sharp, exif-parser, uuid
 * Run with: node utils/updateGallery.js
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const exifParser = require('exif-parser');

const PHOTOS_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');
const GALLERY_FILE = path.join(process.cwd(), 'gallery.json');
const GALLERY_BACKUP = path.join(process.cwd(), `gallery_backup_${Date.now()}.json`);

function getPrintFormats(width, height) {
  const ratio = width / height;
  if (ratio > 1.2) return ["30x40", "50x70"];
  if (ratio < 0.8) return ["30x30", "50x50"];
  return ["30x45", "60x90"];
}

function estimatePrice(width, height, scale = 0.1) {
  const area = width * height;
  return Math.round(area * scale / 1000);
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
  } catch (e) {}

  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  metadata.width = width;
  metadata.height = height;
  metadata.aspectRatio = +(width / height).toFixed(2);

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

  if (fs.existsSync(GALLERY_FILE)) {
    fs.copyFileSync(GALLERY_FILE, GALLERY_BACKUP);
  }

  fs.writeFileSync(GALLERY_FILE, JSON.stringify(gallery, null, 2));
  return gallery.length;
}

module.exports = updateGallery;