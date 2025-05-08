// /api/generateCaption.js
// This API endpoint uses OpenAI's GPT-4o model to generate a poetic title, description, and tags
// for a given photo based on its visual content.
// Native Node.js and OpenAI modules
import fs from 'node:fs';
import path from 'node:path';
import { OpenAI } from 'openai';

// 🔐 Initialize OpenAI with secret key (from .env or Vercel env variables)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // ❌ Only accept POST requests
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  // 📥 Validate input
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Missing filename' });

  // 📂 Find the file path on the server
  const filePath = path.join(process.cwd(), 'photos', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // 📷 Read and encode image as base64
  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');

  try {
    // 🤖 Ask OpenAI to caption the photo with poetic flair
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are Nicolas Payen — a quiet observer of the world, a poetic realist.

Please respond strictly in the following format:

Title: [short poetic title, max 8 words]  
Description: [1–2 elegant sentences]  
Tags: [4–6 lowercase tags, comma-separated]

Example:  
Title: The Silence of Dusk  
Description: A tree stands in the half-light, alone but proud. The wind knows its story.  
Tags: blackandwhite, landscape, tree, twilight, solitude, poetry`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low"
              }
            }
          ]
        }
      ],
      max_tokens: 400
    });

    // 📤 Parse the structured response
    const text = response.choices[0]?.message?.content || '';

    // 🧠 Extract Title
    const title = text.match(/Title:\s*(.*)/i)?.[1]?.trim() || '';

    // 🧠 Extract Description
    const description = text.match(/Description:\s*(.*)/i)?.[1]?.trim() || '';

    // 🧠 Extract Tags
    let tagLine = text.split('\n').find(line => line.toLowerCase().startsWith('tags:'));
    if (!tagLine) {
      // Fallback: find line with multiple commas if 'Tags:' not found
      tagLine = text.split('\n').find(line => (line.match(/,/g) || []).length >= 2) || '';
    }

    const tags = tagLine
      .replace(/^tags:\s*/i, '')
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);

    // ✅ Return AI-generated suggestions to the frontend
    res.status(200).json({
      ai_title: title,
      ai_description: description,
      ai_tags: tags
    });

  } catch (err) {
    console.error('🛑 OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
}