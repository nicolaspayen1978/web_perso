console.log("🔥 API Init is running");
const express = require("express");
const fs = require("fs");
const path = require("path"); 
const { isNicoAIInitialized, markNicoAIInitialized, callOpenAI, formatLinks} = require("../utils/utils"); // Import from utils.js
const initApp = express();

// Ensure fetch() is available in Node.js
const fetch = globalThis.fetch || require("node-fetch");

initApp.use(express.json());


// ✅ CORS Middleware - Add this BEFORE defining `/api/init`
initApp.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end(); // Handle preflight request
    }
    next();
});

// Load resources once at startup
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

loadResources();  // Load once on startup

// ************** Initiate NicoAI for a visitor **************
async function init_NicoAI(visitorID) {
    if (isNicoAIInitialized(visitorID)) {
        console.log(`🔄 NicoAI is already initialized for visitor ${visitorID}`);
        return { message: "NicoAI already initialized for this visitor." };
    }

    console.log(`🚀 Initializing NicoAI for visitor ${visitorID}...`);
    markNicoAIInitialized(visitorID);

    const systemPrompts = [
        { role: "system", content: "You are NicoAI, the AI representing Nicolas Payen and acting as his assistant." },
        { role: "system", content: "To get to know Nicolas's life and thinking, a collection of resources is available." },
        { role: "system", content: "Encourage visitors to explore Nicolas's website and published works." },
        { role: "system", content: "If a visitor asks for Nicolas's contact details, refer to the provided contact information." }
        //{ role: "system", content: "Here are Nicolas's key resources which include a description of each content item: " + JSON.stringify(resources) }
    ];

    console.log("📤 Sending system prompts to OpenAI one by one...");
    let botReply=[];
    try {
        console.log("📤 Sending system prompts to OpenAI in parallel...");
        botReply = await Promise.all(systemPrompts.map(prompt => callOpenAI([prompt]))); // Runs in // for faster exec
    } catch (error) {
        console.error("❌ Error during OpenAI initialization:", error);
    }

    // Ensure responses exist and contain valid data
    let firstMessage = `👋 Hi! I'm NicoAI, the AI version of Nicolas Payen. How can I help you today?<br>
<span class="chat-note">Note: Nicolas will personally review this conversation later, so you can also use it to leave him a message. Your input will be stored and shared with him.</span>`; // Default message

    if (Array.isArray(botReply) && botReply.length > 0 && botReply[0]?.choices?.length > 0) {
        firstMessage = botReply[0].choices[0].message?.content || firstMessage;
    }

    console.log(`✅ NicoAI initialized for visitor ${visitorID}. First message: ${firstMessage}`);

    return { message: firstMessage };
}

// API Endpoint to Initialize NicoAI for a Visitor
initApp.post("/api/init", async (req, res) => {
    const { visitorID } = req.body;
    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });

    const initResponse = await init_NicoAI(visitorID);
    console.log(`🚀 /api/init executed`);
    res.json(initResponse);
});

// Function  to get the information associated with an URL
async function fetchDocument(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`⚠️ Failed to fetch document: ${response.statusText}`);
        return await response.text();  // Returns text content of the document
    } catch (error) {
        console.error("⚠️ Error fetching document:", error);
        return "I couldn't fetch the document.";
    }
}

// Export app for Vercel (fixing export issue)
module.exports = initApp;
module.exports.resources = resources;