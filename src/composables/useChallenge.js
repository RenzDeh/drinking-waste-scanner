import { computed, onBeforeUnmount, ref } from 'vue'
import { DAILY_CHALLENGES } from '../config'
import { getJSON, setJSON } from '../lib/storage'

const KEY = 'statiegeld.challenge'

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Elke dag hetzelfde dagdoel voor iedereen, afgeleid van de datum. */
export function challengeForDate(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((d - start) / 86_400_000)
  return DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length]
}

/**
 * Dagdoel met tijdslimiet. Bonus kan één keer per dag (per speler, lokaal bijgehouden).
 * `onComplete(challenge)` wordt aangeroepen als het doel binnen de tijd gehaald is.
 */
export function useChallenge(onComplete) {
  const challenge = challengeForDate()
  const status = ref('idle') // idle | running | won | lost
  const count = ref(0)
  const remainingMs = ref(challenge.durationSec * 1000)
  const doneToday = ref(getJSON(KEY, {})[todayKey()] === challenge.id)
  let endsAt = 0
  let timer = null

  const remainingLabel = computed(() => {
    const s = Math.ceil(remainingMs.value / 1000)
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  })
  const progress = computed(() => Math.min(1, count.value / challenge.target))

  function tick() {
    remainingMs.value = Math.max(0, endsAt - Date.now())
    if (remainingMs.value <= 0 && status.value === 'running') {
      status.value = 'lost'
      clearInterval(timer)
    }
  }

  function start() {
    if (doneToday.value) return
    count.value = 0
    status.value = 'running'
    endsAt = Date.now() + challenge.durationSec * 1000
    remainingMs.value = challenge.durationSec * 1000
    clearInterval(timer)
    timer = setInterval(tick, 250)
  }

  function cancel() {
    clearInterval(timer)
    status.value = 'idle'
    count.value = 0
    remainingMs.value = challenge.durationSec * 1000
  }

  /** Aanroepen bij elke geldige scan. */
  function registerScan(klasse) {
    if (status.value !== 'running') return
    if (challenge.klasse && challenge.klasse !== klasse) return
    count.value += 1
    if (count.value >= challenge.target) {
      clearInterval(timer)
      status.value = 'won'
      doneToday.value = true
      setJSON(KEY, { [todayKey()]: challenge.id })
      onComplete?.(challenge)
    }
  }

  onBeforeUnmount(() => clearInterval(timer))

  return { challenge, status, count, remainingMs, remainingLabel, progress, doneToday, start, cancel, registerScan }
}
