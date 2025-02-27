const fetch = require("node-fetch"); // Only needed for Node.js < 18

let notifiedUsers = new Set(); // This will reset between serverless function runs

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

// Main API handler function
module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Missing API key in Vercel environment variables." });
    }

    try {
        const { messages } = req.body;
        const userMessage = messages.find(msg => msg.role === "user")?.content;
        const userIP = req.headers["x-forwarded-for"];

        // Send GitHub notification when the first message is received from a unique user
        if (userMessage && !notifiedUsers.has(userIP)) {
            notifiedUsers.add(userIP);
            await sendGitHubNotification(userMessage);
            await sendNotification(userMessage);
        }

        // Call OpenAI API for chatbot response
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: messages
            })
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `OpenAI API error: ${response.statusText}` });
        }

        const data = await response.json();
        return res.status(200).json(data);

    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};