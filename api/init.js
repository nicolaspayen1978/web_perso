console.log("🔥 API Init is running");
const express = require("express");
const fs = require("fs");
const path = require("path"); 
const { isNicoAIInitialized, markNicoAIInitialized, callOpenAI, formatLinks} = require("../utils/utils"); // Import from utils.js
const app = express();

// Ensure fetch() is available in Node.js
const fetch = globalThis.fetch || require("node-fetch");

app.use(express.json());


// ✅ CORS Middleware - Add this BEFORE defining `/api/init`
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "https://nicolaspayen1978.github.io");
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

    try {
        console.log("📤 Sending system prompts to OpenAI in parallel...");
        await Promise.all(systemPrompts.map(prompt => callOpenAI([prompt]))); // Runs in // for faster exec
    } catch (error) {
        console.error("❌ Error during OpenAI initialization:", error);
    }


    //Ensure resources exist before sending summary request
    /*
    if (resources && Object.keys(resources).length > 0) {
        console.log("📥 Fetching and summarizing resources...");

        const summaryPrompt = [
            { role: "system", content: "Here are Nicolas's key resources. Please provide a description of their content in 100 words maximum for future reference." },
            { role: "user", content: JSON.stringify(resources) }
        ];

        console.log(`🟢 Sending summary request to OpenAI:\n`, summaryPrompt);
        await callOpenAI(summaryPrompt);
    } else {
        console.warn("⚠️ No resources available, skipping summary request.");
    }
    */
    console.log(`✅ NicoAI initialized for visitor ${visitorID}`);
    return { message: "NicoAI initialized successfully for this visitor!" };
}

// ✅ API Endpoint to Initialize NicoAI for a Visitor
app.post("/api/init", async (req, res) => {
    const { visitorID } = req.body;
    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });

    const result = await init_NicoAI(visitorID);
    console.log(`🚀 /api/init executed`);
    res.json(result);
});

// Function  to get the information associated with an URL
async function fetchDocument(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch document: ${response.statusText}`);
        return await response.text();  // Returns text content of the document
    } catch (error) {
        console.error("Error fetching document:", error);
        return "I couldn't fetch the document.";
    }
}

// Export app for Vercel
module.exports = { initApp: app, resources };