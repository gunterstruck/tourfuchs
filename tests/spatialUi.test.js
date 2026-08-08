/**
 * Experiment „räumliche Oberfläche": Schalter, Ebenenwechsel, Gestenrechnung.
 *
 * Geprüft wird bewusst an den **reinen Funktionen** und am echten DOM, nicht am
 * Quelltext. Der Prompt sah als siebten Punkt „State wird gelesen und nicht
 * dupliziert" vor; das ließe sich nur als Quelltext-Behauptung schreiben, und
 * dieses Repo hat gerade erst wieder gelernt, dass Quelltext lesen keine
 * Messung ist. Ersetzt ist er durch die prüfbare Fassung: Eine Änderung am
 * gemeinsamen State schlägt in der geöffneten Oberfläche durch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    spread, midpoint, pinchIntent, tapBurstReached, tileLayout,
    buildAreas, customersOfArea,
    PINCH_ENTER, PINCH_EXIT, TAP_COUNT, TAP_WINDOW_MS, GESTURE_GAP_MS
} from '../src/experiments/spatialUi.js';
import { state, emit, UNASSIGNED } from '../src/core/state.js';

const customer = (id, name, bezirk, ort = 'Essen') => ({ id, name, bezirk, ort, plz: '45136' });

describe('Spatial-UI – Gestenrechnung', () => {
    it('misst Abstand und Mittelpunkt zweier Finger', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 30, y: 40 };
        expect(spread(a, b)).toBe(50);
        expect(midpoint(a, b)).toEqual({ x: 15, y: 20 });
    });

    it('löst erst über der Aufzieh-Schwelle aus', () => {
        expect(pinchIntent(100, 100 * PINCH_ENTER)).toBe('enter');
        expect(pinchIntent(100, 100 * PINCH_ENTER - 1)).toBeNull();
    });

    it('löst erst unter der Zusammenzieh-Schwelle aus', () => {
        expect(pinchIntent(100, 100 * PINCH_EXIT)).toBe('exit');
        expect(pinchIntent(100, 100 * PINCH_EXIT + 1)).toBeNull();
    });

    it('deutet Zittern nicht als Geste', () => {
        expect(pinchIntent(100, 103)).toBeNull();
        expect(pinchIntent(100, 97)).toBeNull();
    });

    it('verweigert die Auskunft ohne brauchbaren Ausgangsabstand', () => {
        expect(pinchIntent(0, 200)).toBeNull();
        expect(pinchIntent(100, 0)).toBeNull();
    });
});

describe('Spatial-UI – versteckter Schalter', () => {
    it('erkennt fünf schnelle Tipper', () => {
        const t = 1_000_000;
        expect(tapBurstReached([t, t + 100, t + 200, t + 300, t + 400])).toBe(true);
    });

    it('lässt weniger als fünf Tipper nicht gelten', () => {
        const t = 1_000_000;
        expect(tapBurstReached([t, t + 100, t + 200, t + 300])).toBe(false);
    });

    it('lässt fünf zu langsame Tipper nicht gelten', () => {
        const t = 1_000_000;
        const langsam = [t, t + 900, t + 1800, t + 2700, t + 3600];
        expect(langsam[4] - langsam[0]).toBeGreaterThan(TAP_WINDOW_MS);
        expect(tapBurstReached(langsam)).toBe(false);
    });

    it('zählt nur die letzten fünf – ein früher Fehlversuch blockiert nicht', () => {
        const t = 1_000_000;
        expect(tapBurstReached([t, t + 60_000, t + 60_100, t + 60_200, t + 60_300, t + 60_400]))
            .toBe(true);
        expect(TAP_COUNT).toBe(5);
    });
});

describe('Spatial-UI – Ebenen aus dem gemeinsamen State', () => {
    it('leitet Ebene 0 aus den Kunden ab, größtes Gebiet zuerst', () => {
        const areas = buildAreas([
            customer('a', 'Alpha', 'Nord'),
            customer('b', 'Beta', 'Süd'),
            customer('c', 'Gamma', 'Nord')
        ]);
        expect(areas.map((a) => [a.name, a.count])).toEqual([['Nord', 2], ['Süd', 1]]);
    });

    it('sammelt Kunden ohne Gebiet unter einer eigenen Marke statt sie zu verlieren', () => {
        const areas = buildAreas([customer('a', 'Alpha', ''), customer('b', 'Beta', null)]);
        expect(areas).toEqual([{ id: `area:${UNASSIGNED}`, name: UNASSIGNED, count: 2 }]);
    });

    it('liefert Ebene 1 als die Kunden genau eines Gebiets', () => {
        const list = [customer('a', 'Zeta', 'Nord'), customer('b', 'Alpha', 'Nord'), customer('c', 'Beta', 'Süd')];
        expect(customersOfArea(list, 'Nord').map((c) => c.name)).toEqual(['Alpha', 'Zeta']);
    });

    it('ordnet die Fläche zweidimensional an, nicht als Liste', () => {
        const layout = tileLayout(9);
        expect(layout).toHaveLength(9);
        expect(new Set(layout.map((p) => p.x)).size).toBeGreaterThan(1);
        expect(new Set(layout.map((p) => p.y)).size).toBeGreaterThan(1);
        // Deterministisch: gleicher Eingang, gleicher Ausgang.
        expect(tileLayout(9)).toEqual(layout);
    });
});

describe('Spatial-UI – Oberfläche', () => {
    let spatial;

    beforeEach(async () => {
        document.body.innerHTML = '<div class="brand"><span>TourFuchs</span></div><main id="klassisch"></main>';
        state.customers = [
            customer('a', 'Alpha', 'Nord'),
            customer('b', 'Beta', 'Nord'),
            customer('c', 'Gamma', 'Süd')
        ];
        spatial = await import('../src/experiments/spatialUi.js');
    });

    afterEach(() => {
        spatial.close();
        state.customers = [];
        document.body.innerHTML = '';
    });

    const tiles = () => [...document.querySelectorAll('.sx-tile')];
    const crumb = () => document.querySelector('.sx-crumb')?.textContent;

    it('öffnet auf Ebene 0 und zeigt die Gebiete', () => {
        spatial.open();
        expect(spatial.isOpen()).toBe(true);
        expect(tiles().map((t) => t.dataset.key)).toEqual(['Nord', 'Süd']);
        expect(crumb()).toBe('TourFuchs');
    });

    it('wechselt bei einem Tipp genau eine Ebene', () => {
        spatial.open();
        tiles()[0].click();
        expect(crumb()).toBe('TourFuchs › Nord');
        expect(tiles().map((t) => t.textContent.trim().split('\n')[0])).toEqual(['Alpha', 'Beta']);
    });

    it('springt nicht weiter, wenn das Element ein Blatt ist', () => {
        spatial.open();
        tiles()[0].click();
        const vorher = crumb();
        tiles()[0].click();                       // Kunde – bewusst keine tiefere Ebene
        expect(crumb()).toBe(vorher);
        expect(tiles()[0].dataset.zoomable).toBe('0');
    });

    it('führt „zurück" genau eine Ebene, nicht mehrere', () => {
        spatial.open();
        tiles()[0].click();
        expect(crumb()).toBe('TourFuchs › Nord');
        document.querySelector('.sx-back').click();
        expect(crumb()).toBe('TourFuchs');
        expect(document.querySelector('.sx-back').disabled).toBe(true);
    });

    it('stellt beim Verlassen die klassische Oberfläche wieder her, ohne sie neu zu bauen', () => {
        const klassisch = document.getElementById('klassisch');
        spatial.open();
        expect(document.body.classList.contains('sx-on')).toBe(true);
        document.querySelector('.sx-leave').click();
        expect(spatial.isOpen()).toBe(false);
        expect(document.body.classList.contains('sx-on')).toBe(false);
        expect(document.querySelector('.sx-root').hidden).toBe(true);
        // Dieselbe Instanz wie vorher: nicht zerstört, nur zurückgetreten.
        expect(document.getElementById('klassisch')).toBe(klassisch);
    });

    it('liest den gemeinsamen State, statt ihn zu kopieren', () => {
        spatial.open();
        expect(tiles()).toHaveLength(2);
        state.customers = [...state.customers, customer('d', 'Delta', 'West')];
        emit('customers:changed');
        expect(tiles().map((t) => t.dataset.key)).toEqual(['Nord', 'Süd', 'West']);
    });

    it('bietet jederzeit einen sichtbaren Rückweg – keine Sackgasse', () => {
        spatial.open();
        tiles()[0].click();
        expect(document.querySelector('.sx-back')).not.toBeNull();
        expect(document.querySelector('.sx-leave')).not.toBeNull();
        expect(document.querySelector('.sx-back').disabled).toBe(false);
    });

    it('beginnt nach einer Pause eine neue Geste, auch wenn das Ende verlorenging', () => {
        // Der Fehler, den erst die Handprüfung am echten Browser zeigte:
        // Ein Ebenenwechsel ersetzt den Inhalt der Fläche, die Kachel unter dem
        // Finger hängt danach nicht mehr im Dokument – und die folgenden
        // `touchend` erreichen die Bühne nie. Ohne Wachhund bliebe der
        // Gestenzustand für immer stehen: Aufziehen ginge einmal,
        // Zusammenziehen nie. Am Ereignis ist das nicht heilbar, an der Zeit
        // schon.
        spatial.open();
        const stage = document.querySelector('.sx-stage');
        let jetzt = 1_000_000;
        const uhr = vi.spyOn(Date, 'now').mockImplementation(() => jetzt);

        const zweiFinger = (abstand) => {
            const ev = new Event('touchmove', { bubbles: true, cancelable: true });
            Object.defineProperty(ev, 'touches', {
                value: [{ clientX: 200 - abstand / 2, clientY: 300 }, { clientX: 200 + abstand / 2, clientY: 300 }]
            });
            stage.dispatchEvent(ev);
        };

        // Erste Geste: aufziehen. Sie gilt danach als verbraucht.
        zweiFinger(100);
        jetzt += 16;
        zweiFinger(100 * PINCH_ENTER + 5);
        const nachErster = document.querySelector('.sx-crumb').textContent;

        // Ohne Pause bleibt dieselbe Geste verbraucht – kein zweiter Wechsel.
        jetzt += 16;
        zweiFinger(20);
        expect(document.querySelector('.sx-crumb').textContent).toBe(nachErster);

        // Nach der Pause zählt es als neue Geste und wirkt wieder.
        jetzt += GESTURE_GAP_MS + 50;
        zweiFinger(200);
        jetzt += 16;
        zweiFinger(200 * PINCH_EXIT - 5);
        expect(document.querySelector('.sx-crumb').textContent).toBe('TourFuchs');

        uhr.mockRestore();
    });

    it('lässt sich mit fünf schnellen Tippern auf das Markenzeichen öffnen', () => {
        spatial.initSpatialUi();
        const brand = document.querySelector('.brand');
        for (let i = 0; i < 4; i++) brand.click();
        expect(spatial.isOpen()).toBe(false);      // vier reichen nicht
        brand.click();
        expect(spatial.isOpen()).toBe(true);
    });
});
