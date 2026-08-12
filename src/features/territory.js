/**
 * Gebiets-Aggregation
 * Ordnet Kunden den Gebieten der aktiven Ebene zu und berechnet je Gebiet
 * die Verteilung auf Vertriebsbeauftragte (für Einfärbung & Popups).
 *
 * PLZ-Ebenen: Zuordnung über PLZ-Präfix (schnell, exakt zur Kunden-PLZ).
 * Landkreise: Punkt-in-Polygon über die Kundenkoordinaten.
 */

import { UNASSIGNED } from '../core/state.js';
import { pointInFeature, regionKey, regionName } from '../services/geodata.js';

/**
 * @param {string} level  aktive Ebene ('kreise' | 'plz1' | ...)
 * @param {object} geojson  Gebiets-GeoJSON der Ebene
 * @param {Array} customers  sichtbare Kunden
 * @returns {Map<regionKey, { total, byRep: Map<vb, count>, customers: [] }>}
 */
export function aggregateByRegion(level, geojson, customers) {
    const stats = new Map();
    const ensure = (key) => {
        if (!stats.has(key)) stats.set(key, { total: 0, byRep: new Map(), customers: [] });
        return stats.get(key);
    };

    if (level.startsWith('plz')) {
        const len = parseInt(level.slice(3), 10);
        const byPrefix = new Map();
        for (const feature of geojson.features) {
            byPrefix.set(String(feature.properties.plz), regionKey(level, feature));
        }
        for (const c of customers) {
            if (!c.plz) continue;
            const key = byPrefix.get(c.plz.slice(0, len));
            if (!key) continue;
            addCustomer(ensure(key), c);
        }
    } else if (level === 'kreise') {
        for (const c of customers) {
            if (c.lat === null || c.lng === null) continue;
            for (const feature of geojson.features) {
                if (pointInFeature(c.lng, c.lat, feature)) {
                    addCustomer(ensure(regionKey(level, feature)), c);
                    break;
                }
            }
        }
    }
    return stats;
}

function addCustomer(entry, customer) {
    entry.total++;
    entry.customers.push(customer);
    const vb = customer.vb || UNASSIGNED;
    entry.byRep.set(vb, (entry.byRep.get(vb) ?? 0) + 1);
}

/** Dominanter Vertriebsbeauftragter eines Gebiets (meiste Kunden) */
export function dominantRep(entry) {
    let best = null;
    let bestCount = 0;
    for (const [vb, count] of entry.byRep) {
        if (count > bestCount) { best = vb; bestCount = count; }
    }
    return best;
}

/**
 * Fairness einer Verteilung: Wie weit liegen größte und kleinste Einheit
 * auseinander?
 *
 * Lag bis Version 3.3 inline in `renderFairness()` im Cockpit und war damit
 * nur über das DOM prüfbar. Die Entscheidungsvorlage (Roadmap 3.1) braucht
 * denselben Rechenweg ein zweites Mal – für den Zustand **vor** der Simulation.
 * Zwei Kopien derselben Kennzahl wären genau der Fehler, den Item 6.2 für die
 * Schwelle 1,5 schon einmal behoben hat: Beide stimmen für sich, bis eine
 * geändert wird.
 *
 * `maxRatio` wird bewusst **übergeben** und nicht importiert. Die Norm steht in
 * `CONFIG.territory.balancedMaxRatio`; ein Aggregationsmodul, das sich seine
 * eigene Grenze holt, wäre die zweite Quelle.
 *
 * @param {Map<string, {count:number, umsatz:number}>} stats
 * @param {Iterable<string>} keys      zu berücksichtigende Einheiten
 * @param {{ maxRatio:number, exclude?:string }} options
 * @returns {null|{units, ratio, balanced, count:{min,max}, revenue:{min,max}|null}}
 *          `null`, wenn weniger als zwei Einheiten Kunden haben – ein Faktor
 *          über einer einzigen Einheit ist keine Aussage, sondern eine 1.
 */
export function fairness(stats, keys, { maxRatio, exclude = null } = {}) {
    const units = [...keys]
        .filter((key) => key !== exclude)
        .map((key) => ({
            key,
            count: stats.get(key)?.count ?? 0,
            umsatz: stats.get(key)?.umsatz ?? 0
        }))
        .filter((unit) => unit.count > 0);
    if (units.length < 2) return null;

    const byCount = [...units].sort((a, b) => a.count - b.count);
    const min = byCount[0];
    const max = byCount[byCount.length - 1];
    const ratio = max.count / Math.max(1, min.count);

    // Umsatz nur, wenn ihn mindestens zwei Einheiten führen: Sonst vergleicht
    // die Karte einen echten Betrag gegen eine fehlende Angabe und nennt das
    // Ergebnis „schwächster Bezirk".
    const withRevenue = units.filter((unit) => unit.umsatz > 0);
    let revenue = null;
    if (withRevenue.length >= 2) {
        const byRevenue = [...withRevenue].sort((a, b) => a.umsatz - b.umsatz);
        revenue = { min: byRevenue[0], max: byRevenue[byRevenue.length - 1] };
    }

    return { units: units.length, ratio, balanced: ratio <= maxRatio, count: { min, max }, revenue };
}

/**
 * Zuordnung Gebiet -> Kunden-IDs (für das Gebiets-Cockpit / What-if).
 * Nur Gebiete mit mindestens einem Kunden werden zurückgegeben.
 * @returns {Array<{ key, name, customerIds: string[] }>} nach Kundenzahl sortiert
 */
export function regionMembership(level, geojson, customers) {
    const stats = aggregateByRegion(level, geojson, customers);
    const nameByKey = new Map();
    for (const feature of geojson.features) {
        nameByKey.set(regionKey(level, feature), regionName(level, feature));
    }
    return [...stats.entries()]
        .map(([key, entry]) => ({
            key,
            name: nameByKey.get(key) ?? key,
            customerIds: entry.customers.map((c) => c.id)
        }))
        .sort((a, b) => b.customerIds.length - a.customerIds.length);
}
