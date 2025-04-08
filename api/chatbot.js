// This api/chatbot.js the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available 
console.log("🔥 API chatbot is running");
const fs = require("fs");
const path = require("path");
const express = require('express');
const { callOpenAI, formatLinks } = require("../utils/utils"); // Import from utils.js
const initApp = require("./init");  // import from Init.js
const { resources } = require("./init");  // import from Init.js
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
    const { visitorID, userInput } = req.body;

    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
    if (!userInput) return res.status(400).json({ error: "No user input provided." });

    console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);

    // Use resources from init.js instead of fetching them separately
    const systemPrompt = {
        role: "system",
        content: `Here are Nicolas's key resources: ${JSON.stringify(resources)}. Use them when relevant in responses. Keep answer in 100-125 words max. If you don't know yet the identity of this user please ask for it, ask for its contact details, and ask for the reason of his/her visit to the website. Never ask these information more than two times.`
    };

    const aiResponse = await callOpenAI([systemPrompt, { role: "user", content: userInput }]);

    res.json({ response: aiResponse });
});

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

// Export the app for Vercel
module.exports = chatApp;



