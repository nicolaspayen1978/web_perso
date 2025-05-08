// utils/chatAI_utils.js
// This utility manages visitor sessions and OpenAI requests for the NicoAI chatbot.

import fs from 'node:fs';
import path from 'node:path';

// 🌍 Determine environment
const isDevKV = process.env.KV_MODE === 'dev';

const KV_REST_API_URL = isDevKV
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevKV
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =====================
// Visitor Session Logic
// =====================

/**
 * Load the current visitorSessions object from KV.
 */
async function loadVisitorSessions() {
  try {
    console.log("📥 Loading visitor sessions from Vercel KV...");
    const response = await fetch(`${KV_REST_API_URL}/get/visitorSessions`, {
      method: "GET",
      headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!response.ok) throw new Error(`KV fetch failed: ${response.status}`);
    return await response.json() || {};
  } catch (error) {
    console.error("⚠️ Error loading visitor sessions:", error);
    return {}; // fallback to empty session map
  }
}

/**
 * Save the visitorSessions object back to KV.
 */
async function saveVisitorSessions(visitorSessions) {
  try {
    console.log("📤 Saving visitor sessions to Vercel KV...");
    await fetch(`${KV_REST_API_URL}/set/visitorSessions`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${KV_REST_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(visitorSessions)
    });
    console.log("✅ Successfully saved visitor sessions to Vercel KV!");
  } catch (error) {
    console.error("⚠️ Error saving visitor sessions:", error);
  }
}

// 🧠 In-memory visitor session cache
let visitorSessions = {};
loadVisitorSessions().then(data => visitorSessions = data);

/**
 * Check if NicoAI has been initialized for a visitor.
 */
function isNicoAIInitialized(visitorID) {
  return visitorSessions[visitorID]?.initialized;
}

/**
 * Mark a visitor as having initialized NicoAI, and persist it to KV.
 */
async function markNicoAIInitialized(visitorID) {
  visitorSessions[visitorID] = { initialized: true };
  await saveVisitorSessions(visitorSessions);
}

// ======================
// OpenAI Interaction
// ======================

/**
 * Call OpenAI with retries and dynamic token control.
 */
async function callOpenAI(prompt, retryCount = 3) {
  let attempts = 0;

  while (attempts < retryCount) {
    try {
      console.log(`🟢 Attempt ${attempts + 1}: Sending request to OpenAI...`);
      console.log("🔍 Full OpenAI Prompt:\n", prompt);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      const maxTokens = Math.min(700, Math.max(700, prompt.length / 3));

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "o3-mini",
          messages: Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }],
          max_completion_tokens: Math.floor(maxTokens),
          reasoning_effort: "low",
          frequency_penalty: 0,
          presence_penalty: 0
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorMessage = await response.text();
        console.error(`❌ OpenAI API error: ${response.status} - ${errorMessage}`);

        if (response.status === 429 && errorMessage.includes("TPM")) {
          console.log("🔽 Reducing token count and retrying...");
          prompt = prompt.substring(0, prompt.length * 0.7);
        }

        if (++attempts < retryCount) {
          await new Promise(r => setTimeout(r, 2000 * attempts));
          continue;
        }

        return "Error calling OpenAI. Please try again.";
      }

      const data = await response.json();
      console.log(`✅ OpenAI Response Data:`, JSON.stringify(data, null, 2));

      return data.choices?.[0]?.message?.content?.trim() || "No response available.";
    } catch (error) {
      console.error(`⚠️ Error calling OpenAI (Attempt ${attempts + 1}):`, error);

      if (++attempts < retryCount) {
        await new Promise(r => setTimeout(r, 2000 * attempts));
        continue;
      }

      return "Error calling OpenAI after multiple attempts.";
    }
  }
}

function formatLinks(message) {
  if (!message || typeof message !== "string") return message || "";
  return message.replace(
    /\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, title, url) => `🔗 <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`
  );
}

// ===================
// Exported Functions
// ===================
export {
  isNicoAIInitialized,
  markNicoAIInitialized,
  callOpenAI,
  formatLinks // ← now it's exported!
};
