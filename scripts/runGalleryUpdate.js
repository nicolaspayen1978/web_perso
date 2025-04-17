// scripts/runGalleryUpdate.js
// This script runs the gallery update logic and logs the result

import updateGallery from '../lib/updateGallery.js';

try {
  const count = await updateGallery();
  console.log(`✅ Gallery updated with ${count} photos.`);
} catch (err) {
  console.error("❌ Failed to update gallery:", err);
  process.exit(1);
}