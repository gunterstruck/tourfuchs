/**
 * Wie heißt die eingelesene Betragsspalte? (PO 23.10.2026)
 *
 * TourFuchs liest je Kunde genau einen Betrag ein (Feld `umsatz`) und nutzt
 * ihn für Kachel, Filter, Cockpit, Gebietsplanung und Briefings. In den
 * Vertriebslisten unserer Außendienstler ist das aber der Auftragseingang
 * („AE GJ25"), nicht der Umsatz – und ein KI-Briefing, das „Umsatz" liest,
 * zieht falsche Schlüsse. Darum richtet sich die Bezeichnung nach der Spalte:
 * Heißt sie „AE …", „Auftragseingang …" oder „Orders …", steht überall
 * „Auftragseingang" (kurz „AE"), sonst bleibt es beim „Umsatz".
 *
 * Gemerkt wird das am Kunden (`umsatzArt: 'ae'`, nur dann gesetzt). So reist
 * es mit Speicher, Tresor, Umzugsdatei und Reimport, ohne eigenes Feld im
 * Datensatz. Rechnen ändert sich nicht, nur die Wörter.
 * Reine Logik, ohne DOM.
 */

const AE_HEADER = /(^|[^a-zäöüß])(ae|auftragseingang|auftragseingänge|auftragseingaenge|orders?|order intake)([^a-zäöüß]|$)/;

/** „AE GJ25" → 'ae' · „Umsatz 2025" → 'umsatz' */
export function revenueKindOfHeader(header) {
    return AE_HEADER.test(String(header ?? '').toLowerCase()) ? 'ae' : 'umsatz';
}

/** Bezeichnung eines Bestands: Auftragseingang, sobald ein Kunde ihn trägt. */
export function revenueKindOf(customers = []) {
    return (customers || []).some((customer) => customer?.umsatzArt === 'ae') ? 'ae' : 'umsatz';
}

const TERMS = {
    umsatz: {
        name: 'Umsatz',
        short: 'Umsatz',
        sum: 'Umsatzsumme',
        total: 'Gesamtumsatz',
        column: 'Umsatzspalte',
        value: 'Umsatzwert',
        data: 'Umsatzangabe',
        dataPlural: 'Umsatzangaben',
        years: 'Umsatzjahre',
        range: 'Umsatzintervall',
        trend: 'Umsatzentwicklung',
        perYear: 'Umsatz nach Geschäftsjahr',
        exportHeader: 'Umsatz'
    },
    ae: {
        name: 'Auftragseingang',
        short: 'AE',
        sum: 'AE-Summe',
        total: 'Gesamt-Auftragseingang',
        column: 'AE-Spalte',
        value: 'AE-Wert',
        data: 'AE-Angabe',
        dataPlural: 'AE-Angaben',
        years: 'AE-Jahre',
        range: 'AE-Intervall',
        trend: 'Entwicklung des Auftragseingangs',
        perYear: 'Auftragseingang nach Geschäftsjahr',
        exportHeader: 'Auftragseingang'
    }
};

/** Wörter für einen Bestand – `kind` aus `state.revenueKind`. */
export function revenueTerm(kind) {
    return TERMS[kind] || TERMS.umsatz;
}
