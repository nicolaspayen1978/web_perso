// utils/chatAI_extractRelevantSummaries.js
// Given a user question and a matched resource, generates 2 short, relevant bullet summaries using OpenAI

import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generates 2 focused summaries from a resource based on user question.
 * @param {string} userQuestion - The question asked by the user
 * @param {object} resourceEntry - A matched resource with at least title + content
 * @param {number} maxRetries - Retry attempts in case of failure (default: 3)
 * @returns {Promise<string[]>} - Array of 2 summary strings
 */
export async function extractRelevantSummaries(userQuestion, resourceEntry, maxRetries = 3) {
  const prompt = `
You are a helpful assistant. Given the user question and a resource article,
please extract two short, focused summaries (about 50 words each) that help answer the question.
Use only facts from the resource content.

User Question:
"${userQuestion}"

Resource Title:
"${resourceEntry.title}"

Resource Content:
${resourceEntry.content.slice(0, 3000)}

Respond as a JSON array of 2 short strings.`;

  while (maxRetries > 0) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4
      });

      const text = response.choices[0].message.content.trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length === 2) return parsed;

      throw new Error('Unexpected format in OpenAI response');
    } catch (err) {
      console.warn(`⚠️ OpenAI retry (${4 - maxRetries}/3):`, err.message);
      maxRetries--;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.error(`❌ Failed to generate summaries for: ${resourceEntry.title}`);
  return [];
}
