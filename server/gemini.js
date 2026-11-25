// Classificatie van één foto met Google Gemini (SERVERKANT).
// Wordt gebruikt door:
//  - api/gemini.js            (Vercel serverless functie, productie)
//  - vite.config.js plugin    (lokale dev-server en `npm run phone`)
// De API-sleutel (GEMINI_API_KEY) blijft op de server en komt NOOIT in de browser.

export const GEMINI_CLASSES = ['blik', 'pet', 'glas', 'ander', 'geen']
// Eerste model dat antwoordt wint. Bij drukte (503/429) of een verdwenen model valt de
// server terug op het volgende. Overschrijf het eerste met GEMINI_MODEL in .env.
const DEFAULT_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest']
const MAX_IMAGE_BYTES = 2_000_000 // na base64-decodering

const PROMPT = `Je bent een scanner voor drankverpakkingen in België.
Bekijk de foto en bepaal welk drankverpakkingsitem het duidelijkst centraal in beeld is.
Kies precies één klasse:
- "blik": metalen drankblikje
- "pet": plastic (PET) fles
- "glas": glazen fles
- "ander": wel een verpakking/voorwerp, maar geen blik, PET-fles of glazen fles (bv. drankkarton, beker)
- "geen": er is geen verpakking te zien
Let op: beoordeel het MATERIAAL op basis van vorm, dop, wanddikte en reflecties, niet op basis van het merk of de kleur van het etiket (een Coca-Cola-fles is geen blik).
Geef "zekerheid" tussen 0 en 1 en een korte Nederlandse omschrijving (max. 8 woorden, bv. "Blikje Coca-Cola 33 cl").`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    klasse: { type: 'STRING', enum: GEMINI_CLASSES },
    zekerheid: { type: 'NUMBER' },
    omschrijving: { type: 'STRING' },
  },
  required: ['klasse', 'zekerheid', 'omschrijving'],
  propertyOrdering: ['klasse', 'zekerheid', 'omschrijving'],
}

export class GeminiError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

/**
 * @param {string} imageBase64  JPEG als base64 (zonder "data:"-prefix)
 * @param {{ apiKey?: string, model?: string }} opts
 * @returns {Promise<{ klasse: string, zekerheid: number, omschrijving: string, model: string }>}
 */
export async function classifyImage(imageBase64, { apiKey, model } = {}) {
  if (!apiKey) throw new GeminiError('GEMINI_API_KEY ontbreekt op de server (.env of Vercel).', 500)
  if (typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
    throw new GeminiError('Ongeldige afbeelding.', 400)
  }
  if ((imageBase64.length * 3) / 4 > MAX_IMAGE_BYTES) throw new GeminiError('Afbeelding is te groot.', 413)

  const models = [...new Set([model, ...DEFAULT_MODELS].filter(Boolean))]
  let lastError
  for (const useModel of models) {
    try {
      return await callModel(useModel, imageBase64, apiKey)
    } catch (e) {
      lastError = e
      // Enkel doorschuiven bij tijdelijke drukte of een model dat niet (meer) bestaat
      if (!e.retryable) throw e
    }
  }
  throw lastError
}

async function callModel(useModel, imageBase64, apiKey) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(useModel)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
    }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = body?.error?.message ?? `HTTP ${res.status}`
    const err = new GeminiError(`Gemini gaf een fout: ${msg}`, res.status === 429 ? 429 : 502)
    err.retryable = [404, 429, 500, 503].includes(res.status) || /high demand|no longer available|not found/i.test(msg)
    throw err
  }
  const text = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GeminiError('Onverwacht antwoord van Gemini.', 502)
  }
  const klasse = GEMINI_CLASSES.includes(parsed.klasse) ? parsed.klasse : 'ander'
  const zekerheid = Math.min(1, Math.max(0, Number(parsed.zekerheid) || 0))
  const omschrijving = String(parsed.omschrijving ?? '').slice(0, 80)
  return { klasse, zekerheid, omschrijving, model: useModel }
}

/** Leest de JSON-body van een Node-request (voor de Vite-middleware). */
export function readJsonBody(req, limit = 3_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new GeminiError('Afbeelding is te groot.', 413))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new GeminiError('Ongeldige JSON.', 400))
      }
    })
    req.on('error', reject)
  })
}
