/**
 * Eigene Nachschlagequellen für die Briefing-Prompts.
 *
 * Das Problem, das dieses Modul löst: Ein Prompt, der sagt „durchsuche alle
 * Microsoft-365-Inhalte, auf die ich zugreifen darf", beschreibt einen
 * Heuhaufen. Der Assistent sucht überall und findet oft das Falsche oder
 * Veraltete – während der Nutzer genau weiß, wo das Aktuelle liegt: in *einer*
 * gepflegten Liste im Bezirksordner.
 *
 * Deshalb kann der Nutzer bis zu drei eigene Quellen hinterlegen. Sie werden
 * dem Prompt als **Vorrang-Hinweis** vorangestellt: erst hier nachsehen, das
 * ist das Aktuellste. Aus „such mal" wird „schau hier nach".
 *
 * Zwei Felder je Quelle, und das erste ist das wichtigere:
 *
 *  - **Was steckt drin** – erst dadurch weiß der Assistent, wie er die Ablage
 *    mit dem Kunden verknüpft („Zuordnung über die Kundennummer"). Ein nackter
 *    Link ohne diese Angabe hilft ihm kaum.
 *  - **Link oder Pfad** – bewusst Freitext. Eine SharePoint-Adresse ist der
 *    Normalfall, aber ein Teams-Kanal, ein Laufwerkspfad oder schlicht „Ordner
 *    Vertrieb / Bezirkslisten" sind ebenso legitime Ortsangaben. Es wird
 *    nichts abgerufen – der Text landet im Prompt, sonst nirgends.
 *
 * An der Architektur ändert das nichts: TourFuchs öffnet die Quelle nicht,
 * meldet sich nirgends an und sendet nichts. Der Eintrag ist Prompt-Text, den
 * der Nutzer vollständig sieht, bevor er ihn selbst im Assistenten absendet.
 *
 * DOM-frei mit injizierbarem Storage, damit die Logik unit-testbar bleibt.
 */

const KEY = 'tourfuchs:briefing-sources:v1';

/** Mehr Quellen ergeben keinen besseren Prompt, nur einen neuen Heuhaufen. */
export const BRIEFING_SOURCES_LIMIT = 3;

const LABEL_MAX = 160;
const LOCATION_MAX = 400;

function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function store(provided) {
    if (provided) return provided;
    try { return globalThis.localStorage || null; } catch { return null; }
}

/** Ein Eintrag ist nur dann einer, wenn wenigstens ein Feld gefüllt ist. */
export function normalizeBriefingSource(raw) {
    const label = clean(raw?.label).slice(0, LABEL_MAX);
    const location = clean(raw?.location).slice(0, LOCATION_MAX);
    if (!label && !location) return null;
    return { label, location };
}

export function normalizeBriefingSources(list) {
    return (Array.isArray(list) ? list : [])
        .map(normalizeBriefingSource)
        .filter(Boolean)
        .slice(0, BRIEFING_SOURCES_LIMIT);
}

export function loadBriefingSources(provided) {
    try {
        return normalizeBriefingSources(JSON.parse(store(provided)?.getItem(KEY) || '[]'));
    } catch {
        return [];
    }
}

/**
 * Alles vergessen. Gehört zum bewussten „Daten löschen": Der Eintrag nennt
 * einen internen Ablageort – oft mit Bezirks- oder Projektnamen – und darf
 * einen geleerten Browser nicht überleben. Jedes andere Modul räumt an dieser
 * Stelle auf; dieses fehlte.
 */
export function clearBriefingSources(provided) {
    try { store(provided)?.removeItem(KEY); } catch { /* Speicherung ist optional */ }
}

export function saveBriefingSources(list, provided) {
    const normalized = normalizeBriefingSources(list);
    try {
        if (normalized.length) store(provided)?.setItem(KEY, JSON.stringify(normalized));
        else store(provided)?.removeItem(KEY);
    } catch { /* Speicherung ist optional */ }
    return normalized;
}

/**
 * Der Prompt-Baustein. Leer, wenn nichts hinterlegt ist – dann bleibt der
 * Prompt exakt der bisherige.
 *
 * Die Formulierung ist bewusst eine **Priorisierung, kein Filter**: „sieh
 * zuerst hier nach" statt „nur hier". Wer die Bezirksliste hinterlegt, will
 * nicht, dass die Mail von gestern unter den Tisch fällt.
 *
 * Der zweite Absatz sagt nicht mehr nur WO, sondern WIE gelesen werden soll.
 * Anlass war ein Praxisfall: Die hinterlegte Ablage wurde gefunden und geöffnet,
 * der Assistent blieb aber auf dem Kontaktblatt hängen und lieferte zwei Namen
 * statt der Kundenzeile mit Umsatz, Vertragslage und Aktivitäten. „Nutze diese
 * Quelle zuerst" genügt eben nicht – eine Ablage hat mehrere Bereiche, und der
 * vertrieblich brauchbare steht selten vorn. Deshalb eine ausdrückliche
 * Rangfolge (Kennzahlen vor Kontakten), die Aufforderung, die ganze Quelle
 * durchzusehen, und die Pflicht zu melden, wenn nur Kontaktdaten übrig bleiben.
 */
export function briefingSourcesPromptBlock(sources = []) {
    const list = normalizeBriefingSources(sources);
    if (list.length === 0) return '';

    const lines = list.map((source) => {
        const name = source.label || 'Eigene Ablage';
        return source.location ? `- ${name}: ${source.location}` : `- ${name}`;
    });

    return `Vorrangige Quellen – sieh zuerst hier nach:
${lines.join('\n')}
Diese Ablagen pflege ich selbst; sie sind für mich der aktuellste Stand. Steht dort etwas zu einem der genannten Kunden, hat es Vorrang vor älteren Fundstellen – ordne die Einträge über die Kundennummer zu; fehlt sie, über Kundenname, Ort und Ansprechpartner gemeinsam.
Enthält eine Ablage strukturierte Vertriebsdaten (Kundenliste, CRM- oder BI-Auswertung, Tabelle, Report), lies sie ganz durch – alle Tabellenblätter, Abschnitte und Bereiche. Werte zuerst die Datensätze mit Umsatz-, Vertriebs-, Opportunity-, Aktivitäts-, Segment- oder Kennzahlenangaben aus und übernimm die tatsächlichen Werte des Kunden, nicht die Zusammenfassung der Datei. Kontaktlisten, Verteiler und Stammdaten sind nachrangig und dienen nur der Ergänzung. Findest du zu einem Kunden ausschließlich Kontaktdaten und keinen vertrieblichen Datensatz, sage das ausdrücklich in einem Halbsatz.
Wenn du etwas daraus verwendest, nenne die Quelle. Findest du eine der Ablagen nicht, sage das in einem Halbsatz und arbeite mit dem übrigen Fundmaterial weiter.
`;
}
