/**
 * Benannte Simulations-Szenarien (Roadmap 3.3).
 *
 * Die Was-wäre-wenn-Simulation im Gebiets-Cockpit arbeitet mit einem Overlay
 * aus drei Teilen: `overrides` (Kunden-ID -> neuer Zielwert), `pendingTerr`
 * (Gebietszuordnungen) und `opsLog` (was der Nutzer getan hat). Genau dieses
 * Tripel erzeugt `snapshotSimulation()` im Cockpit ohnehin – bis zu dreißigmal
 * je Sitzung für den Rückgängig-Stapel – und wirft es beim Schließen weg.
 *
 * Ein Szenario ist nichts anderes als dieser Schnappschuss **mit einem Namen**.
 * Deshalb ist „Variante Nord gegen Variante Süd" keine neue Mechanik, sondern
 * das Aufheben einer bereits vorhandenen.
 *
 * **Was gespeichert wird:** ausschließlich Zuordnungen – Kunden-IDs und
 * Zielwerte. Keine Namen, keine Adressen, keine Umsätze. Ein Szenario ist
 * damit kein zweites Register der Kundendaten und braucht den Tresor nicht.
 *
 * DOM-frei und ohne Speicherzugriff: Der Rechenweg gehört getestet, die
 * Ablage liegt in services/storage.js, die Bedienung im Cockpit.
 */

/** Mehr braucht niemand nebeneinander im Kopf – und die Liste bleibt lesbar. */
export const MAX_SCENARIOS = 12;

const text = (value) => String(value ?? '').trim();

function slug(value) {
    return text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Aus dem laufenden Simulations-Schnappschuss ein speicherbares Szenario.
 *
 * @param {string} name         vom Nutzer vergeben
 * @param {object} snapshot     { overrides: Map, pendingTerr: Map, opsLog: [] }
 * @param {object} context      { assignAttr, level, fileName, importedAt }
 */
export function scenarioFromSnapshot(name, snapshot, context = {}) {
    const label = text(name);
    if (!label) throw new Error('Ein Szenario braucht einen Namen.');
    const overrides = [...(snapshot?.overrides ?? new Map())];
    // Tief kopieren, nicht nur die Map ausrollen: `pendingTerr` enthält Objekte
    // mit `customerIds`, und die laufende Simulation schreibt weiter hinein.
    // Ohne diese Kopie verfolgte ein gespeichertes Szenario stillschweigend
    // jede spätere Zuweisung mit – es wäre kein Schnappschuss, sondern ein
    // zweiter Zeiger auf denselben Zustand.
    const pendingTerr = [...(snapshot?.pendingTerr ?? new Map())]
        .map(([id, info]) => [id, { ...info, customerIds: [...(info?.customerIds || [])] }]);
    if (overrides.length === 0 && pendingTerr.length === 0) {
        throw new Error('Ohne Zuweisungen gibt es nichts zu speichern.');
    }
    return {
        version: 1,
        id: `${slug(label) || 'szenario'}-${Date.now().toString(36)}`,
        name: label,
        savedAt: new Date().toISOString(),
        assignAttr: text(context.assignAttr) || 'bezirk',
        level: text(context.level) || 'kreise',
        // Woher die Zahlen stammen – für die Warnung beim Laden gegen einen
        // anderen Datenbestand.
        fileName: text(context.fileName),
        importedAt: text(context.importedAt),
        overrides,
        pendingTerr,
        opsLog: Array.isArray(snapshot?.opsLog)
            ? snapshot.opsLog.map((op) => ({ ...op, territoryIds: [...(op.territoryIds || [])] }))
            : []
    };
}

/** Zurück in die Form, die das Cockpit zum Weiterarbeiten braucht. */
export function snapshotFromScenario(scenario) {
    return {
        overrides: new Map(Array.isArray(scenario?.overrides) ? scenario.overrides : []),
        pendingTerr: new Map((Array.isArray(scenario?.pendingTerr) ? scenario.pendingTerr : [])
            .map(([id, info]) => [id, { ...info, customerIds: [...(info?.customerIds || [])] }])),
        opsLog: Array.isArray(scenario?.opsLog)
            ? scenario.opsLog.map((op) => ({ ...op, territoryIds: [...(op.territoryIds || [])] }))
            : []
    };
}

/**
 * Speichern oder ersetzen. Gleicher Name = derselbe Platz: Wer zweimal
 * „Variante Nord" speichert, will die neue Fassung, nicht zwei Einträge.
 *
 * @returns {{ scenarios: Array, replaced: boolean, dropped: object|null }}
 */
export function upsertScenario(list, scenario) {
    const existing = Array.isArray(list) ? list : [];
    const sameName = existing.findIndex(
        (item) => text(item?.name).toLowerCase() === text(scenario?.name).toLowerCase()
    );
    const kept = sameName >= 0
        ? existing.map((item, index) => (index === sameName ? scenario : item))
        : [scenario, ...existing];

    // Das älteste weicht, nie das gerade gespeicherte.
    let dropped = null;
    let scenarios = kept;
    if (kept.length > MAX_SCENARIOS) {
        const oldest = [...kept].sort((a, b) => text(a.savedAt).localeCompare(text(b.savedAt)))[0];
        dropped = oldest;
        scenarios = kept.filter((item) => item !== oldest);
    }
    return { scenarios, replaced: sameName >= 0, dropped };
}

export function removeScenario(list, id) {
    return (Array.isArray(list) ? list : []).filter((item) => item?.id !== id);
}

/**
 * Passt das Szenario noch zum geladenen Bestand?
 *
 * Ein Szenario überlebt einen Reimport – die Kunden-IDs aber nicht unbedingt.
 * Statt es dann stillschweigend halb anzuwenden, wird gezählt und gesagt, was
 * fehlt. Ein Szenario, das gegen andere Daten gespeichert wurde, ist keine
 * Fehlbedienung, sondern der Normalfall nach dem Monatsimport.
 *
 * @param {object} scenario
 * @param {Set<string>|Map<string,*>} knownCustomerIds
 */
export function scenarioFit(scenario, knownCustomerIds) {
    const has = (id) => (knownCustomerIds instanceof Map
        ? knownCustomerIds.has(id)
        : Boolean(knownCustomerIds?.has?.(id)));
    const overrides = Array.isArray(scenario?.overrides) ? scenario.overrides : [];
    const missing = overrides.filter(([id]) => !has(id)).length;
    return {
        total: overrides.length,
        missing,
        applicable: overrides.length - missing,
        complete: missing === 0
    };
}

/** Eine Zeile für die Liste: „12 Kunden · 3 Gebiete · Bezirk". */
export function scenarioSummary(scenario, attrLabel = (value) => value) {
    const customers = Array.isArray(scenario?.overrides) ? scenario.overrides.length : 0;
    const regions = Array.isArray(scenario?.pendingTerr) ? scenario.pendingTerr.length : 0;
    const parts = [
        `${customers} ${customers === 1 ? 'Kunde' : 'Kunden'}`,
        `${regions} ${regions === 1 ? 'Gebiet' : 'Gebiete'}`
    ];
    const label = text(attrLabel(scenario?.assignAttr));
    if (label) parts.push(label);
    return parts.join(' · ');
}

/**
 * Zwei Szenarien nebeneinander – der eigentliche Zweck der Sache.
 * Vergleicht, welche Kunden beide bewegen und wo sie sich widersprechen.
 *
 * @returns {{ onlyA: number, onlyB: number, same: number, conflicting: string[] }}
 */
export function compareScenarios(a, b) {
    const mapA = new Map(Array.isArray(a?.overrides) ? a.overrides : []);
    const mapB = new Map(Array.isArray(b?.overrides) ? b.overrides : []);
    const conflicting = [];
    let same = 0;
    for (const [id, value] of mapA) {
        if (!mapB.has(id)) continue;
        if (mapB.get(id) === value) same++;
        else conflicting.push(id);
    }
    return {
        onlyA: [...mapA.keys()].filter((id) => !mapB.has(id)).length,
        onlyB: [...mapB.keys()].filter((id) => !mapA.has(id)).length,
        same,
        conflicting
    };
}
