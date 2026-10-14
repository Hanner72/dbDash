// Bilder für die README (docs/img/), erzeugt mit:  npm run screenshots
// Gleiche Bühne wie das Video. crop = Overlay(s), deren Bereich ausgeschnitten wird (sonst ganzes Bild);
// plain = ruhiger Hintergrund statt Straße; waitRadar = warten, bis ein Auto neben/dicht bei dir ist.
'use strict';

const HUD = {
  standings: [40, 40, 0.78], relative: [40, 470, 0.95], delta: [770, 40, 1], radar: [1660, 90, 1],
  dash: [1010, 470, 0.9], inputs: [770, 200, 0.95],
};

module.exports = [
  { file: 'hero.jpg', layout: HUD, page: { left: 'tyres', right: 'laps' } },
  { file: 'dashboard.png', layout: { dash: [200, 60, 1.5] }, page: { left: 'tyres', right: 'laps' }, crop: ['dash'], plain: true },
  { file: 'dashboard-abstaende-schaden.png', layout: { dash: [200, 60, 1.5] }, page: { left: 'gapAll', right: 'damage' }, crop: ['dash'], plain: true },
  { file: 'dashboard-strategie-relative.png', layout: { dash: [200, 60, 1.5] }, page: { left: 'strategy', right: 'relAll' }, crop: ['dash'], plain: true },
  { file: 'standings.png', layout: { standings: [100, 60, 1.4] }, crop: ['standings'], plain: true },
  { file: 'relative.png', layout: { relative: [200, 100, 1.6] }, crop: ['relative'], plain: true },
  { file: 'radar.png', layout: { radar: [300, 60, 1.6] }, set: { radarAutoHide: false, radarRange: 10 }, crop: ['radar'], plain: true, waitRadar: true },
  { file: 'inputs-delta.png', layout: { inputs: [200, 100, 1.5], delta: [200, 330, 1.5] }, set: { radarAutoHide: true }, crop: ['inputs', 'delta'], plain: true },
  // Overlay-Fenster sind in der Aufnahme-Kopie ausgeschaltet (sonst gehen sie auf deinem Bildschirm auf) – im Bild „an“ zeigen
  { file: 'einstellungen.png', layout: { control: [200, 40, 1.2] }, crop: ['control'], plain: true,
    controlJs: "document.querySelector('[data-k=visible]').checked = true" },
];
