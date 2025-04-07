// This API route clears (deletes) all stored chat messages from Vercel KV.
// It requires a valid Authorization header using BACKOFFICE_PASSWORD.

export default async function handler(req, res) {
  // 🔐 Check if the request includes a valid bearer token
  if (req.headers.authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' }); // If not authorized, return 401
  }

  // 📥 Fetch all keys from the KV store that start with "chat:"
  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` // 🔐 KV API token
    }
  });

  const keysResult = await listRes.json();             // Parse the response
  const keys = keysResult.result || [];                // Fallback to empty array if no keys found

  const deleted = []; // Will store all deleted key names

  // 🗑 Loop through each key and delete it from the KV store
  for (const key of keys) {
    await fetch(`${process.env.KV_REST_API_URL}/del/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
      }
    });
    deleted.push(key); // Log the deleted key
  }

  // ✅ Return the list of deleted keys in the response
  res.status(200).json({ success: true, deleted });
}