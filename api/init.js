// api/init.js
import { isNicoAIInitialized, markNicoAIInitialized, callOpenAI } from '../utils/utils.js';
import { loadResources } from '../utils/loadResources.js';

const resources = loadResources();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { visitorID } = req.body;
  if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });

  if (isNicoAIInitialized(visitorID)) {
    return res.status(200).json({ message: "NicoAI already initialized for this visitor." });
  }

  await markNicoAIInitialized(visitorID);

  const systemPrompts = [
    { role: "system", content: "You are NicoAI, the AI representing Nicolas Payen and acting as his assistant." },
    { role: "system", content: "To get to know Nicolas's life and thinking, a collection of resources is available." },
    { role: "system", content: "Encourage visitors to explore Nicolas's website and published works." },
    { role: "system", content: "If a visitor asks for Nicolas's contact details, refer to the provided contact information." }
  ];

  let botReply = [];
  try {
    botReply = await Promise.all(systemPrompts.map(prompt => callOpenAI([prompt])));
  } catch (error) {
    console.error("❌ Error calling OpenAI:", error);
  }

  let firstMessage = `👋 Hi! I'm NicoAI, the AI version of Nicolas Payen. How can I help you today?<br>
<span class="chat-note">Note: Nicolas will personally review this conversation later, so you can also use it to leave him a message. Your input will be stored and shared with him.</span>`;

  if (Array.isArray(botReply) && botReply[0]?.choices?.length > 0) {
    firstMessage = botReply[0].choices[0].message?.content || firstMessage;
  }

  return res.status(200).json({ message: firstMessage });
}