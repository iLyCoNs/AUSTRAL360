/**
 * f-tourism.js — Jarvis Turismo Austral
 * Catálogo curado + validación real (Wikipedia foto, YouTube oEmbed).
 * Sin media verificada → no se muestra ese bloque.
 */
'use strict';

(function () {
  const CATALOG_URL = 'data/tourism-catalog.json?v=4';
  const EARTH_R_M = 6371000;
  const DEFAULT_BANDS = [
    { id: 'muy_cerca', label: 'Muy cerca', emoji: '🟢', maxKm: 40 },
    { id: 'paseo', label: 'A un paseo', emoji: '🟡', maxKm: 100 },
    { id: 'dia', label: 'Día completo', emoji: '🟠', maxKm: 180 },
    { id: 'lejos', label: 'Más lejos', emoji: '🔵', maxKm: 320 }
  ];

  let _catalog = null;
  let _loadPromise = null;
  let _pendingOffer = null; // { category, poiId, resolved }
  let _pendingMenu = null; // { category, items: [...] }
  let _openPoiId = null;
  let _mediaCache = new Map(); // poiId → { imageUrl, youtubeId, wikiExtract, title }

  function _haversineM(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function _origin() {
    const o = window.FerrariGeo && window.FerrariGeo.droneOrigin;
    if (o && o.lat != null && o.lng != null) return { lat: +o.lat, lng: +o.lng };
    // Fallback zona Puerto Varas / Ensenada si aún no hay origen
    return { lat: -41.32, lng: -72.98 };
  }

  function _formatDist(m) {
    if (window.FerrariGeo && typeof window.FerrariGeo.formatDistance === 'function') {
      return window.FerrariGeo.formatDistance(m);
    }
    if (m < 1000) return Math.round(m) + ' m';
    return (m / 1000).toFixed(m < 20000 ? 1 : 0) + ' km';
  }

  function _formatEta(m) {
    if (window.FerrariGeo && typeof window.FerrariGeo.formatEtaMinutes === 'function') {
      return window.FerrariGeo.formatEtaMinutes(m);
    }
    const min = Math.max(1, Math.round(m / 700)); // ~42 km/h rural
    if (min < 60) return '~' + min + ' min';
    const h = Math.floor(min / 60);
    const r = min % 60;
    return '~' + h + ' h' + (r ? ' ' + r + ' min' : '');
  }

  async function loadCatalog(force) {
    if (_catalog && !force) return _catalog;
    if (_loadPromise && !force) return _loadPromise;
    _loadPromise = fetch(CATALOG_URL, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error('catalog HTTP ' + r.status);
        return r.json();
      })
      .then((j) => {
        _catalog = j;
        try {
          if (typeof window.__kpkRefreshTourismChips === 'function') {
            window.__kpkRefreshTourismChips();
          }
        } catch (e) {}
        return j;
      })
      .catch((e) => {
        console.warn('[Tourism] No se pudo cargar catálogo:', e.message);
        _catalog = { categories: [], pois: [] };
        return _catalog;
      });
    return _loadPromise;
  }

  function _bands() {
    return (_catalog && Array.isArray(_catalog.bands) && _catalog.bands.length)
      ? _catalog.bands
      : DEFAULT_BANDS;
  }

  function _maxRadiusM() {
    const km = (_catalog && _catalog.maxRadiusKm) || 320;
    return km * 1000;
  }

  function _bandForKm(km) {
    const bands = _bands();
    for (const b of bands) {
      if (km <= b.maxKm) return b;
    }
    return bands[bands.length - 1] || { id: 'lejos', label: 'Más lejos', emoji: '🔵', maxKm: 999 };
  }

  function _enrichPoi(p) {
    const origin = _origin();
    const distM = _haversineM(origin.lat, origin.lng, p.lat, p.lng);
    const km = distM / 1000;
    const band = _bandForKm(km);
    return Object.assign({}, p, {
      distM,
      distKm: Math.round(km * 10) / 10,
      distLabel: _formatDist(distM),
      etaLabel: _formatEta(distM),
      bandId: band.id,
      bandLabel: band.label,
      bandEmoji: band.emoji || ''
    });
  }

  function listByCategory(category) {
    if (!_catalog) return [];
    const cat = String(category || '').toLowerCase();
    const maxM = _maxRadiusM();
    return (_catalog.pois || [])
      .filter((p) => !cat || p.category === cat)
      .map(_enrichPoi)
      .filter((p) => p.distM <= maxM)
      .sort((a, b) => a.distM - b.distM);
  }

  function getPoi(id) {
    if (!_catalog) return null;
    return (_catalog.pois || []).find((p) => p.id === id) || null;
  }

  async function _validateYoutube(id) {
    if (!id || !/^[a-zA-Z0-9_-]{6,20}$/.test(id)) return null;
    try {
      const url =
        'https://www.youtube.com/oembed?url=' +
        encodeURIComponent('https://www.youtube.com/watch?v=' + id) +
        '&format=json';
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || !j.title) return null;
      return { id, title: j.title, thumb: j.thumbnail_url || null };
    } catch (e) {
      return null;
    }
  }

  async function _fetchWiki(wiki) {
    if (!wiki || !wiki.title) return null;
    const lang = wiki.lang || 'es';
    const url =
      'https://' +
      lang +
      '.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(wiki.title);
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || j.type === 'disambiguation' || j.type === 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
        return null;
      }
      const imageUrl = (j.thumbnail && j.thumbnail.source) || (j.originalimage && j.originalimage.source) || null;
      let lat = null;
      let lng = null;
      if (j.coordinates) {
        lat = j.coordinates.lat;
        lng = j.coordinates.lon;
      }
      return {
        title: j.title || null,
        extract: j.extract || j.description || null,
        imageUrl,
        lat,
        lng,
        pageUrl: j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : null
      };
    } catch (e) {
      return null;
    }
  }

  async function _probeImage(url) {
    if (!url) return false;
    return new Promise((resolve) => {
      const img = new Image();
      const t = setTimeout(() => {
        img.src = '';
        resolve(false);
      }, 6000);
      img.onload = () => {
        clearTimeout(t);
        resolve(img.naturalWidth > 40 && img.naturalHeight > 40);
      };
      img.onerror = () => {
        clearTimeout(t);
        resolve(false);
      };
      img.referrerPolicy = 'no-referrer';
      img.src = url;
    });
  }

  async function resolveMedia(poi) {
    if (!poi) return null;
    if (_mediaCache.has(poi.id)) return _mediaCache.get(poi.id);

    const wiki = await _fetchWiki(poi.wiki);
    let imageUrl = wiki && wiki.imageUrl ? wiki.imageUrl : null;
    if (imageUrl) {
      const okImg = await _probeImage(imageUrl);
      if (!okImg) imageUrl = null;
    }

    let youtube = null;
    const candidates = Array.isArray(poi.youtubeCandidates) ? poi.youtubeCandidates : [];
    for (const id of candidates) {
      youtube = await _validateYoutube(id);
      if (youtube) break;
    }

    // Sin foto NI video verificados → no servir el POI (filtro estricto)
    if (!imageUrl && !youtube) {
      const empty = { ok: false, imageUrl: null, youtube: null, wikiExtract: null };
      _mediaCache.set(poi.id, empty);
      return empty;
    }

    const resolved = {
      ok: true,
      imageUrl,
      youtube,
      wikiExtract: wiki && wiki.extract ? wiki.extract.slice(0, 280) : null,
      wikiTitle: wiki && wiki.title ? wiki.title : poi.title,
      lat: wiki && wiki.lat != null ? wiki.lat : poi.lat,
      lng: wiki && wiki.lng != null ? wiki.lng : poi.lng
    };
    _mediaCache.set(poi.id, resolved);
    return resolved;
  }

  function _ensureWidget() {
    let el = document.getElementById('kpk-tourism-widget');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'kpk-tourism-widget';
    el.className = 'kpk-tourism-widget';
    el.innerHTML = `
      <div class="kpk-tw-header">
        <div class="kpk-tw-titles">
          <span class="kpk-tw-eyebrow">Jarvis Turismo</span>
          <span class="kpk-tw-title" id="kpk-tw-title">—</span>
        </div>
        <button type="button" class="kpk-tw-close" id="kpk-tw-close" title="Cerrar">&times;</button>
      </div>
      <div class="kpk-tw-media" id="kpk-tw-media"></div>
      <div class="kpk-tw-body">
        <p class="kpk-tw-blurb" id="kpk-tw-blurb"></p>
        <p class="kpk-tw-meta" id="kpk-tw-meta"></p>
      </div>
      <div class="kpk-tw-footer" id="kpk-tw-footer"></div>
    `;
    document.body.appendChild(el);
    el.querySelector('#kpk-tw-close').addEventListener('click', closeWidget);
    return el;
  }

  function closeWidget() {
    const el = document.getElementById('kpk-tourism-widget');
    if (el) {
      el.classList.remove('is-open');
      const media = el.querySelector('#kpk-tw-media');
      if (media) media.innerHTML = ''; // corta video
    }
    _openPoiId = null;
  }

  function isOpen() {
    const el = document.getElementById('kpk-tourism-widget');
    return !!(el && el.classList.contains('is-open'));
  }

  async function openWidget(poiIdOrOpts) {
    await loadCatalog();
    const opts = typeof poiIdOrOpts === 'string' ? { poiId: poiIdOrOpts } : poiIdOrOpts || {};
    let poi = opts.poiId ? getPoi(opts.poiId) : null;
    if (poi) poi = _enrichPoi(poi);
    if (!poi && opts.category) {
      const list = listByCategory(opts.category);
      for (const p of list) {
        const media = await resolveMedia(p);
        if (media && media.ok) {
          poi = p;
          break;
        }
      }
    }
    if (!poi) {
      console.warn('[Tourism] Sin POI válido para abrir');
      return false;
    }

    const media = await resolveMedia(poi);
    if (!media || !media.ok) {
      console.warn('[Tourism] Media no verificada → no se abre widget:', poi.id);
      if (window.FerrariUI && window.FerrariUI.showToast) {
        window.FerrariUI.showToast('Sin foto/video verificado para ese lugar', 'warning');
      }
      return false;
    }

    const origin = _origin();
    const distM = _haversineM(origin.lat, origin.lng, media.lat, media.lng);
    const el = _ensureWidget();
    el.querySelector('#kpk-tw-title').textContent = poi.title;
    el.querySelector('#kpk-tw-blurb').textContent =
      poi.blurb || media.wikiExtract || '';
    el.querySelector('#kpk-tw-meta').textContent =
      (poi.bandEmoji ? poi.bandEmoji + ' ' + poi.bandLabel + ' · ' : '') +
      _formatDist(distM) +
      ' · ' +
      _formatEta(distM) +
      ' desde el proyecto';

    const mediaBox = el.querySelector('#kpk-tw-media');
    mediaBox.innerHTML = '';
    if (media.youtube && media.youtube.id) {
      const wrap = document.createElement('div');
      wrap.className = 'kpk-tw-video';
      wrap.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' +
        encodeURIComponent(media.youtube.id) +
        '?rel=0&modestbranding=1" title="' +
        (media.youtube.title || poi.title).replace(/"/g, '') +
        '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>';
      mediaBox.appendChild(wrap);
    } else if (media.imageUrl) {
      const img = document.createElement('img');
      img.className = 'kpk-tw-photo';
      img.alt = poi.title;
      img.referrerPolicy = 'no-referrer';
      img.src = media.imageUrl;
      mediaBox.appendChild(img);
    }

    // Si hay video, foto chica debajo opcional
    if (media.youtube && media.imageUrl) {
      const thumb = document.createElement('img');
      thumb.className = 'kpk-tw-photo kpk-tw-photo--secondary';
      thumb.alt = '';
      thumb.referrerPolicy = 'no-referrer';
      thumb.src = media.imageUrl;
      mediaBox.appendChild(thumb);
    }

    const footer = el.querySelector('#kpk-tw-footer');
    let maps = null;
    if (window.FerrariGeo && typeof window.FerrariGeo.mapsLinks === 'function') {
      maps = window.FerrariGeo.mapsLinks(media.lat, media.lng);
    } else {
      maps = {
        google:
          'https://www.google.com/maps/dir/?api=1&destination=' +
          media.lat +
          ',' +
          media.lng,
        waze: 'https://waze.com/ul?ll=' + media.lat + ',' + media.lng + '&navigate=yes'
      };
    }
    footer.innerHTML =
      '<a class="kpk-tw-btn kpk-tw-btn--maps" href="' +
      maps.google +
      '" target="_blank" rel="noopener">Ruta Maps</a>' +
      '<a class="kpk-tw-btn kpk-tw-btn--waze" href="' +
      maps.waze +
      '" target="_blank" rel="noopener">Waze</a>' +
      '<button type="button" class="kpk-tw-btn kpk-tw-btn--look" id="kpk-tw-look">Ver en 360°</button>' +
      '<button type="button" class="kpk-tw-btn kpk-tw-btn--next" id="kpk-tw-next">Otro plan cerca</button>' +
      '<button type="button" class="kpk-tw-btn kpk-tw-btn--lot" id="kpk-tw-lot">Quiero un lote aquí cerca</button>' +
      '<a class="kpk-tw-btn kpk-tw-btn--wa" id="kpk-tw-wa" href="#" target="_blank" rel="noopener">WhatsApp al asesor</a>';

    const lookBtn = footer.querySelector('#kpk-tw-look');
    if (lookBtn) {
      lookBtn.onclick = () => {
        try {
          const viewer = window.Ferrari && window.Ferrari.viewer;
          if (window.FerrariGeo && window.FerrariGeo.droneOrigin && viewer) {
            const brg = window.FerrariGeo.bearingDeg(
              window.FerrariGeo.droneOrigin.lat,
              window.FerrariGeo.droneOrigin.lng,
              media.lat,
              media.lng
            );
            const yaw = typeof window.FerrariGeo.bearingToYaw === 'function'
              ? window.FerrariGeo.bearingToYaw(brg)
              : brg;
            if (typeof viewer.lookAt === 'function') viewer.lookAt(0, yaw, 70, false);
          }
          if (window.FerrariUI && typeof window.FerrariUI.openMapWidget === 'function') {
            window.FerrariUI.openMapWidget(media.lat, media.lng, poi.title);
          }
        } catch (e) {}
      };
    }

    const nextBtn = footer.querySelector('#kpk-tw-next');
    if (nextBtn) {
      nextBtn.onclick = () => {
        openNextInCategory(poi.category, poi.id);
      };
    }

    const lotBtn = footer.querySelector('#kpk-tw-lot');
    if (lotBtn) {
      lotBtn.onclick = () => {
        try {
          const q =
            'Después de ver ' +
            poi.title +
            ', quiero un lote disponible cerca del proyecto. ¿Cuáles me recomiendas?';
          if (window.__kpkSendTourismFollowUp) {
            window.__kpkSendTourismFollowUp(q);
          } else {
            const input = document.getElementById('kpk-ai-input');
            if (input) {
              input.value = q;
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            }
          }
        } catch (e) {}
      };
    }

    const waBtn = footer.querySelector('#kpk-tw-wa');
    if (waBtn) {
      const msg =
        'Hola! Estoy viendo el entorno en el tour 360°. Me gustó ' +
        poi.title +
        ' (' +
        _formatDist(distM) +
        ' · ' +
        _formatEta(distM) +
        ' desde el proyecto). Quiero conocer lotes disponibles cerca.';
      let waUrl = null;
      try {
        const contact =
          window.FerrariBrandDock && typeof window.FerrariBrandDock.getContact === 'function'
            ? window.FerrariBrandDock.getContact()
            : null;
        const phone = (contact && (contact.whatsapp || contact.platformWhatsapp)) || '56987491964';
        if (window.FerrariBrandDock && typeof window.FerrariBrandDock.whatsappUrl === 'function') {
          waUrl = window.FerrariBrandDock.whatsappUrl(phone, msg);
        } else {
          const digits = String(phone).replace(/\D/g, '');
          waUrl =
            'https://api.whatsapp.com/send?phone=' +
            digits +
            '&text=' +
            encodeURIComponent(msg);
        }
      } catch (e) {}
      if (waUrl) {
        waBtn.href = waUrl;
      } else {
        waBtn.style.display = 'none';
      }
    }

    // Planes relacionados (otras categorías)
    let related = el.querySelector('.kpk-tw-related');
    if (!related) {
      related = document.createElement('div');
      related.className = 'kpk-tw-related';
      el.appendChild(related);
    }
    const cats = (_catalog && _catalog.categories) || [];
    related.innerHTML =
      '<span class="kpk-tw-related-label">Más planes cerca</span><div class="kpk-tw-related-row"></div>';
    const row = related.querySelector('.kpk-tw-related-row');
    cats.forEach((c) => {
      if (c.id === poi.category) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'kpk-tw-mini';
      b.textContent = c.chip || c.label;
      b.addEventListener('click', () => {
        if (window.__kpkOfferTourism) window.__kpkOfferTourism(c.id);
        else prepareOffer(c.id).then(() => {});
      });
      row.appendChild(b);
    });

    el.classList.add('is-open');
    _openPoiId = poi.id;
    _pendingOffer = null;

    // Aviso al chat (si existe helper)
    try {
      if (window.__kpkTourismOpened) window.__kpkTourismOpened(poi, distM);
    } catch (e) {}

    return true;
  }

  /** Oferta conversacional: no abre widget hasta confirmación */
  async function prepareOffer(category) {
    const menu = await prepareOfferMenu(category);
    if (!menu || !menu.items.length) {
      _pendingOffer = null;
      return null;
    }
    const first = menu.items[0];
    _pendingOffer = {
      category: category || first.category,
      poiId: first.poiId,
      title: first.title,
      distLabel: first.distLabel,
      etaLabel: first.etaLabel,
      blurb: first.blurb,
      bandLabel: first.bandLabel
    };
    return _pendingOffer;
  }

  /**
   * Menú de opciones verificadas, ordenadas de cerca → lejos, agrupadas por banda.
   * category: id | 'nearest' | '' (todas)
   */
  async function prepareOfferMenu(category, opts) {
    await loadCatalog();
    const limit = (opts && opts.limit) || 8;
    const cat = String(category || '').toLowerCase();
    const source =
      cat && cat !== 'nearest' && cat !== 'all'
        ? listByCategory(cat)
        : (_catalog.pois || [])
            .map(_enrichPoi)
            .filter((p) => p.distM <= _maxRadiusM())
            .sort((a, b) => a.distM - b.distM);

    const items = [];
    for (const p of source) {
      if (items.length >= limit) break;
      const media = await resolveMedia(p);
      if (!media || !media.ok) continue;
      items.push({
        poiId: p.id,
        category: p.category,
        title: p.title,
        distM: p.distM,
        distKm: p.distKm,
        distLabel: p.distLabel,
        etaLabel: p.etaLabel,
        bandId: p.bandId,
        bandLabel: p.bandLabel,
        bandEmoji: p.bandEmoji,
        blurb: p.blurb,
        chipLabel:
          (p.bandEmoji ? p.bandEmoji + ' ' : '') +
          p.title +
          ' · ' +
          p.distLabel
      });
    }

    _pendingMenu = {
      category: cat === 'nearest' || cat === 'all' ? '' : cat,
      items
    };

    if (items[0]) {
      _pendingOffer = {
        category: items[0].category,
        poiId: items[0].poiId,
        title: items[0].title,
        distLabel: items[0].distLabel,
        etaLabel: items[0].etaLabel,
        blurb: items[0].blurb,
        bandLabel: items[0].bandLabel
      };
    } else {
      _pendingOffer = null;
    }

    return _pendingMenu;
  }

  function formatMenuHtml(menu) {
    if (!menu || !menu.items || !menu.items.length) return '';
    const byBand = {};
    const order = [];
    menu.items.forEach((it) => {
      const key = it.bandId || 'otros';
      if (!byBand[key]) {
        byBand[key] = {
          emoji: it.bandEmoji || '',
          label: it.bandLabel || 'Opciones',
          items: []
        };
        order.push(key);
      }
      byBand[key].items.push(it);
    });
    let html = 'Te armo opciones <b>de cerca a lejos</b> (media verificada):<br>';
    order.forEach((key) => {
      const g = byBand[key];
      html +=
        '<br><b>' +
        (g.emoji ? g.emoji + ' ' : '') +
        g.label +
        '</b><br>';
      g.items.forEach((it) => {
        html +=
          '· <b>' +
          it.title +
          '</b> — ' +
          it.distLabel +
          ' · ' +
          it.etaLabel +
          '<br>';
      });
    });
    html += '<br>¿Cuál te muestro? (o elige el más cercano)';
    return html;
  }

  /** Finde: menú mixed nearest-first */
  async function prepareNearestOffer() {
    const menu = await prepareOfferMenu('nearest', { limit: 8 });
    return menu && menu.items[0]
      ? {
          category: menu.items[0].category,
          poiId: menu.items[0].poiId,
          title: menu.items[0].title,
          distLabel: menu.items[0].distLabel,
          etaLabel: menu.items[0].etaLabel,
          blurb: menu.items[0].blurb,
          bandLabel: menu.items[0].bandLabel
        }
      : null;
  }

  function getPendingMenu() {
    return _pendingMenu;
  }

  function clearPendingMenu() {
    _pendingMenu = null;
  }

  function selectOfferByPoiId(poiId) {
    if (!_pendingMenu || !_pendingMenu.items) return null;
    const it = _pendingMenu.items.find((x) => x.poiId === poiId);
    if (!it) return null;
    _pendingOffer = {
      category: it.category,
      poiId: it.poiId,
      title: it.title,
      distLabel: it.distLabel,
      etaLabel: it.etaLabel,
      blurb: it.blurb,
      bandLabel: it.bandLabel
    };
    return _pendingOffer;
  }

  function getChipDefs() {
    const cats = (_catalog && _catalog.categories) || [];
    return cats.map((c) => ({
      text: c.chip || c.label,
      query: c.id === 'nieve' ? 'quiero ver el volcán y nieve cerca' : 'quiero planes de ' + c.label.toLowerCase() + ' cerca'
    }));
  }

  function getPendingOffer() {
    return _pendingOffer;
  }

  function clearPendingOffer() {
    _pendingOffer = null;
    _pendingMenu = null;
  }

  async function confirmPendingOffer() {
    if (!_pendingOffer) return false;
    const ok = await openWidget({ poiId: _pendingOffer.poiId });
    _pendingMenu = null;
    return ok;
  }

  /** Siguiente POI verificado de la misma categoría (ciclo) */
  async function openNextInCategory(category, afterId) {
    await loadCatalog();
    const list = listByCategory(category);
    if (!list.length) return false;

    const start = Math.max(0, list.findIndex((p) => p.id === afterId));
    for (let i = 1; i <= list.length; i++) {
      const p = list[(start + i) % list.length];
      if (!p || p.id === afterId) continue;
      const media = await resolveMedia(p);
      if (media && media.ok) {
        return openWidget({ poiId: p.id });
      }
    }
    if (window.FerrariUI && window.FerrariUI.showToast) {
      window.FerrariUI.showToast('No hay otro plan verificado en esa categoría', 'info');
    }
    return false;
  }

  function catalogSummaryForPrompt() {
    if (!_catalog) return '[]';
    const origin = _origin();
    const rows = (_catalog.pois || []).map((p) => {
      const distM = _haversineM(origin.lat, origin.lng, p.lat, p.lng);
      return {
        id: p.id,
        category: p.category,
        title: p.title,
        km: Math.round((distM / 1000) * 10) / 10
      };
    });
    return JSON.stringify(rows);
  }

  // Precarga
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => loadCatalog(), { once: true });
  } else {
    loadCatalog();
  }

  window.FerrariTourism = {
    loadCatalog,
    listByCategory,
    getPoi,
    resolveMedia,
    prepareOffer,
    prepareOfferMenu,
    prepareNearestOffer,
    formatMenuHtml,
    getPendingOffer,
    getPendingMenu,
    clearPendingOffer,
    clearPendingMenu,
    selectOfferByPoiId,
    confirmPendingOffer,
    openNextInCategory,
    openWidget,
    closeWidget,
    isOpen,
    catalogSummaryForPrompt,
    getChipDefs,
    getCategories: () => (_catalog && _catalog.categories) || [],
    getBands: () => _bands()
  };

  console.log('[Ferrari/Tourism] ✓ Jarvis Turismo listo');
})();
