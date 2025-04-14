// /api/generateCaption.js

import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

// Initialize the OpenAI SDK with your API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  // Only allow POST requests to this endpoint
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  // Extract the filename of the image from the request body
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Missing filename' });

  // Build the full file path and check if the image file exists
  const filePath = path.join(process.cwd(), 'photos', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  // Read the image file and convert it to a Base64 string
  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');

  try {
    // Send a request to OpenAI with the image and your poetic prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Vision-capable model
      messages: [
        {
          role: "user",
          content: [
            // Your refined and personal prompt
            {
              type: "text",
              text: `You are Nicolas Payen — a quiet observer of the world, a poetic realist. Give this photo:
1. A beautiful, thoughtful title (max 8 words) that feels like a memory, and a short description that captures light, stillness, and meaning — with elegance and soul.
2. A refined description (1–2 elegant sentences) as if you're whispering it to someone you love.
3. A list of tags (3 to 6) describing the subject, style, theme, mood, location, or content.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low" // Save cost while still extracting overall mood
              }
            }
          ]
        }
      ],
      max_tokens: 400 // Slightly increased for tags + more descriptive style
    });

    // Extract and clean up the response text
    const text = response.choices[0]?.message?.content || '';

    // Attempt to separate title, description and tags
    const lines = text.trim().split('\n').map(s => s.trim()).filter(Boolean);
    const titleLine = lines[0];
    const tagLines = lines.filter(l => l.toLowerCase().startsWith('tags:') || l.startsWith('-') || l.startsWith('*') || l.includes(','));
    const descriptionLines = lines.filter(l => l !== titleLine && !tagLines.includes(l));

    // Remove quotes and return structured data
    const title = titleLine.replace(/^["']|["']$/g, '');
    const description = descriptionLines.join(' ');
    const tagsRaw = tagLines.join(',').replace(/^tags?:/i, '');
    const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

    // Return everything to the client
    res.status(200).json({ title, description, tags });
  } catch (err) {
    // Handle errors gracefully
    console.error('🛑 OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
}