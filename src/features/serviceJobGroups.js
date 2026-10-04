/**
 * Einsätze beim selben Kunden zu einem Stopp bündeln – aber nur, wenn das
 * zusammen auch geht.
 *
 * Zwei Einsätze beim selben Kunden sind ein Halt, ein Weg, eine Parkplatzsuche
 * – deshalb werden sie gebündelt. Haben sie aber unvereinbare Zeitfenster
 * (A 09–10 Uhr, B 14–15 Uhr), ergäbe die Schnittmenge „14–10 Uhr", der Planer
 * verwürfe den ganzen Stopp – samt kritischem Einsatz A. Dann bleiben sie
 * getrennte Stopps.
 */

/** „9:05" → 545; leer oder unlesbar → null */
export function clockMinutes(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
    if (!match) return null;
    const minutes = Number(match[1]) * 60 + Number(match[2]);
    return Number(match[2]) < 60 && minutes <= 24 * 60 ? minutes : null;
}

/**
 * Gemeinsames Zeitfenster, falls Gruppe und neuer Einsatz zusammenpassen.
 * @returns {{ start: string, end: string } | null}  null: nicht bündeln
 */
export function joinedWindow(group, start, end, durationMin) {
    const later = (a, b) => (!a ? b : !b ? a : (clockMinutes(a) >= clockMinutes(b) ? a : b));
    const earlier = (a, b) => (!a ? b : !b ? a : (clockMinutes(a) <= clockMinutes(b) ? a : b));
    const joinedStart = later(group.timeWindowStart, start);
    const joinedEnd = earlier(group.timeWindowEnd, end);
    const from = clockMinutes(joinedStart);
    const to = clockMinutes(joinedEnd);
    if (from !== null && to !== null && to - from < (Number(group.durationMin) || 0) + (Number(durationMin) || 0)) return null;
    return { start: joinedStart || '', end: joinedEnd || '' };
}

/**
 * Erlaubtes Zeitfenster eines Einsatzes, geschnitten mit dem Planungstag.
 *
 * Ein Fenster darf über mehrere Tage gehen („05.10. 09:00 bis 07.10. 17:00").
 * Früher mussten beide Grenzen genau auf den Planungstag fallen – am 06.10.
 * hieß es dann „Termin liegt an einem anderen Tag", obwohl der ganze Tag im
 * Fenster liegt. Jetzt zählt die Überschneidung: Grenzen vor bzw. nach dem
 * Planungstag öffnen das Tagesfenster nach vorn bzw. hinten.
 *
 * @returns {{ start: string, end: string, matchesDate: boolean }}
 */
export function windowForPlanningDay(startValue, endValue, workDate) {
    const parse = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        if (/^\d{1,2}:\d{2}$/.test(raw)) return { date: null, time: raw };
        const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}:\d{2}))?/);
        return match ? { date: match[1], time: match[2] || null } : { date: null, time: raw };
    };
    const from = parse(startValue);
    const to = parse(endValue);
    let start = '';
    let end = '';
    if (from) {
        if (!from.date || from.date === workDate) start = from.time || '';
        else if (from.date > workDate) return { start: '', end: '', matchesDate: false };   // beginnt erst später
    }
    if (to) {
        if (!to.date || to.date === workDate) end = to.time || '';
        else if (to.date < workDate) return { start: '', end: '', matchesDate: false };     // schon vorbei
    }
    return { start, end, matchesDate: true };
}

/**
 * SLA-Frist als vergleichbarer Zeitpunkt „YYYY-MM-DDTHH:MM".
 * Ein reines Datum gilt bis Tagesende (24:00) – wie im Tagesplaner. Als Text
 * verglichen wäre „2026-10-05" früher als „2026-10-05T09:00", und die
 * frühere 09-Uhr-Frist ginge beim Bündeln verloren.
 */
export function slaInstant(value) {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?/);
    if (!match) return null;
    return match[2] === undefined ? `${match[1]}T24:00` : `${match[1]}T${match[2].padStart(2, '0')}:${match[3]}`;
}

/** Die frühere zweier SLA-Fristen (Originalwert), leere zählen nicht. */
export function earlierSla(a, b) {
    const ia = slaInstant(a);
    const ib = slaInstant(b);
    if (!ia) return ib ? b : (a || b || '');
    if (!ib) return a;
    return ib < ia ? b : a;
}
