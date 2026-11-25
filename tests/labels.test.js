import { describe, it, expect } from 'vitest'
import { normalizeDetections } from '../src/services/inference'

describe('normalizeDetections', () => {
  it('vertaalt modellabels naar app-klassen en laat onbekende weg', () => {
    const out = normalizeDetections([
      { class: 'can', confidence: 0.95 },
      { class: 'glass', confidence: 0.92 },
      { class: 'pet', confidence: 0.91 },
      { class: 'HDPE', confidence: 0.99 },
      { class: 'Can ', confidence: 0.8 },
    ])
    expect(out.map((d) => d.class)).toEqual(['blik', 'glas', 'pet', 'blik'])
  })
})

import { scanRegion } from '../src/services/inference'

describe('scanRegion', () => {
  it('knipt een vierkant uit het midden van een breed beeld', () => {
    expect(scanRegion(1280, 720, 1)).toEqual({ x: 280, y: 0, w: 720, h: 720 })
  })
  it('knipt een vierkant uit het midden van een staand (iPhone) beeld', () => {
    expect(scanRegion(720, 1280, 1)).toEqual({ x: 0, y: 280, w: 720, h: 720 })
  })
  it('knipt een staand 3:4-gebied uit een staand iPhone-beeld', () => {
    expect(scanRegion(720, 1280, 3 / 4)).toEqual({ x: 0, y: 160, w: 720, h: 960 })
  })
  it('knipt een staand 3:4-gebied uit een breed laptopbeeld', () => {
    expect(scanRegion(1280, 720, 3 / 4)).toEqual({ x: 370, y: 0, w: 540, h: 720 })
  })
})
