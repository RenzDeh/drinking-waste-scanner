// Inferentie OP HET TOESTEL met Roboflow inferencejs (TensorFlow.js in een Web Worker).
// De publishable key wordt enkel gebruikt om de modelgewichten te downloaden;
// camerabeelden worden lokaal verwerkt en NOOIT naar een server gestuurd.
//
// inferencejs >= 1.3 ondersteunt RF-DETR (modelType "rfdetr..."): de worker kiest zelf
// de juiste pre-/postprocessing op basis van de modelmetadata van Roboflow.

import { DETECTION, MODEL_LABELS } from '../config'

const env = import.meta.env

/** Vertaal modellabels (can/glass/pet) naar app-klassen (blik/glas/pet); onbekende labels vallen weg. */
export function normalizeDetections(detections) {
  return detections
    .map((d) => ({ ...d, class: MODEL_LABELS[String(d.class ?? '').toLowerCase().trim()] }))
    .filter((d) => d.class)
}
const KEY = env.VITE_ROBOFLOW_PUBLISHABLE_KEY
const MODEL = env.VITE_ROBOFLOW_MODEL
const VERSION = env.VITE_ROBOFLOW_VERSION

let enginePromise = null
let workerPromise = null

/** Korte naam van het model voor de debug-chip, bv. "v4". */
export const MODEL_LABEL = (MODEL?.match(/-(d+)-rfdetr/)?.[1] ? 'v' + MODEL.match(/-(d+)-rfdetr/)[1] : MODEL?.split('/').pop()) ?? '?'

export function inferenceConfigError() {
  if (!KEY) return 'VITE_ROBOFLOW_PUBLISHABLE_KEY ontbreekt in .env'
  if (!MODEL) return 'VITE_ROBOFLOW_MODEL ontbreekt in .env'
  return null
}

async function getEngine() {
  if (!enginePromise) {
    // Dynamische import: de zware TF.js-bundle laadt pas als je naar het scanscherm gaat.
    enginePromise = import('inferencejs').then(({ InferenceEngine }) => new InferenceEngine())
  }
  return enginePromise
}

/** Laadt het model (één keer per sessie) en geeft het workerId terug. */
export async function loadModel() {
  const err = inferenceConfigError()
  if (err) throw new Error(err)
  if (!workerPromise) {
    workerPromise = (async () => {
      const engine = await getEngine()
      // Met versie => legacy project + versie, zonder => volledige model-id "workspace/slug".
      if (VERSION && !MODEL.includes('/')) {
        return engine.startWorker(MODEL, Number(VERSION), KEY)
      }
      return engine.startWorkerByModelId(MODEL, KEY)
    })().catch((e) => {
      workerPromise = null // opnieuw proberen mogelijk maken
      throw e
    })
  }
  return workerPromise
}

/** Start het laden op de achtergrond; fouten worden later in het scanscherm getoond. */
export function preloadModel() {
  if (inferenceConfigError()) return
  loadModel().catch(() => {})
}

/**
 * Scangebied in het midden van het beeld (breedte/hoogte = `aspect`).
 * Het model krijgt altijd een vierkant beeld; dit gebied wordt daarnaartoe GEREKT.
 *
 * Belangrijk: het model moet de items zien zoals in de trainingsfoto's. Roboflow
 * ("Resize: Stretch to 640x640") rekt een staande iPhone-foto (3:4) samen tot een vierkant,
 * waardoor alles lager en breder wordt. Met aspect 3:4 doen we in de app precies hetzelfde.
 * Met aspect 1 (vierkant) is er geen vervorming; dan lijkt een PET-fles slanker dan in de
 * training en wordt ze sneller voor een glazen fles aangezien.
 */
export function scanRegion(videoWidth, videoHeight, aspect = DETECTION.regionAspect ?? 1) {
  let w, h
  if (videoWidth / videoHeight > aspect) {
    h = videoHeight
    w = h * aspect
  } else {
    w = videoWidth
    h = w / aspect
  }
  w = Math.round(w)
  h = Math.round(h)
  return { x: Math.round((videoWidth - w) / 2), y: Math.round((videoHeight - h) / 2), w, h }
}

/**
 * Detecteer objecten in het huidige videoframe (enkel in het vierkante scangebied).
 * Geeft [{ class, confidence, bbox: { x, y, width, height } }] terug, waarbij x/y het
 * MIDDELPUNT van het kader is, in pixels van de VOLLEDIGE video (videoWidth x videoHeight).
 */
// Eén herbruikbaar canvas waarop we het scangebied verkleind tekenen.
let frameCanvas = null

export async function detect(video, debugCanvas = null) {
  const workerId = await loadModel()
  const engine = await getEngine()
  const r = scanRegion(video.videoWidth, video.videoHeight)

  // GEHEUGEN (iOS): inferencejs stuurt het ImageBitmap naar zijn worker en geeft het daar
  // niet expliciet vrij. Met volle camerabeelden (720x720+) loopt het geheugen op een
  // iPhone snel vol en crasht Safari ("A problem repeatedly occurred"). Daarom verkleinen
  // we het scangebied eerst tot de inputgrootte van het model; dat doet het model toch.
  const s = DETECTION.inputSize
  frameCanvas ??= Object.assign(document.createElement('canvas'), { width: s, height: s })
  const fctx = frameCanvas.getContext('2d', { willReadFrequently: false })
  fctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, s, s) // rekt het gebied tot s x s
  // Debug: toon exact het beeld dat naar het model gaat (lokaal, wordt nergens bewaard)
  if (debugCanvas) {
    try {
      debugCanvas.getContext('2d').drawImage(frameCanvas, 0, 0, debugCanvas.width, debugCanvas.height)
    } catch {
      /* negeren */
    }
  }
  const bitmap = await createImageBitmap(frameCanvas)
  const scaleX = r.w / s
  const scaleY = r.h / s
  try {
    // options worden in de worker als model.configure(...options) toegepast
    const result = await engine.infer(workerId, bitmap, [{ scoreThreshold: DETECTION.modelScoreThreshold }])
    // kaders terug naar pixels van de volledige video
    return normalizeDetections(Array.isArray(result) ? result : []).map((d) => ({
      ...d,
      bbox: {
        x: d.bbox.x * scaleX + r.x,
        y: d.bbox.y * scaleY + r.y,
        width: d.bbox.width * scaleX,
        height: d.bbox.height * scaleY,
      },
    }))
  } finally {
    try {
      bitmap.close()
    } catch {
      /* al overgedragen aan de worker */
    }
  }
}
