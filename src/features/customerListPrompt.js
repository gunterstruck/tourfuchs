/**
 * Kundenliste von der Firmen-KI – der Prompt.
 *
 * Viele Vertriebsleute haben keinen fertigen Export zur Hand, aber Zugriff auf
 * die KI ihres Unternehmens (z. B. Microsoft 365 Copilot), die CRM-Exporte,
 * Excel-Listen und Mails lesen darf. Dieser Prompt bittet sie, daraus eine
 * Tabelle zu bauen, deren Überschriften TourFuchs ohne Nacharbeit erkennt.
 *
 * TourFuchs ruft dabei keine KI auf: Der Prompt wird nur kopiert, der
 * Assistent im neuen Tab geöffnet. Das Ergebnis kommt wie jede andere Liste
 * über „Einfügen" oder „Datei auswählen" herein – mit Spalten-Prüfung.
 */

/** Spaltenüberschriften in der gewünschten Reihenfolge – je ein exakter Treffer in excel.js. */
export const CUSTOMER_LIST_COLUMNS = Object.freeze([
    { header: 'Kundennummer', hint: 'Debitoren- oder Kundennummer' },
    { header: 'Kundenname', hint: 'Firmenname, Pflicht' },
    { header: 'Straße', hint: 'Straße und Hausnummer' },
    { header: 'PLZ', hint: 'fünfstellig, Pflicht' },
    { header: 'Ort', hint: '' },
    { header: 'Vertriebsbeauftragter', hint: 'zuständige Person' },
    { header: 'Vertriebsbezirk', hint: 'Bezirk oder Gebiet laut Vertriebsorganisation' },
    { header: 'Hauptansprechpartner', hint: 'Name der wichtigsten Kontaktperson' },
    { header: 'Telefon', hint: '' },
    { header: 'E-Mail', hint: '' },
    { header: 'Umsatz', hint: 'letzter Jahresumsatz in Euro, nur die Zahl' },
    { header: 'Besuchsrhythmus', hint: 'geplanter Abstand der Besuche in Wochen, nur die Zahl' },
    { header: 'Letzter Besuch', hint: 'Datum als TT.MM.JJJJ' }
]);

/**
 * @param {object} [options]
 * @param {string} [options.scope]  wessen Kunden – Standard: die eigenen
 * @returns {string}
 */
export function buildCustomerListPrompt({ scope = 'die mir als Vertriebsmitarbeiter zugeordnet sind' } = {}) {
    const columns = CUSTOMER_LIST_COLUMNS
        .map(({ header, hint }) => `- ${header}${hint ? ` (${hint})` : ''}`)
        .join('\n');
    return `Erstelle mir bitte eine Kundenliste aller Kunden, ${scope}.

Nutze dafür nur echte Daten aus den Unternehmensquellen, auf die du Zugriff hast (z. B. CRM-Exporte, Excel-Listen, Berichte, E-Mails).

Verwende genau diese Spaltenüberschriften in dieser Reihenfolge:
${columns}

Regeln:
- Erfinde nichts. Ist ein Wert nicht bekannt, lass die Zelle leer.
- Eine Zeile pro Kunde (Kundenstandort), keine Zwischensummen, keine zusammengeführten Zellen.
- Die erste Zeile enthält nur die Spaltenüberschriften.
- Am liebsten als Excel-Datei (.xlsx) zum Herunterladen. Geht das nicht, gib die Liste als eine einzige, durchgehende Tabelle aus – nicht in Abschnitte aufteilen.
- Nenne unter der Tabelle kurz, aus welchen Quellen die Daten stammen.
- Hast du keinen Zugriff auf passende Kundendaten, sag das ehrlich und nenne mir, wo ein solcher Export bei uns wahrscheinlich zu finden ist (System, Bericht oder Ansprechpartner).

Die Liste nutze ich lokal in meinem Tourenplaner TourFuchs.`;
}
