// scripts/validateGallery.js
// This script validates Gallery.json for missing or malformed fields before upload

const fs = require('fs');
const path = require('path');

const galleryPath = path.join(__dirname, '../gallery.json');

if (!fs.existsSync(galleryPath)) {
  console.error('❌ Gallery.json not found!');
  process.exit(1);
}

const gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));

const invalid = gallery.filter(photo => {
  return (
    !photo.filename ||
    typeof photo.filename !== 'string' ||
    photo.filename.trim() === '' ||
    !photo.thumbnail ||
    typeof photo.thumbnail !== 'string' ||
    photo.thumbnail.trim() === '' ||
    typeof photo.width !== 'number' ||
    typeof photo.height !== 'number' ||
    !photo.id ||
    typeof photo.id !== 'string' ||
    photo.id.trim() === ''
  );
});

if (invalid.length > 0) {
  console.warn(`⚠️ Found ${invalid.length} invalid photo entries:`);
  invalid.forEach((p, i) => {
    console.warn(`  #${i + 1}: ID=${p.id || 'N/A'}, filename=${p.filename || 'MISSING'}`);
  });
  process.exit(1);
} else {
  console.log('✅ Gallery.json passed validation. All entries look good.');
}
