// Speler = enkel een bijnaam + willekeurig ID, lokaal bewaard. Geen account, geen login.
import { reactive, readonly } from 'vue'
import { getJSON, setJSON, removeItem } from '../lib/storage'
import { NICKNAME } from '../config'

const KEY = 'statiegeld.player'

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function cleanNickname(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NICKNAME.max)
}

export function isValidNickname(raw) {
  const n = cleanNickname(raw)
  return n.length >= NICKNAME.min && n.length <= NICKNAME.max
}

function load() {
  const p = getJSON(KEY, null)
  if (p && typeof p.id === 'string' && typeof p.nickname === 'string') return p
  return null
}

const state = reactive({ player: load() })

export const playerState = readonly(state)

export function hasPlayer() {
  return state.player != null
}

export function createPlayer(nickname) {
  const clean = cleanNickname(nickname)
  if (!isValidNickname(clean)) throw new Error(`Bijnaam moet ${NICKNAME.min} tot ${NICKNAME.max} tekens zijn.`)
  // Behoud het ID als de speler enkel zijn bijnaam wijzigt.
  const player = { id: state.player?.id ?? randomId(), nickname: clean, createdAt: Date.now() }
  setJSON(KEY, player)
  state.player = player
  return player
}

export function resetPlayer() {
  removeItem(KEY)
  state.player = null
}
