# Vorlagen zum Weitergeben

Excel-Vorlagen, die **nicht** mit der App ausgeliefert werden (anders als
`public/templates/`, die der Import selbst anbietet). Sie liegen hier, damit sie
nicht verloren gehen und bei Bedarf an Kollegen gehen können.

| Datei | Wofür | Stand |
|---|---|---|
| `TourFuchs_Promotoren_Vorlage.xlsx` | Was die Promotion-Kollegen liefern müssen, damit Promotoren mit TPE-Thema in der Kundenkachel stehen (Release 16, „Promotor N" / „Promotor N TPE-Thema", #435). | 19.10.2026 |

## Promotoren-Vorlage

Drei Blätter, in dieser Reihenfolge:

1. **Import TourFuchs** (muss das erste Blatt bleiben – TourFuchs liest das
   erste Blatt mit Daten): Vertrieb/Datenpflege fügt Kd-Nr., Kundenname und PLZ
   aus dem Kundenstamm ein. Die Spaltenpaare „Promotor 1 … 6" / „Promotor N
   TPE-Thema" füllen sich per Formel (INDEX/VERGLEICH über einen Hilfsschlüssel
   „PLZ-3#n"); vorbereitet für 1.000 Kunden.
2. **Promotoren**: Promotion-Kollegen füllen aus – eine Zeile je PLZ-3-Gebiet,
   Promotor und TPE-Thema. Mehrere Promotoren oder Themen je Gebiet = mehrere
   Zeilen mit derselben PLZ-3. Gelb = eintragen, blau = Formel.
3. **Anleitung**: wer liefert was, Regeln (PLZ als Text, Namen immer gleich
   schreiben, mehr als 6 Promotoren), was TourFuchs daraus macht.

Die Beispielnamen (Eva Ost, Jan Nord) sind erfunden. Telefon und E-Mail sind
bewusst nicht vorgesehen (PO 19.10.2026). Ein Reimport mit diesen Spalten
ersetzt die Spalten-Promotoren; Promotoren aus Kontaktlisten bleiben.
