// Gemini-modus (CLIENT): één foto naar onze eigen server-endpoint sturen.
// De server (api/gemini.js of de Vite-middleware) praat met Google; de API-sleutel
// komt dus nooit in de browser. LET OP: in deze modus verlaat de foto wel het toestel.

const MAX_SIDE = 768 // langste zijde van de foto die we versturen (genoeg voor herkenning)

/** Maakt een JPEG (base64, zonder prefix) van het huidige videoframe. */
export function captureFrame(video) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const scale = Math.min(1, MAX_SIDE / Math.max(vw, vh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(vw * scale)
  canvas.height = Math.round(vh * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
  return { base64: dataUrl.split(',')[1], dataUrl }
}

/** @returns {Promise<{ klasse: 'blik'|'pet'|'glas'|'ander'|'geen', zekerheid: number, omschrijving: string, model: string }>} */
export async function classifyWithGemini(base64, { timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 }),
      signal: ctrl.signal,
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `Serverfout (${res.status})`)
    return body
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Gemini antwoordde niet binnen 30 seconden.')
    throw e
  } finally {
    clearTimeout(timer)
  }
}
