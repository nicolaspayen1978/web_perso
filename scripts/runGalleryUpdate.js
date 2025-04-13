import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import updateGallery from '../lib/updateGallery.js';

// Directories
const ORIGINALS_DIR = path.join(process.cwd(), 'photos/originals');
const MEDIUM_DIR = path.join(process.cwd(), 'photos');
const THUMBS_DIR = path.join(process.cwd(), 'photos/thumbs');

/**
 * Resize images from the originals/ directory into:
 * - medium versions (max 2048px longest side)
 * - thumbnails (max 400px longest side)
 * Output files have the same name and are saved to photos/ and photos/thumbs/
 */
async function processImages() {
  const files = fs.readdirSync(ORIGINALS_DIR).filter(f => /\.(jpe?g)$/i.test(f));

  for (const file of files) {
    const originalPath = path.join(ORIGINALS_DIR, file);
    const mediumPath = path.join(MEDIUM_DIR, file);
    const thumbPath = path.join(THUMBS_DIR, file);

    try {
      const image = sharp(originalPath);
      const metadata = await image.metadata();
      const { width, height } = metadata;
      const isLandscape = width >= height;

      // Resize to medium (max 2048px longest side)
      const mediumSize = isLandscape ? { width: 2048 } : { height: 2048 };
      await image.resize(mediumSize).toFile(mediumPath);

      // Resize to thumbnail (max 400px longest side)
      await image.resize({ width: isLandscape ? 400 : null, height: isLandscape ? null : 400 }).toFile(thumbPath);

      console.log(`✅ Processed: ${file}`);
    } catch (err) {
      console.error(`❌ Failed to process ${file}:`, err.message);
    }
  }
}

export default async function handler(req, res) {
  try {
    await processImages();
    const count = await updateGallery();
    return res.status(200).json({ message: `Gallery updated with ${count} photos.` });
  } catch (err) {
    console.error("❌ Failed to update gallery:", err);
    return res.status(500).json({ error: 'Gallery update failed', details: err.message });
  }
}