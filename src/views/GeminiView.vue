<script setup>
// Gemini-modus: GEEN eigen model of dataset. Je neemt een foto, die gaat via onze server
// naar Google Gemini en Gemini zegt wat het is. Volledig los van de Roboflow-pagina.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCamera } from '../composables/useCamera'
import { captureFrame, classifyWithGemini } from '../services/gemini'
import { buzz } from '../lib/haptics'
import { CLASS_INFO, CLASSES, RESULT_MS } from '../config'

const video = ref(null)
const camera = useCamera()

const busy = ref(false)
const snapshot = ref(null) // dataURL van de verstuurde foto (enkel lokaal getoond)
const result = ref(null)
const error = ref('')
const history = ref([])
let resultTimer = null

const ready = computed(() => camera.status.value === 'ready')

// Extra klassen die enkel Gemini kent
const EXTRA = {
  ander: { label: 'Ander', long: 'Geen blik of fles', bin: null, color: '#6b7280' },
  geen: { label: 'Niets', long: 'Geen verpakking gevonden', bin: null, color: '#9ca3af' },
}
const infoFor = (k) => CLASS_INFO[k] ?? EXTRA[k] ?? EXTRA.ander

const statusChip = computed(() => {
  if (busy.value) return { text: 'Gemini denkt na…', tone: 'busy' }
  if (camera.status.value === 'starting') return { text: 'Camera starten…', tone: 'busy' }
  if (['denied', 'unavailable', 'insecure', 'error'].includes(camera.status.value)) return { text: 'Geen camera', tone: 'error' }
  if (ready.value) return { text: 'Klaar · tik op Scan', tone: 'ok' }
  return { text: 'Opstarten…', tone: 'busy' }
})

const counts = computed(() => CLASSES.map((k) => ({ k, ...CLASS_INFO[k], n: history.value.filter((h) => h.klasse === k).length })))
const timeFmt = new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

async function scan() {
  if (!ready.value || busy.value) return
  error.value = ''
  closeResult()
  const shot = captureFrame(video.value)
  snapshot.value = shot.dataUrl
  busy.value = true
  try {
    const r = await classifyWithGemini(shot.base64)
    const item = { id: Date.now(), ...r, tijd: new Date(), ...infoFor(r.klasse) }
    history.value = [item, ...history.value].slice(0, 20)
    result.value = item
    if (CLASSES.includes(r.klasse)) buzz()
    resultTimer = setTimeout(closeResult, RESULT_MS + 1500)
  } catch (e) {
    error.value = e.message
    snapshot.value = null
  } finally {
    busy.value = false
  }
}

function closeResult() {
  clearTimeout(resultTimer)
  result.value = null
  snapshot.value = null
}

function onKey(e) {
  // Spatie of Enter = scannen (handig tijdens een demo op de laptop)
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && e.target === document.body) {
    e.preventDefault()
    result.value ? closeResult() : scan()
  }
}

onMounted(() => {
  camera.start(video.value)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearTimeout(resultTimer)
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <img src="/icon.svg" alt="" width="28" height="28" />
        <span>Statiegeld-scanner</span>
      </div>
      <slot name="toggle" />
      <span class="status-chip" :class="statusChip.tone"><i></i>{{ statusChip.text }}</span>
    </header>

    <main class="layout">
      <section class="camera-card">
        <video ref="video" class="feed" autoplay playsinline muted></video>
        <img v-if="snapshot" :src="snapshot" class="feed frozen" alt="" />
        <div class="frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>

        <!-- Sluiterknop -->
        <div v-if="ready" class="hud">
          <button class="shutter" :disabled="busy" :aria-label="busy ? 'Bezig' : 'Scan met Gemini'" @click="scan">
            <span v-if="busy" class="spinner small"></span>
            <span v-else>Scan</span>
          </button>
          <p class="hint">{{ busy ? 'Foto verstuurd naar Gemini…' : 'Houd het item in beeld en tik op Scan (of druk op spatie)' }}</p>
        </div>

        <!-- Opstart- en foutstatussen -->
        <div v-if="camera.status.value === 'starting' || camera.status.value === 'idle'" class="state">
          <div class="spinner"></div>
          <h2>Camera starten</h2>
          <p>In deze modus herkent Google Gemini het item. Er is geen eigen model nodig.</p>
        </div>
        <div v-else-if="camera.status.value === 'denied'" class="state">
          <h2>Cameratoegang geweigerd</h2>
          <p>Sta de camera toe via het slotje of <b>aA</b> in de adresbalk en herlaad de pagina.</p>
          <button class="btn" @click="camera.start(video)">Opnieuw proberen</button>
        </div>
        <div v-else-if="['unavailable', 'insecure', 'error'].includes(camera.status.value)" class="state">
          <h2>Camera niet beschikbaar</h2>
          <p>{{ camera.errorMessage.value }}</p>
          <button class="btn" @click="camera.start(video)">Opnieuw proberen</button>
        </div>

        <transition name="fade">
          <div v-if="error" class="error-toast" @click="error = ''">{{ error }} <b>Tik om te sluiten.</b></div>
        </transition>

        <!-- Resultaat-popup -->
        <transition name="pop">
          <div v-if="result" class="result-backdrop" @click="closeResult">
            <div class="result" :style="{ '--c': result.color }" @click.stop>
              <span class="result-eyebrow"><i></i>Gemini zegt</span>
              <h2 class="result-title">{{ result.label }}</h2>
              <p class="result-sub">{{ result.omschrijving || result.long }} · {{ Math.round(result.zekerheid * 100) }}% zeker</p>
              <div v-if="result.bin" class="result-bin">Hoort in de <b>{{ result.bin }}</b></div>
              <div v-else class="result-bin muted">{{ result.long }}</div>
              <button class="btn" @click="closeResult">Volgende scan</button>
            </div>
          </div>
        </transition>
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
              <span class="h-label">{{ h.label }}<small>{{ h.omschrijving }}</small></span>
              <span class="h-meta">{{ Math.round(h.zekerheid * 100) }}% · {{ timeFmt.format(h.tijd) }}</span>
            </li>
          </ul>
          <p v-else class="empty">Nog niets gescand. Houd een item in beeld en tik op Scan.</p>
        </div>

        <div class="card info">
          <h3>Gemini-modus</h3>
          <ol>
            <li>Geen eigen dataset of model: een algemeen AI-model van Google herkent het item.</li>
            <li>Er wordt enkel een foto genomen als je op <b>Scan</b> tikt.</li>
            <li>Het antwoord duurt een paar seconden (internet nodig).</li>
          </ol>
          <p class="privacy">⚠️ In deze modus wordt de foto naar Google Gemini gestuurd. Wil je dat camerabeelden je toestel nooit verlaten, gebruik dan de <b>Roboflow</b>-modus.</p>
        </div>
      </aside>
    </main>
  </div>
</template>

<style scoped>
/* Zelfde huisstijl als de Roboflow-pagina (bewust gedupliceerd: de twee pagina's blijven los van elkaar) */
.page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px);
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}
.topbar {
  align-self: center;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 14px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--line);
  border-radius: 28px;
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
@media (max-width: 520px) {
  .brand span {
    display: none;
  }
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
.feed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.frozen {
  filter: brightness(0.9);
}
/* Hoekjes als richtkader */
.frame {
  position: absolute;
  inset: 12% 18%;
  pointer-events: none;
}
.frame i {
  position: absolute;
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.95);
}
.frame i:nth-child(1) {
  top: 0;
  left: 0;
  border-right: 0;
  border-bottom: 0;
  border-top-left-radius: 10px;
}
.frame i:nth-child(2) {
  top: 0;
  right: 0;
  border-left: 0;
  border-bottom: 0;
  border-top-right-radius: 10px;
}
.frame i:nth-child(3) {
  bottom: 0;
  left: 0;
  border-right: 0;
  border-top: 0;
  border-bottom-left-radius: 10px;
}
.frame i:nth-child(4) {
  bottom: 0;
  right: 0;
  border-left: 0;
  border-top: 0;
  border-bottom-right-radius: 10px;
}
.hud {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.shutter {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.85);
  background: #fff;
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.08s;
}
.shutter:active {
  transform: scale(0.95);
}
.shutter:disabled {
  opacity: 0.85;
}
.hint {
  margin: 0;
  background: rgba(255, 255, 255, 0.92);
  color: var(--ink);
  font-size: 13px;
  padding: 8px 14px;
  border-radius: 999px;
  text-align: center;
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
}
.spinner.small {
  width: 28px;
  height: 28px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.error-toast {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 16px;
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.4;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
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
.result-bin.muted {
  color: var(--muted);
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
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.h-label small {
  font-weight: 400;
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.h-meta {
  color: var(--muted);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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
