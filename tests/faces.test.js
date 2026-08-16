/**
 * Zwei Oberflächen, kein drittes Gesicht.
 *
 * Diese Datei hieß „tabletSheetLayout" und bewachte einen eigenen CSS-Block für
 * das hochkante Tablet: andere Blatt-Höhen, ein anderer Griff, eine eigene
 * Platzierung der Karten-Knopfzeile. Sie bewachte damit genau das, was hier
 * nicht sein darf – eine dritte Oberfläche zwischen Touransicht und
 * Schreibtisch. Der Block ist weg, und diese Datei bewacht jetzt seine
 * Abwesenheit.
 *
 * Die verbindliche Regel:
 *
 *   Tablet hochkant = Touransicht (Mobile View), vollständig.
 *   Tablet quer     = Schreibtisch (Desktop View), vollständig.
 *   Dazwischen gibt es nichts.
 *
 * Geprüft wird nicht das Aussehen – das gehört ans Auge und an
 * `npm run face-check`. Geprüft wird die Struktur: **welche Medienabfragen es
 * überhaupt gibt** und **für wen sie greifen**. Denn eine dritte Oberfläche
 * entsteht nie durch eine Absicht, sondern immer durch eine vierte Schwelle,
 * die jemand für einen Einzelfall einzieht.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DESKTOP_FACE_MEDIA, faceFor, PHONE_FACE_MEDIA } from '../src/core/viewport.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const STYLE_DIR = 'src/styles';
const STYLESHEETS = readdirSync(resolve(process.cwd(), STYLE_DIR))
    .filter((name) => name.endsWith('.css'))
    .map((name) => `${STYLE_DIR}/${name}`);

/* ---------------------------------------------------------------------------
   Ein winziger Auswerter für Medienabfragen.

   Zeichenketten zu vergleichen fängt nur die Schreibweise; hier interessiert
   die **Bedeutung**. Verstanden werden Breite, Höhe und Ausrichtung – mehr
   braucht eine Gesichtsfrage nicht. Alles andere (`pointer`, `prefers-*`) macht
   eine Abfrage zu einer anderen Art von Frage; solche Preludes bleiben außen
   vor, statt hier falsch beantwortet zu werden.
--------------------------------------------------------------------------- */

/** Alle `@media`-Preludes einer Datei, Kommentare vorher entfernt. */
function preludes(css) {
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return [...ohneKommentare.matchAll(/@media([^{]+)\{/g)]
        .map((m) => m[1].replace(/\s+/g, ' ').trim());
}

const FEATURE = /^\((min|max)-(width|height):\s*(\d+)px\)$/;
const ORIENTATION = /^\(orientation:\s*(portrait|landscape)\)$/;

/** Lässt sich das Prelude allein aus Breite, Höhe und Ausrichtung beantworten? */
function isGeometrisch(prelude) {
    return prelude.split(',').every((clause) => clause.trim().split(' and ').every(
        (feature) => FEATURE.test(feature.trim()) || ORIENTATION.test(feature.trim())
    ));
}

function matchesFeature(feature, { width, height }) {
    const orientation = ORIENTATION.exec(feature);
    // CSS: hochkant, sobald die Höhe die Breite erreicht – wie `faceFor()`.
    if (orientation) return (height >= width) === (orientation[1] === 'portrait');
    const [, grenze, achse, roh] = FEATURE.exec(feature);
    const wert = achse === 'width' ? width : height;
    return grenze === 'min' ? wert >= Number(roh) : wert <= Number(roh);
}

/** Greift das Prelude in diesem Fenster? */
function matches(prelude, viewport) {
    return prelude.split(',').some((clause) => clause.trim().split(' and ')
        .every((feature) => matchesFeature(feature.trim(), viewport)));
}

/* ---------------------------------------------------------------------------
   Echte Geräte. Die Tablets sind der Prüfstein, die anderen sind der Maßstab,
   an dem sie gemessen werden.
--------------------------------------------------------------------------- */
const HANDY = { name: 'iPhone 15 hochkant', width: 393, height: 852 };
const SCHREIBTISCH = { name: 'Laptop', width: 1440, height: 900 };

const TABLETS_HOCHKANT = [
    { name: 'iPad mini hochkant', width: 744, height: 1133 },
    { name: 'Galaxy Tab S6 Lite hochkant', width: 800, height: 1333 },
    { name: 'iPad 11" hochkant', width: 834, height: 1194 },
    { name: 'iPad 12,9" hochkant', width: 1024, height: 1366 }
];

const TABLETS_QUER = [
    { name: 'iPad mini quer', width: 1133, height: 744 },
    { name: 'Galaxy Tab S6 Lite quer', width: 1333, height: 800 },
    { name: 'iPad 11" quer', width: 1194, height: 834 },
    { name: 'iPad 12,9" quer', width: 1366, height: 1024 }
];

/** Ein grobes Raster für die Vollständigkeitsprüfung der beiden Listen. */
const RASTER = [];
for (let width = 320; width <= 1600; width += 23) {
    for (let height = 320; height <= 1600; height += 29) RASTER.push({ width, height });
}

describe('Die zwei Listen sind Verneinungen voneinander', () => {
    it('teilt jedes Fenster genau einem Gesicht zu', () => {
        // Kein Fenster darf beide Listen treffen (Regeln lägen übereinander)
        // und keines darf zwischen ihnen durchfallen (Regeln fehlten ganz).
        const beide = RASTER.filter((v) => matches(PHONE_FACE_MEDIA, v) && matches(DESKTOP_FACE_MEDIA, v));
        const keines = RASTER.filter((v) => !matches(PHONE_FACE_MEDIA, v) && !matches(DESKTOP_FACE_MEDIA, v));
        expect({ beide: beide.slice(0, 5), keines: keines.slice(0, 5) }).toEqual({ beide: [], keines: [] });
    });

    it('stimmt mit der JavaScript-Entscheidung überein', () => {
        const abweichungen = RASTER.filter(
            (v) => (matches(PHONE_FACE_MEDIA, v) ? 'phone' : 'desktop') !== faceFor(v)
        );
        expect(abweichungen.slice(0, 5)).toEqual([]);
    });

    it('schickt jedes Tablet an eine der beiden Oberflächen – hochkant mobil, quer Schreibtisch', () => {
        for (const tablet of TABLETS_HOCHKANT) expect(faceFor(tablet)).toBe('phone');
        for (const tablet of TABLETS_QUER) expect(faceFor(tablet)).toBe('desktop');
    });
});

describe('Kein drittes Gesicht im CSS', () => {
    const alle = STYLESHEETS.flatMap((file) => preludes(read(file)).map((prelude) => ({ file, prelude })));

    it('findet überhaupt Medienabfragen (sonst prüft der Rest nichts)', () => {
        expect(alle.length).toBeGreaterThan(15);
    });

    it('kennt keine Abfrage, die nur ein Tablet trifft', () => {
        // Die konkrete Vorlage, die es nicht geben darf: „769 bis 1200 Pixel im
        // Hochformat". Allgemeiner: alles, was ein Tablet erwischt, ohne das
        // Referenzgerät desselben Gesichts zu erwischen.
        const eigenbroetler = alle.filter(({ prelude }) => {
            if (!isGeometrisch(prelude)) return false;
            const hochkantNurTablet = TABLETS_HOCHKANT.some((t) => matches(prelude, t)) && !matches(prelude, HANDY);
            const querNurTablet = TABLETS_QUER.some((t) => matches(prelude, t)) && !matches(prelude, SCHREIBTISCH);
            return hochkantNurTablet || querNurTablet;
        });
        expect(eigenbroetler).toEqual([]);
    });

    it('lässt keine Abfrage über die Gesichtsgrenze hinweggreifen', () => {
        // Eine Abfrage, die Fenster aus beiden Gesichtern trifft, legt
        // Touransicht- und Schreibtisch-Regeln übereinander. Genau daran ist
        // „ab 769px quer" gescheitert: Ein Handy quer (880×500) traf es mit.
        const straddler = alle.filter(({ prelude }) => {
            if (!isGeometrisch(prelude)) return false;
            const treffer = RASTER.filter((v) => matches(prelude, v));
            const gesichter = new Set(treffer.map((v) => faceFor(v)));
            return gesichter.size > 1;
        });
        expect(straddler).toEqual([]);
    });

    it('benutzt für Gesichtsfragen die beiden Listen wortgleich', () => {
        // Wer eine Schwelle des Gesichts anfasst, muss die ganze Liste
        // hinschreiben – eine halbe ist wieder eine eigene Grenze.
        const SCHWELLEN = /\b(768|769|900|901|1200|1201|520|521)px\b/;
        const eigenmaechtig = alle.filter(({ prelude }) => {
            if (!SCHWELLEN.test(prelude)) return false;
            if (prelude === PHONE_FACE_MEDIA || prelude === DESKTOP_FACE_MEDIA) return false;
            // Erlaubt ist, eine der Listen **weiter einzuschränken** (etwa auf
            // niedrige Fenster). Verboten ist, ihre Grenzen zu verschieben.
            const treffer = RASTER.filter((v) => matches(prelude, v));
            const phone = RASTER.filter((v) => matches(PHONE_FACE_MEDIA, v));
            const desktop = RASTER.filter((v) => matches(DESKTOP_FACE_MEDIA, v));
            const teilmenge = (a, b) => a.every((v) => b.includes(v));
            return !(teilmenge(treffer, phone) || teilmenge(treffer, desktop));
        });
        expect(eigenmaechtig).toEqual([]);
    });

    it('hält die beiden Listen in responsive.css im Wortlaut vor', () => {
        const css = read('src/styles/responsive.css');
        for (const liste of [PHONE_FACE_MEDIA, DESKTOP_FACE_MEDIA]) {
            for (const clause of liste.split(',').map((part) => part.trim())) {
                expect(css).toContain(clause);
            }
        }
    });

    it('hat den Tablet-Aufsatz restlos entfernt', () => {
        const css = read('src/styles/responsive.css');
        expect(css).not.toContain('(min-width: 769px) and (max-width: 1200px)');
        // Seine Sondermaße: eigene Blatt-Höhe, eigener Griff, eigene Knopfzeile.
        expect(css).not.toContain('--mobile-sheet-peek: 52px');
        expect(css).not.toContain('min(52dvh, 640px)');
        expect(css).not.toContain('--mobile-topnav-bottom');
    });
});

describe('Kein drittes Gesicht im JavaScript', () => {
    const QUELLEN = [
        'src/ui/sidebar.js', 'src/ui/tourPanel.js', 'src/features/map.js',
        'src/ui/firstSteps.js', 'src/ui/importWizard.js', 'src/ui/contractRadar.js',
        'src/ui/showcase.js', 'src/ui/lasso.js', 'src/main.js', 'src/core/state.js',
        'src/ui/planningViewport.js'
    ];

    // Eine eigene Schwelle **innerhalb** eines Gesichts ist erlaubt (etwa 560px
    // für kurze Beschriftungen): Sie trifft ein großes und ein kleines Handy
    // verschieden, so wie sie ein großes und ein kleines Tablet verschieden
    // trifft – das ist Textumbruch, kein zweites Produkt. Verboten ist, eine
    // der vier Gesichtsschwellen erneut hinzuschreiben oder die Haltung des
    // Geräts an einer zweiten Stelle auszuwerten.
    it.each(QUELLEN)('%s fragt das Gesicht, nicht die Pixel', (file) => {
        const source = read(file);
        expect(source).not.toMatch(/matchMedia\([^)]*\b(768|769|900|901|1200|1201|520|521)px/);
        expect(source).not.toMatch(/innerWidth\s*[<>]=?\s*(768|769|900|901|1200|1201)\b/);
        expect(source).not.toMatch(/matchMedia\([^)]*orientation/);
        expect(source).not.toMatch(/screen\.orientation\.(type|angle)/);
    });

    it('kennt nur einen Begriff für „Touransicht"', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain('function isMobileUi() {\n    return isPhoneUi();');
        expect(sidebar).toContain('export function isSheetUi() {\n    return isPhoneUi();');
        expect(sidebar).not.toContain('isPortraitTabletUi');
    });

    it('startet hochkant exakt wie das Handy – kein eigener Tablet-Einstieg', () => {
        const main = read('src/main.js');
        expect(main).toContain('const tourFace = isPhoneUi();');
        expect(main).toContain("state.ui.activeTab = state.customers.length === 0 ? 'daten' : 'tour';");
        expect(main).not.toContain('portraitTabletStartup');
    });

    it('nimmt der Touransicht überall denselben Funktionsumfang', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain("if (isMobileUi() || (mode === 'service' && state.ui.depth !== 'profi')) mode = 'aussendienst';");
        const tabInMode = sidebar.slice(sidebar.indexOf('function tabInMode'), sidebar.indexOf('function tabInMode') + 320);
        expect(tabInMode).toContain('if (isMobileUi())');
    });

    it('setzt beim Drehen die Darstellung zurück, aber nicht die Arbeit', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain('onFaceChange((face) => {');
        expect(sidebar).toContain("if (face === 'phone') applyDepth('basis', false);");
        const handler = sidebar.slice(sidebar.indexOf('onFaceChange((face) => {'), sidebar.indexOf('onFaceChange((face) => {') + 400);
        expect(handler).not.toContain('state.tour');
        expect(handler).not.toContain('setCustomers');
    });

    it('sperrt die installierte App nicht aufs Hochformat', () => {
        // Sonst wäre der Schreibtisch auf dem Tablet gar nicht erreichbar – die
        // Regel „quer ist Schreibtisch" braucht das Drehen.
        expect(read('vite.config.js')).not.toMatch(/^\s*orientation:/m);
        expect(read('src/core/viewport.js')).toContain('screen?.orientation?.unlock?.()');
        expect(read('src/main.js')).toContain('releaseInheritedOrientationLock();');
    });

    it('startet im Schreibtisch mit offenem Panel, in der Touransicht geschlossen', () => {
        expect(read('src/core/state.js')).toContain('sidebarOpen: !isPhoneUi()');
    });

    it('bedient den Griff überall gleich: ziehen ändert die Höhe', () => {
        const sidebar = read('src/ui/sidebar.js');
        expect(sidebar).toContain("mode = (!isSheetUi() && Math.abs(dx) > Math.abs(dy)) ? 'move' : 'resize';");
        expect(sidebar).toContain("if (mode === 'resize' && isSheetUi() && !state.ui.sidebarOpen) {");
        expect(sidebar).toContain('if (!sidebar || !pos || isSheetUi()) return;');
    });
});
