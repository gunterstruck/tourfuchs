/**
 * Wo steht die Steuerleiste der Live-Schulungen?
 *
 * Reine Rechnung ohne DOM: Aus Fenstergröße, Leistengröße und den Flächen, die
 * nicht verdeckt werden sollen, den günstigsten Platz wählen. Das Messen der
 * Flächen und das Setzen der Lage übernimmt `src/ui/showcase.js`.
 *
 * Jede Fläche trägt ein Gewicht je verdecktem Pixel. Gewählt wird der Platz mit
 * den geringsten Kosten; bei Gleichstand gilt die Reihenfolge der Kandidaten –
 * oben mittig zuerst, wie die Leiste immer stand.
 */

export const TOOLBAR_GAP = 12;

/** Kosten, die der bisherige Platz geschenkt bekommt, damit die Leiste nicht wegen weniger Pixel springt. */
export const TOOLBAR_STAY_BONUS = 200;

/**
 * Wie teuer ist es, das gezeigte Element zu verdecken?
 *
 * Ein Knopf, ein Feld, eine Zeile: nie. Erklärt die Sprechblase dagegen einen
 * halben Bildschirm (etwa den ganzen Körper eines Dialogs), ist das kein
 * Klickziel, sondern eine Fläche – als tabu gewertet triebe sie die Leiste
 * genau auf Titel und „Schließen". Solche Flächen zählen wie Dialogfläche;
 * was darin wichtig ist, gewichten die Inhalte selbst.
 */
export function focusWeight(area, viewportArea) {
    return area > viewportArea * 0.25 ? 2 : 40;
}

export function overlapArea(a, b) {
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

export function toolbarCandidates(w, h, vw, vh, gap = TOOLBAR_GAP) {
    const right = vw - w - gap;
    const bottom = vh - h - gap;
    const midX = (vw - w) / 2;
    const midY = (vh - h) / 2;
    return [
        [midX, gap], [midX, bottom],
        [gap, gap], [right, gap],
        [gap, bottom], [right, bottom],
        [gap, midY], [right, midY]
    ].map(([x, y]) => ({ x: Math.max(gap, x), y: Math.max(gap, y) }));
}

/**
 * @param {number} w Leistenbreite
 * @param {number} h Leistenhöhe
 * @param {number} vw Fensterbreite
 * @param {number} vh Fensterhöhe
 * @param {{ r: {left:number, top:number, right:number, bottom:number}, weight: number }[]} obstacles
 * @param {{x:number, y:number}|null} current bisheriger Platz
 * @returns {{x:number, y:number, cost:number}}
 */
export function bestToolbarSpot(w, h, vw, vh, obstacles, current = null) {
    let best = null;
    let kept = null;
    for (const c of toolbarCandidates(w, h, vw, vh)) {
        const box = { left: c.x, top: c.y, right: c.x + w, bottom: c.y + h };
        let cost = 0;
        for (const o of obstacles) cost += o.weight * overlapArea(box, o.r);
        const stays = current && Math.abs(current.x - c.x) < 2 && Math.abs(current.y - c.y) < 2;
        if (stays && cost <= 0) kept = { ...c, cost };
        if (stays) cost -= TOOLBAR_STAY_BONUS;
        if (!best || cost < best.cost) best = { ...c, cost };
    }
    // Wer nichts verdeckt, bleibt stehen – auch wenn ein anderer Platz in der
    // Rangfolge weiter vorn läge. Sonst spränge die Leiste nach jeder
    // verschwundenen Sprechblase zurück nach oben und beim nächsten Satz wieder weg.
    return kept || best;
}

/**
 * Volle Leiste oder Symbol-Pille?
 *
 * Die volle Leiste nur, wenn sie in einer Zeile ins Fenster passt und entweder
 * nichts verdeckt oder die Pille auch nicht besser dastünde.
 */
export function chooseToolbarLayout({ full, compact, vw, vh, obstacles, current = null, wasCompact = false, gap = TOOLBAR_GAP }) {
    const fullFits = full.w <= vw - 2 * gap && full.h <= 60;
    const fullSpot = fullFits ? bestToolbarSpot(full.w, full.h, vw, vh, obstacles, wasCompact ? null : current) : null;
    if (fullSpot && fullSpot.cost <= 0) return { compact: false, ...fullSpot };
    const smallSpot = bestToolbarSpot(compact.w, compact.h, vw, vh, obstacles, wasCompact ? current : null);
    if (!fullSpot || smallSpot.cost < fullSpot.cost) return { compact: true, ...smallSpot };
    return { compact: false, ...fullSpot };
}
