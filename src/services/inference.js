// Inferentie OP HET TOESTEL met Roboflow inferencejs (TensorFlow.js in een Web Worker).
// De publishable key wordt enkel gebruikt om de modelgewichten te downloaden;
// camerabeelden worden lokaal verwerkt en NOOIT naar een server gestuurd.
//
// inferencejs >= 1.3 ondersteunt RF-DETR (modelType "rfdetr..."): de worker kiest zelf
// de juiste pre-/postprocessing op basis van de modelmetadata van Roboflow.

const env = import.meta.env
const KEY = env.VITE_ROBOFLOW_PUBLISHABLE_KEY
const MODEL = env.VITE_ROBOFLOW_MODEL
const VERSION = env.VITE_ROBOFLOW_VERSION

let enginePromise = null
let workerPromise = null

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

/**
 * Detecteer objecten in het huidige videoframe.
 * Geeft [{ class, confidence, bbox: { x, y, width, height } }] terug, waarbij x/y het
 * MIDDELPUNT van het kader is, in pixels van de video (videoWidth x videoHeight).
 */
export async function detect(video) {
  const workerId = await loadModel()
  const engine = await getEngine()
  // ImageBitmap wordt naar de worker gestuurd; het frame blijft in het geheugen van het toestel.
  const bitmap = await createImageBitmap(video)
  try {
    const result = await engine.infer(workerId, bitmap)
    return Array.isArray(result) ? result : []
  } finally {
    try {
      bitmap.close()
    } catch {
      /* al overgedragen aan de worker */
    }
  }
}
