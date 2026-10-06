import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { translate } from '../src/core/i18n.js';

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('Mobiles Karten-Grundgerüst in vier Sprachen', () => {
    it('übersetzt die sichtbaren französischen Kartenaktionen', () => {
        expect(translate('fr', 'mobile.vault.setupLabel')).toBe('Configurer le coffre-fort de données');
        expect(translate('fr', 'mobile.night.darkLabel')).toBe('Mode nuit : thème sombre avec carte lumineuse');
        expect(translate('fr', 'mobile.next.nearbyShort')).toBe('À proximité');
        expect(translate('fr', 'mobile.lasso.draw')).toBe('Tracer un lasso');
        expect(translate('fr', 'mobile.map.label')).toBe('Carte de l’Allemagne');
        expect(translate('fr', 'customer.cluster.zoom', { context: '12 clients dans cette zone' }))
            .toBe('12 clients dans cette zone – touchez pour zoomer');
    });

    it('übersetzt die sichtbaren spanischen Kartenaktionen', () => {
        expect(translate('es', 'mobile.vault.setupLabel')).toBe('Configurar la bóveda de datos');
        expect(translate('es', 'mobile.night.darkLabel')).toBe('Vista nocturna: tema oscuro con mapa de luces');
        expect(translate('es', 'mobile.next.nearbyShort')).toBe('Cerca');
        expect(translate('es', 'mobile.lasso.draw')).toBe('Dibujar lazo');
        expect(translate('es', 'mobile.map.label')).toBe('Mapa de Alemania');
        expect(translate('es', 'customer.cluster.zoom', { context: '12 clientes en esta zona' }))
            .toBe('12 clientes en esta zona – toca para acercar');
    });

    it('rendert dynamische Bedienelemente nach einem Sprachwechsel neu', () => {
        const main = read('src/main.js');
        const sidebar = read('src/ui/sidebar.js');
        const lasso = read('src/ui/lasso.js');
        const vault = read('src/ui/lockVault.js');
        const map = read('src/features/map.js');
        const html = read('index.html');

        expect(main).toContain("onLocaleChanged: (fn) => on('locale:changed', fn)");
        expect(sidebar).toContain("on('locale:changed', updateMobileNextStep)");
        expect(lasso).toContain("on('locale:changed', renderLassoButton)");
        expect(vault).toContain("on('locale:changed', renderControls)");
        expect(map).toContain('translate: t');
        expect(html).toContain('data-i18n-aria-label="mobile.map.label"');
    });
});
