export default async function handler(req, res) {
  const isDevKV = process.env.KV_MODE === 'dev';
  const kvURL = isDevKV ? process.env.DEV_KV_REST_API_URL : process.env.KV_REST_API_URL;
  const kvToken = isDevKV ? process.env.DEV_KV_REST_API_TOKEN : process.env.KV_REST_API_TOKEN;

  const testKey = `debug:test:${Date.now()}`;

  try {
    // Try writing
    const writeRes = await fetch(`${kvURL}/set/${encodeURIComponent(testKey)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: '👋 Hello from NicoAI test' })
    });

    const writeResult = await writeRes.text();

    // Try reading
    const readRes = await fetch(`${kvURL}/get/${encodeURIComponent(testKey)}`, {
      headers: { Authorization: `Bearer ${kvToken}` }
    });

    const readResult = await readRes.text();

    res.status(200).json({
      mode: process.env.KV_MODE,
      kvURL,
      write: writeResult,
      read: readResult
    });
  } catch (err) {
    console.error("❌ KV Debug Error:", err);
    res.status(500).json({ error: err.message });
  }
}