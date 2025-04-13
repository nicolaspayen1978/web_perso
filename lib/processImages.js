/**
 * processImages.js
 *
 * This script checks /photos/originals for new JPEGs and generates:
 * - medium versions saved in /photos
 * - thumbnail versions saved in /photos/thumbs
 *
 * Skips files that already exist in output folders.
 * Uses Sharp for resizing.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ORIGINALS_DIR = path.join(process.cwd(), 'photos', 'originals');
const MEDIUM_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(MEDIUM_DIR, 'thumbs');

// Max dimensions
const MEDIUM_SIZE = 1600;
const THUMB_SIZE = 300;

function getBaseName(file) {
  return path.parse(file).name;
}

async function generateResizedVersions(file) {
  const inputPath = path.join(ORIGINALS_DIR, file);
  const outputMedium = path.join(MEDIUM_DIR, file);
  const outputThumb = path.join(THUMBS_DIR, file);

  const image = sharp(inputPath);
  const { width, height } = await image.metadata();
  const isLandscape = width >= height;

  if (!fs.existsSync(outputMedium)) {
    await image
      .resize(isLandscape ? MEDIUM_SIZE : null, isLandscape ? null : MEDIUM_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toFile(outputMedium);
    console.log(`✅ Medium image created: ${file}`);
  }

  if (!fs.existsSync(outputThumb)) {
    await image
      .resize(isLandscape ? THUMB_SIZE : null, isLandscape ? null : THUMB_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 70 })
      .toFile(outputThumb);
    console.log(`✅ Thumbnail created: ${file}`);
  }
}

async function processImages() {
  if (!fs.existsSync(ORIGINALS_DIR)) throw new Error('Missing originals folder.');
  if (!fs.existsSync(MEDIUM_DIR)) fs.mkdirSync(MEDIUM_DIR, { recursive: true });
  if (!fs.existsSync(THUMBS_DIR)) fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const originals = fs.readdirSync(ORIGINALS_DIR).filter(f => /\.jpe?g$/i.test(f));

  const processed = [];
  for (const file of originals) {
    const mediumExists = fs.existsSync(path.join(MEDIUM_DIR, file));
    const thumbExists = fs.existsSync(path.join(THUMBS_DIR, file));
    if (!mediumExists || !thumbExists) {
      await generateResizedVersions(file);
      processed.push(file);
    }
  }

  return processed;
}

module.exports = processImages;
