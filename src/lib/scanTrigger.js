// Pure, testbare state machine voor de scan-trigger ("moeilijk te foppen").
//
//  ZOEKEN ──(zelfde klas > drempel, aaneengesloten ≥ holdMs)──▶ SCAN! ──▶ COOLDOWN
//  COOLDOWN ──(≥ clearFrames frames én ≥ clearMinMs zonder detectie)──▶ ZOEKEN
//
// Elke onderbreking (andere klas, zekerheid onder de drempel, of een te grote pauze tussen
// frames) zet de teller terug op nul.

export function createScanTrigger(cfg) {
  let state = 'searching' // 'searching' | 'cooldown'
  let candidate = null // { klasse, since, minConf }
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
    const strong = best != null && best.confidence > cfg.confidenceThreshold
    if (!strong || gap > cfg.maxFrameGapMs) {
      candidate = strong ? { klasse: best.class, since: now, minConf: best.confidence } : null
      return { state, progress: 0, candidate: candidate?.klasse ?? null, fired: null }
    }

    if (!candidate || candidate.klasse !== best.class) {
      candidate = { klasse: best.class, since: now, minConf: best.confidence }
    } else {
      candidate.minConf = Math.min(candidate.minConf, best.confidence)
    }

    const held = now - candidate.since
    if (held >= cfg.holdMs) {
      const fired = { klasse: candidate.klasse, zekerheid: candidate.minConf }
      state = 'cooldown'
      candidate = null
      emptyFrames = 0
      emptySince = null
      return { state, progress: 1, candidate: null, fired }
    }
    return { state, progress: held / cfg.holdMs, candidate: candidate.klasse, fired: null }
  }

  return { update, reset, get state() { return state } }
}
