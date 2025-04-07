//We use the Vercel KV integration, Vercel gives you environment variables: KV_REST_API_URL, KV_REST_API_TOKEN
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { visitorID, sender, message, timestamp } = req.body;

  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const key = `chat:${visitorID}:${timestamp}`;
  const value = JSON.stringify({ sender, message, timestamp });

  try {
    const kvRes = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value })
    });

    const responseText = await kvRes.text(); // 👀 capture text from KV

    if (!kvRes.ok) {
      console.error("❌ KV save failed:", responseText);
      return res.status(500).json({ error: 'KV save failed', responseText });
    }

    console.log("✅ KV save successful:", responseText);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ KV request error:", err);
    return res.status(500).json({ error: 'Exception thrown', details: err.message });
  }
}