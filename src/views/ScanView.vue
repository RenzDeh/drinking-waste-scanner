<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCamera } from '../composables/useCamera'
import { useChallenge } from '../composables/useChallenge'
import { detect, inferenceConfigError, loadModel } from '../services/inference'
import { firebaseEnabled, saveScan } from '../services/scans'
import { playerState } from '../services/player'
import { createScanTrigger } from '../lib/scanTrigger'
import { buzz } from '../lib/haptics'
import { BONUS_CLASS, CLASS_INFO, CLASSES, DETECTION, POINTS, TRIGGER } from '../config'
import ChallengeCard from '../components/ChallengeCard.vue'

const video = ref(null)
const canvas = ref(null)
const camera = useCamera()

const modelStatus = ref('idle') // idle | loading | ready | error
const modelError = ref('')
const progress = ref(0)
const candidate = ref(null)
const cooldown = ref(false)
const lastSeenAt = ref(performance.now())
const now = ref(performance.now())
const fps = ref(0)
const sessionPoints = ref(0)
const pops = ref([])
const toast = ref('')

let running = false
let popId = 0
const trigger = createScanTrigger(TRIGGER)

const challenge = useChallenge(async (c) => {
  showPop(`+${c.bonus}`, 'Dagdoel gehaald!', '#ffd54f')
  buzz([60, 40, 60, 40, 120])
  await persist({ klasse: BONUS_CLASS, punten: c.bonus, zekerheid: 1 })
})

const noDetection = computed(
  () => modelStatus.value === 'ready' && camera.status.value === 'ready' && !cooldown.value && now.value - lastSeenAt.value > 2500,
)

const statusLine = computed(() => {
  if (camera.status.value === 'starting') return 'Camera starten…'
  if (modelStatus.value === 'loading') return 'Model laden op je toestel…'
  if (cooldown.value) return 'Top! Haal het item uit beeld voor de volgende scan.'
  if (candidate.value) return `${CLASS_INFO[candidate.value]?.label ?? candidate.value} herkend — even stilhouden…`
  if (noDetection.value) return 'Geen blik of fles in beeld. Houd het item centraal en goed belicht.'
  return 'Richt de camera op een blikje of fles.'
})

function showPop(text, sub, color) {
  const id = ++popId
  pops.value.push({ id, text, sub, color })
  setTimeout(() => (pops.value = pops.value.filter((p) => p.id !== id)), 1600)
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 4000)
}

async function persist(scan) {
  sessionPoints.value += scan.punten
  try {
    await saveScan({ player: playerState.player, ...scan })
  } catch (e) {
    console.error(e)
    sessionPoints.value -= scan.punten
    showToast('Opslaan mislukt. Controleer je verbinding.')
  }
}

function onValidScan({ klasse, zekerheid }) {
  if (!CLASSES.includes(klasse)) return
  const punten = POINTS[klasse]
  showPop(`+${punten}`, CLASS_INFO[klasse].label, CLASS_INFO[klasse].color)
  buzz()
  persist({ klasse, punten, zekerheid })
  challenge.registerScan(klasse)
}

function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r)
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
  ctx.lineWidth = Math.max(2, unit * 1.5)
  ctx.font = `600 ${Math.round(unit * 9)}px system-ui, -apple-system, sans-serif`
  ctx.textBaseline = 'top'

  for (const d of detections) {
    const color = CLASS_INFO[d.class]?.color ?? '#ffffff'
    // bbox.x/y = middelpunt
    const x = d.bbox.x - d.bbox.width / 2
    const y = d.bbox.y - d.bbox.height / 2
    const strong = d.confidence > TRIGGER.confidenceThreshold
    ctx.strokeStyle = color
    ctx.setLineDash(strong ? [] : [unit * 4, unit * 3])
    ctx.beginPath()
    roundedRect(ctx, x, y, d.bbox.width, d.bbox.height, unit * 3)
    ctx.stroke()
    ctx.setLineDash([])

    const label = `${CLASS_INFO[d.class]?.label ?? d.class} ${Math.round(d.confidence * 100)}%`
    const pad = unit * 2.5
    const tw = ctx.measureText(label).width
    const th = unit * 9
    const ly = y - th - pad * 2 < 0 ? y + ctx.lineWidth : y - th - pad * 2
    ctx.fillStyle = color
    ctx.beginPath()
    roundedRect(ctx, x, ly, tw + pad * 2, th + pad * 2, unit * 2)
    ctx.fill()
    ctx.fillStyle = '#0b1f17'
    ctx.fillText(label, x + pad, ly + pad)
  }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loop() {
  let frames = 0
  let fpsStart = performance.now()
  let failures = 0
  while (running) {
    if (document.hidden || video.value?.readyState < 2) {
      await sleep(250)
      continue
    }
    const t0 = performance.now()
    let detections = []
    try {
      const raw = await detect(video.value)
      detections = raw.filter((d) => d.bbox && d.confidence >= DETECTION.displayThreshold)
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
    if (detections.length) lastSeenAt.value = t
    draw(detections)

    const r = trigger.update(detections, t)
    progress.value = r.progress
    candidate.value = r.candidate
    cooldown.value = r.state === 'cooldown'
    if (r.fired) onValidScan(r.fired)

    frames++
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
  // Model en camera parallel opstarten
  modelStatus.value = 'loading'
  const modelP = loadModel()
    .then(() => (modelStatus.value = 'ready'))
    .catch((e) => {
      console.error(e)
      modelStatus.value = 'error'
      modelError.value = e?.message ?? String(e)
    })
  const camOk = await camera.start(video.value)
  await modelP
  if (camOk && modelStatus.value === 'ready') {
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
  document.addEventListener('visibilitychange', onVisibility)
  startAll()
})

onBeforeUnmount(() => {
  running = false
  document.removeEventListener('visibilitychange', onVisibility)
})

const ringDash = computed(() => `${progress.value * 289} 289`)
</script>

<template>
  <section class="scan">
    <div class="viewport">
      <video ref="video" class="feed" autoplay playsinline muted></video>
      <canvas ref="canvas" class="overlay"></canvas>

      <!-- Richtkader met voortgangsring (1 s vasthouden) -->
      <div v-if="modelStatus === 'ready' && camera.status.value === 'ready'" class="reticle" :class="{ done: cooldown }">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" class="track" />
          <circle cx="50" cy="50" r="46" class="bar" :stroke-dasharray="ringDash" />
        </svg>
      </div>

      <div class="hud-top">
        <ChallengeCard :c="challenge" :disabled="modelStatus !== 'ready' || camera.status.value !== 'ready'" />
        <div class="chips">
          <span class="chip"><strong>{{ sessionPoints }}</strong> pt deze sessie</span>
          <span v-if="modelStatus === 'ready'" class="chip muted">{{ fps }} fps · op toestel</span>
          <span v-if="!firebaseEnabled" class="chip warn">lokale modus</span>
        </div>
      </div>

      <!-- Blokkerende statussen -->
      <div v-if="modelStatus === 'loading' || camera.status.value === 'starting'" class="state">
        <div class="spinner"></div>
        <p class="state-title">{{ modelStatus === 'loading' ? 'Model laden…' : 'Camera starten…' }}</p>
        <p class="state-sub">Het AI-model wordt op je toestel geladen. Beelden verlaten je toestel nooit.</p>
      </div>

      <div v-else-if="camera.status.value === 'denied'" class="state">
        <div class="state-icon">📷</div>
        <p class="state-title">Cameratoegang geweigerd</p>
        <p class="state-sub">
          Op iPhone: <b>Instellingen › Safari › Camera</b> op “Vraag” of “Sta toe”, of tik op <b>aA</b> in de adresbalk ›
          Website-instellingen › Camera. Herlaad daarna de pagina.
        </p>
        <button class="btn" @click="startAll">Opnieuw proberen</button>
      </div>

      <div v-else-if="['unavailable', 'insecure', 'error'].includes(camera.status.value)" class="state">
        <div class="state-icon">⚠️</div>
        <p class="state-title">Camera niet beschikbaar</p>
        <p class="state-sub">{{ camera.errorMessage.value }}</p>
        <button class="btn" @click="startAll">Opnieuw proberen</button>
      </div>

      <div v-else-if="modelStatus === 'error'" class="state">
        <div class="state-icon">🧠</div>
        <p class="state-title">Model kon niet laden</p>
        <p class="state-sub">{{ modelError }}</p>
        <p class="state-sub small">Controleer je internetverbinding en de Roboflow-variabelen in .env.</p>
        <button class="btn" @click="startAll">Opnieuw proberen</button>
      </div>

      <div class="pops">
        <div v-for="p in pops" :key="p.id" class="pop" :style="{ '--c': p.color }">
          <span class="pop-num">{{ p.text }}</span>
          <span class="pop-sub">{{ p.sub }}</span>
        </div>
      </div>

      <div class="hud-bottom">
        <p class="status" :class="{ ok: cooldown, active: candidate, idle: noDetection }">{{ statusLine }}</p>
      </div>

      <transition name="fade"><div v-if="toast" class="toast">{{ toast }}</div></transition>
    </div>
  </section>
</template>

<style scoped>
.scan {
  position: fixed;
  inset: 0;
  bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
  background: #000;
}
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
.reticle {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 34vmin;
  height: 34vmin;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
.reticle svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.reticle .track {
  fill: none;
  stroke: rgba(255, 255, 255, 0.25);
  stroke-width: 3;
}
.reticle .bar {
  fill: none;
  stroke: var(--accent);
  stroke-width: 5;
  stroke-linecap: round;
  transition: stroke-dasharray 0.12s linear;
}
.reticle.done .track {
  stroke: var(--accent);
}
.hud-top {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: calc(env(safe-area-inset-top) + 12px) 16px 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.chip {
  background: rgba(11, 31, 23, 0.72);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: var(--text);
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 13px;
}
.chip.muted {
  color: var(--muted);
}
.chip.warn {
  color: #ffd54f;
}
.hud-bottom {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 16px;
  display: flex;
  justify-content: center;
}
.status {
  margin: 0;
  background: rgba(11, 31, 23, 0.8);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 15px;
  text-align: center;
  border: 1px solid transparent;
  transition: border-color 0.2s;
}
.status.active {
  border-color: var(--accent);
}
.status.ok {
  border-color: #ffd54f;
}
.status.idle {
  color: var(--muted);
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
  background: rgba(6, 18, 13, 0.92);
}
.state-icon {
  font-size: 48px;
}
.state-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}
.state-sub {
  color: var(--muted);
  margin: 0;
  max-width: 32ch;
  line-height: 1.45;
}
.state-sub.small {
  font-size: 13px;
}
.state .btn {
  margin-top: 12px;
  max-width: 280px;
}
.spinner {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.15);
  border-top-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.pops {
  position: absolute;
  left: 50%;
  top: 42%;
  transform: translateX(-50%);
  pointer-events: none;
}
.pop {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: pop 1.6s cubic-bezier(0.2, 0.9, 0.3, 1) forwards;
}
.pop-num {
  font-size: 72px;
  font-weight: 900;
  color: var(--c);
  text-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
  line-height: 1;
}
.pop-sub {
  font-weight: 700;
  background: var(--c);
  color: #0b1f17;
  padding: 4px 12px;
  border-radius: 999px;
  margin-top: 6px;
  white-space: nowrap;
}
@keyframes pop {
  0% {
    opacity: 0;
    transform: translate(-50%, -30%) scale(0.4);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.15);
  }
  30% {
    transform: translate(-50%, -50%) scale(1);
  }
  75% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -140%) scale(0.95);
  }
}
.toast {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 80px;
  background: #b3261e;
  color: #fff;
  padding: 12px 16px;
  border-radius: 12px;
  text-align: center;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
