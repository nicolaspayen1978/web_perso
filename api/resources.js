// api/resources.js
// This API manages access to resources used by the NicoAI assistant.
// Resources are pulled from Vercel KV, enriched with summaries using OpenAI, and saved back to KV.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { callOpenAI } from '../utils/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine the current environment (dev or production)
const isDevEnv = process.env.VERCEL_ENV !== 'production';

// Choose the correct KV credentials based on environment
const KV_REST_API_URL = isDevEnv
  ? process.env.DEV_KV_REST_API_URL
  : process.env.KV_REST_API_URL;

const KV_REST_API_TOKEN = isDevEnv
  ? process.env.DEV_KV_REST_API_TOKEN
  : process.env.KV_REST_API_TOKEN;

// Load static resource list and pre-fetched content (from build)
const RESOURCES_PATH = path.join(__dirname, "../resources.json");
const contentPath = path.join(__dirname, "../resourcesContent.json");

let fullResourceContent = {};
if (fs.existsSync(contentPath)) {
  fullResourceContent = JSON.parse(fs.readFileSync(contentPath, "utf-8"));
}

// Global store for enriched resource metadata
let resourceDescriptions = {};

// Load resource data from Vercel KV and enrich missing descriptions via OpenAI
async function loadResources() {
  try {
    console.log("📥 Fetching resources from Vercel KV...");

    const response = await fetch(`${KV_REST_API_URL}/get/resources`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${KV_REST_API_TOKEN}` }
    });

    if (!response.ok) {
      console.error("❌ Failed to fetch from Vercel KV:", await response.text());
      return;
    }

    const data = await response.json();
    resourceDescriptions = data || {};

    console.log("✅ Resources loaded successfully. Checking for missing descriptions...");

    let needsUpdate = false;

    // Loop through each category and item
    for (const [category, items] of Object.entries(resourceDescriptions)) {
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item.description === "-1") {
            console.log(`🔍 Missing description for: ${item.title}`);
            needsUpdate = true;
            item.description = await summarizeItem(category, item);
          } else {
            console.log(`✅ Using existing description for: ${item.title}`);
          }
        }
      } else if (typeof items === "object" && items !== null) {
        for (const [key, value] of Object.entries(items)) {
          if (value.description === "-1") {
            console.log(`🔍 Missing description for: ${key}`);
            needsUpdate = true;
            value.description = await summarizeItem(category, { title: key, url: value });
          } else {
            console.log(`✅ Using existing description for: ${key}`);
          }
        }
      }

      // Save back to KV if updates were made
      if (needsUpdate) {
        console.log("📤 Updating Vercel KV with new descriptions...");
        await saveResources();
        needsUpdate = false;
      }
    }
  } catch (error) {
    console.error("⚠️ Error fetching resources:", error);
  }
}

// Save the updated resources to Vercel KV
async function saveResources() {
  try {
    console.log("📤 Saving updated resources to Vercel KV...");

    const response = await fetch(`${KV_REST_API_URL}/set/resources`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${KV_REST_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(resourceDescriptions)
    });

    if (!response.ok) {
      console.error("❌ Failed to save to Vercel KV:", await response.text());
      return;
    }

    console.log("✅ Successfully updated resources in Vercel KV!");
  } catch (error) {
    console.error("⚠️ Error saving resources:", error);
  }
}

// 🔧 Update or add a description for a given item
async function updateResourceDescription(category, itemTitle, newDescription) {
  if (!resourceDescriptions[category]) {
    resourceDescriptions[category] = [];
  }

  const itemIndex = resourceDescriptions[category].findIndex(item => item.title === itemTitle);

  if (itemIndex !== -1) {
    // Update existing
    resourceDescriptions[category][itemIndex].description = newDescription;
  } else {
    // Add new if not found
    resourceDescriptions[category].push({ title: itemTitle, description: newDescription });
  }

  await saveResources(); // Save updated version to KV
}

// 🧠 Summarize a resource using OpenAI
async function summarizeItem(category, item) {
  const prompt = {
    role: "system",
    content: `The following content titled "${item.title}" from "${item.url}" needs a short, accurate summary of its content in 100 words. Do NOT assume the topic based on the title or other headlines. The summary must reflect the actual content and not be a general explanation.`
  };

  console.log(`📩 Calling OpenAI for summary: ${item.title} (${item.url})`);
  let response = await callOpenAI(prompt);

  if (!response || response.trim() === "") {
    console.warn(`⚠️ OpenAI returned an empty response for: ${item.title}. Setting description to "-1" for retry.`);
    response = "-1"; // Flag it as missing
  }

  console.log(`📝 OpenAI Response:`, response);
  await updateResourceDescription(category, item.title, response);
  return response;
}

// 🛠️ Generate descriptions for all resources (with progress updates)
async function generateResourceDescriptions(resources, updateProgress) {
  let descriptions = { ...resources };
  let totalItems = Object.values(resources)
    .flatMap(items => Array.isArray(items) ? items : Object.values(items)).length;

  let processedItems = 0;

  for (const [category, items] of Object.entries(resources)) {
    if (Array.isArray(items)) {
      descriptions[category] = [];

      for (const item of items) {
        if (!item.description || item.description.trim() === "" || item.description === "-1") {
          let summary = await summarizeItem(category, item);
          item.description = summary;
        }

        processedItems++;
        let progress = Math.round((processedItems / totalItems) * 100);
        console.log(`📊 Progress: ${progress}%`);

        if (typeof updateProgress === "function") {
          updateProgress(progress);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } else if (typeof items === "object" && items !== null) {
      descriptions[category] = {};

      for (const [key, value] of Object.entries(items)) {
        if (!value.description || value.description.trim() === "" || value.description === "-1") {
          let summary = await summarizeItem(category, { title: key, url: value });
          value.description = summary;
        }

        processedItems++;
        let progress = Math.round((processedItems / totalItems) * 100);
        console.log(`📊 Progress: ${progress}%`);

        if (typeof updateProgress === "function") {
          updateProgress(progress);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } else {
      console.error(`⚠️ Warning: '${category}' is not an array or object. Skipping.`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // pause between categories
  }

  return descriptions;
}