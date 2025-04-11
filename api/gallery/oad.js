// /api/gallery/load.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { authorization } = req.headers;
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const currentPath = path.join(process.cwd(), 'gallery.json');
    const dir = fs.readdirSync(process.cwd());
    const backups = dir.filter(f => f.startsWith('gallery_backup_') && f.endsWith('.json'))
                       .sort().reverse();
    const lastBackup = backups.length ? fs.readFileSync(path.join(process.cwd(), backups[0]), 'utf-8') : '[]';

    const current = fs.readFileSync(currentPath, 'utf-8');
    res.status(200).json({
      current: JSON.parse(current),
      previous: JSON.parse(lastBackup)
    });
  } catch (err) {
    console.error("❌ Failed to load gallery files:", err);
    res.status(500).json({ error: 'Failed to load gallery files', details: err.message });
  }
}