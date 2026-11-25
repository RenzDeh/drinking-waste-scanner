# Statiegeld-scanner ♻️

Webapp die blikjes, PET-flessen en glazen flessen herkent met een objectdetectiemodel dat **in de browser, op het toestel** draait. Na een scan toont een popup wat het is en in welke vuilbak het hoort (PMD-zak of glasbak).

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
| `npm run phone` | Productiebuild op je lokale netwerk via HTTPS (lichter dan de dev-server) |
| `npm run deploy` | Productiebuild en deploy naar Vercel via de Vercel CLI |
| `npm run negatives` | Stelt 300 null images (geen blik/fles) samen uit COCO |
| `npm test` | Unit tests van de scan-trigger |
| `npm run build` | Productiebuild in `dist/` |

### Omgevingsvariabelen (`.env`)

| Variabele | Waar vind je die? |
| --- | --- |
| `VITE_ROBOFLOW_PUBLISHABLE_KEY` | Roboflow › Settings › API Keys › _Publishable API Key_ (`rf_…`) |
| `VITE_ROBOFLOW_MODEL` | Project-slug (bv. `drinking-waste-ab12c`) of volledige model-id `workspace/model-slug` |
| `VITE_ROBOFLOW_VERSION` | Versienummer van het getrainde model (leeg laten bij een volledige model-id) |

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
- **Model:** YOLO11 Nano (v5), getraind in Roboflow op 640×640. mAP@50: _[..]_ · precision: _[..]_ · recall: _[..]_
- **Modelkeuze:** RF-DETR Nano (v2–v4) was accurater op onbekende foto's, maar Safari op de iPhone crashte tijdens het laden (29,4 M parameters). YOLO11 Nano (2,6 M parameters) laadt en draait wel op de iPhone. _[Licht toe.]_

---

## Privacy

- **Inferentie op het toestel:** het model draait in de browser met [`inferencejs`](https://www.npmjs.com/package/inferencejs) (TensorFlow.js in een Web Worker). De publishable key wordt enkel gebruikt om de modelgewichten te downloaden. **Camerabeelden en frames verlaten het toestel nooit** en worden nergens opgeslagen.
- **Geen login, geen database:** geen account en geen server. Er wordt niets opgeslagen; de lijst "Deze sessie" bestaat enkel in het geheugen van de browser en verdwijnt bij het herladen.
- Enkel een kruimelpad van de opstartstappen (tekst, geen beelden) staat in `localStorage`, om crashes op te sporen.

---

## Trigger (anti-fop)

Instelbaar in [`src/config.js`](src/config.js):

- Een scan telt pas als **dezelfde klasse minstens 1 s** herkend wordt (start > 55 %).
- Daarna **cooldown**: het item moet eerst uit beeld (5 frames én 0,7 s zonder detectie) voor er een volgende scan telt.
- Een kader dat meer dan 60 % van het scangebied bedekt (bv. een persoon) telt niet.
- **Hysterese:** starten vraagt > 55 %, maar eens bezig mag dezelfde klasse zakken tot 40 % zonder onderbreking (de iPhone-camera schommelt meer dan een laptopwebcam); de scan zelf telt enkel op een frame > 55 %.
- Korte dipjes (een zwak frame of even een andere klasse, < 0,4 s) worden getolereerd, omdat YOLO11 Nano per frame schommelt. Een langere onderbreking of een pauze van meer dan 1,5 s tussen frames zet de teller terug op nul. De getoonde zekerheid is de laagste zekerheid van de sterke frames.

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
| Claude Code | Opzet van de Vue-app, trigger-logica, debugging (iPhone-crash, vervorming van het beeld), README-template | _[..]_ | _[..]_ |
| Roboflow | Annotatie (Label Assist), augmentatie, training RF-DETR en YOLO11 | — | _[..]_ |
| _[..]_ | _[..]_ | _[..]_ | _[..]_ |

---

## Projectstructuur

```
src/
  config.js               klassen, drempels, detectie-instellingen
  views/ScanView.vue      het scanscherm + resultaat-popup
  services/inference.js   inferencejs (model op het toestel), scangebied
  composables/useCamera.js camera (achtercamera, playsinline/muted voor iOS)
  lib/scanTrigger.js      state machine voor de trigger (getest in tests/)
  lib/boxFilter.js        filter op te grote/kleine kaders
  lib/breadcrumbs.js      kruimelpad om crashes op te sporen
  lib/haptics.js          trilling (Android) / haptische tik (iOS 18+)
  lib/storage.js          localStorage met try/catch
scripts/fetch-negatives.mjs  null images uit COCO
vercel.json               SPA-routing + headers
```
