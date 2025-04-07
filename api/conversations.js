// This API route returns a summary of all stored conversations in Vercel KV.
// Each conversation is grouped by visitorID, with a count of messages and the timestamp of the last one.

export default async function handler(req, res) {
  const { authorization } = req.headers;

  // Protect the route with a password check (stored in environment variable)
  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 📥 Fetch all keys from the KV store that start with "chat:"
  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` // KV auth token
    }
  });

  // Extract and fallback to empty array if no keys found
  const keyData = await listRes.json();
  const keys = keyData.result || [];

  // 📊 Group messages by visitorID
  const grouped = {};
  for (const key of keys) {
    const [, visitorID, timestamp] = key.split(":"); // Extract parts from key: "chat:<visitorID>:<timestamp>"

    if (!grouped[visitorID]) {
      grouped[visitorID] = [];
    }

    grouped[visitorID].push(parseInt(timestamp)); // Store the timestamp for sorting later
  }

  // Create a summary array with visitorID, message count, and latest message timestamp
  const summary = Object.entries(grouped).map(([id, timestamps]) => ({
    visitorID: id,
    messages: timestamps.length,
    lastMessage: Math.max(...timestamps)
  }));

  // ✅ Return the summary as JSON
  res.status(200).json(summary);
}