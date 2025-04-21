// lib/kvGalleryHelpers.js
const fetch = globalThis.fetch || (await import('node-fetch')).default;

const isDevKV = process.env.KV_MODE === 'dev';
const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;
const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

/// ✅ Robust get
export async function kvGetGallery(key) {
  console.warn(`⚠️ kvGetGallery KV_REST_API_TOKEN :`, KV_REST_API_TOKEN);
  console.warn(`⚠️ kvGetGallery KV_REST_API_URL :`, KV_REST_API_URL);
  console.warn(`⚠️ key :`, key);

  const res = await fetch(`${KV_REST_API_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn(`⚠️ Failed to get ${key}:`, errorText);
    return [];
  }

  try {
    let result = await res.json();
    console.log("🧾 Raw result from KV:", result);

    // ✅ Case 1: { result: [...] }
    if (result && Array.isArray(result.result)) {
      console.warn(`✅ ${key} was wrapped in { result: [...] }. Unwrapping.`);
      return result.result;
    }

    // ✅ Case 2: { result: "[...]" } (stringified array)
    if (typeof result?.result === 'string') {
      try {
        const parsed = JSON.parse(result.result);
        if (Array.isArray(parsed)) {
          console.warn(`✅ ${key} had result as stringified array. Parsed and unwrapped.`);
          return parsed;
        }
      } catch (e) {
        console.error(`❌ Failed to parse result.result string:`, e.message);
      }
    }

    // ✅ Case 3: raw array
    if (Array.isArray(result)) {
      return result;
    }

    // ✅ Case 4: objectified array in result.result
    if (result?.result && typeof result.result === 'object') {
      const maybeArray = Object.values(result.result);
      if (maybeArray.every(p => typeof p === 'object' && p !== null)) {
        console.warn(`✅ ${key} had objectified array in result.result. Rehydrated.`);
        return maybeArray;
      }
    }

    // ✅ Case 5: objectified array directly
    if (result && typeof result === 'object') {
      const maybeArray = Object.values(result);
      if (maybeArray.every(p => typeof p === 'object' && p !== null)) {
        console.warn(`✅ ${key} is an objectified array. Rehydrated.`);
        return maybeArray;
      }
    }

    console.warn(`⚠️ Unexpected format for ${key}. Returning empty.`);
    return [];
  } catch (err) {
    console.warn(`❌ Failed to parse KV value for ${key}:`, err.message);
    return [];
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

  // 🔐 Always wrap in { result } for consistency
  const wrapped = { result: cleanValue };

  console.warn(`⚠️ kvSetGallery KV_REST_API_URL:`, KV_REST_API_URL);
  console.warn(`⚠️ key:`, key);
  const res = await fetch(`${KV_REST_API_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(wrapped)
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