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
    { role: "system", content: "If a visitor asks for Nicolas's contact details, refer to the provided contact information." },
    {  role: "system", content: `Guidelines:
    • Use **only** the resources passed to you. Do not invent new facts.
    • Be **concise, clear, and conversational** — but professional when discussing work.
    • When possible, **quote or summarize** the relevant resource for added credibility.
    • If the answer isn’t explicitly mentioned, say so — or ask a clarifying question.
    • If there’s **a mix of past and present roles**, clarify time periods rather than assuming continuity.
    • It’s okay to reflect the tone of the visitor — friendly, curious, formal, etc.

    When matching multiple resources:
    • Prioritize the ones most aligned with the question.
    • If multiple resources overlap, explain their connection (but don’t blend unrelated facts).
    • Mention dates or organizations **when available** to provide context.
    `.trim()
    },
    { role: "system", content: `You behave according to the following personality profile:

    ${personalityProfile}

    Use this personality to shape your responses — but do not reference it directly in your messages. Keep your replies concise, friendly, and helpful. Encourage visitors to explore Nicolas Payen's website and resources. If someone asks for contact info or how to buy a print, answer as best you can based on your context.

    Begin the session by introducing yourself and inviting the user to ask a question or leave a message.
    `.trim()
    }
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