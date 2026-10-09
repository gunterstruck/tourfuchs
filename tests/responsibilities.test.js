import { describe, expect, it } from 'vitest';
import { customerResponsibilities, responsibilityBriefingLines, splitContactText } from '../src/features/responsibilities.js';
import { buildCustomerBriefingPrompt } from '../src/features/customerBriefing.js';
import { MESSAGES } from '../src/i18n/messages.js';
import { readFileSync } from 'node:fs';

const kunde = {
    id: 'k-nr:1001', nummer: '1001', name: 'Nord GmbH', plz: '50667', ort: 'Köln',
    extra: {
        VK: 'Vera Kunz 0171 2223344',
        OM: 'Olaf Meier, Tel. +49 (221) 555-12',
        'TSP TC': 'Technik-Team Köln',
        RTC: '',
        TAM: 'TAM West 0800 1234567',
        'Account Manager': 'Max Acc',
        'EB-Berater': 'EB Team 0221/99887',
        'Account Name': 'Nord Gruppe',
        'Account Cluster': 'Cluster A',
        'PA Kundenanfrage': 'PI-Partner Kunde',
        'Named Account': 'x',
        'IFA-Nr.': 'IFA1',
        'USt-IdNr': 'DE123456789'
    }
};

describe('Name und Telefonnummer aus einer Zelle', () => {
    it.each([
        ['Vera Kunz 0171 2223344', 'Vera Kunz', '01712223344'],
        ['Olaf Meier, Tel. +49 (221) 555-12', 'Olaf Meier', '+4922155512'],
        ['EB Team 0221/99887', 'EB Team', '022199887'],
        ['Technik-Team Köln', 'Technik-Team Köln', ''],
        // Echte Zellen aus der Zuständigkeitsliste (09.10.2026)
        ['RC-DE DI S TSP TC Region OST', 'RC-DE DI S TSP TC Region OST', ''],
        ['Zumann Barbara +49 (221) 84592648', 'Zumann Barbara', '+4922184592648'],
        ['Thienel Sascha +49 (911) 958-21055', 'Thienel Sascha', '+4991195821055']
    ])('„%s"', (cell, name, tel) => {
        expect(splitContactText(cell)).toMatchObject({ name, tel });
    });

    it('hält Kundennummern und Jahreszahlen nicht für Telefonnummern', () => {
        expect(splitContactText('Team 2026').tel).toBe('');
        expect(splitContactText('DE123456789').tel).toBe('');
    });
});

describe('Zuständig in der Kundenkachel', () => {
    it('zeigt Rollen in fester Reihenfolge, leere Rollen nicht, IFA/USt nie', () => {
        const { roles, account, badges } = customerResponsibilities(kunde);
        expect(roles.map((r) => r.label)).toEqual(['VK', 'OM', 'TSP TC', 'TAM', 'Account Manager', 'EB-Berater']);
        expect(account).toBe('Nord Gruppe · Cluster A');
        expect(badges).toEqual(['PI-Partner Kunde', 'Named Account']);
        expect(JSON.stringify(roles)).not.toContain('DE123456789');
    });

    it('lässt den Account-Namen weg, wenn er nur der Kundenname ist', () => {
        const { account } = customerResponsibilities({ name: 'Süd AG', extra: { 'Account Name': 'Süd AG', 'Account Cluster': 'Cluster B' } });
        expect(account).toBe('Cluster B');
    });

    it('ohne Zuständigkeitsspalten: nichts', () => {
        expect(customerResponsibilities({ name: 'X', extra: { Branche: 'Bau' } })).toEqual({ roles: [], account: '', badges: [] });
    });

    it('ist in der Kachel angebunden und übersetzt', () => {
        const map = readFileSync('src/features/map.js', 'utf8');
        expect(map).toContain('${responsibilitiesBlockHtml(customer)}');
        expect(map).toContain('href="tel:${escapeHtml(role.tel)}"');
        for (const locale of ['de', 'en', 'fr', 'es']) {
            expect(MESSAGES[locale]['customer.team.title'], locale).toBeTruthy();
            expect(MESSAGES[locale]['customer.team.call'], locale).toContain('{role}');
        }
    });
});

describe('Zuständig im KI-Briefing', () => {
    it('nennt Account, Kennzeichen und Team – ohne Telefonnummern', () => {
        const lines = responsibilityBriefingLines(kunde);
        expect(lines).toEqual([
            '- Account: Nord Gruppe · Cluster A',
            '- Kennzeichen: PI-Partner Kunde, Named Account',
            '- Internes Kundenteam: VK Vera Kunz; OM Olaf Meier; TSP TC Technik-Team Köln; TAM TAM West; Account Manager Max Acc; EB-Berater EB Team'
        ]);
        const prompt = buildCustomerBriefingPrompt(kunde);
        expect(prompt).toContain('- Internes Kundenteam: VK Vera Kunz');
        expect(prompt).not.toContain('0171');
    });
});
