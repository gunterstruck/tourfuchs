// Werbefilm Serie 2, Woche 6 „Die Entscheidung. Auf einem Blatt.“ – Aufnahme (Querformat, GeoFuchs).
// Szenen: laufende Simulation im Cockpit → „📄 Entscheidungsvorlage“ → die Vorlage
// (ohne Kundennamen) wird durchgeblättert.
//
// Die App öffnet die Vorlage in einem eigenen Druckfenster. Der Mitschnitt kann nur
// ein Fenster aufnehmen; deshalb wird genau das erzeugte Dokument (HTML aus dem
// Druckfenster, unverändert) als Fenster über der App gezeigt. Es wird vor der
// Aufnahme einmal erzeugt – das Öffnen des Druckfensters dauert sonst Sekunden.
//
// Aufruf: node film/lichterkarte/record-vorlage.mjs <ordner> <app-url>
import { clickOn, glide, openApp, sleep, startRecording } from './recorder.mjs';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const { b, ctx, p } = await openApp(appUrl, { mode: 'gebietsplanung' });
// Das Druckfenster nicht automatisch schließen: Wir brauchen seinen Inhalt.
ctx.removeAllListeners('page');

const setSelect = (id, value) => p.evaluate(({ id, value }) => {
    const s = document.getElementById(id);
    s.value = value;
    s.dispatchEvent(new Event('change', { bubbles: true }));
}, { id, value });

// Bühne: Simulation „Augsburg → Stuttgart-Neckar“ ist schon durchgespielt.
await setSelect('colormode-select', 'bezirk');
await p.evaluate(() => document.querySelector('.tab-button[data-tab="gebiete"]')?.click());
await sleep(600);
await p.click('#btn-cockpit');
await sleep(1000);
await p.evaluate(() => { document.getElementById('simulation-panel').open = true; });
await setSelect('sim-level', 'kreise');
await p.fill('#sim-search', 'Augsburg');
await sleep(600);
await p.check('#sim-select-all');
await setSelect('sim-rep', 'Bezirk Stuttgart-Neckar');
await p.click('#sim-apply');
await sleep(1200);
await p.evaluate(() => document.getElementById('sim-changes')?.scrollIntoView({ block: 'center' }));
await p.addStyleTag({ content: `
    dialog#film-doc { position: fixed; inset: auto; left: 150px; top: 34px; margin: 0; padding: 0; border: 0;
        width: 820px; height: 640px; max-width: none; max-height: none; border-radius: 14px; overflow: hidden;
        background: #fff !important; box-shadow: 0 30px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(148,163,184,.4) !important;
        opacity: 0; transform: translateY(16px) scale(.98); transition: opacity .45s ease, transform .45s ease; }
    dialog#film-doc.on { opacity: 1; transform: none; }
    dialog#film-doc::backdrop { background: rgba(5, 4, 12, .45); }
    #film-doc header { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 14px; background: #e2e8f0;
        font: 600 13px 'Segoe UI', 'Liberation Sans', sans-serif; color: #334155; }
    #film-doc header i { width: 11px; height: 11px; border-radius: 50%; background: #cbd5e1; box-shadow: 16px 0 #cbd5e1, 32px 0 #cbd5e1; margin-right: 34px; }
    #film-doc iframe { width: 100%; height: calc(100% - 34px); border: 0; background: #fff; }
` });
await glide(p, 1060, 640, 2);

// Vorlage vorab einmal erzeugen (gleiche Simulation, gleicher Inhalt).
const firstPopup = ctx.waitForEvent('page', { timeout: 15000 });
await p.click('#sim-report-print');
const pre = await firstPopup;
await pre.waitForLoadState();
await sleep(400);
const html = await pre.content();
await pre.close();
if (!/Entscheidungsvorlage/.test(html)) throw new Error('Entscheidungsvorlage nicht erzeugt');
// Während der Aufnahme geöffnete Druckfenster gleich wieder schließen.
ctx.on('page', (tab) => tab.close().catch(() => {}));

const rec = await startRecording(ctx, p, `${outDir}/rec-vorlage`);
await sleep(500);

// 1) Variante durchgespielt.
rec.mark('sim');
await sleep(3600);

// 2) Die Vorlage fürs Management.
rec.mark('doc');
await clickOn(p, '#sim-report-print', { steps: 18 });
await p.evaluate((html) => {
    const d = document.createElement('dialog');
    d.id = 'film-doc';
    d.innerHTML = '<header><i></i>Gebietsreform – Entscheidungsvorlage</header><iframe></iframe>';
    document.body.appendChild(d);
    d.querySelector('iframe').srcdoc = html;
    d.showModal();
    requestAnimationFrame(() => d.classList.add('on'));
}, html);
await sleep(5200);

// 3) Ohne Kundennamen – Kennzahlen je Bezirk.
rec.mark('names');
const scrollDoc = (y) => p.evaluate((y) => {
    document.querySelector('#film-doc iframe').contentWindow.scrollTo({ top: y, behavior: 'smooth' });
}, y);
await scrollDoc(420);
await sleep(5000);

// 4) Entscheiden in einer Sitzung.
rec.mark('decide');
await scrollDoc(1100);
await sleep(4800);
await rec.stop({ lead: 0.2 });
console.log('Vorlage:', html.length, 'Zeichen');
await b.close();
