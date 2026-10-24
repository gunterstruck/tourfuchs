/**
 * Zusätzliche Pillen in der Knopfzeile über der Karte.
 *
 * - „Live-Demos" steht am Schreibtisch dauerhaft rechts in der Kopfzeile.
 *   Auch wer schon arbeitet, braucht manchmal eine Schulung. Die Übersicht
 *   markiert weiterhin bereits angesehene Demos.
 *
 * Die frühere Pille „📋 Briefing für mein Gebiet" (Gebietsplanung) gibt es seit
 * 24.10.2026 nicht mehr (PO: Briefings nur für einen Kunden oder höchstens
 * 8 Kunden aus Lasso, Tourvorschlägen und „In der Nähe"). „⬇ Gebiet
 * exportieren" ist schon länger entfallen, ebenso jeder Excel-Export.
 */
import { openShowcaseOverview } from './showcase.js';

export function initMapPills() {
    document.getElementById('btn-demos-pill')?.addEventListener('click', () => openShowcaseOverview());
}
