/**
 * Den Film drehen – aus Code, so wie die Live-Demos selbst aus Code sind.
 *
 * Es gibt keinen Grund, eine Bildschirmaufnahme von Hand zu machen: Die
 * Vorführung „Fläche umfahren, Briefing bekommen" bedient die echte App bereits
 * selbsttätig und in jedem Anlauf gleich. Dieses Werkzeug setzt nur eine Kamera
 * davor – und stellt die Bedingung her, die den Film überhaupt erst möglich
 * macht: **eigene Daten**.
 *
 * Mit Beispielkunden baut TourFuchs bewusst keinen Prompt. Der Film würde also
 * ausgerechnet die Hälfte verlieren, um die es geht. Deshalb fügt der Lauf
 * zuerst eine erfundene Kundenliste ein (echte Postleitzahlen, erfundene
 * Firmen); für die App sind das eigene Daten, der Prompt ist echt, und die
 * Vorführung schaltet selbsttätig auf ihre ausführlichen Sätze um.
 *
 * Ergebnis in `film/`:
 *   tourfuchs-<demo>-<format>.mp4   fertig für LinkedIn (H.264)
 *   schnittliste-<demo>-<format>.md jeder gesprochene Satz mit echtem Timecode
 *
 * Aufruf:
 *   npm run build && npm run film
 *   npm run film -- --format=hochkant     (9:16 für Feed und Story)
 *   npm run film -- --demo=briefing       (Schwerpunkt Prompt statt Geste)
 *
 * `--demo` wählt die Live-Demo, die gefilmt wird. Zwei taugen dafür:
 *   lasso     (Voreinstellung) – die Geste trägt, das Briefing folgt
 *   briefing  – die Fläche ist der Anlauf, die Zeit liegt im Prompt
 *
 * Voraussetzungen (bewusst nicht in package.json – ein normales `npm install`
 * soll keinen Browser und kein ffmpeg herunterladen):
 *   npm i -D playwright ffmpeg-static && npx playwright install chromium
 * Ist bereits ein Chromium da, genügt PLAYWRIGHT_CHROMIUM_PATH=/pfad/zu/chrome.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Die erfundene Kundenliste
//
// Erfundene Firmen, echte Postleitzahlen, alle im Ruhrgebiet: Dorthin fährt die
// Vorführung von selbst (`selectShowcaseTour`), und dort liegen die Kunden dicht
// genug, dass ein Lasso mehrere auf einmal trifft. Die Besuchsdaten sind so
// gestreut, dass die Auswahlkarte „fällig" anzeigt – sonst fehlte dem Film die
// Dringlichkeit, von der er spricht.
//
// Tabulatoren, weil genau das in der Zwischenablage liegt, wenn jemand in Excel
// Strg+C drückt.
// ---------------------------------------------------------------------------
const KUNDENLISTE = [
    'Kundenname\tKundennummer\tPLZ\tOrt\tVertriebsbezirk\tBesuchsrhythmus\tLetzter Besuch',
    'Rheinstahl Fördertechnik GmbH\t10021\t45136\tEssen\tBezirk West\t6\t02.01.2026',
    'Berger Werkzeugbau KG\t10044\t45329\tEssen\tBezirk West\t8\t14.11.2025',
    'Nordhoff Antriebstechnik AG\t10078\t46045\tOberhausen\tBezirk West\t6\t20.03.2026',
    'Kampmann Industrieservice GmbH\t10092\t46049\tOberhausen\tBezirk West\t12\t05.02.2026',
    'Vosskuhl Metallverarbeitung\t10113\t45468\tMülheim an der Ruhr\tBezirk West\t6\t18.12.2025',
    'Sauerland Hydraulik GmbH\t10135\t44787\tBochum\tBezirk Ruhr\t8\t09.04.2026',
    'Emscher Anlagenbau AG\t10151\t44793\tBochum\tBezirk Ruhr\t6\t27.10.2025',
    'Lindemann Kunststofftechnik\t10166\t45879\tGelsenkirchen\tBezirk Ruhr\t10\t11.05.2026',
    'Hellweg Präzisionsteile GmbH\t10182\t44135\tDortmund\tBezirk Ruhr\t6\t22.01.2026',
    'Westfalen Schweißtechnik KG\t10199\t44139\tDortmund\tBezirk Ruhr\t8\t30.03.2026',
    'Ruhrtal Maschinenbau GmbH\t10204\t47051\tDuisburg\tBezirk West\t6\t08.02.2026',
    'Niederrhein Fluidtechnik AG\t10218\t47119\tDuisburg\tBezirk West\t12\t16.06.2026'
].join('\n');

// Warum 1280×720 und nicht 1920×1080: Die Vorführung fliegt auf Zoomstufe 10.
// Wie viel Landschaft das ist, hängt an der Fensterbreite – bei 1920 px sind es
// rund 190 km, und die Kunden schrumpfen auf ein Viertel der Bildbreite. Bei
// 1280 px füllt dieselbe Zoomstufe das Bild. Für den Feed ist 720p ohnehin
// reichlich; ein größeres Bild wäre hier ein schlechteres.
const FORMATE = {
    quer: { name: 'quer', viewport: { width: 1280, height: 720 }, hasTouch: false },
    // Hochkant nimmt das Handy-Layout auf – dort läuft dieselbe Vorführung mit
    // dem Blatt statt der Seitenleiste. Beschneiden wäre der schlechtere Weg:
    // Der Film zeigt dann eine Oberfläche, die es so nicht gibt.
    hochkant: { name: 'hochkant', viewport: { width: 720, height: 1280 }, hasTouch: true },
    // Galaxy S24: 360 × 780 CSS-Pixel bei dreifacher Pixeldichte ergeben die
    // native Displayauflösung 1080 × 2340. Die schmale CSS-Breite ist der
    // entscheidende Unterschied zur eher tabletartigen 720-px-Aufnahme.
    s24: {
        name: 's24',
        viewport: { width: 360, height: 780 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3
    }
};

/**
 * Vor- und Abspann.
 *
 * Bewusst als Einblendung IN der Seite und nicht als Schnitt hinterher: So
 * entsteht der Film in einem Stück, ohne Videoschnittprogramm, und bleibt
 * reproduzierbar. Die Farben sind die der Lasso-Spur (`SHAPE_STYLE`).
 */
const KARTEN_CSS = `
#film-card {
    position: fixed; inset: 0; z-index: 2147483647;
    display: grid; place-content: center; justify-items: center;
    gap: 2.2vh; padding: 8vw; text-align: center;
    background: #0d1513; color: #f2f7f5;
    font-family: "Segoe UI", system-ui, sans-serif;
    opacity: 0; transition: opacity .5s ease;
}
#film-card[data-on="1"] { opacity: 1; }
#film-card .kicker {
    font-size: 1.7vh; letter-spacing: .22em; text-transform: uppercase;
    color: #3bc7b4; font-weight: 600;
}
#film-card h1 {
    font-size: 5.2vh; line-height: 1.15; margin: 0; font-weight: 650;
    letter-spacing: -.02em; max-width: 22ch; text-wrap: balance;
}
#film-card p { font-size: 2.6vh; margin: 0; color: #a2b5b0; max-width: 34ch; }
#film-card .fox { font-size: 8vh; line-height: 1; }
#film-card .url { font-size: 2.9vh; color: #3bc7b4; font-weight: 600; letter-spacing: .01em; }
#film-card .fine { font-size: 1.8vh; color: #6b807b; }

/* Ein modaler Dialog liegt im „top layer" – über JEDEM z-index. Die Titelkarte
   käme sonst unter dem Demo-Auswahlfenster zu liegen, das dahinter geöffnet
   wird. Solange eine Karte im Bild ist, werden Dialoge deshalb ausgeblendet;
   angeklickt werden können sie weiterhin. */
body.film-karte dialog { opacity: 0 !important; }

/* Die Demo-Leiste steht mittig am oberen Rand – genau dort, wo der
   Gebiets-Briefing-Dialog seine Überschrift hat. Im Film überlagern sich beide.
   Dass hier eine echte Live-Demo läuft, sagt der Beitragstext; das Bild braucht
   die Leiste nicht. */
.sc-toolbar { display: none !important; }
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const zeit = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${String(Math.floor(s / 60)).padStart(1, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function freePort() {
    return new Promise((resolve_, reject) => {
        const server = createServer();
        server.on('error', reject);
        server.listen(0, () => {
            const { port } = server.address();
            server.close(() => resolve_(port));
        });
    });
}

async function startPreview(port) {
    const viteCli = resolve('node_modules', 'vite', 'bin', 'vite.js');
    const child = spawn(process.execPath, [viteCli, 'preview', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
    for (let i = 0; i < 40; i++) {
        await sleep(500);
        try { if ((await fetch(`http://localhost:${port}/`)).ok) return child; } catch { /* noch nicht bereit */ }
    }
    child.kill();
    throw new Error('Vorschau-Server ist nicht gestartet. Vorher `npm run build` ausführen?');
}

function run(bin, args) {
    return new Promise((resolve_, reject) => {
        const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk; });
        child.on('close', (code) => (code === 0 ? resolve_() : reject(new Error(stderr.slice(-800)))));
    });
}

// ---- Karten ein- und ausblenden -------------------------------------------
async function zeigeKarte(page, html) {
    await page.evaluate((inner) => {
        let card = document.getElementById('film-card');
        if (!card) {
            card = document.createElement('div');
            card.id = 'film-card';
            document.body.appendChild(card);
        }
        card.innerHTML = inner;
        void card.offsetWidth;
        card.dataset.on = '1';
        document.body.classList.add('film-karte');
    }, html);
    await sleep(600);
}

async function blendeKarteAus(page) {
    await page.evaluate(() => {
        const card = document.getElementById('film-card');
        if (card) card.dataset.on = '0';
    });
    await sleep(700);
    // Erst wenn die Karte weg ist, dürfen Dialoge wieder sichtbar werden –
    // sonst blitzt das Demo-Auswahlfenster im Übergang auf.
    await page.evaluate(() => document.body.classList.remove('film-karte'));
}

// ---- Vorbereitung: eigene Daten herstellen --------------------------------
async function bildHinterTitelkarte(page, path) {
    await page.evaluate(() => {
        const card = document.getElementById('film-card');
        if (card) card.style.visibility = 'hidden';
        document.body.classList.remove('film-karte');
    });
    await sleep(250);
    await page.screenshot({ path, type: 'jpeg', quality: 92 });
    await page.evaluate(() => {
        const card = document.getElementById('film-card');
        if (card) card.style.visibility = '';
        document.body.classList.add('film-karte');
    });
}

async function eigeneDatenEinfuegen(page, bildOrdner = null) {
    await page.evaluate(() => {
        document.getElementById('own-data-dialog')?.showModal();
    });
    await sleep(600);
    await page.locator('#btn-paste').click({ timeout: 8000 });
    if (await page.locator('#consent-dialog[open]').count()) {
        await page.locator('#consent-confirm').click();
        await sleep(400);
    }
    await page.waitForSelector('#paste-input', { timeout: 8000 });
    await page.evaluate((text) => {
        const field = document.getElementById('paste-input');
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }, KUNDENLISTE);
    await sleep(800);
    if (bildOrdner) await bildHinterTitelkarte(page, resolve(bildOrdner, '02-import.jpg'));
    await page.locator('#paste-confirm').click({ timeout: 8000 });
    await page.waitForSelector('#mapping-confirm', { timeout: 10000 });
    await sleep(600);
    await page.locator('#mapping-confirm').click();
    await sleep(4000);
    if (bildOrdner) await bildHinterTitelkarte(page, resolve(bildOrdner, '03-datenanalyse.jpg'));

    // Befund, Hinweise, Tresor-Angebot: alles wegquittieren, solange die
    // Titelkarte darüber liegt.
    for (let i = 0; i < 5; i++) {
        const knopf = page.locator('dialog[open] .primary').first();
        if (await knopf.count() && await knopf.isVisible().catch(() => false)) {
            await knopf.click().catch(() => {});
            await sleep(900);
            continue;
        }
        break;
    }
    await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
    await sleep(1200);

    // Beleg, dass wirklich eigene Kunden liegen: Ohne sie zeigte die Vorführung
    // die Demo-Sperre statt des Prompts – und der Film wäre umsonst gedreht.
    return page.evaluate(() => document.querySelectorAll('.customer-marker-card, .customer-stack-card').length);
}

/**
 * Vor- und Abspann je Fassung. Der Film bekommt seinen Schwerpunkt nicht nur
 * durch die Vorführung, sondern auch dadurch, womit er anfängt und worauf er
 * landet.
 */
const FASSUNGEN = {
    lasso: {
        titel: `<span class="kicker">TourFuchs</span>
            <h1>Ich bin in dieser Gegend.<br>Wen besuche ich?</h1>`,
        abspann: `<span class="fox">🦊</span>
            <h1>Umfahren. Briefen lassen. Entscheiden.</h1>
            <p class="url">tourfuchs.vercel.app</p>
            <p class="fine">Alle Kunden und Vorgänge in diesem Film sind erfunden.<br>Privates Projekt, kostenlos, ohne Gewähr.</p>`
    },
    briefing: {
        titel: `<span class="kicker">TourFuchs</span>
            <h1>Die Karte weiß, <i>wo</i> die Kunden sind.<br>Nicht, was dort gerade läuft.</h1>`,
        abspann: `<span class="fox">🦊</span>
            <h1>Ein Prompt. Deine KI. Deine Entscheidung.</h1>
            <p class="url">tourfuchs.vercel.app</p>
            <p class="fine">Kein Konto, keine KI-Schnittstelle, keine Cloud.<br>Alle Kunden und Vorgänge in diesem Film sind erfunden.</p>`
    }
};

// ---- Hauptlauf ------------------------------------------------------------
const arg = (name, fallback) => (process.argv.slice(2).find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1] || fallback;
const argFormat = arg('format', 'quer');
const demoId = arg('demo', 'lasso');
const captureMobileFrames = process.argv.includes('--capture-mobile-frames');
const format = FORMATE[argFormat];
const fassung = FASSUNGEN[demoId];
if (!format) {
    console.error(`Unbekanntes Format „${argFormat}". Verfügbar: ${Object.keys(FORMATE).join(', ')}`);
    process.exit(2);
}
if (!fassung) {
    console.error(`Für die Demo „${demoId}" gibt es keine Fassung. Verfügbar: ${Object.keys(FASSUNGEN).join(', ')}`);
    process.exit(2);
}

let chromium;
let ffmpegPfad;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('Playwright fehlt. Einmalig einrichten:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}
try {
    ffmpegPfad = (await import('ffmpeg-static')).default;
} catch {
    // Auf Entwicklungsrechnern ist ffmpeg oft bereits systemweit vorhanden.
    // Der Film braucht dann keine zweite, paketgebundene Binärdatei.
    ffmpegPfad = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
}

const rohOrdner = resolve('tmp', 'film-roh');
const zielOrdner = resolve('film');
const bildOrdner = captureMobileFrames
    ? resolve(zielOrdner, format.name === 's24' ? 'frames-s24' : 'frames-mobile')
    : null;
rmSync(rohOrdner, { recursive: true, force: true });
mkdirSync(rohOrdner, { recursive: true });
mkdirSync(zielOrdner, { recursive: true });
if (bildOrdner) {
    rmSync(bildOrdner, { recursive: true, force: true });
    mkdirSync(bildOrdner, { recursive: true });
}

const port = await freePort();
const server = await startPreview(port);
const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
);
const contextOptionen = {
    viewport: format.viewport,
    hasTouch: format.hasTouch,
    isMobile: Boolean(format.isMobile),
    deviceScaleFactor: format.deviceScaleFactor || 1,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'no-preference'
};
if (!captureMobileFrames) contextOptionen.recordVideo = { dir: rohOrdner, size: format.viewport };
const context = await browser.newContext(contextOptionen);
const page = await context.newPage();
// Ab hier läuft die Kamera. Alles davor gibt es nicht, alles danach wird später
// auf den eigentlichen Filmbeginn zurechtgeschnitten.
const aufnahmeStart = Date.now();
const fehler = [];
page.on('pageerror', (e) => fehler.push(String(e).slice(0, 300)));

let filmStart = 0;
let code = 1;
const saetze = [];

try {
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#map', { timeout: 20000 });
    await page.addStyleTag({ content: KARTEN_CSS });

    // Titelkarte SOFORT: Alles, was die Vorbereitung an Dialogen aufmacht,
    // passiert dahinter. Geschnitten wird später auf genau diesen Moment.
    await zeigeKarte(page, fassung.titel);

    await sleep(7000);                     // Willkommens-Choreografie abwarten
    const anzahl = await eigeneDatenEinfuegen(page, bildOrdner);
    console.log(`Eigene Kunden geladen${anzahl ? `: ${anzahl}` : ''}`);

    // Demo-Auswahl öffnen und die Story starten – ebenfalls hinter der Karte.
    await page.evaluate(() => document.getElementById('btn-showcase')?.click());
    await page.waitForSelector(`#showcase-dialog .sc-tile[data-story="${demoId}"]`, { timeout: 10000 });

    // Ab hier läuft der Film.
    filmStart = Date.now();
    await sleep(2600);                     // Titelkarte stehen lassen
    await page.locator(`#showcase-dialog .sc-tile[data-story="${demoId}"]`).click();
    await blendeKarteAus(page);

    // Für die Mobile-Werbefassung werden echte Gerätescreenshots mit sechs
    // Bildern pro Sekunde aufgenommen. Das umgeht empfindliche WebM-Recorder
    // und liefert zugleich deutlich mehr reale UI-Zustände für den 30-fps-
    // Endschnitt als die frühere 2-fps-Strecke. Beim S24 entstehen durch
    // 360 × 780 CSS-Pixel und DPR 3 direkt native 1080 × 2340 Pixel.
    let bilderLaufen = captureMobileFrames;
    let bildIndex = 1;
    const bildSchleife = captureMobileFrames ? (async () => {
        const takt = 1000 / 6;
        let naechstesBild = Date.now();
        while (bilderLaufen) {
            await page.screenshot({
                path: resolve(bildOrdner, `demo-${String(bildIndex).padStart(4, '0')}.jpg`),
                type: 'jpeg',
                quality: 90
            });
            bildIndex += 1;
            naechstesBild += takt;
            await sleep(Math.max(0, naechstesBild - Date.now()));
        }
    })() : null;

    // Jeden Satz mit echtem Timecode mitschreiben – daraus entsteht die
    // Schnittliste, und damit weiß man, wo der KI-Einschub hingehört.
    const ticker = setInterval(async () => {
        const text = await page.locator('.sc-bubble').innerText().catch(() => '');
        const satz = String(text).replace(/\s+/g, ' ').trim();
        if (satz && saetze.at(-1)?.text !== satz) saetze.push({ ms: Date.now() - filmStart, text: satz });
    }, 300);

    let ergebnis = 'FEHLER';
    try {
        await page.waitForSelector('#showcase-dialog .sc-outcome-head', { timeout: 240000 });
        ergebnis = await page.locator('#showcase-dialog .sc-outcome-failed').count() ? 'FEHLER' : 'ok';
    } catch { /* Abspann kommt trotzdem */ }
    clearInterval(ticker);
    bilderLaufen = false;
    if (bildSchleife) await bildSchleife;

    const demoEnde = Date.now() - filmStart;

    // Der Ergebnis-Dialog der Demo gehört nicht in den Film – der Abspann schon.
    await page.evaluate(() => document.getElementById('showcase-dialog')?.close());
    await sleep(400);
    await zeigeKarte(page, fassung.abspann);
    await sleep(4200);
    const filmEnde = Date.now() - filmStart;

    // Die Aufnahme wird erst beim Schließen des Kontextes geschrieben.
    await context.close();

    if (captureMobileFrames) {
        console.log(`\nMobile Einzelbilder: ${bildOrdner}`);
        console.log(`Demo-Bilder: ${bildIndex - 1} · Lauf ${ergebnis}`);
        code = ergebnis === 'ok' ? 0 : 1;
        if (fehler.length) console.log(`Skriptfehler: ${fehler.length} – ${fehler[0]}`);
        // Kein WebM-Schnitt: Die Einzelbilder werden vom 9:16-Renderer genutzt.
    } else {

    // ---- Schneiden und wandeln --------------------------------------------
    const roh = readdirSync(rohOrdner).find((f) => f.endsWith('.webm'));
    if (!roh) throw new Error('Playwright hat keine Aufnahme abgelegt.');

    const ziel = resolve(zielOrdner, `tourfuchs-${demoId}-${format.name}.mp4`);
    // Vorne wird alles abgeschnitten, was vor dem Filmbeginn lag (Laden,
    // Einfügen, Import) – es lag ohnehin hinter der Titelkarte.
    const vorlaufSek = (filmStart - aufnahmeStart) / 1000;
    await run(ffmpegPfad, [
        '-y', '-ss', vorlaufSek.toFixed(2), '-i', resolve(rohOrdner, roh),
        '-t', ((filmEnde + 400) / 1000).toFixed(2),
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an',
        '-r', '30',
        ziel
    ]);

    // ---- Schnittliste ------------------------------------------------------
    // Die Schnittmarke ist der Satz, in dem der Assistent aufgemacht wird – ab
    // da hört die App auf. Beide Fassungen sagen es mit anderen Worten
    // („Zwischenablage" bzw. „kopiert ihn und öffnet deinen Assistenten"),
    // gemeint ist derselbe Moment.
    const schnittmarke = saetze.find((s) => /Zwischenablage|öffnet deinen Assistenten/.test(s.text));
    const liste = [
        `# Schnittliste – ${demoId} · ${format.name === 'quer' ? '16:9' : '9:16'}`,
        '',
        `Gedreht am ${new Date().toLocaleDateString('de-DE')} · Lauf: ${ergebnis} · Länge ${zeit(filmEnde)}`,
        `Demo-Teil bis ${zeit(demoEnde)}, danach Abspann.`,
        '',
        '| Timecode | Satz |',
        '|---|---|',
        ...saetze.map((s) => `| ${zeit(s.ms)} | ${s.text.replace(/\|/g, '/')} |`),
        '',
        '## Wo der KI-Einschub hingehört',
        '',
        schnittmarke
            ? `Bei **${zeit(schnittmarke.ms)}** sagt die Demo „… legt ihn in die Zwischenablage und öffnet deinen Assistenten".\nGenau dort hört die App auf und der Assistent fängt an: Wer die echte Antwort zeigen\nwill, legt seine Aufnahme des Assistenten an dieser Stelle dazwischen. Der Film\nfunktioniert auch ohne – die Vorführung sagt in Worten, was dort passiert.`
            : 'Die Schnittmarke wurde nicht gefunden – bitte die Sätze oben durchsehen.',
        ''
    ].join('\n');
    writeFileSync(resolve(zielOrdner, `schnittliste-${demoId}-${format.name}.md`), liste, 'utf8');

    console.log(`\nFilm: ${ziel}`);
    console.log(`Schnittliste: ${resolve(zielOrdner, `schnittliste-${demoId}-${format.name}.md`)}`);
    console.log(`Länge ${zeit(filmEnde)} · Vorführung ${ergebnis} · ${saetze.length} Sätze`);
    if (fehler.length) console.log(`Skriptfehler: ${fehler.length} – ${fehler[0]}`);
    code = ergebnis === 'ok' ? 0 : 1;
    }
} finally {
    // Nicht über process.exit() abkürzen: Ein laufender Vorschau-Server und ein
    // offener Browser überleben das und bleiben als Waisen zurück.
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    server.kill();
}
process.exit(code);
