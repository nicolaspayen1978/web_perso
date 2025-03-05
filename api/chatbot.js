// This api/chatbot.js the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available
console.log("🔥 API is running");
const fs = require("fs");
const path = require("path");
const express = require('express'); 
const app = express();

app.use(express.json());


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const KV_REST_API_URL = process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const RESOURCES_PATH = path.join(__dirname, "../resources.json");


let resourceDescriptions = {};

// ************** Visitor session mgmt ************** 
// Store visitor sessions in memory (for small-scale use, use Redis for production)
const visitorSessions = {};

// Function to check if NicoAI has been initialized for a visitor
function isNicoAIInitialized(visitorID) {
    return visitorSessions[visitorID] && visitorSessions[visitorID].initialized;
}

// Function to mark NicoAI as initialized for a visitor
function markNicoAIInitialized(visitorID) {
    visitorSessions[visitorID] = { initialized: true };
}

// ************** Initiate Nico_AI for visitor ************** 
// Initialize NicoAI for a visitor
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
        { role: "system", content: "Your mission is to share this information and ideas on Nicolas's behalf with visitors." },
        { role: "system", content: "Your mission is to get to know the visitor and reply based on what you know of Nicolas' ideas and life." },
        { role: "system", content: "You must use Nicolas's past articles, projects, and knowledge when relevant." },
        { role: "system", content: "Encourage visitors to explore Nicolas's website and published works." },
        { role: "system", content: "If a visitor asks for Nicolas's contact details, refer to the provided contact information." }
    ];

     //initial prompt to initiate NicoAI
    /*
        You are a NicoAI the AI version of Nicolas Payen. You are also his AI assistant.
        Here is what you know about him:

        **Birthday:** March 11, 1978, born in Valence, France  
        **Location:** Lives in Naarden, Netherlands  
        **Expertise:** Investment, finance, digital transformation, energy transition, climate tech, entrepreneurship  
        **Family:** Married to Eveline Noya, Dutch citizen and senior HR professional. Two kids: Floris (born 2012) and Romy (born 2016).   

        **Strengths:** Deep knowledge in clean technologies, climate investments, international business, strategic leadership.  
        **Weaknesses:** Sometimes overanalyzes decisions, prefers calculated risk, needs data to act.  

        **Career Timeline:** ${resources.career.journey || "Loading..."}  
        **Resume:** ${resources.career.resume || "Loading..."}  

        **Articles:**  
        ${resources.articles ? resources.articles.map(article => `- [${article.title}](${article.url})`).join("\n") : "Loading..."}

        **Projects:**  
        ${resources.projects ? resources.projects.map(project => `- [${project.title}](${project.url})`).join("\n") : "Loading..."}

        **Contacts:** ${resources.contact || "Loading..."}

        Provide links when relevant. Always share a little summary of the content of the link before doing so. 
        If a user asks for more information, share these sources.
        Help visitors book meetings or calls with Nicolas Payen using Calendly.
    `
    */

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


// API Endpoint to Initialize NicoAI for a Visitor
app.post('/api/init', async (req, res) => {
    const { visitorID } = req.body;
    if (!visitorID) return res.status(400).json({ error: "Missing visitorID." });
    const result = await init_NicoAI(visitorID);
    console.log(`🚀 /api/init executed`);
    res.json(result);
});

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

// Call OpenAI API
async function callOpenAI(prompt, retryCount = 3) {
    let attempts = 0;

    while (attempts < retryCount) {
        try {
            console.log(`🟢 Attempt ${attempts + 1}: Sending request to OpenAI...`);
            console.log("🔍 Full OpenAI Prompt:\n", prompt);

            // Set up a timeout controller (20 seconds max)
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 20000); // ⏳ 20s timeout

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo",
                    messages: Array.isArray(prompt) ? prompt : [{ role: role, content: prompt }], 
                    max_tokens: 300, 
                    temperature: 0,  
                    top_p: 0.9,  
                    frequency_penalty: 0,
                    presence_penalty: 0
                })
            });

            clearTimeout(timeout); // Clear timeout after response

            if (!response.ok) {
                const errorMessage = await response.text();
                console.error(`❌ OpenAI API error: ${response.status} - ${errorMessage}`);

                if (response.status === 429 && errorMessage.includes("TPM")) {
                    console.log("🔽 Reducing token count and retrying...");
                    prompt = prompt.substring(0, prompt.length * 0.7); // Trim the prompt by 30%
                }

                if (attempts + 1 < retryCount) {
                    console.log(`🔄 Retrying... (${attempts + 1}/${retryCount})`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1))); // Exponential backoff
                    attempts++;
                    continue;
                }
                return "Error calling OpenAI. Please try again.";
            }

            const data = await response.json();
            console.log(`✅ OpenAI Response Data:`, JSON.stringify(data, null, 2));

            // Response extraction
            return data.choices?.[0]?.message?.content?.trim() || "No summary available.";

        } catch (error) {
            console.error(`⚠️ Error calling OpenAI (Attempt ${attempts + 1}):`, error);

            if (attempts + 1 < retryCount) {
                console.log(`🔄 Retrying in ${(2000 * (attempts + 1)) / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1))); // ⏳ Exponential backoff
                attempts++;
                continue; // 🔄 Retry request
            }

            return "Error generating summary after multiple attempts.";
        }
    }
}

let notifiedUsers = new Set(); // This will reset between serverless function runs

// Function to format links properly as clickable HTML
function formatLinks(responseText) {
    return responseText.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, function (match, title, url) {
        return `🔗 <a href="${url}" target="_blank">${title}</a>`;
    });
}

// Function to send GitHub notification
async function sendGitHubNotification(visitorMessage) {
    try {
        const githubToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const repoOwner = "nicolaspayen1978";
        const repoName = "web_perso";

        const response = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${githubToken}`,
                "Accept": "application/vnd.github.everest-preview+json"
            },
            body: JSON.stringify({
                event_type: "chatbot_notification",
                client_payload: { message: visitorMessage }
            })
        });

        if (!response.ok) {
            console.error(`GitHub notification failed: ${response.statusText}`);
        }
    } catch (error) {
        console.error("Error sending GitHub notification:", error);
    }
}

// Function to send email or Telegram notification (expand this logic as needed)
async function sendNotification(visitorMessage) {
    const adminEmail = "nicolas_payen@icloud.com";  // Replace with your email
    console.log(`Sending notification: ${visitorMessage}`);

    // Add your actual notification logic (email, Telegram, Discord, etc.)
}

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
