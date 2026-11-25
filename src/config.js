// Centrale configuratie van de Statiegeld-scanner.
// Pas hier drempels, punten en het dagdoel aan. Hou de punten in sync met firestore.rules.

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

export const CLASS_INFO = {
	blik: { label: "Blikje", emoji: "🥫", color: "#f5b83d" },
	pet: { label: "PET-fles", emoji: "🧴", color: "#4fc3f7" },
	glas: { label: "Glazen fles", emoji: "🍾", color: "#3ddc84" },
};

export const POINTS = {
	blik: 10,
	pet: 10,
	glas: 5,
};

export const TRIGGER = {
	// Een scan telt pas als dezelfde klas aaneengesloten boven deze zekerheid blijft ...
	confidenceThreshold: 0.55,
	// ... gedurende minstens zoveel milliseconden.
	holdMs: 1000,
	// Valt er tussen twee frames langer dan dit niets binnen (bv. trage inferentie of
	// tabblad op de achtergrond), dan begint de teller opnieuw.
	// Ruim genomen: RF-DETR (640x640) haalt op sommige toestellen maar ~2 fps.
	maxFrameGapMs: 1500,
	// Cooldown: na een geldige scan moet het item eerst uit beeld. Zoveel frames op rij
	// zonder detectie boven `presenceThreshold` ...
	clearFrames: 5,
	// ... en minstens zo lang (ms), zodat een snelle telefoon het niet in 5 frames wegwerkt.
	clearMinMs: 700,
	// Vanaf welke zekerheid we iets als "nog in beeld" beschouwen tijdens de cooldown.
	presenceThreshold: 0.4,
};

export const DETECTION = {
	// Kaders die we tekenen op het canvas (lager dan de trigger-drempel, puur visueel).
	displayThreshold: 0.25,
	// Drempel binnen inferencejs zelf (standaard 0.5 => alles daaronder werd weggegooid
	// voor de app het zag). Laag zetten zodat we ook zwakke gokken kunnen tonen.
	modelScoreThreshold: 0.25,
	// Toon de sterkste ruwe gok van het model in een chip (handig om te testen).
	showDebug: true,
	// Minimale tijd tussen twee inferenties (ms). 0 = zo snel als het toestel kan.
	minIntervalMs: 0,
	// Plausibiliteitsfilter op de grootte van het kader (fractie van het beeld).
	// Het model is getraind zonder "lege" beelden en ziet daardoor soms een persoon of
	// een hele kamer als item. Zulke kaders bedekken bijna het hele beeld => niet laten tellen.
	// Zet maxBoxArea op 1 om de filter uit te schakelen.
	// Fractie van het vierkante scangebied in het midden van het beeld.
	maxBoxArea: 0.6,
	minBoxArea: 0.01,
};

// Fictief statiegeld: zoveel euro per punt (10 punten = € 0,10).
export const EURO_PER_POINT = 0.01;

export const LEADERBOARD_SIZE = 10;

// Dagdoelen: elke dag wordt er één gekozen op basis van de datum.
// `klasse: null` = elk item telt.
export const DAILY_CHALLENGES = [
	{ id: "vijf-in-twee", label: "Scan 5 items in 2 minuten", target: 5, durationSec: 120, klasse: null, bonus: 25 },
	{ id: "drie-blik", label: "Scan 3 blikjes in 90 seconden", target: 3, durationSec: 90, klasse: "blik", bonus: 20 },
	{ id: "vier-pet", label: "Scan 4 PET-flessen in 2 minuten", target: 4, durationSec: 120, klasse: "pet", bonus: 25 },
	{ id: "twee-glas", label: "Scan 2 glazen flessen in 60 seconden", target: 2, durationSec: 60, klasse: "glas", bonus: 15 },
	{ id: "acht-in-drie", label: "Scan 8 items in 3 minuten", target: 8, durationSec: 180, klasse: null, bonus: 40 },
];

// Bonuspunten worden als aparte "scan" met klasse 'bonus' opgeslagen.
export const BONUS_CLASS = "bonus";

export const NICKNAME = { min: 2, max: 20 };
