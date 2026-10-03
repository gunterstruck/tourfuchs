// Werbefilm Woche 3 „Keine Kundenliste? Frag deine Firmen-KI.“ – Aufnahme (Querformat).
// Szenen: Eigene Daten laden → Prompt für die Firmen-KI kopieren → die KI liefert
// die Tabelle → Einfügen, Spalten erkannt → eigene Kunden auf der Karte.
//
// Das KI-Fenster ist bewusst neutral („Deine Firmen-KI“, ohne Logo und ohne die
// Gestaltung eines echten Produkts) und wird nur für den Film eingeblendet.
// Alles andere ist die echte App. Die Kunden sind erfunden.
//
// Aufruf: node film/lichterkarte/record-kiliste.mjs <ordner> <app-url>
import { CUSTOMER_LIST_COLUMNS } from '../../src/features/customerListPrompt.js';
import { clickOn, glide, openApp, sleep, startRecording } from './recorder.mjs';

const [,, outDir, appUrl = 'http://localhost:5173/'] = process.argv;
const HEADERS = CUSTOMER_LIST_COLUMNS.map((c) => c.header);
// Erfundene Kunden; echte Postleitzahlen, damit TourFuchs sie offline verortet.
const ROWS = [
    ['10481', 'Beispiel Metallbau GmbH', 'Hafenstraße 12', '45127', 'Essen', 'Eva Beispiel', 'West', 'Jonas Muster', '0201 555-120', 'einkauf@beispiel-metallbau.de', '184000', '4', '12.09.2026'],
    ['10482', 'Muster Sanitär KG', 'Ringstraße 3', '44787', 'Bochum', 'Eva Beispiel', 'West', 'Lena Probe', '0234 555-310', 'info@muster-sanitaer.de', '96000', '6', '28.08.2026'],
    ['10495', 'Probe Logistik AG', 'Am Kanal 40', '44135', 'Dortmund', 'Eva Beispiel', 'West', 'Tim Vorlage', '0231 555-870', 't.vorlage@probe-logistik.de', '251000', '4', '03.09.2026'],
    ['10503', 'Vorlage Druck GmbH', 'Lindenallee 8', '45468', 'Mülheim an der Ruhr', 'Eva Beispiel', 'West', 'Sara Beispiel', '0208 555-410', 'sara@vorlage-druck.de', '58000', '8', '15.07.2026'],
    ['10511', 'Beispiel Bäckerei OHG', 'Marktplatz 1', '45879', 'Gelsenkirchen', 'Eva Beispiel', 'West', 'Ali Muster', '0209 555-220', 'kontakt@beispiel-baeckerei.de', '41000', '8', '22.06.2026'],
    ['10520', 'Muster Elektro GmbH', 'Industriestraße 77', '47051', 'Duisburg', 'Eva Beispiel', 'West', 'Nina Probe', '0203 555-660', 'n.probe@muster-elektro.de', '137000', '6', '09.09.2026'],
    ['10534', 'Probe Autohaus GmbH', 'Westfalendamm 90', '44141', 'Dortmund', 'Eva Beispiel', 'West', 'Paul Vorlage', '0231 555-930', 'service@probe-autohaus.de', '312000', '4', '30.08.2026'],
    ['10547', 'Vorlage Textil GmbH', 'Webereistraße 5', '42275', 'Wuppertal', 'Eva Beispiel', 'West', 'Mia Beispiel', '0202 555-140', 'mia@vorlage-textil.de', '73000', '8', '01.07.2026'],
];
const TSV = [HEADERS, ...ROWS].map((r) => r.join('\t')).join('\n');

const { b, ctx, p } = await openApp(appUrl, {
    // Berechtigung schon bestätigt – die Rückfrage kennt der Zuschauer aus der App.
    beforeLoad: () => { try { localStorage.setItem('tf_data_consent', new Date().toISOString()); } catch { /* egal */ } },
});
await p.addStyleTag({ content: `
    /* Als modaler Dialog, damit es über dem App-Dialog (oberste Ebene) liegt. */
    dialog#film-ki { position: fixed; inset: auto; left: 110px; top: 70px; margin: 0; padding: 0; border: 0; max-width: none; max-height: none;
        width: 900px; height: 590px; border-radius: 18px;
        background: #f8fafc !important; color: #0f172a; font: 14px/1.45 'Segoe UI', 'Liberation Sans', sans-serif;
        box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(148,163,184,.4) !important; overflow: hidden;
        opacity: 0; transform: translateY(18px) scale(.98); transition: opacity .45s ease, transform .45s ease; }
    #film-ki.on { opacity: 1; transform: none; }
    dialog#film-ki::backdrop { background: rgba(5, 4, 12, .35); }
    #film-ki header { display: flex; align-items: center; gap: 10px; padding: 12px 18px; background: #e2e8f0; font-weight: 700; color: #334155; }
    #film-ki header i { width: 22px; height: 22px; border-radius: 6px; background: linear-gradient(135deg, #64748b, #94a3b8); }
    #film-ki header small { margin-left: auto; font-weight: 500; color: #64748b; }
    #film-ki .chat { padding: 16px 22px; display: flex; flex-direction: column; gap: 12px; height: 540px; overflow: hidden; }
    #film-ki .me { align-self: flex-end; max-width: 70%; background: #dbeafe; border-radius: 14px 14px 4px 14px; padding: 10px 14px; color: #1e3a8a; }
    #film-ki .ai { align-self: flex-start; max-width: 100%; }
    #film-ki table { border-collapse: collapse; font-size: 11.5px; margin: 8px 0; }
    #film-ki th, #film-ki td { border: 1px solid #cbd5e1; padding: 3px 6px; white-space: nowrap; text-align: left; }
    #film-ki td { background: #fff; }
    #film-ki th { background: #f1f5f9; font-weight: 700; }
    #film-ki tr:not(.on) th, #film-ki tr:not(.on) td { background: transparent; }
    #film-ki tr { opacity: 0; transition: opacity .25s; }
    #film-ki tr.on { opacity: 1; }
    #film-ki tr:not(.on) th, #film-ki tr:not(.on) td { border-color: transparent; }
    #film-ki tbody.sel td { background: #bfdbfe; }
    #film-ki .src { color: #475569; font-size: 12.5px; opacity: 0; transition: opacity .3s; }
    #film-ki .src.on { opacity: 1; }
    #film-ki .copy { opacity: 0; transition: opacity .3s; }
    #film-ki .src.on + .copy { opacity: 1; }
    #film-ki .copy { display: inline-block; margin-top: 4px; padding: 5px 12px; border-radius: 8px; border: 1px solid #94a3b8; background: #fff; font-weight: 600; color: #334155; }
` });
await glide(p, 980, 620, 2);

const rec = await startRecording(ctx, p, `${outDir}/rec-kiliste`);
await sleep(700);

// 1) Eigene Daten laden → Kundenliste von der Firmen-KI → Prompt kopieren.
rec.mark('ask');
await clickOn(p, '#btn-demo-own-data', { steps: 22 });
await sleep(1100);
await clickOn(p, '#btn-ki-list', { steps: 18 });
await sleep(1000);
await clickOn(p, '.ki-list-preview summary', { steps: 14 });
await sleep(1300);
await clickOn(p, '#ki-list-launch', { steps: 16 });
await sleep(900);

// 2) Die Firmen-KI liefert die Tabelle (neutrales Filmfenster).
rec.mark('ki');
await p.evaluate(({ headers, rows }) => {
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const w = document.createElement('dialog');
    w.id = 'film-ki';
    w.innerHTML = `<header><i></i>Deine Firmen-KI<small>Arbeitskonto</small></header>
        <div class="chat">
          <div class="me">Erstelle mir bitte eine Kundenliste aller Kunden, die mir als Vertriebsmitarbeiter zugeordnet sind. …</div>
          <div class="ai"><div class="intro"></div>
            <table><thead><tr><th>${headers.map(esc).join('</th><th>')}</th></tr></thead>
            <tbody>${rows.map((r) => `<tr><td>${r.map(esc).join('</td><td>')}</td></tr>`).join('')}</tbody></table>
            <div class="src">Quellen: CRM-Export „Vertrieb West“ (Q3/2026), Besuchsberichte.</div>
            <span class="copy">⧉ Tabelle kopieren</span></div>
        </div>`;
    document.body.appendChild(w);
    w.showModal();
    requestAnimationFrame(() => w.classList.add('on'));
}, { headers: HEADERS, rows: ROWS });
await sleep(800);
await p.evaluate(async () => {
    const box = document.querySelector('#film-ki .intro');
    const text = 'Gerne – hier sind die 8 Kunden, die dir zugeordnet sind:';
    for (let i = 1; i <= text.length; i++) { box.textContent = text.slice(0, i); await new Promise((r) => setTimeout(r, 22)); }
    document.querySelector('#film-ki thead tr').classList.add('on');
    for (const tr of document.querySelectorAll('#film-ki tbody tr')) { tr.classList.add('on'); await new Promise((r) => setTimeout(r, 260)); }
    document.querySelector('#film-ki .src').classList.add('on');
});
await sleep(900);
await clickOn(p, '#film-ki .copy', { steps: 18 });
await p.evaluate(() => document.querySelector('#film-ki tbody').classList.add('sel'));
await sleep(1100);

// 3) Zurück in TourFuchs: Ergebnis einfügen, Spalten erkannt.
rec.mark('paste');
await p.evaluate(() => {
    const w = document.getElementById('film-ki');
    w.classList.remove('on');
    setTimeout(() => { w.close(); w.remove(); }, 500);
});
await sleep(600);
await clickOn(p, '#ki-list-paste', { steps: 16 });
await sleep(700);
await clickOn(p, '#paste-input', { steps: 12 });
await p.evaluate((tsv) => {
    const input = document.getElementById('paste-input');
    input.value = tsv;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}, TSV);
await sleep(1300);
const status = await p.textContent('#paste-status');
if (!/8 Zeilen/.test(status)) throw new Error(`Einfügen nicht erkannt: ${status}`);
await clickOn(p, '#paste-confirm', { steps: 14 });
await sleep(2300);
await clickOn(p, '#mapping-confirm', { steps: 16 });
await sleep(1800);

// 4) Eigene Kunden auf der Karte.
rec.mark('map');
for (let i = 0; i < 4; i++) {
    // Nach dem Import meldet sich die App (Ergebnis, Befund): sichtbar wegklicken.
    const btn = await p.evaluate(() => {
        const dlg = [...document.querySelectorAll('dialog[open]')].pop();
        if (!dlg) return null;
        const cand = [...dlg.querySelectorAll('.dialog-close, footer button')].find((el) => el.offsetParent && el.getBoundingClientRect().width > 0);
        if (!cand) { dlg.close(); return { closed: dlg.id }; }
        const r = cand.getBoundingClientRect();
        return { id: dlg.id, x: r.x + r.width / 2, y: r.y + r.height / 2, label: cand.textContent.trim() };
    });
    if (!btn) break;
    console.log('Dialog', JSON.stringify(btn));
    if (btn.x) { await glide(p, btn.x, btn.y, 12); await sleep(200); await p.mouse.click(btn.x, btn.y); }
    await sleep(700);
}
await sleep(400);
const count = await p.evaluate(async () => (await import('/src/core/state.js')).state.customers.length);
if (count !== ROWS.length) throw new Error(`Import: ${count} Kunden statt ${ROWS.length}`);
await p.evaluate(() => document.documentElement.classList.add('film-hide-side'));
await sleep(500);
await p.evaluate(async () => { const { fitToCustomers, getMap } = await import('/src/features/map.js'); fitToCustomers(); setTimeout(() => getMap().zoomIn(0.5), 600); });
await sleep(3600);
await rec.stop({ lead: 0.2 });
console.log('Importiert:', count, 'Kunden');
await b.close();
