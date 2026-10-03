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
export function currentViewportHeight(win = window) {
    const inner = Math.round(win.innerHeight || 0);
    const visual = Math.round(win.visualViewport?.height || 0);
    // Tastatur offen: visualViewport ist kleiner – die App behält die volle
    // Höhe (innerHeight), damit nichts springt.
    return Math.max(inner, visual) || 0;
}

export function applyViewportHeight({ win = window, doc = document } = {}) {
    const h = currentViewportHeight(win);
    if (h > 0) doc.documentElement.style.setProperty('--app-height', `${h}px`);
    if (win.scrollY || win.scrollX) win.scrollTo(0, 0);
    return h;
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
    doc.addEventListener('visibilitychange', () => {
        if (doc.visibilityState === 'visible') syncSoon();
    });
    applyViewportHeight({ win, doc });
    return { sync };
}
