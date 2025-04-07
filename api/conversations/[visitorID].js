//The [visitorID].js file inside pages/api/conversation/ is a dynamic API route in Next.js (used by Vercel). 
//It lets you capture a variable from the URL — in this case, visitorID.
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { visitorID } = req.query;
  const { authorization } = req.headers;
  const pwd = process.env.BACKOFFICE_PASSWORD;

  if (authorization !== `Bearer ${pwd}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const keys = await kv.keys(`chat:${visitorID}:*`);
  const messages = [];

  for (const key of keys) {
    const msg = await kv.get(key);
    if (msg) {
      messages.push(JSON.parse(msg));
    }
  }

  messages.sort((a, b) => a.timestamp - b.timestamp);

  res.status(200).json({ visitorID, messages });
}