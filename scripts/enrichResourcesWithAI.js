// script/enrichResourcesWithAI.js
// Enriches each entry in resourcesContent.json with AI-generated summary, keywords, and entities

import fs from 'fs';
import path from 'path';

if (process.env.VERCEL !== '1') {
  const { config } = await import('dotenv');
  config();
}

import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OpenAI API Key");
  process.exit(1);
}

const INPUT = path.join(process.cwd(), 'resourcesContent.json');
const OUTPUT = path.join(process.cwd(), 'resourcesContent.enriched.json');
const PROGRESS = path.join(process.cwd(), 'resourcesContent.progress.json');

const data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
const alreadyProcessed = fs.existsSync(PROGRESS)
  ? JSON.parse(fs.readFileSync(PROGRESS, 'utf-8'))
  : {};

const enriched = { ...alreadyProcessed };

async function enrichEntry(title, content, retries = 3) {
  const prompt = `
You are a smart AI content indexer.

Given the following article, extract:
- A short summary (1–3 sentences)
- A list of 5–10 keywords (short terms or themes)
- A list of named entities (people, organizations, places, etc.)

Respond in JSON format with fields: "summary", "keywords", "entities".

Title: ${title}

Content:
${content.slice(0, 3000)}
  `.trim();

  while (retries > 0) {
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      });
      return JSON.parse(res.choices[0].message.content);
    } catch (e) {
      console.warn(`⚠️ Retry due to error (${3 - retries + 1}/3):`, e.message);
      retries--;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('❌ Failed after 3 retries for:', title);
  return { summary: '', keywords: [], entities: [] };
}

(async () => {
  const total = Object.keys(data).length;
  let count = 0;

  for (const [url, entry] of Object.entries(data)) {
    if (enriched[url]) {
      count++;
      continue; // Skip already processed
    }

    console.log(`🔍 [${count + 1}/${total}] Enriching ${url}...`);
    const aiData = await enrichEntry(entry.title, entry.content);

    enriched[url] = {
      ...entry,
      ...aiData
    };

    // Save partial progress after each entry
    fs.writeFileSync(PROGRESS, JSON.stringify(enriched, null, 2), 'utf-8');

    count++;
    await new Promise(r => setTimeout(r, 1500));
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(enriched, null, 2), 'utf-8');
  console.log(`✅ Done. Saved ${Object.keys(enriched).length} entries to ${OUTPUT}`);
})();
