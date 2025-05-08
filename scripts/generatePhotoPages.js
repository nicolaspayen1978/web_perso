// scripts/generatePhotoPages.js
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

// Required to emulate __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const galleryPath = path.join(__dirname, '..', 'gallery.json');
const outputDir = path.join(__dirname, '..', 'gallery', 'static');

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Prompt before deleting old static pages
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
  rl.close();  // Prevents script from hanging
  run();
}

function run() {
  const galleryRaw = fs.readFileSync(galleryPath, 'utf-8');
  fs.writeFileSync(path.join(__dirname, '..', 'Gallery.backup.json'), galleryRaw); // backup
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

    // [Same HTML template continues unchanged...]
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
  <style>
    a { color: inherit; text-decoration: underline; }
    a:hover { color: #000; }
    .photo-container img { max-width: 100%; height: auto; }
    @media (min-width: 1024px) {
      .photo-container img { max-width: 700px; }
    }
  </style>
  <script type="application/ld+json">
  ${JSON.stringify(structuredData, null, 2)}
  </script>
</head>
<body>
  <!-- [Same body as before, unchanged] -->
  <header style="text-align: center; padding: 1.5rem 1rem 0.5rem;">
    <nav><a href="/gallery.html" style="text-decoration: none; font-size: 0.95rem;">← Back to Gallery</a></nav>
    <h1 style="margin-top: 1rem; font-family: 'Playfair Display', serif; font-weight: 400; font-size: 2.4rem; letter-spacing: 0.03em;">${title}</h1>
    <hr style="width: 60px; margin: 0.5rem auto; opacity: 0.2;">
  </header>
  <main class="photo-page" style="display: flex; flex-wrap: wrap; justify-content: center; padding: 2rem 1rem; gap: 2rem; max-width: 1200px; margin: auto;">
    <div class="photo-container" style="flex: 1 1 400px; max-width: 700px;">
      <img src="/photos/${filename}" alt="${title}" style="width: 100%; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    </div>
    <aside class="photo-info" style="flex: 1 1 300px; font-size: 0.95rem; color: #333; line-height: 1.6;">
      ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
      <h2 style="margin-top: 1.5rem;">Edition Details</h2>
      <ul style="list-style: none; padding-left: 0;">
        <li><strong>Gallery Edition (L):</strong> ${dimensions.L || ''} – ${prices.L || ''} – ${available(editions.L)} available</li>
        <li><strong>Collector Edition (XL):</strong> ${dimensions.XL || ''} – ${prices.XL || ''} – ${available(editions.XL)} available</li>
        <li><strong>Artist’s Proof:</strong> ${available(editions.artist)} available</li>
      </ul>
      <p style="font-size: 0.85rem; color: #666; font-style: italic;">Note: Artist’s proofs may vary in format and support depending on availability and artistic discretion.</p>
      <a href="mailto:hello@nicolaspayen.com?subject=Print Request: ${encodeURIComponent(title)}" class="print-request dark" style="margin-top: 1rem; display: inline-block;">🖨️ Request a print</a>
    </aside>
  </main>
  <div id="chatbot-icon" style="background: #333;"><img src="/images/NicoAvatar.png" alt="Chatbot"></div>
  <div id="chat-popup" style="background: #fefefe; color: #333;">
    <div id="chat-header" style="background: #f8f8f8; color: #444; border-bottom: 1px solid #ddd;">
      <img src="/images/NicoAvatar2.png" alt="AI Nicolas" id="chat-avatar">
      <span>Ask NicoAI about this piece</span>
      <button id="maximize-chat">🔲</button>
      <button id="close-chat">×</button>
    </div>
    <div id="chatbox">
      <div class="chat-note">👋 I'm NicoAI — here to help! Curious about this artwork or how to order a print? Just ask below.</div>
    </div>
    <div id="input-container">
      <input type="text" id="user-input" placeholder="Ask about this photo...">
      <button id="send-button" style="background: #444; border-color: #444;">Send</button>
    </div>
  </div>
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