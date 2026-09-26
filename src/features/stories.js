/**
 * Showcase-Stories – reine Datendefinitionen (keine App-Importe, damit sie
 * gefahrlos im Test geladen werden können). Die Engine (src/ui/showcase.js)
 * führt die Schritte auf der echten, laufenden App aus – ein Geister-Cursor
 * klickt echte Bedienelemente, die App reagiert wirklich.
 *
 * Schritttypen:
 *  { t:'say', text, sel?, ms? }   Sprechblase (am Element oder Cursor)
 *  { t:'move', sel }              Cursor zum Element bewegen
 *  { t:'click', sel }             Cursor hin + echten Klick auslösen
 *  { t:'type', sel, text }        In ein Feld tippen (input-Event)
 *  { t:'select', sel, value }     Auswahlfeld setzen (change-Event)
 *  { t:'wait', ms }               Pause
 *  { t:'waitFor', sel, ms? }      Warten, bis Element sichtbar ist
 *  { t:'run', key }               benannter Helfer aus der Engine
 *
 * Schritt-Filter:
 *  desktopOnly / mobileOnly       Gerät
 *  realOnly / demoOnly            Datenlage – siehe `visibleStorySteps`
 */

// Aktuelle ungefähre Laufzeiten ohne manuelle Pausen: am 25.09.2026 in Chrome
// geprüft (Desktop 1440×900, Smartphone-Format 390×844). Kartenladezeiten und
// eigener Datenumfang können variieren. Nach Ablaufänderungen neu messen.
//
// `durationMobile` gilt, wo das Handy weniger Schritte sieht (desktopOnly).
// Ohne diese zweite Zahl versprach das Panel dem Handy die Desktop-Laufzeit –
// bei „Von der Excel-Liste zur Kundenkarte" waren das 44 s für 31 s Vorführung.
//
// `durationOwnData` gilt aus demselben Grund für die Lasso-Demo: Mit eigenen
// Kunden zeigt sie zusätzliche Prompt-Schritte. Die eigene Datenlage braucht
// deshalb eine andere Zeitangabe als die Beispielkunden-Vorschau.
//
// Historische Messungen vor der Überarbeitung vom 25.09.2026:
// Gemessen am 11.08.2026 (Chromium, Produktions-Build) in vier
// Formaten: Desktop 1440×900, Tablet 834×1112 und 1112×834, Handy 390×844.
// Lauf: 28 Durchläufe, 28 ok, 0 Abbrüche, 0 Klickmängel. Drei Zahlen sind
// gestiegen, weil die Tour-Demo das Aussuchen jetzt wirklich zeigt (Vorschläge
// öffnen, zweimal auf „+" tippen) statt die Stopps still zu setzen: „tour"
// 60→68 bzw. 54→59, „handy-qr" 53→56, „chancen" 45→47.
// Die Messung beginnt beim Klick auf die Kachel und endet mit dem
// Ergebnis-Dialog; der Dialog-Vorlauf von rund einer Sekunde ist abgezogen.
//
// Nachgemessen am 12.08.2026, nur „lasso" (die Story ist auf den ganzen Bogen
// umgebaut: umfahren → briefen → entscheiden). Vier Formate mit Beispieldaten,
// je 51–52 s, 4 vorgeführte Klicks, 0 Abbrüche, 0 Klickmängel → 34→51. Dazu ein
// Lauf mit eingefügter Fantasieliste (der Weg des Films, siehe
// docs/film-lasso-briefing.md): 62 s, 6 Klicks, alle sauber – dort treten die
// `realOnly`-Schritte an die Stelle der Demo-Sperre → `durationOwnData` 61.
//
// Ebenfalls am 12.08.2026 erstmals gemessen: „briefing" (derselbe Weg, aber mit
// dem Schwerpunkt im Prompt). Vier Formate mit Beispieldaten je 42 s, 4 Klicks,
// alle sauber → 41. Mit eigener Liste 68 s: Dort kommt das Durchscrollen des
// Prompts dazu, und genau das ist der Unterschied zur Lasso-Demo.
/**
 * Der Weg vom Prompt zum Briefing – in Lasso- und Briefing-Demo gleich
 * erzählt, in mehreren kurzen Blasen statt einem langen Satz. Gezeigt wird
 * nur: Die Vorführung kopiert nichts und öffnet keinen Assistenten.
 */
const PROMPT_WAY = [
    { t: 'say', text: '① Ein Klick legt den Prompt in die Zwischenablage.', sel: '#area-briefing-footer', ms: 3000 },
    { t: 'say', text: '② Dann öffnest du die KI, die deine Firma freigegeben hat – zum Beispiel Microsoft 365 Copilot. Kundendaten gehören aus Datenschutzgründen nur dorthin.', ms: 5200 },
    { t: 'say', text: '③ Einfügen und selbst absenden – TourFuchs ruft keine KI-Schnittstelle auf. Zurück kommt dein Briefing: wen zuerst und warum.', ms: 4600 },
    { t: 'say', text: '④ Mit dem Briefing zurück zu TourFuchs und die Tour planen.', ms: 3000 },
    { t: 'say', text: 'In dieser Vorführung wird nichts kopiert und kein Assistent geöffnet. Prüfe die Antwort der KI, bevor du entscheidest.', ms: 4000 }
];

export const STORIES = [
    {
        // Der Film für Vertriebsbeauftragte: von ganz Deutschland über den
        // eigenen Bezirk bis zur Kundenkachel – nur echte Klicks, kein Sprung.
        id: 'bezirk-zum-kunden',
        optionalModule: 'territoryPlanning',
        icon: '🎯',
        title: 'Vom Bezirk zum Kunden',
        blurb: 'Ganz Deutschland, dein Bezirk, ein Kunde – in wenigen Klicks.',
        duration: 62,   // 26.09.2026: Desktop und Tablet quer je 63 s, 11 Klicks, alle sauber
        desktopOnly: true,
        needsData: true,
        steps: [
            { t: 'run', key: 'overviewSetup' },
            { t: 'say', text: 'Ganz Deutschland auf einen Blick – jede Farbe ist ein Vertriebsbezirk.', sel: '#map', ms: 3000 },
            { t: 'run', key: 'overviewDistrict' },
            { t: 'say', text: 'Alle abwählen, deinen Bezirk anhaken – schon zeigt die Karte nur noch dein Gebiet.', sel: '[data-toggle="bezirk"]', ms: 3200 },
            { t: 'run', key: 'overviewDetail' },
            { t: 'say', text: 'Die Bezirkskachel: wie viele Kunden, wie viel Umsatz und wo die stärksten Standorte liegen.', sel: '#territory-summary-body', ms: 3600 },
            { t: 'run', key: 'districtFocus' },
            { t: 'say', text: 'Hinein in den Bezirk: Aus der Fläche werden Kundenstapel – jeder Tipp geht eine Ebene näher.', sel: '.sc-focus-stack', ms: 3000 },
            { t: 'run', key: 'districtStackToCustomer' },
            { t: 'run', key: 'openCustomerCard' },
            { t: 'say', text: 'Angekommen beim Kunden: Adresse, Kontakt, Umsatz und der letzte Besuch.', sel: '.leaflet-popup-content', ms: 3600, pos: 'bottom' },
            { t: 'say', text: 'Für das ganze Gebiet liegen unten zwei Wege bereit: Briefing und Export – etwa fürs CRM.', sel: '#btn-territory-briefing', ms: 3400 }
        ]
    },
    {
        id: 'tour',
        icon: '🚗',
        title: 'Deine Tour, Schritt für Schritt',
        blurb: 'Startpunkt, Vorschläge, optimierte Route.',
        duration: 70,
        durationMobile: 65,
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'focusDemoTourArea' },
            { t: 'say', text: 'Wir starten in einer Region mit Kunden für eine sichtbare, sinnvolle Tagestour.', ms: 2400, pos: 'bottom' },
            { t: 'run', key: 'gotoTour' },
            // Kein Bezirks-Schritt mehr: Geplant wird ab Werk über alle Bezirke.
            // Der Lauf stellt den Standard nur still sicher.
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'say', text: 'Jetzt einen Startpunkt setzen …', sel: '#start-search', ms: 1500 },
            { t: 'run', key: 'pickStart' },
            // Aussuchen ist der Kern dieses Produkts: Der automatische
            // Tourvorschlag wurde am 10.07.2026 nach Nutzerfeedback gestrichen –
            // „die Tour plant der Mensch". Die Vorführung muss deshalb zeigen,
            // wie jemand die Vorschläge aufschlägt und selbst auswählt, statt
            // die Stopps erscheinen zu lassen.
            { t: 'say', text: 'Jetzt schlägt TourFuchs vor, wen du in der Nähe noch mitnehmen könntest.', sel: '#suggest-head', ms: 2200 },
            { t: 'run', key: 'showSuggestions' },
            { t: 'say', text: 'Aussuchen tust du: Ein Tipp auf das Plus nimmt einen Kunden mit.', sel: '#tour-suggestions', ms: 2600 },
            { t: 'run', key: 'addTwoSuggestions' },
            { t: 'run', key: 'showMyTour' },
            { t: 'say', text: 'Die Stopps stehen. Jetzt sortiert TourFuchs sie in eine sinnvolle Reihenfolge.', sel: '#btn-optimize', ms: 2300 },
            { t: 'click', sel: '#btn-optimize' },
            { t: 'say', text: 'Eine kurze, sinnvolle Reihenfolge – anhand der Luftlinienentfernungen optimiert.', ms: 2800 },
            { t: 'say', text: 'Ein Klick bringt die geplante Tour zurück auf die Karte.', sel: '#btn-route-focus', ms: 2200 },
            { t: 'click', sel: '#btn-route-focus' },
            { t: 'wait', ms: 1500 },
            { t: 'run', key: 'focusTourRoute' },
            { t: 'say', text: 'Die Route liegt auf der Karte – zuerst als Luftlinie.', ms: 2200, pos: 'bottom' },
            { t: 'say', text: 'Die Straßenroute nutzt den externen Dienst OSRM und benötigt deine Zustimmung zur Übertragung der Koordinaten. Die Demo aktiviert sie nicht.', sel: '#btn-route-mode', ms: 5000 },
            { t: 'say', text: 'Reihenfolge und Strecke als Luftlinie stehen. Die Straßenroute kannst du nach der Demo selbst aktivieren.', ms: 3400, pos: 'bottom' },
            { t: 'say', text: 'Und wie kommt die fertige Tour aufs Handy? Genau das zeigt die nächste Demo.', ms: 2800, desktopOnly: true }
        ]
    },
    {
        id: 'handy-qr',
        icon: '📲',
        title: 'Aufs Handy – ohne Kabel, ohne Cloud',
        blurb: 'Tour per QR-Code an dein Smartphone.',
        duration: 53,
        desktopOnly: true,   // Übergabe Desktop -> Handy; auf dem Handy selbst sinnlos
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'say', text: 'Im Schnelldurchlauf entsteht erst eine kleine Tour – Startpunkt und zwei Stopps. Wie in der Tour-Demo.', ms: 2800 },
            { t: 'run', key: 'gotoTour' },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'run', key: 'pickStart' },
            { t: 'say', text: 'Noch zwei Stopps aus den Vorschlägen …', ms: 1800 },
            { t: 'run', key: 'addTwoSuggestions' },
            { t: 'say', text: 'So sieht das Ganze auf dem Handy aus …', sel: '#btn-mobile-preview', ms: 1900 },
            { t: 'click', sel: '#btn-mobile-preview' },
            { t: 'wait', ms: 3200 },
            { t: 'say', text: 'Dieselbe App, im Taschenformat.', ms: 1900 },
            { t: 'click', sel: '#btn-mobile-preview' },
            { t: 'wait', ms: 700 },
            { t: 'say', text: 'Und jetzt die geplante Tour aufs Handy geben …', sel: '#btn-tour-qr', ms: 2000 },
            { t: 'run', key: 'shareTourQr' },
            { t: 'wait', ms: 3200 },
            { t: 'run', key: 'closeQr' },
            { t: 'say', text: 'Mit der Handy-Kamera scannen – die Tour ist drüben. Kein Server, kein Kabel.', ms: 3200 }
        ]
    },
    {
        // Das Hauptgericht – und die einzige Demo, die den ganzen Bogen zeigt:
        // umfahren, briefen lassen, entscheiden. Eine Geste statt eines
        // Formulars, danach ein Prompt statt eines Berichts, am Ende eine Tour
        // statt einer Liste. Genau deshalb steht sie weit vorn.
        //
        // Sie ist zugleich die Vorlage für den LinkedIn-Film
        // (docs/film-lasso-briefing.md): Wer eigene Daten geladen hat, sieht
        // hier den echten Prompt – die Schritte mit `realOnly` treten dann an
        // die Stelle der Demo-Vorschau.
        id: 'lasso',
        icon: '🖊️',
        title: 'Fläche umfahren, Briefing bekommen',
        blurb: 'Einkreisen, fragen „Wen zuerst?", die richtigen in die Tour.',
        duration: 77,   // 26.09.2026: Desktop 78 s, Handy 79 s – Prompt jetzt in beiden Datenlagen
        needsData: true,
        mutatesTour: true,   // am Ende wandern zwei Kunden in die Tour
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'focusDemoTourArea' },
            { t: 'say', text: 'Du bist in einer Gegend unterwegs und siehst deine Kunden auf der Karte.', ms: 2400 },
            { t: 'say', text: 'Statt Regler zu schieben: einfach die Fläche umfahren, die dich interessiert.', sel: '#btn-lasso', ms: 2800 },
            { t: 'run', key: 'drawLasso' },
            { t: 'say', text: 'TourFuchs zeigt dir sofort, wen du erwischt hast – Anzahl, fällige Kunden, Orte. Erst sehen, dann entscheiden.', sel: '.popup-lasso', ms: 3400, pos: 'top' },

            // ---- Der zweite Handgriff: das Briefing über genau diese Kunden ----
            { t: 'say', text: 'Und jetzt die Frage, die TourFuchs allein nicht beantworten kann: Was ist bei diesen Kunden gerade los?', sel: '.popup-lasso', ms: 3400, pos: 'top' },
            { t: 'run', key: 'openLassoBriefing' },
            { t: 'run', key: 'revealAreaPrompt' },
            { t: 'say', text: 'Das ist der fertige Prompt. Er entsteht hier auf deinem Gerät – aus Name, Kundennummer, Ort und Fälligkeit. Umsatz, Telefon und Straße bleiben draußen.', sel: '.briefing-prompt-visible', ms: 4600 },
            ...PROMPT_WAY,
            { t: 'run', key: 'closeLassoBriefing' },

            // ---- Der Rückweg: entscheiden. Die Auswahl liegt noch da. ----
            { t: 'say', text: 'Zurück auf der Karte liegt deine Auswahl noch genau so da. Jetzt entscheidest du: Wen fährst du wirklich an?', sel: '.popup-lasso', ms: 3600, pos: 'top' },
            { t: 'run', key: 'pickLassoCustomers' },
            { t: 'say', text: 'Zwei angehakt – und der Knopf meint jetzt genau die zwei.', sel: '.popup-lasso [data-lasso="tour"]', ms: 2800 },
            { t: 'run', key: 'lassoPickedToTour' },

            { t: 'say', text: 'Die ausgewählten Kunden sind vorgemerkt. Startpunkt und Reihenfolge erklärt die eigene Schulung „Deine Tour, Schritt für Schritt“. Diese Demo hat keinen KI-Bericht abgerufen.', ms: 5000, pos: 'bottom' }
        ]
    },
    {
        // Dieselben zwei Handgriffe wie in „lasso" – aber mit umgekehrtem
        // Schwerpunkt. Dort ist die Geste die Hauptsache und das Briefing die
        // Fortsetzung; hier ist die Fläche nur der Anlauf, und die Zeit liegt
        // im Prompt: was drinsteht, was bewusst nicht, wo er entsteht und wer
        // ihn absendet.
        //
        // Zwei Demos zum selben Weg sind Absicht. Die Frage „was kann das?"
        // beantwortet die Geste in zehn Sekunden. Die Frage „was schickt ihr da
        // eigentlich weg?" – die in jedem Konzern als zweite kommt – beantwortet
        // nur der sichtbare Prompt, und dafür muss man ihn durchscrollen dürfen.
        id: 'briefing',
        icon: '📋',
        title: 'Ein Prompt, deine KI',
        blurb: 'Was im Briefing steht – und was bewusst nicht.',
        duration: 83,   // 26.09.2026: Desktop 84 s, Handy 85 s
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'focusDemoTourArea' },
            { t: 'say', text: 'Eine Fläche umfahren – das ist der schnelle Teil.', ms: 2000 },
            { t: 'run', key: 'drawLasso' },
            { t: 'say', text: 'Die Kunden stehen da. Wer davon ist wirklich dran? Das weiß TourFuchs nicht – das weiß deine Ablage.', sel: '.popup-lasso', ms: 3600, pos: 'top' },
            { t: 'run', key: 'openLassoBriefing' },

            // ---- Ab hier liegt der Schwerpunkt ----
            { t: 'say', text: 'Deshalb baut TourFuchs hier keinen Bericht, sondern eine Frage – als fertigen Prompt.', ms: 3200 },
            { t: 'run', key: 'revealAreaPrompt' },
            { t: 'say', text: 'Er entsteht auf deinem Gerät. Und du siehst ihn vollständig, bevor irgendetwas kopiert wird.', sel: '.briefing-prompt-visible', ms: 3800 },
            { t: 'run', key: 'scrollPromptThrough' },
            { t: 'say', text: 'Das ist alles: Gebiet, die Kunden mit Nummer, Ort und Fälligkeit – und die Aufgabe, eine Reihenfolge zu begründen.', ms: 4200 },
            { t: 'say', text: 'Genauso wichtig ist, was nicht drinsteht: kein Umsatz, keine Telefonnummer, keine E-Mail, keine Straße.', sel: '.briefing-manual-note', ms: 4600 },
            ...PROMPT_WAY,
            { t: 'run', key: 'closeLassoBriefing' },
            { t: 'say', text: 'Und dann entscheidest du.', sel: '.popup-lasso', ms: 2400, pos: 'top' },
            { t: 'run', key: 'pickLassoCustomers' },
            { t: 'run', key: 'lassoPickedToTour' },
            { t: 'say', text: 'Ein Prompt. Deine KI. Deine Entscheidung.', ms: 3000, pos: 'bottom' }
        ]
    },
    {
        id: 'chancen',
        icon: '🎯',
        title: 'Spontaner Termin? Briefing vorbereiten',
        blurb: 'Passenden Kunden finden und mit fertigem Briefing-Prompt starten.',
        duration: 55,
        durationMobile: 45,
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoTour' },
            { t: 'say', text: 'Du bist unterwegs und ein spontaner Kundentermin wird möglich.', ms: 2200 },
            // Die Karten-Einfärbung „Chancen" gibt es bewusst nur am Desktop (dort ist
            // die Karte sichtbar). Am Handy übersprungen – der Tour-Flow findet fällige
            // Kunden ohnehin über „Nähe" und „Überfällige zuerst".
            { t: 'say', text: '„Chancen" zeigt dir dafür nur fällige und überfällige Kunden.', sel: '.seg[data-view="chancen"]', ms: 2400, desktopOnly: true },
            { t: 'run', key: 'chancenOn', desktopOnly: true },
            { t: 'wait', ms: 1400 },
            { t: 'say', text: 'Der Startpunkt ist schnell gesetzt …', ms: 1800 },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'run', key: 'pickStart' },
            { t: 'run', key: 'addOneSuggestion' },
            { t: 'say', text: 'Einen passenden Kunden in der Nähe ausgesucht. Jetzt kurz vorbereiten.', sel: '#tour-stops', ms: 2600 },
            { t: 'run', key: 'openCustomerBriefing' },
            { t: 'say', text: 'Hier bereitest du den Prompt vor. Die Demo ruft keinen KI-Bericht ab und sendet nichts an einen Assistenten.', sel: '#customer-briefing-dialog', ms: 3600 },
            { t: 'say', text: 'Mit echten Kunden: kopieren, Kopierbestätigung abwarten, im freigegebenen Assistenten einfügen und selbst absenden.', sel: '#customer-briefing-dialog', ms: 4400 },
            { t: 'run', key: 'closeCustomerBriefing' },
            { t: 'say', text: 'Der nächste Kunde steht fest. Die KI-Antwort prüfst du danach. Eigene Quellen benötigt die KI als freigegebene Anbindung.', ms: 4100 }
        ]
    },
    {
        id: 'excel-karte',
        icon: '🗺️',
        title: 'Von der Excel-Liste zur Kundenkarte',
        blurb: 'Liste einfügen, Stapel verstehen, bis zum Detail aufzoomen.',
        duration: 54,
        durationMobile: 34,   // am Handy entfallen die Einfüge-Schritte
        minRuntimeMs: 15000,
        steps: [
            { t: 'say', text: 'TourFuchs macht aus einer Kundenliste eine verständliche Deutschlandkarte.', sel: '#map', ms: 2400 },
            // Der schnellste Weg zu eigenen Daten findet sich nicht von selbst –
            // also wird er vorgeführt. Am Handy übersprungen: Dort ist die
            // Kundenliste selten in einer Tabellen-App offen.
            { t: 'say', text: 'Und wie kommen deine Kunden hinein? Meist ist die Liste ohnehin in Excel offen – dann braucht es nicht einmal eine Datei.', ms: 3400, desktopOnly: true },
            { t: 'run', key: 'openPasteDemo', desktopOnly: true },
            { t: 'say', text: 'In Excel markieren, Strg+C – und hier einfügen.', sel: '#paste-input', ms: 2600, desktopOnly: true },
            { t: 'run', key: 'pasteDemoTable', desktopOnly: true },
            { t: 'say', text: 'TourFuchs sagt sofort, was es erkannt hat. Danach nur noch die Spalten prüfen – fertig.', sel: '#paste-status', ms: 3200, desktopOnly: true },
            { t: 'run', key: 'closePasteDemo', desktopOnly: true },
            { t: 'say', text: 'Für diese Vorführung bleiben wir bei Beispielkunden – deine Daten rührt die Demo nicht an.', ms: 2800, desktopOnly: true },
            { t: 'run', key: 'excelToMap' },
            { t: 'say', text: 'Jeder Stapel sagt sofort, wie viele Kunden hier liegen. Antippen bedeutet: eine Ebene näher.', sel: '.customer-stack-card', ms: 3200 },
            { t: 'run', key: 'zoomToCustomerCards' },
            { t: 'say', text: 'Näher dran wird aus dem Stapel jede einzelne Kundenkachel – die Farbe zeigt den Vertriebsbezirk.', sel: '.customer-marker-card', ms: 2800 },
            { t: 'run', key: 'openCustomerCard' },
            { t: 'say', text: 'So entsteht der Zusammenhang ganz natürlich: Region, Kundenkarte, Details – Adresse, Kontakt und Umsatz auf einen Blick.', sel: '.leaflet-popup-content', ms: 3600, pos: 'bottom' },
            { t: 'say', text: 'Und von hier ist alles einen Tipp entfernt: anrufen, zur Tour hinzufügen, Gesprächs-Briefing.', sel: '.leaflet-popup-content', ms: 3000, pos: 'bottom' }
        ]
    },
    {
        // Der Weg einer echten Excel-Datei – mit dem Schritt, an dem Neue
        // unsicher werden: „Meine Spalte heißt anders – geht das trotzdem?"
        // Die Beispieldatei trägt deshalb eigene Spaltennamen; „Firmenbezeichnung"
        // erkennt TourFuchs nicht und wird sichtbar von Hand zugeordnet.
        // Importiert wird nichts: Die Vorführung bricht vor „Importieren" ab.
        id: 'import-zuordnung',
        icon: '📊',
        title: 'Deine Excel-Liste importieren',
        blurb: 'Datei wählen, Spalten zuordnen – auch wenn sie anders heißen.',
        duration: 40,   // gemessen 26.09.2026: 39–40 s in allen vier Formaten
        steps: [
            { t: 'say', text: 'Deine Kundenliste liegt als Excel-Datei vor? So kommt sie hinein – auch wenn die Spalten anders heißen als bei uns.', ms: 3400 },
            { t: 'run', key: 'openImportDemo' },
            { t: 'say', text: 'Hier wählst du deine Excel- oder CSV-Datei. Für die Vorführung nehmen wir eine Beispieldatei.', sel: '#btn-upload', ms: 3200 },
            { t: 'run', key: 'importDemoFile' },
            { t: 'say', text: 'TourFuchs liest die Datei und sagt, was drinsteht: sechs Kunden, sechs Spalten.', sel: '#mapping-file-info', ms: 3000 },
            { t: 'say', text: 'Vieles erkennt es von selbst – Straße, PLZ, Ort, Vertriebsbezirk und Umsatz sind schon zugeordnet.', sel: '#mapping-rows select[data-field="plz"]', ms: 3600 },
            { t: 'say', text: '„Firmenbezeichnung" kennt es nicht – das Pflichtfeld Kundenname ist noch leer.', sel: '#mapping-rows select[data-field="name"]', ms: 3200 },
            { t: 'select', sel: '#mapping-rows select[data-field="name"]', value: 'Firmenbezeichnung' },
            { t: 'say', text: 'Einmal auswählen – die Beispielwerte daneben zeigen sofort, ob es passt.', sel: '#mapping-rows select[data-field="name"]', ms: 3000 },   // nicht die Beispielzelle: deren Anscrollen schob am Handy die Feldnamen aus dem Bild
            { t: 'say', text: 'Für die Karte reicht schon die PLZ, die Straße macht die Position genauer. Kontakt, Besuchsrhythmus und mehr liegen unter „Weitere Felder".', sel: '#mapping-more', ms: 4000 },
            { t: 'say', text: 'Jetzt würdest du „Importieren" tippen – und deine Kunden stehen auf der Karte.', sel: '#mapping-confirm', ms: 3000 },
            { t: 'run', key: 'closeImportDemo' },
            { t: 'say', text: 'Für die Vorführung brechen wir hier ab – deine Daten rührt die Demo nicht an.', ms: 2800 }
        ]
    },
    {
        id: 'gebietsueberblick',
        optionalModule: 'territoryPlanning',
        icon: '🧭',
        title: 'Mein Gebiet im Überblick',
        blurb: 'Bezirk filtern, Umsatz eingrenzen, Kunden und große Kacheln ansehen.',
        duration: 75,
        desktopOnly: true,
        needsData: true,
        steps: [
            { t: 'run', key: 'overviewSetup' },
            { t: 'say', text: 'Erst Übersicht gewinnen: Die Flächen zeigen Landkreise, die Farben deine Vertriebsbezirke.', sel: '#colormode-select', ms: 3000 },
            { t: 'run', key: 'overviewDistrict' },
            { t: 'say', text: 'Alle abwählen, einen Bezirk anhaken: Die Karte zeigt jetzt nur diese Auswahl.', sel: '[data-toggle="bezirk"]', ms: 3200 },
            { t: 'run', key: 'overviewRevenue' },
            { t: 'say', text: 'Von und Bis begrenzen den Umsatz. Bei aktivem Filter fehlen Kunden ohne Umsatzangabe; 0 Euro ist ein gültiger Wert.', sel: '#revenue-filter-summary', ms: 4600 },
            { t: 'say', text: 'Auch Kundentyp ist hier filterbar, sofern du diese Spalte importiert hast.', sel: '#team-filters', ms: 3000 },
            { t: 'run', key: 'overviewMinimum' },
            { t: 'say', text: 'Zum Beispiel drei sichtbare Kunden: Erst dann wird der Landkreis eingefärbt. Einzelne Ausreißer bleiben neutral.', sel: '#min-region-customers', ms: 4200 },
            { t: 'say', text: 'Für die Detailansicht setzen wir die Mindestzahl wieder auf eins und öffnen die Bezirkskachel.', ms: 3000 },
            { t: 'run', key: 'overviewDetail' },
            { t: 'say', text: 'Groß und lesbar: Kundenanzahl, vorhandener Umsatz und die stärksten Standorte des ausgewählten Bezirks.', sel: '#territory-summary-body', ms: 3600 },
            { t: 'run', key: 'overviewZoom' },
            { t: 'say', text: 'Hineinzoomen, Flächen ausblenden, Kunden ansehen: Hier steht auch der Umsatz, sofern vorhanden.', sel: '.leaflet-popup-content', ms: 3800, pos: 'bottom' },
            { t: 'say', text: 'Deine bisherigen Filter werden danach wiederhergestellt. Die Simulation findest du in einer eigenen Schulung.', ms: 2800 }
        ]
    },
    {
        id: 'simulation',
        optionalModule: 'territoryPlanning',
        icon: '🧪',
        title: 'Was wäre wenn? Gebiete umbauen – ohne Risiko',
        blurb: 'Testweise umverteilen, Wirkung sofort sehen.',
        duration: 42,
        desktopOnly: true,   // Gebietsplanung/Cockpit gibt es nur auf dem Desktop
        needsData: true,
        patchConfirm: true,   // „Verwerfen" bestätigt sich in der Vorführung automatisch
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'gotoGebiete' },
            { t: 'say', text: 'Das Gebiets-Cockpit: Kennzahlen je Vertriebsbezirk auf einen Blick.', sel: '#btn-cockpit', ms: 2400 },
            { t: 'run', key: 'openCockpit' },
            { t: 'say', text: 'Ich buche testweise Gebiete auf einen anderen Bezirk um …', ms: 2400 },
            { t: 'run', key: 'simAssign' },
            { t: 'say', text: 'Schau die Kennzahlen: grün rauf, rot runter – Zeile für Zeile sofort sichtbar.', ms: 4200 },
            { t: 'run', key: 'simToMap' },
            { t: 'say', text: 'Und auf der Karte: Alt, Neu und nur die Änderungen.', ms: 2200 },
            { t: 'run', key: 'simCycleViews' },
            { t: 'say', text: 'Experimentieren erlaubt – echt wird es erst beim „Übernehmen". Ich verwerfe das jetzt.', sel: '#simulation-map-discard', ms: 3400 },
            { t: 'run', key: 'simDiscard' }
        ]
    },
    {
        id: 'service-tag',
        optionalModule: 'service',
        icon: '🛠️',
        title: 'Dein Service-Tag, verständlich geplant',
        blurb: 'Einsätze rein – erklärbarer Tagesplan raus.',
        duration: 46,
        desktopOnly: true,   // Service-Fokus (Profi) gibt es nur auf dem Desktop
        needsData: true,
        mutatesTour: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'say', text: 'TourFuchs kann auch Service: Verträge und Einsatzaufträge – getrennt importiert, exakt über die Kundennummer verknüpft.', ms: 3000 },
            { t: 'run', key: 'gotoService' },
            { t: 'say', text: 'Im Service-Fokus zählen nur Vertragskunden und offene Einsätze – die Zähler zeigen den Handlungsbedarf.', sel: '#service-customer-scope', ms: 3000 },
            { t: 'run', key: 'gotoServiceTour' },
            { t: 'say', text: 'Startpunkt – schnell gesetzt …', ms: 1800 },
            { t: 'run', key: 'pickBezirkAll' },
            { t: 'run', key: 'pickServiceStart' },
            { t: 'say', text: 'Startpunkt steht. Jetzt plant TourFuchs den Tag – lokal auf deinem Gerät, ohne Cloud.', sel: '#btn-service-day-preview', ms: 2600 },
            { t: 'run', key: 'buildServiceDay' },
            { t: 'say', text: 'Fertig: Stopps mit Uhrzeiten, Fahrzeiten, Rückkehr und Auslastung.', sel: '#service-day-preview', ms: 2800 },
            { t: 'say', text: 'Und jeder Stopp erklärt sich selbst – Priorität, SLA, Zeitfenster. Keine Blackbox.', sel: '#service-day-preview', ms: 3000 },
            { t: 'say', text: 'Ein Klick auf „Übernehmen" macht daraus die fixe Tagestour – inklusive Tagesplan-Druck und Kalender.', ms: 3200 },
            { t: 'say', text: 'Und vor Ort hilft optional Zanobo: Das Smartphone vergleicht das Anlagen-Geräusch mit seiner Referenz – lokal, als Orientierung, keine Diagnose.', ms: 3200 }
        ]
    },
    {
        id: 'empfang',
        icon: '📥',
        title: 'Verschlüsselte Daten aufs Handy holen',
        blurb: 'Datei wählen, Schlüssel scannen, fertig.',
        duration: 29,
        mobileOnly: true,     // Gegenstück zur Desktop-QR-Story; nur am Handy sinnvoll
        needsData: true,
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'openReceive' },
            { t: 'say', text: 'Am Desktop hast du deine Daten verschlüsselt exportiert – so holst du sie sicher aufs Handy.', ms: 2600 },
            { t: 'say', text: 'Schritt 1: die verschlüsselte Datei (.tfsafe) wählen, die du dir geschickt hast.', sel: '#safe-file-input', ms: 2800 },
            { t: 'run', key: 'showReceiveKeyStep' },
            { t: 'say', text: 'Schritt 2: den Schlüssel-QR mit der Kamera scannen – der Schlüssel reist getrennt von der Datei.', sel: '#safe-scan-video', ms: 3000 },
            { t: 'say', text: 'Kamera klappt nicht? Dann den Schlüssel einfach eintippen – so:', sel: '#safe-key-input', ms: 2200 },
            { t: 'run', key: 'typeReceiveKeyDemo' },
            { t: 'say', text: 'Danach noch eine eigene PIN festlegen – ab dann liegen die Daten verschlüsselt auf diesem Handy.', sel: '#safe-key-input', ms: 3000 },
            { t: 'run', key: 'closeReceive' },
            { t: 'say', text: 'Fertig: dieselben Kunden wie am Desktop – sicher in deiner Tasche, ganz ohne Cloud.', sel: '#map', ms: 3200, pos: 'bottom' }
        ]
    },
    {
        id: 'tresor',
        icon: '🔐',
        title: 'Deine Daten im Tresor',
        blurb: 'Verschlüsselt, PIN-geschützt, sicher aufs Handy.',
        duration: 30,
        needsData: true,
        mutatesVault: true,   // Demo legt einen Tresor an – cleanup baut ihn wieder ab
        steps: [
            { t: 'run', key: 'ensureDemo' },
            { t: 'run', key: 'openVaultSetup' },
            { t: 'say', text: 'Ein Tipp aufs 🔓-Symbol oben – und du legst eine PIN fest.', sel: '#setup-pin', ms: 2400 },
            { t: 'run', key: 'typePinDemo' },
            { t: 'say', text: 'PIN zweimal eingeben – ab dann sind deine Daten AES-256-verschlüsselt.', sel: '#setup-pin2', ms: 2600 },
            { t: 'run', key: 'submitVaultSetup' },
            { t: 'say', text: 'In der echten Einrichtung erscheint jetzt dieser einmalige Wiederherstellungscode. Er gehört getrennt vom Gerät aufbewahrt.', sel: '#recovery-code', ms: 3400 },
            { t: 'say', text: 'Entsperrt wird künftig per PIN – oder per Face-/Touch-ID, wenn dein Gerät das kann.', ms: 2600 },
            { t: 'say', text: 'Geht das Gerät verloren, bleiben die Daten unlesbar. Das ist der Tresor.', ms: 2400 },
            { t: 'run', key: 'finishVaultDemo' },
            { t: 'say', text: 'Ab jetzt wacht das Schloss hier oben: Ein Tipp sperrt sofort – entsperrt wird per PIN oder Face-ID.', sel: '#btn-vault-toggle', ms: 3400 }
        ]
    }
];

/**
 * Statische Selektoren, die in index.html vorhanden sein MÜSSEN. Der
 * Guardrail-Test prüft das – so bricht ein künftiger Umbau die Stories nicht
 * unbemerkt. (Dynamisch gerenderte Elemente wie #tour-bezirk sind bewusst
 * nicht dabei; sie werden per waitFor/Helfer abgesichert.)
 */
/**
 * Stories für die aktuelle Ansicht.
 * - `desktopOnly` entfällt auf dem Smartphone (Funktionen, die es dort nicht
 *   gibt – Gebietsplanung – oder die dort sinnlos sind – Tour AN das Handy
 *   senden, während man schon am Handy ist).
 * - `mobileOnly` entfällt am Desktop (z. B. Daten AUFS Handy empfangen).
 * @param {{isDesktop?: boolean, territoryPlanningEnabled?: boolean, serviceEnabled?: boolean}} [opts]
 */
export function visibleStories({
    isDesktop = true,
    territoryPlanningEnabled = false,
    serviceEnabled = false
} = {}) {
    return STORIES.filter((s) => {
        if (s.desktopOnly && !isDesktop) return false;
        if (s.mobileOnly && isDesktop) return false;
        if (s.optionalModule === 'territoryPlanning' && !territoryPlanningEnabled) return false;
        if (s.optionalModule === 'service' && !serviceEnabled) return false;
        return true;
    });
}

/**
 * Schritte einer Story, die in der aktuellen Ansicht sinnvoll sind.
 *
 * Neben dem Gerät entscheidet die **Datenlage**. Grund ist das Briefing: Mit
 * Beispielkunden baut TourFuchs bewusst keinen Prompt (`renderDemoOnly`), mit
 * eigenen Kunden steht er vollständig da. Eine Vorführung, die beides mit
 * demselben Satz begleitet, sagt in einem der beiden Fälle die Unwahrheit –
 * und ausgerechnet der Fall mit echten Daten ist der, den man filmt.
 *
 * - `realOnly`: nur mit eigenen Kunden (der Prompt ist wirklich da)
 * - `demoOnly`: nur mit Beispielkunden (die geschützte Vorschau)
 *
 * @param {{isDesktop?: boolean, hasOwnData?: boolean}} [opts]
 */
export function visibleStorySteps(story, { isDesktop = true, hasOwnData = false } = {}) {
    return (story?.steps || []).filter((step) => {
        if (step.desktopOnly && !isDesktop) return false;
        if (step.mobileOnly && isDesktop) return false;
        if (step.realOnly && !hasOwnData) return false;
        if (step.demoOnly && hasOwnData) return false;
        return true;
    });
}

/** Definierter, temporärer Tourzustand für reproduzierbare Vorführungen. */
export function prepareShowcaseTour(tour, { radiusKm = 50 } = {}) {
    return {
        ...tour,
        bezirk: null,
        start: null,
        destination: null,
        stops: [],
        radiusKm,
        roundTrip: false,
        suggestMode: 'radius',
        mapFocus: false,
        routeLineMode: 'air'
    };
}

const RUHR_CENTER = { lat: 51.48, lng: 7.08 };
const RUHR_ROUTE_TARGETS = [
    { lat: 51.47, lng: 6.85 }, // Oberhausen
    { lat: 51.45, lng: 7.02 }, // Essen
    { lat: 51.50, lng: 7.40 }  // westliches Dortmund
];

function geoDistanceKm(a, b) {
    const rad = Math.PI / 180;
    const dLat = (Number(b.lat) - Number(a.lat)) * rad;
    const dLng = (Number(b.lng) - Number(a.lng)) * rad;
    const lat1 = Number(a.lat) * rad;
    const lat2 = Number(b.lat) * rad;
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function nearestTo(target, candidates) {
    return [...candidates].sort((a, b) => geoDistanceKm(target, a) - geoDistanceKm(target, b))[0] || null;
}

/**
 * Wählt für die Tour-Demo drei geografisch getrennte Kunden. Im Regelfall
 * entsteht Oberhausen -> Essen -> westliches Dortmund; bei anderen Datensätzen
 * wird dieselbe Tagesentfernung rund um den nächstgelegenen Kunden nachgebildet.
 */
export function selectShowcaseTour(customers, { areaRadiusKm = 85, maxRouteKm = 60 } = {}) {
    const located = customers.filter((c) => Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng)));
    if (located.length < 3) return null;

    const ruhr = located.filter((c) => geoDistanceKm(RUHR_CENTER, c) <= areaRadiusKm);
    const start = nearestTo(RUHR_ROUTE_TARGETS[0], ruhr.length ? ruhr : located);
    if (!start) return null;

    const routePool = located.filter((c) => c.id !== start.id && geoDistanceKm(start, c) <= maxRouteKm);
    const choose = (target, desiredKm, minFromStart, used = [], minFromUsed = 7) => routePool
        .filter((c) => !used.some((u) => u.id === c.id))
        .filter((c) => geoDistanceKm(start, c) >= minFromStart)
        .filter((c) => used.every((u) => u.id === start.id || geoDistanceKm(u, c) >= minFromUsed))
        .sort((a, b) => {
            const score = (c) => geoDistanceKm(target, c) + Math.abs(geoDistanceKm(start, c) - desiredKm) * 0.35;
            return score(a) - score(b);
        })[0] || null;

    let first = choose(RUHR_ROUTE_TARGETS[1], 14, 7, [start]);
    if (!first) first = choose(RUHR_ROUTE_TARGETS[1], 18, 2, [start], 2);
    let second = first ? choose(RUHR_ROUTE_TARGETS[2], 38, 18, [start, first], 8) : null;
    if (!second && first) second = choose(RUHR_ROUTE_TARGETS[2], 32, 8, [start, first], 4);
    if (!first || !second) return null;

    const points = [start, first, second];
    return {
        start,
        stops: [first, second],
        center: {
            lat: points.reduce((sum, p) => sum + Number(p.lat), 0) / points.length,
            lng: points.reduce((sum, p) => sum + Number(p.lng), 0) / points.length
        },
        inRuhr: geoDistanceKm(RUHR_CENTER, start) <= areaRadiusKm
    };
}

/**
 * Die Laufzeit, die dem Nutzer versprochen wird.
 *
 * Sie hängt an denselben zwei Größen wie die Schrittauswahl: am Gerät (das
 * Handy sieht bei manchen Demos weniger Schritte) und an der Datenlage (mit
 * eigenen Kunden zeigt die Lasso-Demo zusätzlich den echten Prompt).
 */
export function storyDuration(story, { isDesktop = true, hasOwnData = false } = {}) {
    if (hasOwnData && story?.durationOwnData) return story.durationOwnData;
    if (!isDesktop && story?.durationMobile) return story.durationMobile;
    return story?.duration || 25;
}

export const CRITICAL_SELECTORS = [
    '#btn-showcase-ob',
    '.mode-btn[data-mode="aussendienst"]',
    '.mode-btn[data-mode="gebietsplanung"]',
    '.mode-btn[data-mode="service"]',
    '#service-customer-scope',
    '#service-day-planner',
    '#btn-service-day-preview',
    '#service-day-preview',
    '.tab-button[data-tab="tour"]',
    '.tab-button[data-tab="gebiete"]',
    '#tour-scope',
    '#start-search',
    '#btn-optimize',
    '#btn-route-focus',
    '#btn-gmaps',
    '#btn-mobile-preview',
    '#btn-tour-qr',
    '#qr-share-dialog',
    '#mobile-preview',
    '#btn-cockpit',
    '#cockpit-dialog',
    '#cockpit-to-map',
    '#sim-select-all',
    '#sim-rep',
    '#sim-apply',
    '#simulation-map-bar',
    '#simulation-map-discard',
    '[data-simulation-view]',
    '.seg[data-view="chancen"]',
    '#customer-briefing-dialog',
    '.tab-button[data-tab="daten"]',
    // Einfüge-Vorführung (Demo „Von der Excel-Liste zur Kundenkarte")
    '#own-data-dialog',
    '#own-data-dialog [data-compliance-optin]',
    '#btn-paste',
    '#paste-dialog',
    '#paste-input',
    '#paste-status',
    '#vault-controls',
    '#btn-vault-toggle',
    '#vault-dialog',
    '#btn-safe-export',
    '#btn-safe-receive',
    '#safe-receive-dialog',
    '#safe-step-file'
];
