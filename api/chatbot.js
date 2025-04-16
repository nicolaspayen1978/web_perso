// This api/chatbot.js is the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available 

console.log("🔥 API chatbot is running");

const fs = require("fs");
const path = require("path");
const express = require('express');
const { callOpenAI, formatLinks } = require("../utils/utils"); // Import from utils.js
const initApp = require("./init");  // import from init.js
const { resources } = require("./init");  // import preloaded resources
const notifyNicolas = require("../utils/notify"); // 🔔 Import the Pushover notification helper
const contentPath = path.join(__dirname, "../resourcesContent.json");
const { getRelevantResources } = require("../utils/resourceMatcher");

const chatApp = express();
chatApp.use(express.json());

// Handle CORS
chatApp.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    next();
});

// API Endpoint to Handle Chat
chatApp.post('/api/chatbot', async (req, res) => {
    // Destructure and assign request fields with fallback values
    const {
        visitorID,
        userInput,
        previousMessages = [],
        notifyToday
    } = req.body;

    // Basic validation
    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
    if (!userInput) return res.status(400).json({ error: "No user input provided." });

    console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);

    // Optional: log visitor's user agent (helps with context or abuse debugging)
    const userAgent = req.headers['user-agent'] || 'unknown';
    console.log(`🧭 Visitor agent: ${userAgent}`);

    // Strict boolean check to avoid unwanted notification triggers
    const shouldNotify = notifyToday === true;

    // Robust push notification with fail-safe
    if (shouldNotify) {
        try {
            await notifyNicolas(`📬 Visitor ${visitorID} is engaging with NicoAI today.`);
        } catch (error) {
            console.error("❌ Failed to send Pushover notification:", error);
            // Don't block the response to the user
        }
    }

    const fullResourceContent = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
    const matchingContent = getRelevantResources(userInput, resources, fullResourceContent);

    let systemPrompt;

    if (!matchingContent.trim()) {
        systemPrompt = {
            role: "system",
            content: "No direct matches found in Nicolas's resources. Please answer using general knowledge, or ask the visitor a clarifying question. Keep your response concise and engaging."
        };
    } else {
        systemPrompt = {
            role: "system",
            content: `Here are some relevant resources:\n\n${matchingContent}\n\nUse them when answering. Keep your response concise and engaging.`
        };
    }

    // Generate OpenAI response using system + user message
    const aiResponse = await callOpenAI([
        systemPrompt,
        { role: "user", content: userInput }
    ]);

    // Return response to frontend
    res.json({ response: aiResponse });
});

// Optional: helper function (unused for now)
async function generateChatResponse(userMessages) {
    console.log("🔍 Using preloaded resources from init.js before generating response...");
    
    const systemMessage = {
        role: "system",
        content: `Here are Nicolas's key resources: ${JSON.stringify(resources)}. Use them when relevant in responses. Keep answer in 100 words max (excluding links). If you don't know yet the identity of this user please ask for it, ask for its contact details, and ask for the reason of his/her visit to the website.`
    };

    const fullUserMessages = [systemMessage, { role: "user", content: userMessages }];
    console.log("📚 Sending prompt to OpenAI:\n", fullUserMessages);

    return await callOpenAI(fullUserMessages);
}

// Export the app for Vercel deployment
module.exports = chatApp;