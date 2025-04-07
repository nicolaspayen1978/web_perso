//file to clear KV database on request
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
    }
  });

  const keysResult = await listRes.json();
  const keys = keysResult.result || [];

  const deleted = [];

  for (const key of keys) {
    await fetch(`${process.env.KV_REST_API_URL}/del/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
      }
    });
    deleted.push(key);
  }

  res.status(200).json({ success: true, deleted });
}