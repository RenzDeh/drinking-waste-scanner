// Centrale configuratie van de Statiegeld-scanner.
// Pas hier drempels, punten en het dagdoel aan. Hou de punten in sync met firestore.rules.

export const CLASSES = ['blik', 'pet', 'glas']

export const CLASS_INFO = {
  blik: { label: 'Blikje', emoji: '🥫', color: '#f5b83d' },
  pet: { label: 'PET-fles', emoji: '🧴', color: '#4fc3f7' },
  glas: { label: 'Glazen fles', emoji: '🍾', color: '#3ddc84' },
}

export const POINTS = {
  blik: 10,
  pet: 10,
  glas: 5,
}

export const TRIGGER = {
  // Een scan telt pas als dezelfde klas aaneengesloten boven deze zekerheid blijft ...
  confidenceThreshold: 0.9,
  // ... gedurende minstens zoveel milliseconden.
  holdMs: 1000,
  // Valt er tussen twee frames langer dan dit niets binnen (bv. trage inferentie of
  // tabblad op de achtergrond), dan begint de teller opnieuw.
  maxFrameGapMs: 600,
  // Cooldown: na een geldige scan moet het item eerst uit beeld. Zoveel frames op rij
  // zonder detectie boven `presenceThreshold` ...
  clearFrames: 5,
  // ... en minstens zo lang (ms), zodat een snelle telefoon het niet in 5 frames wegwerkt.
  clearMinMs: 700,
  // Vanaf welke zekerheid we iets als "nog in beeld" beschouwen tijdens de cooldown.
  presenceThreshold: 0.4,
}

export const DETECTION = {
  // Kaders die we tekenen op het canvas (lager dan de trigger-drempel, puur visueel).
  displayThreshold: 0.4,
  // Minimale tijd tussen twee inferenties (ms). 0 = zo snel als het toestel kan.
  minIntervalMs: 0,
}

// Fictief statiegeld: zoveel euro per punt (10 punten = € 0,10).
export const EURO_PER_POINT = 0.01

export const LEADERBOARD_SIZE = 10

// Dagdoelen: elke dag wordt er één gekozen op basis van de datum.
// `klasse: null` = elk item telt.
export const DAILY_CHALLENGES = [
  { id: 'vijf-in-twee', label: 'Scan 5 items in 2 minuten', target: 5, durationSec: 120, klasse: null, bonus: 25 },
  { id: 'drie-blik', label: 'Scan 3 blikjes in 90 seconden', target: 3, durationSec: 90, klasse: 'blik', bonus: 20 },
  { id: 'vier-pet', label: 'Scan 4 PET-flessen in 2 minuten', target: 4, durationSec: 120, klasse: 'pet', bonus: 25 },
  { id: 'twee-glas', label: 'Scan 2 glazen flessen in 60 seconden', target: 2, durationSec: 60, klasse: 'glas', bonus: 15 },
  { id: 'acht-in-drie', label: 'Scan 8 items in 3 minuten', target: 8, durationSec: 180, klasse: null, bonus: 40 },
]

// Bonuspunten worden als aparte "scan" met klasse 'bonus' opgeslagen.
export const BONUS_CLASS = 'bonus'

export const NICKNAME = { min: 2, max: 20 }
