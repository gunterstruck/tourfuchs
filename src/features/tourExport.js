/**
 * Tour-Exporte: druckbarer Tagesplan und Kalender-Datei (.ics).
 * Zeiten werden aus einer geschätzten Besuchsdauer und der Luftlinien-Fahrzeit
 * hochgerechnet (grobe Planungshilfe, keine echte Routing-Zeit).
 */

import { CONFIG } from '../core/config.js';
import { currentLocale, t } from '../core/i18n.js';
import { DEMO_DATA_LABEL, hasDemoCustomers, isDemoCustomer } from '../core/demoSafety.js';
import { distanceKm } from '../services/geocode.js';
import { zanoboMachineUrl } from '../services/zanobo.js';
import { formatDateDe, lastVisit, agoText } from './visits.js';
import { openPrintView } from '../ui/printView.js';

export const DEFAULT_VISIT_MINUTES = 45; // Standard-Besuchsdauer (im UI einstellbar)
const AVG_SPEED_KMH = 60;      // Durchschnittstempo für Fahrzeit-Schätzung

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

/**
 * Fahr-/Besuchszeiten für die Stopps berechnen.
 * @returns {Array<{customer, arrival: Date, driveMin, km}>}
 */
export function schedule(start, stops, startTime, visitMinutes = DEFAULT_VISIT_MINUTES) {
    const result = [];
    let current = start;
    let clock = new Date(startTime);
    for (const c of stops) {
        const km = distanceKm(current, c) * CONFIG.tour.roadFactor;
        const driveMin = Math.round((km / AVG_SPEED_KMH) * 60);
        clock = new Date(clock.getTime() + driveMin * 60000);
        result.push({ customer: c, arrival: new Date(clock), driveMin, km });
        clock = new Date(clock.getTime() + visitMinutes * 60000);
        current = c;
    }
    return result;
}

/** Zielzeile: Ankunft am Endpunkt – kein Besuch, kein Termin. */
function destinationRow(point, arrival, extra = {}) {
    return { customer: point, arrival, end: arrival, driveMin: 0, km: 0, durationMin: 0, visitIds: [], isDestination: true, ...extra };
}

/**
 * Zeilen für Druck und Kalender.
 *
 * @param {{ point: object, isCustomer: boolean } | null} destination
 *   Endpunkt der Tour, wenn er als letzter Eintrag in `stops` steht. Ein Ort
 *   (Büro, Zuhause) ist nie ein Besuch. Im bestätigten Service-Plan ist auch
 *   ein Kunde als Endpunkt nur das Ende des Tages – er darf die bestätigten
 *   Zeiten nicht kippen (früher: Plan verworfen, 45-Minuten-„Besuch" im Büro).
 */
function exportRows(start, stops, startTime, visitMinutes, servicePlan, destination = null) {
    const itinerary = Array.isArray(servicePlan?.itinerary) ? servicePlan.itinerary : [];
    const planned = new Set(itinerary.map((entry) => entry.customerId));
    const hasDestination = Boolean(destination?.point) && stops[stops.length - 1] === destination.point;
    const visitStops = hasDestination ? stops.slice(0, -1) : stops;

    if (itinerary.length && visitStops.length && visitStops.every((customer) => planned.has(customer?.id))) {
        const rows = planRows(visitStops, itinerary);
        if (hasDestination) {
            const finish = new Date(servicePlan?.metrics?.finishAt || '');
            rows.push(destinationRow(destination.point, Number.isNaN(finish.getTime()) ? rows[rows.length - 1].end : finish, { planned: true }));
        }
        return rows;
    }

    const rows = schedule(start, stops, startTime, visitMinutes).map((row) => ({
        ...row,
        end: new Date(row.arrival.getTime() + visitMinutes * 60000),
        durationMin: visitMinutes,
        visitIds: [],
        planned: false
    }));
    // Ohne Plan bleibt ein Kunde als Ziel ein Besuch; ein reiner Ort nicht.
    if (hasDestination && !destination.isCustomer) {
        const last = rows[rows.length - 1];
        rows[rows.length - 1] = destinationRow(destination.point, last.arrival, { driveMin: last.driveMin, km: last.km, planned: false });
    }
    return rows;
}

/**
 * Dem Plan folgen, nicht der Stoppliste: Ein Kunde mit zwei Einsätzen in
 * getrennten Zeitfenstern (vormittags + nachmittags) steht dort zweimal.
 */
function planRows(stops, itinerary) {
    const byId = new Map(stops.map((customer) => [customer.id, customer]));
    return itinerary.filter((entry) => byId.has(entry.customerId)).map((entry) => {
        const arrival = new Date(entry.start || entry.arrival);
        const end = new Date(entry.end);
        return {
            customer: byId.get(entry.customerId),
            arrival,
            end,
            driveMin: Number(entry.driveMin) || 0,
            km: Number(entry.km) || 0,
            durationMin: Number(entry.durationMin) || Math.max(1, Math.round((end - arrival) / 60000)),
            visitIds: Array.isArray(entry.visitIds) ? entry.visitIds : [],
            planned: true
        };
    });
}

function visitsForRow(row, serviceVisits) {
    const byId = new Map((serviceVisits || []).map((visit) => [visit.id, visit]));
    return row.visitIds.map((id) => byId.get(id)).filter(Boolean);
}

function hhmm(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Druckbaren Tagesplan in neuem Fenster öffnen */
export function printDayPlan(start, stops, {
    startTime = defaultStart(), tourName = 'Tagestour', visitMinutes = DEFAULT_VISIT_MINUTES,
    servicePlan = null, serviceVisits = [], destination = null
} = {}) {
    const rows = exportRows(start, stops, startTime, visitMinutes, servicePlan, destination);
    const planned = rows.length > 0 && rows.every((row) => row.planned);
    const demo = isDemoCustomer(start) || hasDemoCustomers(stops);
    const totalKm = planned && Number.isFinite(Number(servicePlan?.metrics?.totalKm))
        ? Number(servicePlan.metrics.totalKm)
        : rows.reduce((sum, r) => sum + r.km, 0);
    const effectiveStart = planned ? `${servicePlan.workDate}T${servicePlan.shiftStart}` : startTime;
    const dateStr = new Date(effectiveStart).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    const visitCount = rows.filter((row) => !row.isDestination).length;
    const body = rows.map((r, i) => {
        const c = r.customer;
        if (r.isDestination) {
            const label = c.label || c.name || 'Ziel';
            const where = c.adresse || [c.strasse, `${c.plz ?? ''} ${c.ort ?? ''}`.trim()].filter(Boolean).join(', ');
            return `<tr>
            <td class="num">🏁</td>
            <td class="time">${hhmm(r.arrival)}</td>
            <td><b>Ziel: ${escapeHtml(label)}</b>${where ? `<br>${escapeHtml(where)}` : ''}</td>
            <td class="check"></td>
        </tr>`;
        }
        const addr = [c.strasse, `${c.plz} ${c.ort}`.trim()].filter(Boolean).join(', ');
        const contact = [c.ansprechpartner, c.telefon].filter(Boolean).join(' · ');
        const last = lastVisit(c);
        const visits = visitsForRow(r, serviceVisits);
        const serviceDetails = visits.map((visit) => {
            const zanobo = zanoboMachineUrl(visit.assetId);
            return [
                visit.workOrderId,
                visit.reason,
                visit.priority && `Priorität ${visit.priority}`,
                visit.assignedTo
            ].filter(Boolean).map(escapeHtml)
                .concat(zanobo ? [`<a href="${escapeHtml(zanobo)}">🔊 Zanobo</a>`] : [])
                .join(' · ');
        }).join('<br>');
        return `<tr>
            <td class="num">${i + 1}</td>
            <td class="time">${hhmm(r.arrival)}${r.planned ? `–${hhmm(r.end)}` : ''}<br><span class="muted">${r.driveMin} min · ${Math.round(r.km)} km</span></td>
            <td>
                <b>${escapeHtml(c.name)}</b><br>
                ${escapeHtml(addr)}
                ${contact ? `<br><span class="muted">${escapeHtml(contact)}</span>` : ''}
                ${serviceDetails ? `<br><span class="service">${serviceDetails}</span>` : ''}
                ${c.rhythmusWochen ? `<br><span class="muted">Rhythmus: ${c.rhythmusWochen} Wochen · letzter Besuch ${last ? formatDateDe(last) : '—'} (${agoText(last)})</span>` : ''}
            </td>
            <td class="check">☐</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
        <title>${escapeHtml(tourName)} – ${dateStr}</title>
        <style>
            body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { font-size: 1.4rem; margin: 0 0 2px; }
            .sub { color: #64748b; margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
            th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; }
            .num { font-weight: 700; width: 28px; }
            .time { white-space: nowrap; font-variant-numeric: tabular-nums; }
            .check { font-size: 1.3rem; width: 30px; text-align: center; }
            .muted { color: #64748b; font-size: 0.85rem; }
            .service { display: inline-block; margin-top: 4px; color: #0f766e; font-size: 0.85rem; }
            .demo { padding: 8px 10px; background: #fffbeb; border: 1px solid #f59e0b; color: #92400e; font-weight: 700; }
            .foot { margin-top: 16px; color: #64748b; font-size: 0.85rem; }
            @media print { body { margin: 0; } .noprint { display: none; } }
        </style></head><body>
        <h1>🦊 ${escapeHtml(tourName)}</h1>
        ${demo ? `<p class="demo">${DEMO_DATA_LABEL}</p>` : ''}
        <p class="sub">${dateStr} · Start ${planned ? escapeHtml(servicePlan.shiftStart) : hhmm(new Date(startTime))} bei „${escapeHtml(start.label)}" · ${visitCount} Besuche · ca. ${Math.round(totalKm)} km</p>
        <table>
            <thead><tr><th>#</th><th>Ankunft</th><th>Kunde</th><th>✓</th></tr></thead>
            <tbody>${body}</tbody>
        </table>
        <p class="foot">${planned
            ? `Bestätigter Service-Tagesvorschlag · Rückkehr ${escapeHtml(String(servicePlan?.metrics?.finishAt || '').slice(11, 16) || '—')} · Fahrzeiten bleiben Planungsschätzungen.`
            : `Zeiten geschätzt (${visitMinutes} min je Besuch, ${AVG_SPEED_KMH} km/h Fahrt).`} Erstellt mit TourFuchs Vertrieb.</p>
        </body></html>`;

    return openPrintView(html);
}

function icsEscape(text) {
    return String(text ?? '').replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
}

function icsDate(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Tour als .ics-Datei (ein VEVENT je Stopp) herunterladen */
export function downloadIcs(start, stops, {
    startTime = defaultStart(), tourName = 'Tagestour', visitMinutes = DEFAULT_VISIT_MINUTES,
    servicePlan = null, serviceVisits = [], destination = null
} = {}) {
    // Der Endpunkt ist kein Termin.
    const rows = exportRows(start, stops, startTime, visitMinutes, servicePlan, destination).filter((row) => !row.isDestination);
    const demo = isDemoCustomer(start) || hasDemoCustomers(stops);
    const now = icsDate(new Date());
    const lines = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//TourFuchs//${currentLocale().toUpperCase()}`, 'CALSCALE:GREGORIAN'
    ];
    rows.forEach((r, i) => {
        const c = r.customer;
        const end = r.end || new Date(r.arrival.getTime() + visitMinutes * 60000);
        const addr = [c.strasse, `${c.plz} ${c.ort}`.trim()].filter(Boolean).join(', ');
        const serviceDetails = visitsForRow(r, serviceVisits).flatMap((visit) => [
            visit.workOrderId && t('tour.ics.order', { value: visit.workOrderId }),
            visit.reason && t('tour.ics.reason', { value: visit.reason }),
            visit.priority && t('tour.ics.priority', { value: visit.priority }),
            visit.assignedTo && t('tour.ics.responsible', { value: visit.assignedTo }),
            visit.sourceUrl && t('tour.ics.source', { value: visit.sourceUrl }),
            zanoboMachineUrl(visit.assetId) && t('tour.ics.listenMachine', { value: zanoboMachineUrl(visit.assetId) })
        ]).filter(Boolean);
        const desc = [
            demo && t('tour.export.demoLabel'),
            c.ansprechpartner && t('tour.ics.mainContact', { name: c.ansprechpartner }),
            c.telefon && t('tour.ics.phone', { phone: c.telefon }),
            c.email && `E-Mail: ${c.email}`,
            c.nummer && t('tour.ics.customerNumber', { number: c.nummer }),
            ...serviceDetails
        ].filter(Boolean).join('\n');
        lines.push(
            'BEGIN:VEVENT',
            `UID:tourfuchs-${Date.now()}-${i}@tourfuchs`,
            `DTSTAMP:${now}`,
            `DTSTART:${icsDate(r.arrival)}`,
            `DTEND:${icsDate(end)}`,
            `SUMMARY:${icsEscape(`${demo ? '[DEMO] ' : ''}${i + 1}. ${c.name} (${tourName})`)}`,
            addr ? `LOCATION:${icsEscape(addr)}` : '',
            desc ? `DESCRIPTION:${icsEscape(desc)}` : '',
            'END:VEVENT'
        );
    });
    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.filter(Boolean).join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileName = `${demo ? 'DEMO-' : ''}${tourName}`.replace(/[^\w-]+/g, '-');
    a.download = `${fileName}-${new Date(startTime).toISOString().slice(0, 10)}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Nächster Werktag, 8:00 Uhr */
function defaultStart() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d;
}
