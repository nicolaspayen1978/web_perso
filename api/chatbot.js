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
    res.setHeader("Access-Control-Allow-Origin", "*");  // ✅ Allows any origin
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.error("Missing OpenAI API key.");
        return res.status(500).json({ error: "Missing API key in server." });
    }

    try {
        const { messages } = req.body;
        if (!messages || messages.length === 0) {
            console.error("Invalid request: messages array is missing.");
            return res.status(400).json({ error: "Invalid request: Missing messages." });
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages,
                max_tokens: 800,  // Reduce response length but still quite detailed
                temperature: 0.2  // Keeps answers factual (0.3 = factual, slightly creative)
            })
        });

        if (!response.ok) {
            console.error(`OpenAI API error: ${response.statusText}`);
            return res.status(response.status).json({ error: `OpenAI API error: ${response.statusText}` });
        }

        const data = await response.json();
        let botReply = data.choices[0]?.message?.content || "I'm sorry, I didn't understand that.";

        // Convert Markdown-style links `[title](url)` to real HTML `<a>` links
        botReply = formatLinks(botReply);

        return res.status(200).json({ choices: [{ message: { content: botReply } }] });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};