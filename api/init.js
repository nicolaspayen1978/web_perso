// api/init.js
// Initializes NicoAI for a visitor and preloads resources.
// Also supports resource fetching and returns the chatbot’s first message.

console.log("🔥 API Init is running");

const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = globalThis.fetch || require("node-fetch");

const {
  isNicoAIInitialized,
  markNicoAIInitialized,
  callOpenAI,
  formatLinks
} = require("../utils/utils");

const initApp = express();
initApp.use(express.json());

// ✅ Middleware for CORS — ensures frontend can call this API from any origin
initApp.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end(); // Respond to preflight
  }

  next();
});

// 🌍 Load key resources (once, on startup) to support context-aware responses
let resources = {};
const resourcesPath = path.join(__dirname, "../resources.json");

function loadResources() {
  try {
    if (fs.existsSync(resourcesPath)) {
      resources = JSON.parse(fs.readFileSync(resourcesPath, "utf-8"));
      console.log("✅ Resources loaded successfully");
    } else {
      console.error("❌ resources.json not found!");
    }
  } catch (error) {
    console.error("❌ Error loading resources.json:", error);
  }
}

loadResources(); // Load once at init

// 🚀 Main initialization function for NicoAI when a visitor starts chatting
async function init_NicoAI(visitorID) {
  if (isNicoAIInitialized(visitorID)) {
    console.log(`🔄 NicoAI is already initialized for visitor ${visitorID}`);
    return { message: "NicoAI already initialized for this visitor." };
  }

  console.log(`🚀 Initializing NicoAI for visitor ${visitorID}...`);
  markNicoAIInitialized(visitorID); // Set in-memory flag

  // Multiple system prompts to seed context into the conversation
  const systemPrompts = [
    { role: "system", content: "You are NicoAI, the AI representing Nicolas Payen and acting as his assistant." },
    { role: "system", content: "To get to know Nicolas's life and thinking, a collection of resources is available." },
    { role: "system", content: "Encourage visitors to explore Nicolas's website and published works." },
    { role: "system", content: "If a visitor asks for Nicolas's contact details, refer to the provided contact information." }
  ];

  console.log("📤 Sending system prompts to OpenAI in parallel...");

  let botReply = [];
  try {
    botReply = await Promise.all(systemPrompts.map(prompt => callOpenAI([prompt])));
  } catch (error) {
    console.error("❌ Error during OpenAI initialization:", error);
  }

  // Define the default welcome message (fallback)
  let firstMessage = `👋 Hi! I'm NicoAI, the AI version of Nicolas Payen. How can I help you today?<br>
<span class="chat-note">Note: Nicolas will personally review this conversation later, so you can also use it to leave him a message. Your input will be stored and shared with him.</span>`;

  // Use OpenAI’s reply if available
  if (Array.isArray(botReply) && botReply[0]?.choices?.length > 0) {
    firstMessage = botReply[0].choices[0].message?.content || firstMessage;
  }

  console.log(`✅ NicoAI initialized for visitor ${visitorID}. First message: ${firstMessage}`);

  return { message: firstMessage };
}

// 🔓 POST /api/init — Called by frontend to start a new chat session
initApp.post("/api/init", async (req, res) => {
  const { visitorID } = req.body;
  if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });

  const initResponse = await init_NicoAI(visitorID);
  console.log(`🚀 /api/init executed`);
  res.json(initResponse);
});

// 🔍 Utility: Fetch the HTML/text content of any given external URL
async function fetchDocument(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`⚠️ Failed to fetch document: ${response.statusText}`);
    return await response.text();  // Return text content
  } catch (error) {
    console.error("⚠️ Error fetching document:", error);
    return "I couldn't fetch the document.";
  }
}

// Export app and preload resources for use elsewhere (e.g., chatbot.js)
module.exports = initApp;
module.exports.resources = resources;