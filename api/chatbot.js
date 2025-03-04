// This api/chatbot.js the API deployed and executed on Vercel
// ENV variables are set-up in Vercel to not be publicly available
console.log("🔥 API is running");
const fs = require("fs");
const path = require("path");


const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const RESOURCES_PATH = path.join(__dirname, "../resources.json");

let resourceDescriptions = {};

// Load and parse resources.json
async function loadResources() {
    try {
        const data = fs.readFileSync(RESOURCES_PATH, "utf-8");
        const resources = JSON.parse(data);
        resourceDescriptions = await generateResourceDescriptions(resources);  // Ensure it's awaited
        console.log("Resources parsed successfully:", resourceDescriptions);
    } catch (error) {
        console.error("Error loading resources:", error);
    }
}

// Summarize each category of resources using OpenAI
async function summarizeCategory(category, items) {
    const prompt = `Summarize the following resources under the category '${category}':\n\n${JSON.stringify(items, null, 2)}`;
    return await callOpenAI(prompt);
}

// Summarize each item of resources using OpenAI
async function summarizeItem(category, item) {
    const prompt = `Summarize the following resource from category '${category}':\n\nTitle: ${item.title}\nURL: ${item.url}\n\nProvide a concise and informative summary.`;
    console.log(`📩 Calling OpenAI for summary: ${item.title} (${item.url})`);
    const response = await callOpenAI(prompt);
    console.log(`📝 OpenAI Response:`, response);
    return response || "No summary available.";
}

// Generate descriptions for each resource using OpenAI, with a progress indicator
async function generateResourceDescriptions(resources, updateProgress) {
    let descriptions = {};
    let totalItems = Object.values(resources).flatMap(items => Array.isArray(items) ? items : Object.values(items)).length; // Count all resources
    let processedItems = 0;

    for (const [category, items] of Object.entries(resources)) {
        if (Array.isArray(items)) {
            descriptions[category] = []; // Initialize an array for this category

            for (const item of items) {
                let summary = await summarizeItem(category, item);
                descriptions[category].push({
                    title: item.title || "Untitled",
                    url: item.url || "",
                    summary: summary
                });

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
                let summary = await summarizeItem(category, { title: key, url: value });
                descriptions[category][key] = {
                    title: key,
                    url: value,
                    summary: summary
                };

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
    }

    return descriptions;
}

// generate a request to OpenAI that includes the user questions and the relevant resources
async function generateChatResponse(userMessages) {
    // Extract user question
    const lastMessage = userMessages[userMessages.length - 1].content;

    // Identify relevant resources
    let relevantResources = Object.entries(resourceDescriptions)
        .map(([category, summary]) => `${category}: ${summary}`)
        .join("\n");

    const prompt = `User asked: "${lastMessage}"\n\nBased on the following summarized resources, provide an accurate answer:\n\n${relevantResources}`;

    return await callOpenAI(prompt);
}

// Call OpenAI API
async function callOpenAI(prompt, retryCount = 3) {
    let attempts = 0;

    while (attempts < retryCount) {
        try {
            console.log(`🟢 Attempt ${attempts + 1}: Sending request to OpenAI...`);

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4",
                    messages: [{ role: "user", content: prompt }], 
                    max_tokens: 500, 
                    temperature: 0.1,  
                    top_p: 0.9,  
                    frequency_penalty: 0,
                    presence_penalty: 0
                })
            });

            if (!response.ok) {
                const errorMessage = await response.text();
                console.error(`❌ OpenAI API error: ${response.status} - ${errorMessage}`);

                if (attempts + 1 < retryCount) {
                    console.log(`🔄 Retrying... (${attempts + 1}/${retryCount})`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * (attempts + 1))); // ⏳ Exponential backoff
                    attempts++;
                    continue; // 🔄 Retry request
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

module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader("Access-Control-Allow-Origin", "*");  // Allow all origins
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); // Allow POST & OPTIONS
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    console.log("🚀 Received API request", req.method);
    console.log("Request Body:", req.body);

    // Preflight Request Handling (Important for browsers)
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    // Reject all non-POST requests
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0) {
            console.error("Invalid request: messages array is missing.");
            return res.status(400).json({ error: "Invalid request: Missing messages." });
        }

        // Ensure resources are loaded before processing the chat
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

// Load resources on startup
loadResources();
console.log("Resources loaded in API", resourceDescriptions);