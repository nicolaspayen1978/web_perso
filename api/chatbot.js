// This api/chatbot.js the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available
console.log("🔥 API chatbot is running");
const fs = require("fs");
const path = require("path");
const express = require('express');
const { callOpenAI, formatLinks } = require("../utils/utils"); // Import from utils.js
const { initApp, resources } = require("./init"); // ✅ No conflict
const app = express();

app.use(express.json());

// Handle CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "https://nicolaspayen1978.github.io");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    next();
});

// Load resources ONCE when `chatbot.js` starts
let resources = {};
const resourcesPath = path.join(__dirname, "../resources.json");

function loadResources() {
    try {
        if (fs.existsSync(resourcesPath)) {
            resources = JSON.parse(fs.readFileSync(resourcesPath, "utf-8"));
            console.log("✅ Resources loaded successfully in chatbot.js");
        } else {
            console.error("❌ resources.json not found!");
        }
    } catch (error) {
        console.error("❌ Error loading resources.json:", error);
    }
}
loadResources(); // Load resources at startup

// API Endpoint to Handle Chat
app.post('/api/chatbot', async (req, res) => {
    const { visitorID, userInput } = req.body;

    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
    if (!userInput) return res.status(400).json({ error: "No user input provided." });

    console.log(`🚀 /api/chatbot executed for visitor ${visitorID}`);

    // Use resources from init.js instead of fetching them separately
    const systemPrompt = {
        role: "system",
        content: `Here are Nicolas's key resources: ${JSON.stringify(resources)}. Use them when relevant in responses.`
    };

    const aiResponse = await callOpenAI([systemPrompt, { role: "user", content: userInput }]);

    res.json({ response: aiResponse });
});

// Start the Express server
// ONLY start server when running locally
if (process.env.NODE_ENV !== "vercel") {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

async function generateChatResponse(userMessages) {
    console.log("🔍 Using preloaded resources from init.js before generating response...");
    
    const systemMessage = {
        role: "system",
        content: `Here are Nicolas's key resources: ${JSON.stringify(resources)}. Use them when relevant in responses.`
    };

    const fullUserMessages = [systemMessage, { role: "user", content: userMessages }];
    console.log("📚 Sending prompt to OpenAI:\n", fullUserMessages);

    return await callOpenAI(fullUserMessages);
}

// Export the app for Vercel
module.exports = { chatbotApp: app };



