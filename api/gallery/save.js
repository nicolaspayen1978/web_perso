// /api/gallery/save.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { json } = req.body;
    const galleryPath = path.join(process.cwd(), 'gallery.json');

    // Validate structure (light)
    if (!Array.isArray(json)) {
      return res.status(400).json({ error: 'Invalid format. Expected an array.' });
    }

    fs.writeFileSync(galleryPath, JSON.stringify(json, null, 2));
    res.status(200).json({ message: 'gallery.json saved successfully.' });
  } catch (err) {
    console.error("❌ Failed to save gallery.json:", err);
    res.status(500).json({ error: 'Save failed', details: err.message });
  }
}