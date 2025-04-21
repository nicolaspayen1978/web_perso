// scripts/validateGallery.js
// This script validates gallery.json for missing or malformed fields before upload
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Emulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const galleryPath = path.join(__dirname, '../gallery.json');

if (!fs.existsSync(galleryPath)) {
  console.error('❌ gallery.json not found!');
  process.exit(1);
}

let gallery = JSON.parse(fs.readFileSync(galleryPath, 'utf-8'));

// Ensure top-level array
if (!Array.isArray(gallery)) {
  if (gallery?.result && Array.isArray(gallery.result)) {
    console.warn("⚠️ gallery.json is wrapped inside { result }. Unwrapping...");
    gallery = gallery.result;
  } else {
    console.error('❌ gallery.json must be a JSON array at the top level.');
    process.exit(1);
  }
}

// Validate each entry
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
  console.warn(`⚠️ Found ${invalid.length} invalid photo entr${invalid.length > 1 ? 'ies' : 'y'}:`);
  invalid.forEach((p, i) => {
    console.warn(`  #${i + 1}: ID=${p.id || 'N/A'}, filename=${p.filename || 'MISSING'}`);
    // Uncomment to debug full objects:
    // console.warn('  Invalid object:', JSON.stringify(p, null, 2));
  });
  process.exit(1);
} else {
  console.log('✅ gallery.json passed validation. All entries look good.');
}

// Additional check: Scan for non-ASCII characters in raw JSON
const rawContent = fs.readFileSync(galleryPath, 'utf-8').split('\n');
let unicodeWarnings = 0;

rawContent.forEach((line, index) => {
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const code = char.charCodeAt(0);
    if (code > 127) {
      const hex = code.toString(16).toUpperCase().padStart(4, '0');
      // Uncomment to show details:
      // console.warn(`❗ Unicode on line ${index + 1}, column ${i + 1}: '${char}' (U+${hex})`);
      unicodeWarnings++;
    }
  }
});

if (unicodeWarnings > 0) {
  console.warn(`⚠️ Detected ${unicodeWarnings} non-ASCII characters in gallery.json`);
} else {
  console.log('✅ No non-ASCII characters detected.');
}