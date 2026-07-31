/**
 * Zwei Hürden im ersten Lauf sind bewusst entfernt worden:
 *
 *  1. Der Tresor wurde nach jedem eigenen Import per PIN-Dialog ohne Abbrechen
 *     erzwungen – mitten im ersten Erfolgserlebnis. Er ist jetzt ein Angebot.
 *  2. Die Tour verlangte vorab eine Bezirkswahl. Standard sind alle Bezirke.
 *
 * Beides darf nicht still zurückfallen, und die Sicherheitszusage darf dabei
 * nicht verloren gehen: Der Hinweis wandert vom Dialog an ein dauerhaft
 * sichtbares Schloss in der Kopfzeile.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    state,
    setCustomers,
    replaceCustomers,
    customerInTourScope,
    tourScopedCustomers
} from '../src/core/state.js';

const source = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

const CUSTOMERS = [
    { id: 'a', name: 'Alpha', plz: '45127', bezirk: 'West' },
    { id: 'b', name: 'Beta', plz: '50667', bezirk: 'Ost' },
    { id: 'c', name: 'Gamma', plz: '20095', bezirk: '' }
];

describe('Tourplanung: „alle Bezirke" ist der Standard', () => {
    beforeEach(() => {
        setCustomers(CUSTOMERS.map((customer) => ({ ...customer })), { fileName: 'test.xlsx' });
    });

    it('startet ohne Bezirkswahl planbar', () => {
        // Frischer Zustand: Es wurde nie etwas gewählt – trotzdem ist jeder
        // Kunde planbar. Vorher lieferte der Scope hier eine leere Liste.
        replaceCustomers(CUSTOMERS.map((customer) => ({ ...customer })), { fileName: 'neu.xlsx' });
        expect(state.tour.bezirk).toBe('__all__');
        expect(tourScopedCustomers()).toHaveLength(3);
        expect(CUSTOMERS.every((customer) => customerInTourScope(customer))).toBe(true);
    });

    it('lässt das bewusste Einschränken auf einen Bezirk unverändert', () => {
        state.tour.bezirk = 'West';
        expect(tourScopedCustomers().map((customer) => customer.id)).toEqual(['a']);
    });

    it('kennt im Auswahlfeld keinen Leer-Eintrag mehr', () => {
        const panel = source('src/ui/tourPanel.js');
        expect(panel).not.toContain('– Bezirk wählen –');
        // Altzustände (z. B. aus einer laufenden Sitzung) werden eingefangen.
        expect(panel).toContain("if (!state.tour.bezirk || state.tour.bezirk === '__none__') state.tour.bezirk = '__all__';");
    });

    it('blendet die Bezirkszeile aus, wenn es nichts zu entscheiden gibt', () => {
        const panel = source('src/ui/tourPanel.js');
        expect(panel).toContain('if (bezirke.length <= 1)');
    });

    it('hängt den Planer an vorhandene Kunden statt an eine Bezirkswahl', () => {
        const panel = source('src/ui/tourPanel.js');
        expect(panel).toContain('planner.hidden = state.customers.length === 0');
    });

    it('führt in der Live-Demo keinen Bezirks-Schritt mehr vor', () => {
        const stories = source('src/features/stories.js');
        expect(stories).not.toContain('Zuerst den Vertriebsbezirk wählen');
        // Der Lauf stellt den Standard weiterhin still sicher.
        expect(stories).toContain("{ t: 'run', key: 'pickBezirkAll' }");
    });
});

describe('Datentresor: Angebot statt Pflicht nach dem Import', () => {
    it('öffnet nach eigenem Import keinen erzwungenen PIN-Dialog mehr', () => {
        const vault = source('src/ui/lockVault.js');
        const handler = vault.slice(vault.indexOf('function onDataImported'), vault.indexOf('// ---- Biometrie'));
        expect(handler).not.toContain('openSetupDialog');
        expect(handler).not.toContain('forced: true');
        expect(handler).toContain('showToast(');
    });

    it('sagt es genau einmal und merkt sich das', () => {
        const vault = source('src/ui/lockVault.js');
        expect(vault).toContain("const VAULT_OFFER_KEY = 'tf_vault_offer_seen'");
        expect(vault).toContain('if (vaultOfferSeen()) return;');
        // „Daten löschen" ist ein Neustart – der Hinweis darf wiederkommen.
        expect(vault).toContain("on('dataset:cleared'");
        expect(vault).toContain('markVaultOfferSeen(false)');
    });

    it('macht den ungeschützten Zustand dauerhaft sichtbar statt blockierend', () => {
        const vault = source('src/ui/lockVault.js');
        const css = source('src/styles/layout.css');
        expect(vault).toContain("toggle.classList.toggle('unprotected', !enabled && ownDataPresent())");
        expect(css).toContain('.icon-button.unprotected');
        // Beispieldaten sind nicht schützenswert – kein Alarm ohne Gegenstand.
        expect(vault).toContain('function ownDataPresent()');
        expect(vault).toContain('isDemoDataset');
    });

    it('hält am erzwungenen Setup fest, wo Schutz die Absicht war (sicherer Umzug)', () => {
        // Wer Daten verschlüsselt von einem anderen Gerät empfängt, hat sich für
        // Schutz bereits entschieden. Nur der Onboarding-Weg wurde entlastet.
        expect(source('src/ui/safeTransfer.js')).toContain('forced: true');
    });
});
