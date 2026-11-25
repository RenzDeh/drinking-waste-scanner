// Centrale configuratie van de Statiegeld-scanner.
// Pas hier de klassen, drempels en detectie-instellingen aan.

export const CLASSES = ["blik", "pet", "glas"];

// Labels zoals het Roboflow-model ze teruggeeft -> klassen in de app.
// Het getrainde model gebruikt Engelse namen (can / glass / pet).
// Onbekende labels worden genegeerd (tellen nooit als scan).
export const MODEL_LABELS = {
	can: "blik",
	glass: "glas",
	pet: "pet",
	// ook Nederlandse labels accepteren, voor het geval je hertraint met andere namen
	blik: "blik",
	glas: "glas",
};

// Wat de app toont per klasse. `bin` = waar het item in België hoort.
export const CLASS_INFO = {
	blik: { label: "Blik", long: "Blikje", bin: "PMD-zak", color: "#d97706" },
	pet: { label: "PET-fles", long: "Plastic fles", bin: "PMD-zak", color: "#0284c7" },
	glas: { label: "Glas", long: "Glazen fles", bin: "Glasbak", color: "#059669" },
};

export const TRIGGER = {
	// Een scan telt pas als dezelfde klas boven deze zekerheid start ...
	confidenceThreshold: 0.55,
	// ... en minstens zoveel milliseconden vastgehouden wordt.
	holdMs: 1000,
	// Valt er tussen twee frames langer dan dit niets binnen (bv. trage inferentie of
	// tabblad op de achtergrond), dan begint de teller opnieuw.
	maxFrameGapMs: 1500,
	// Cooldown: na een scan moet het item eerst uit beeld. Zoveel frames op rij
	// zonder detectie boven `presenceThreshold` ...
	clearFrames: 5,
	// ... en minstens zo lang (ms).
	clearMinMs: 700,
	// Vanaf welke zekerheid we iets als "nog in beeld" beschouwen tijdens de cooldown.
	presenceThreshold: 0.4,
	// Korte onderbrekingen (zwak frame, even een andere klas) tot zoveel ms worden
	// getolereerd tijdens het vasthouden. Kleine modellen schommelen per frame.
	dropoutMs: 400,
	// Hysterese: eens gestart (> confidenceThreshold) mag dezelfde klas tussendoor zakken
	// tot deze waarde zonder dat de seconde opnieuw begint. Een scan telt pas op een frame
	// boven confidenceThreshold. Gelijk aan confidenceThreshold = uitschakelen.
	keepThreshold: 0.4,
};

export const DETECTION = {
	// Kaders die we tekenen op het canvas (lager dan de trigger-drempel, puur visueel).
	displayThreshold: 0.25,
	// Drempel binnen inferencejs zelf (standaard 0.5 => alles daaronder werd weggegooid
	// voor de app het zag). Laag zetten zodat we ook zwakke gokken kunnen tonen.
	modelScoreThreshold: 0.25,
	// Toon de sterkste ruwe gok van het model + het modelbeeld (handig om te testen).
	showDebug: false,
	// Minimale tijd tussen twee inferenties (ms). Geeft de browser tijd om geheugen op te ruimen.
	minIntervalMs: 150,
	// Grootte waarnaar het scangebied verkleind wordt voor het naar het model gaat.
	// Zet gelijk aan de "Model input" in Roboflow (v5 YOLO11n: 640x640).
	inputSize: 640,
	// Vorm (breedte/hoogte) van het scangebied dat naar het model gaat (wordt naar een
	// vierkant gerekt). 3/4 = zoals je staande iPhone-trainingsfoto's die Roboflow met
	// "Stretch to 640x640" tot een vierkant rekte. 1 = vierkant, zonder vervorming.
	regionAspect: 3 / 4,
	// Plausibiliteitsfilter op de grootte van het kader (fractie van het scangebied).
	// Kaders die bijna het hele gebied bedekken (bv. een persoon) tellen niet.
	// Zet maxBoxArea op 1 om de filter uit te schakelen.
	maxBoxArea: 0.6,
	minBoxArea: 0.01,
};

// Hoe lang de resultaat-popup zichtbaar blijft (ms).
export const RESULT_MS = 3500;
