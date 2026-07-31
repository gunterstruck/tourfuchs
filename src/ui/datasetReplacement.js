import { state } from '../core/state.js';
import { isDemoDataset } from '../core/demoSafety.js';

/**
 * Ist der aktuelle Bestand reine Beispiel-Kulisse?
 *
 * Dann gibt es nichts zu schützen. Der Schutz vor versehentlichem Überschreiben
 * ist richtig – aber gegen Beispieldaten läuft er ins Leere und richtet Schaden
 * an: Der Änderungsbericht meldete beim ersten eigenen Import
 * „3 neu · 2250 entfallen · Umsatz 315.318 T€ → 0 € (−315.318 T€)". Eine
 * Verlustmeldung über eine Kulisse, die nie echt war – und das ausgerechnet in
 * dem Moment, in dem der Nutzer zum ersten Mal seine eigenen Kunden sehen will.
 *
 * Was der Nutzer **selbst** angelegt hat, zählt dagegen: eigene
 * Gebietszuordnungen und eigene Vertrags-/Einsatzquellen machen den Bestand
 * schützenswert, auch wenn die Kunden noch Beispielkunden sind.
 */
export function onlyDemoDataPresent() {
    if (!isDemoDataset(state.customers)) return false;
    if (Object.keys(state.territories || {}).length > 0) return false;
    const eigene = (rows) => (rows || []).some((row) => row && row.sourceSystem !== 'DEMO');
    return !eigene(state.serviceContracts) && !eigene(state.serviceVisits);
}

export function hasExistingDataset() {
    return state.customers.length > 0
        || Object.keys(state.territories || {}).length > 0
        || state.serviceContracts.length > 0
        || state.serviceVisits.length > 0;
}

export function datasetReplacementMessage({
    incomingCount = 0,
    sourceLabel = 'Die neue Kundenliste',
    disablesVault = false,
    replacesContracts = false,
    replacesVisits = false
} = {}) {
    const existing = [];
    if (state.customers.length) {
        existing.push(state.customers.length === 1
            ? '1 bisherigen Kunden'
            : `${state.customers.length} bisherige Kunden`);
    }
    const territoryCount = Object.keys(state.territories || {}).length;
    if (territoryCount) {
        existing.push(territoryCount === 1
            ? '1 Gebietszuordnung'
            : `${territoryCount} Gebietszuordnungen`);
    }
    const contractCount = state.serviceContracts.length;
    if (replacesContracts && contractCount) {
        existing.push(contractCount === 1
            ? '1 Servicevertrag'
            : `${contractCount} Serviceverträge`);
    }
    const visitCount = state.serviceVisits.length;
    if (replacesVisits && visitCount) {
        existing.push(visitCount === 1
            ? '1 Serviceeinsatz'
            : `${visitCount} Serviceeinsätze`);
    }

    const incoming = incomingCount > 0 ? ` mit ${incomingCount} Kunden` : '';
    const replacement = existing.length
        ? `${sourceLabel}${incoming} ersetzt vollständig ${existing.join(' und ')}.`
        : `${sourceLabel}${incoming} wird als neuer vollständiger Datenbestand geladen.`;
    const vault = disablesVault
        ? '\n\nDer Datentresor wird dabei deaktiviert und die bisherige PIN entfernt.'
        : '';
    const contracts = !replacesContracts && contractCount
        ? '\n\nDie separat importierten Serviceverträge bleiben erhalten und werden anschließend über die Kundennummer neu zugeordnet.'
        : '';
    const visits = !replacesVisits && visitCount
        ? '\n\nDie separat importierten Serviceeinsätze bleiben erhalten und werden anschließend über die Kundennummer neu zugeordnet.'
        : '';

    return `${replacement}\n\nDie bisherige Tour sowie nicht in der neuen Datei enthaltene Besuchs- und Gebietsdaten werden entfernt. Alte Daten lassen sich danach nur aus einem vorherigen Export wiederherstellen.${contracts}${visits}${vault}\n\nFortfahren?`;
}

export function confirmDatasetReplacement(options = {}) {
    if (!hasExistingDataset() && !options.disablesVault) return true;
    // Eine Kulisse zu ersetzen ist kein Vorgang, der eine Rückfrage verdient.
    // Ein noch aktiver Tresor schon – der wird dabei deaktiviert.
    if (onlyDemoDataPresent() && !options.disablesVault) return true;
    return globalThis.confirm(datasetReplacementMessage(options));
}
