// This api/chatbot.js the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available
console.log("🔥 API chatbot is running");
const fs = require("fs");
const path = require("path");
const express = require('express');
const { isNicoAIInitialized, markNicoAIInitialized, fetchResources, callOpenAI, formatLinks, fetchDocument } = require("./utils/utils"); // Import from utils.js 
const app = express();

app.use(express.json());


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const RESOURCES_PATH = path.join(__dirname, "../resources.json");


let resourceDescriptions = {};

// API Endpoint to Handle Chat
app.post('/api/chatbot', async (req, res) => {
    const { visitorID, userInput } = req.body;

    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
    if (!userInput) return res.status(400).json({ error: "No user input provided." });
    const response = await callOpenAI([{content: userInput,  role: "user"}]);
    console.log(`🚀 /api/chatbot handler called`);
    res.json({ response });
});

// Start the Express server
// ONLY start server when running locally
if (process.env.NODE_ENV !== "vercel") {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

// ✅ Export the app for Vercel
module.exports = app;

// ✅ Handle CORS
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "https://nicolaspayen1978.github.io");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    next();
});

/* module.exports = async (req, res) => {
    console.log("🚀 Received API request", req.method);

    // ✅ Handle CORS Preflight Request
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "https://nicolaspayen1978.github.io"); // Allow only your GitHub Pages
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        console.log("🟢 Handled preflight OPTIONS request.");
        return res.status(200).end();
    }

    // ✅ Reject all non-POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    // ✅ Continue processing for POST requests
    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0) {
            console.error("Invalid request: messages array is missing.");
            return res.status(400).json({ error: "Invalid request: Missing messages." });
        }

        // Load resources if not already loaded
        if (Object.keys(resourceDescriptions).length === 0) {
            console.log("Resources not loaded yet, attempting to reload.");
            await loadResources();
        }

        // Generate chatbot response
        const responseText = await generateChatResponse(messages);

        // Ensure valid response
        if (!responseText || responseText.trim() === "") {
            console.warn(" OpenAI returned an empty response.");
            return res.status(200).json({
                choices: [{ message: { content: "I couldn't generate a response right now. Try rephrasing your question." } }]
            });
        }

        console.log(" OpenAI Response:", responseText);

        return res.status(200).json({ choices: [{ message: { content: responseText } }] });

    } catch (error) {
        console.error(" Server Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
*/

// Load resources coming from '`resources.json` that have been transfer to Vercel KV
// Load resources from Vercel KV
async function loadResources() {
    try {
        console.log("📥 Fetching resources from Vercel KV...");

        const response = await fetch(`${KV_REST_API_URL}/get/resources`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${KV_REST_API_TOKEN}` }
        });

        if (!response.ok) {
            console.error("❌ Failed to fetch from Vercel KV:", await response.text());
            return;
        }

        const data = await response.json();
        resourceDescriptions = data || {};

        console.log("✅ Resources loaded successfully. Checking for missing descriptions...");

        let needsUpdate = false;
        for (const [category, items] of Object.entries(resourceDescriptions)) {
            if (Array.isArray(items)) {
                for (const item of items) {
                    if (item.description === "-1") {
                        console.log(`🔍 Missing description for: ${item.title}`);
                        needsUpdate = true;
                        item.description = await summarizeItem(category, item);
                    } else {
                        console.log(`✅ Using existing description for: ${item.title}`);
                    }
                }
            } else if (typeof items === "object" && items !== null) {
                for (const [key, value] of Object.entries(items)) {
                    if (value.description === "-1") {
                        console.log(`🔍 Missing description for: ${key}`);
                        needsUpdate = true;
                        value.description = await summarizeItem(category, { title: key, url: value });
                    } else {
                        console.log(`✅ Using existing description for: ${item.title}`);
                    }
                }
            }
            if (needsUpdate) {
                console.log("📤 Updating Vercel KV with new descriptions...");
                await saveResources(); // Save after processing each batch to avoid data loss
                needsUpdate = false;
                }
        }
    } catch (error) {
        console.error("⚠️ Error fetching resources:", error);
    }
}


// **Save Updated resources.json Back to Vercel KV**
async function saveResources() {
    try {
        console.log("📤 Saving updated resources to Vercel KV...");

        const response = await fetch(`${KV_REST_API_URL}/set/resources`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${KV_REST_API_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(resourceDescriptions)
        });

        if (!response.ok) {
            console.error("❌ Failed to save to Vercel KV:", await response.text());
            return;
        }

        console.log("✅ Successfully updated resources in Vercel KV!");
    } catch (error) {
        console.error("⚠️ Error saving resources:", error);
    }
}

// **Function to Update Descriptions in Resource JSON**
async function updateResourceDescription(category, itemTitle, newDescription) {
    if (!resourceDescriptions[category]) {
        resourceDescriptions[category] = [];
    }

    const itemIndex = resourceDescriptions[category].findIndex(item => item.title === itemTitle);
    
    if (itemIndex !== -1) {
        // Update existing item
        resourceDescriptions[category][itemIndex].description = newDescription;
    } else {
        // Add new item if not found
        resourceDescriptions[category].push({
            title: itemTitle,
            description: newDescription
        });
    }

    await saveResources();  // Save the updated data to Vercel KV
}


// Summarize each item of resources using OpenAI
async function summarizeItem(category, item) {
    const prompt = { role: "system", content: `The following content titled "${item.title}" from "${item.url}"" needs a short, accurate summary of its content in 100 words. Do NOT assume the topic based on the title or other headlines. The summary must reflect the actual content and not be a general explanation.`};
    console.log(`📩 Calling OpenAI for summary: ${item.title} (${item.url})`);
    let response = await callOpenAI(prompt);

    if (!response || response.trim() === "") {
        console.warn(`⚠️ OpenAI returned an empty response for: ${item.title}. Setting description to "-1" for retry.`);
        response = "-1"; // Mark for retry
    }
    console.log(`📝 OpenAI Response:`, response);
    await updateResourceDescription(category, item.title, response);
    return response;
}

// Generate descriptions for each resource using OpenAI, with a progress indicator
async function generateResourceDescriptions(resources, updateProgress) {
    let descriptions = { ...resources };  // Keep existing data
    let totalItems = Object.values(resources).flatMap(items => Array.isArray(items) ? items : Object.values(items)).length; // Count all resources
    let processedItems = 0;

    for (const [category, items] of Object.entries(resources)) {
        if (Array.isArray(items)) {
            descriptions[category] = []; // Initialize an array for this category

            for (const item of items) {
                if (!item.description || item.description.trim() === "" || item.description === "-1") {
                    let summary = await summarizeItem(category, item);
                    item.description = summary;
                }
                processedItems++;
                let progress = Math.round((processedItems / totalItems) * 100);
                console.log(`📊 Progress: ${progress}%`);

                if (typeof updateProgress === "function") {
                    updateProgress(progress);
                }

                await new Promise(resolve => setTimeout(resolve, 500)); // ⏳ Reduce API load
            }

        } else if (typeof items === "object" && items !== null) {
            // Handle objects like "career" and "contact"
            descriptions[category] = {};

            for (const [key, value] of Object.entries(items)) {
                 if (!value.description || value.description.trim() === "" || value.description === "-1") {
                    let summary = await summarizeItem(category, { title: key, url: value });
                    value.description = summary;
                }
                processedItems++;
                let progress = Math.round((processedItems / totalItems) * 100);
                console.log(`📊 Progress: ${progress}%`);

                if (typeof updateProgress === "function") {
                    updateProgress(progress);
                }

                await new Promise(resolve => setTimeout(resolve, 500)); // ⏳ Reduce API load
            }

        } else {
            console.error(`Warning: '${category}' is not an array or object. Skipping.`);
        }
        await delay(1000); // ⏳ Wait 1 second before the next call
    }

    return descriptions;
}

// generate a request to OpenAI that includes the user questions and the relevant resources
//identify relevant resources
function getRelevantResources(userMessage) {
    const keywords = userMessage.toLowerCase().split(/\s+/); // Split message into words
    let resourceMatches = [];

    for (const [category, items] of Object.entries(resourceDescriptions)) {
        if (Array.isArray(items)) {
            for (const item of items) {
                const titleLower = item.title.toLowerCase();
                const descriptionLower = (item.description || "").toLowerCase();
                
                // Count keyword matches in title & description
                let matchScore = keywords.filter(word => titleLower.includes(word) || descriptionLower.includes(word)).length;

                if (matchScore > 0) {
                    resourceMatches.push({ title: item.title, description: item.description, score: matchScore });
                }
            }
        }
    }

    // Sort by relevance (higher match score first) and limit results
    resourceMatches.sort((a, b) => b.score - a.score);
    return resourceMatches.slice(0, 5).map(item => `${item.title}: ${item.description}`).join("\n");
}

async function generateChatResponse(userMessages) {
    console.log("🔍 Reloading latest resources from KV before generating response...");
    const fullusermessages = [{ role: "user", content: userMessages }];
    console.log("📚 Sending prompt to OpenAI:\n", fullusermessages);
    return await callOpenAI(fullusermessages);
}

let notifiedUsers = new Set(); // This will reset between serverless function runs



