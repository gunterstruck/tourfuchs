import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'custom-gpt-upload');
const sources = [
  ['docs/guide-ki-wissensbasis.md', 'guide-ki-wissensbasis.md'],
  ['docs/schulung-tourfuchs.md', 'schulung-tourfuchs.md'],
  ['docs/kurzanleitung-tourfuchs.md', 'kurzanleitung-tourfuchs.md'],
  ['docs/bildanleitung-tourfuchs.md', 'bildanleitung-tourfuchs.md'],
  ['docs/custom-gpt-systemprompt.txt', 'custom-gpt-systemprompt.txt'],
  ['TourFuchs_KI-Agent_Wissensbasis.pdf', 'TourFuchs_KI-Agent_Wissensbasis.pdf'],
];

mkdirSync(target, { recursive: true });
for (const [source, name] of sources) {
  copyFileSync(join(root, source), join(target, name));
}

const guide = readFileSync(join(root, 'docs/guide-ki-wissensbasis.md'), 'utf8');
const version = guide.match(/^\*\*Version:\*\*\s*([^\n]+)/m)?.[1]?.trim() ?? 'unbekannt';
const appVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
writeFileSync(
  join(target, 'README.md'),
  `# TourFuchs - Dateien fuer den Custom GPT\n\n` +
    `Generierter Uploadstand: Wissensbasis ${version}, App ${appVersion}.\n\n` +
    `Diese Kopien nicht direkt bearbeiten. Die Quellen liegen unter \`docs/\` sowie im Repository-Stamm. ` +
    `Nach jeder Aenderung zuerst \`npm run docs:pdf\` und danach \`npm run docs:gpt-upload\` ausfuehren.\n\n` +
    `Den Inhalt von \`custom-gpt-systemprompt.txt\` in das Feld fuer die Anweisungen kopieren; ` +
    `die uebrigen Markdown- und PDF-Dateien als Wissen hochladen.\n`,
  'utf8',
);

console.log(`Custom-GPT-Uploadordner aktualisiert: ${target}`);
