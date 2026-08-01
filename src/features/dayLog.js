/**
 * Tageslog – die Form der gefahrenen Tage, über Wochen.
 *
 * Der Feierabend-Rückblick rechnet den Tag bereits vollständig aus
 * (features/dayReview.js) und wirft das Ergebnis um Mitternacht weg. Damit ist
 * TourFuchs das seltene Werkzeug, das erfährt, ob ein Plan **befolgt** wurde –
 * und es vergisst diese Auskunft täglich wieder.
 *
 * Dieses Modul hält sie fest. Es ist bewusst **kein Feature auf Vorrat**,
 * sondern ein Messgerät mit einer konkreten Frage (siehe „Tor" unten).
 *
 * ## Was NICHT gespeichert wird
 *
 * Keine Kunden-IDs, keine Namen, keine Koordinaten – nur die **Form** des
 * Tages in sechs Zahlen. Der ursprüngliche Entwurf sah `besuchteIds` und
 * `geplanteIds` vor; sie sind gestrichen. Die Frage, die dieses Log
 * beantworten soll, lautet „sehen die Tage gleich aus?", und dafür ist
 * gleichgültig, **wer** im Tag vorkam. Wer welchen Kunden wann gesehen hat,
 * steht ohnehin in `customer.besuche` – ein zweites Register derselben
 * Personendaten wäre zusätzliches Risiko ohne zusätzliche Erkenntnis.
 *
 * Deshalb liegt das Log in `localStorage` und nicht im verschlüsselten
 * Kundenspeicher: Es enthält nichts, was den Tresor bräuchte.
 *
 * ## Das Tor, für das dieses Log gebaut ist
 *
 * Vorschlag B3 („morgens drei Tagesvarianten zur Wahl statt einer Tour, die
 * man baut") behauptet: *Tage haben unterschiedliche Ziele, und der Nutzer
 * wählt zwischen ihnen, statt zu bauen.* Prüfbar wird das, wenn man sieht, ob
 * die tatsächlich gefahrenen Tage einander gleichen oder zwischen Archetypen
 * springen – kurzer Weg (viele Stopps, wenig km je Stopp) gegen Chancen-Tag
 * (wenige Stopps, hoher Überfälligen-Anteil).
 *
 * Gleichen sie einander, sind drei Varianten Rauschen und B3 stirbt zu Recht.
 * Beide Abbruchbedingungen stehen im Änderungsprotokoll der Wissensbasis; die
 * Zahlen dafür liefert `dayLogStats()`.
 */

const STORE_KEY = 'tf_tageslog';

// Ein halbes Jahr Tage. Mehr braucht die Frage nicht, und der Speicher bleibt
// im zweistelligen Kilobyte-Bereich.
const MAX_ENTRIES = 180;

function store(provided) {
    if (provided) return provided;
    try { return globalThis.localStorage || null; } catch { return null; }
}

function toCount(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function isDayKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''));
}

/** Ein Eintrag auf die sechs Zahlen reduzieren, die wir speichern. */
function normalizeEntry(raw) {
    if (!raw || !isDayKey(raw.tag)) return null;
    return {
        tag: raw.tag,
        besuche: toCount(raw.besuche),
        geplant: toCount(raw.geplant),
        spontan: toCount(raw.spontan),
        ueberfaellig: toCount(raw.ueberfaellig),
        km: toCount(raw.km)
    };
}

/** @returns {Array} nach Datum aufsteigend, kaputte Einträge stillschweigend verworfen */
export function readDayLog(provided) {
    try {
        const raw = JSON.parse(store(provided)?.getItem(STORE_KEY) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
            .map(normalizeEntry)
            .filter(Boolean)
            .sort((a, b) => a.tag.localeCompare(b.tag));
    } catch {
        return [];
    }
}

function writeDayLog(entries, provided) {
    try {
        store(provided)?.setItem(STORE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch {
        /* Speicherung ist optional – ein volles localStorage darf den Rückblick nicht kippen. */
    }
}

/**
 * Den Tag festhalten. Mehrfach am Tag aufrufbar: Der Eintrag des Tages wird
 * ersetzt, nicht ergänzt – wer abends zwei Besuche nachträgt, korrigiert den
 * Tag, er verdoppelt ihn nicht.
 *
 * Leere Tage werden nicht geschrieben. Ein Tag ohne Besuch und ohne Plan ist
 * kein Datenpunkt über Arbeitsweise, sondern ein Tag, an dem die App offen war.
 *
 * @param {object} review Ergebnis von `dayReview()`
 * @returns {object|null} der geschriebene Eintrag, oder null wenn nichts zu schreiben war
 */
export function recordDayReview(review, provided) {
    if (!review || !isDayKey(review.day)) return null;
    const entry = normalizeEntry({
        tag: review.day,
        besuche: review.visitedCount,
        geplant: review.plannedCount,
        spontan: Array.isArray(review.spontaneous) ? review.spontaneous.length : 0,
        ueberfaellig: review.overdueCleared,
        km: Math.round(review.roadKmEstimate || 0)
    });
    if (!entry || (entry.besuche === 0 && entry.geplant === 0)) return null;

    const existing = readDayLog(provided);
    // Der Rückblick wird bei jeder Tour- und Besuchsänderung neu gerechnet.
    // Hat sich an der Form des Tages nichts geändert, wird auch nicht
    // geschrieben – sonst kostet jedes Antippen eines Stopps einen Speicherlauf.
    const previous = existing.find((item) => item.tag === entry.tag);
    if (previous && JSON.stringify(previous) === JSON.stringify(entry)) return null;

    const entries = existing.filter((item) => item.tag !== entry.tag);
    entries.push(entry);
    entries.sort((a, b) => a.tag.localeCompare(b.tag));
    writeDayLog(entries, provided);
    return entry;
}

/**
 * Anteil der besuchten Kunden, die vorher überfällig waren.
 * Die erste der beiden Kennzahlen, an denen sich Tage unterscheiden: Ein Tag,
 * der Lücken schließt, sieht hier anders aus als einer, der Strecke macht.
 */
export function ueberfaelligAnteil(entry) {
    if (!entry?.besuche) return null;
    return entry.ueberfaellig / entry.besuche;
}

/**
 * Geschätzte Straßenkilometer je Besuch – die zweite Kennzahl.
 *
 * **Bekannte Unschärfe, absichtlich nicht wegdefiniert:** `km` ist die Länge
 * der *geplanten* Route, `besuche` sind die *tatsächlichen* Stopps. An einem
 * Tag, an dem geplante Stopps ausfielen, fällt der Wert deshalb zu hoch aus.
 * Beide Rohwerte bleiben im Eintrag stehen, damit eine spätere Auswertung
 * einen anderen Nenner wählen kann, ohne die Historie neu erheben zu müssen.
 */
export function kmProStopp(entry) {
    if (!entry?.besuche || !entry.km) return null;
    return entry.km / entry.besuche;
}

function spread(values) {
    if (values.length < 2) return null;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    // Variationskoeffizient: Streuung im Verhältnis zum Mittel, damit sich
    // Kilometer und Anteile überhaupt vergleichen lassen.
    return Math.sqrt(variance) / mean;
}

/**
 * Die Zahlen, an denen das Tor entschieden wird.
 *
 * `tageMitBesuch` beantwortet die erste Abbruchbedingung (zu wenig Signal),
 * die beiden Streuungen die eigentliche Frage: Gleichen sich die Tage?
 *
 * @returns {{
 *   tage: number, tageMitBesuch: number, ersterTag: string|null, letzterTag: string|null,
 *   streuungUeberfaelligAnteil: number|null, streuungKmProStopp: number|null,
 *   planStabilitaet: number|null, spontanAnteil: number|null
 * }}
 */
export function dayLogStats(entries = readDayLog()) {
    const withVisits = entries.filter((entry) => entry.besuche > 0);
    const overdueShares = withVisits.map(ueberfaelligAnteil).filter((value) => value !== null);
    const kmShares = withVisits.map(kmProStopp).filter((value) => value !== null);

    const planned = entries.reduce((sum, entry) => sum + entry.geplant, 0);
    const visited = withVisits.reduce((sum, entry) => sum + entry.besuche, 0);
    const spontaneous = withVisits.reduce((sum, entry) => sum + entry.spontan, 0);

    return {
        tage: entries.length,
        tageMitBesuch: withVisits.length,
        ersterTag: entries[0]?.tag ?? null,
        letzterTag: entries[entries.length - 1]?.tag ?? null,
        streuungUeberfaelligAnteil: spread(overdueShares),
        streuungKmProStopp: spread(kmShares),
        // Zusatzsignal, nicht entscheidend: hält der morgens gebaute Plan?
        planStabilitaet: planned > 0 ? Math.min(1, (visited - spontaneous) / planned) : null,
        spontanAnteil: visited > 0 ? spontaneous / visited : null
    };
}

export function clearDayLog(provided) {
    try { store(provided)?.removeItem(STORE_KEY); } catch { /* optional */ }
}
