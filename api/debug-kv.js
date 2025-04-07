// /api/debug-kv.js
export default async function handler(req, res) {
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Missing KV environment variables" });
  }

  try {
    // 1. Get all keys with the "chat:" prefix
    const keyListRes = await fetch(`${KV_URL}/keys?prefix=chat:`, {
      headers: {
        Authorization: `Bearer ${KV_TOKEN}`
      }
    });

    const keyList = await keyListRes.json();
    const keys = keyList.result || [];

    // 2. Fetch all key values
    const values = {};

    for (const key of keys) {
      const valueRes = await fetch(`${KV_URL}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${KV_TOKEN}`
        }
      });

      const valueRaw = await valueRes.text();

      try {
        // 👇 Vercel KV wraps values in a { result: "..." } object, where the value is a stringified JSON
        const { result } = JSON.parse(valueRaw);

        if (result) {
          values[key] = JSON.parse(result); // double JSON parse
        } else {
          values[key] = null;
        }
      } catch (err) {
        console.warn(`⚠️ Could not parse value for key ${key}:`, err);
        values[key] = `⚠️ Error parsing`;
      }
    }

    res.status(200).json({ keys, values });

  } catch (err) {
    console.error("❌ Failed to fetch KV keys/values:", err);
    res.status(500).json({ error: "KV fetch failed", details: err.message });
  }
}