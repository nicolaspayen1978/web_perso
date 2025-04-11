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
const { v4: uuidv4 } = require('uuid');

// Define core paths
const PHOTOS_DIR = path.join(__dirname, 'photos');             // Medium images
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');            // Thumbnails
const GALLERY_FILE = path.join(__dirname, 'gallery.json');     // Output file
const GALLERY_BACKUP = path.join(__dirname, `gallery_backup_${Date.now()}.json`); // Timestamped backup

// Suggest print formats based on aspect ratio
function getPrintFormats(width, height) {
  if (!width || !height) return [];
  const ratio = width / height;
  if (ratio > 1.2) return ["30x40", "50x70"];
  if (ratio < 0.8) return ["30x30", "50x50"];
  return ["30x45", "60x90"];
}

// Simple price estimation based on image area
function estimatePrice(width, height, scale = 0.1) {
  if (!width || !height) return 0;
  const area = width * height;
  return Math.round(area * scale / 1000); // € estimation
}

// Extract EXIF and dimensions from image
async function extractMetadata(filePath) {
  let metadata = {};
  let buffer;

  try {
    buffer = fs.readFileSync(filePath);
  } catch (err) {
    console.error(`❌ Failed to read file ${filePath}:`, err.message);
    return metadata;
  }

  // Try to extract EXIF year
  try {
    const parser = exifParser.create(buffer);
    const result = parser.parse();
    if (result.tags?.DateTimeOriginal) {
      metadata.year = new Date(result.tags.DateTimeOriginal * 1000).getFullYear();
    }
  } catch (err) {
    console.warn(`⚠️ No EXIF date found in ${filePath}`);
  }

  // Try to extract dimensions
  try {
    const image = sharp(buffer);
    const { width, height } = await image.metadata();
    metadata.width = width;
    metadata.height = height;
    metadata.aspectRatio = width && height ? +(width / height).toFixed(2) : null;
  } catch (err) {
    console.error(`❌ Could not get image dimensions for ${filePath}:`, err.message);
  }

  return metadata;
}

// Build the new gallery list
async function buildGallery() {
  // Ensure the folders exist
  if (!fs.existsSync(PHOTOS_DIR) || !fs.existsSync(THUMBS_DIR)) {
    console.error("❌ photos/ or photos/thumbs/ directory does not exist.");
    process.exit(1);
  }

  const mediumFiles = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g)$/i.test(f));
  const thumbFiles = fs.readdirSync(THUMBS_DIR).filter(f => /\.(jpe?g)$/i.test(f));
  const validFiles = mediumFiles.filter(file => thumbFiles.includes(file));

  console.log(`🖼️ Found ${validFiles.length} valid image pairs`);

  const gallery = [];

  for (const file of validFiles) {
    const filePath = path.join(PHOTOS_DIR, file);
    const metadata = await extractMetadata(filePath);

    // Skip invalid images
    if (!metadata.width || !metadata.height) {
      console.warn(`⏭️ Skipping ${file} due to missing metadata`);
      continue;
    }

    // Format title from filename
    const title = path.parse(file).name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());

    const print_formats = getPrintFormats(metadata.width, metadata.height);
    const priceEstimate = estimatePrice(metadata.width, metadata.height);

    gallery.push({
      id: path.parse(file).name,
      filename: file,
      thumbnail: `thumbs/${file}`,
      title,
      location: "", // You can fill this later
      description: "", // Optional
      print_formats,
      available_prints: 3,
      print_description: `Printed on Hahnemühle FineArt Baryta, signed and numbered. Estimated price: €${priceEstimate}.`,
      year: metadata.year || null,
      aspect_ratio: metadata.aspectRatio
    });
  }

  return gallery;
}

// Entry point: build gallery and save JSON
async function run() {
  try {
    const newGallery = await buildGallery();

    // Create a backup if the gallery file exists
    if (fs.existsSync(GALLERY_FILE)) {
      fs.copyFileSync(GALLERY_FILE, GALLERY_BACKUP);
      console.log(`🛟 Backup created: ${path.basename(GALLERY_BACKUP)}`);
    }

    fs.writeFileSync(GALLERY_FILE, JSON.stringify(newGallery, null, 2));
    console.log(`✅ gallery.json updated with ${newGallery.length} items`);
  } catch (err) {
    console.error("❌ Fatal error during gallery update:", err);
  }
}

run();