(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const audio = $('#audio');

  let songs = [];
  let queue = [];          // ids ng kasalukuyang filtered list
  let currentId = null;
  let shuffle = false;
  let repeat = 0;          // 0 = off, 1 = all, 2 = one
  let objectUrl = null;
  const downloading = new Set();

  /* ---------- IndexedDB ---------- */
  const dbReady = new Promise((resolve, reject) => {
    const r = indexedDB.open('worship-db', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  async function tx(mode, fn) {
    const db = await dbReady;
    return new Promise((resolve, reject) => {
      const t = db.transaction('songs', mode);
      const req = fn(t.objectStore('songs'));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  }
  const dbAll = () => tx('readonly', s => s.getAll());
  const dbPut = song => tx('readwrite', s => s.put(song));
  const dbDel = id => tx('readwrite', s => s.delete(id));

  /* ---------- Helpers ---------- */
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2800);
  }
  const fmt = s => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + String(ss).padStart(2, '0');
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const baseName = n => n.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();

  async function refresh() {
    songs = await dbAll();
    buildArtistOptions();
    render();
    showStorage();
  }

  function buildArtistOptions() {
    const all = new Set(window.ARTISTS || []);
    songs.forEach(s => all.add(s.artist));
    const sorted = [...all].sort((a, b) => a.localeCompare(b));

    const sel = $('#artistFilter');
    const keep = sel.value;
    sel.innerHTML = '<option value="">Lahat ng artist</option>' +
      sorted.map(a => `<option>${esc(a)}</option>`).join('');
    sel.value = sorted.includes(keep) ? keep : '';

    $('#artistList').innerHTML = sorted.map(a => `<option value="${esc(a)}">`).join('');
  }

  function visible() {
    const q = $('#search').value.trim().toLowerCase();
    const a = $('#artistFilter').value;
    return songs
      .filter(s => (!a || s.artist === a) && (!q || (s.title + ' ' + s.artist).toLowerCase().includes(q)))
      .sort((x, y) => x.artist.localeCompare(y.artist) || x.title.localeCompare(y.title));
  }

  function render() {
    const list = visible();
    queue = list.map(s => s.id);
    $('#empty').hidden = songs.length > 0;
    $('#list').innerHTML = list.map(s => {
      const offline = !!s.blob;
      const badge = offline
        ? '<span class="badge">✓ Offline</span>'
        : '<span class="badge stream">☁ Online</span>';
      const dl = (!offline && s.url)
        ? `<button data-act="dl" data-id="${s.id}" title="I-download para offline">${downloading.has(s.id) ? '…' : '⬇'}</button>`
        : '';
      return `<li class="song${s.id === currentId ? ' playing' : ''}" data-id="${s.id}">
        <div class="info" data-act="play" data-id="${s.id}">
          <div class="t">${esc(s.title)}${badge}</div>
          <div class="a">${esc(s.artist)}</div>
        </div>
        ${dl}
        <button data-act="del" data-id="${s.id}" title="Delete">🗑</button>
      </li>`;
    }).join('');
  }

  async function showStorage() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const { usage, quota } = await navigator.storage.estimate();
        $('#storage').textContent =
          `Storage: ${(usage / 1048576).toFixed(1)} MB gamit • ${(quota / 1073741824).toFixed(1)} GB available`;
      }
    } catch (_) { /* ignore */ }
  }

  /* ---------- Playback ---------- */
  async function play(id) {
    const song = songs.find(s => s.id === id);
    if (!song) return;
    currentId = id;
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    if (song.blob) { objectUrl = URL.createObjectURL(song.blob); audio.src = objectUrl; }
    else { audio.src = song.url; }
    try { await audio.play(); }
    catch (e) { toast('Hindi ma-play. Offline ba at hindi pa na-download?'); }
    $('#npTitle').textContent = song.title;
    $('#npArtist').textContent = song.artist;
    setMediaSession(song);
    render();
  }

  function next(auto) {
    if (!queue.length) return;
    if (auto && repeat === 2) { audio.currentTime = 0; audio.play(); return; }
    let i = queue.indexOf(currentId);
    if (shuffle && queue.length > 1) {
      let n;
      do { n = Math.floor(Math.random() * queue.length); } while (n === i);
      i = n;
    } else {
      i += 1;
      if (i >= queue.length) {
        if (repeat === 1 || !auto) i = 0;
        else { audio.pause(); return; }
      }
    }
    play(queue[i]);
  }

  function prev() {
    if (!queue.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    let i = queue.indexOf(currentId) - 1;
    if (i < 0) i = queue.length - 1;
    play(queue[i]);
  }

  function togglePlay() {
    if (!audio.src) { if (queue.length) play(queue[0]); return; }
    audio.paused ? audio.play() : audio.pause();
  }

  function setMediaSession(song) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: 'Worship Player' });
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('previoustrack', prev);
    navigator.mediaSession.setActionHandler('nexttrack', () => next(false));
  }

  audio.addEventListener('play', () => $('#playBtn').textContent = '⏸');
  audio.addEventListener('pause', () => $('#playBtn').textContent = '▶');
  audio.addEventListener('ended', () => next(true));
  audio.addEventListener('loadedmetadata', () => $('#tDur').textContent = fmt(audio.duration));
  audio.addEventListener('timeupdate', () => {
    $('#tCur').textContent = fmt(audio.currentTime);
    if (audio.duration && !seeking) $('#seek').value = Math.round((audio.currentTime / audio.duration) * 1000);
  });
  let seeking = false;
  const seekEl = $('#seek');
  seekEl.addEventListener('input', () => { seeking = true; if (audio.duration) $('#tCur').textContent = fmt((seekEl.value / 1000) * audio.duration); });
  seekEl.addEventListener('change', () => { if (audio.duration) audio.currentTime = (seekEl.value / 1000) * audio.duration; seeking = false; });

  $('#playBtn').onclick = togglePlay;
  $('#nextBtn').onclick = () => next(false);
  $('#prevBtn').onclick = prev;
  $('#shuffleBtn').onclick = e => { shuffle = !shuffle; e.currentTarget.setAttribute('aria-pressed', shuffle); };
  $('#repeatBtn').onclick = e => {
    repeat = (repeat + 1) % 3;
    e.currentTarget.setAttribute('aria-pressed', repeat > 0);
    e.currentTarget.textContent = repeat === 2 ? '🔂' : '🔁';
    toast(['Repeat: off', 'Repeat: lahat', 'Repeat: isang kanta'][repeat]);
  };

  /* ---------- Download for offline ---------- */
  async function download(id) {
    const song = songs.find(s => s.id === id);
    if (!song || !song.url || song.blob || downloading.has(id)) return;
    downloading.add(id);
    render();
    try {
      const res = await fetch(song.url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      song.blob = blob;
      song.size = blob.size;
      await dbPut(song);
      toast('Na-download na: ' + song.title);
    } catch (e) {
      toast('Hindi na-download. Check ang internet o ang link.');
    } finally {
      downloading.delete(id);
      await refresh();
    }
  }

  async function remove(id) {
    const song = songs.find(s => s.id === id);
    if (!song || !confirm(`I-delete ang "${song.title}"?`)) return;
    if (id === currentId) { audio.pause(); audio.removeAttribute('src'); currentId = null; $('#npTitle').textContent = 'Walang pinapatugtog'; $('#npArtist').textContent = '—'; }
    await dbDel(id);
    await refresh();
  }

  $('#list').addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const id = Number(el.dataset.id);
    if (el.dataset.act === 'play') play(id);
    if (el.dataset.act === 'dl') download(id);
    if (el.dataset.act === 'del') remove(id);
  });
  $('#search').addEventListener('input', render);
  $('#artistFilter').addEventListener('change', render);

  /* ---------- Add song dialog ---------- */
  const dlg = $('#addDialog');
  $('#addBtn').onclick = () => { $('#addForm').reset(); $('#formMsg').textContent = ''; dlg.showModal(); };
  $('#cancelBtn').onclick = () => dlg.close();

  $('#addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const artist = $('#fArtist').value.trim();
    const files = [...$('#fFiles').files];
    const title = $('#fTitle').value.trim();
    const url = $('#fUrl').value.trim();
    if (!artist) { $('#formMsg').textContent = 'Lagyan ng artist.'; return; }
    if (!files.length && !url) { $('#formMsg').textContent = 'Pumili ng audio file o maglagay ng link.'; return; }

    try {
      if (files.length) {
        for (const f of files) {
          await dbPut({
            title: (files.length === 1 && title) ? title : baseName(f.name),
            artist, blob: f, size: f.size, added: Date.now()
          });
        }
        toast(files.length + ' kanta ang naidagdag (offline na)');
      } else {
        await dbPut({ title: title || baseName(url.split('/').pop() || 'Untitled'), artist, url, added: Date.now() });
        toast('Naidagdag. Tap ⬇ para i-download offline.');
      }
      dlg.close();
      await refresh();
    } catch (err) {
      $('#formMsg').textContent = 'May error sa pag-save: ' + err.message;
    }
  });

  /* ---------- catalog.json (mga kantang may lisensya ang church) ---------- */
  async function syncCatalog() {
    try {
      const res = await fetch('catalog.json', { cache: 'no-cache' });
      if (!res.ok) return;
      const items = await res.json();
      if (!Array.isArray(items)) return;
      const have = new Set(songs.map(s => s.url).filter(Boolean));
      let added = 0;
      for (const it of items) {
        if (!it || !it.url || !it.title || !it.artist || have.has(it.url)) continue;
        await dbPut({ title: it.title, artist: it.artist, url: it.url, added: Date.now() });
        added++;
      }
      if (added) { toast(added + ' bagong kanta mula sa catalog'); await refresh(); }
    } catch (_) { /* offline: okay lang */ }
  }

  /* ---------- Start ---------- */
  (async () => {
    await refresh();
    syncCatalog();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  })();
})();
