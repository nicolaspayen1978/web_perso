// /api/generateCaption.js

import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { OpenAI } from 'openai';

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

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Give a poetic and elegant photo title, and a short artistic description of this image.' },
            {
              type: 'image_url',
              image_url: {
                detail: 'low',
                url: `data:image/jpeg;base64,${fileBuffer.toString('base64')}`
              }
            }
          ]
        }
      ],
      max_tokens: 300
    });

    const text = response.choices[0]?.message?.content || '';
    const [titleLine, ...descLines] = text.trim().split('\n').map(s => s.trim()).filter(Boolean);
    const title = titleLine.replace(/^["']|["']$/g, '');
    const description = descLines.join(' ');

    res.status(200).json({ title, description });
  } catch (err) {
    console.error('🛑 OpenAI error:', err);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
}