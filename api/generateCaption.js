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
    // Send a request to OpenAI with the image and prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Vision-capable model
      messages: [
        {
          role: "user",
          content: [
            // Prompt the model for poetic captioning
            { type: "text", text: "Give a poetic title and a short description of this photo." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`, // Inline Base64 image
                detail: "low" // Lower detail to save tokens and cost
              }
            }
          ]
        }
      ],
      max_tokens: 300 // Cap the response to 300 tokens
    });

    // Extract and clean up the response text
    const text = response.choices[0]?.message?.content || '';

    // Separate the first line as title, and the rest as description
    const [titleLine, ...descLines] = text.trim().split('\n').map(s => s.trim()).filter(Boolean);

    // Remove any surrounding quotes from title
    const title = titleLine.replace(/^["']|["']$/g, '');

    // Join remaining lines as description
    const description = descLines.join(' ');

    // Return the generated title and description as JSON
    res.status(200).json({ title, description });
  } catch (err) {
    // Log any errors and return a server error response
    console.error('🛑 OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
}