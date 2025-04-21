// lib/kvGalleryHelpers.js
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const isDevKV = process.env.KV_MODE === 'dev';
const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// ✅ Robust get
export async function kvGetGallery(key) {
  const res = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`⚠️ Failed to get ${key}:`, errorText);
    return null;
  }

  try {
    let result = await res.json();

    if (Array.isArray(result) || (typeof result === 'object' && result !== null)) {
      return result;
    }

    if (typeof result === 'string') {
      const once = JSON.parse(result);
      if (Array.isArray(once) || typeof once === 'object') return once;

      if (typeof once === 'string') {
        const twice = JSON.parse(once);
        if (Array.isArray(twice) || typeof twice === 'object') {
          console.warn(`⚠️ ${key} was double-encoded.`);
          return twice;
        }
      }
    }

    console.warn(`⚠️ Unexpected format for ${key}: ${typeof result}`);
    return null;
  } catch (err) {
    console.warn(`❌ Failed to parse KV value for ${key}:`, err.message);
    return null;
  }
}

// ✅ Robust set
export async function kvSetGallery(key, value) {
  let cleanValue = value;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) || typeof parsed === 'object') {
        console.warn(`⚠️ kvSetGallery received stringified JSON. Parsed before saving.`);
        cleanValue = parsed;
      }
    } catch {
      console.warn(`⚠️ kvSetGallery received a string but couldn't parse it.`);
    }
  }

  const res = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(cleanValue)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ KV set failed for ${key}:`, err);
  }
}

// 🔍 Scan KV for backup keys (sorted descending)
export async function kvScanBackups() {
  let cursor = 0;
  let allKeys = [];

  do {
    const res = await fetch(`${KV_REST_API_URL}/scan/${cursor}?match=gallery:backup:*&count=100`, {
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!res.ok) {
      console.warn("⚠️ Failed to scan gallery backups:", await res.text());
      break;
    }

    const json = await res.json();
    const nextCursor = json?.cursor ?? 0;
    const keys = Array.isArray(json?.keys) ? json.keys : [];

    cursor = nextCursor;
    allKeys.push(...keys);
  } while (cursor !== 0);

  if (allKeys.length === 0) {
    console.warn("⚠️ No gallery backups found in KV.");
  }

  return allKeys.sort().reverse();
}