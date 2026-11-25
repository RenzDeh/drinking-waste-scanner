import { describe, it, expect } from 'vitest'
import { boxRejectReason } from '../src/lib/boxFilter'

const cfg = { maxBoxArea: 0.4, minBoxArea: 0.01 }
const box = (w, h) => ({ bbox: { x: 0, y: 0, width: w, height: h } })

describe('boxRejectReason', () => {
  it('keurt een kader af dat bijna het hele beeld bedekt (persoon)', () => {
    expect(boxRejectReason(box(850, 640), 1280, 720, cfg)).toBe('te-groot')
  })
  it('laat een blikje in de hand door', () => {
    expect(boxRejectReason(box(250, 400), 1280, 720, cfg)).toBeNull()
  })
  it('keurt een piepklein kader af', () => {
    expect(boxRejectReason(box(30, 30), 1280, 720, cfg)).toBe('te-klein')
  })
})
