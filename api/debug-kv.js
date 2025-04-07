// /api/debug-kv.js
export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Missing KV env vars" });
  }

  try {
    console.log("🛠 DEBUG-KV: Listing all chat:* keys...");

    // 🔍 Step 1: List keys with prefix "chat:"
    const listRes = await fetch(`${KV_URL}/keys?prefix=chat:`, {
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`
      }
    });

    const { result: keys = [] } = await listRes.json();
    console.log("🔑 Keys found:", keys);

    // 🧾 Step 2: Get values
    const values = {};
    for (const key of keys) {
      const getRes = await fetch(`${KV_URL}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`
        }
      });

      const raw = await getRes.text();
      try {
        const { result } = JSON.parse(raw); // ✅ This works with correct storage
        values[key] = result;
      } catch (err) {
        console.warn(`⚠️ Failed to parse key ${key}:`, raw);
      }
    }

    res.status(200).json({ keys, values });

  } catch (err) {
    console.error("❌ Error in debug-kv:", err);
    res.status(500).json({ error: "Failed to list or fetch KV keys", details: err.message });
  }
}