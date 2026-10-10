/**
 * Kontakte eines Kunden, getrennt nach Art:
 *
 *   - Kundenansprechpartner: Name, Abteilung, Telefon, E-Mail
 *   - Promotoren: Name, Thema (was er promotet), Telefon, E-Mail
 *
 * Beide kommen aus einer Kontaktliste (eine Zeile je Kontakt, verknüpft über
 * die Kundennummer) oder aus dem Kundenstamm (Hauptansprechpartner). Die
 * Kundenkachel zeigt sie neben „Zuständig", der Filter kennt Promotor und
 * Thema, das KI-Briefing nennt Namen, Abteilung und Thema – ohne Telefon und
 * E-Mail. Reine Logik, ohne DOM.
 */

const text = (value) => String(value ?? '').trim();
const telOf = (phone) => text(phone).replace(/[^\d+]/g, '');

function contactView(contact) {
    return {
        name: text(contact.name),
        abteilung: text(contact.abteilung),
        funktion: text(contact.funktion),
        thema: text(contact.thema),
        phone: text(contact.telefon),
        tel: telOf(contact.telefon),
        mobile: text(contact.mobil),
        mobileTel: telOf(contact.mobil),
        email: text(contact.email),
        crm: text(contact.crm),
        primary: !!contact.primary,
        // Sperrvermerke aus dem CRM (Vertriebs-Arbeitsmappe): Die Kachel bietet
        // gesperrte Wege gar nicht erst an.
        doi: !!contact.doi,
        noCall: !!contact.nichtAnrufen,
        noEmail: !!(contact.sperreEmail || contact.optOut),
        optOut: !!contact.optOut
    };
}

/** @returns {{ promotors: object[], customerContacts: object[] }} */
export function customerContactGroups(customer) {
    const contacts = (Array.isArray(customer?.contacts) ? customer.contacts : []).filter(Boolean);
    const promotors = contacts.filter((contact) => contact.art === 'promotor').map(contactView);
    const customerContacts = contacts.filter((contact) => contact.art !== 'promotor').map(contactView)
        // Hauptansprechpartner zuerst, dann wer ohne Sperre erreichbar ist, dann nach Name.
        .sort((a, b) => Number(b.primary) - Number(a.primary)
            || Number(a.noCall && a.noEmail) - Number(b.noCall && b.noEmail)
            || Number(b.doi) - Number(a.doi)
            || a.name.localeCompare(b.name, 'de'));
    return { promotors, customerContacts };
}

/**
 * Lohnt der Knopf „Kundenansprechpartner"? Ein einzelner Hauptansprechpartner
 * ohne Abteilung steht schon in der Kachel – dafür kein zweiter Knopf.
 */
export function showsCustomerContacts(customerContacts) {
    if (!customerContacts.length) return false;
    if (customerContacts.length > 1) return true;
    const [only] = customerContacts;
    return !only.primary || !!only.abteilung;
}

const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

// Schneller Weg für Filter: läuft je Kunde bei jedem Filterklick.
function promotorField(customer, field) {
    const contacts = customer?.contacts;
    if (!Array.isArray(contacts) || !contacts.length) return [];
    const values = [];
    for (const contact of contacts) {
        if (contact?.art !== 'promotor') continue;
        const value = text(contact[field]);
        if (value) values.push(value);
    }
    return values.length > 1 ? uniqueSorted(values) : values;
}

/** Filterwerte „Promotor": alle Promotoren-Namen des Kunden. */
export function promotorNames(customer) {
    return promotorField(customer, 'name');
}

/** Filterwerte „Promotor-Thema": alle Themen seiner Promotoren. */
export function promotorTopics(customer) {
    return promotorField(customer, 'thema');
}

/**
 * Filterebenen für Promotoren – nur, wenn die Daten welche enthalten.
 * Ein Kunde kann mehrere Promotoren haben (`values` liefert eine Liste); er
 * ist sichtbar, sobald einer davon ausgewählt ist.
 */
export function promotorDimensionDefs(customers = []) {
    const defs = [];
    if (customers.some((customer) => promotorNames(customer).length)) {
        defs.push({ id: 'promotor', field: 'promotor', label: 'Promotor', values: promotorNames });
    }
    if (customers.some((customer) => promotorTopics(customer).length)) {
        defs.push({ id: 'promotor-thema', field: 'promotor-thema', label: 'Promotor-Thema', values: promotorTopics });
    }
    return defs;
}

/**
 * Zeilen fürs KI-Briefing: Namen mit Abteilung bzw. Thema, damit der
 * Assistent Mails und Termine zuordnen kann – ohne Telefon und E-Mail.
 * Der Hauptansprechpartner steht schon im Briefing und fehlt hier.
 */
export function contactBriefingLines(customer) {
    const { promotors, customerContacts } = customerContactGroups(customer);
    const lines = [];
    const describe = (contact, detail) => (detail ? `${contact.name} (${detail})` : contact.name);
    const others = customerContacts
        .filter((contact) => contact.name && !(contact.primary && text(customer?.ansprechpartner) === contact.name && !contact.abteilung))
        // Kontakte mit Sperrvermerk (Opt-out, Werbesperre, nicht anrufen) nennt das Briefing nicht.
        .filter((contact) => !contact.optOut && !contact.noEmail && !contact.noCall)
        .slice(0, 8)
        .map((contact) => describe(contact, contact.abteilung || contact.funktion));
    if (others.length) lines.push(`- Ansprechpartner beim Kunden: ${others.join('; ')}`);
    const named = promotors.filter((p) => p.name).map((p) => describe(p, p.thema));
    if (named.length) lines.push(`- Promotoren: ${named.join('; ')}`);
    return lines;
}
