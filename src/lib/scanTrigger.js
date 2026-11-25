// Pure, testbare state machine voor de scan-trigger ("moeilijk te foppen").
//
//  ZOEKEN ──(zelfde klas > drempel gedurende ≥ holdMs)──▶ SCAN! ──▶ COOLDOWN
//  COOLDOWN ──(≥ clearFrames frames én ≥ clearMinMs zonder detectie)──▶ ZOEKEN
//
// Tolerantie: een klein model schommelt per frame (0.7, 0.5, 0.8 …). Een kort dipje
// (zwak frame, geen detectie of even een andere klas) korter dan `dropoutMs` onderbreekt
// het vasthouden daarom NIET. Duurt de onderbreking langer, dan begint alles opnieuw.
// Ook een te grote pauze tussen frames (bv. app op de achtergrond) zet de teller op nul.
//
// Hysterese: STARTEN vraagt > confidenceThreshold, maar eens bezig mag dezelfde klas
// zakken tot keepThreshold zonder dat het vasthouden onderbroken wordt (telefooncamera's
// schommelen meer). Vuren gebeurt enkel op een frame boven confidenceThreshold.

export function createScanTrigger(cfg) {
  const dropoutMs = cfg.dropoutMs ?? 0
  const keepThreshold = cfg.keepThreshold ?? cfg.confidenceThreshold
  let state = 'searching' // 'searching' | 'cooldown'
  let candidate = null // { klasse, since, lastSeenAt, lastStrongAt, minConf }
  let lastFrameAt = null
  let emptyFrames = 0
  let emptySince = null

  function reset() {
    state = 'searching'
    candidate = null
    lastFrameAt = null
    emptyFrames = 0
    emptySince = null
  }

  /**
   * @param {Array<{class:string, confidence:number}>} detections
   * @param {number} now  tijdstip in ms (performance.now())
   * @returns {{ state, progress, candidate: string|null, fired: null | {klasse, zekerheid} }}
   */
  function update(detections, now) {
    const gap = lastFrameAt == null ? 0 : now - lastFrameAt
    lastFrameAt = now
    const best = detections.reduce((a, d) => (a == null || d.confidence > a.confidence ? d : a), null)

    if (state === 'cooldown') {
      const present = best != null && best.confidence >= cfg.presenceThreshold
      if (present) {
        emptyFrames = 0
        emptySince = null
      } else {
        emptyFrames += 1
        emptySince ??= now
        if (emptyFrames >= cfg.clearFrames && now - emptySince >= cfg.clearMinMs) {
          state = 'searching'
          candidate = null
        }
      }
      return { state, progress: 0, candidate: null, fired: null }
    }

    // state === 'searching'
    if (gap > cfg.maxFrameGapMs) candidate = null

    // Sterkste detectie van de huidige kandidaat-klas (die telt, ook als er even een andere klas wint)
    const sameClass = candidate
      ? detections.filter((d) => d.class === candidate.klasse).reduce((a, d) => (a == null || d.confidence > a.confidence ? d : a), null)
      : null
    const strongSame = sameClass != null && sameClass.confidence > cfg.confidenceThreshold
    const keptSame = sameClass != null && sameClass.confidence >= keepThreshold
    const strongBest = best != null && best.confidence > cfg.confidenceThreshold

    if (candidate && keptSame) {
      candidate.lastSeenAt = now
      if (strongSame) {
        candidate.lastStrongAt = now
        candidate.minConf = Math.min(candidate.minConf, sameClass.confidence)
      }
    } else if (candidate && now - candidate.lastSeenAt <= dropoutMs) {
      // kort dipje: tolereren, de klok loopt gewoon door
    } else {
      // geen (geldige) kandidaat meer: begin opnieuw met de sterkste detectie van nu
      candidate = strongBest ? { klasse: best.class, since: now, lastSeenAt: now, lastStrongAt: now, minConf: best.confidence } : null
    }

    if (!candidate) return { state, progress: 0, candidate: null, fired: null }

    const held = now - candidate.since
    // Enkel vuren op een sterk frame van de kandidaat-klas (nooit tijdens een dipje)
    if (held >= cfg.holdMs && candidate.lastStrongAt === now) {
      const fired = { klasse: candidate.klasse, zekerheid: candidate.minConf }
      state = 'cooldown'
      candidate = null
      emptyFrames = 0
      emptySince = null
      return { state, progress: 1, candidate: null, fired }
    }
    return { state, progress: Math.min(0.99, held / cfg.holdMs), candidate: candidate.klasse, fired: null }
  }

  return { update, reset, get state() { return state } }
}
