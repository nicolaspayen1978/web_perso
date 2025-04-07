//The [visitorID].js file inside pages/api/conversation/ is a dynamic API route in Next.js (used by Vercel). 
//It lets you capture a variable from the URL — in this case, visitorID.
export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;

  if (authorization !== `Bearer ${process.env.BACKOFFICE_PASSWORD}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:${visitorID}:`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });

  const keyData = await listRes.json();
  const keys = keyData.result || [];

  const messages = [];

  for (const key of keys) {
    const getRes = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });

    const { result } = await getRes.json();
    if (result) messages.push(JSON.parse(result));
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);

  res.status(200).json({ visitorID, messages });
}