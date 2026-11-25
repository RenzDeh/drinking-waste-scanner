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
 * Vierkant scangebied in het midden van het beeld.
 * Het model verwacht een vierkant beeld (384x384) en inferencejs REKT elk beeld daarnaartoe.
 * Een breed (16:9) of hoog (9:16) camerabeeld zou dan vervormen: een blikje wordt een
 * "flesje", een grote PET-fles een slanke "glazen fles". Daarom knippen we eerst een
 * vierkant uit het midden, zonder vervorming.
 */
export function scanRegion(videoWidth, videoHeight) {
  const size = Math.min(videoWidth, videoHeight)
  return { x: Math.round((videoWidth - size) / 2), y: Math.round((videoHeight - size) / 2), size }
}

/**
 * Detecteer objecten in het huidige videoframe (enkel in het vierkante scangebied).
 * Geeft [{ class, confidence, bbox: { x, y, width, height } }] terug, waarbij x/y het
 * MIDDELPUNT van het kader is, in pixels van de VOLLEDIGE video (videoWidth x videoHeight).
 */
export async function detect(video, debugCanvas = null) {
  const workerId = await loadModel()
  const engine = await getEngine()
  const r = scanRegion(video.videoWidth, video.videoHeight)
  // ImageBitmap wordt naar de worker gestuurd; het frame blijft in het geheugen van het toestel.
  const bitmap = await createImageBitmap(video, r.x, r.y, r.size, r.size)
  // Debug: toon exact het beeld dat naar het model gaat (lokaal, wordt nergens bewaard)
  if (debugCanvas) {
    try {
      debugCanvas.getContext('2d').drawImage(bitmap, 0, 0, debugCanvas.width, debugCanvas.height)
    } catch {
      /* negeren */
    }
  }
  try {
    // options worden in de worker als model.configure(...options) toegepast
    const result = await engine.infer(workerId, bitmap, [{ scoreThreshold: DETECTION.modelScoreThreshold }])
    return normalizeDetections(Array.isArray(result) ? result : []).map((d) => ({
      ...d,
      bbox: { ...d.bbox, x: d.bbox.x + r.x, y: d.bbox.y + r.y },
    }))
  } finally {
    try {
      bitmap.close()
    } catch {
      /* al overgedragen aan de worker */
    }
  }
}
