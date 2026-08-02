/**
 * Der Gebiets-Editor ist der einzige Dialog der App, der **nicht** modal ist.
 *
 * Anlass war eine Inventur aller 22 Dialoge (01.08.2026). Achtzehn davon sind
 * zu Recht modal: Sie stellen eine Entscheidung, die alles andere anhält
 * (Bestand ersetzen, Einwilligung, Tresor), oder sie sind selbst das Ziel
 * (Import-Strecke, Info, QR-Übergabe). Vier sind Vertiefungen eines
 * Kartenobjekts – und bei genau einem davon verdeckt der Vorhang die
 * Entscheidungsgrundlage:
 *
 * Der Editor beantwortet „welchem Bezirk gebe ich diese Kunden?". Die Antwort
 * steht auf der Karte – welches Gebiet liegt daneben, wo ist die Lücke, wer
 * grenzt an. Ein Modal legt sich genau darüber und macht sie zusätzlich
 * unbedienbar. Er ist deshalb angedockt statt daraufgelegt.
 *
 * Dieser Test bewacht die drei Stellen, an denen das wieder kippen könnte:
 * das Öffnen, die Platzierung und die Fluchttaste. Die vierte – dass die Karte
 * tatsächlich schiebbar bleibt – kann nur ein echter Browser beantworten und
 * ist im PR mit `page.mouse` nachgewiesen worden.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');
const editor = read('src/ui/regionEditor.js');
const css = read('src/styles/components.css');

describe('Gebiets-Editor: angedockt statt darübergelegt', () => {
    it('öffnet ohne Vorhang', () => {
        expect(editor).toContain('dialog.show()');
        // `showModal()` würde den Backdrop und damit die Sperre zurückbringen.
        // Geprüft wird der Aufruf, nicht das Wort: In den Kommentaren steht
        // ausdrücklich, warum es hier gerade **nicht** benutzt wird.
        expect(editor).not.toMatch(/\.showModal\s*\(/);
    });

    it('füllt einen offenen Editor neu, statt ihn zweimal zu öffnen', () => {
        // Ohne diese Bedingung wirft ein zweiter Klick auf ein Gebiet, oder der
        // Editor bliebe auf dem alten Gebiet stehen. Genau das Weiterklicken ist
        // der Gewinn, den das Modal vorher verhindert hat.
        expect(editor).toContain('if (!dialog.open) dialog.show();');
    });

    it('behält die Fluchttaste, die der Browser nur Modalen schenkt', () => {
        expect(editor).toContain("if (ev.key !== 'Escape') return;");
        expect(editor).toContain('dialog.close();');
    });

    it('steht am Rand und lässt die Karte frei', () => {
        const block = css.slice(css.indexOf('#region-edit-dialog {'));
        expect(block).toContain('position: fixed');
        // `inset: auto` löst die Auto-Zentrierung, die ein Dialog sonst hat.
        expect(block).toContain('inset: auto');
        expect(block).toContain('right: 14px');
        // Gedeckelte Breite: Ein Editor über die halbe Karte hätte den Vorhang
        // nur schmaler gemacht, statt ihn wegzunehmen.
        expect(block).toContain('width: min(420px, 38vw)');
    });

    it('ordnet sich über der Kartenbedienung ein', () => {
        // Ein `show()`-Dialog kommt nicht in den Top-Layer und braucht deshalb
        // eine eigene Einordnung – über Knopfzeile (1035) und Streifen (1040).
        const block = css.slice(css.indexOf('#region-edit-dialog {'));
        const z = Number(block.match(/z-index:\s*(\d+)/)?.[1]);
        expect(z).toBeGreaterThan(1040);
    });

    it('bleibt in der Touransicht ausgeblendet', () => {
        // Gebietsplanung ist Desktop-Profi; daran ändert das Andocken nichts.
        const responsive = read('src/styles/responsive.css');
        expect(responsive).toContain('#region-edit-dialog[open]');
        expect(responsive).toContain('#region-edit-dialog {');
    });
});
