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
