// utils/utils.js
// This utility manages visitor sessions and OpenAI requests for the NicoAI chatbot.
// It supports both production and development environments and persists visitor session state in Vercel KV.

const fs = require("fs");
const path = require("path");

// 🌍 Determine environment
const isDevEnv = process.env.VERCEL_ENV !== 'production';

// 🔐 Load correct KV credentials based on environment
const KV_REST_API_URL = isDevEnv
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevEnv
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// =====================
// Visitor Session Logic
// =====================

/**
 * Load the current visitorSessions object from KV.
 * This object holds which visitors have already initialized NicoAI.
 */
async function loadVisitorSessions() {
  try {
    console.log("📥 Loading visitor sessions from Vercel KV...");
    const response = await fetch(`${KV_REST_API_URL}/get/visitorSessions`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${KV_REST_API_TOKEN}` }
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
 * Called when a visitor initializes NicoAI for the first time.
 */
async function saveVisitorSessions(visitorSessions) {
  try {
    console.log("📤 Saving visitor sessions to Vercel KV...");
    await fetch(`${KV_REST_API_URL}/set/visitorSessions`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${KV_REST_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(visitorSessions)
    });
    console.log("✅ Successfully saved visitor sessions to Vercel KV!");
  } catch (error) {
    console.error("⚠️ Error saving visitor sessions:", error);
  }
}

// 🧠 In-memory visitor session cache (loaded at startup)
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
 * Call OpenAI (GPT or OAI API) with retry, error handling, and dynamic token limit.
 * This uses o3-mini or compatible models and assumes a completion-style API.
 * 
 * @param {Array|Object} prompt - A prompt array (preferred) or single prompt.
 * @param {number} retryCount - Number of retries on failure.
 * @returns {Promise<string>} - The generated message content, or error fallback.
 */
async function callOpenAI(prompt, retryCount = 3) {
  let attempts = 0;

  while (attempts < retryCount) {
    try {
      console.log(`🟢 Attempt ${attempts + 1}: Sending request to OpenAI...`);
      console.log("🔍 Full OpenAI Prompt:\n", prompt);

      // Set timeout controller
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // ⏳ 20s timeout

      // Dynamically adjust max tokens based on prompt size
      let maxTokens = Math.min(700, Math.max(700, prompt.length / 3));

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "o3-mini",  // or "gpt-4-turbo" if available
          messages: Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }],
          max_completion_tokens: Math.floor(maxTokens),
          reasoning_effort: "low",
          frequency_penalty: 0,
          presence_penalty: 0
        }),
        signal: controller.signal
      });

      clearTimeout(timeout); // Clear timeout on success

      if (!response.ok) {
        const errorMessage = await response.text();
        console.error(`❌ OpenAI API error: ${response.status} - ${errorMessage}`);

        if (response.status === 429 && errorMessage.includes("TPM")) {
          console.log("🔽 Reducing token count and retrying...");
          prompt = prompt.substring(0, prompt.length * 0.7); // reduce prompt size
        }

        if (++attempts < retryCount) {
          await new Promise(r => setTimeout(r, 2000 * attempts)); // exponential backoff
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

// Export all functions for other modules
module.exports = {
  isNicoAIInitialized,
  markNicoAIInitialized,
  callOpenAI
};