/**
 * Plan-Einstellungen für die Tagestour: Datum, Startzeit und Besuchsdauer
 * steuern Tagesplan-Druck, Kalender-Termine (.ics) und die QR-Übergabe.
 * Die Tour selbst plant der Nutzer manuell (bewusste Produktentscheidung:
 * kein automatischer Tourvorschlag).
 */

/** Datum (yyyy-mm-dd) + Uhrzeit (HH:MM) zu einem lokalen Date kombinieren. */
export function combinePlanStart(dateStr, timeStr) {
    const fallback = new Date();
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    const [hh, mm] = String(timeStr || '08:00').split(':').map(Number);
    const date = y && m && d ? new Date(y, m - 1, d) : fallback;
    date.setHours(Number.isFinite(hh) ? hh : 8, Number.isFinite(mm) ? mm : 0, 0, 0);
    return date;
}

/** Heute als Wert für <input type="date"> (lokale Zeitzone). */
export function todayInputValue(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * Der Tag, auf den sich die Planung bezieht.
 *
 * Externer Prüfbericht, P2: Seit dem Gebiets-Briefing den eingestellten
 * Besuchstag berücksichtigt, rechneten Karte, Lasso, „In der Nähe" und die
 * Tourpriorisierung weiter gegen die echte Uhr. Für einen Reisetag in der
 * Zukunft zeigte die Karte andere Fälligkeiten als das Briefing zu denselben
 * Kunden – zwei Wahrheiten nebeneinander.
 *
 * Eine Quelle für alle: das Feld „Datum" der Plan-Einstellungen, sonst heute.
 * Bewusst hier und nicht in `visits.js` – das bleibt DOM-frei und testbar.
 */
export function planningNow(now = new Date()) {
    const value = (typeof document !== 'undefined'
        ? document.getElementById('plan-date')?.value
        : '') || '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return now;
    const [, y, m, d] = match.map(Number);
    const planned = new Date(y, m - 1, d, 12, 0, 0);
    return Number.isNaN(planned.getTime()) ? now : planned;
}
