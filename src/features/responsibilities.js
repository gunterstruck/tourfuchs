/**
 * „Zuständig": wer intern zu einem Kunden gehört.
 *
 * Die Zuständigkeitsliste aus dem Vertrieb bringt Rollenspalten mit (OM,
 * TSP TC, VK, RTC, TAM, Account Manager, EB-Berater). Ihre Zellen enthalten
 * einen Namen oder eine Abteilung, oft mit Telefonnummer – „Vera Kunz
 * 0171 2223344". Die Kundenkachel zeigt daraus je Rolle eine Zeile mit
 * antippbarer Nummer, dazu Account und Abzeichen (PI-Partner, Named Account).
 *
 * Wer im Außendienst steht, will wissen, wen er anrufen kann – das ist keine
 * Kontrolle von Mitarbeitenden (docs/positionierung.md), nur das Telefonbuch
 * am richtigen Ort. Reine Logik, ohne DOM.
 */

const norm = (header) => String(header ?? '').toLowerCase().replace(/[._\-/]/g, ' ').replace(/\s+/g, ' ').trim();
const text = (value) => String(value ?? '').trim();

/** Rollenspalten in Anzeige-Reihenfolge; erkannt an der normalisierten Überschrift. */
export const ROLE_COLUMNS = [
    { label: 'VK', headers: ['vk', 'verkauf', 'verkäufer', 'verkaeufer'] },
    { label: 'OM', headers: ['om'] },
    { label: 'TSP TC', headers: ['tsp tc', 'tsp', 'tc'] },
    { label: 'RTC', headers: ['rtc'] },
    { label: 'TAM', headers: ['tam'] },
    { label: 'Account Manager', headers: ['account manager', 'key account manager', 'kam'] },
    { label: 'EB-Berater', headers: ['eb berater'] },
    { label: 'Innendienst', headers: ['innendienst', 'id'] }
];

const ACCOUNT_NAME = ['account name'];
const ACCOUNT_CLUSTER = ['account cluster'];
/** Abzeichen: gefüllte Zelle = Abzeichen. Ein bloßes „ja/x/1" zeigt den Spaltennamen. */
const BADGE_COLUMNS = [
    { label: 'PI-Partner', headers: ['pa kundenanfrage'] },
    { label: 'Named Account', headers: ['named account'] }
];
const YES = new Set(['ja', 'j', 'x', '1', 'yes', 'y', 'true', 'wahr']);

function findHeader(extra, candidates) {
    return Object.keys(extra || {}).find((header) => candidates.includes(norm(header)));
}

// Telefonnummer: beginnt mit + oder 0, mindestens 6 Ziffern, darf Leerzeichen,
// Schrägstrich, Bindestrich und Klammern enthalten.
const PHONE = /(\+|\b0)[\d\s/()-]{4,}\d/;

/**
 * „Vera Kunz 0171 2223344" → { name: 'Vera Kunz', phone: '0171 2223344', tel: '01712223344' }.
 * Ohne Nummer bleibt der ganze Text der Name.
 */
export function splitContactText(value) {
    const raw = text(value);
    const match = raw.match(PHONE);
    const digits = match ? match[0].replace(/[^\d+]/g, '') : '';
    if (!match || digits.replace('+', '').length < 6) return { name: raw, phone: '', tel: '' };
    const name = (raw.slice(0, match.index) + ' ' + raw.slice(match.index + match[0].length))
        .replace(/\s*(tel\.?|telefon|fon|mobil|☎)\s*:?\s*$/i, '')
        .replace(/[\s,;:–-]+$/, '')
        .replace(/^[\s,;:–-]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
    return { name, phone: match[0].trim(), tel: digits };
}

/**
 * Alles, was die Kachel unter „Zuständig" zeigt.
 * @returns {{ roles: {label:string,name:string,phone:string,tel:string}[], account: string, badges: string[] }}
 */
export function customerResponsibilities(customer) {
    const extra = customer?.extra || {};
    const roles = [];
    for (const role of ROLE_COLUMNS) {
        const header = findHeader(extra, role.headers);
        const value = header ? text(extra[header]) : '';
        if (value) roles.push({ label: role.label, ...splitContactText(value) });
    }
    const accountName = text(extra[findHeader(extra, ACCOUNT_NAME)]);
    const cluster = text(extra[findHeader(extra, ACCOUNT_CLUSTER)]);
    // Der Account-Name lohnt nur, wenn er nicht einfach der Kundenname ist.
    const showName = accountName && norm(accountName) !== norm(customer?.name);
    const account = [showName ? accountName : '', cluster].filter(Boolean).join(' · ');
    const badges = [];
    for (const badge of BADGE_COLUMNS) {
        const header = findHeader(extra, badge.headers);
        const value = header ? text(extra[header]) : '';
        if (!value) continue;
        badges.push(YES.has(value.toLowerCase()) ? badge.label : value);
    }
    return { roles, account, badges };
}

/** Überschriften, die „Zuständig" selbst zeigt – für Stellen, die Zusatzspalten generisch listen. */
export function isResponsibilityHeader(header) {
    const key = norm(header);
    return [...ROLE_COLUMNS, ...BADGE_COLUMNS].some((entry) => entry.headers.includes(key))
        || ACCOUNT_NAME.includes(key) || ACCOUNT_CLUSTER.includes(key);
}

/**
 * Zeilen fürs KI-Briefing: Rollen nur mit Namen (keine Telefonnummern – die
 * braucht der Assistent nicht), Account und Abzeichen als Suchhilfe.
 */
export function responsibilityBriefingLines(customer) {
    const { roles, account, badges } = customerResponsibilities(customer);
    const lines = [];
    if (account) lines.push(`- Account: ${account}`);
    if (badges.length) lines.push(`- Kennzeichen: ${badges.join(', ')}`);
    const named = roles.filter((role) => role.name).map((role) => `${role.label} ${role.name}`);
    if (named.length) lines.push(`- Internes Kundenteam: ${named.join('; ')}`);
    return lines;
}
