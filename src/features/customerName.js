/**
 * Manche Quellsysteme liefern ein bereits HTML-kodiertes Kaufmanns-Und.
 * Kundennamen sind Daten, kein HTML; die Ausgabe kodiert sie separat sicher.
 */
export function normalizeCustomerName(value) {
    let name = String(value ?? '');
    let previous;
    do {
        previous = name;
        name = name.replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
    } while (name !== previous);
    return name;
}

export function customerNamesNeedNormalization(customers) {
    return (customers || []).some((customer) =>
        typeof customer?.name === 'string' && customer.name !== normalizeCustomerName(customer.name));
}
