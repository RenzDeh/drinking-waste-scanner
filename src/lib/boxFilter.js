// Plausibiliteitscontrole op een detectie: een blikje of fles die je voor de camera houdt,
// bedekt nooit (bijna) het hele beeld. Zulke kaders zijn meestal een persoon of de kamer.
// Geeft null terug als het kader plausibel is, anders de reden.
export function boxRejectReason(d, frameW, frameH, cfg) {
  if (!frameW || !frameH) return null
  const area = (d.bbox.width * d.bbox.height) / (frameW * frameH)
  if (area > cfg.maxBoxArea) return 'te-groot'
  if (area < cfg.minBoxArea) return 'te-klein'
  return null
}
