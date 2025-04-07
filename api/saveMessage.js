// This API route saves an individual chat message to Vercel KV using the REST API.
// It uses the environment variables: KV_REST_API_URL and KV_REST_API_TOKEN

export default async function handler(req, res) {
  console.log("📥 Incoming message:", req.body); // <-- Add this
  console.log("🌐 Using KV_REST_API_URL:", process.env.KV_REST_API_URL); // <-- Add this
  console.log("🔐 Token starts with:", process.env.KV_REST_API_TOKEN?.slice(0, 8)); // <-- Add this
  
  // 🛑 Only allow POST requests
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  // 📥 Extract message data from the request body
  const { visitorID, sender, message, timestamp } = req.body;

  // 🔎 Validate required fields
  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🗝 Create a unique key for this message: "chat:<visitorID>:<timestamp>"
  const key = `chat:${visitorID}:${timestamp}`;

  // 💾 Prepare the value to store — stringify the message object
  const value = JSON.stringify({ sender, message, timestamp });

  try {
    // 📡 Send POST request to Vercel KV REST API to save the key-value pair
    const kvRes = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,  // 🔐 Auth header
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value }) // The value must be wrapped in a "value" field
    });

    const responseText = await kvRes.text(); // 🧾 Capture raw response for logging

    // ❌ If the save failed, return an error with full context
    if (!kvRes.ok) {
      console.error("❌ KV save failed:", responseText);
      return res.status(500).json({ error: 'KV save failed', responseText });
    }

    // ✅ KV save succeeded
    console.log("✅ KV save successful:", responseText);
    return res.status(200).json({ success: true });

  } catch (err) {
    // 🛑 Catch and log unexpected errors (e.g. network issues)
    console.error("❌ KV request error:", err);
    return res.status(500).json({ error: 'Exception thrown', details: err.message });
  }
}