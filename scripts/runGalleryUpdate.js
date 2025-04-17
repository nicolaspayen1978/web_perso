// scripts/runGalleryUpdate.js
import updateGallery from '../lib/updateGallery.js';

(async () => {
  try {
    const count = await updateGallery();
    console.log(`✅ Gallery updated with ${count} photos.`);
  } catch (err) {
    console.error("❌ Failed to update gallery:", err);
    process.exit(1);
  }
})();