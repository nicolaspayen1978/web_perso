// api/chatbot.js (Vercel-compatible serverless function)
// Handles incoming chat requests for NicoAI using OpenAI, static summaries, enriched snippets, and push notification support.
// version 0.4 hybrid context
import fs from 'node:fs';
import path from 'node:path';
import { callOpenAI } from '../utils/utils.js';
import notifyNicolas from '../utils/notify.js';
import { loadResources } from '../utils/loadResources.js';
import { getRelevantResources } from '../utils/resourceMatcher.js';
import { extractRelevantSummaries } from '../utils/extractRelevantSummaries.js';

const resources = loadResources();
const contentPath = path.join(process.cwd(), 'resourcesContent.json');

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const {
    visitorID,
    userInput,
    previousMessages = [],
    notifyToday
  } = req.body;

  if (!visitorID) return res.status(400).json({ error: 'Missing visitorID.' });
  if (!userInput) return res.status(400).json({ error: 'No user input provided.' });

  console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);
  console.log(`🧭 Visitor agent: ${req.headers['user-agent'] || 'unknown'}`);

  if (notifyToday === true) {
    try {
      await notifyNicolas(`📬 Visitor ${visitorID} is engaging with NicoAI today.`);
    } catch (err) {
      console.error('❌ Failed to notify:', err);
    }
  }

  let fullResourceContent;
  try {
    fullResourceContent = JSON.parse(fs.readFileSync(contentPath, 'utf-8'));
  } catch (e) {
    console.error("❌ Failed to load fullResourceContent:", e.message);
    return res.status(500).json({ error: "Internal error loading enriched resources" });
  }

  if (!resources || typeof resources !== 'object') {
    console.error('❌ Missing or invalid resources object');
    return res.status(500).json({ error: 'Internal server error: Resources not loaded.' });
  }

  // 🧠 Use matcher to get top 5 resources
  const debugMatches = getRelevantResources(userInput, resources, fullResourceContent, { debug: true });

  // ✨ Enriched bullets from top matches
  const topSnippets = [];
  for (let i = 0; i < Math.min(5, debugMatches.length); i++) {
    const match = debugMatches[i];
    const contentEntry = fullResourceContent[match.url];
    if (contentEntry) {
      const bullets = await extractRelevantSummaries(userInput, contentEntry);
      if (bullets.length) {
        topSnippets.push(`From "${match.title}":\n• ${bullets.join('\n• ')}`);
      }
    }
  }

  const dynamicContext = topSnippets.length
    ? `\n\nHere are some resource-specific highlights:\n\n${topSnippets.join('\n\n')}`
    : '';

  // 📚 Include all summary entries from resources.json
  //flatten resources.family, resources.friends, etc. into bullet summaries and append them to the system prompt
  const baseSummaries = [
  ...Object.entries(resources)
    .flatMap(([category, items]) =>
      Array.isArray(items)
        ? items.map(entry => {
            const date = entry.date ? ` (${entry.date})` : '';
            return `• ${entry.title}${date}: ${entry.description || '(no description)'}`;
          })
        : []
    ),
  ...Object.entries(resources.family || {}).map(
    ([relation, text]) => `• ${relation}: ${text}`
  ),
  ...Object.entries(resources.friends || {}).map(
    ([name, text]) => `• ${name}: ${text}`
  )
].join('\n');

  const systemPrompt = {
    role: 'system',
    content: `You are NicoAI, an assistant for Nicolas Payen. Use the following resources to help answer the user's question.

Available summaries:
${baseSummaries}
${dynamicContext}

Respond in a clear, helpful, and engaging tone. If the answer is not found in the resources, say so or ask a clarifying question.`
  };

  const aiResponse = await callOpenAI([
    systemPrompt,
    { role: 'user', content: userInput }
  ]);

  res.status(200).json({ response: aiResponse });
}