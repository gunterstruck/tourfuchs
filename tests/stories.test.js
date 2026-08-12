import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORIES, CRITICAL_SELECTORS, visibleStories, visibleStorySteps, prepareShowcaseTour, selectShowcaseTour } from '../src/features/stories.js';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const showcaseSource = readFileSync(resolve(process.cwd(), 'src/ui/showcase.js'), 'utf8');
const doc = new DOMParser().parseFromString(html, 'text/html');

describe('Showcase-Stories: Guardrail', () => {
    it('alle kritischen Selektoren existieren in index.html', () => {
        const missing = CRITICAL_SELECTORS.filter((sel) => !doc.querySelector(sel));
        expect(missing).toEqual([]);
    });

    it('Showcase-Dialog ist im Markup vorhanden', () => {
        expect(doc.querySelector('#showcase-dialog')).not.toBeNull();
        expect(doc.querySelector('#btn-showcase')).not.toBeNull();
    });

    it('jede Story hat Id, Titel und Schritte; run-Schritte referenzieren einen Key', () => {
        const ids = new Set();
        for (const s of STORIES) {
            expect(s.id).toBeTruthy();
            expect(ids.has(s.id)).toBe(false);
            ids.add(s.id);
            expect(s.title).toBeTruthy();
            expect(s.duration).toBeGreaterThanOrEqual(15);
            expect(Array.isArray(s.steps) && s.steps.length > 0).toBe(true);
            for (const step of s.steps) {
                expect(typeof step.t).toBe('string');
                if (step.t === 'run') expect(step.key).toBeTruthy();
                if (step.t === 'say') expect(step.text).toBeTruthy();
            }
        }
    });

    it('jeder run-Schritt hat einen Helfer in der Engine', () => {
        // Ein Tippfehler im Key fällt sonst erst mitten in der Vorführung auf –
        // dann bricht die Demo vor Publikum mit „Demo-Schritt ist nicht
        // definiert" ab.
        const helpers = new Set([...showcaseSource.matchAll(/^\s{4}async (\w+)\(/gm)].map((m) => m[1]));
        const missing = [];
        for (const story of STORIES) {
            for (const step of story.steps) {
                if (step.t === 'run' && !helpers.has(step.key)) missing.push(`${story.id}: ${step.key}`);
            }
        }
        expect(missing).toEqual([]);
    });

    it('führt den Einfüge-Weg vor, ohne echte Daten anzufassen', () => {
        const mapStory = STORIES.find((story) => story.id === 'excel-karte');
        const keys = mapStory.steps.filter((step) => step.t === 'run').map((step) => step.key);
        expect(keys).toContain('openPasteDemo');
        expect(keys).toContain('pasteDemoTable');
        expect(keys).toContain('closePasteDemo');
        // Reihenfolge: öffnen -> einfügen -> schließen -> erst dann Beispieldaten
        expect(keys.indexOf('openPasteDemo')).toBeLessThan(keys.indexOf('pasteDemoTable'));
        expect(keys.indexOf('pasteDemoTable')).toBeLessThan(keys.indexOf('closePasteDemo'));
        expect(keys.indexOf('closePasteDemo')).toBeLessThan(keys.indexOf('excelToMap'));

        // Am Handy ist die Liste selten in einer Tabellen-App offen
        const mobileKeys = visibleStorySteps(mapStory, { isDesktop: false })
            .filter((step) => step.t === 'run').map((step) => step.key);
        expect(mobileKeys).not.toContain('openPasteDemo');
        expect(mobileKeys).toContain('excelToMap');

        // Die Vorführung importiert nichts und nimmt die Bestätigung zurück
        const pasteBlock = showcaseSource.slice(showcaseSource.indexOf('async openPasteDemo()'), showcaseSource.indexOf('async excelToMap()'));
        expect(pasteBlock).not.toContain('confirmImport');
        expect(pasteBlock).not.toContain('replaceCustomers');
        expect(pasteBlock).toContain('pasteDemoConsent = document.querySelector');
        // Die Demo zeigt denselben Weg wie der echte Nutzer: Weg wählen,
        // dann den Bestätigungsschritt quittieren.
        expect(pasteBlock).toContain("clickEl('#consent-confirm')");
        expect(pasteBlock).toContain('restorePasteDemoConsent();');
        // Auch ein Abbruch darf nichts offen oder bestätigt zurücklassen
        const cleanup = showcaseSource.slice(showcaseSource.indexOf('// Weitere Overlays schließen'));
        expect(cleanup).toContain('restorePasteDemoConsent();');
        expect(cleanup).toContain("document.getElementById('paste-dialog')");
    });

    it('führt die Karten-Demo sichtbar vom Kundenstapel bis zum Popup', () => {
        const mapStory = STORIES.find((story) => story.id === 'excel-karte');
        expect(mapStory.steps.some((step) => step.sel === '.customer-stack-card')).toBe(true);
        // Zoom-Beat und Popup-Öffnung sind getrennte Phasen mit eigener
        // Erzählung: erst die Kundenkacheln würdigen, dann die Kundenkarte.
        expect(mapStory.steps.some((step) => step.key === 'zoomToCustomerCards')).toBe(true);
        expect(mapStory.steps.some((step) => step.key === 'openCustomerCard')).toBe(true);
        expect(mapStory.steps.some((step) => step.sel === '.customer-marker-card')).toBe(true);
        expect(mapStory.steps.at(-1)?.sel).toBe('.leaflet-popup-content');
        expect(mapStory.minRuntimeMs).toBe(15000);
        expect(showcaseSource).toContain("await clickEl('.customer-stack-card')");
        expect(showcaseSource).toContain("await clickEl('.customer-marker-card')");
        expect(showcaseSource).toContain("emit('showcase:story-completed', story.id)");
    });

    it('lässt den Menschen sichtbar aussuchen, statt die Tour zu füllen', () => {
        // Gemeldet vom Handy: In der Tour-Demo sieht man nur, dass sich „Meine
        // Tour" füllt – nicht, dass jemand die Vorschläge durchsieht und einen
        // Kunden aussucht. Ursache war eine Abkürzung: Die Suche nach dem „+"
        // gab nach 250 ms auf und schrieb den Stopp still in den Zustand. Da
        // der Schritt „Vorschläge" in der Übersicht zugeklappt ist, war das „+"
        // zu dem Zeitpunkt nie sichtbar – die Abkürzung war der Normalfall.
        //
        // Das ist nicht bloß unschön: Der automatische Tourvorschlag wurde am
        // 10.07.2026 nach Nutzerfeedback gestrichen („die Tour plant der
        // Mensch"). Eine Vorführung, die das Aussuchen unterschlägt, wirbt für
        // genau das gestrichene Feature.
        const tour = STORIES.find((story) => story.id === 'tour');
        const keys = tour.steps.filter((step) => step.t === 'run').map((step) => step.key);
        expect(keys).toContain('showSuggestions');
        expect(keys.indexOf('showSuggestions')).toBeLessThan(keys.indexOf('addTwoSuggestions'));
        // Die Vorschlagsliste wird benannt, bevor ausgesucht wird.
        expect(tour.steps.some((step) => step.sel === '#tour-suggestions')).toBe(true);

        const block = showcaseSource.slice(showcaseSource.indexOf('async addSuggestions('),
            showcaseSource.indexOf('async focusTourRoute('));
        // Erst öffnen, dann sichtbar auf das „+" der Zeile.
        expect(block).toContain("await HELPERS.showSuggestions()");
        expect(block).toContain("await clickEl(selektor)");
        // Der stille Weg ist der Notnagel, nicht der erste Versuch: Er steht
        // hinter dem Klick, und die Suche wartet 2,5 s statt 250 ms.
        expect(block).toContain('2500');
        expect(block).not.toContain(', 250)');
        expect(block.indexOf('await clickEl(selektor)')).toBeLessThan(block.indexOf('state.tour.stops.push'));
    });

    it('klopft nicht auf einen Stapel ein, der sich nicht öffnet', () => {
        // Gemeldet vom Handy: Der Cursor tippt viermal auf denselben Stapel und
        // es tut sich nichts. Wie viele Ebenen nötig sind, hängt am Bestand und
        // am Gerät (mobil bündelt die Karte mit bis zu 124 px statt 104) – eine
        // feste Zahl ist deshalb eine Wette. Jetzt entscheidet die Wirkung.
        const block = showcaseSource.slice(showcaseSource.indexOf('async zoomToCustomerCards()'),
            showcaseSource.indexOf('async openCustomerCard()'));
        expect(block).toContain('const vorher = mapSignature();');
        expect(block).toContain('ohneWirkung = mapSignature() === vorher ? ohneWirkung + 1 : 0;');
        expect(block).toContain('ohneWirkung < 2');
        // Und die Zusage wird auch dann eingelöst, wenn der Bestand ein Stapel
        // bleibt: mit einem Flug auf einen einzelnen Kunden.
        expect(block).toContain("if (!await resolveEl('.customer-marker-card', 350)) await HELPERS.showOneCustomer();");
    });

    it('schlägt unmittelbar vor dem Klick noch einmal nach', () => {
        // Zwischen Anvisieren und Klick liegt der Weg des Cursors. Leaflet baut
        // Kundenstapel bei jeder Bewegung neu auf – der gemerkte Knoten hängt
        // dann nicht mehr im Dokument, und der Klick geht lautlos ins Leere.
        const block = showcaseSource.slice(showcaseSource.indexOf('async function clickEl('),
            showcaseSource.indexOf('async function typeInto('));
        expect(block).toContain('const frisch = document.querySelector(sel);');
        expect(block).toContain('(frisch && isVisible(frisch) ? frisch : el).click();');
    });

    it('zählt den Tourprozess in jeder Tiefe als drei Stufen', () => {
        // „1. Startpunkt · 3. Vorschläge · 4. Meine Tour" ließ in der Übersicht
        // eine Lücke: Die 2 lag im Startpunkt-Block und war zugeklappt nicht zu
        // sehen. Das optionale Ziel ist eine Beigabe zu Schritt 1, keine Stufe.
        const panel = readFileSync(resolve(process.cwd(), 'src/ui/tourPanel.js'), 'utf8');
        expect(panel).toContain("sh.textContent = '2. Vorschläge'");
        expect(panel).toContain("mh.textContent = '3. Meine Tour'");
        expect(panel).not.toContain("'3. Vorschläge'");
        expect(panel).not.toContain("'4. Meine Tour'");
        expect(html).toContain('<h3>Ziel <span class="muted small">(optional)</span>');
    });

    it('die Stories in fester Reihenfolge', () => {
        expect(STORIES.map((s) => s.id)).toEqual(['excel-karte', 'lasso', 'tour', 'handy-qr', 'simulation', 'service-tag', 'chancen', 'tresor', 'empfang']);
    });

    it('am Desktop entfällt die mobile-only Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: true }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'lasso', 'tour', 'handy-qr', 'simulation', 'service-tag', 'chancen', 'tresor']);
        expect(ids).not.toContain('empfang');
    });

    it('am Smartphone entfallen die desktop-only Stories, dafür kommt die Empfangs-Story', () => {
        const ids = visibleStories({ isDesktop: false }).map((s) => s.id);
        expect(ids).toEqual(['excel-karte', 'lasso', 'tour', 'chancen', 'tresor', 'empfang']);
        expect(ids).not.toContain('handy-qr');
        expect(ids).not.toContain('simulation');
        expect(ids).not.toContain('service-tag');
    });

    it('die Service-Demo nutzt nur existierende Engine-Helfer', () => {
        const serviceStory = STORIES.find((story) => story.id === 'service-tag');
        const runKeys = serviceStory.steps.filter((step) => step.t === 'run').map((step) => step.key);
        for (const key of runKeys) {
            expect(showcaseSource, `Helfer fehlt: ${key}`).toContain(`async ${key}(`);
        }
    });

    it('die Tour-Demo endet ohne QR-Dopplung – der Desktop bekommt den Cliffhanger', () => {
        // Die QR-Übergabe hat ihre eigene Demo (handy-qr); in der Tour-Demo
        // gäbe sie das Finale doppelt. Der Desktop verweist stattdessen auf
        // die nächste Demo, das Handy endet mit der stehenden Route.
        const tour = STORIES.find((story) => story.id === 'tour');
        const desktopSteps = visibleStorySteps(tour, { isDesktop: true });
        const mobileSteps = visibleStorySteps(tour, { isDesktop: false });

        expect(desktopSteps.some((step) => step.key === 'shareTourQr')).toBe(false);
        expect(desktopSteps.at(-1)?.text).toContain('nächste Demo');
        expect(mobileSteps.some((step) => step.sel === '#qr-share-canvas')).toBe(false);
        expect(mobileSteps.at(-1)?.text).toContain('Reihenfolge und Strecke');
    });

    it('blendet die QR-Übergabe-Taste im mobilen View aus', () => {
        expect(doc.querySelector('#btn-tour-qr')?.classList.contains('only-desktop')).toBe(true);
    });

    it('Tour-Vorführungen starten unabhängig von einer vorhandenen Tour', () => {
        const current = {
            bezirk: 'Nord',
            start: { lat: 51, lng: 7 },
            destination: { lat: 48, lng: 11 },
            stops: ['a', 'b'],
            radiusKm: 5,
            roundTrip: true,
            suggestMode: 'route',
            mapFocus: true,
            routeLineMode: 'road',
            customSetting: 'bleibt'
        };

        expect(prepareShowcaseTour(current)).toEqual({
            ...current,
            bezirk: null,
            start: null,
            destination: null,
            stops: [],
            radiusKm: 50,
            roundTrip: false,
            suggestMode: 'radius',
            mapFocus: false,
            routeLineMode: 'air'
        });
        expect(current.destination).toEqual({ lat: 48, lng: 11 });
    });

    it('Tour- und Tresor-Story enthalten die sichtbaren Abschlussmomente', () => {
        const tour = STORIES.find((story) => story.id === 'tour');
        const vault = STORIES.find((story) => story.id === 'tresor');
        expect(tour.steps.some((step) => step.t === 'run' && step.key === 'focusTourRoute')).toBe(true);
        expect(vault.steps.some((step) => step.t === 'say' && step.sel === '#recovery-code')).toBe(true);
    });

    it('schaltet die Straßenroute über den sichtbaren Karten-Umschalter (nicht den im Handy-Blatt versteckten Knopf)', () => {
        // Nach dem Kartenfokus verschwindet #btn-route-focus im eingeklappten
        // Handy-Blatt; der Umschalter liegt dann als Leiste über der Karte
        // (#btn-route-mode) und muss dort geklickt werden, sonst bleibt Luftlinie.
        const road = showcaseSource.slice(showcaseSource.indexOf('async showRoadRoute('));
        expect(road.slice(0, 900)).toContain("clickEl('#btn-route-mode')");
        const tour = STORIES.find((story) => story.id === 'tour');
        const roadSay = tour.steps.find((s) => s.t === 'say' && /Straßenroute/.test(s.text) && s.sel);
        expect(roadSay?.sel).toBe('#btn-route-mode');
    });

    it('wechselt vor dem Optimieren auf den Schritt „Meine Tour" (Desktop-Fokus blendet ihn sonst aus)', () => {
        const tour = STORIES.find((story) => story.id === 'tour');
        const keys = tour.steps.map((s) => s.key);
        const idxShowMyTour = tour.steps.findIndex((s) => s.key === 'showMyTour');
        const idxOptimize = tour.steps.findIndex((s) => s.sel === '#btn-optimize' && s.t === 'click');
        expect(idxShowMyTour).toBeGreaterThan(-1);
        // „Meine Tour" muss VOR dem Optimieren-Klick aktiviert werden.
        expect(idxShowMyTour).toBeLessThan(idxOptimize);
        // Der Helfer existiert in der Engine.
        expect(showcaseSource).toContain('async showMyTour(');
        expect(keys).toContain('addTwoSuggestions');
    });

    it('öffnet native Dialoge in Demos zuverlässig und erklärt einen Abbruch konkret', () => {
        const handy = STORIES.find((story) => story.id === 'handy-qr');
        expect(handy.steps.some((step) => step.key === 'shareTourQr')).toBe(true);
        // Der QR-Knopf liegt im Schritt „Meine Tour"; shareTourQr aktiviert ihn,
        // sonst blendet der Desktop-Fokus ihn aus (QR-Übergabe nicht erreichbar).
        const share = showcaseSource.slice(showcaseSource.indexOf('async shareTourQr('));
        expect(share.slice(0, 400)).toContain('showMyTour()');
        expect(showcaseSource).toContain("el.matches?.('dialog[open]')");
        expect(showcaseSource).toContain('Hängengeblieben bei Schritt');
        expect(showcaseSource).toContain('showStoryFailure(story, failure)');
    });

    it('hält die Sprechblase ganz im Bild – auch in einem hohen Dialog', () => {
        // Befund beim Drehen des Films (1280×720): Der Satz zum Prompt stand zur
        // Hälfte unter dem Bildrand. Zwei Ursachen, beide hier abgesichert.
        //
        // 1. Die Blase hängt während eines Dialogschritts IM Dialog, und ein
        //    offener Dialog trägt durch seine Einblendung ein transform –
        //    „fixed" bezieht sich dann auf ihn, nicht auf den Viewport. Der
        //    Cursor rechnete das immer heraus, die Blase nicht.
        // 2. Geklammert war nur die obere Kante (`Math.max(58, y)`); wie tief
        //    die Blase unten hinausragt, prüfte niemand.
        //
        // In einer Vorführung, deren Blasen die Untertitel sind, ist ein
        // abgeschnittener Satz kein Schönheitsfehler.
        expect(showcaseSource).toContain('function fixedFrame(');
        const cursor = showcaseSource.slice(showcaseSource.indexOf('function placeCursor('),
            showcaseSource.indexOf('async function moveTo('));
        expect(cursor).toContain('fixedFrame(cursorEl)');

        const bubble = showcaseSource.slice(showcaseSource.indexOf('async function say('),
            showcaseSource.indexOf('function hideBubble('));
        expect(bubble).toContain('fixedFrame(bubbleEl)');
        // Der sichtbare Bereich ist der Dialog, wenn die Blase in ihm hängt.
        expect(bubble).toContain('box.bottom - bh');
        expect(bubble).toContain('box.right - bw');
        // Gemessen wird NACH dem Umhängen, sonst klammert man gegen eine
        // Höhe, die nicht mehr gilt.
        expect(bubble.indexOf('moveOverlaysInto(layerFor(anchor))'))
            .toBeLessThan(bubble.indexOf('const bh = bubbleEl.offsetHeight;'));
        // Der alte, nur nach oben klammernde Ausdruck darf nicht zurückkehren.
        expect(bubble).not.toContain('`${Math.max(58, y)}px`');
    });

    it('zeigt die Lasso-Demo den ganzen Bogen: umfahren, briefen, entscheiden', () => {
        // Das Hauptargument des Produkts sind zwei Hälften: die Geste UND der
        // Prompt, den man in eine KI seiner Wahl trägt. Eine Vorführung, die
        // nach der Auswahlkarte aufhört, zeigt die hübsche Hälfte und lässt die
        // neue weg. Der Rückweg gehört dazu: Erst „welche zwei nehme ich
        // wirklich mit?" macht aus dem Briefing eine Entscheidung.
        const lasso = STORIES.find((story) => story.id === 'lasso');
        const keys = lasso.steps.filter((step) => step.t === 'run').map((step) => step.key);

        expect(keys).toContain('drawLasso');
        expect(keys).toContain('openLassoBriefing');
        expect(keys).toContain('revealAreaPrompt');
        expect(keys).toContain('pickLassoCustomers');
        expect(keys).toContain('lassoPickedToTour');
        // Reihenfolge: ziehen -> briefen -> Prompt zeigen -> zurück -> aussuchen
        expect(keys.indexOf('drawLasso')).toBeLessThan(keys.indexOf('openLassoBriefing'));
        expect(keys.indexOf('openLassoBriefing')).toBeLessThan(keys.indexOf('revealAreaPrompt'));
        expect(keys.indexOf('revealAreaPrompt')).toBeLessThan(keys.indexOf('closeLassoBriefing'));
        expect(keys.indexOf('closeLassoBriefing')).toBeLessThan(keys.indexOf('pickLassoCustomers'));
        expect(keys.indexOf('pickLassoCustomers')).toBeLessThan(keys.indexOf('lassoPickedToTour'));

        // Die Demo nimmt Kunden in die Tour auf – also muss sie den Tourzustand
        // sichern und zurückgeben.
        expect(lasso.mutatesTour).toBe(true);
    });

    it('sagt beim Briefing die Wahrheit – je nach Datenlage einen anderen Satz', () => {
        // Mit Beispielkunden baut TourFuchs bewusst keinen Prompt; mit eigenen
        // Kunden steht er vollständig da. Ein Satz für beide Fälle wäre in
        // einem der beiden gelogen – und ausgerechnet der Fall mit echten Daten
        // ist der, den man filmt (docs/film-lasso-briefing.md).
        const lasso = STORIES.find((story) => story.id === 'lasso');
        const mitDaten = visibleStorySteps(lasso, { hasOwnData: true });
        const ohneDaten = visibleStorySteps(lasso, { hasOwnData: false });

        // Die Demo-Sperre wird nur ohne eigene Daten erklärt …
        expect(ohneDaten.some((step) => /Für Beispielkunden/.test(step.text || ''))).toBe(true);
        expect(mitDaten.some((step) => /Für Beispielkunden/.test(step.text || ''))).toBe(false);
        // … und der echte Prompt nur mit.
        expect(mitDaten.some((step) => step.key === 'revealAreaPrompt')).toBe(true);
        expect(ohneDaten.some((step) => step.key === 'revealAreaPrompt')).toBe(false);
        expect(mitDaten.some((step) => /Zwischenablage/.test(step.text || ''))).toBe(true);

        // Der Rückweg gehört in beide Fassungen: Aussuchen kann man immer.
        for (const steps of [mitDaten, ohneDaten]) {
            expect(steps.some((step) => step.key === 'lassoPickedToTour')).toBe(true);
        }
    });

    it('lässt die Auswahl für den Rückweg liegen, statt sie mit dem Dialog wegzuräumen', () => {
        // „Zurück auf der Karte liegt deine Auswahl noch genau so da" ist die
        // zugesagte Eigenschaft des Lassos – und der letzte Beat der Demo.
        // Räumte closeLassoBriefing die Auswahl weg, spräche der nächste Satz
        // über eine Karte, die nicht mehr da ist.
        const start = showcaseSource.indexOf('async closeLassoBriefing()');
        const helper = showcaseSource.slice(start, showcaseSource.indexOf('async pickLassoCustomers(', start));
        expect(helper).not.toContain('clearLassoSelection()');
        // Aufgeräumt wird trotzdem – am Ende, auch bei Abbruch.
        const cleanup = showcaseSource.slice(showcaseSource.indexOf('// Weitere Overlays schließen'));
        expect(cleanup).toContain('clearLassoSelection();');
    });

    it('verbindet die Kundenauswahl mit einem sicheren Copilot-Briefing', () => {
        const briefing = STORIES.find((story) => story.id === 'chancen');

        expect(briefing.title).toContain('Sofort gebrieft');
        expect(briefing.steps.some((step) => step.key === 'openCustomerBriefing')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '.briefing-demo-preview')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '.briefing-demo-note')).toBe(true);
        expect(briefing.steps.some((step) => step.sel === '[data-briefing-fallback]')).toBe(false);
        expect(briefing.steps.some((step) => step.key === 'closeCustomerBriefing')).toBe(true);
        expect(briefing.steps.some((step) => step.key === 'checkVisit')).toBe(false);
    });

    it('erkennt das geöffnete native Briefing-Dialogfenster zuverlässig', () => {
        const start = showcaseSource.indexOf('async openCustomerBriefing()');
        const end = showcaseSource.indexOf('async closeCustomerBriefing()', start);
        const helper = showcaseSource.slice(start, end);

        expect(helper).toContain("document.getElementById('customer-briefing-dialog')");
        expect(helper).toContain('briefing?.open');
        expect(helper).not.toContain("resolveEl('#customer-briefing-dialog[open]'");
    });

    it('wählt für die Tour-Demo getrennte Kunden quer durchs Ruhrgebiet', () => {
        const customers = [
            { id: 'start', name: 'Start Oberhausen', lat: 51.47, lng: 6.85 },
            { id: 'duplicate', name: 'Gleiche PLZ', lat: 51.47, lng: 6.85 },
            { id: 'essen', name: 'Kunde Essen', lat: 51.45, lng: 7.02 },
            { id: 'bochum', name: 'Kunde Bochum', lat: 51.48, lng: 7.22 },
            { id: 'dortmund', name: 'Kunde Dortmund', lat: 51.50, lng: 7.40 },
            { id: 'berlin', name: 'Kunde Berlin', lat: 52.52, lng: 13.40 }
        ];

        const plan = selectShowcaseTour(customers);
        expect(plan.start.id).toBe('start');
        expect(plan.stops.map((c) => c.id)).toEqual(['essen', 'dortmund']);
        expect(plan.stops.map((c) => c.id)).not.toContain('duplicate');
        expect(plan.inRuhr).toBe(true);
    });
});
