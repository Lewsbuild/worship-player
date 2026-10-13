// Graphic equalizer (Web Audio API): 5 bands by default, pwedeng 7-12 bands.
(() => {
  'use strict';

  const audio = document.querySelector('#audio');
  const MIN_F = 50, MAX_F = 14000;     // saklaw ng frequency (Hz)
  const RANGE = 12;                    // +/- dB
  const COUNTS = [5, 7, 8, 9, 10, 11, 12];
  const KEY = 'worship-eq-v1';

  // Presets bilang 5-point na curve; ini-interpolate para sa kahit anong bilang ng band.
  const PRESETS = {
    'Flat':           [0, 0, 0, 0, 0],
    'Bass Boost':     [6, 4, 0, 0, 0],
    'Treble Boost':   [0, 0, 0, 3, 6],
    'Vocal / Worship':[-2, 0, 3, 4, 1],
    'Warm':           [3, 2, 0, 1, 2],
    'Loudness':       [5, 2, -1, 2, 5]
  };

  /* ---------- State ---------- */
  let state = { enabled: true, count: 5, preset: 'Flat', gains: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && COUNTS.includes(saved.count)) state = Object.assign(state, saved);
  } catch (_) { /* ok lang */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };

  const freqs = n => Array.from({ length: n }, (_, i) =>
    Math.round(MIN_F * Math.pow(MAX_F / MIN_F, i / (n - 1))));
  const fmtHz = f => f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(f);

  function curve(name, n) {
    const p = PRESETS[name] || PRESETS.Flat;
    return Array.from({ length: n }, (_, i) => {
      const pos = (i / (n - 1)) * (p.length - 1);
      const lo = Math.floor(pos), hi = Math.ceil(pos);
      return Math.round(p[lo] + (p[hi] - p[lo]) * (pos - lo));
    });
  }
  function gainsFor(n) {
    if (!Array.isArray(state.gains[n]) || state.gains[n].length !== n) state.gains[n] = curve(state.preset, n);
    return state.gains[n];
  }

  /* ---------- Audio graph ---------- */
  let ctx = null, src = null, out = null, filters = [];

  function ensureGraph() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      src = ctx.createMediaElementSource(audio);
      out = ctx.createGain();
      out.connect(ctx.destination);
      rebuild();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function rebuild() {
    if (!ctx) return;
    try { src.disconnect(); } catch (_) {}
    filters.forEach(f => { try { f.disconnect(); } catch (_) {} });
    const n = state.count, fr = freqs(n);
    const bw = Math.log2(MAX_F / MIN_F) / (n - 1);                  // octaves bawat band
    const q = 1 / (2 * Math.sinh((Math.LN2 / 2) * bw));
    filters = fr.map((f, i) => {
      const b = ctx.createBiquadFilter();
      b.type = i === 0 ? 'lowshelf' : (i === n - 1 ? 'highshelf' : 'peaking');
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    });
    let node = src;
    filters.forEach(b => { node.connect(b); node = b; });
    node.connect(out);
    apply();
  }

  function apply() {
    if (!ctx) return;
    const g = gainsFor(state.count);
    filters.forEach((b, i) => { b.gain.value = state.enabled ? g[i] : 0; });
    // Babaan ang output ayon sa pinakamalaking boost para hindi mag-clip/pumutok.
    const boost = state.enabled ? Math.max(0, ...g) : 0;
    out.gain.value = Math.pow(10, -boost / 20);
  }

  audio.addEventListener('play', () => {
    if (ensureGraph() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  });

  /* ---------- UI ---------- */
  const dlg = document.createElement('dialog');
  dlg.id = 'eqDialog';
  dlg.innerHTML = `
    <div class="eq">
      <div class="eq-head">
        <h2>🎚 Equalizer</h2>
        <label class="sw"><input type="checkbox" id="eqOn"> On</label>
      </div>
      <div class="eq-opts">
        <label>Bands <select id="eqCount"></select></label>
        <label>Preset <select id="eqPreset"></select></label>
      </div>
      <div id="eqBands" class="eq-bands"></div>
      <p class="muted center">−${RANGE} dB hanggang +${RANGE} dB</p>
      <div class="row">
        <button type="button" id="eqReset">Reset</button>
        <button type="button" id="eqClose" class="primary">Done</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);

  const $ = s => dlg.querySelector(s);
  const countSel = $('#eqCount'), presetSel = $('#eqPreset'), bandsEl = $('#eqBands'), onEl = $('#eqOn');

  countSel.innerHTML = COUNTS.map(n => `<option value="${n}">${n} band${n === 5 ? ' (default)' : ''}</option>`).join('');
  presetSel.innerHTML = '<option value="">Custom</option>' +
    Object.keys(PRESETS).map(p => `<option>${p}</option>`).join('');

  const fmtDb = v => (v > 0 ? '+' : '') + v;

  function renderBands() {
    const n = state.count, fr = freqs(n), g = gainsFor(n);
    countSel.value = String(n);
    presetSel.value = state.preset || '';
    onEl.checked = state.enabled;
    bandsEl.classList.toggle('off', !state.enabled);
    bandsEl.innerHTML = fr.map((f, i) => `
      <div class="band">
        <span class="db" id="db${i}">${fmtDb(g[i])}</span>
        <input type="range" min="${-RANGE}" max="${RANGE}" step="1" value="${g[i]}"
               data-i="${i}" aria-label="${fmtHz(f)} Hz">
        <span class="hz">${fmtHz(f)}</span>
      </div>`).join('');
  }

  bandsEl.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.i === undefined) return;
    const i = Number(el.dataset.i), v = Number(el.value);
    gainsFor(state.count)[i] = v;
    bandsEl.querySelector('#db' + i).textContent = fmtDb(v);
    state.preset = '';
    presetSel.value = '';
    apply(); save();
  });

  countSel.addEventListener('change', () => {
    state.count = Number(countSel.value);
    renderBands();
    rebuild(); save();
  });

  presetSel.addEventListener('change', () => {
    if (!presetSel.value) return;
    state.preset = presetSel.value;
    state.gains[state.count] = curve(state.preset, state.count);
    renderBands(); apply(); save();
  });

  onEl.addEventListener('change', () => {
    state.enabled = onEl.checked;
    bandsEl.classList.toggle('off', !state.enabled);
    apply(); save();
  });

  $('#eqReset').onclick = () => {
    state.preset = 'Flat';
    state.gains[state.count] = curve('Flat', state.count);
    renderBands(); apply(); save();
  };
  $('#eqClose').onclick = () => dlg.close();

  const btn = document.querySelector('#eqBtn');
  if (btn) btn.onclick = () => { renderBands(); dlg.showModal(); };
})();
