# Statiegeld-scanner

Renz Deheegher - Howest MCT - AutoML-opdracht

De demovideo staat in de map `demo/` (tester was Abdullah).

## Wat doet de app?

Je houdt een blikje, PET-fles of glazen fles voor de camera. Als je het ongeveer een seconde stilhoudt, krijg je een popup met wat het is en in welke vuilbak het moet (PMD of glas).

Bovenaan kan je wisselen tussen twee modi:

- Roboflow: mijn eigen getraind model, dat gewoon in de browser draait via een model-URL. Je foto wordt dus nergens naartoe gestuurd.
- Gemini: je drukt op Scan en er wordt een foto naar Gemini (Flash) gestuurd, dat zegt wat het ziet. Hier wordt de foto dus wel naar Google gestuurd.

## Dataset en modellen

Ik ben gestart met een dataset van Kaggle (Drinking Waste Classification) met ongeveer 1.400 foto's van PET-flesjes, glazen flesjes en blikken. Na wat opzoeken heb ik dat in Roboflow gestopt, omdat je daar makkelijk extra data kan toevoegen (roboflow heeft zelf ook veel datasets) en kleine modellen kan trainen die in de browser werken.

Vanaf versie 2 heb ik ook eigen foto's toegevoegd die ik met mijn gsm nam (flessen en blikjes in mijn hand, op verschillende plekken). In de latere versies heb ik er ook foto's aan toegevoegd van random dingen die geen flessen zijn (mensen, kamers), als een soort null-klasse, gezien een mens vaak als blik werd gezien :).

Ik heb RF-DETR en YOLOv11 getraind, allebei in Nano en Small. In nauwkeurigheid was er amper verschil, het zijn allebei simpele modellen. Het grootste verschil was dat RF-DETR mijn iPhone-browser liet crashen (te zwaar), terwijl YOLOv11 wel werkte op mobiel.

## Uitbreidingen

- Trigger moeilijker te foppen: de null-klasse met foto's zonder flessen, een item moet ongeveer 1 seconde herkend worden en je moet het vorige item eerst uit beeld halen voor je opnieuw kan scannen. Iets dat bijna het hele beeld vult (zoals een persoon) telt ook niet.
- Twee modellen vergeleken in RoboFlow: RF-DETR en YOLOv11 (Nano en Small).
- Gemini toegevoegd als extra modus. Dat is een AI-model, dus zonder dataset. Vergelijking : Gemini zag een plastic colafles meteen als PET-fles, mijn YOLO-model zei blik gezien het rode kleur. Dit kwam doordat het YOLO-model zich baseerde op het kleur van de dataset, daar waren veel rode blikjes cola aanwezig.

## Waar het model faalde

| Situatie                                 | Probleem                                                               | Wat ik aanpaste                                                                                                                                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fel licht van de ramen in ons lokaal     | Het item was niet meer zichtbaar, het model herkende niks of twijfelde | Foto's in ander licht toegevoegd en de drempel wat lager gezet (55%). Niet met je rug naar het raam scannen.                                                                                                |
| Rode kleur (veel colablikjes in de data) | Bij rood zei hij vaak blik, ook als het een fles was                   | Meer verschillende foto's en op de laptop RF-DETR gebruikt, die had hier minder last van. Ook wanneer ik de dop beter in beeld bracht ging dit veel beter.                                                  |
| Doorzichtig glas en PET zonder etiket    | Hij zag moeilijk het verschil tussen PET en glas                       | Meer foto's van PET-flessen toegevoegd, en het camerabeeld op dezelfde manier bijgesneden als mijn trainingsfoto's. Zoals bij de colablikjes hielp het enorm wanneer ik de dop duidelijker in beeld bracht. |

## Opstarten

Je hebt Node.js nodig.

```
npm install
copy .env.example .env
```

In `.env` vul je in:

- `VITE_ROBOFLOW_PUBLISHABLE_KEY`: de publishable key van Roboflow
- `VITE_ROBOFLOW_MODEL`: het model (bv. `renzs-workspace-tkpgh/drinking-wast-detection-4-rfdetr-nano-t1`)
- `GEMINI_API_KEY`: alleen nodig voor de Gemini-modus

Zet in `src/config.js` ook `inputSize` juist: 384 voor RF-DETR, 640 voor YOLOv11.

**Op pc**

1. `npm run dev`
2. Open http://localhost:5173 in Chrome en laat de camera toe.

**Op gsm**

1. Laptop en gsm op hetzelfde wifi zetten. Op school lukt dat meestal niet, dan gebruik je de hotspot van je gsm.
2. `npm run phone`
3. Open het Wi-Fi-adres dat in de terminal staat op je gsm (bv. `https://192.168.1.20:4173`).
4. Je krijgt een waarschuwing over het certificaat, klik op "Toon details" en "Bezoek deze website".

Blijft hij hangen op 0 fps? Sluit alle tabbladen van de app en de browser, en open hem opnieuw in één tabblad.

## Reflectie

Mijn trigger is nog te foppen. Als je een foto van een blikje op een ander scherm toont, herkent hij die ook gewoon. Om dat moeilijker te maken zou je kunnen vragen om het item even te draaien, of het vanuit twee kanten laten scannen. Het "eerst uit beeld halen" en de null-klasse helpen al, maar een foto van een foto houden ze niet tegen.

In mijn dataset zit ook bias. Veel blikjes waren cola, dus het model koppelde rood aan blik. Mijn eigen foto's waren telkens van hetzelfde flesje en blikje, thuis en met één gsm. Daardoor werkt hij slechter bij andere merken (bv. fanta was niet aanwezig en dus ook niet getest), ander licht of een andere camera. In de Roboflow-analyses haalde hij bijna 100%, maar in het echt was dat een stuk minder, omdat de testset te hard op de trainingsfoto's leek. Met meer verschillende merken, achtergronden en mensen zou het beter worden.

## AI-verantwoording

Ik heb vooral Claude Code gebruikt. Dat heeft de Vue-app opgezet (camera, detectie, trigger, popup, design) en me geholpen met problemen oplossen, zoals de crash op mijn iPhone en het model dat mij als blikje zag. Ook de Gemini-koppeling werd toegevoegd door Claude aan de hand van mijn API-key. De opmaak voor deze readme heb ik ook door Claude laten maken zodat alles overzichtelijk blijft.

Een paar prompts die ik gebruikte:

- "Bouw een mobiele webapp Statiegeld-scanner met Vue 3, inferencejs en mijn Roboflow-model"
- "Ik krijg constant 'a problem repeatedly occurred' op mijn iPhone, het model crasht"
- "Voeg een Gemini-versie toe met een toggle om te switchen tussen de 2 versies, zonder Roboflow te breken"

Wat ik zelf deed: de dataset samenstellen, foto's nemen en labelen per class, alle modellen trainen en vergelijken, alles testen op laptop en gsm en de fouten terugkoppelen. Ik heb ook zelf keuzes gemaakt, zoals de drempel op 55% zetten ipv 80-90 wat Claude aanraadde, het puntensysteem schrappen en RF-DETR op pc en YOLOv11 op gsm gebruiken.
