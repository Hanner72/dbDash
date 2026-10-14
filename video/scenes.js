// Drehbuch für das Vorstellungsvideo: Szenen mit Dauer, Anordnung der Overlays, Titeln,
// Steuerbefehlen an dbDash und Sprechtext. Daraus erzeugt record.js Video, Sprechskript und YouTube-Kapitel.
//
// layout: { <overlay>: [x, y, zoom] } – Position (links oben, in Pixeln bei 1920×1080) und Vergrößerung.
//         Nicht genannte Overlays sind ausgeblendet. Overlays: relative, standings, inputs, delta, dash, radar, control
// page:   Dashboard-Seite, die zu Szenenbeginn angezeigt wird (über /api/page/…)
// set:    Einstellungen, die zu Szenenbeginn gesetzt werden (nur in der Video-Kopie der Einstellungen)
// every:  [Sekunden, Aktion] – Aktion wiederholt auslösen (z. B. Seite umschalten wie per Lenkradknopf)
'use strict';

const HUD = { // Gesamtansicht wie im Rennen
  standings: [40, 40, 0.78], relative: [40, 470, 0.95], delta: [770, 40, 1], radar: [1660, 90, 1],
  dash: [1010, 470, 0.9], inputs: [770, 200, 0.95],
};

module.exports = [
  { id: 'intro', dur: 7, chapter: 'Intro', intro: true,
    speech: 'Das ist dbDash – das dannerbam Dash. Kostenlose Overlays für iRacing, entwickelt von mir, Johann Danner.' },

  { id: 'overview', dur: 12, chapter: 'Überblick', layout: HUD, page: { left: 'tyres', right: 'laps' },
    kicker: 'Überblick', title: 'Alles für dein Rennen', sub: 'Sechs Overlays · frei platzierbar · einzeln ein- und ausschaltbar',
    speech: 'dbDash bringt sechs Overlays mit: Relative, Standings, Inputs, Delta, ein großes Dashboard und ein Radar. Jedes Overlay kannst du frei platzieren, in der Größe anpassen und einzeln ein- oder ausschalten.' },

  { id: 'relative', dur: 14, chapter: 'Relative', layout: { relative: [560, 150, 1.9] },
    kicker: 'Overlay', title: 'Relative', sub: 'Wer fährt direkt vor und hinter dir – Abstand mit Vorzeichen, Lizenz und iRating',
    speech: 'Das Relative zeigt dir die Fahrer direkt vor und hinter dir auf der Strecke. Minus heißt: das Auto ist vor dir, Plus: es ist hinter dir. Orange sind Fahrer, die eine Runde vor dir liegen, blau die, die du überrundest.' },

  { id: 'standings', dur: 16, chapter: 'Standings', layout: { standings: [310, 70, 1.3] },
    kicker: 'Overlay', title: 'Standings', sub: 'Wertung pro Klasse mit SOF, Plätze +/−, Flaggen, Boxenstopps, iRating-Prognose und Incidents',
    speech: 'Die Standings zeigen die Wertung getrennt nach Klassen mit Stärke des Feldes. Du siehst, wie viele Plätze jeder gewonnen oder verloren hat, die Landesflagge, Boxenstopps und eine Prognose, wie sich dein iRating ändert, wenn das Rennen jetzt endet. Incidents der Gegner hält iRacing geheim – dbDash schätzt sie über gezählte Ausritte.' },

  { id: 'dash', dur: 12, chapter: 'Dashboard', layout: { dash: [330, 40, 1.47] }, page: { left: 'tyres', right: 'laps' },
    kicker: 'Overlay', title: 'Das Dashboard', sub: 'Gang, Tempo, Schaltblitze, Delta, Position, Flaggen, TC / ABS / Bremsbalance und Sprit',
    speech: 'Das Herzstück ist das Dashboard. In der Mitte Gang, Tempo, Gas und Bremse und das Delta zu deiner Bestzeit, oben die Schaltblitze. Dazu Flaggen, Restzeit, Position, deine Fahrzeugeinstellungen und der Sprit mit Nachtank-Menge bis ins Ziel.' },

  { id: 'd-tyres', dur: 6.5, layout: { dash: [330, 40, 1.47] }, page: { left: 'tyres' },
    kicker: 'Dashboard-Seite', title: 'Reifen', sub: 'Temperatur innen · Mitte · außen, Druck und Verschleiß',
    speech: 'Links und rechts sind zwei Fenster mit umschaltbaren Seiten. Die Reifen: Temperaturen, Druck und Verschleiß.' },
  { id: 'd-strategy', dur: 6.5, layout: { dash: [330, 40, 1.47] }, page: { left: 'strategy' },
    kicker: 'Dashboard-Seite', title: 'Sprit-Strategie', sub: 'Verbrauch, Reichweite, Runden bis ins Ziel, nötige Stopps',
    speech: 'Die Sprit-Strategie rechnet dir aus, wie weit du kommst und wie viel du bis ins Ziel noch brauchst.' },
  { id: 'd-engine', dur: 6, layout: { dash: [330, 40, 1.47] }, page: { left: 'engine' },
    kicker: 'Dashboard-Seite', title: 'Motor', sub: 'Wasser, Öl, Drücke, Batterie, Drehzahl',
    speech: 'Die Motorseite zeigt Temperaturen und Drücke.' },
  { id: 'd-damage', dur: 7, layout: { dash: [330, 40, 1.47] }, page: { right: 'damage' },
    kicker: 'Dashboard-Seite', title: 'Schaden als Blueprint', sub: 'Grün = alles gut · Orange = leichter Schaden · Rot = Pflicht-Reparatur',
    speech: 'Der Schaden wird als technische Zeichnung eines GT3 dargestellt: grün ist alles in Ordnung, orange ein leichter Schaden, rot heißt ab in die Box.' },
  { id: 'd-gaps', dur: 7, layout: { dash: [330, 40, 1.47] }, page: { left: 'gapAll' },
    kicker: 'Dashboard-Seite', title: 'Abstände', sub: 'Vorder- und Hintermann mit Trend pro Runde – holst du auf oder verlierst du?',
    speech: 'Die Abstände zeigen deinen Vorder- und Hintermann mit Trend: grün heißt, es läuft für dich.' },
  { id: 'd-rel', dur: 6, layout: { dash: [330, 40, 1.47] }, page: { left: 'relClass' },
    kicker: 'Dashboard-Seite', title: 'Relative im Dashboard', sub: 'Gesamt oder nur deine Klasse',
    speech: 'Das Relative gibt es auch im Dashboard – gesamt oder nur für deine Klasse.' },
  { id: 'd-laps', dur: 6, layout: { dash: [330, 40, 1.47] }, page: { right: 'laps' },
    kicker: 'Dashboard-Seite', title: 'Rundenzeiten', sub: 'Prognose, letzte und beste Runde',
    speech: 'Und die Rundenzeiten mit einer Prognose für die laufende Runde.' },

  { id: 'radar', dur: 14, chapter: 'Radar', layout: { radar: [1150, 70, 2.85], dash: [120, 230, 0.85] },
    set: { radarAutoHide: false, radarRange: 10 },
    kicker: 'Overlay', title: 'Radar', sub: 'Autos vor, hinter und neben dir · Reichweite 1–80 m · in der Qualifikation aus',
    speech: 'Das Radar zeigt dir die Autos um dich herum, neben dir rot mit Seitenwarnung. Die Reichweite stellst du zwischen einem und achtzig Metern ein. Ist keiner in der Nähe, verschwindet es sofort, und in der Qualifikation bleibt es ganz aus.' },

  { id: 'inputs', dur: 12, chapter: 'Inputs & Delta', layout: { inputs: [180, 180, 2.2], delta: [520, 560, 2.2] },
    set: { radarAutoHide: true },
    kicker: 'Overlays', title: 'Inputs & Delta', sub: 'Gas, Bremse, Kupplung, Lenkrad · Delta zur Bestzeit mit Prognose',
    speech: 'Inputs zeigt Gas, Bremse und Lenkrad, ideal zum Trainieren. Das Delta vergleicht deine laufende Runde live mit deiner Bestzeit.' },

  { id: 'settings', dur: 16, chapter: 'Einstellungen', layout: { control: [1180, 40, 1.22], dash: [60, 180, 1.15] },
    scroll: [[0, 0], [5, 700], [10, 1500]], noMark: true,
    controlJs: "document.querySelector('[data-k=visible]').checked = true",
    kicker: 'Einstellungen', title: 'Alles einstellbar', sub: 'Overlays an/aus, Größe, Hintergrund, Spalten, Dashboard-Seiten links/rechts',
    speech: 'In den Einstellungen schaltest du jedes Overlay ein oder aus, änderst Größe und Hintergrund, wählst die Spalten der Standings und legst fest, welche Dashboard-Seite links oder rechts erscheint.' },

  { id: 'buttons', dur: 12, chapter: 'Lenkrad & Stream Deck', layout: { dash: [700, 180, 1.2] }, deck: true,
    every: [2.2, 'dashLeft'],
    kicker: 'Bedienung', title: 'Lenkrad & Stream Deck', sub: 'Seiten per Taste, Lenkradknopf oder Stream Deck umschalten – Grafiken liegen bei',
    speech: 'Die Seiten schaltest du per Tastatur, mit einem Knopf am Lenkrad oder mit dem Stream Deck um. Passende Stream-Deck-Grafiken liegen dbDash bei.' },

  { id: 'obs', dur: 9, chapter: 'Für Streamer', layout: HUD, obs: true,
    kicker: 'Für Streamer', title: 'Auch als OBS-Browserquelle', sub: 'http://127.0.0.1:8182/dash.html – jedes Overlay hat seine eigene Adresse',
    speech: 'Für Streamer: Jedes Overlay gibt es auch als Browserquelle für OBS.' },

  { id: 'perf', dur: 9, chapter: 'Leistung', layout: HUD,
    kicker: 'Leistung', title: 'Schont deine FPS', sub: 'Zeichnet nur, was sich ändert · niedrige Prozess-Priorität · im Test ca. 1 % CPU',
    speech: 'Und das Wichtigste: dbDash schont deine FPS. Es zeichnet nur, was sich wirklich ändert, und lässt iRacing immer den Vortritt.' },

  { id: 'outro', dur: 9, chapter: 'Download', outro: true,
    speech: 'dbDash ist kostenlos. Probier es aus – den Link findest du in der Beschreibung. Viel Spaß auf der Strecke!' },
];
