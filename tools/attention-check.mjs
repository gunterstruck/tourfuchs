/**
 * Prüfstrecke für die Aufmerksamkeit.
 *
 * Warum es dieses Werkzeug zusätzlich zu `demo-check`, `touch-check` und
 * `face-check` gibt: Alle drei prüfen, ob die App **funktioniert** – Abläufe
 * laufen durch, Gesten wirken, das richtige Gesicht erscheint. Keines prüft,
 * wie viel die App im selben Moment **verlangt**.
 *
 * Der Anlass ist ein Produkt-Review, das den Tour-Reiter als überladen
 * bezeichnete – gestützt auf 105 Knöpfe im Quelltext von `index.html`. Gezählt
 * war damit Markup, nicht Oberfläche: Der Tourplaner klappt seine drei Schritte
 * ein, das meiste davon ist im Erst-Zustand gar nicht da. Der Befund war falsch,
 * aber die Frage war richtig – und sie war schlicht unbeantwortbar, weil niemand
 * die sichtbare Last je gemessen hat.
 *
 * Genau das tut dieses Werkzeug. Es befragt die **gebaute App im echten
 * Browser** an echten Gerätemaßen und zählt, was ein Mensch tatsächlich vor
 * sich hat:
 *
 *   **Wie viele Bedienelemente verlangt eine Ansicht im Erst-Zustand?**
 *
 * Die teuerste Zahl ist dabei das **Erstbild** – was ohne einen einzigen Klick
 * im Fenster steht. Sie trifft jeden Nutzer, bevor er irgendetwas gelernt hat,
 * und sie hat den ersten echten Befund geliefert: Am Schreibtisch standen dort
 * drei Angebote gleichzeitig, die dieselbe Frage beantworteten – zwei davon mit
 * demselben Knopf („📂 Eigene Daten laden"). Jedes für sich war richtig, erst
 * zusammen wurden sie zum Stapel. Aus dem Stapel ist eine Reihenfolge geworden.
 *
 * Dazu zwei Regeln aus `docs/gestaltprinzip-aufmerksamkeit.md`, die ohne
 * Messung reine Behauptung bleiben:
 *
 *   **Die Übersicht zeigt den Prozess, nicht die Inhalte.**  Im Tour-Reiter
 *   darf im Erst-Zustand kein Schritt-Inhalt offen liegen – nur die drei Köpfe.
 *
 *   **Verdrängung ist umkehrbar.**  Wo die App Chrome wegnimmt (Fokus-Modus),
 *   muss der sichtbare Rückweg im selben Bild stehen.
 *
 * Die Budgets unten sind keine Wunschzahlen, sondern der gemessene Ist-Stand
 * plus Luft. Sie sind ein **Sperrklinken-Werkzeug**: Sie verbieten nichts, was
 * heute da ist, aber sie machen jedes weitere Anwachsen sichtbar, statt es über
 * Monate unbemerkt geschehen zu lassen. Wer ein Budget hebt, trifft damit eine
 * bewusste Produktentscheidung – und genau darum geht es.
 *
 * Ausgeführt wird gegen `dist/` – also vorher `npm run build`.
 *
 * Aufruf:
 *   npm run attention-check
 *   npm run attention-check -- --format=desktop
 *   npm run attention-check -- --frei     (nur messen, keine Budgets prüfen)
 *
 * Voraussetzung wie bei den anderen Strecken (bewusst nicht in package.json,
 * damit ein normales `npm install` schlank bleibt):
 *   npm i -D playwright && npx playwright install chromium
 *
 * Als einzige der vier Strecken läuft diese **in der CI** (Job `attention` in
 * .github/workflows/ci.yml). Der Grund steht dort: Ihr Gegner ist schleichendes
 * Anwachsen, und dagegen hilft kein Tor, das erst vor dem Release gezogen wird.
 *
 * In Umgebungen mit vorhandenem Browser:
 *   PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome npm run attention-check
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

/**
 * Zwei Maße genügen: das Blatt (Handy) und die Seitenleiste (Schreibtisch).
 * `erstbild` ist das Budget für das allererste Bild – dort ist die Zahl am
 * teuersten, weil sie jeden Nutzer trifft, bevor er irgendetwas gelernt hat.
 */
const FORMATS = [
    {
        name: 'smartphone',
        viewport: { width: 390, height: 844 },
        touch: true,
        erstbildBudget: 20,
        // Mobil gibt es genau einen Bereich (Tour) – gemessen je Tiefe.
        // Der zweite Reiter „Karte" war nie ein Bereich, sondern ein
        // Blatt-Schalter; mit ihm fiel auch seine Messung weg.
        erwarteteMessungen: 2
    },
    {
        name: 'desktop',
        viewport: { width: 1440, height: 900 },
        touch: false,
        erstbildBudget: 36,
        // Basis/Profi im Außendienst (je Daten, Filter, Tour) plus das bewusst
        // aktivierte Gebietsmodul in Profi (Daten, Filter, Gebiete).
        erwarteteMessungen: 9
    }
];

/**
 * Budgets für sichtbare Bedienelemente im Erst-Zustand eines Reiters.
 *
 * Gelesen als: „So viel darf diese Ansicht verlangen, bevor jemand hinsehen
 * muss." Getrennt nach Tiefe, weil Profi ausdrücklich mehr zeigen darf – aber
 * eben auch nicht beliebig viel mehr.
 *
 * Die Zahlen sind der gemessene Stand vom 01.08.2026 plus wenig Luft, nicht ein
 * Wunsch. Der Reiter „karte" ist samt Budget entfallen; sein Inhalt („In der
 * Nähe") steht jetzt als eingeklappte Karte im Tour-Reiter und kostet dort
 * genau den Knopf, den „Was ist in meiner Nähe?" vorher kostete – das Budget
 * für „tour" bleibt deshalb unverändert.
 *
 * Gebietsplanung und Service sind optionale Profi-Module. Diese Strecke misst
 * den fokussierten Standardzustand und aktiviert danach gezielt nur die
 * Gebietsplanung. Service bleibt unverändert separat: Die Budgets stehen
 * trotzdem, damit seine Reiter nicht ohne Maß dastehen.
 */
const BUDGET = {
    basis: { daten: 12, team: 14, gebiete: 8, tour: 10, vertraege: 16, einsaetze: 16 },
    profi: { daten: 12, team: 14, gebiete: 8, tour: 12, vertraege: 20, einsaetze: 20 }
};

/** Der Rahmen (Modus, Tiefe, Reiter, Kopfzeile) steht immer – auch er kostet. */
const BUDGET_RAHMEN = 12;

/**
 * Gezählt wird „was kann ich anfassen", nicht „wie viel Text steht da": Ein
 * erklärender Satz ist Orientierung, ein Knopf ist eine Entscheidung.
 *
 * Dafür zwei Maße, absichtlich verschieden:
 *
 * `sichtbar` – das Element ist da (nicht eingeklappt, nicht ausgeblendet).
 *   Damit wird gezählt, was ein Reiter **anbietet**. Bewusst ohne Fensterschnitt,
 *   sonst würde ein hoher Bildschirm dasselbe Panel besser aussehen lassen.
 *
 * `imFenster` – zusätzlich: liegt gerade im Bild. Nur fürs Erstbild, wo genau
 *   das die Frage ist: Was sieht ein Mensch, bevor er irgendetwas tut?
 */
const BEDIENBAR_JS = `
    const BEDIENBAR = 'button, a[href], input:not([type=hidden]), select, textarea, [role="button"], [role="tab"], [role="checkbox"]';

    // Kunden, Bündel und Gebiete auf der Karte sind **Inhalt**, nicht Bedienung.
    // Sie mitzuzählen hieße, der App die Landschaft als Last anzurechnen – und
    // ausgerechnet die soll ja da sein. Gezählt wird, was um sie herum steht.
    const INHALT = '.leaflet-pane';

    const sichtbar = (el) => {
        if (el.closest(INHALT)) return false;
        if (el.hidden || el.disabled) return false;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (Number(cs.opacity) === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };

    const imFenster = (el) => {
        if (!sichtbar(el)) return false;
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0
            && r.left < window.innerWidth && r.right > 0;
    };
`;

/**
 * Das Erstbild: alles, was ohne einen einzigen Klick im Fenster steht – samt
 * Herkunft. Die nackte Zahl sagt „zu viel", erst die Herkunft sagt „woher".
 */
const ERSTBILD_PROBE = `(() => {
    ${BEDIENBAR_JS}

    // Grobe, sprechende Zuordnung statt DOM-Pfade: Wer den Bericht liest, will
    // wissen, welcher Produktteil gerade Aufmerksamkeit verlangt.
    const BEREICHE = [
        ['Karte', '#map'],
        ['Panel', '#sidebar'],
        ['Erste Schritte', '#first-steps'],
        ['Beispieldaten-Hinweis', '.demo-banner, #demo-banner, .demo-note'],
        ['Führung/Showcase', '.showcase, #showcase, .story-layer'],
        ['Kopfzeile', 'header, .app-header']
    ];

    const herkunft = {};
    for (const el of [...document.querySelectorAll(BEDIENBAR)].filter(imFenster)) {
        const treffer = BEREICHE.find(([, sel]) => el.closest(sel));
        const name = treffer ? treffer[0] : 'Sonstiges';
        herkunft[name] = (herkunft[name] || 0) + 1;
    }

    return {
        bedienelemente: [...document.querySelectorAll(BEDIENBAR)].filter(imFenster).length,
        herkunft,
        blattOffen: document.body.classList.contains('sheet-open')
    };
})()`;

const PROBE = `(() => {
    ${BEDIENBAR_JS}

    const zaehle = (wurzel) => {
        if (!wurzel) return 0;
        return [...wurzel.querySelectorAll(BEDIENBAR)].filter(sichtbar).length;
    };

    const panel = document.querySelector('#sidebar .tab-panel.active');
    const rahmen = ['.mode-switch', '.depth-switch', '.tab-bar', '.app-header', 'header']
        .map((sel) => document.querySelector(sel))
        .filter((el, i, all) => el && all.indexOf(el) === i);

    return {
        reiter: panel ? panel.id.replace(/^tab-/, '') : null,
        bedienelemente: zaehle(panel),
        // Der Rahmen wird einmal gezählt, nicht je Reiter – er wechselt nicht mit.
        rahmen: rahmen.reduce((sum, el) => sum + zaehle(el), 0),
        // Übersicht heißt: die Köpfe stehen, die Inhalte nicht.
        offeneSchrittInhalte: [...document.querySelectorAll('#tab-tour .tour-acc .acc-body')]
            .filter(sichtbar).length,
        schrittKoepfe: [...document.querySelectorAll('#tab-tour .tour-acc .acc-head')]
            .filter(sichtbar).length,
        fokus: document.body.classList.contains('tour-focus'),
        rueckweg: [...document.querySelectorAll('#tour-stepper .tour-focus-exit')]
            .filter(sichtbar).length > 0
    };
})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function startPreview(port) {
    const child = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
        stdio: ['ignore', 'pipe', 'pipe']
    });
    for (let attempt = 0; attempt < 40; attempt++) {
        await sleep(500);
        try {
            const res = await fetch(`http://localhost:${port}/`);
            if (res.ok) return child;
        } catch { /* noch nicht bereit */ }
    }
    child.kill();
    throw new Error('Vorschau-Server ist nicht gestartet. Vorher `npm run build` ausführen?');
}

/**
 * Auf einen sichtbaren Schalter klicken; fehlt er, war der Zustand nicht
 * erreichbar.
 *
 * Zwei Anläufe, weil ein Wechsel von Tiefe oder Modus die Reiterleiste neu
 * aufbaut: Wer in genau diesem Moment klickt, trifft ein Element, das gerade
 * ersetzt wird. Das ist kein Befund über die Oberfläche, sondern ein Rennen mit
 * ihr – und es hat genau einmal zugeschlagen, als es zufällig auffiel.
 */
async function klicke(page, selektor, anlaeufe = 2) {
    for (let versuch = 1; versuch <= anlaeufe; versuch += 1) {
        const treffer = page.locator(selektor).first();
        if (await treffer.count() === 0) return false;
        if (await treffer.isVisible()) {
            try {
                // Kurzer Anlauf statt der 30-Sekunden-Vorgabe: Verdeckt ein
                // Overlay den Schalter, ist das ein Befund und keine Wartezeit.
                await treffer.click({ timeout: 4000 });
                await sleep(350);
                return true;
            } catch { /* gleich noch einmal */ }
        }
        if (versuch < anlaeufe) await sleep(500);
    }
    return false;
}

/** Einen Fokus wählen; der normale Außendienst kann bewusst ohne sichtbaren
 * Modusschalter aktiv sein und ist dann bereits das richtige Ergebnis. */
async function waehleModus(page, modus) {
    const selector = `.mode-btn[data-mode="${modus}"]`;
    const alreadyActive = await page.locator(selector).first().evaluate(
        (element) => element.classList.contains('active')
    ).catch(() => false);
    return alreadyActive || klicke(page, selector);
}

/** Das seltene Gebietsmodul für seine eigene Aufmerksamkeitsmessung aktivieren.
 * Der Erstzustand wurde zu diesem Zeitpunkt bereits unverändert gemessen. */
async function aktiviereGebietsmodul(page) {
    const checkbox = page.locator('#chk-territory-planning-enabled').first();
    if (await checkbox.isChecked().catch(() => false)) return true;
    const details = page.locator('#optional-modules').first();
    if (!await details.getAttribute('open')) await klicke(page, '#optional-modules summary');
    if (!await checkbox.isVisible()) return false;
    await checkbox.check({ timeout: 4000 });
    await sleep(350);
    return checkbox.isChecked();
}

/**
 * Einen Reiter öffnen und das **Ergebnis** abwarten, nicht den Klick.
 *
 * „Geklickt" ist die schwächere Aussage: Der Klick kann durchgehen, während die
 * Leiste noch umbaut, und gemessen würde dann der vorige Reiter – oder gar
 * keiner. Erst „dieses Panel ist aktiv" ist der Zustand, den die Messung
 * braucht.
 */
async function oeffneReiter(page, reiter) {
    // Mobil gibt es keine Reiterleiste mehr (ein Bereich braucht keine). Ist der
    // gesuchte Reiter bereits das aktive Panel, gibt es nichts zu klicken – das
    // ist kein Fehlschlag, sondern der Normalfall am Handy.
    const schonAktiv = await page.evaluate(
        (id) => document.querySelector('#sidebar .tab-panel.active')?.id === `tab-${id}`,
        reiter
    );
    if (schonAktiv) return true;
    if (!await klicke(page, `.tab-button[data-tab="${reiter}"]`)) return false;
    try {
        await page.waitForFunction(
            (id) => document.querySelector('#sidebar .tab-panel.active')?.id === `tab-${id}`,
            reiter,
            { timeout: 5000 }
        );
        return true;
    } catch {
        return false;
    }
}

/**
 * Welche Bereiche stehen gerade zur Wahl?
 *
 * Am Schreibtisch ist das die Reiterleiste. Am Handy gibt es sie nicht mehr –
 * dort ist der eine offene Bereich das, was gemessen werden muss. Wer hier nur
 * Reiter zählte, bekäme eine leere Liste und damit einen grünen Lauf, der
 * nichts gemessen hat.
 */
async function offeneReiter(page) {
    return page.evaluate(() => {
        const reiter = [...document.querySelectorAll('.tab-button')]
            .filter((b) => {
                if (b.hidden) return false;
                const cs = getComputedStyle(b);
                return cs.display !== 'none' && cs.visibility !== 'hidden';
            })
            .map((b) => b.dataset.tab);
        if (reiter.length) return reiter;
        const aktiv = document.querySelector('#sidebar .tab-panel.active');
        return aktiv ? [aktiv.id.replace(/^tab-/, '')] : [];
    });
}

async function inspect(browser, format, baseUrl) {
    const context = await browser.newContext({
        viewport: format.viewport,
        hasTouch: format.touch,
        deviceScaleFactor: 1
    });
    const page = await context.newPage();
    const fehler = [];
    page.on('pageerror', (error) => fehler.push(String(error)));

    // `networkidle` wird nie erreicht: Die Karte lädt fortlaufend Kacheln.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#sidebar', { timeout: 30000 });
    // Nicht auf eine Frist warten, sondern auf den Zustand: Der Erststart lässt
    // die Beispielkunden einfliegen und gibt die Bedienung erst danach frei.
    // Eine feste Wartezeit maß genau diesen Zwischenzustand – und zählte null.
    // Der Erststart hält die Bedienung zurück, bis die Beispielkunden stehen
    // (`body.app-onboarding`). Wer stattdessen eine feste Frist abwartet, misst
    // je nach Maschine den Zwischenzustand – und zählt dann null.
    await page.waitForFunction(
        () => !document.body.classList.contains('app-onboarding'),
        null,
        { timeout: 30000 }
    );
    // Der Moduswahl-Schalter ist Schreibtisch-Sache; das Blatt-Griffchen gibt es
    // auf beiden Gesichtern – deshalb hängt die Bereitschaft an ihm.
    await page.waitForSelector('#sidebar-toggle', { state: 'visible', timeout: 30000 });
    await sleep(1000);

    // Das Erstbild: was die App im allerersten Moment verlangt, ohne einen
    // einzigen Klick. Am Handy ist das die Karte mit geschlossenem Blatt – der
    // ruhigste Zustand, den die App kennt, und der einzige, den jeder Nutzer
    // garantiert sieht.
    const erstbild = await page.evaluate(ERSTBILD_PROBE);

    // Ab hier wird die App im Alltagszustand vermessen: Die Willkommenskarte ist
    // ein einmaliger Hinweis, sie gehört ins Erstbild (oben) und nicht in die
    // Reiter-Messung. Sie liegt am Handy zudem über dem Blatt und fängt Klicks ab.
    await klicke(page, '#btn-demo-welcome-ack');

    // Am Handy liegt das Blatt zu; ohne Aufziehen ist kein Panel zu sehen.
    if (!await page.evaluate(() => document.body.classList.contains('sheet-open'))
        && !await page.locator('.tab-button[data-tab="daten"]').first().isVisible()) {
        await klicke(page, '#sidebar-toggle');
        await sleep(600);
    }

    const messungen = [];
    let rahmen = null;

    for (const tiefe of ['basis', 'profi']) {
        await klicke(page, `[data-depth="${tiefe}"]`);
        if (!format.touch && tiefe === 'profi') await aktiviereGebietsmodul(page);
        // Modi sind am Handy nicht wählbar. Am Desktop ist Außendienst der
        // vollständige Standard; Gebietsplanung kommt nur in Profi nach Opt-in.
        const modi = format.touch ? [null] : (tiefe === 'profi'
            ? ['aussendienst', 'gebietsplanung']
            : ['aussendienst']);

        for (const modus of modi) {
            if (modus && !await waehleModus(page, modus)) continue;
            for (const reiter of await offeneReiter(page)) {
                if (!await oeffneReiter(page, reiter)) continue;
                const wert = await page.evaluate(PROBE);
                if (rahmen === null) rahmen = wert.rahmen;
                messungen.push({ tiefe, modus, ...wert });
            }
        }
    }

    // Zweite Frage: Kostet die Vertiefung den Rückweg? Dazu in den Tour-Reiter,
    // dort in Schritt 1 tippen (= Fokus) und nachsehen, ob „☰ Übersicht" steht.
    let vertiefung = null;
    await klicke(page, '[data-depth="basis"]');
    if (!format.touch) await waehleModus(page, 'aussendienst');
    if (await oeffneReiter(page, 'tour')) {
        const uebersicht = await page.evaluate(PROBE);
        const getippt = await klicke(page, '#tab-tour .tour-acc[data-acc="start"] .acc-head');
        const fokus = getippt ? await page.evaluate(PROBE) : null;
        vertiefung = { uebersicht, fokus };
    }

    await context.close();
    return { ...format, erstbild, rahmen, messungen, vertiefung, fehler };
}

function parseArgs(argv) {
    const wanted = [];
    let frei = false;
    for (const arg of argv) {
        const [key, value] = arg.replace(/^--/, '').split('=');
        if (key === 'format' && value) wanted.push(value);
        if (key === 'frei') frei = true;
    }
    return { formats: wanted.length ? FORMATS.filter((f) => wanted.includes(f.name)) : FORMATS, frei };
}

const { formats, frei } = parseArgs(process.argv.slice(2));
const { chromium } = await import('playwright');
const port = await freePort();
const server = await startPreview(port);
const baseUrl = `http://localhost:${port}/`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});

const ergebnisse = [];
try {
    for (const format of formats) {
        const result = await inspect(browser, format, baseUrl);
        ergebnisse.push(result);
        const { width, height } = format.viewport;
        console.log(`\n── ${format.name} (${width}x${height}) ──`);
        const herkunft = Object.entries(result.erstbild.herkunft)
            .sort((a, b) => b[1] - a[1])
            .map(([name, n]) => `${name} ${n}`)
            .join(' · ');
        console.log(`  Erstbild (ohne einen Klick): ${result.erstbild.bedienelemente} Bedienelemente`
            + `${result.erstbild.blattOffen ? '' : ', Blatt zu'}`);
        console.log(`    davon: ${herkunft}`);
        console.log(`  Rahmen (Modus · Tiefe · Reiter): ${result.rahmen} Bedienelemente`);
        for (const m of result.messungen) {
            const budget = BUDGET[m.tiefe]?.[m.reiter];
            const marke = frei || budget === undefined ? ' ' : (m.bedienelemente <= budget ? '✓' : '✗');
            const grenze = budget === undefined ? '–' : String(budget);
            const wo = `${m.tiefe}${m.modus ? '/' + m.modus : ''}`;
            console.log(`  ${marke} ${wo.padEnd(24)} ${String(m.reiter).padEnd(11)} ${String(m.bedienelemente).padStart(3)} / ${grenze}`);
        }
    }
} finally {
    await browser.close();
    server.kill();
}

// ---- Auswertung ----

let befunde = 0;

for (const r of ergebnisse) {
    if (r.fehler.length) {
        console.log(`\n✗ ${r.name}: ${r.fehler.length} JavaScript-Fehler`);
        r.fehler.slice(0, 3).forEach((e) => console.log(`      ${e}`));
        befunde++;
    }

    if (!frei) {
        // Zuerst: Hat die Strecke überhaupt gemessen?
        //
        // Ein Klick, der ins Leere geht (verdeckender Hinweis, langsamer
        // Runner), lässt eine Ansicht schlicht aus – und wer nichts misst,
        // überschreitet auch kein Budget. Grün hieße dann „nichts gefunden",
        // nicht „nichts zu finden". Genau dieser Unterschied entscheidet, ob
        // ein Tor in der CI etwas wert ist.
        if (r.messungen.length < r.erwarteteMessungen) {
            console.log(`\n✗ ${r.name}: nur ${r.messungen.length} von ${r.erwarteteMessungen} `
                + 'erwarteten Ansichten gemessen – die Strecke ist nicht durchgelaufen.');
            befunde++;
        }
        if (r.erstbild.bedienelemente > r.erstbildBudget) {
            console.log(`\n✗ ${r.name}: Das Erstbild verlangt ${r.erstbild.bedienelemente} `
                + `Bedienelemente, Budget ${r.erstbildBudget}.`);
            befunde++;
        }
        for (const m of r.messungen) {
            const budget = BUDGET[m.tiefe]?.[m.reiter];
            if (budget === undefined) {
                console.log(`\n✗ ${r.name}: Reiter „${m.reiter}" (${m.tiefe}) hat kein Budget.`);
                befunde++;
            } else if (m.bedienelemente > budget) {
                console.log(`\n✗ ${r.name} · ${m.reiter} (${m.tiefe}${m.modus ? '/' + m.modus : ''}): `
                    + `${m.bedienelemente} Bedienelemente, Budget ${budget}.`);
                befunde++;
            }
        }
        if (r.rahmen !== null && r.rahmen > BUDGET_RAHMEN) {
            console.log(`\n✗ ${r.name}: Rahmen verlangt ${r.rahmen} Bedienelemente, Budget ${BUDGET_RAHMEN}.`);
            befunde++;
        }
    }

    // Regel 1: Die Übersicht zeigt den Prozess, nicht die Inhalte.
    const v = r.vertiefung;
    if (!v) {
        console.log(`\n✗ ${r.name}: Tour-Reiter war nicht erreichbar – die zwei Regeln bleiben ungeprüft.`);
        befunde++;
        continue;
    }
    if (v.uebersicht.offeneSchrittInhalte > 0) {
        console.log(`\n✗ ${r.name}: Der Tour-Reiter öffnet mit ${v.uebersicht.offeneSchrittInhalte} `
            + 'offenen Schritt-Inhalten. Die Übersicht soll den Prozess zeigen, nicht die Inhalte.');
        befunde++;
    } else if (v.uebersicht.schrittKoepfe === 3) {
        console.log(`\n✓ ${r.name}: Übersicht zeigt 3 Schritte, 0 Inhalte.`);
    } else {
        console.log(`\n✗ ${r.name}: Übersicht zeigt ${v.uebersicht.schrittKoepfe} Schritt-Köpfe statt 3.`);
        befunde++;
    }

    // Regel 2: Verdrängung ist umkehrbar.
    if (!v.fokus) {
        console.log(`\n✗ ${r.name}: Ein Schritt ließ sich nicht öffnen – Vertiefung ungeprüft.`);
        befunde++;
    } else if (!v.fokus.fokus) {
        console.log(`\n✗ ${r.name}: Antippen eines Schritts führt nicht in den Fokus-Modus.`);
        befunde++;
    } else if (!v.fokus.rueckweg) {
        console.log(`\n✗ ${r.name}: Der Fokus-Modus nimmt Chrome weg, ohne sichtbaren Rückweg.`);
        befunde++;
    } else {
        console.log(`✓ ${r.name}: Vertiefung öffnet genau einen Schritt (${v.fokus.offeneSchrittInhalte}) `
            + 'und lässt den Rückweg stehen.');
    }
}

if (frei) {
    console.log('\n(--frei: nur gemessen, keine Budgets geprüft.)');
    process.exit(0);
}

console.log(befunde === 0
    ? '\nJede Ansicht bleibt in ihrem Aufmerksamkeits-Budget.'
    : `\n${befunde} Befund(e).`);
process.exit(befunde === 0 ? 0 : 1);
