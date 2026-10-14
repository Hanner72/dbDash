# dbDash – dannerbam Dash

Ein von Johann Danner entwickeltes Dashboard für Simracer: kostenlose Overlays für **iRacing** – frei nutzbar und unverändert weitergebbar (Lizenz: CC BY-NC-ND 4.0, siehe unten).

- **Relative** – Fahrer direkt vor und hinter dir mit Zeitabstand, Lizenz und iRating.
  Orange = eine Runde vor dir (überrundet dich), Blau = eine Runde hinter dir (du überrundest).
- **Standings** – Wertung nach Klassen mit SOF. Spalten einzeln ein-/ausschaltbar: **Plätze +/−** (seit dem Start
  gewonnen ▲ / verloren ▼), **Startplatz**, **Landesflagge** (iRacing-Flair), **Box** (wer gerade in der Box ist, sonst Anzahl Stopps),
  Startnummer, Lizenz, iRating,
  **iRating +/−** (Prognose, falls das Rennen mit dem aktuellen Stand endet), **Incidents**, letzte/beste Runde, Abstand.
  Lila = schnellste Runde der Klasse.
- **Inputs** – Gas/Bremse-Verlauf, Pedalbalken, Gang, Tempo, Lenkrad.
- **Delta** – Delta zur besten Runde mit Balken, Rundenzeit-Prognose, beste und letzte Runde.
- **Dashboard** – großes Fahrer-Display: Schaltblitze, Gang, Tempo, Gas-/Bremsbalken, Delta, Position mit Plätzen +/−,
  Restzeit, Runde, Uhr, Flaggen-Feld (Blau, Gelb, Weiß, Karo …) mit Pitlimiter-Hinweis, TC / TC 2 / ABS / Bremsbalance / Motor-Map
  und Sprit (Liter, Ø pro Runde, Reichweite, Nachtank-Menge bis ins Ziel).
  Zwei umschaltbare Fenster (links/rechts) mit diesen Anzeigen: Reifen (Temperatur, Druck, Verschleiß), Motor (Wasser, Öl,
  Drücke, Batterie), Sprit-Strategie, **Relative – Gesamt**, **Relative – Klasse** (je 3 Autos vor/hinter dir),
  **Abstände – Gesamt**, **Abstände – Klasse** (Zeitabstand zum Vorder- und Hintermann nach Position – „−“ = vor dir, „+“ = hinter dir –, mit Trend pro Runde
  ▲/▼ – grün = gut für dich, rot = schlecht – sowie deren letzte und beste Runde),
  Rundenzeiten (**Prognose**, letzte, beste) und **Schaden** (Auto-Grafik: Karosserie in der Farbe der Schadensstufe, Motor-Warnungen, Reifenverschleiß; dazu Pflicht- und optionale Reparaturzeit).
  Für jede Anzeige wählst du in den Einstellungen **Links, Rechts oder Aus**.
  Umschalten per Taste oder Lenkradknopf.
- **Radar (Ghost)** – Draufsicht mit den Autos vor, hinter und neben dir, gezeichnet als GT3-Blueprint (dein Auto grün,
  Klassenfarbe auf dem Dach). Reichweite 1–80 m, gemessen als Lücke
  Stoßstange zu Stoßstange. Rot = neben dir, Orange = Lücke unter 7 m. Seiten-Warnung links/rechts, Lücke zum nächsten
  Auto davor/dahinter. Erscheint nur, solange ein Auto innerhalb der Reichweite ist, und verschwindet sofort wieder;
  in der Qualifikation bleibt das Radar aus.

Alle Overlays werden automatisch ausgeblendet, solange der Motor nicht läuft (abschaltbar).

Hinweise: Die iRating-Prognose verwendet die von der Community ermittelte iRacing-Formel und ist eine Schätzung
(berechnet pro Klasse, nur in Rennsessions). Deine eigenen Incidents werden immer live angezeigt.
Die Incidents anderer Fahrer hält iRacing während der Session geheim – dbDash zählt deshalb ihre Ausritte neben die
Strecke (je 1x) und zeigt diese Schätzung *kursiv und abgeblendet*. Kontakte (2x/4x) sind darin nicht enthalten.

Radar: iRacing liefert keine seitliche Position der anderen Autos, nur den Abstand auf der Strecke und die
Spotter-Meldung „Auto links/rechts“. Das Radar zeigt deshalb Autos davor/dahinter mittig und Autos neben dir
auf der Seite, die der Spotter meldet. Dashboard: Werte, die ein Auto nicht hat (z. B. TC) oder die iRacing nicht
live liefert, werden als „–“ angezeigt. Reifenwerte aktualisiert iRacing je nach Auto teils nur beim Boxenstopp.

## Starten

1. ZIP entpacken (z. B. nach `C:\Programme\dbDash` oder auf den Desktop).
2. **`dbDash.exe`** starten. Beim ersten Start läuft der **Demo-Modus** mit einem simulierten Rennen,
   damit du alles sofort siehst.
3. Für echte Daten: im Einstellungsfenster **Demo-Modus ausschalten** und iRacing starten.

Windows-SmartScreen kann beim ersten Start warnen, weil die Datei nicht signiert ist:
„Weitere Informationen“ → „Trotzdem ausführen“.

**Wichtig:** iRacing unter *Options → Graphics* auf **Borderless Window** stellen.
Im exklusiven Vollbild kann Windows keine Fenster über dem Spiel anzeigen.

## Bedienung

| Aktion | Wie |
| --- | --- |
| Overlays verschieben | `Alt+Shift+E` (oder Schalter im Einstellungsfenster), Overlay mit der Maus ziehen, nochmal `Alt+Shift+E` |
| Alle ein-/ausblenden | `Alt+Shift+H` |
| Dashboard links/rechts umschalten | `Alt+Shift+←` / `Alt+Shift+→` (zurückblättern frei belegbar) |

Alle Tasten lassen sich im Einstellungsfenster unter **Tasten & Lenkradknöpfe** neu belegen: „Zuweisen“ klicken und
eine Taste oder einen Knopf am Lenkrad / an der Button-Box drücken. Pro Aktion geht je eine Taste und ein Lenkradknopf.
Lenkradknöpfe funktionieren auch, während iRacing im Vordergrund ist (Windows-Joystick-Schnittstelle: bis 16 Geräte,
je 32 Knöpfe + Coolie-Hat). Achtung: Eine hier belegte Tastatur-Taste bekommt iRacing nicht mehr – Lenkradknöpfe schon.
| Einstellungen | Klick auf das dbDash-Symbol im Infobereich der Taskleiste |
| Beenden | Rechtsklick auf das Symbol → Beenden |

Größe und Hintergrund-Deckkraft lassen sich pro Overlay einstellen. Positionen werden gespeichert
(`%APPDATA%\dbDash\settings.json`).

## Stream Deck

- **Ohne Plugin:** Stream-Deck-Aktion „Tastenkürzel“ mit einer Taste **F13–F24** belegen und diese im Einstellungsfenster
  unter „Tasten & Lenkradknöpfe“ zuweisen. F13–F24 gibt es auf keiner Tastatur, iRacing kommt also nicht durcheinander.
- **Mit Plugin „Web Requests“ (BarRaider):** eine Adresse aufrufen lassen, z. B.
  `http://127.0.0.1:8182/api/action/dashLeft` oder direkt eine Anzeige öffnen: `http://127.0.0.1:8182/api/page/gapClass`.
  Alle Adressen stehen zum Kopieren im Einstellungsfenster, die Liste gibt es auch unter `http://127.0.0.1:8182/api/list`.

## SimHub

Im Ordner `Grafiken` liegen zwei Symbole zum Umschalten des Dashboards (links / rechts) als PNG (72, 144, 256, 512 px)
und SVG. In SimHub eine Schaltfläche in einem Dashboard (Dash Studio) mit dem Bild versehen und eine Taste von
**F13–F24** senden lassen; diese Taste in dbDash unter „Tasten & Lenkradknöpfe“ zuweisen. Die 144-px-Variante passt
auch direkt aufs Stream Deck.

## OBS / Streaming

Jedes Overlay ist auch eine Webseite, solange dbDash läuft:

- `http://127.0.0.1:8182/relative.html`
- `http://127.0.0.1:8182/standings.html`
- `http://127.0.0.1:8182/inputs.html`
- `http://127.0.0.1:8182/delta.html`
- `http://127.0.0.1:8182/dash.html`
- `http://127.0.0.1:8182/radar.html`

In OBS: *Quelle hinzufügen → Browser*, Adresse einfügen, Breite/Höhe z. B. 430×300, 640×460, 600×110, 380×130, 860×500, 220×300.

## Anpassen

Die Overlays sind normale HTML-/CSS-/JavaScript-Dateien im Ordner `resources\web` und dürfen für den eigenen
Gebrauch angepasst werden (veränderte Versionen bitte nicht weitergeben – siehe Lizenz).
Änderungen sind nach dem Neuladen sofort sichtbar (dbDash neu starten). Daten kommen per WebSocket
(`ws://127.0.0.1:8182/ws`) als JSON – siehe `common.js` (`PW.onState(...)`).

## Technik

- Electron (Chromium + Node.js), iRacing-Telemetrie direkt aus dem Shared Memory des offiziellen iRacing-SDK
  (`Local\IRSDKMemMapFileName`) über koffi/Win32-API.
- Quellcode: `src/main.js` (Fenster, Webserver), `src/irsdk.js` (SDK-Reader), `src/state.js` (Relative/Standings-Berechnung),
  `src/fuel.js` (Sprit-Rechner), `src/race.js` (Startplätze, Boxenstopps), `src/joystick.js` (Lenkradknöpfe), `src/demo.js` (Simulation).

## Selbst bauen (nur für den eigenen Gebrauch)

Voraussetzung: **Node.js 22 oder neuer** (LTS von https://nodejs.org). Dann im Quellcode-Ordner in der Eingabeaufforderung:

| Befehl | Was passiert |
| --- | --- |
| `npm install` | lädt alle Bausteine (einmalig, ca. 200 MB) |
| `npm test` | prüft iRacing-Leser, Lenkradknöpfe und Abstands-Berechnung |
| `npm start` | startet dbDash direkt aus dem Quellcode (zum Ausprobieren von Änderungen) |
| `npm run build` | baut das fertige Programm: `dist\dbDash\dbDash.exe` plus ZIP zum Weitergeben |

## Lizenz

Copyright (c) 2026 Johann Danner. dbDash steht unter der Lizenz
**[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de)**
(Namensnennung – Nicht kommerziell – Keine Bearbeitungen):

- ✅ Kostenlos benutzen und **unverändert** weitergeben (mit Name, Urheber und Lizenzhinweis).
- ✅ Für den eigenen Gebrauch anpassen.
- ❌ Veränderte Versionen weitergeben oder veröffentlichen.
- ❌ Verkaufen oder kommerziell verwerten.

Details: `LICENSE.txt`. Mitgelieferte Fremdkomponenten (Electron, Chromium, koffi, ws, js-yaml, Länderflaggen von
[flag-icons](https://github.com/lipis/flag-icons)) stehen unter ihren eigenen Lizenzen – siehe `DRITTANBIETER-LIZENZEN.txt`.

dbDash ist ein unabhängiges Projekt und nicht mit iRacing.com Motorsport Simulations oder RaceLabs verbunden.
