// scripts/runGalleryUpdate.js
import updateGallery from '../lib/updateGallery.js';

updateGallery().then(count => {
  console.log(`✅ Updated gallery.json with ${count} items`);
}).catch(err => {
  console.error("❌ Update failed:", err);
});