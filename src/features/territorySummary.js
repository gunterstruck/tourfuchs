const cleanText = (value) => String(value ?? '').trim();

function numericRevenue(customer) {
    if (customer?.umsatz === null || customer?.umsatz === undefined || customer?.umsatz === '') return null;
    const value = Number(customer.umsatz);
    return Number.isFinite(value) ? value : null;
}

/**
 * Verdichtet die Kunden hinter einer Gebietskachel für die große Detailkarte.
 * Fehlender Umsatz bleibt unbekannt und wird nicht als 0 Euro interpretiert.
 */
export function buildTerritorySummary(customers = [], { count, revenue, hasRevenue = false, regionCount = 0 } = {}) {
    const validCustomers = Array.isArray(customers) ? customers.filter(Boolean) : [];
    const revenues = validCustomers.map(numericRevenue).filter((value) => value !== null);
    const effectiveCount = Number.isFinite(Number(count)) ? Number(count) : validCustomers.length;
    const effectiveRevenue = hasRevenue
        ? (Number.isFinite(Number(revenue)) ? Number(revenue) : revenues.reduce((sum, value) => sum + value, 0))
        : null;

    const places = new Map();
    for (const customer of validCustomers) {
        const place = [cleanText(customer.plz), cleanText(customer.ort)].filter(Boolean).join(' ');
        if (!place) continue;
        places.set(place, (places.get(place) ?? 0) + 1);
    }

    const topPlaces = [...places.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
        .slice(0, 4)
        .map(([name, customerCount]) => ({ name, customerCount }));

    const distinctValues = (field) => [...new Set(validCustomers
        .map((customer) => cleanText(customer[field]))
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'de'));

    return {
        count: effectiveCount,
        revenue: effectiveRevenue,
        revenueKnownCount: revenues.length,
        averageRevenue: revenues.length > 0 ? revenues.reduce((sum, value) => sum + value, 0) / revenues.length : null,
        regionCount: Math.max(0, Number(regionCount) || 0),
        placeCount: places.size,
        topPlaces,
        groups: distinctValues('gruppe'),
        channels: distinctValues('channel')
    };
}
