// Vercel serverless functie: POST /api/gemini  { image: "<base64 jpeg>" }
// Zet GEMINI_API_KEY (en optioneel GEMINI_MODEL) bij Vercel › Settings › Environment Variables.
import { classifyImage, GeminiError } from '../server/gemini.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Enkel POST' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await classifyImage(body?.image, {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL,
    })
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(result)
  } catch (e) {
    const status = e instanceof GeminiError ? e.status : 500
    return res.status(status).json({ error: e.message ?? 'Onbekende fout' })
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: '3mb' } },
}
