console.log("🔥 API Init is running");
const express = require("express");
const { isNicoAIInitialized, markNicoAIInitialized, fetchResources, callOpenAI, formatLinks, fetchDocument } = require("./utils/utils"); // Import from utils.js
const app = express();

app.use(express.json());

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
    ];

    for (const prompt of systemPrompts) {
        await callOpenAI(prompt);
    }

    console.log("📥 Fetching resources from resources.json...");
    const resources = await fetchResources();
    if (resources) {
        await callOpenAI([
            { content: "Here are Nicolas's key resources. Please summarize them for future reference.", role: "system"  },
            { content: JSON.stringify(resources), role: "user"}
        ]);
    }

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

// ✅ Export app for Vercel
module.exports = app;