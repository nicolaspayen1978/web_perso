import fetch from "node-fetch";

let notifiedUsers = new Set();  // Prevent multiple notifications for the same session

async function sendNotification(visitorMessage) {
    const adminEmail = "your-email@example.com";  // Replace with your email
    const slackWebhook = "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK";  // Replace with your Slack webhook

    const messageText = `New visitor engaged with your chatbot:\n\n"${visitorMessage}"`;

    // Send Email (via Mailgun or SMTP)
    await fetch("https://api.mailgun.net/v3/YOUR_DOMAIN/messages", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${btoa("api:YOUR_MAILGUN_API_KEY")}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            from: "Chatbot <bot@your-domain.com>",
            to: adminEmail,
            subject: "New Chatbot Visitor",
            text: messageText
        })
    });

    // Send Slack Notification
    await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: messageText })
    });

    console.log("Notification sent!");
}

// Check if user is new & send a notification
export default async function handler(req, res) {
    const { messages } = req.body;
    const userMessage = messages.find(msg => msg.role === "user")?.content;

    if (userMessage && !notifiedUsers.has(req.headers["x-forwarded-for"])) {
        notifiedUsers.add(req.headers["x-forwarded-for"]);
        await sendNotification(userMessage);
    }

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed. Use POST." });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "Missing API key in Vercel environment variables." });
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4",
                messages: req.body.messages
            })
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `OpenAI API error: ${response.statusText}` });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}