// api/gallery/run-update.js
import updateGallery from '../../lib/updateGallery.js';

export default async function handler(req, res) {
  const { authorization } = req.headers;

  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const count = await updateGallery();
    res.status(200).json({ message: `Gallery updated with ${count} photos.` });
  } catch (err) {
    console.error("❌ updateGallery failed:", err);
    res.status(500).json({ error: "Gallery update failed", details: err.message });
  }
}