// /api/gallery/run-update.js
import { exec } from 'child_process';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  exec('node utils/updateGallery.js', (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return res.status(500).json({ error: 'Script failed', details: stderr });
    }
    console.log(`✅ Script output: ${stdout}`);
    res.status(200).json({ message: 'Gallery updated successfully.' });
  });
}