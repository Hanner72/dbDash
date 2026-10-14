# dbDash (dannerbam Dash) – Projektkontext für Claude Code

dbDash – „dannerbam Dash“, ein von Johann Danner entwickeltes Dashboard für Simracer: kostenlose iRacing-Overlays
(ähnlich RaceLabs) als Windows-Programm. Eigenes Design, eigener Name – keine Kopie
von RaceLabs/Lovely. Autor: Johann Danner. Kommunikation mit dem Autor auf **Deutsch** (das Programm selbst ist zweisprachig, siehe „Sprachen“); er programmiert sonst
hauptsächlich PHP/HTML/MySQL – Erklärungen daher praxisnah, ohne Node/Electron-Fachjargon vorauszusetzen.

## Befehle
- `npm install` – Abhängigkeiten (Node.js ≥ 22.12, getestet mit v24)
- `npm start` – App aus dem Quellcode starten (Demo-Modus läuft beim ersten Start)
- `npm test` – Tests: SDK-Parser, Joystick, Abstände, Incidents, Radar, Standings-Spalten (`test/*.js`, reines Node, kein Framework)
- `npm run build` – fertiges Programm: `dist\dbDash\dbDash.exe` + ZIP (`build/build.js`)
- `npm run video` – Vorstellungsvideo aufnehmen: `video/record.js` startet dbDash mit eigener Einstellungs-Kopie
  (`DBDASH_USERDATA` = Ordner im Temp, Demo an – APPDATA umbiegen wirkt bei Electron nicht!), spielt `video/scenes.js` auf der Bühne `video/studio.html` ab → `video/out/`
  (MP4 1080p30 ohne Ton, `sprechtext.md`, `youtube-beschreibung.txt`). ffmpeg über PATH, `FFMPEG=` oder `ffmpeg-static`.
  `VIDEO_PREVIEW=1` = nur ein Standbild pro Szene. Port 8182 muss frei sein. Neue Funktion → Szene ergänzen.
- `npm run screenshots` – README-Bilder nach `docs/img/` (Liste `video/screenshots.js`, gleiche Bühne wie das Video).
  README ist für GitHub gestaltet (Bilder, Abzeichen, Download-Link `../../releases/latest`); `docs/` wird beim Build
  neben `LIESMICH.md` kopiert. Neue Funktion → Bild ergänzen und `npm run screenshots`.
- `npm run icons` – Programmsymbol (`build/icon.svg` → `build/icon.ico`, `web/assets/icon.png`) und Stream-Deck-Grafiken
  (`grafiken/*.svg` → PNGs) neu erzeugen. Läuft in Electron; in VS Code ggf. `ELECTRON_RUN_AS_NODE` leeren.
- Version in `package.json` erhöhen, bevor gebaut und weitergegeben wird.

## Architektur
- **Electron** (Chromium + Node). Hauptprozess `src/main.js`: Fenster, Tray, Einstellungen, HTTP-Server + WebSocket
  auf `127.0.0.1:8182`, Tick 30 Hz, Tasten/Joystick, Stream-Deck-API (`/api/action/<id>`, `/api/page/<id>`, `/api/list`).
- **Overlays = normale HTML/CSS/JS-Seiten** in `web/` (im fertigen Programm offen unter `resources\web`).
  Jede Seite bindet `common.css` + `common.js` ein und bekommt den Zustand per WebSocket: `PW.onState((st, cfg) => …)`.
  Dieselben Seiten laufen als transparente Overlay-Fenster und als OBS-Browserquelle.
  Overlays: `relative`, `standings`, `inputs`, `delta`, `dash` (Dashboard), `radar` (Ghost); Einstellungen: `control.html`.
- `src/irsdk.js` – liest iRacing-Shared-Memory (`Local\IRSDKMemMapFileName`) über **koffi** + kernel32.
  Wichtig: Electron verbietet `koffi.view()` → Daten werden per `RtlMoveMemory` in eigene Buffer kopiert.
  Session-YAML wird vor dem Parsen bereinigt (`sanitizeYaml`: Namen mit Sonderzeichen quoten).
- `src/state.js` – baut aus Rohdaten den Zustand: Relative, Standings (pro Klasse, iRating-Prognose), Dashboard
  (Sprit, Reifen, Schaden, Flaggen, Abstände), Radar. Gleiches Datenformat für iRacing und Demo.
- `src/demo.js` – simuliertes Mehrklassen-Rennen (LMP2 + GT3) im iRacing-Datenformat; ein Auto „kämpft“ mit dem Spieler.
- `src/fuel.js` (Ø-Verbrauch der letzten 5 sauberen Runden), `src/race.js` (Startplätze, Boxenstopps),
  `src/joystick.js` (winmm `joyGetPosEx`, 16 Geräte × 32 Knöpfe + Hat, läuft im Hintergrund).
- Länderflaggen: `web/flags/*.svg` (flag-icons, MIT) + `names.json` aus `build/flags.js` (iRacing `FlairName` → Code).

## Wichtige Entscheidungen / bekannte Fallstricke
- **Abstände Vorder-/Hintermann**: im Rennen LIVE-Reihenfolge nach Distanz (`CarIdxLap + LapDistPct`), weil iRacing
  `CarIdxPosition` erst an der Ziellinie aktualisiert. Garage/getrennte Autos zählen nicht. Test: `test/gaps-test.js`.
- **Incidents der Gegner**: iRacing liefert sie während der Session nicht (Session-Info = 0) → `race.js` zählt
  Ausritte (`CarIdxTrackSurface` 0 = OffTrack, je 1x, innerhalb 2 s nur einmal), Anzeige als Schätzung (`incEst`).
  Echte Werte > 0 aus der Session-Info haben Vorrang. Test: `test/incidents-test.js`.
- **Standings-Spalten**: Liste/Standard-Reihenfolge `STANDINGS_COL_LIST` (main.js), `cfg.standingsOrder` (Reihenfolge,
  `mergeOrder` fügt neue Spalten an ihrer Standard-Stelle ein) + `cfg.standingsCols` (an/aus). Einstellungsfenster:
  sortierbare Liste (Ziehen oder ▲/▼, `renderOrder` in control.html). Automarke aus `CarScreenName` (`carBrand`, keine
  Logos – Markenrechte), Reifen aus `CarIdxTireCompound` + `DriverInfo.DriverTires` (`tyreInfo`). Test: `test/standings-cols-test.js`.
- **Updates** (`src/updater.js`): GitHub-API `releases/latest` von Hanner72/dbDash, Asset `*win64.zip`. Prüfen 10 s nach
  Start + alle 6 h (nur fertiges Programm, Schalter `updateCheck`); Installieren NUR auf Knopfdruck: ZIP laden → Windows-
  `tar.exe` entpackt → `update.cmd` wartet bis kein dbDash.exe mehr läuft → robocopy über den Programmordner → Neustart.
  Nicht beschreibbarer Ordner → Skript mit Admin-Rechten (UAC). Testhilfe `DBDASH_UPDATE_API=<url>` (auch aus dem Quellcode).
  Release-ZIP muss oben den Ordner `dbDash` mit `dbDash.exe` enthalten (macht build.js so).
- Radar: iRacing liefert keine seitliche Position, nur Streckenabstand + `CarLeftRight` (Spotter).
  Reichweite (`radarRange`, 1–80 m) = Lücke Stoßstange zu Stoßstange (feste Länge 4,7 m, iRacing liefert keine);
  Radar erscheint nur bei Lücke ≤ Reichweite oder Spotter-Meldung, ohne Verzögerung aus; in Qualifikation aus.
  Test: `test/radar-test.js`.
- Schaden: nur über `PitRepairLeft` / `PitOptRepairLeft` (Reparaturzeiten), Motor-Warnungen, Reifenverschleiß.
- Overlays werden ausgeblendet, wenn der Motor aus ist (RPM ≤ 300 oder EngineWarnings 0x08), mit 1,5 s Verzögerung.
- Statische Dateien: `no-store`, außer `flags/` und `assets/` (sonst laden Flaggen nicht, da 30×/s neu gerendert wird).
- Overlay-Fenster melden ihre Inhaltsgröße (`cmd: 'size'`), der Hauptprozess passt die Fenstergröße an
  und schiebt Overlays zurück auf den Bildschirm, wenn sie herausragen.
- Einstellungen: `%APPDATA%\dbDash\settings.json`; alte TriDash- bzw. PitWall-Einstellungen werden einmalig übernommen.
- Globale Tastenkürzel blockieren die Taste für iRacing → für Stream Deck/SimHub F13–F24 empfehlen.
- Windows-Build: Virenscanner sperrt frische Dateien kurz → `build.js` versucht mehrmals / kopiert statt umbenennen.
- WebSocket nimmt nur Verbindungen ohne Origin oder von 127.0.0.1/localhost an; `/api/*` weist Browser-Aufrufe
  fremder Seiten ab (Sec-Fetch-Site/Origin).

## Sprachen (Deutsch / Englisch)
- Alle sichtbaren Texte stehen in `web/lang/de.json` und `en.json` (Schlüssel → Text, `{platzhalter}`); `_name` = Anzeigename.
  Neue Sprache = neue Datei, erscheint automatisch in der Auswahl. Fehlende Texte fallen auf Deutsch zurück.
- Sprache: `cfg.lang` (`auto` = Windows-Sprache über `app.getLocale()`, sonst Englisch). Der Hauptprogramm-`configMsg`
  schickt `lang` + `strings` an alle Seiten; Umschalten wirkt sofort ohne Neustart.
- Overlays: `PW.t('schlüssel', { platzhalter })`, feste Texte im HTML mit `data-i18n` / `data-i18n-html` / `data-i18n-title`
  (common.js setzt sie). Einstellungsfenster hat eigenes `t()`. Hauptprogramm: `t()` in main.js (Tray, Meldungen, Listen).
- `state.js` liefert keine Anzeigetexte, sondern Schlüssel (Flaggen `flag.*`, Warnungen `warn.*`); Updater-Fehler als
  `errorCode`/`errorKey`. **Neuer Text → in beide Sprachdateien**, `test/i18n-test.js` prüft gleiche Schlüssel,
  gleiche Platzhalter und dass jeder im Code benutzte Schlüssel existiert.
- README auf Deutsch (`README.md`) und Englisch (`README.en.md`) – beide pflegen. Video/Sprechtext bleiben Deutsch.

## Leistung (iRacing darf keine FPS verlieren)
- Jedes Overlay meldet sich per `/ws?id=<overlay>` an und bekommt nur seine Daten in eigener Rate
  (`TOPICS` in `src/main.js`: Standings 4 Hz, Relative 10 Hz, Delta 20 Hz, Dash/Inputs/Radar 30 Hz, Einstellungen 1 Hz).
  **Neues Overlay oder neues Feld im Zustand → `TOPICS` ergänzen**, sonst kommt es nicht an (unbekannte Seiten: alles, 10 Hz).
- Ohne iRacing (und ohne Demo) wird nur 1x pro Sekunde nachgesehen.
- Anzeige nur über `PW.text/html/cls/css` (common.js) ändern – schreibt nur bei echter Änderung.
  Nicht direkt `innerHTML` usw. auf Elemente setzen, die auch über die Helfer laufen (Zwischenspeicher `_pw`).
- Keine CSS-Dauer-Animationen (`animation: … infinite`): Blinken über die Klasse `blinkoff` im Takt (dash.html).
- Ausgeblendete Overlays (Motor aus / kein iRacing) und das leere Radar rechnen und zeichnen nicht.
- Alle dbDash-Prozesse laufen mit Priorität „niedriger als normal“ (`lowerPriority`, alle 10 s für neue Prozesse).
- Einstellung `gpu` (aus = `app.disableHardwareAcceleration()`, wirkt nach Neustart) zum Vergleichen der FPS.
- Messung im Demo-Modus mit allen 6 Overlays: CPU 9,6 % → 1 % eines Kerns (Version 2.1.0 → Leistungsüberarbeitung).

## Testen ohne iRacing
- Demo-Modus (Standard beim ersten Start). Testhilfen per Umgebungsvariable:
  `DBDASH_SHOT=<ordner>` (Screenshots aller Fenster, dann Ende), `DBDASH_SHOT_DELAY=<ms>`,
  `DBDASH_SCROLL=<overlay-id>` (Einstellungsfenster dorthin scrollen), `DBDASH_DEMO_ENGINE_OFF=1`,
  `DBDASH_USERDATA=<ordner>` (eigener Einstellungsordner – echte Einstellungen bleiben unberührt).
- Echte iRacing-Daten, Lenkräder und Stream Deck konnten bisher nur simuliert getestet werden – Rückmeldungen
  des Autors aus echten Rennen haben Vorrang.

## Lizenz
CC BY-NC-ND 4.0 (© 2026 Johann Danner): benutzen und unverändert weitergeben erlaubt, keine veränderten Versionen
weitergeben, nicht kommerziell. Fremdkomponenten behalten ihre Lizenzen (`DRITTANBIETER-LIZENZEN.txt` wird beim Build
erzeugt). Name „dbDash“ (ausgeschrieben „dannerbam Dash“, früher „TriDash Overlays“). Logo = drei schräge Striche:
grün #c6ff3d, mittlerer hellorange #ffb347, grün 37 %. Exe heißt `dbDash.exe`.

## Versionsstand
2.4.0 – Zweisprachig (Deutsch / Englisch, automatisch nach Windows-Sprache, live umschaltbar), README.en.md.
2.3.0 – Standings: Spalten Automarke und Reifen, Spalten frei sortierbar; automatische Updates über GitHub.
2.2.0 – Incidents der Gegner, Dashboard überarbeitet, Radar (1–80 m, Blueprint), Leistung (CPU 9,6 % → 1 %),
Vorstellungsvideo + README-Bilder per Skript. 2.1.0 – Umbenennung TriDash → dbDash.
