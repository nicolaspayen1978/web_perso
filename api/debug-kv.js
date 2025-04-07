//file to debug KV database
export default async function handler(req, res) {
  const listRes = await fetch(`${process.env.KV_REST_API_URL}/keys?prefix=chat:`, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`
    }
  });

  const keysResult = await listRes.json();
  const keys = keysResult.result || [];
  const output = {};

  for (const key of keys) {
    const getRes = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
    });

    const { result } = await getRes.json();
    output[key] = result;
  }

  res.status(200).json({ keys: Object.keys(output), values: output });
}