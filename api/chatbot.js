// api/chatbot.js (Vercel-compatible serverless function)
// This function handles incoming chat requests for NicoAI using OpenAI, dynamic content from resources,
// and optional push notifications when users engage.
//version 0.3

import fs from 'node:fs';
import path from 'node:path';
import { callOpenAI, formatLinks } from '../utils/utils.js';
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

  if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
  if (!userInput) return res.status(400).json({ error: "No user input provided." });

  console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);
  console.log(`🧭 Visitor agent: ${req.headers['user-agent'] || 'unknown'}`);

  if (notifyToday === true) {
    try {
      await notifyNicolas(`📬 Visitor ${visitorID} is engaging with NicoAI today.`);
    } catch (err) {
      console.error("❌ Failed to notify:", err);
    }
  }

  const fullResourceContent = JSON.parse(fs.readFileSync(contentPath, "utf-8"));

  if (!resources || typeof resources !== 'object') {
    console.error("❌ Missing or invalid resources object");
    return res.status(500).json({ error: "Internal server error: Resources not loaded." });
  }

  if (!fullResourceContent || typeof fullResourceContent !== 'object') {
    console.error("❌ Missing or invalid fullResourceContent");
    return res.status(500).json({ error: "Internal server error: Content not loaded." });
  }

  // Get top relevant entries with debug info
  const debugMatches = getRelevantResources(userInput, resources, fullResourceContent, { debug: true });

  // Inject top 3 enriched summaries dynamically
  const topSnippets = [];
  for (let i = 0; i < Math.min(3, debugMatches.length); i++) {
    const match = debugMatches[i];
    const contentEntry = fullResourceContent[match.url];
    if (contentEntry) {
      const bullets = await extractRelevantSummaries(userInput, contentEntry);
      if (bullets.length) {
        topSnippets.push(`From "${match.title}":\n• ${bullets.join('\n• ')}`);
      }
    }
  }

  const dynamicContext = topSnippets.length > 0
    ? `\n\nHere are some relevant focused notes:\n\n${topSnippets.join('\n\n')}`
    : '';

  const systemPrompt = debugMatches.length
    ? {
        role: "system",
        content: `Here are some relevant resources:\n\n${debugMatches.map(m => `From "${m.title}":\n${m.excerpt}`).join("\n\n")}${dynamicContext}\n\nUse them when answering. Keep your response concise and engaging.`
      }
    : {
        role: "system",
        content: "No direct matches found in Nicolas's resources. Please answer using general knowledge, or ask the visitor a clarifying question. Keep your response concise and engaging."
      };

  const aiResponse = await callOpenAI([
    systemPrompt,
    { role: "user", content: userInput }
  ]);

  res.status(200).json({ response: aiResponse });
}
