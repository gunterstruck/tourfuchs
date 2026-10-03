/**
 * Mond/Sonne-Knopf oben rechts: ein Tipp schaltet TourFuchs **komplett** um.
 *
 *   🌙 → Nacht: dunkler Aurora-Stil **und** Lichterkarte (jeder Kunde ein Licht)
 *   ☀️ → Tag:   heller Stil und die Karte, die vorher eingestellt war
 *
 * Gedacht für den Moment, in dem man zeigen will, was die Werbung verspricht –
 * ohne Info-Dialog und Kartenauswahl. Die Feineinstellung (Automatisch · Hell ·
 * Dunkel, jede Karte einzeln) bleibt im Info-Dialog bzw. in der Kartenauswahl.
 *
 * Der Knopf hat keinen eigenen Zustand: „Nacht“ heißt, Stil ist dunkel und die
 * Lichterkarte ist gewählt. Wer eins von beiden anderswo ändert, sieht wieder
 * den Mond. Gemerkt wird nur, welche Karte vorher eingestellt war (lokal).
 */
export const NIGHT_PREV_BASEMAP_KEY = 'tf_night_prev_basemap';
export const LIGHTS_BASEMAP = 'lights';
const DARK_CLASS = 'aurora-dark';

export function isNight(doc, select) {
    return doc.documentElement.classList.contains(DARK_CLASS) && select?.value === LIGHTS_BASEMAP;
}

function hasOption(select, value) {
    return Boolean(value) && [...(select?.options || [])].some((o) => o.value === value);
}

function chooseBasemap(select, value) {
    if (!select || select.value === value || !hasOption(select, value)) return;
    select.value = value;
    // Über das change-Ereignis der Auswahl: Zustand, Karte und Speicherung
    // laufen damit genau so, als hätte man selbst gewählt.
    select.dispatchEvent(new Event('change', { bubbles: true }));
}

export function initNightToggle({
    doc = document, theme, storage = globalThis.localStorage, onBasemapChanged
} = {}) {
    const button = doc.getElementById('btn-night');
    const select = doc.getElementById('basemap-select');
    if (!button || !theme) return null;

    const render = () => {
        const night = isNight(doc, select);
        button.textContent = night ? '☀️' : '🌙';
        button.setAttribute('aria-pressed', String(night));
        const label = night
            ? 'Tagansicht: heller Stil mit der vorherigen Karte'
            : 'Nachtansicht: dunkler Stil mit Lichterkarte';
        button.setAttribute('aria-label', label);
        button.title = night ? 'Tagansicht: zurück zu hell' : 'Nachtansicht: jeder Kunde ein Licht';
    };

    const toggle = () => {
        if (isNight(doc, select)) {
            let previous = null;
            try { previous = storage?.getItem(NIGHT_PREV_BASEMAP_KEY); } catch { /* gesperrt */ }
            if (!hasOption(select, previous) || previous === LIGHTS_BASEMAP) previous = 'standard';
            theme.setChoice('light');
            chooseBasemap(select, previous);
        } else {
            if (select && select.value !== LIGHTS_BASEMAP) {
                try { storage?.setItem(NIGHT_PREV_BASEMAP_KEY, select.value); } catch { /* nur Sitzung */ }
            }
            theme.setChoice('dark');
            chooseBasemap(select, LIGHTS_BASEMAP);
        }
        render();
    };

    button.addEventListener('click', toggle);
    theme.onChange?.(render);
    select?.addEventListener('change', render);
    onBasemapChanged?.(render);
    render();
    return { toggle, render };
}
