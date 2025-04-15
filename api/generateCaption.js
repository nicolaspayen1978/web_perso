// /api/generateCaption.js

import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';

// Initialize OpenAI with your API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'Missing filename' });

  const filePath = path.join(process.cwd(), 'photos', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');

  try {
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

    const text = response.choices[0]?.message?.content || '';

    // Extract structured parts
    const title = text.match(/Title:\s*(.*)/i)?.[1]?.trim() || '';
    const description = text.match(/Description:\s*(.*)/i)?.[1]?.trim() || '';

    let tagLine = text.split('\n').find(line => line.toLowerCase().startsWith('tags:'));
    if (!tagLine) {
      tagLine = text.split('\n').find(line => (line.match(/,/g) || []).length >= 2) || '';
    }
    const tags = tagLine
      .replace(/^tags:\s*/i, '')
      .split(',')
      .map(tag => tag.trim().toLowerCase().replace(/^[-*•]\s*/, ''))
      .filter(Boolean);

    // Return suggestions separately so user can approve or edit
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