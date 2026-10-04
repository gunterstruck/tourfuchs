/**
 * Gespeicherte Touren gegen Umsortieren und Neuimport absichern.
 *
 * Eine gespeicherte Tour merkt sich Kunden-IDs. Früher hingen diese IDs an der
 * Excel-Zeile – nach einem Reimport mit anderer Sortierung zeigte dieselbe ID
 * still auf einen anderen Kunden. Deshalb trägt jede Tour zusätzlich den
 * fachlichen Schlüssel jedes Stopps (Kundennummer, sonst Name + PLZ). Beim Laden
 * zählt der Schlüssel: Passt er zur ID, bleibt alles; passt er nicht, wird über
 * den Schlüssel neu zugeordnet; gibt es ihn nicht mehr, fällt der Stopp weg –
 * mit Hinweis statt falschem Kunden.
 */

/** Fachlicher Schlüssel – dieselbe Regel wie die Dublettenprüfung beim Import. */
export function customerKey(customer) {
    if (!customer) return null;
    const nummer = String(customer.nummer ?? '').trim();
    if (nummer) return `nr:${nummer}`;
    const name = String(customer.name ?? '').trim().toLowerCase();
    const plz = String(customer.plz ?? '').trim();
    return name || plz ? `np:${name}|${plz}` : null;
}

const pointKey = (point, getCustomer) => (point?.customerId ? customerKey(getCustomer(point.customerId)) : null);

/**
 * Schlüssel ergänzen, wo sie fehlen (neu gespeicherte Touren und einmalig
 * Bestandstouren aus der Zeit vor den Schlüsseln). Vorhandene Schlüssel bleiben
 * unangetastet – sie beschreiben den Kunden zum Zeitpunkt des Speicherns.
 * @returns {{ tour: object, changed: boolean }}
 */
export function stampTourKeys(tour, getCustomer) {
    let changed = false;
    const stopKeys = (tour.stopIds || []).map((id, i) => {
        const known = tour.stopKeys?.[i];
        if (known) return known;
        const key = customerKey(getCustomer(id));
        if (key) changed = true;
        return key;
    });
    const point = (p) => {
        if (!p?.customerId || p.customerKey) return p;
        const key = pointKey(p, getCustomer);
        if (!key) return p;
        changed = true;
        return { ...p, customerKey: key };
    };
    const next = { ...tour, stopKeys, start: point(tour.start), destination: point(tour.destination) };
    if (!Array.isArray(tour.stopKeys) || tour.stopKeys.length !== stopKeys.length) changed = true;
    return { tour: next, changed };
}

/**
 * Tour gegen den aktuellen Bestand auflösen.
 * @returns {{ stopIds: string[], lost: number, remapped: number, start: object, destination: object|null }}
 */
export function resolveTour(tour, customers) {
    const byId = new Map();
    const byKey = new Map();
    for (const c of customers || []) {
        byId.set(c.id, c);
        const key = customerKey(c);
        if (key && !byKey.has(key)) byKey.set(key, c);
    }
    let lost = 0;
    let remapped = 0;
    const resolve = (id, key) => {
        const current = byId.get(id);
        if (!key) return current ? id : null;          // Alttour ohne Schlüssel: wie bisher
        if (current && customerKey(current) === key) return id;
        return byKey.get(key)?.id ?? null;
    };
    const stopIds = [];
    (tour.stopIds || []).forEach((id, i) => {
        const resolved = resolve(id, tour.stopKeys?.[i]);
        if (!resolved) lost += 1;
        else {
            if (resolved !== id) remapped += 1;
            stopIds.push(resolved);
        }
    });
    // Start/Ziel tragen ihre Koordinaten vom Speichern selbst – nur die
    // Verknüpfung zum Kunden muss stimmen. Ohne passenden Kunden bleibt der
    // Start als reiner Ort; das Ziel entfällt wie bisher.
    const point = (p, keepUnlinked) => {
        if (!p) return null;
        if (!p.customerId) return { ...p };
        const resolved = resolve(p.customerId, p.customerKey);
        if (resolved) return { ...p, customerId: resolved };
        if (!keepUnlinked) return null;
        const { customerId: _id, customerKey: _key, ...place } = p;
        return place;
    };
    return {
        stopIds: [...new Set(stopIds)], lost, remapped,
        start: point(tour.start, true), destination: point(tour.destination, false)
    };
}
