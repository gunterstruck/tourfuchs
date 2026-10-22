/** Local, filter-independent postcode lookup. Customer distribution is not an assignment rule. */
import { splitContactText } from './responsibilities.js';
import { isDemoCustomer } from '../core/demoSafety.js';

const text = (value) => String(value ?? '').trim();
const norm = (value) => text(value).toLocaleLowerCase('de-DE').replace(/[_.-]/g, ' ').replace(/\s+/g, ' ');
const cell = (extra, names) => text(Object.entries(extra || {}).find(([key]) => names.includes(norm(key)))?.[1]);
export const isPostalQuery = (value) => /^\d{3,5}$/.test(text(value));
export const postalLabel = (value) => text(value).padEnd(5, 'x');

/** Only explicitly manager-owned contact columns; never use the customer's phone/email. */
export function accountManager(customer) {
    const extra = customer.extra || {};
    const explicit = cell(extra, ['account manager', 'accountmanager', 'key account manager', 'kam']);
    const raw = explicit || text(customer.vb);
    const embedded = raw.match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
    const contact = splitContactText(raw.replace(embedded, '').replace(/[<>]/g, ''));
    const phone = cell(extra, explicit
        ? ['account manager telefon', 'account manager phone', 'account manager tel', 'am telefon']
        : ['vb telefon', 'vertriebsbeauftragter telefon']);
    const tel = phone.replace(/[^\d+]/g, '');
    const upn = cell(extra, explicit
        ? ['account manager upn', 'account manager e mail', 'account manager email', 'am email']
        : ['vb upn', 'vb e mail', 'vb email', 'vertriebsbeauftragter email']) || embedded;
    return { name: contact.name.replace(/^[\s,;]+|[\s,;]+$/g, ''),
        phone: tel.replace(/\D/g, '').length >= 6 ? phone : contact.phone,
        tel: tel.replace(/\D/g, '').length >= 6 ? tel : contact.tel,
        upn: /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(upn) ? upn : '' };
}

export function teamsChatUrl(upn) {
    return /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(upn || '')
        ? `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(upn)}` : '';
}

const emptyStats = () => ({ count: 0, revenue: 0, missingRevenue: 0 });
function add(stats, customer) {
    stats.count++;
    if (customer.umsatz === null || customer.umsatz === undefined || text(customer.umsatz) === '' || !Number.isFinite(Number(customer.umsatz))) stats.missingRevenue++;
    else stats.revenue += Number(customer.umsatz);
}

const districtKey = (customer) => JSON.stringify([text(customer.bezirk), text(customer.gruppe)]);
/** Describe the district from the entire loaded stock, independent of PLZ and manager. */
function districtProfiles(customers) {
    const profiles = new Map();
    for (const customer of customers) {
        if (!text(customer.bezirk)) continue;
        const key = districtKey(customer);
        if (!profiles.has(key)) profiles.set(key, { count: 0, missing: 0, types: new Map() });
        const profile = profiles.get(key);
        profile.count++;
        // Older sales-workbook / .tfsafe imports may retain the type in extra.
        const name = text(customer.kundentyp) || cell(customer.extra, ['kundentyp', 'kunden typ', 'kundenart', 'kundentyp bezeichnung', 'customer type', 'account type']);
        if (!name) { profile.missing++; continue; }
        const typeKey = name.toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
        if (!profile.types.has(typeKey)) profile.types.set(typeKey, { name, count: 0 });
        profile.types.get(typeKey).count++;
    }
    for (const [key, profile] of profiles) {
        const highest = Math.max(0, ...[...profile.types.values()].map((t) => t.count));
        profiles.set(key, { count: profile.count, missing: profile.missing,
            top: [...profile.types.values()].filter((t) => t.count === highest).sort((a, b) => a.name.localeCompare(b.name, 'de')) });
    }
    return profiles;
}

export function postalResponsibility(customers = [], query = '', territories = {}) {
    const prefix = text(query);
    const result = { valid: isPostalQuery(prefix), prefix, ...emptyStats(), groups: [], assignments: [], years: [], unknownYear: false };
    if (!result.valid) return result;
    const groups = new Map();
    const seen = new Set();
    const years = new Set();
    const unique = [];
    for (const customer of customers) {
        // State normally deduplicates on import. Never count a repeated record twice.
        const identity = text(customer.id) || (text(customer.nummer) ? `nr:${text(customer.nummer)}` : customer);
        if (seen.has(identity)) continue;
        seen.add(identity);
        unique.push(customer);
    }
    const profiles = districtProfiles(unique);
    for (const customer of unique) {
        if (!/^\d{5}$/.test(text(customer.plz)) || !text(customer.plz).startsWith(prefix)) continue;
        add(result, customer);
        const dataYears = Object.keys(customer.umsatzJahre || {}).filter((year) => /^\d{4}$/.test(year));
        if (dataYears.length) years.add(Math.max(...dataYears.map(Number)));
        else result.unknownYear = true;
        const district = text(customer.bezirk);
        const salesGroup = text(customer.gruppe);
        const manager = accountManager(customer);
        // Do not silently coalesce conflicting contact records with the same display name.
        const key = JSON.stringify([district, salesGroup, norm(manager.name), manager.upn.toLowerCase(), manager.tel]);
        if (!groups.has(key)) groups.set(key, { district, salesGroup, manager, profile: profiles.get(districtKey(customer)) || null, demo: false, ...emptyStats() });
        groups.get(key).demo ||= isDemoCustomer(customer);
        add(groups.get(key), customer);
    }
    result.groups = [...groups.values()].sort((a, b) => a.district.localeCompare(b.district, 'de') || a.salesGroup.localeCompare(b.salesGroup, 'de') || a.manager.name.localeCompare(b.manager.name, 'de'));
    result.years = [...years].sort();
    // Display overlapping explicit PLZ assignments with their exact scope, not as a
    // fabricated single winner. County assignments cannot be resolved from a prefix.
    for (const [key, assignment] of Object.entries(territories)) {
        const match = key.match(/^plz([1-5]):plz-(\d+)$/);
        if (!match || match[2].length !== Number(match[1]) || !assignment.bezirk) continue;
        const scope = match[2];
        if (scope.startsWith(prefix) || prefix.startsWith(scope)) result.assignments.push({ prefix: scope, district: text(assignment.bezirk) });
    }
    result.assignments.sort((a, b) => a.prefix.localeCompare(b.prefix));
    return result;
}
