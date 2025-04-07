
export default async function handler(req, res) {
  const { authorization } = req.headers;

  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
    }
  });

  const keyData = await listRes.json();
  const keys = keyData.result || [];
  const grouped = {};

  for (const key of keys) {
    const [, visitorID, timestamp] = key.split(":");
    if (!grouped[visitorID]) {
      grouped[visitorID] = [];
    }
    grouped[visitorID].push(parseInt(timestamp));
  }

  const summary = Object.entries(grouped).map(([id, timestamps]) => ({
    visitorID: id,
    messages: timestamps.length,
    lastMessage: Math.max(...timestamps)
  }));

  res.status(200).json(summary);
}