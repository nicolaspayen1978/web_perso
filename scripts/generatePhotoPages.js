// scripts/generatePhotoPages.js
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const galleryPath = path.join(__dirname, '..', 'gallery.json');
const outputDir = path.join(__dirname, 'gallery', 'static');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const htmlFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.html'));

if (htmlFiles.length > 0) {
  rl.question(
    `❓ Delete ${htmlFiles.length} existing HTML files in /gallery/static before regenerating? (yes/no): `,
    (answer) => {
      if (answer.trim().toLowerCase() === 'yes') {
        htmlFiles.forEach(file => fs.unlinkSync(path.join(outputDir, file)));
        console.log(`🧹 Deleted ${htmlFiles.length} old HTML files.`);
      } else {
        console.log('⚠️ Skipping HTML cleanup. Existing files may be overwritten.');
      }
      rl.close();
      run();
    }
  );
} else {
  run();
}

function run() {
  const galleryRaw = fs.readFileSync(galleryPath, 'utf-8');
  fs.writeFileSync(path.join(__dirname, 'Gallery.backup.json'), galleryRaw); // backup
  const gallery = JSON.parse(galleryRaw);

  const updatedGallery = [];

  const template = (photo, slug) => {
    const title = photo.title || photo.filename;
    const filename = photo.filename.trim().replace(/[\\s_]+$/g, '');
    const description = photo.description || '';
    const dimensions = photo.dimensions || {};
    const prices = photo.price_details || {};
    const editions = photo.print_editions || {};
    const available = (e) =>
      e?.total && e?.sold >= 0 ? `${e.total - e.sold}/${e.total}` : '';

    const cleanPrice = (str) => {
      const match = (str || '').match(/\d+(\.\d+)?/);
      return match ? match[0] : '';
    };

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "VisualArtwork",
      "name": title,
      "creator": { "@type": "Person", "name": "Nicolas Payen" },
      "image": `https://web-perso.vercel.app/photos/${filename}`,
      "description": description,
      "artform": "Photography",
      "artMedium": "Fine art print",
      "artEdition": "Limited edition",
      "productionDate": "2023",
      "offers": []
    };

    if (prices.L) {
      structuredData.offers.push({
        "@type": "Offer",
        "priceCurrency": "EUR",
        "price": cleanPrice(prices.L),
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "name": "Gallery Edition (L)"
      });
    }

    if (prices.XL) {
      structuredData.offers.push({
        "@type": "Offer",
        "priceCurrency": "EUR",
        "price": cleanPrice(prices.XL),
        "availability": "https://schema.org/InStock",
        "itemCondition": "https://schema.org/NewCondition",
        "name": "Collector Edition (XL)"
      });
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description.slice(0, 160)}">
  <meta name="author" content="Nicolas Payen">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://web-perso.vercel.app/gallery/static/${slug}.html">
  <meta property="og:title" content="${title} – Limited Edition Print by Nicolas Payen">
  <meta property="og:description" content="${description.slice(0, 160)}">
  <meta property="og:image" content="https://web-perso.vercel.app/photos/${filename}">
  <meta property="og:url" content="https://web-perso.vercel.app/gallery/static/${slug}.html">
  <title>${title} | Limited Edition Print</title>
  <link rel="stylesheet" href="/gallery-styles.css">
  <link rel="stylesheet" href="/chatbot.css">
  <script type="application/ld+json">
  ${JSON.stringify(structuredData, null, 2)}
  </script>
</head>
<body>
  <header>
    <nav><a href="/gallery.html">← Back to Gallery</a></nav>
    <h1>${title}</h1>
  </header>
  <main>
    <div><img src="/photos/${filename}" alt="${title}"></div>
    <aside>
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <h2>Edition Details</h2>
      <ul>
        <li><strong>Gallery Edition (L):</strong> ${dimensions.L || ''} – ${prices.L || ''} – ${available(editions.L)} available</li>
        <li><strong>Collector Edition (XL):</strong> ${dimensions.XL || ''} – ${prices.XL || ''} – ${available(editions.XL)} available</li>
        <li><strong>Artist’s Proof:</strong> ${available(editions.artist)} available</li>
      </ul>
      <a href="mailto:hello@nicolaspayen.com?subject=Print Request: ${encodeURIComponent(title)}">🖨️ Request a print</a>
    </aside>
  </main>
  <footer><p>&copy; <span id="year"></span> Nicolas Payen. All rights reserved.</p></footer>
  <script>document.getElementById("year").textContent = new Date().getFullYear();</script>
  <script src="/chatbot.js"></script>
</body>
</html>`;
  };

  console.log(`📸 Starting static page generation for ${gallery.length} photos...`);
  gallery.forEach((photo, index) => {
    if (photo.visible === false) {
      console.log(`⛔ [${photo.id}] Skipped (not visible)`);
      return;
    }

    if (!photo.filename || !photo.id) {
      console.warn(`⚠️ [${photo.id}] Missing filename or id — skipping`);
      return;
    }

    console.log(`📄 [${index + 1}] Generating page for: ${photo.id}`);
    console.log(`    → Title       : "${photo.title}"`);
    console.log(`    → Description : "${photo.description}"`);
    console.log(`    → Tags        : ${(photo.tags || []).join(', ')}`);
    console.log(`    → Exhibitions : ${(photo.exhibitions || []).join(', ')}`);

    const html = template(photo, photo.id);
    fs.writeFileSync(path.join(outputDir, `${photo.id}.html`), html, 'utf-8');
    updatedGallery.push(photo);
  });

  console.log(`✅ Generated ${updatedGallery.length} static photo pages.`);
}