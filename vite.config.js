import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { classifyImage, GeminiError, readJsonBody } from './server/gemini.js'

// Lokale versie van de Vercel-functie api/gemini.js, zodat de Gemini-modus ook werkt
// met `npm run dev` en `npm run phone`. De sleutel blijft in Node (server), nooit in de browser.
function geminiApi(env) {
  const handler = async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/gemini') return next()
    const send = (status, obj) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(obj))
    }
    if (req.method !== 'POST') return send(405, { error: 'Enkel POST' })
    try {
      const body = await readJsonBody(req)
      send(200, await classifyImage(body.image, { apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL }))
    } catch (e) {
      send(e instanceof GeminiError ? e.status : 500, { error: e.message ?? 'Onbekende fout' })
    }
  }
  return {
    name: 'gemini-api',
    // Let op: niets teruggeven (een teruggegeven functie voert Vite uit als "post"-hook)
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

// `npm run dev:phone` start de dev-server met een zelfondertekend HTTPS-certificaat
// op je lokale netwerk, zodat de camera ook op je iPhone werkt (camera vereist HTTPS).
export default defineConfig(({ mode }) => {
  // '' = ook variabelen ZONDER VITE_-prefix laden (enkel hier op de server gebruikt)
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), geminiApi(env), ...(mode === 'phone' ? [basicSsl()] : [])],
    build: {
      // inferencejs bundelt TensorFlow.js; die chunk is groot, dat is normaal.
      chunkSizeWarningLimit: 8000,
    },
    test: {
      environment: 'node',
    },
  }
})
