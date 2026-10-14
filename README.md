<div align="center">

<img src="web/assets/icon.png" width="110" alt="dbDash-Logo">

# dbDash – dannerbam Dash

**Kostenlose Overlays für iRacing – entwickelt von einem Simracer für Simracer.**

Relative · Standings · Dashboard · Radar · Inputs · Delta – schonend für deine FPS und auch als OBS-Browserquelle.

[![Lizenz: CC BY-NC-ND 4.0](https://img.shields.io/badge/Lizenz-CC%20BY--NC--ND%204.0-c6ff3d?style=flat-square)](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-ffb347?style=flat-square)
![iRacing](https://img.shields.io/badge/f%C3%BCr-iRacing-3a3f48?style=flat-square)
![Preis](https://img.shields.io/badge/Preis-kostenlos-3ddc84?style=flat-square)

[**⬇ Download**](../../releases/latest) · [Funktionen](#funktionen) · [Installation](#installation) · [Bedienung](#bedienung) · [Stream Deck](#stream-deck--simhub) · [OBS](#obs--streaming)

<!-- Vorstellungsvideo: Link einfügen, sobald es auf YouTube ist, z. B.
[![Vorstellungsvideo ansehen](docs/img/hero.jpg)](https://www.youtube.com/watch?v=XXXXXXXX) -->

</div>

![dbDash – alle Overlays im Überblick](docs/img/hero.jpg)

## Warum dbDash?

- 🆓 **Kostenlos** – kein Abo, keine Werbung, kein Konto.
- 🚀 **Schont deine FPS** – zeichnet nur, was sich wirklich ändert, und lässt iRacing bei der Rechenzeit immer den Vortritt
  (im Test ca. **1 % CPU** mit allen sechs Overlays).
- 🎛️ **Bedienung vom Lenkrad aus** – Dashboard-Seiten per Lenkradknopf, Button-Box, Taste oder Stream Deck umschalten.
- 📺 **Für Streamer** – jedes Overlay gibt es auch als OBS-Browserquelle.
- 🧪 **Sofort ausprobieren** – der Demo-Modus zeigt ein simuliertes Mehrklassen-Rennen, ganz ohne iRacing.

## Funktionen

### Dashboard

Das große Fahrer-Display: Schaltblitze, Gang, Tempo, Gas- und Bremsbalken, Delta zur Bestzeit, Position mit gewonnenen
oder verlorenen Plätzen, Restzeit, Runde, Uhr, Flaggen (Blau, Gelb, Weiß, Karo …) mit Pitlimiter-Warnung,
TC / TC 2 / ABS / Bremsbalance / Motor-Map und Sprit mit Nachtank-Menge bis ins Ziel.

![Dashboard](docs/img/dashboard.png)

Links und rechts sitzen zwei Fenster mit **umschaltbaren Seiten** – für jede Seite wählst du **Links, Rechts oder Aus**:

| Seite | Zeigt |
| --- | --- |
| **Reifen** | Temperatur innen / Mitte / außen, Druck, Verschleiß |
| **Motor** | Wasser, Öl, Öl- und Benzindruck, Batterie, Drehzahl |
| **Sprit-Strategie** | Ø-Verbrauch, Reichweite, Runden bis ins Ziel, Nachtank-Menge, nötige Stopps |
| **Relative – Gesamt / Klasse** | je 3 Autos vor und hinter dir |
| **Abstände – Gesamt / Klasse** | Vorder- und Hintermann mit Trend pro Runde (▲/▼, grün = gut für dich) sowie deren Rundenzeiten |
| **Rundenzeiten** | Prognose für die laufende Runde, letzte und beste Runde |
| **Schaden** | GT3 als technische Zeichnung: grün = alles gut, orange = leichter Schaden, rot = Pflicht-Reparatur; Motor-Warnungen und Reifenverschleiß |

<table>
  <tr>
    <td><img src="docs/img/dashboard-abstaende-schaden.png" alt="Dashboard mit Abständen und Schaden"></td>
    <td><img src="docs/img/dashboard-strategie-relative.png" alt="Dashboard mit Sprit-Strategie und Relative"></td>
  </tr>
  <tr>
    <td align="center"><sub>Abstände mit Trend · Schaden als Blueprint</sub></td>
    <td align="center"><sub>Sprit-Strategie · Relative</sub></td>
  </tr>
</table>

### Relative

Die Fahrer direkt vor und hinter dir auf der Strecke mit Zeitabstand, Lizenz und iRating.
**„−“ = vor dir, „+“ = hinter dir.** Orange = eine Runde vor dir (überrundet dich), Blau = eine Runde hinter dir.

<img src="docs/img/relative.png" width="520" alt="Relative">

### Standings

Wertung nach Klassen mit SOF. Spalten einzeln ein- und ausschaltbar: **Plätze +/−** seit dem Start, **Startplatz**,
**Landesflagge**, **Box** (wer gerade in der Box ist, sonst Anzahl Stopps), Startnummer, Lizenz, iRating,
**iRating-Prognose** (falls das Rennen mit dem aktuellen Stand endet), **Incidents**, letzte / beste Runde, Abstand.
Lila = schnellste Runde der Klasse.

![Standings](docs/img/standings.png)

### Radar & Inputs / Delta

<table>
  <tr>
    <td width="34%" valign="top"><img src="docs/img/radar.png" alt="Radar"></td>
    <td valign="top">

**Radar (Ghost)** – Draufsicht mit den Autos vor, hinter und neben dir, gezeichnet als GT3-Blueprint
(dein Auto grün, Klassenfarbe auf dem Dach). Rot = neben dir, Orange = Lücke unter 7 m.

- Reichweite **1–80 m**, gemessen als Lücke Stoßstange zu Stoßstange
- erscheint nur, solange ein Auto in Reichweite ist, und **verschwindet sofort** wieder
- in der **Qualifikation** bleibt das Radar aus

<img src="docs/img/inputs-delta.png" alt="Inputs und Delta">

**Inputs** – Gas/Bremse-Verlauf, Pedalbalken, Gang, Tempo, Lenkrad.
**Delta** – Delta zur besten Runde mit Balken, Rundenzeit-Prognose, beste und letzte Runde.

</td>
  </tr>
</table>

Alle Overlays blenden sich automatisch aus, solange der Motor nicht läuft (abschaltbar).

## Installation

1. [**Neueste Version herunterladen**](../../releases/latest) und die ZIP entpacken
   (z. B. nach `C:\Programme\dbDash` oder auf den Desktop).
2. **`dbDash.exe`** starten. Beim ersten Start läuft der **Demo-Modus** mit einem simulierten Rennen, damit du alles
   sofort siehst.
3. Für echte Daten: im Einstellungsfenster **Demo-Modus ausschalten** und iRacing starten.

> [!IMPORTANT]
> iRacing unter *Options → Graphics* auf **Borderless Window** stellen. Im exklusiven Vollbild kann Windows keine
> Fenster über dem Spiel anzeigen.

> [!NOTE]
> Windows-SmartScreen kann beim ersten Start warnen, weil die Datei nicht signiert ist:
> „Weitere Informationen“ → „Trotzdem ausführen“.

## Bedienung

| Aktion | Wie |
| --- | --- |
| Einstellungen öffnen | Klick auf das dbDash-Symbol im Infobereich der Taskleiste |
| Overlays verschieben | `Alt+Shift+E` (oder Schalter im Einstellungsfenster), Overlay mit der Maus ziehen, nochmal `Alt+Shift+E` |
| Alle ein-/ausblenden | `Alt+Shift+H` |
| Dashboard links / rechts umschalten | `Alt+Shift+←` / `Alt+Shift+→` (zurückblättern frei belegbar) |
| Beenden | Rechtsklick auf das Symbol → Beenden |

<img src="docs/img/einstellungen.png" width="360" align="right" alt="Einstellungsfenster">

Im **Einstellungsfenster** schaltest du jedes Overlay ein oder aus und stellst **Größe** und **Hintergrund-Deckkraft**
ein. Dazu wählst du die Spalten der Standings, die Dashboard-Seiten (links / rechts / aus), die Radar-Reichweite und die
Einheit (km/h oder mph). Positionen und Einstellungen werden gespeichert (`%APPDATA%\dbDash\settings.json`).

**Tasten & Lenkradknöpfe:** Alle Aktionen lassen sich neu belegen: „Zuweisen“ klicken und eine Taste oder einen Knopf
am Lenkrad / an der Button-Box drücken. Pro Aktion geht je eine Taste und ein Lenkradknopf. Lenkradknöpfe funktionieren
auch, während iRacing im Vordergrund ist (bis 16 Geräte, je 32 Knöpfe + Coolie-Hat).

> [!TIP]
> Eine hier belegte **Tastatur**-Taste bekommt iRacing nicht mehr – Lenkradknöpfe schon. Für Stream Deck und SimHub
> deshalb am besten **F13–F24** verwenden (gibt es auf keiner Tastatur).

**Overlays mit der Grafikkarte zeichnen:** Ist der Schalter aus, zeichnet der Prozessor die Overlays. Was in iRacing mehr
FPS bringt, hängt vom PC ab – einfach beides ausprobieren (wirkt nach einem Neustart von dbDash).

<br clear="right">

## Stream Deck & SimHub

<img src="grafiken/dbDash-Links-umschalten-144.png" width="72" alt="Links umschalten"> <img src="grafiken/dbDash-Rechts-umschalten-144.png" width="72" alt="Rechts umschalten">

Passende Tastenbilder zum Umschalten des Dashboards liegen im Ordner `Grafiken` (PNG in 72, 144, 256, 512 px und SVG).

- **Stream Deck ohne Plugin:** Aktion „Tastenkürzel“ mit einer Taste **F13–F24** belegen und diese in dbDash unter
  „Tasten & Lenkradknöpfe“ zuweisen.
- **Stream Deck mit Plugin „Web Requests“ (BarRaider):** eine Adresse aufrufen lassen, z. B.
  `http://127.0.0.1:8182/api/action/dashLeft` oder direkt eine Seite öffnen: `http://127.0.0.1:8182/api/page/gapClass`.
  Alle Adressen stehen zum Kopieren im Einstellungsfenster, die Liste gibt es auch unter `http://127.0.0.1:8182/api/list`.
- **SimHub:** in einem Dashboard (Dash Studio) eine Schaltfläche mit dem Bild versehen und eine Taste von **F13–F24**
  senden lassen; diese Taste in dbDash zuweisen.

## OBS / Streaming

Jedes Overlay ist auch eine Webseite, solange dbDash läuft. In OBS: *Quelle hinzufügen → Browser*, Adresse einfügen und
die Größe setzen:

| Overlay | Adresse | Größe (ca.) |
| --- | --- | --- |
| Relative | `http://127.0.0.1:8182/relative.html` | 430 × 300 |
| Standings | `http://127.0.0.1:8182/standings.html` | 640 × 460 |
| Inputs | `http://127.0.0.1:8182/inputs.html` | 600 × 110 |
| Delta | `http://127.0.0.1:8182/delta.html` | 380 × 130 |
| Dashboard | `http://127.0.0.1:8182/dash.html` | 860 × 500 |
| Radar | `http://127.0.0.1:8182/radar.html` | 220 × 300 |

Die Größen hängen von Zeilen- und Spaltenzahl ab – bei Bedarf anpassen.

## Gut zu wissen

dbDash zeigt nur, was iRacing über seine offizielle Schnittstelle (iRacing SDK) liefert:

- **Incidents der Gegner** hält iRacing während der Session geheim. dbDash zählt deshalb ihre Ausritte neben die Strecke
  (je 1x) und zeigt diese Schätzung *kursiv und abgeblendet*. Kontakte (2x / 4x) sind darin nicht enthalten.
  Deine eigenen Incidents sind immer exakt.
- **Schaden:** iRacing meldet nicht, *welches* Teil beschädigt ist – nur die Reparaturzeiten. Die Auto-Grafik zeigt
  deshalb die Schadensstufe am ganzen Auto.
- **Radar:** iRacing liefert keine seitliche Position, nur den Abstand auf der Strecke und die Spotter-Meldung
  „Auto links / rechts“. Autos davor / dahinter stehen deshalb mittig, Autos neben dir auf der gemeldeten Seite.
- **iRating-Prognose:** nutzt die von der Community ermittelte Formel und ist eine Schätzung (pro Klasse, nur im Rennen).
- Werte, die ein Auto nicht hat (z. B. TC), erscheinen als „–“. Reifenwerte aktualisiert iRacing je nach Auto teils nur
  beim Boxenstopp.

## Anpassen

Die Overlays sind normale HTML-, CSS- und JavaScript-Dateien im Ordner `resources\web` und dürfen für den eigenen
Gebrauch angepasst werden (veränderte Versionen bitte nicht weitergeben – siehe Lizenz). Änderungen sind nach einem
Neustart von dbDash sichtbar. Die Daten kommen per WebSocket (`ws://127.0.0.1:8182/ws`) als JSON – siehe `common.js`
(`PW.onState(...)`).

## Selbst bauen

Voraussetzung: **Node.js 22 oder neuer** (LTS von [nodejs.org](https://nodejs.org)). Dann im Quellcode-Ordner:

| Befehl | Was passiert |
| --- | --- |
| `npm install` | lädt alle Bausteine (einmalig, ca. 200 MB) |
| `npm test` | prüft iRacing-Leser, Lenkradknöpfe, Abstände, Incidents und Radar |
| `npm start` | startet dbDash direkt aus dem Quellcode |
| `npm run build` | baut das fertige Programm: `dist\dbDash\dbDash.exe` plus ZIP zum Weitergeben |
| `npm run screenshots` | erzeugt die Bilder dieser Seite neu (`docs/img/`) |
| `npm run video` | nimmt das Vorstellungsvideo auf (`video/out/`, braucht [ffmpeg](https://ffmpeg.org)) |
| `npm run icons` | erzeugt Programmsymbol und Stream-Deck-Grafiken aus den SVG-Vorlagen |

**Technik:** Electron (Chromium + Node.js). Die Telemetrie kommt direkt aus dem Shared Memory des offiziellen iRacing-SDK
(`Local\IRSDKMemMapFileName`) über koffi und die Win32-API. Quellcode in `src/`: `main.js` (Fenster, Webserver),
`irsdk.js` (SDK-Leser), `state.js` (Berechnungen), `fuel.js` (Sprit), `race.js` (Startplätze, Boxenstopps, Incidents),
`joystick.js` (Lenkradknöpfe), `demo.js` (Simulation).

## Lizenz

Copyright © 2026 Johann Danner. dbDash steht unter der Lizenz
**[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/deed.de)**
(Namensnennung – Nicht kommerziell – Keine Bearbeitungen):

- ✅ Kostenlos benutzen und **unverändert** weitergeben (mit Name, Urheber und Lizenzhinweis).
- ✅ Für den eigenen Gebrauch anpassen.
- ❌ Veränderte Versionen weitergeben oder veröffentlichen.
- ❌ Verkaufen oder kommerziell verwerten.

Details: [`LICENSE`](LICENSE). Mitgelieferte Fremdkomponenten (Electron, Chromium, koffi, ws, js-yaml, Länderflaggen von
[flag-icons](https://github.com/lipis/flag-icons)) stehen unter ihren eigenen Lizenzen – siehe `DRITTANBIETER-LIZENZEN.txt`
im fertigen Programm.

<sub>dbDash ist ein unabhängiges Projekt und nicht mit iRacing.com Motorsport Simulations oder RaceLabs verbunden.</sub>
