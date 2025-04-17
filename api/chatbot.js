// api/chatbot.js (Vercel-compatible serverless function)
// This function handles incoming chat requests for NicoAI using OpenAI, dynamic content from resources,
// and optional push notifications when users engage.
//version 0.1

import fs from 'node:fs';
import path from 'node:path';
import { callOpenAI, formatLinks } from '../utils/utils.js';
import notifyNicolas from '../utils/notify.js';
import { loadResources } from '../utils/loadResources.js';
import { getRelevantResources } from '../utils/resourceMatcher.js';

const resources = loadResources();
// Path to the preprocessed full content from resources.json
const contentPath = path.join(process.cwd(), 'resourcesContent.json');

// The main API handler function for Vercel serverless
export default async function handler(req, res) {

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  // Allow CORS for actual POST requests
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Vercel requires explicit handling of allowed HTTP methods
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // Extract fields from incoming JSON request body
  const {
    visitorID,
    userInput,
    previousMessages = [],
    notifyToday
  } = req.body;

  // Validate essential input
  if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
  if (!userInput) return res.status(400).json({ error: "No user input provided." });

  console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);
  console.log(`🧭 Visitor agent: ${req.headers['user-agent'] || 'unknown'}`);

  // Optional: Send push notification if requested
  if (notifyToday === true) {
    try {
      await notifyNicolas(`📬 Visitor ${visitorID} is engaging with NicoAI today.`);
    } catch (err) {
      console.error("❌ Failed to notify:", err);
      // Note: This doesn't block the rest of the response
    }
  }

  // Load the full resource content (with text and summaries) from disk
  const fullResourceContent = JSON.parse(fs.readFileSync(contentPath, "utf-8"));

  // Try to match the user's input with relevant resources
  const matchingContent = getRelevantResources(userInput, resources, fullResourceContent);

  // Craft the system prompt depending on whether any matches were found
  const systemPrompt = matchingContent.trim()
    ? {
        role: "system",
        content: `Here are some relevant resources:\n\n${matchingContent}\n\nUse them when answering. Keep your response concise and engaging.`
      }
    : {
        role: "system",
        content: "No direct matches found in Nicolas's resources. Please answer using general knowledge, or ask the visitor a clarifying question. Keep your response concise and engaging."
      };

  // Call OpenAI with the constructed prompt + user input
  const aiResponse = await callOpenAI([
    systemPrompt,
    { role: "user", content: userInput }
  ]);

  // Return the AI's response to the frontend
  res.status(200).json({ response: aiResponse });
}