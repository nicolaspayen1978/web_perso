// scripts/runGalleryUpdate.js
// This script runs the gallery update logic and logs the result

import updateGallery from '../lib/updateGallery.js';

if (!Array.isArray(previous)) {
  console.warn("⚠️ gallery:json is not an array (inside updateGallery). Skipping update.");
  return 0;
}

try {
  const count = await updateGallery();
  console.log(`✅ Gallery updated with ${count} photos.`);
} catch (err) {
  console.error("❌ Failed to update gallery:", err);
  process.exit(1);
}