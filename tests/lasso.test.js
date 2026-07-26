import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    MIN_LASSO_AREA,
    customersInLasso,
    isUsableLasso,
    lassoSelectionLabel,
    pointInPolygon,
    polygonArea,
    polygonCentroid,
    simplifyPath
} from '../src/features/lasso.js';

/** Quadrat 0,0 – 100,100 */
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

/** Ein „U": die Delle in der Mitte darf nicht als drinnen gelten. */
const uShape = [
    { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 70 }, { x: 60, y: 70 },
    { x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
];

describe('Punkt in Fläche', () => {
    it('trifft innen und lässt außen draußen', () => {
        expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
        expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
        expect(pointInPolygon({ x: 50, y: -1 }, square)).toBe(false);
    });

    it('kommt mit einer unrunden Fläche zurecht – dafür gibt es das Lasso', () => {
        // Genau das kann ein Umkreis nicht: die Delle bleibt außen vor.
        expect(pointInPolygon({ x: 50, y: 30 }, uShape)).toBe(false);
        expect(pointInPolygon({ x: 20, y: 30 }, uShape)).toBe(true);
        expect(pointInPolygon({ x: 80, y: 30 }, uShape)).toBe(true);
        expect(pointInPolygon({ x: 50, y: 90 }, uShape)).toBe(true);
    });

    it('behandelt entartete Eingaben als „nicht drin", nicht als Fehler', () => {
        expect(pointInPolygon({ x: 1, y: 1 }, [])).toBe(false);
        expect(pointInPolygon({ x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
        expect(pointInPolygon(null, square)).toBe(false);
    });
});

describe('Form der gezeichneten Spur', () => {
    it('misst die Fläche unabhängig von der Zeichenrichtung', () => {
        expect(polygonArea(square)).toBe(10000);
        expect(polygonArea([...square].reverse())).toBe(10000);
        expect(polygonArea([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    });

    it('dünnt das Handzittern aus, behält aber den letzten Punkt', () => {
        const jitter = [
            { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 40, y: 0 }, { x: 41, y: 1 }
        ];
        const thin = simplifyPath(jitter, 4);
        expect(thin.length).toBeLessThan(jitter.length);
        expect(thin[0]).toEqual({ x: 0, y: 0 });
        expect(thin[thin.length - 1]).toEqual({ x: 41, y: 1 });
    });

    it('erkennt ein Tippen als Nicht-Auswahl', () => {
        // Vor der Kamera darf ein Fehlklick nichts auslösen …
        expect(isUsableLasso([{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 6 }])).toBe(false);
        expect(isUsableLasso([])).toBe(false);
        // … aber alles, was erkennbar ein Zug war, soll gelten – auch krumm.
        expect(isUsableLasso(square)).toBe(true);
        expect(polygonArea(square)).toBeGreaterThan(MIN_LASSO_AREA);
    });

    it('findet den Flächenmittelpunkt', () => {
        expect(polygonCentroid(square)).toEqual({ x: 50, y: 50 });
        expect(polygonCentroid([])).toBeNull();
    });
});

describe('Kunden in der Fläche', () => {
    const customers = [
        { id: 'a', name: 'Mitte', lat: 1, lng: 1 },
        { id: 'b', name: 'Rand', lat: 2, lng: 2 },
        { id: 'c', name: 'Draußen', lat: 19, lng: 19 },
        { id: 'd', name: 'Ohne Koordinaten', lat: null, lng: null }
    ];
    // lat/lng werden hier direkt als Pixel gelesen – die echte Projektion
    // liefert die Karte.
    const project = (customer) => ({ x: customer.lng * 10, y: customer.lat * 10 });

    it('nimmt nur verortete Kunden innerhalb der Fläche', () => {
        const hits = customersInLasso(customers, square, project);
        expect(hits.map((c) => c.id)).toEqual(['b', 'a']);
    });

    it('sortiert von der Mitte der Fläche nach außen', () => {
        // „b" liegt bei (20,20) und damit näher am Mittelpunkt (50,50) als „a".
        const hits = customersInLasso(customers, square, project);
        expect(hits[0].id).toBe('b');
    });

    it('liefert nichts bei unbrauchbarer Fläche oder fehlender Projektion', () => {
        expect(customersInLasso(customers, [{ x: 0, y: 0 }], project)).toEqual([]);
        expect(customersInLasso(customers, square, null)).toEqual([]);
    });
});

describe('Beschriftung des Auswahlstreifens', () => {
    it('nennt die Zahl und beugt sich richtig', () => {
        expect(lassoSelectionLabel(0)).toBe('Keine Kunden in dieser Fläche');
        expect(lassoSelectionLabel(1)).toBe('1 Kunde ausgewählt');
        expect(lassoSelectionLabel(7)).toBe('7 Kunden ausgewählt');
    });
});

describe('Verdrahtung des Lasso-Werkzeugs', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const ui = readFileSync(resolve(process.cwd(), 'src/ui/lasso.js'), 'utf8');
    const main = readFileSync(resolve(process.cwd(), 'src/main.js'), 'utf8');
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components.css'), 'utf8');
    const map = readFileSync(resolve(process.cwd(), 'src/features/map.js'), 'utf8');

    it('hat Knopf, gemeinsame Knopfzeile und Anmeldung beim Start', () => {
        expect(html).toContain('id="btn-lasso"');
        expect(html).toContain('id="map-fab-row"');
        expect(main).toContain('initLasso()');
    });

    it('stellt „Lasso ziehen" gleichrangig neben „Kunden in meiner Nähe"', () => {
        // Zwei gleichwertige Angebote gehören nebeneinander und sehen gleich
        // aus – nicht übereinander in zwei verschiedenen Gewändern.
        const row = html.slice(html.indexOf('id="map-fab-row"'), html.indexOf('</div>', html.indexOf('id="map-fab-row"')) + 6);
        expect(row).toContain('id="mobile-next-step"');
        expect(row).toContain('id="btn-lasso"');
        // Beide Knöpfe tragen dieselbe Pillen-Klasse (die Zeile selbst heißt
        // `map-fab-row` und zählt hier nicht mit).
        expect(row.match(/map-fab"/g)).toHaveLength(2);
        expect(ui).toContain("label.textContent = active ? 'Ziehen …' : 'Lasso ziehen'");
    });

    it('friert die Karte im Zeichenmodus ein', () => {
        // Ohne das wird jedes Verschieben der Karte zur Auswahl.
        expect(ui).toContain("'dragging'");
        expect(ui).toContain('setMapInteraction');
        expect(ui).toContain("classList.toggle('lasso-active', active)");
        expect(css).toContain('body.lasso-active #map { cursor: crosshair; }');
    });

    it('zeigt die Auswahl, bevor es zum Briefing geht', () => {
        // Erst sehen, dann gefragt werden – dieser Beat trägt den Effekt.
        // Entscheidend: Das Loslassen zeichnet und zählt, mehr nicht. Den
        // Dialog öffnet ausschließlich der Knopf auf der Auswahlkarte.
        expect(ui).toContain('L.polygon');
        expect(ui).toContain('circleMarker');
        const stroke = ui.slice(ui.indexOf('function finishStroke'), ui.indexOf('function relativePoint'));
        expect(stroke).toContain('showSelection(polygon, found)');
        expect(stroke).not.toContain('openAreaBriefing');
    });

    it('zeigt die Auswahl als Karte im Gewand der Kundenkarte', () => {
        // „So wie bei den Kunden": dieselbe Popup-Sprache, derselbe Ort für die
        // Fortsetzung – und dieselben Optionen, damit es sich nicht anders anfühlt.
        expect(ui).toContain('openMapCard');
        expect(ui).toContain('popup popup-lasso');
        expect(ui).toContain('popup-actions');
        expect(ui).toContain('📋 Briefing über alle');
        expect(map).toContain('export function openMapCard');
        expect(map).toContain('popupOptions(');
    });

    it('zeichnet die Spur mit und zeigt den Startpunkt', () => {
        // „dann trifft man ungefähr das Ende": Ohne sichtbaren Startpunkt weiß
        // niemand, wo die Fläche geschlossen wird.
        const trace = ui.slice(ui.indexOf('function drawTrace'), ui.indexOf('function clearTrace'));
        expect(trace).toContain("pathEl.setAttribute('d'");
        expect(trace).toContain('startDot');
        expect(ui).toContain("addEventListener('pointermove', onPointerMove, true)");
        expect(css).toContain('.lasso-start {');
    });

    it('baut kein zweites Briefing, sondern nutzt das vorhandene', () => {
        expect(ui).toContain("from './areaBriefing.js'");
        expect(ui).not.toMatch(/buildAreaBriefingPrompt|Du bist meine Vertriebsassistenz/);
    });

    it('verwirft die Auswahl, sobald der Kartenausschnitt nicht mehr passt', () => {
        // Bewusst `dragstart` statt `movestart`: `movestart` feuert auch bei
        // programmatischen Schwenks – etwa dem der eigenen Auswahlkarte. Die
        // Auswahl löschte sich damit im selben Moment selbst.
        expect(ui).toContain("map.on('dragstart zoomstart'");
        expect(ui).not.toContain("map.on('movestart");
        expect(ui).toContain("on('customers:changed'");
    });

    it('lässt die Auswahlkarte stehen, statt sie sofort wieder zu schließen', () => {
        // Leaflet wertet die Berührung direkt nach dem Loslassen als
        // Kartenklick und schlösse die frisch geöffnete Karte sofort.
        expect(ui).toContain('closeOnClick: false');
        expect(ui).toContain('autoPan: false');
    });

    it('lässt den Zeichenmodus per Escape verlassen', () => {
        expect(ui).toContain("event.key === 'Escape'");
    });

    it('schafft der Karte Platz und gibt ihn erst nach der Auswahl zurück', () => {
        // Auf Tablet-Hochkant bleibt vom Kartenfenster sonst ein Streifen von
        // gut hundert Pixeln – darauf lässt sich nichts zeichnen. Und käme das
        // Blatt direkt nach dem Zug zurück, begrübe es den Auswahlstreifen.
        expect(ui).toContain('collapseSheetForDemo');
        const back = ui.slice(ui.indexOf('function returnMapRoom'), ui.indexOf('/** Modus schalten'));
        expect(back).toContain('selection.length > 0');
        expect(ui.slice(ui.indexOf('export function clearLassoSelection'))).toContain('returnMapRoom()');
    });

    it('nimmt dem Browser die Wischgeste ab, sonst wird am Handy nichts gezeichnet', () => {
        // Leaflet setzt `touch-action: pan-x pan-y`. Damit beansprucht der
        // Browser jede Wischgeste für sich, schickt `pointercancel` und stellt
        // die Bewegungsereignisse ein: Die Karte friert ein, aber der Finger
        // zeichnet ins Leere. Leaflets Ziehen abzuschalten genügt dafür nicht.
        expect(css).toContain('body.lasso-active #map,');
        const block = css.slice(css.indexOf('body.lasso-active #map,'), css.indexOf('body.lasso-active #map {'));
        expect(block).toContain('touch-action: none;');
        expect(block).toContain('.leaflet-container');
    });

    it('hält den Zeiger fest und wirft eine abgebrochene Geste nicht weg', () => {
        expect(ui).toContain('setPointerCapture');
        expect(ui).toContain('releasePointerCapture');
        const cancel = ui.slice(ui.indexOf('function onPointerCancel'), ui.indexOf('export function setLassoActive'));
        expect(cancel).toContain('isUsableLasso(salvaged)');
        expect(cancel).toContain('finishStroke()');
    });

    it('lässt den Fuchs-Knopf zurücktreten, solange gezeichnet wird', () => {
        // Während des Zugs beantwortet er eine andere Frage und säße im Weg.
        expect(css).toContain('body.lasso-active .mobile-next-step { display: none; }');
    });

    it('lässt beide Pillen auf ein schmales Telefon passen', () => {
        const narrow = css.slice(css.indexOf('@media (max-width: 520px)'));
        expect(narrow).toContain('.map-fab-row');
        expect(narrow).toContain('max-width: 48vw');
    });
});

describe('Streifen und Knopf am unteren Rand', () => {
    const responsive = readFileSync(resolve(process.cwd(), 'src/styles/responsive.css'), 'utf8');

    it('liegt auf Tablet-Hochkant über dem Blatt, nicht dahinter', () => {
        // Dort gilt die Blatt-Geometrie, aber nicht die Handy-Regeln ab 768px.
        const start = responsive.indexOf('@media (min-width: 769px) and (max-width: 1200px) and (orientation: portrait)');
        const portrait = responsive.slice(start, start + 3000);
        expect(portrait).toContain('.map-fab-row');
        expect(portrait).toContain('--mobile-sheet-peek');
    });

    it('schwebt am Handy über dem eingeklappten Blatt', () => {
        const start = responsive.indexOf('.map-fab-row {');
        expect(start).toBeGreaterThan(-1);
        expect(responsive.slice(start, start + 300)).toContain('bottom: calc(var(--mobile-sheet-peek');
    });
});

describe('Lasso-Demo', () => {
    const showcase = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
    const stories = readFileSync(resolve(process.cwd(), 'src/features/stories.js'), 'utf8');

    it('zieht die Fläche mit echten Zeigerereignissen, nicht als Attrappe', () => {
        expect(showcase).toContain('async drawLasso()');
        expect(showcase).toContain("new PointerEvent(type");
        expect(showcase).toContain("fire('pointerdown'");
        expect(showcase).toContain("fire('pointerup'");
    });

    it('bricht sichtbar ab, wenn die Auswahl nicht zustande kommt', () => {
        expect(showcase).toContain('Die Lasso-Auswahl ist nicht zustande gekommen.');
    });

    it('läuft trotz der Demo-Sperre bis zur geschützten Vorschau durch', () => {
        // Mit Beispielkunden bietet der Streifen kein „Briefing erstellen" an –
        // das ist die Sperre, nicht ein Fehler. Die Vorführung soll den Weg
        // trotzdem zu Ende gehen, statt davor abzubrechen.
        const runner = showcase.slice(showcase.indexOf('async openLassoBriefing()'), showcase.indexOf('async closeLassoBriefing()'));
        expect(runner).toContain('openAreaBriefingDialog(lassoSelection()');
        expect(runner).not.toContain('war nicht erreichbar');
    });

    it('räumt Zeichenmodus und Auswahl auch nach einem Abbruch auf', () => {
        const cleanup = showcase.slice(showcase.indexOf('function cleanup(story)'));
        expect(cleanup).toContain('setLassoActive(false)');
        expect(cleanup).toContain('clearLassoSelection()');
    });

    it('nutzt nur Helfer, die es wirklich gibt', () => {
        const story = stories.slice(stories.indexOf("id: 'lasso'"), stories.indexOf("id: 'tour'"));
        const keys = [...story.matchAll(/key: '([^']+)'/g)].map((match) => match[1]);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) expect(showcase).toContain(`async ${key}(`);
    });
});
