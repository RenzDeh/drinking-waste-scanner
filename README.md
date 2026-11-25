# Statiegeld-scanner ♻️

Mobiele webapp die blikjes, PET-flessen en glazen flessen herkent met een objectdetectiemodel dat **op het toestel** draait, en daar (fictieve) statiegeldpunten voor geeft.

> Howest MCT — AutoML-opdracht · Naam: _[jouw naam]_ · Live: _[https://… .vercel.app]_

---

## Track

**Track D — eigen idee.**

_[Beschrijf in 2–3 zinnen het idee en waarom je het gekozen hebt.]_

---

## Hoe starten

Vereisten: Node.js 20+ en npm.

```powershell
npm install
copy .env.example .env      # vul daarna je eigen sleutels in
npm run dev                 # http://localhost:5173
```

| Script | Wat het doet |
| --- | --- |
| `npm run dev` | Dev-server op localhost (camera werkt op localhost zonder HTTPS) |
| `npm run dev:phone` | Dev-server op je lokale netwerk met zelfondertekend HTTPS, om met je telefoon te testen |
| `npm test` | Unit tests van de scan-trigger |
| `npm run build` | Productiebuild in `dist/` |

### Omgevingsvariabelen (`.env`)

| Variabele | Waar vind je die? |
| --- | --- |
| `VITE_ROBOFLOW_PUBLISHABLE_KEY` | Roboflow › Settings › API Keys › _Publishable API Key_ (`rf_…`) |
| `VITE_ROBOFLOW_MODEL` | Project-slug (bv. `drinking-waste-ab12c`) of volledige model-id `workspace/model-slug` |
| `VITE_ROBOFLOW_VERSION` | Versienummer van het getrainde model (leeg laten bij een volledige model-id) |
| `VITE_FIREBASE_*` | Firebase console › Project settings › Your apps › Web app |

Zonder Firebase-variabelen draait de app in **lokale modus** (scans in `localStorage`, enkel op dit toestel).

### Firebase opzetten

1. [console.firebase.google.com](https://console.firebase.google.com) › _Add project_ (Google Analytics mag uit).
2. _Build › Firestore Database › Create database_ › kies regio `europe-west1` › _production mode_.
3. _Firestore › Rules_: plak de inhoud van [`firestore.rules`](firestore.rules) › _Publish_.
4. _Project settings › General › Your apps › Web (`</>`)_ › registreer de app › kopieer de config naar `.env`.

---

## Dataset

- **Bron:** [Drinking Waste Classification](https://www.kaggle.com/datasets/arkadiyhacks/drinking-waste-classification) (Kaggle, licentie **CC0**).
- **Omvang:** ~1.377 foto's geüpload naar Roboflow.
- **Klassen (3):** `can`, `pet`, `glass` in het model; de app vertaalt die naar `blik`, `pet`, `glas` (`MODEL_LABELS` in `src/config.js`). _[Vermeld wat je met de 4e klasse uit de originele dataset (HDPE/melk) gedaan hebt.]_
- **Negatieve beelden (null images):** 300 foto's zonder blik/fles uit [COCO val2017](https://cocodataset.org) (annotaties CC BY 4.0, beelden met Flickr-licentie per foto, zie `negatives/CREDITS.csv`): ~65% met een persoon groot in beeld, ~35% binnenruimtes. Toegevoegd nadat versie 2 een persoon voor de webcam als "blikje" (90%) herkende. Opnieuw aan te maken met `npm run negatives`.
- **Annotatie:** _[hoe heb je de bounding boxes gemaakt? Auto-label / handmatig / gecontroleerd?]_
- **Split:** _[train / valid / test, bv. 70/20/10]_
- **Preprocessing:** _[bv. auto-orient, resize 384×384]_
- **Augmentatie:** _[bv. flip, rotatie ±15°, helderheid ±25%, blur, …]_ → _[aantal]_ trainingsbeelden.
- **Model:** RF-DETR Nano, getraind in Roboflow. mAP@50: _[..]_ · precision: _[..]_ · recall: _[..]_

---

## Privacy

- **Inferentie op het toestel:** het model draait in de browser met [`inferencejs`](https://www.npmjs.com/package/inferencejs) (TensorFlow.js in een Web Worker). De publishable key wordt enkel gebruikt om de modelgewichten te downloaden. **Camerabeelden en frames verlaten het toestel nooit** en worden nergens opgeslagen.
- **Geen login:** geen account, e-mail of wachtwoord. Enkel een zelfgekozen bijnaam en een willekeurig speler-ID in `localStorage`.
- **Minimale opslag:** per scan bewaart Firestore enkel `{ spelerId, bijnaam, klasse, punten, zekerheid, tijdstip }`.
- **Security rules:** enkel lezen en aanmaken, geen updaten of verwijderen; elk scan-document wordt gevalideerd (exacte velden, klasse uit de lijst, punten per klasse, zekerheid > 0,55, servertijd).
- _[Beperking: zonder auth kan iemand met technische kennis nog steeds rechtstreeks geldige scans aanmaken. Bespreek dit.]_

---

## Trigger (anti-fop)

Instelbaar in [`src/config.js`](src/config.js):

- Een scan telt pas als **dezelfde klasse minstens 1 s aaneengesloten > 55 %** zekerheid heeft.
- Daarna **cooldown**: het item moet eerst uit beeld (5 frames én 0,7 s zonder detectie) voor er een volgende scan telt.
- Een andere klasse, één zwak frame of een pauze van meer dan 1,5 s tussen frames zet de teller terug op nul.

---

## Faalsituaties

| # | Situatie | Wat ging er mis? | Aanpassing |
| --- | --- | --- | --- |
| 1 | _[bv. platgedrukt blikje]_ | _[..]_ | _[..]_ |
| 2 | _[bv. doorzichtige PET-fles tegen lichte achtergrond]_ | _[..]_ | _[..]_ |
| 3 | _[bv. foto van een fles op een ander scherm]_ | _[..]_ | _[..]_ |

---

## Reflectie (max. 200 woorden)

_[Foppen: hoe kan je het systeem misleiden (foto op scherm, hetzelfde blikje opnieuw scannen, …) en wat heb je daartegen gedaan?]_

_[Bias: welke merken, kleuren, achtergronden of lichtomstandigheden zitten (niet) in de dataset? Voor wie werkt het model slechter?]_

---

## AI-verantwoording

| Tool | Waarvoor | Belangrijkste prompts | Wat heb ik zelf aangepast/gecontroleerd? |
| --- | --- | --- | --- |
| Claude Code | Opzet van de Vue-app, trigger-logica, Firestore rules, README-template | _[..]_ | _[..]_ |
| Roboflow | Annotatie, augmentatie, training RF-DETR | — | _[..]_ |
| _[..]_ | _[..]_ | _[..]_ | _[..]_ |

---

## Projectstructuur

```
src/
  config.js               drempels, punten, dagdoelen
  lib/scanTrigger.js      state machine voor de trigger (getest in tests/)
  lib/storage.js          localStorage met try/catch
  lib/haptics.js          trilling (Android) / haptische tik (iOS 18+)
  services/inference.js   inferencejs (model op het toestel)
  services/scans.js       Firestore (of lokale modus)
  services/player.js      bijnaam + speler-ID
  composables/            camera, dagdoel
  views/                  Start, Scan, Profiel, Leaderboard
firestore.rules           security rules
vercel.json               SPA-routing
```
