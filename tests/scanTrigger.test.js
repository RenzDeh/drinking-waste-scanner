import { describe, it, expect } from 'vitest'
import { createScanTrigger } from '../src/lib/scanTrigger'

const cfg = {
  confidenceThreshold: 0.9,
  holdMs: 1000,
  maxFrameGapMs: 600,
  clearFrames: 5,
  clearMinMs: 700,
  presenceThreshold: 0.4,
  dropoutMs: 400,
  keepThreshold: 0.4,
}
const det = (klasse, confidence) => [{ class: klasse, confidence }]

// Simuleer frames om de `step` ms
function run(trigger, frames, step = 100, start = 0) {
  let t = start
  const results = []
  for (const f of frames) {
    results.push(trigger.update(f, t))
    t += step
  }
  return { results, t }
}

describe('scanTrigger', () => {
  it('vuurt na ≥1 s aaneengesloten > 90%', () => {
    const tr = createScanTrigger(cfg)
    const { results } = run(tr, Array(11).fill(det('blik', 0.95)))
    const fired = results.filter((r) => r.fired)
    expect(fired).toHaveLength(1)
    expect(fired[0].fired.klasse).toBe('blik')
    expect(results.findIndex((r) => r.fired)).toBe(10) // t = 1000 ms
  })

  it('vuurt niet bij precies 90% of lager', () => {
    const tr = createScanTrigger(cfg)
    const { results } = run(tr, Array(20).fill(det('pet', 0.9)))
    expect(results.some((r) => r.fired)).toBe(false)
  })

  it('reset als de klas wisselt', () => {
    const tr = createScanTrigger(cfg)
    const frames = [...Array(8).fill(det('blik', 0.95)), ...Array(8).fill(det('glas', 0.95))]
    const { results } = run(tr, frames)
    expect(results.some((r) => r.fired)).toBe(false)
  })

  it('tolereert één zwak frame (kort dipje)', () => {
    const tr = createScanTrigger(cfg)
    const frames = [...Array(8).fill(det('blik', 0.95)), det('blik', 0.5), ...Array(8).fill(det('blik', 0.95))]
    const fired = run(tr, frames).results.filter((r) => r.fired)
    expect(fired).toHaveLength(1)
    expect(fired[0].fired.zekerheid).toBe(0.95) // zwakke frames tellen niet mee in de zekerheid
  })

  it('tolereert even een andere klas', () => {
    const tr = createScanTrigger(cfg)
    const frames = [...Array(6).fill(det('pet', 0.95)), det('glas', 0.95), ...Array(6).fill(det('pet', 0.95))]
    const fired = run(tr, frames).results.filter((r) => r.fired)
    expect(fired).toHaveLength(1)
    expect(fired[0].fired.klasse).toBe('pet')
  })

  it('reset bij een lange onderbreking (> dropoutMs)', () => {
    const tr = createScanTrigger(cfg)
    const frames = [...Array(8).fill(det('blik', 0.95)), ...Array(5).fill([]), ...Array(8).fill(det('blik', 0.95))]
    expect(run(tr, frames).results.some((r) => r.fired)).toBe(false)
  })

  it('vuurt nooit tijdens een dipje', () => {
    const tr = createScanTrigger(cfg)
    const frames = [...Array(10).fill(det('blik', 0.95)), [], []]
    const { results } = run(tr, frames)
    expect(results.findIndex((r) => r.fired)).toBe(-1)
  })

  it('hysterese: eens gestart mag de zekerheid zakken tot keepThreshold', () => {
    const tr = createScanTrigger(cfg)
    const frames = [det('pet', 0.95), ...Array(10).fill(det('pet', 0.5)), det('pet', 0.92)]
    const fired = run(tr, frames).results.filter((r) => r.fired)
    expect(fired).toHaveLength(1)
    expect(fired[0].fired.zekerheid).toBe(0.92) // enkel sterke frames bepalen de zekerheid
  })

  it('hysterese: vuurt pas op een sterk frame, niet op een zwak', () => {
    const tr = createScanTrigger(cfg)
    const { results } = run(tr, [det('pet', 0.95), ...Array(15).fill(det('pet', 0.5))])
    expect(results.some((r) => r.fired)).toBe(false)
  })

  it('hysterese: onder keepThreshold telt als onderbreking', () => {
    const tr = createScanTrigger(cfg)
    const frames = [det('pet', 0.95), ...Array(10).fill(det('pet', 0.3)), det('pet', 0.95)]
    expect(run(tr, frames).results.some((r) => r.fired)).toBe(false)
  })

  it('reset bij een te grote pauze tussen frames', () => {
    const tr = createScanTrigger(cfg)
    expect(run(tr, Array(2).fill(det('blik', 0.95)), 700).results.some((r) => r.fired)).toBe(false)
  })

  it('cooldown: item moet eerst uit beeld', () => {
    const tr = createScanTrigger(cfg)
    let { t } = run(tr, Array(11).fill(det('blik', 0.95)))
    // Blijft in beeld: geen tweede scan
    let r = run(tr, Array(30).fill(det('blik', 0.95)), 100, t)
    expect(r.results.some((x) => x.fired)).toBe(false)
    // 8 lege frames (800 ms) => terug zoeken
    r = run(tr, Array(8).fill([]), 100, r.t)
    expect(tr.state).toBe('searching')
    // Opnieuw 1 s in beeld => tweede scan
    r = run(tr, Array(11).fill(det('blik', 0.95)), 100, r.t)
    expect(r.results.filter((x) => x.fired)).toHaveLength(1)
  })

  it('cooldown: te weinig lege frames is niet genoeg', () => {
    const tr = createScanTrigger(cfg)
    let { t } = run(tr, Array(11).fill(det('blik', 0.95)))
    const r = run(tr, [[], [], [], det('blik', 0.95), [], []], 100, t)
    expect(r.results.every((x) => x.state === 'cooldown')).toBe(true)
  })
})
