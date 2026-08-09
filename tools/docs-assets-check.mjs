import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screenshotDir = join(root, 'public/docs/screenshots');
const expectedScreenshots = [
  ['BILD-IMPORT-01-eigene-daten-laden.png', 1440, 900],
  ['BILD-IMPORT-02-berechtigung-bestaetigen.png', 1440, 900],
  ['BILD-IMPORT-03-spalten-zuordnen.png', 1440, 900],
  ['BILD-LASSO-01-kartenansicht-mit-lasso.png', 1440, 900],
  ['BILD-LASSO-02-aktiver-zeichenmodus.png', 1440, 900],
  ['BILD-LASSO-03-geschlossene-flaeche.png', 1440, 900],
  ['BILD-LASSO-04-auswahlkarte.png', 1440, 900],
  ['BILD-LASSO-05-gebietsbriefing-prompt.png', 1440, 900],
  ['BILD-LASSO-06-basis-copilot.png', 1440, 900],
  ['BILD-LASSO-07-profi-zielassistent.png', 1440, 900],
  ['BILD-LASSO-08-assistentenauswahl.png', 1440, 900],
  ['BILD-LASSO-MOBIL-01-kartenansicht.png', 390, 844],
  ['BILD-LASSO-MOBIL-02-aktiver-zeichenmodus.png', 390, 844],
  ['BILD-LASSO-MOBIL-03-auswahlkarte.png', 390, 844],
  ['BILD-KUNDE-01-marker-mit-briefing.png', 1440, 900],
  ['BILD-TOUR-01-tourplanung.png', 1440, 900],
  ['BILD-DATEN-01-export-vor-ersatz.png', 1440, 900],
];

const requiredFiles = [
  'docs/guide-ki-wissensbasis.md',
  'docs/schulung-tourfuchs.md',
  'docs/kurzanleitung-tourfuchs.md',
  'docs/bildanleitung-tourfuchs.md',
  'docs/custom-gpt-systemprompt.txt',
  'TourFuchs_KI-Agent_Wissensbasis.pdf',
  'tools/fixtures/docs-screenshot-customers.tsv',
];
const failures = [];
const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const relative of requiredFiles) {
  requireCondition(existsSync(join(root, relative)), `Datei fehlt: ${relative}`);
}

const catalog = readFileSync(join(root, 'docs/bildanleitung-tourfuchs.md'), 'utf8');
for (const [name, expectedWidth, expectedHeight] of expectedScreenshots) {
  const path = join(screenshotDir, name);
  requireCondition(existsSync(path), `Screenshot fehlt: ${name}`);
  if (!existsSync(path)) continue;
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  requireCondition(
    width === expectedWidth && height === expectedHeight,
    `${name}: ${width}x${height}, erwartet ${expectedWidth}x${expectedHeight}`,
  );
  requireCondition(catalog.includes(name), `Bildkatalog nennt ${name} nicht`);
  requireCondition(
    catalog.includes(`https://tourfuchs.vercel.app/docs/screenshots/${name}`),
    `Vollstaendige spaetere HTTPS-URL fehlt fuer ${name}`,
  );
}

const expectedNames = new Set(expectedScreenshots.map(([name]) => name));
for (const name of readdirSync(screenshotDir).filter((entry) => entry.endsWith('.png'))) {
  requireCondition(expectedNames.has(name), `Nicht katalogisierter Screenshot: ${name}`);
}

const knowledgeDocPaths = [
  'docs/guide-ki-wissensbasis.md',
  'docs/schulung-tourfuchs.md',
  'docs/kurzanleitung-tourfuchs.md',
];
const knowledgeDocs = knowledgeDocPaths.map((relative) => readFileSync(join(root, relative), 'utf8'));
for (const [index, document] of knowledgeDocs.entries()) {
  requireCondition(document.includes('Lasso ziehen'), `Dokument ${index + 1}: "Lasso ziehen" fehlt`);
  requireCondition(document.includes('Briefing über alle'), `Dokument ${index + 1}: "Briefing über alle" fehlt`);
  for (const match of document.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '');
    if (/^(?:https?:|data:)/.test(target)) continue;
    const resolved = resolve(root, dirname(knowledgeDocPaths[index]), decodeURIComponent(target));
    requireCondition(existsSync(resolved), `${knowledgeDocPaths[index]}: Bildlink fehlt: ${target}`);
  }
}

const prompt = readFileSync(join(root, 'docs/custom-gpt-systemprompt.txt'), 'utf8');
const utf16Length = prompt.length;
const codePointLength = [...prompt].length;
requireCondition(utf16Length <= 7900, `Systemprompt hat ${utf16Length} UTF-16-Zeichen (maximal 7900)`);
requireCondition(codePointLength <= 7900, `Systemprompt hat ${codePointLength} Codepoints (maximal 7900)`);
requireCondition(prompt.includes('immer vollständig als Text'), 'Systemprompt: Text-vor-Bild-Regel fehlt');
requireCondition(prompt.includes('BILD-LASSO-'), 'Systemprompt: echte Lasso-Bild-IDs fehlen');

if (failures.length) {
  console.error(`Dokumentationspruefung fehlgeschlagen (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Dokumentationspruefung erfolgreich: ${expectedScreenshots.length} Screenshots; ` +
    `Systemprompt ${utf16Length} UTF-16-Zeichen / ${codePointLength} Codepoints.`,
);
