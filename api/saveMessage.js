export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { visitorID, sender, message, timestamp } = req.body;
  if (!visitorID || !sender || !message || !timestamp) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const key = `chat:${visitorID}:${timestamp}`;
  const value = JSON.stringify({ sender, message, timestamp });

  const kvRes = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value })
  });

  if (!kvRes.ok) {
    return res.status(500).json({ error: 'Failed to save message' });
  }

  res.status(200).json({ success: true });
}