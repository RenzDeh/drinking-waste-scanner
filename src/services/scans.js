// Opslag van scans. PRIVACY: we bewaren per scan ENKEL deze 6 velden:
// { spelerId, bijnaam, klasse, punten, zekerheid, tijdstip }. Nooit beelden of frames.
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore'
import { db, firebaseEnabled } from './firebase'
import { getJSON, setJSON } from '../lib/storage'
import { BONUS_CLASS, CLASSES, LEADERBOARD_SIZE } from '../config'

const COLLECTION = 'scans'
const LOCAL_KEY = 'statiegeld.localScans'

function toPlain(doc) {
  const d = doc.data()
  return {
    id: doc.id,
    spelerId: d.spelerId,
    bijnaam: d.bijnaam,
    klasse: d.klasse,
    punten: d.punten,
    zekerheid: d.zekerheid,
    // serverTimestamp is net na het schrijven lokaal nog null
    tijdstip: d.tijdstip?.toMillis?.() ?? Date.now(),
  }
}

/**
 * Bewaar één scan. Er wordt bewust niets anders meegestuurd dan deze velden.
 */
export async function saveScan({ player, klasse, punten, zekerheid }) {
  if (![...CLASSES, BONUS_CLASS].includes(klasse)) throw new Error(`Onbekende klasse: ${klasse}`)
  const record = {
    spelerId: player.id,
    bijnaam: player.nickname,
    klasse,
    punten: Math.round(punten),
    // Niet afronden: 0.9004 mag geen 0.9 worden (de rules eisen > 0.9).
    zekerheid: Math.min(1, Math.max(0, Number(zekerheid))),
  }

  if (!firebaseEnabled) {
    const local = getJSON(LOCAL_KEY, [])
    const saved = { id: `local-${Date.now()}`, ...record, tijdstip: Date.now() }
    local.push(saved)
    setJSON(LOCAL_KEY, local.slice(-500))
    return saved
  }

  const ref = await addDoc(collection(db, COLLECTION), { ...record, tijdstip: serverTimestamp() })
  return { id: ref.id, ...record, tijdstip: Date.now() }
}

/** Alle scans van één speler, nieuwste eerst. */
export async function getPlayerScans(spelerId) {
  let scans
  if (!firebaseEnabled) {
    scans = getJSON(LOCAL_KEY, []).filter((s) => s.spelerId === spelerId)
  } else {
    // Enkel een gelijkheidsfilter => geen samengestelde index nodig; sorteren doen we lokaal.
    const snap = await getDocs(query(collection(db, COLLECTION), where('spelerId', '==', spelerId)))
    scans = snap.docs.map(toPlain)
  }
  return scans.sort((a, b) => b.tijdstip - a.tijdstip)
}

/**
 * Top N op totaal punten. Zonder auth mogen we geen "totaal"-document laten updaten
 * (de rules staan enkel lezen + aanmaken toe), dus we tellen de scans op aan de clientzijde.
 * Prima voor een schoolproject; bij duizenden spelers zou je een Cloud Function gebruiken.
 */
export async function getLeaderboard(limitN = LEADERBOARD_SIZE) {
  let scans
  if (!firebaseEnabled) {
    scans = getJSON(LOCAL_KEY, [])
  } else {
    const snap = await getDocs(collection(db, COLLECTION))
    scans = snap.docs.map(toPlain)
  }
  return aggregateLeaderboard(scans, limitN)
}

export function aggregateLeaderboard(scans, limitN = LEADERBOARD_SIZE) {
  const byPlayer = new Map()
  for (const s of scans) {
    const entry = byPlayer.get(s.spelerId) ?? { spelerId: s.spelerId, bijnaam: s.bijnaam, totaal: 0, items: 0, laatst: 0 }
    entry.totaal += s.punten
    if (s.klasse !== BONUS_CLASS) entry.items += 1
    // Toon de meest recente bijnaam van die speler
    if (s.tijdstip >= entry.laatst) {
      entry.laatst = s.tijdstip
      entry.bijnaam = s.bijnaam
    }
    byPlayer.set(s.spelerId, entry)
  }
  return [...byPlayer.values()].sort((a, b) => b.totaal - a.totaal || a.laatst - b.laatst).slice(0, limitN)
}

export { firebaseEnabled }
