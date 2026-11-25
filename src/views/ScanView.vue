<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCamera } from '../composables/useCamera'
import { detect, inferenceConfigError, loadModel, MODEL_LABEL, scanRegion } from '../services/inference'
import { createScanTrigger } from '../lib/scanTrigger'
import { buzz } from '../lib/haptics'
import { boxRejectReason } from '../lib/boxFilter'
import { crumb, endSession, startSession } from '../lib/breadcrumbs'
import { CLASS_INFO, CLASSES, DETECTION, RESULT_MS, TRIGGER } from '../config'

const video = ref(null)
const canvas = ref(null)
const debugCanvas = ref(null)
const camera = useCamera()

const modelStatus = ref('idle') // idle | loading | ready | error
const modelError = ref('')
const progress = ref(0)
const candidate = ref(null)
const cooldown = ref(false)
const lastSeenAt = ref(performance.now())
const now = ref(performance.now())
const fps = ref(0)
const tooBig = ref(false)
const debugTop = ref('')
const crashInfo = ref(null) // laatste stap van een vorige sessie die crashte

// Resultaat-popup + historiek van deze sessie (enkel in het geheugen, nergens opgeslagen)
const result = ref(null)
const history = ref([])
let resultTimer = null

let running = false
const trigger = createScanTrigger(TRIGGER)

const ready = computed(() => modelStatus.value === 'ready' && camera.status.value === 'ready')
const noDetection = computed(() => ready.value && !cooldown.value && now.value - lastSeenAt.value > 2500)

const statusLine = computed(() => {
  if (cooldown.value) return 'Haal het item uit beeld voor de volgende scan'
  if (candidate.value) return `${CLASS_INFO[candidate.value]?.long ?? candidate.value} herkend — even stilhouden`
  if (tooBig.value) return 'Te dichtbij — houd het item iets verder weg'
  if (noDetection.value) return 'Geen blik of fles in beeld'
  return 'Houd een blikje of fles in het kader'
})

const statusChip = computed(() => {
  if (modelStatus.value === 'error') return { text: 'Model niet geladen', tone: 'error' }
  if (camera.status.value === 'denied') return { text: 'Geen camera', tone: 'error' }
  if (modelStatus.value === 'loading') return { text: 'Model laden…', tone: 'busy' }
  if (camera.status.value === 'starting') return { text: 'Camera starten…', tone: 'busy' }
  if (ready.value) return { text: `Klaar · ${fps.value} fps`, tone: 'ok' }
  return { text: 'Opstarten…', tone: 'busy' }
})

const counts = computed(() => CLASSES.map((k) => ({ k, ...CLASS_INFO[k], n: history.value.filter((h) => h.klasse === k).length })))
const timeFmt = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

function onValidScan({ klasse, zekerheid }) {
  if (!CLASSES.includes(klasse)) return
  const item = { id: Date.now(), klasse, zekerheid, tijd: new Date(), ...CLASS_INFO[klasse] }
  history.value = [item, ...history.value].slice(0, 20)
  result.value = item
  buzz()
  clearTimeout(resultTimer)
  resultTimer = setTimeout(() => (result.value = null), RESULT_MS)
}

function closeResult() {
  clearTimeout(resultTimer)
  result.value = null
}

function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
  else ctx.rect(x, y, w, h)
}

function draw(detections) {
  const v = video.value
  const c = canvas.value
  if (!v || !c) return
  if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
    c.width = v.videoWidth
    c.height = v.videoHeight
  }
  const ctx = c.getContext('2d')
  ctx.clearRect(0, 0, c.width, c.height)
  const unit = Math.max(c.width, c.height) / 400

  // Buiten het scangebied kijkt het model niet: dat deel dimmen
  const r = scanRegion(c.width, c.height)
  ctx.fillStyle = 'rgba(17, 17, 17, 0.5)'
  ctx.fillRect(0, 0, c.width, r.y)
  ctx.fillRect(0, r.y + r.h, c.width, c.height - r.y - r.h)
  ctx.fillRect(0, r.y, r.x, r.h)
  ctx.fillRect(r.x + r.w, r.y, c.width - r.x - r.w, r.h)

  // Hoekjes van het scankader
  const L = Math.min(r.w, r.h) * 0.12
  const inset = unit * 4
  const x0 = r.x + inset, y0 = r.y + inset, x1 = r.x + r.w - inset, y1 = r.y + r.h - inset
  ctx.strokeStyle = cooldown.value ? '#22c55e' : 'rgba(255,255,255,0.95)'
  ctx.lineWidth = Math.max(3, unit * 2)
  ctx.lineCap = 'round'
  ctx.beginPath()
  for (const [x, y, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    ctx.moveTo(x, y + dy * L)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * L, y)
  }
  ctx.stroke()

  ctx.lineWidth = Math.max(2, unit * 1.4)
  ctx.font = `600 ${Math.round(unit * 8)}px Inter, system-ui, sans-serif`
  ctx.textBaseline = 'top'
  for (const d of detections) {
    // Afgekeurde kaders (bv. een persoon) grijs en gestreept tekenen
    const color = d.reject ? '#9ca3af' : (CLASS_INFO[d.class]?.color ?? '#ffffff')
    const x = d.bbox.x - d.bbox.width / 2 // bbox.x/y = middelpunt
    const y = d.bbox.y - d.bbox.height / 2
    const strong = !d.reject && d.confidence > TRIGGER.confidenceThreshold
    ctx.strokeStyle = color
    ctx.setLineDash(strong ? [] : [unit * 4, unit * 3])
    ctx.beginPath()
    roundedRect(ctx, x, y, d.bbox.width, d.bbox.height, unit * 4)
    ctx.stroke()
    ctx.setLineDash([])

    const label = d.reject ? 'genegeerd' : `${CLASS_INFO[d.class]?.label ?? d.class} · ${Math.round(d.confidence * 100)}%`
    const pad = unit * 3
    const tw = ctx.measureText(label).width
    const th = unit * 8
    const ly = y - th - pad * 2 - unit * 2 < 0 ? y + unit * 2 : y - th - pad * 2 - unit * 2
    ctx.fillStyle = color
    ctx.beginPath()
    roundedRect(ctx, x, ly, tw + pad * 2, th + pad * 2, (th + pad * 2) / 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, x + pad, ly + pad)
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loop() {
  let frames = 0
  let fpsStart = performance.now()
  let failures = 0
  let totalFrames = 0
  while (running) {
    if (document.hidden || video.value?.readyState < 2) {
      await sleep(250)
      continue
    }
    const t0 = performance.now()
    let detections = []
    try {
      if (totalFrames === 0) crumb('eerste detectie gestart')
      const raw = await detect(video.value, DETECTION.showDebug ? debugCanvas.value : null)
      const { w, h } = scanRegion(video.value.videoWidth, video.value.videoHeight)
      detections = raw
        .filter((d) => d.bbox && d.confidence >= DETECTION.displayThreshold)
        .map((d) => ({ ...d, reject: boxRejectReason(d, w, h, DETECTION) }))
      failures = 0
    } catch (e) {
      console.error(e)
      if (++failures >= 5) {
        modelStatus.value = 'error'
        modelError.value = 'Detectie loopt vast: ' + (e?.message ?? e)
        running = false
        break
      }
    }
    if (!running) break
    const t = performance.now()
    now.value = t
    // Enkel plausibele kaders tellen voor de trigger; afgekeurde worden wel getekend.
    const valid = detections.filter((d) => !d.reject)
    const top = detections[0] // inferencejs sorteert op zekerheid
    debugTop.value = top
      ? `${CLASS_INFO[top.class]?.label ?? top.class} ${Math.round(top.confidence * 100)}%${top.reject ? ' (genegeerd)' : ''}`
      : `niets ≥ ${Math.round(DETECTION.modelScoreThreshold * 100)}%`
    tooBig.value = valid.length === 0 && detections.some((d) => d.reject === 'te-groot')
    if (valid.length) lastSeenAt.value = t

    const r = trigger.update(valid, t)
    progress.value = r.progress
    candidate.value = r.candidate
    cooldown.value = r.state === 'cooldown'
    draw(detections)
    if (r.fired) onValidScan(r.fired)

    frames++
    totalFrames++
    if (totalFrames === 1) crumb('eerste detectie ok')
    else if (totalFrames % 25 === 0) crumb(`${totalFrames} frames ok`)
    if (t - fpsStart > 1000) {
      fps.value = Math.round((frames * 1000) / (t - fpsStart))
      frames = 0
      fpsStart = t
    }
    const wait = DETECTION.minIntervalMs - (performance.now() - t0)
    if (wait > 0) await sleep(wait)
    await nextFrame()
  }
}

async function startAll() {
  modelError.value = ''
  const cfgErr = inferenceConfigError()
  if (cfgErr) {
    modelStatus.value = 'error'
    modelError.value = cfgErr
    return
  }
  // Eerst de camera, DAN pas het model: beide tegelijk gaf op iPhone een geheugenpiek.
  crumb('camera gevraagd')
  const camOk = await camera.start(video.value)
  if (!camOk) {
    crumb('camera mislukt: ' + camera.status.value)
    return
  }
  crumb(`camera ok (${video.value.videoWidth}x${video.value.videoHeight})`)
  modelStatus.value = 'loading'
  crumb('model laden')
  try {
    await loadModel()
    modelStatus.value = 'ready'
    crumb('model geladen')
  } catch (e) {
    console.error(e)
    modelStatus.value = 'error'
    modelError.value = e?.message ?? String(e)
    crumb('model fout: ' + modelError.value.slice(0, 60))
  }
  if (modelStatus.value === 'ready') {
    trigger.reset()
    lastSeenAt.value = performance.now()
    running = true
    loop()
  }
}

function onVisibility() {
  // iOS pauzeert de video als je de app verlaat; bij terugkeren opnieuw starten.
  if (!document.hidden && video.value?.paused && camera.status.value === 'ready') video.value.play().catch(() => {})
  trigger.reset()
}

onMounted(() => {
  const prev = startSession()
  if (prev) crashInfo.value = prev.steps.at(-1)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', endSession)
  startAll()
})

onBeforeUnmount(() => {
  running = false
  clearTimeout(resultTimer)
  endSession()
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', endSession)
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <img src="/icon.svg" alt="" width="28" height="28" />
        <span>Statiegeld-scanner</span>
      </div>
      <span class="status-chip" :class="statusChip.tone"><i></i>{{ statusChip.text }}</span>
    </header>

    <main class="layout">
      <section class="camera-card">
        <video ref="video" class="feed" autoplay playsinline muted></video>
        <canvas ref="canvas" class="overlay"></canvas>
        <canvas v-show="DETECTION.showDebug && ready" ref="debugCanvas" class="debug-view" width="96" height="96" title="Beeld dat naar het model gaat"></canvas>
        <span v-if="DETECTION.showDebug && ready" class="debug-chip">model {{ MODEL_LABEL }}: {{ debugTop || '…' }}</span>

        <!-- Status + voortgang (1 s vasthouden) -->
        <div v-if="ready" class="hud">
          <div class="hud-pill" :class="{ active: candidate, done: cooldown }">
            <span>{{ statusLine }}</span>
            <div class="bar"><div class="fill" :style="{ width: (cooldown ? 100 : progress * 100) + '%' }"></div></div>
          </div>
        </div>

        <!-- Opstart- en foutstatussen -->
        <div v-if="modelStatus === 'loading' || camera.status.value === 'starting' || (modelStatus === 'idle' && camera.status.value === 'idle')" class="state">
          <div class="spinner"></div>
          <h2>{{ modelStatus === 'loading' ? 'Model laden' : 'Camera starten' }}</h2>
          <p>Het AI-model draait op je toestel. Beelden verlaten je toestel nooit.</p>
        </div>
        <div v-else-if="camera.status.value === 'denied'" class="state">
          <h2>Cameratoegang geweigerd</h2>
          <p>Sta de camera toe via het slotje of <b>aA</b> in de adresbalk en herlaad de pagina.</p>
          <button class="btn" @click="startAll">Opnieuw proberen</button>
        </div>
        <div v-else-if="['unavailable', 'insecure', 'error'].includes(camera.status.value)" class="state">
          <h2>Camera niet beschikbaar</h2>
          <p>{{ camera.errorMessage.value }}</p>
          <button class="btn" @click="startAll">Opnieuw proberen</button>
        </div>
        <div v-else-if="modelStatus === 'error'" class="state">
          <h2>Model kon niet laden</h2>
          <p>{{ modelError }}</p>
          <button class="btn" @click="startAll">Opnieuw proberen</button>
        </div>

        <!-- Resultaat-popup -->
        <transition name="pop">
          <div v-if="result" class="result-backdrop" @click="closeResult">
            <div class="result" :style="{ '--c': result.color }" @click.stop>
              <span class="result-eyebrow"><i></i>Gescand</span>
              <h2 class="result-title">{{ result.label }}</h2>
              <p class="result-sub">{{ result.long }} · {{ Math.round(result.zekerheid * 100) }}% zeker</p>
              <div class="result-bin">Hoort in de <b>{{ result.bin }}</b></div>
              <button class="btn" @click="closeResult">Volgende scan</button>
            </div>
          </div>
        </transition>

        <div v-if="crashInfo" class="crash" @click="crashInfo = null">
          Vorige keer liep de app vast na: <b>{{ crashInfo.step }}</b>. Tik om te sluiten.
        </div>
      </section>

      <aside class="panel">
        <div class="card">
          <h3>Deze sessie</h3>
          <div class="counts">
            <div v-for="c in counts" :key="c.k" class="count" :style="{ '--c': c.color }">
              <span class="n">{{ c.n }}</span>
              <span class="l"><i></i>{{ c.label }}</span>
            </div>
          </div>
          <ul v-if="history.length" class="history">
            <li v-for="h in history" :key="h.id">
              <i :style="{ background: h.color }"></i>
              <span class="h-label">{{ h.label }}</span>
              <span class="h-meta">{{ Math.round(h.zekerheid * 100) }}% · {{ timeFmt.format(h.tijd) }}</span>
            </li>
          </ul>
          <p v-else class="empty">Nog niets gescand. Houd een item 1 seconde stil in het kader.</p>
        </div>

        <div class="card info">
          <h3>Hoe werkt het?</h3>
          <ol>
            <li>Houd een blikje, PET-fles of glazen fles in het kader.</li>
            <li>Hou het ± 1 seconde stil tot de balk vol is.</li>
            <li>Haal het item uit beeld voor de volgende scan.</li>
          </ol>
          <p class="privacy">🔒 Het model draait in je browser. Camerabeelden verlaten je toestel nooit en er wordt niets opgeslagen.</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* Bovenbalk in pilvorm, zoals de navigatie van renzdeheegher.be */
.topbar {
  align-self: center;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 6px 6px 14px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: -0.01em;
}
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--ink);
  color: #fff;
  font-size: 13px;
  padding: 7px 14px;
  border-radius: 999px;
  white-space: nowrap;
}
.status-chip i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
}
.status-chip.ok i {
  background: #22c55e;
}
.status-chip.error i {
  background: #ef4444;
}
.status-chip.busy i {
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

.layout {
  flex: 1;
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr;
}
@media (min-width: 900px) {
  .layout {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
}

/* Camera in een afgeronde kaart */
.camera-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
  background: #111;
  min-height: 70dvh;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}
@media (min-width: 900px) {
  .camera-card {
    min-height: calc(100dvh - 120px);
  }
}
.feed,
.overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* zelfde schaling => kaders liggen precies op de video */
}
.overlay {
  pointer-events: none;
}

.hud {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: flex;
  justify-content: center;
}
.hud-pill {
  width: min(100%, 420px);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--ink);
  border-radius: 20px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}
.bar {
  height: 4px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--ink);
  transition: width 0.15s linear;
}
.hud-pill.done .fill {
  background: #22c55e;
}

.state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px;
  text-align: center;
  background: var(--bg);
}
.state h2 {
  font-family: var(--font-display);
  font-size: 26px;
  letter-spacing: -0.02em;
  margin: 0;
}
.state p {
  color: var(--muted);
  max-width: 34ch;
  margin: 0;
  line-height: 1.5;
}
.state .btn {
  margin-top: 8px;
}
.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--line);
  border-top-color: var(--ink);
  animation: spin 0.8s linear infinite;
  margin-bottom: 6px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Resultaat-popup */
.result-backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(17, 17, 17, 0.25);
}
.result {
  width: min(100%, 360px);
  background: #fff;
  border-radius: var(--radius);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.result-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}
.result-eyebrow i,
.count .l i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--c);
}
.result-title {
  font-family: var(--font-display);
  font-size: 52px;
  line-height: 1;
  letter-spacing: -0.03em;
  margin: 4px 0 0;
}
.result-sub {
  margin: 0;
  color: var(--muted);
}
.result-bin {
  margin: 8px 0 12px;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 14px;
  font-size: 14px;
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.2s ease;
}
.pop-enter-active .result,
.pop-leave-active .result {
  transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
}
.pop-enter-from .result {
  transform: translateY(12px) scale(0.95);
}

.crash {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 16px;
  background: #fff7e6;
  color: #7a4b00;
  border: 1px solid #f5d9a8;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
}
.debug-view {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 96px;
  height: 96px;
  border-radius: 12px;
  border: 2px solid #fff;
  background: #000;
}
.debug-chip {
  position: absolute;
  left: 16px;
  top: 16px;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
}

/* Zijpaneel */
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
}
.card h3 {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: -0.02em;
  margin: 0 0 14px;
}
.counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.count {
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.count .n {
  font-family: var(--font-display);
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}
.count .l {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.count .l i {
  width: 8px;
  height: 8px;
}
.history {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  max-height: 260px;
  overflow: auto;
}
.history li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px solid var(--line);
  font-size: 14px;
}
.history i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.h-label {
  font-weight: 500;
  flex: 1;
}
.h-meta {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.empty {
  color: var(--muted);
  font-size: 14px;
  margin: 14px 0 0;
  line-height: 1.5;
}
.info ol {
  margin: 0;
  padding-left: 18px;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  line-height: 1.45;
}
.privacy {
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
}
</style>
