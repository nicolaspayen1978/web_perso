//file to debug KV database
export default async function handler(req, res) {
  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
    }
  });

  const keyData = await listRes.json();
  const keys = keyData.result || [];
  const values = {};

console.log("🌐 DEBUG-KV URL:", process.env.KV_REST_API_URL);
console.log("🔐 DEBUG-KV TOKEN starts with:", process.env.KV_REST_API_TOKEN?.slice(0, 8));


  for (const key of keys) {
    const getRes = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
      }
    });

    const raw = await getRes.text();

    try {
      values[key] = JSON.parse(raw).result; // ✅ this assumes new format
    } catch (err) {
      console.error("❌ Failed to parse KV entry:", raw);
    }
  }

  res.status(200).json({ keys, values });
}