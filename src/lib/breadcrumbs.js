// Kruimelpad voor crashes: we noteren elke stap van het scanscherm in localStorage.
// Crasht Safari het tabblad (bv. geheugen vol), dan zien we bij het herladen tot welke
// stap het nog lukte. Enkel tekst over de stappen, NOOIT beelden.
import { getJSON, setJSON, removeItem } from './storage'

const KEY = 'statiegeld.breadcrumbs'

let current = null

/** Start een nieuwe sessie; geeft het kruimelpad van de vorige sessie terug als die niet netjes eindigde. */
export function startSession() {
  const prev = getJSON(KEY, null)
  current = { startedAt: Date.now(), steps: [], ended: false }
  setJSON(KEY, current)
  return prev && !prev.ended && prev.steps.length ? prev : null
}

export function crumb(step) {
  if (!current) return
  current.steps.push({ step, t: Date.now() - current.startedAt })
  current.steps = current.steps.slice(-12)
  setJSON(KEY, current)
}

/** Netjes afgesloten (scherm verlaten): geen crash. */
export function endSession() {
  if (!current) return
  current.ended = true
  setJSON(KEY, current)
}

export function clearBreadcrumbs() {
  removeItem(KEY)
}
