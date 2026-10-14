// dbDash – Verbindung zum Hauptprogramm und Hilfsfunktionen
(function () {
  const params = new URLSearchParams(location.search);
  const isWin = params.get('win') === '1';
  const id = params.get('id') || document.body.dataset.overlay;
  const stateFns = [], configFns = [];
  let ws = null, config = null, lastState = null;

  function connect() {
    // mit Namen anmelden: das Hauptprogramm schickt dann nur die Daten, die diese Seite braucht
    const topic = id || location.pathname.split('/').pop().replace(/.html$/, '');
    ws = new WebSocket(`ws://${location.host}/ws?id=${encodeURIComponent(topic)}`);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'state') {
        lastState = m.state;
        document.body.classList.toggle('offline', !m.state.connected);
        updateEngine(m.state);
        // ausgeblendet (Motor aus / kein iRacing): nichts berechnen und nichts zeichnen
        const b = document.body.classList;
        if (!b.contains('edit') && (b.contains('engineoff') || b.contains('offline'))) return;
        for (const f of stateFns) f(m.state, config);
      } else if (m.type === 'config') {
        config = m.config;
        applyConfig();
        for (const f of configFns) f(m.config, m);
      }
    };
    ws.onclose = () => { document.body.classList.add('offline'); setTimeout(connect, 1000); };
  }

  // Ausblenden bei Motor aus – mit kurzer Verzögerung, damit ein kurzes Abwürgen nicht flackert
  let engineOffSince = 0, wasOn = false;
  function updateEngine(st) {
    const now = Date.now();
    if (!st.connected || st.engineOn) { engineOffSince = 0; wasOn = !!st.engineOn; }
    else if (!engineOffSince) engineOffSince = now;
    // war der Motor noch nie an (z. B. in der Box beim Einsteigen) -> sofort ausblenden
    const hide = !!(config && config.hideEngineOff) && engineOffSince && (!wasOn || now - engineOffSince > 1500);
    document.body.classList.toggle('engineoff', !!hide);
  }

  function applyConfig() {
    if (!id || !config.overlays || !config.overlays[id]) return;
    const o = config.overlays[id];
    document.documentElement.style.setProperty('--bg-a', o.bg);
    document.body.classList.toggle('edit', isWin && !!config.editMode);
    const root = document.getElementById('root');
    if (root && isWin) root.style.transform = `scale(${o.scale || 1})`;
  }

  // Größe des Inhalts an das Hauptprogramm melden, damit das Fenster passt
  function watchSize() {
    if (!isWin) return;
    const root = document.getElementById('root');
    let last = '';
    const report = () => {
      const w = root.offsetWidth, h = root.offsetHeight;
      const k = w + 'x' + h;
      if (k !== last && ws && ws.readyState === 1) { last = k; ws.send(JSON.stringify({ cmd: 'size', id, w, h })); }
    };
    new ResizeObserver(report).observe(root);
    setInterval(() => { last = last + ''; report(); }, 1000);
    // nach (Wieder-)Verbindung erneut melden
    configFns.push(() => { last = ''; report(); });
  }

  // dbDash-Logo: drei schräge Striche, der mittlere hellorange (wie im Programmsymbol)
  const LOGO = '<svg class="pw-logo" viewBox="250 264 790 496" aria-hidden="true">' +
    [[250, '#c6ff3d', 1], [440, '#ffb347', 1], [630, '#c6ff3d', 0.37]].map(([x, c, o]) => `<polygon points="${x},760 ${x + 120},760 ${x + 290},264 ${x + 170},264" fill="${c}" fill-opacity="${o}"/>`).join('') +
    '</svg>';

  window.PW = {
    LOGO,
    isWin, id,
    onState: (f) => stateFns.push(f),
    onConfig: (f) => configFns.push(f),
    get config() { return config; },
    get state() { return lastState; },
    send: (m) => ws && ws.readyState === 1 && ws.send(JSON.stringify(m)),
    // Anzeige nur ändern, wenn sich der Wert wirklich geändert hat (jede Änderung kostet Neuzeichnen)
    text(el, v) { v = 't' + (v == null ? '' : v); if (el._pw !== v) { el._pw = v; el.textContent = v.slice(1); } },
    html(el, v) { v = 'h' + (v == null ? '' : v); if (el._pw !== v) { el._pw = v; el.innerHTML = v.slice(1); } },
    cls(el, v) { if (el.className !== v) el.className = v; },
    css(el, prop, v) { const k = '_s_' + prop; if (el[k] !== v) { el[k] = v; el.style[prop] = v; } },
    fmtLap(t) {
      if (!(t > 0)) return '—';
      const m = Math.floor(t / 60), s = t - m * 60;
      return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : s.toFixed(3);
    },
    fmtTime(sec) {
      if (!(sec >= 0)) return '';
      sec = Math.floor(sec);
      const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
    },
    fmtIR(ir) { return ir > 0 ? (ir / 1000).toFixed(1) + 'k' : ''; },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    sessionLine(st) {
      const s = st.session || {};
      const parts = [];
      if (s.type) parts.push(`<b>${PW.esc(s.type)}</b>`);
      if (s.lapsRemain > 0) parts.push(`${s.lapsRemain} Rnd übrig`);
      else if (s.timeRemain >= 0) parts.push(PW.fmtTime(s.timeRemain));
      return parts.join(' · ');
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (root) {
      root.insertAdjacentHTML('beforeend', '<div class="waiting">Warte auf iRacing …</div><div class="edit-label">verschieben</div>');
      // Logo: in Überschriften vorne, sonst als kleines Zeichen in der Ecke (außer das Overlay setzt es selbst)
      const brands = document.querySelectorAll('.brand');
      brands.forEach((el) => el.insertAdjacentHTML('afterbegin', LOGO));
      document.querySelectorAll('[data-logo]').forEach((el) => el.insertAdjacentHTML('afterbegin', LOGO));
      if (!brands.length && !document.querySelector('[data-logo]')) root.insertAdjacentHTML('beforeend', `<div class="pw-mark">${LOGO}</div>`);
    }
    document.body.classList.add('offline');
    watchSize();
    connect();
  });
})();
