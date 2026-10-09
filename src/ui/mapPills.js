/**
 * Zusätzliche Pillen in der Knopfzeile über der Karte.
 *
 * - „Live-Demos" steht am Schreibtisch dauerhaft rechts in der Kopfzeile.
 *   Auch wer schon arbeitet, braucht manchmal eine Schulung. Die Übersicht
 *   markiert weiterhin bereits angesehene Demos.
 * - Gebietsplanung: „📋 Briefing für mein Gebiet". Wer hier auf die Karte
 *   schaut, ist meist der Vertriebsbeauftragte in seinem eigenen Gebiet – er
 *   will wissen, was dort los ist. Es wirkt auf die **gerade sichtbaren**
 *   Kunden, also genau das, was der Bezirks- und Umsatzfilter zeigt.
 *   Vergleich und Simulation sind Werkzeuge der Vertriebsleitung; die bleiben
 *   im Panel zu entdecken.
 *
 * Die frühere Pille „⬇ Gebiet exportieren" gibt es nicht mehr: Es gibt einen
 * Excel-Export (Daten), und der fragt bei aktivem Filter „alle oder nur die
 * gefilterten?". Ein zweiter Weg zum selben Ziel war nur Geräusch auf der Karte.
 */
import { state, on, visibleCustomers } from '../core/state.js';
import { briefingOrder, territoryLabel } from '../features/territoryPills.js';
import { openAreaBriefing } from './areaBriefing.js';
import { openShowcaseOverview } from './showcase.js';

function sync() {
    const hasData = state.customers.length > 0;
    const inTerritory = state.ui.mode === 'gebietsplanung' && hasData;
    const visibleCount = inTerritory ? visibleCustomers().length : 0;
    const briefing = document.getElementById('btn-territory-briefing');
    if (briefing) briefing.hidden = !inTerritory || visibleCount === 0;

}

export function initMapPills() {
    document.getElementById('btn-demos-pill')?.addEventListener('click', () => openShowcaseOverview());
    document.getElementById('btn-territory-briefing')?.addEventListener('click', () => {
        const customers = visibleCustomers();
        openAreaBriefing(briefingOrder(customers), territoryLabel(customers));
    });

    ['customers:changed', 'filters:changed', 'mode:changed', 'depth:changed', 'showcase:story-completed', 'app:ready']
        .forEach((event) => on(event, sync));
    sync();
}
