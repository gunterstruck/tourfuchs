/**
 * Fensterhöhe absichern – vor allem für die installierte App auf dem iPhone.
 *
 * Nach dem Sperren und Entsperren liefert iOS der Web-App teils ein veraltetes
 * `100dvh`: Die App ist dann nur halb so hoch, darunter bleibt eine weiße
 * Fläche, und mittig gesetzte Karten ragen oben unter die Statusleiste. Ein
 * Neuladen behebt es – das soll niemand müssen.
 *
 * Deshalb setzt TourFuchs die Höhe der App (`--app-height`) aus der echten
 * Fensterhöhe und prüft sie erneut, sobald die App wieder sichtbar wird, das
 * Fenster seine Größe ändert oder das Gerät gedreht wird. Eine verrutschte
 * Seite (scrollY ≠ 0) wird dabei zurückgesetzt.
 */
export function currentViewportHeight(win = window, doc = win.document) {
    // Layout-Höhe: Sie ändert sich weder mit der Tastatur noch, wenn iOS die
    // Seite heranzoomt. innerHeight schrumpft beim Zoomen – die App wäre dann
    // nur halb hoch (graue Fläche unter der Karte).
    const layout = Math.round(doc?.documentElement?.clientHeight || 0);
    const scale = win.visualViewport?.scale ?? 1;
    const inner = Math.abs(scale - 1) < 0.01 ? Math.round(win.innerHeight || 0) : 0;
    return Math.max(layout, inner) || 0;
}

export function applyViewportHeight({ win = window, doc = document } = {}) {
    const h = currentViewportHeight(win, doc);
    if (h > 0) doc.documentElement.style.setProperty('--app-height', `${h}px`);
    if (win.scrollY || win.scrollX) win.scrollTo(0, 0);
    return h;
}

/**
 * Hat iOS die Seite beim Tippen in ein Feld doch herangezoomt (etwa weil ein
 * Feld kleiner als 16px erscheint), bleibt sie danach gezoomt. Beim Verlassen
 * des Feldes setzt TourFuchs den Zoom zurück: kurz `maximum-scale=1` in den
 * Viewport-Tag, dann wieder den ursprünglichen Inhalt – Pinch-Zoom bleibt
 * danach wie vorher erlaubt.
 */
export function resetInputZoom({ win = window, doc = document } = {}) {
    const scale = win.visualViewport?.scale ?? 1;
    if (scale <= 1.01) return false;
    const meta = doc.querySelector('meta[name="viewport"]');
    if (!meta) return false;
    const original = meta.getAttribute('content') || '';
    if (/maximum-scale/.test(original)) return false;
    meta.setAttribute('content', `${original}, maximum-scale=1`);
    win.setTimeout(() => meta.setAttribute('content', original), 400);
    return true;
}

export function initViewportGuard({ win = window, doc = document } = {}) {
    let frame = 0;
    const timers = [];
    const sync = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => applyViewportHeight({ win, doc }));
    };
    // iOS meldet die richtige Höhe nach dem Aufwecken oft erst etwas später.
    const syncSoon = () => {
        sync();
        timers.splice(0).forEach(clearTimeout);
        timers.push(setTimeout(sync, 250), setTimeout(sync, 900));
    };
    win.addEventListener('resize', sync);
    win.addEventListener('orientationchange', syncSoon);
    win.addEventListener('pageshow', syncSoon);
    win.visualViewport?.addEventListener('resize', sync);
    doc.addEventListener('focusout', (event) => {
        if (!event.target?.matches?.('input, textarea, select')) return;
        // Erst wenn kein anderes Feld den Fokus übernimmt (Tastatur geht zu).
        win.setTimeout(() => {
            if (doc.activeElement?.matches?.('input, textarea, select')) return;
            if (resetInputZoom({ win, doc })) syncSoon();
        }, 120);
    });
    doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'visible') syncSoon();
    });
    applyViewportHeight({ win, doc });
    return { sync };
}
