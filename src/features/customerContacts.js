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
        thema: text(contact.thema),
        phone: text(contact.telefon),
        tel: telOf(contact.telefon),
        email: text(contact.email),
        primary: !!contact.primary
    };
}

/** @returns {{ promotors: object[], customerContacts: object[] }} */
export function customerContactGroups(customer) {
    const contacts = (Array.isArray(customer?.contacts) ? customer.contacts : []).filter(Boolean);
    const promotors = contacts.filter((contact) => contact.art === 'promotor').map(contactView);
    const customerContacts = contacts.filter((contact) => contact.art !== 'promotor').map(contactView)
        // Hauptansprechpartner zuerst.
        .sort((a, b) => Number(b.primary) - Number(a.primary));
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

/** Filterwerte „Promotor": alle Promotoren-Namen des Kunden. */
export function promotorNames(customer) {
    return uniqueSorted(customerContactGroups(customer).promotors.map((p) => p.name));
}

/** Filterwerte „Promotor-Thema": alle Themen seiner Promotoren. */
export function promotorTopics(customer) {
    return uniqueSorted(customerContactGroups(customer).promotors.map((p) => p.thema));
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
        .map((contact) => describe(contact, contact.abteilung));
    if (others.length) lines.push(`- Ansprechpartner beim Kunden: ${others.join('; ')}`);
    const named = promotors.filter((p) => p.name).map((p) => describe(p, p.thema));
    if (named.length) lines.push(`- Promotoren: ${named.join('; ')}`);
    return lines;
}
