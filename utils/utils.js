// this is utils/utils.js the API to initiate NicoAI 
const fs = require("fs");
const path = require("path");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ Load visitor sessions from a JSON file (temporary, replace with Redis for production)
const SESSIONS_FILE = path.join(__dirname, "../visitorSessions.json");

function loadVisitorSessions() {
    if (fs.existsSync(SESSIONS_FILE)) {
        return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
    }
    return {};
}

function saveVisitorSessions(data) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2));
}

const visitorSessions = loadVisitorSessions();

function isNicoAIInitialized(visitorID) {
    return visitorSessions[visitorID] && visitorSessions[visitorID].initialized;
}

function markNicoAIInitialized(visitorID) {
    visitorSessions[visitorID] = { initialized: true };
    saveVisitorSessions(visitorSessions);
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


// Function to format links properly as clickable HTML
function formatLinks(responseText) {
    return responseText.replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, function (match, title, url) {
        return `🔗 <a href="${url}" target="_blank">${title}</a>`;
    });
}

// ✅ Export functions to be used in `init.js` and `chatbot.js`
module.exports = {
    loadVisitorSessions,
    saveVisitorSessions,
    isNicoAIInitialized,
    markNicoAIInitialized,
    callOpenAI,
    formatLinks
};