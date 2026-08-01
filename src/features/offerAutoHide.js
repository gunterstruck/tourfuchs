/**
 * Entscheidungsregeln für das Zurücktreten vorübergehender Angebote –
 * bewusst ohne DOM, damit sie prüfbar sind (Steuerung siehe ui/offerAutoHide.js).
 */

/** Runter gescrollt ab hier, hoch gescrollt bis hier: etwas Hysterese gegen Zittern. */
export const RECEDE_AT = 48;
export const RESTORE_AT = 8;

/**
 * Lohnt sich das Zurücktreten überhaupt?
 *
 * Wenn die Angebote mehr Platz freigeben, als der Inhalt an Überhang hat, dann
 * passt der Inhalt danach vollständig ins Fenster – der Überhang verschwindet
 * und mit ihm die Scrollbarkeit. Damit könnte nie wieder ein Scroll-Ereignis
 * feuern, und die Angebote kämen bis zum Bereichswechsel nicht zurück: eine
 * Einbahnstraße, obwohl gar nichts zu gewinnen war. Also in diesem Fall gar
 * nicht erst zurücktreten.
 */
export function recedingPaysOff({ overflow, freed }) {
    const gap = Number(overflow);
    const gain = Number(freed);
    if (!Number.isFinite(gap) || gap <= 0) return false;
    if (!Number.isFinite(gain) || gain <= 0) return false;
    return gap > gain;
}

/** Zielzustand für eine Scrollposition – null heißt „so lassen". */
export function nextRecededState({ receded, scrollTop, overflow, freed }) {
    const y = Number(scrollTop) || 0;
    if (!receded && y > RECEDE_AT) {
        return recedingPaysOff({ overflow, freed }) ? true : null;
    }
    if (receded && y < RESTORE_AT) return false;
    return null;
}
