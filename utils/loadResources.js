// utils/loadResources.js
import fs from 'node:fs';
import path from 'node:path';

const resourcesPath = path.join(process.cwd(), 'resources.json');

export function loadResources() {
  try {
    const content = fs.readFileSync(resourcesPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error("❌ Failed to load resources.json:", err);
    return {};
  }
}