// This scripts/uploadResources.js the script to deploy the resources in KV database

const fs = require("fs");
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
    console.error("Missing Vercel KV credentials.");
    process.exit(1);
}

console.log("📥 Loading resources.json...");
const resources = JSON.parse(fs.readFileSync("./resources.json", "utf-8"));

(async () => {
    console.log("📤 Uploading resources.json to Vercel KV...");
    
    const response = await fetch(`${KV_URL}/set/resources`, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${KV_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(resources)
    });

    if (!response.ok) {
        console.error("❌ Failed to upload to Vercel KV:", await response.text());
        process.exit(1);
    }

    console.log("Successfully uploaded resources to Vercel KV!");
})();