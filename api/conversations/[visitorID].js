// This is a dynamic API route used to fetch all chat messages for a specific visitorID.
// Example usage: GET /api/conversations/abc123 will return all messages from visitorID "abc123"

export default async function handler(req, res) {
  const { visitorID } = req.query;             // Extract visitorID from the URL
  const { authorization } = req.headers;       // Extract the Authorization header

  // 🔐 Check for valid access using the BACKOFFICE_PASSWORD env variable
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 📥 List all KV keys for the given visitorID (format: chat:<visitorID>:<timestamp>)
  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:${visitorID}:`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });

  const keyData = await listRes.json();
  const keys = keyData.result || []; // Fallback to empty array if no keys are found

  const messages = [];

  // 🔁 Loop through each key and fetch its stored message
  for (const key of keys) {
    const getRes = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });

    const raw = await getRes.text(); // 🐛 Get raw string response from KV
    console.log(`📦 Raw response from KV for key "${key}":`, raw); // Helpful debug log

    try {
      const { result } = JSON.parse(raw);  // Expect response like: { result: "<stringifiedMessage>" }

      if (result) {
        messages.push(JSON.parse(result)); // Stored value is a stringified JSON message → parse it
      } else {
        console.warn(`⚠️ No result for key: ${key}`);
      }
    } catch (err) {
      console.error(`❌ Error parsing response for key: ${key}`, err);
    }
  }

  // 🕒 Sort messages chronologically by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp);

  // ✅ Return the full conversation for the visitor
  res.status(200).json({ visitorID, messages });
}