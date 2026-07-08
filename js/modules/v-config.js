/** FRESIA360 visor compartido — js/viewer.js. Requiere pannellum.js antes. Opcional: window.FRESIA_VIEWER_CONFIG en el HTML. */

const FRESIA_CFG = Object.assign({
    vista: 'aereo',
    panorama: 'loteo360.jpg',
    datosJson: 'datos.json',
    autosaveKey: 'masterplan360_autosave',
    savePostMessageType: 'SAVE_MASTERPLAN_DATA',
    saveFile: 'datos.json',
    githubDatosFile: 'datos.json',
    githubShaStorageKey: 'masterplan_sha_datos',
    githubCommitMessage: '🛰️ Actualización vista aérea (Modo Arquitecto — index.html)',
    payloadIncludeVista: true,
    mergeRemoteSueloFields: true
}, window.FRESIA_VIEWER_CONFIG || {});
const PANORAMA_FILE = FRESIA_CFG.panorama;
(function primeAdminEditorMode() {
    if (!/[?&]admin=true(?:&|$)/.test(window.location.search)) return;
    document.documentElement.classList.add('is-admin-editor');
    if (window.self !== window.top) document.documentElement.classList.add('is-iframe');
    const apply = () => {
        document.body.classList.add('is-admin-editor');
        if (window.self !== window.top) document.body.classList.add('is-embedded');
    };
    if (document.body) apply(); else document.addEventListener('DOMContentLoaded', apply, { once: true });
})();

function setupAdminPostMessageBridge() {
    window.addEventListener('message', (event) => {
        const data = event.data;
        if (!data || typeof data.type !== 'string') return;
        if (data.type === 'ADMIN_TOGGLE_DRAW') {
            if (isDevModePinsActive) togglePinsMode(false);
            toggleDrawMode(typeof data.active === 'boolean' ? data.active : true);
        }
        if (data.type === 'ADMIN_TOGGLE_PINS') {
            if (isDevModeDrawActive) toggleDrawMode(false);
            togglePinsMode(typeof data.active === 'boolean' ? data.active : true);
        }
    });
}
setupAdminPostMessageBridge();

var ConfigProyecto = { titulo: "PROYECTO INMOBILIARIO", subtitulo: "Masterplan Interactivo 360°" };
var OrigenDrone = null, NorteOffset = 0, BaseDatosLotes = [], PuntosHorizonte = [], allDrawnLines = [], UF_Online = 0;
const DOMCache = { paths: {}, markers: {}, viewport: { w: window.innerWidth, h: window.innerHeight, left: 0, top: 0 } }; 
let isHeatmapActive = false, isWebGLSupported = true, viewerGpuReady = true, smartInitAttempts = 0, panoramaEventsBound = false, pannellumIntroBootstrapped = false, svgFrameCounter = 0;
function isTouchDevice() { return (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window); }
function isSvgRenderAllowed() { 
    if (isIntroAnimating) return false;
    return (!isWebGLSupported) ? false : (isTouchDevice() ? viewerGpuReady && !!visor360 : true); 
}
function shouldUpdateSVGThisFrame() { return true; }

function flashScreenSuccess() {
    let flash = document.createElement('div');
    flash.style.position = 'fixed'; flash.style.top = '0'; flash.style.left = '0'; flash.style.width = '100%'; flash.style.height = '100%';
    flash.style.backgroundColor = 'rgba(16, 185, 129, 0.4)'; flash.style.zIndex = '999999999'; flash.style.pointerEvents = 'none'; flash.style.transition = 'opacity 0.5s ease-out';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 50); setTimeout(() => { flash.remove(); }, 550);
}

function flashScreenError() {
    let flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(239,68,68,0.3);z-index:999999999;pointer-events:none;transition:opacity 0.5s ease-out;';
    document.body.appendChild(flash);
    setTimeout(() => { flash.style.opacity = '0'; }, 60); setTimeout(() => { flash.remove(); }, 580);
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-55%) scale(0.92);background:rgba(10,15,25,0.96);backdrop-filter:blur(20px);border:1px solid rgba(239,68,68,0.55);border-radius:18px;padding:18px 28px;color:#fff;font-size:12px;font-weight:700;text-align:center;z-index:9999999999;pointer-events:none;opacity:0;transition:opacity 0.25s,transform 0.25s;line-height:1.6;max-width:80vw;box-shadow:0 20px 50px rgba(0,0,0,0.7);';
    toast.innerHTML = '✂️ CORTE NO VÁLIDO<br><span style="font-size:10px;font-weight:500;color:#94a3b8;">La línea debe cruzar dos bordes opuestos de un polígono cerrado</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity='1'; toast.style.transform='translate(-50%,-50%) scale(1)'; });
    setTimeout(() => { toast.style.opacity='0'; toast.style.transform='translate(-50%,-55%) scale(0.92)'; setTimeout(() => toast.remove(), 280); }, 3000);
}

function mostrarToast(mensaje, isSuccess = true) {
    const toast = document.createElement('div');
    const border = isSuccess ? 'rgba(16,185,129,0.55)' : 'rgba(59,130,246,0.55)';
    toast.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-55%) scale(0.92);background:rgba(10,15,25,0.96);backdrop-filter:blur(20px);border:1px solid ${border};border-radius:18px;padding:18px 28px;color:#fff;font-size:12px;font-weight:700;text-align:center;z-index:9999999999;pointer-events:none;opacity:0;transition:opacity 0.25s,transform 0.25s;line-height:1.6;max-width:80vw;box-shadow:0 20px 50px rgba(0,0,0,0.7);`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%,-50%) scale(1)'; });
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%,-55%) scale(0.92)'; setTimeout(() => toast.remove(), 280); }, 3200);
}

const TouchPerfPhase1 = {
    overlayFrame: 0, panBindDone: false,
    init() {
        if (!isTouchDevice()) return;
        document.body.classList.add('is-touch-device');
        this.bindPanoramaDragClass();
    },
    bindPanoramaDragClass() {
        if (this.panBindDone) return;
        const container = document.getElementById('panorama-container');
        if (!container) return;
        this.panBindDone = true;
        const onStart = () => { document.body.classList.add('panorama-dragging'); };
        const onEnd = () => { document.body.classList.remove('panorama-dragging'); this.applyOverlayDecor(); };
        container.addEventListener('mousedown', onStart);
        container.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
        window.addEventListener('touchcancel', onEnd);
    },
    shouldUpdateOverlayDecorThisFrame() { this.overlayFrame++; return (this.overlayFrame % 2) === 0; },
    applyOverlayDecor() {
        if (!visor360) return;
        const isMobile = DOMCache.viewport.w <= 768, currentHfov = visor360.getHfov();
        let newScale = (isMobile ? 0.30 : 0.45) * (DEFAULT_HFOV / currentHfov);
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        document.querySelectorAll('.pin-scaler').forEach((s) => { s.style.transform = `scale(${newScale})`; });
        let zoomFactor = DEFAULT_HFOV / currentHfov, baseStroke = isMobile ? 1.2 : 2.0, dynStroke = baseStroke * zoomFactor;
        if (isMobile) { dynStroke = Math.max(0.8, Math.min(dynStroke, 3.0)); } else { dynStroke = Math.max(1.5, Math.min(dynStroke, 4.5)); }
        document.documentElement.style.setProperty('--stroke-dyn', dynStroke + 'px');
        document.documentElement.style.setProperty('--stroke-dyn-hover', (dynStroke + 1.2) + 'px');
    }
};

const SmartGpuProfile = {
    maxDPR: 1.25, maxTextureSize: 4096, _blobUrl: null, isHighEnd: false,
    init() { TouchPerfPhase1.init(); const caps = this.probeWebGL(); const ram = navigator.deviceMemory || 4; if (ram > 6 && caps.maxTextureSize >= 8192) { this.isHighEnd = true; this.maxTextureSize = caps.maxTextureSize; } else { this.isHighEnd = false; this.maxTextureSize = Math.min(caps.maxTextureSize || 4096, 4096); } },
    probeWebGL() { const attrs = { alpha: false, antialias: false, depth: false, stencil: false, failIfMajorPerformanceCaveat: false }; try { const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8; const gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs); if (!gl) return { ok: false, maxTextureSize: 2048 }; return { ok: true, maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096 }; } catch (e) { return { ok: false, maxTextureSize: 2048 }; } },
    loadImage(url) { return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('Panorama load failed')); img.src = url + (url.includes('?') ? '&' : '?') + 'probe=' + Date.now(); }); },
    async preparePanorama(url, forceLite) { if (this.isHighEnd && !forceLite) return url; try { const img = await this.loadImage(url); const w = img.naturalWidth || img.width; const h = img.naturalHeight || img.height; const effective = Math.max(w / 2, h); const budget = forceLite ? 2048 : this.maxTextureSize; if (effective <= budget * 0.92) return url; const scale = (budget * 0.88) / effective; const canvas = document.createElement('canvas'); let newWidth = Math.floor(w * scale); if (newWidth % 2 !== 0) newWidth += 1; canvas.width = newWidth; canvas.height = newWidth / 2; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, canvas.width, canvas.height); return await new Promise((resolve) => { canvas.toBlob((blob) => { if (!blob) { resolve(url); return; } if (this._blobUrl) URL.revokeObjectURL(this._blobUrl); this._blobUrl = URL.createObjectURL(blob); resolve(this._blobUrl); }, 'image/jpeg', 0.88); }); } catch (e) { return url; } },
    patchRenderer(renderer) { if (!renderer || typeof renderer.resize !== 'function') return; setTimeout(() => { try { renderer.resize(); } catch(e) {} }, 150); },
    bindContextRecovery(canvas, onRestore) { if (!canvas) return; canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); viewerGpuReady = false; const sp = document.getElementById('splash-loading-text'); if (sp) sp.innerText = 'RECUPERANDO MOTOR GPU...'; }, false); canvas.addEventListener('webglcontextrestored', () => { if (onRestore) onRestore(); }, false); }
};

function detectWebGL() { try { const canvas = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))); } catch(e) { return false; } }
function hexToRgb(hex) { if(!hex) return '255, 255, 255'; var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255'; }
const _osrmRutaCache = new Map();
function parseCoordenadasDestino(str) {
    if (!str || !String(str).includes(',')) return null;
    const parts = String(str).replace(/\s/g, '').split(',');
    if (parts.length < 2) return null;
    const lat = parseFloat(parts[0]), lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
}
function parseMetricaRuta(str, defaultUnit) {
    if (!str) return { v: '0', u: defaultUnit };
    const s = String(str).trim();
    const m = s.match(/^([\d.,]+)\s*(.*)$/i);
    if (!m) return { v: s, u: defaultUnit };
    const u = (m[2] || defaultUnit).toUpperCase() || defaultUnit;
    return { v: m[1], u };
}
function formatearDistanciaKm(km) { return (typeof km === 'number' ? km.toFixed(1) : String(km)) + ' KM'; }
function formatearTiempoMin(min) { return Math.round(Number(min) || 0) + ' MIN'; }
function getFactorTraficoChile(date) {
    date = date || new Date();
    const h = date.getHours(), day = date.getDay(), month = date.getMonth();
    let factor = 1.0, etiqueta = 'Flujo normal';
    const isWeekday = day >= 1 && day <= 5;
    if (isWeekday) {
        if ((h >= 7 && h < 9) || (h === 9 && date.getMinutes() < 30)) { factor = 1.38; etiqueta = 'Hora punta mañana'; }
        else if (h >= 17 && h < 20) { factor = 1.48; etiqueta = 'Hora punta tarde'; }
        else if (h >= 12 && h < 14) { factor = 1.12; etiqueta = 'Mediodía'; }
    } else if (day === 6 && h >= 10 && h < 14) { factor = 1.18; etiqueta = 'Sábado'; }
    else if (day === 0 && h >= 11 && h < 19) { factor = 1.14; etiqueta = 'Domingo'; }
    if (month >= 11 || month <= 1) { factor *= 1.1; etiqueta += ' · Temporada alta'; }
    if (h >= 22 || h < 6) { factor = Math.max(0.88, factor * 0.92); etiqueta = 'Madrugada/noche'; }
    return { factor, etiqueta };
}
function getTrafficByScenario(scenario, date) {
    if (!scenario || scenario === 'auto') return getFactorTraficoChile(date);
    const presets = {
        normal: { factor: 1.0, etiqueta: 'Flujo normal' },
        punta_am: { factor: 1.38, etiqueta: 'Hora punta mañana' },
        punta_pm: { factor: 1.48, etiqueta: 'Hora punta tarde' },
        sabado: { factor: 1.18, etiqueta: 'Sábado' },
        domingo: { factor: 1.14, etiqueta: 'Domingo' },
        libre: { factor: 0.88, etiqueta: 'Tráfico libre / madrugada' },
        temporada: { factor: 1.32, etiqueta: 'Temporada alta' }
    };
    return presets[scenario] || getFactorTraficoChile(date);
}
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function calcularRutaHeuristica(lat1, lon1, lat2, lon2, trafficScenario) {
    const distRecta = haversineKm(lat1, lon1, lat2, lon2);
    const winding = distRecta < 8 ? 1.42 : distRecta < 35 ? 1.48 : distRecta < 80 ? 1.55 : 1.62;
    const distRuta = distRecta * winding;
    let vel = distRuta < 3 ? 22 : distRuta < 10 ? 38 : distRuta < 30 ? 58 : distRuta < 70 ? 72 : 68;
    const traffic = getTrafficByScenario(trafficScenario);
    let min = (distRuta / vel) * 60 * traffic.factor;
    if (distRuta > 25) min += Math.floor(distRuta / 80) * 10;
    if (distRuta > 45) min = Math.max(min, distRuta * 1.05);
    if (distRuta > 90) min = Math.max(min, distRuta * 1.15);
    return { km: distRuta.toFixed(1), min: Math.round(min), factor: traffic.factor, etiqueta: traffic.etiqueta, source: 'heuristica' };
}
function calcularRutaEstimada(lat1, lon1, lat2, lon2) {
    const h = calcularRutaHeuristica(lat1, lon1, lat2, lon2);
    return { km: h.km, min: h.min };
}
async function fetchRutaOSRM(lat1, lon1, lat2, lon2, timeoutMs) {
    timeoutMs = timeoutMs || 9000;
    const key = lat1.toFixed(4) + ',' + lon1.toFixed(4) + '->' + lat2.toFixed(4) + ',' + lon2.toFixed(4);
    if (_osrmRutaCache.has(key)) return _osrmRutaCache.get(key);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const url = 'https://router.project-osrm.org/route/v1/driving/' + lon1 + ',' + lat1 + ';' + lon2 + ',' + lat2 + '?overview=false';
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json();
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const route = data.routes[0];
            const out = { kmRaw: route.distance / 1000, minRaw: route.duration / 60, source: 'osrm' };
            _osrmRutaCache.set(key, out);
            return out;
        }
    } catch (e) {}
    finally { clearTimeout(timer); }
    return null;
}
async function calcularRutaCompleta(lat1, lon1, lat2, lon2, trafficScenario) {
    const traffic = getTrafficByScenario(trafficScenario);
    const osrm = await fetchRutaOSRM(lat1, lon1, lat2, lon2);
    if (osrm) {
        const km = osrm.kmRaw;
        let min = osrm.minRaw * traffic.factor;
        if (km > 20) min += Math.floor(km / 70) * 8;
        if (km > 50) min = Math.max(min, km * 0.92);
        if (km > 100) min = Math.max(min, km * 1.05);
        return { km: km.toFixed(1), min: Math.round(min), factor: traffic.factor, etiqueta: traffic.etiqueta, source: 'osrm' };
    }
    return calcularRutaHeuristica(lat1, lon1, lat2, lon2, trafficScenario);
}
function aplicarEstimacionRutaAPin(punto, est) {
    if (!punto || !est) return;
    punto.distancia = formatearDistanciaKm(est.km);
    punto.tiempo = formatearTiempoMin(est.min);
    punto.rutaFactorTrafico = est.factor;
    punto.rutaEtiquetaTrafico = est.etiqueta;
    punto.rutaFuente = est.source;
    punto.rutaCalculadaEn = Date.now();
}
async function calcularRutaParaPin(punto, opts) {
    opts = opts || {};
    if (!OrigenDrone?.lat || !OrigenDrone?.lng) return null;
    const dest = parseCoordenadasDestino(punto.coordenadasDestino);
    if (!dest) return null;
    const scenario = opts.scenario || punto.rutaEscenarioTrafico || 'auto';
    const est = await calcularRutaCompleta(OrigenDrone.lat, OrigenDrone.lng, dest.lat, dest.lng, scenario);
    if (est) {
        aplicarEstimacionRutaAPin(punto, est);
        punto.rutaEscenarioTrafico = scenario;
    }
    return est;
}
async function syncRutasDesdeOrigen(opts) {
    opts = opts || {};
    if (!OrigenDrone?.lat || !OrigenDrone?.lng || !PuntosHorizonte?.length) return false;
    let updated = false;
    for (const punto of PuntosHorizonte) {
        if (punto.tipo !== 'ruta' && punto.tipo !== 'horizonte') continue;
        const dest = parseCoordenadasDestino(punto.coordenadasDestino);
        if (!dest) continue;
        const vacio = !punto.distancia || /^0(\.0)?(\s*KM)?$/i.test(String(punto.distancia).trim()) || !punto.tiempo || /^0(\s*MIN)?$/i.test(String(punto.tiempo).trim());
        const recalc = punto.tipo === 'ruta' || opts.refreshAll || (opts.refreshEmptyHorizonte !== false && vacio);
        if (!recalc) continue;
        const est = await calcularRutaParaPin(punto);
        if (est) updated = true;
        await new Promise(r => setTimeout(r, 180));
    }
    if (updated) { refreshAllHotspots(); saveToLocal(); }
    return updated;
}

function applyProjectConfig() {
    document.getElementById('head-title-tag').innerText = `Masterplan 360 | ${ConfigProyecto.titulo || "PROYECTO INMOBILIARIO"}`;
    const splashTitle = document.getElementById('splash-title'); if(splashTitle) splashTitle.innerText = ConfigProyecto.titulo || "PROYECTO INMOBILIARIO";
    const uiTitle = document.getElementById('ui-main-title'); if(uiTitle) uiTitle.innerText = ConfigProyecto.titulo || "PROYECTO INMOBILIARIO";
    const uiSub = document.getElementById('ui-subtitle'); if(uiSub) uiSub.innerText = ConfigProyecto.subtitulo || "Masterplan Interactivo 360°";
    const root = document.documentElement;
    if(ConfigProyecto.colorDisp) root.style.setProperty('--c-disp', hexToRgb(ConfigProyecto.colorDisp)); if(ConfigProyecto.colorRes) root.style.setProperty('--c-res', hexToRgb(ConfigProyecto.colorRes)); if(ConfigProyecto.colorVend) root.style.setProperty('--c-vend', hexToRgb(ConfigProyecto.colorVend)); if(ConfigProyecto.colorNoDisp) root.style.setProperty('--c-nodisp', hexToRgb(ConfigProyecto.colorNoDisp));
    if(ConfigProyecto.opacidadDisp !== undefined) root.style.setProperty('--o-disp', ConfigProyecto.opacidadDisp / 100); if(ConfigProyecto.opacidadRes !== undefined) root.style.setProperty('--o-res', ConfigProyecto.opacidadRes / 100); if(ConfigProyecto.opacidadVend !== undefined) root.style.setProperty('--o-vend', ConfigProyecto.opacidadVend / 100); if(ConfigProyecto.opacidadNoDisp !== undefined) root.style.setProperty('--o-nodisp', ConfigProyecto.opacidadNoDisp / 100);
    const banner = document.getElementById('promo-banner-hud'); const urlParams = new URLSearchParams(window.location.search);
    if (banner && ConfigProyecto.bannerActivo && urlParams.get('admin') !== 'true') {
        const iconos = { 'descuento': '🔥', 'cyber': '💻', 'blackfriday': '⬛', 'verde': '🌱', 'ultimos': '🚨', 'lanzamiento': '🚀', 'bono': '🎁', 'personalizado': '✨' };
        document.getElementById('promo-icon').innerText = iconos[ConfigProyecto.bannerTipo] || '✨'; document.getElementById('promo-text').innerText = ConfigProyecto.bannerTexto || '¡Aprovecha nuestras ofertas!';
        let grad = 'linear-gradient(90deg, #10b981, #059669)'; if(ConfigProyecto.bannerTipo === 'descuento' || ConfigProyecto.bannerTipo === 'ultimos') grad = 'linear-gradient(90deg, #ef4444, #b91c1c)'; if(ConfigProyecto.bannerTipo === 'cyber' || ConfigProyecto.bannerTipo === 'blackfriday') grad = 'linear-gradient(90deg, #1e293b, #000000)'; if(ConfigProyecto.bannerTipo === 'bono') grad = 'linear-gradient(90deg, #3b82f6, #1d4ed8)';
        banner.style.background = grad; banner.style.display = 'block'; setTimeout(() => { banner.classList.add('show'); document.body.classList.add('has-banner'); }, 500);
    } else if (banner) { banner.classList.remove('show'); document.body.classList.remove('has-banner'); setTimeout(() => { banner.style.display = 'none'; }, 500); }
    const waBtn = document.querySelector('a.dock-btn.primary'); if(waBtn && ConfigProyecto.whatsapp) { waBtn.href = `https://wa.me/${ConfigProyecto.whatsapp.replace(/\D/g,'')}`; }
    initMasterplanPremiumFromData();
}

function saveToLocal() { localStorage.setItem(FRESIA_CFG.autosaveKey, JSON.stringify({ configProyecto: ConfigProyecto, origen: OrigenDrone, norte: NorteOffset, lotes: BaseDatosLotes, horizontes: PuntosHorizonte, trazos: allDrawnLines })); }
function loadFromLocal() { const savedData = localStorage.getItem(FRESIA_CFG.autosaveKey); if (savedData) { try { const parsed = JSON.parse(savedData); if((parsed.lotes && parsed.lotes.length > 0) || (parsed.trazos && parsed.trazos.length > 0)) { ConfigProyecto = parsed.configProyecto || ConfigProyecto; OrigenDrone = parsed.origen || OrigenDrone; NorteOffset = parsed.norte || 0; BaseDatosLotes = parsed.lotes || BaseDatosLotes; PuntosHorizonte = parsed.horizontes || PuntosHorizonte; allDrawnLines = parsed.trazos || allDrawnLines; } } catch(e) {} } }
async function fetchValorUFOnline() { try { const response = await fetch('https://mindicador.cl/api/uf', { cache: 'no-store' }); if (response.ok) { const data = await response.json(); if(data && data.serie && data.serie.length > 0) { UF_Online = data.serie[0].valor; return; } } } catch (error) {} }
function arq2_migrateCallesGeometry() {
    // Rebuild geometry for legacy 2D streets (tipo 'calle') to make them true 3D
    // and regenerate ALL calle-curva-arq2 with the new spherical algorithm.
    for (const line of allDrawnLines) {
        if (line.tipo === 'calle') {
            line.tipo = 'calle-curva-arq2';
            line.ejeOriginal = [...line.puntos];
            const geo = arq2_buildCalleCurvaGeometry(line.ejeOriginal, line.ancho || 8, line.calleAlpha || 0, false);
            if (geo) {
                line.left = geo.left;
                line.right = geo.right;
                line.ejeIsClosed = geo.ejeIsClosed;
                line.fillPoly = geo.fillPoly;
                line.puntosSuavizados = geo.puntosSuavizados;
                line.calleCurvaAlpha = line.calleAlpha || 0;
            }
        }
        else if (line.tipo === 'calle-curva-arq2' && line.ejeOriginal) {
            // Siempre regenerar con el nuevo algoritmo esférico para eliminar
            // cualquier geometría calculada con el método de píxeles/cámara.
            const geo = arq2_buildCalleCurvaGeometry(
                line.ejeOriginal,
                line.ancho || 8,
                line.calleCurvaAlpha || 0,
                line.calleRetorno || false
            );
            if (geo) {
                line.left = geo.left;
                line.right = geo.right;
                line.ejeIsClosed = geo.ejeIsClosed;
                line.fillPoly = geo.fillPoly;
                line.puntosSuavizados = geo.puntosSuavizados;
            }
        }
    }
}
async function fetchMasterData() { try { const response = await fetch(FRESIA_CFG.datosJson + '?v=' + new Date().getTime()); if(response.ok) { const data = await response.json(); ConfigProyecto = data.configProyecto || ConfigProyecto; OrigenDrone = data.origen || null; NorteOffset = data.norte || 0; BaseDatosLotes = data.lotes || []; PuntosHorizonte = data.horizontes || []; allDrawnLines = data.trazos || []; } else { loadFromLocal(); } } catch(e) { loadFromLocal(); } applyProjectConfig(); await syncRutasDesdeOrigen(); }

let visor360, currentPinSizeIndex = 1, isIntroAnimating = true, isDevModeDrawActive = false, isDevModePinsActive = false, isArquitecto2Active = false, arq2Tool = 'lote-libre', arq2LinePoints = [], arq2TempLineId = 'arq2_temp_' + Date.now(), arq2CosturaSnap = null, arq2CosturaStyle = 'punteada', arq2SelectedLineId = null, arq2FilaVariableContorno = null, arq2PendingFila = null, arq2InvasionActive = false, arq2SmoothCurves = true, arq2DemoActive = false, arq2DemoTimers = [], arq2DemoLoopInterval = null, arq2DemoPY = null, currentLineType = 'solida', currentLinePoints = [], currentPinTypeMap = 'disponible', currentTempLineId = 'temp_' + Date.now(), draggingVertex = null, draggingFranjaDiv = null, draggingCalleMove = null, pickedPin = null, snapCursor = null, ghostPin = null, snappedCoords = null, activePinArgs = null, isCreatingNewPin = false, isSnapToClose = false, franjaCornerA = null, franjaPreviewQuad = null, franjaPreviewDivs = [], franjaCurvaPreviewStrip = null, franjaDraftCount = 10, franjaDraftBaseM2 = 5000, franjaPendingCreate = null, guardarNubeEnCurso = false, draftCalleAncho = 8, draftCalleAlpha = 0, draftCalleLabelScale = 1, draftCalleShowLabel = true, draftCalleSnapFranja = false, calleSnapIsFranjaEdge = false, lastCalleTap = null, draftCalleCurvaColor = '#5a5f69', isLineaPinesActive = false, lineaPinesPoints = [], lineaPinesTempId = 'linea_pins_' + Date.now(), franjaCurvaFrente = [], franjaCurvaFase = 0;
function revealLoteoOverlay() {
    isIntroAnimating = false;
    document.body.classList.add('loteo-overlay-ready');
    syncFranjaVisualsOnReady();
    const svg = document.getElementById('loteo-svg');
    if (svg && isSvgRenderAllowed()) svg.style.opacity = '1';
    if (!visor360) return;
    arq2_migrateCallesGeometry(); // fix existing closed streets to render as rings
    refreshAllHotspots(true);
    syncSVGElements();
    updateSVGPaths();
    const renderer = visor360.getRenderer && visor360.getRenderer();
    if (renderer) hookRendererOverlay(renderer);
}
const DEFAULT_HFOV = 125, MAX_SCALE = 1.0, MIN_SCALE = 0.20, SNAP_DISTANCE = 8.0;
var lastDevDrawClickMs = 0, lastArq2DrawClickMs = 0, closeOriginHighlighted = false,
    arq2CalleCurvaAncho = 8, draftCalleCurvaAlpha = 0.55, arq2SmoothIntensity = 5, arq2CalleRetorno = false, arq2Guideline = null,
    draftCalleCurvaCurvatura = 5;

// === FASE 1 — Fila sobre Calle (state) ===
let arq2FilaCalle = null; // { streetId, side ('left'|'right'), borderPts, depthFactor, contorno }

function getCloseSnapScreenRadiusPx() {
    const hfov = visor360?.getHfov?.() || DEFAULT_HFOV;
    return Math.max(6, Math.min(16, 10 / (100 / hfov)));
}
function getCloseSnapPanoramaThreshold() {
    const hfov = visor360?.getHfov?.() || DEFAULT_HFOV;
    return Math.max(1.0, SNAP_DISTANCE * 0.22 * (hfov / DEFAULT_HFOV));
}
function canTriggerPolygonAutoClose() {
    const last = isArquitecto2Active ? lastArq2DrawClickMs : lastDevDrawClickMs;
    return Date.now() - last >= 300;
}
function isNearPolygonOriginPY(p, y, originPt) {
    if (!originPt) return false;
    const proj = getPanoramaScreenProjector();
    if (proj && visor360) {
        const s0 = proj.toScreen(originPt[0], originPt[1]);
        const s1 = proj.toScreen(p, y);
        if (s0 && s1) {
            const dScreen = Math.hypot(s0[0] - s1[0], s0[1] - s1[1]);
            if (dScreen < getCloseSnapScreenRadiusPx()) return true;
        }
    }
    return Math.hypot(p - originPt[0], y - originPt[1]) < getCloseSnapPanoramaThreshold();
}
function arq2_isValidPYPoint(pt) {
    return Array.isArray(pt) && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]) && !isNaN(pt[0]) && !isNaN(pt[1]);
}
function arq2_sanitizePolylinePoints(pts) {
    if (!pts?.length) return [];
    const out = [];
    pts.forEach(pt => {
        if (!arq2_isValidPYPoint(pt)) return;
        if (out.length && Math.hypot(pt[0] - out[out.length - 1][0], pt[1] - out[out.length - 1][1]) < 1e-6) return;
        out.push([parseFloat(pt[0]), parseFloat(pt[1])]);
    });
    return out;
}
function arq2_restoreAnchoredVertices(smoothed, anchors, tol = 0.08) {
    if (!anchors?.length || !smoothed?.length) return smoothed;
    return smoothed.map(pt => {
        let best = null, bestD = tol;
        anchors.forEach(a => {
            const d = Math.hypot(pt[0] - a[0], pt[1] - a[1]);
            if (d < bestD) { bestD = d; best = a; }
        });
        return best ? [parseFloat(best[0].toFixed(4)), parseFloat(best[1].toFixed(4))] : pt;
    });
}
function arq2_mergeSharedBoundaryVertices(lineId) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.puntos || !line.sharedSegs?.length) return;
    line.sharedSegs.forEach(segIdx => {
        const meta = line.sharedSegMeta?.[segIdx];
        if (!meta?.lineId) return;
        const other = allDrawnLines.find(l => l.id === meta.lineId);
        if (!other?.puntos) return;
        const n = line.puntos.length, on = other.puntos.length;
        const i1 = segIdx, i2 = (segIdx + 1) % n;
        const j1 = meta.segIdx, j2 = (meta.segIdx + 1) % on;
        const mid1 = [(line.puntos[i1][0] + other.puntos[j1][0]) / 2, (line.puntos[i1][1] + other.puntos[j1][1]) / 2];
        const mid2 = [(line.puntos[i2][0] + other.puntos[j2][0]) / 2, (line.puntos[i2][1] + other.puntos[j2][1]) / 2];
        line.puntos[i1] = [parseFloat(mid1[0].toFixed(4)), parseFloat(mid1[1].toFixed(4))];
        line.puntos[i2] = [parseFloat(mid2[0].toFixed(4)), parseFloat(mid2[1].toFixed(4))];
        other.puntos[j1] = [...line.puntos[i1]];
        other.puntos[j2] = [...line.puntos[i2]];
    });
}
function arq2_applyCosturaStrokeAttrs(pathEl, style) {
    if (!pathEl) return;
    const isPunteada = style !== 'solida';
    pathEl.setAttribute('stroke-dasharray', isPunteada ? '6,6' : 'none');
    pathEl.setAttribute('data-shared-edge', 'true');
    pathEl.setAttribute('data-costura-style', isPunteada ? 'punteada' : 'solida');
}
function arq2_getCosturaEstilo(lineData) {
    return lineData?.costuraEstilo || lineData?.costuraStyle || arq2CosturaStyle || 'punteada';
}
function arq2_applyCosturaEstiloToPath(pathEl, estilo) {
    if (!pathEl) return;
    const dynPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stroke-dyn') || '2.5') || 2.5;
    const isPunteada = estilo !== 'solida';
    pathEl.setAttribute('data-costura-style', isPunteada ? 'punteada' : 'solida');
    pathEl.setAttribute('stroke-dasharray', isPunteada ? '5,7' : 'none');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.style.setProperty('stroke-dasharray', isPunteada ? '5,7' : 'none', 'important');
    pathEl.style.setProperty('stroke', isPunteada ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.94)', 'important');
    pathEl.style.setProperty('stroke-width', (dynPx * 0.42) + 'px', 'important');
    pathEl.style.setProperty('stroke-linecap', 'round', 'important');
    pathEl.style.setProperty('stroke-linejoin', 'round', 'important');
}

function arq2_resolveSharedSegStyle(lineData, segIdx) {
    if (!lineData?.sharedSegs?.includes(segIdx)) return null;
    const meta = lineData.sharedSegMeta?.[segIdx];
    const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
    if (other && (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle')) {
        return 'solida';
    }
    const segStyle = lineData.sharedSegStyles?.[segIdx];
    if (segStyle === 'punteada' || segStyle === 'solida') return segStyle;
    return arq2_getCosturaEstilo(lineData);
}
function arq2_syncCosturaStylesFromLineEstilo(lineId) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.sharedSegs?.length) return;
    const estilo = arq2_getCosturaEstilo(line);
    line.costuraEstilo = estilo;
    line.costuraStyle = estilo;
    line.sharedSegs.forEach(i => {
        const meta = line.sharedSegMeta?.[i];
        const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
        if (other && (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle')) {
            line.sharedSegStyles[i] = 'solida';
        } else {
            line.sharedSegStyles[i] = estilo;
        }
    });
}
function arq2_buildSharedEdgePaths(pts, sharedSegs, sharedStyles, isClosed, getCamFn, cx, cySc, f, costuraDefault) {
    let dPunteada = '', dSolida = '';
    const defaultStyle = costuraDefault || 'punteada';
    const segN = isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < segN; i++) {
        if (!sharedSegs || !sharedSegs.includes(i)) continue;
        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= 0.0001 && c2.z <= 0.0001) continue;
        let s1, s2;
        if (c1.z > 0.0001) s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f };
        else { const t = c1.z / (c1.z - c2.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / 0.0001) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / 0.0001) * f }; }
        if (c2.z > 0.0001) s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f };
        else { const t = c2.z / (c2.z - c1.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / 0.0001) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / 0.0001) * f }; }
        let segStr;
        if (s1.x < s2.x || (s1.x === s2.x && s1.y < s2.y)) {
            segStr = `M ${s1.x},${s1.y} L ${s2.x},${s2.y} `;
        } else {
            segStr = `M ${s2.x},${s2.y} L ${s1.x},${s1.y} `;
        }
        const style = (sharedStyles && sharedStyles[i]) || defaultStyle;
        if (style === 'solida') dSolida += segStr;
        else dPunteada += segStr;
    }
    return { dPunteada, dSolida };
}
function arq2_ensureOrganicPathLayers(gNode, lineData) {
    if (!gNode) return null;
    const roleSpec = [
        { role: 'fill', cls: 'linea-organico-fill', apply: 'fill' },
        { role: 'perimeter', cls: 'linea-organico-perimetro', apply: 'perimeter' },
        { role: 'shared-punteada', cls: 'linea-punteada-costura', apply: 'dash' },
        { role: 'shared-solida', cls: 'linea-solida-costura', apply: 'shared-solid' }
    ];
    const byRole = {};
    Array.from(gNode.querySelectorAll('path')).forEach(p => {
        const role = p.dataset.edgeRole;
        if (role) byRole[role] = p;
    });
    roleSpec.forEach(spec => {
        if (!byRole[spec.role]) {
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.dataset.edgeRole = spec.role;
            p.setAttribute('class', spec.cls);
            byRole[spec.role] = p;
            gNode.appendChild(p);
        }
    });
    const ordered = roleSpec.map(spec => {
        const p = byRole[spec.role];
        p.setAttribute('class', spec.cls);
        if (spec.apply === 'dash') arq2_applyCosturaEstiloToPath(p, 'punteada');
        else if (spec.apply === 'shared-solid') arq2_applyCosturaEstiloToPath(p, 'solida');
        else arq2_applyOrganicPathAttrs(p, spec.apply);
        return p;
    });
    ordered.forEach(p => gNode.appendChild(p));
    if (lineData?.id && DOMCache.paths[lineData.id]) DOMCache.paths[lineData.id].base = ordered;
    return ordered;
}
function arq2_syncOrganicLotePaths(lineData, cacheObj, getCamFn, cx, cySc, f) {
    if (!lineData?.puntos?.length || !cacheObj) return;
    if (cacheObj.gNode) {
        const ordered = arq2_ensureOrganicPathLayers(cacheObj.gNode, lineData);
        if (ordered) cacheObj.base = ordered;
    }
    if (!cacheObj.base || cacheObj.base.length < 4) return;
    const paths = cacheObj.base;
    const costuraEstilo = arq2_getCosturaEstilo(lineData);
    // A "costura lot" is one the user explicitly drew with the Costura tool
    const isCosturaLot = !!(lineData.costuraEstilo || lineData.costuraStyle);

    // Mark the group element so CSS can target it
    if (cacheObj.gNode) cacheObj.gNode.setAttribute('data-costura-estilo', isCosturaLot ? costuraEstilo : 'none');

    // Fill is always the same
    const dFill = arq2_projectPolylineD(lineData.puntos, true, getCamFn, cx, cySc, f);
    paths[0].setAttribute('d', dFill.trim() || 'M -999 -999');
    arq2_applyOrganicPathAttrs(paths[0], 'fill');

    // Calcular grosor matemáticamente sin bloquear el DOM
    const currentHfov = (typeof visor360 !== 'undefined' && visor360) ? visor360.getHfov() : 130;
    const dynPx = Math.max(1.0, Math.min(4.5, 2.5 * (130 / currentHfov)));

    if (isCosturaLot) {
        // --- COSTURA LOT: render ALL edges in the costura style (dashed or solid) ---
        // paths[1]: solid perimeter → hidden for costura lots
        paths[1].setAttribute('d', 'M -999 -999');
        paths[1].style.cssText = 'display:none !important;';

        // Special case: 2-point costura = simple dividing LINE (not a polygon)
        if (lineData.puntos.length === 2) {
            const p1 = lineData.puntos[0], p2 = lineData.puntos[1];
            const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
            let lineD = 'M -999 -999';
            if (c1.z > 0.0001 && c2.z > 0.0001) {
                const s1x = cx + (c1.x / c1.z) * f, s1y = cySc - (c1.y / c1.z) * f;
                const s2x = cx + (c2.x / c2.z) * f, s2y = cySc - (c2.y / c2.z) * f;
                lineD = `M ${s1x},${s1y} L ${s2x},${s2y}`;
            }
            paths[0].setAttribute('d', 'M -999 -999');
            paths[0].style.cssText = 'display:none;';
            paths[2].setAttribute('d', lineD);
            paths[2].style.cssText = `fill:none !important; stroke:rgba(255,255,255,0.78) !important; stroke-width:${(dynPx*0.42).toFixed(2)}px !important; stroke-dasharray:5,7 !important; stroke-linecap:round !important; stroke-linejoin:round !important; vector-effect:non-scaling-stroke; pointer-events:none;`;
            paths[2].setAttribute('data-costura-style', 'punteada');
            paths[3].setAttribute('d', 'M -999 -999');
            paths[3].style.cssText = 'stroke:none !important; fill:none !important;';
            return;
        }

        // Build ALL edges of this lot (pass null to include every segment)
        const dAllEdges = arq2_buildNonSharedEdgePaths(lineData.puntos, null, true, getCamFn, cx, cySc, f);
        const edgesD = dAllEdges.trim() || 'M -999 -999';

        if (costuraEstilo === 'solida') {
            paths[2].setAttribute('d', 'M -999 -999');
            paths[2].style.cssText = 'stroke:none !important; fill:none !important;';
            paths[3].setAttribute('d', edgesD);
            paths[3].style.cssText = `fill:none !important; stroke:rgba(255,255,255,0.94) !important; stroke-width:${(dynPx*0.42).toFixed(2)}px !important; stroke-dasharray:none !important; stroke-linecap:round !important; stroke-linejoin:round !important; vector-effect:non-scaling-stroke; pointer-events:none;`;
            paths[3].setAttribute('data-costura-style', 'solida');
        } else {
            paths[2].setAttribute('d', edgesD);
            paths[2].style.cssText = `fill:none !important; stroke:rgba(255,255,255,0.78) !important; stroke-width:${(dynPx*0.42).toFixed(2)}px !important; stroke-dasharray:5,7 !important; stroke-linecap:round !important; stroke-linejoin:round !important; vector-effect:non-scaling-stroke; pointer-events:none;`;
            paths[2].setAttribute('data-costura-style', 'punteada');
            paths[3].setAttribute('d', 'M -999 -999');
            paths[3].style.cssText = 'stroke:none !important; fill:none !important;';
        }
    } else {
        // --- LOTE LIBRE: standard rendering with shared-segment awareness ---
        paths[1].style.cssText = '';
        paths[2].style.cssText = '';
        paths[3].style.cssText = '';
        const shared = arq2_buildSharedEdgePaths(lineData.puntos, lineData.sharedSegs, lineData.sharedSegStyles, true, getCamFn, cx, cySc, f, costuraEstilo);
        const dPerimeter = arq2_buildNonSharedEdgePaths(lineData.puntos, lineData.sharedSegs, true, getCamFn, cx, cySc, f);
        paths[1].setAttribute('d', dPerimeter.trim() || 'M -999 -999');
        arq2_applyOrganicPathAttrs(paths[1], 'perimeter');
        paths[2].setAttribute('d', shared.dPunteada.trim() || 'M -999 -999');
        arq2_applyCosturaEstiloToPath(paths[2], 'punteada');
        paths[3].setAttribute('d', shared.dSolida.trim() || 'M -999 -999');
        arq2_applyCosturaEstiloToPath(paths[3], 'solida');
    }
}

function updateCloseOriginHighlight(active) {
    closeOriginHighlighted = !!active;
    document.querySelectorAll('.vertex-marker.origin-vertex, .vertex-marker.origin-vertex-ready').forEach(el => {
        el.classList.toggle('origin-vertex-ready', closeOriginHighlighted);
    });
}

function intersectSegments(p0, p1, p2, p3) {
    let s1_x = p1[0] - p0[0], s1_y = p1[1] - p0[1]; let s2_x = p3[0] - p2[0], s2_y = p3[1] - p2[1];
    let denom = -s2_x * s1_y + s1_x * s2_y; if (Math.abs(denom) < 0.000001) return null;
    let s = (-s1_y * (p0[0] - p2[0]) + s1_x * (p0[1] - p2[1])) / denom;
    let t = ( s2_x * (p0[1] - p2[1]) - s2_y * (p0[0] - p2[0])) / denom;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) return [p0[0] + (t * s1_x), p0[1] + (t * s1_y)];
    return null;
}

function attemptSplit(lineStart, lineEnd) {
    let dx = lineEnd[0] - lineStart[0]; let dy = lineEnd[1] - lineStart[1];
    let len = Math.sqrt(dx*dx + dy*dy); if (len < 0.0001) return false;
    let nx = dx / len; let ny = dy / len;
    let extP0 = [lineStart[0] - nx * 1000, lineStart[1] - ny * 1000];
    let extP1 = [lineEnd[0] + nx * 1000, lineEnd[1] + ny * 1000];
    let newLines = []; let didSplit = false;
    
    for (let idx = 0; idx < allDrawnLines.length; idx++) {
        let l = allDrawnLines[idx];
        if (l.tipo === 'calle' || l.tipo === 'divisoria' || l.puntos.length < 3) { newLines.push(l); continue; }
        let pts = l.puntos; let intersections = [];
        for (let i = 0; i < pts.length; i++) {
            let p1 = pts[i]; let p2 = pts[(i + 1) % pts.length];
            if(Math.abs(p1[0]-p2[0]) < 0.0001 && Math.abs(p1[1]-p2[1]) < 0.0001) continue;
            let ix = intersectSegments(extP0, extP1, p1, p2);
            if (ix) {
                // Tolerancia 0.05° captura intersecciones casi-duplicadas en vértices compartidos
                let isDup = intersections.some(u => Math.abs(u.point[0]-ix[0]) < 0.05 && Math.abs(u.point[1]-ix[1]) < 0.05);
                if (!isDup) intersections.push({ point: ix, edgeIndex: i });
            }
        }
        
        if (intersections.length >= 2) {
            intersections.sort((a,b) => { let d1 = Math.pow(a.point[0]-extP0[0],2) + Math.pow(a.point[1]-extP0[1],2); let d2 = Math.pow(b.point[0]-extP0[0],2) + Math.pow(b.point[1]-extP0[1],2); return d1-d2; });
            let i1 = intersections[0]; let i2 = intersections[intersections.length-1];
            if (i1.edgeIndex > i2.edgeIndex) { let temp = i1; i1 = i2; i2 = temp; }
            // Imposible subdividir si ambas intersecciones están en el mismo borde
            if (i1.edgeIndex === i2.edgeIndex) { newLines.push(l); continue; }
            
            let polyA = []; for(let k=0; k<=i1.edgeIndex; k++) polyA.push(pts[k]); polyA.push(i1.point); polyA.push(i2.point); for(let k=i2.edgeIndex+1; k<pts.length; k++) polyA.push(pts[k]);
            let polyB = []; polyB.push(i1.point); for(let k=i1.edgeIndex+1; k<=i2.edgeIndex; k++) polyB.push(pts[k]); polyB.push(i2.point);
            // Validar que ambos sub-polígonos tienen al menos 3 vértices
            if (polyA.length < 3 || polyB.length < 3) { newLines.push(l); continue; }
            
            newLines.push({ id: 'lote_' + Date.now() + '_A_' + idx, tipo: l.tipo, puntos: polyA });
            newLines.push({ id: 'lote_' + Date.now() + '_B_' + idx, tipo: l.tipo, puntos: polyB });
            didSplit = true;
        } else { newLines.push(l); }
    }
    if (didSplit) {
        allDrawnLines = newLines;
        newLines.forEach(line => {
            if (line.id.startsWith('lote_') && (line.id.includes('_A_') || line.id.includes('_B_'))) {
                arq2_registerSharedEdges(line.id);
            }
        });
        flashScreenSuccess();
        return true;
    }
    return false;
}

function getMockEvent(e) { let cx = e.clientX, cy = e.clientY; if(cx === undefined && e.changedTouches && e.changedTouches.length > 0) { cx = e.changedTouches[0].clientX; cy = e.changedTouches[0].clientY; } return { clientX: cx, clientY: cy }; }

function isAutoMacroLotePoly(line) {
    if (!line || !line.puntos || line.puntos.length < 3) return false;
    const skip = new Set(['calle','cortar','divisoria','borde-macro','arista_solida','arista_punteada','neon','franja-preview','franja-preview-div','franja-grupo']);
    return !skip.has(line.tipo);
}
function isMacroEdgeType(tipo) { return tipo === 'divisoria' || tipo === 'borde-macro' || tipo === 'arista_solida' || tipo === 'arista_punteada'; }
function lerpPY(a, b, t) {
    const pitch = a[0] + (b[0] - a[0]) * t;
    let diff = b[1] - a[1];
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const yaw = a[1] + diff * t;
    return [pitch, yaw];
}
function polyCentroid(pts) {
    if (!pts || !pts.length) return null;
    let p = 0, y = 0;
    pts.forEach(t => { p += t[0]; y += t[1]; });
    return [p / pts.length, y / pts.length];
}
function projectionT(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return 0;
    return ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
}
function projectPointOnSegment(p, a, b) {
    const t = Math.max(0, Math.min(1, projectionT(p, a, b)));
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function intersectSegments2D(a1, a2, b1, b2) {
    const x1 = a1[0], y1 = a1[1], x2 = a2[0], y2 = a2[1];
    const x3 = b1[0], y3 = b1[1], x4 = b2[0], y4 = b2[1];
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-14) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
    return null;
}
function safeGetStorage(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function safeSetStorage(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
function buildCloudPayload() {
    const payload = { configProyecto: ConfigProyecto, origen: OrigenDrone, norte: NorteOffset, lotes: BaseDatosLotes, horizontes: PuntosHorizonte, trazos: allDrawnLines };
    if (FRESIA_CFG.payloadIncludeVista) payload.vista = FRESIA_CFG.vista;
    return payload;
}
function mergeAerialWithRemoteSuelo(remote, aerial) {
    const merged = { ...aerial };
    if (!remote) return merged;
    ['lotesSuelo', 'horizontesSuelo', 'trazosSuelo', 'norteSuelo'].forEach((k) => { if (remote[k] !== undefined) merged[k] = remote[k]; });
    return merged;
}
async function fetchGithubFileSha(user, repo, token, filename) {
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (response.status === 404) return '';
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `HTTP ${response.status}`); }
    const jsonRes = await response.json();
    return jsonRes.sha || '';
}
async function fetchGithubJsonContents(user, repo, token, filename) {
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (response.status === 404) return { sha: '', data: null };
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `HTTP ${response.status}`); }
    const jsonRes = await response.json();
    const raw = (jsonRes.content || '').replace(/\n/g, '');
    const decStr = decodeURIComponent(escape(atob(raw)));
    const decoded = decStr.trim() === '' ? {} : JSON.parse(decStr);
    return { sha: jsonRes.sha || '', data: decoded };
}
async function putGithubContents(user, repo, token, filename, message, contentEncoded, shaRef, onShaUpdate) {
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const attemptPut = async (shaValue, isRetry) => {
        const payload = { message, content: contentEncoded };
        if (shaValue) payload.sha = shaValue;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (response.ok) {
            const result = await response.json();
            if (result.content && result.content.sha && onShaUpdate) onShaUpdate(result.content.sha);
            return { ok: true, result };
        }
        const err = await response.json().catch(() => ({}));
        const msg = err.message || `HTTP ${response.status}`;
        if (!isRetry && (msg.includes('does not match') || response.status === 409)) {
            const freshSha = await fetchGithubFileSha(user, repo, token, filename);
            if (onShaUpdate) onShaUpdate(freshSha);
            return attemptPut(freshSha, true);
        }
        return { ok: false, message: msg };
    };
    return attemptPut(shaRef, false);
}
function setExportBtnState(btn, html, bg, disabled) {
    if (!btn) return;
    btn.innerHTML = html;
    if (bg !== undefined) btn.style.background = bg;
    btn.style.pointerEvents = disabled ? 'none' : 'auto';
    btn.style.opacity = disabled ? '0.7' : '1';

}
window.GlobalCloudSave = async function() {
    alert("Iniciando proceso de guardado. Asegúrate de tener conexión.");
    const btn = document.getElementById('btn-global-save');
    if (guardarNubeEnCurso) return;
    
    const user = safeGetStorage('masterplan_user');
    const repo = safeGetStorage('masterplan_repo');
    const token = safeGetStorage('masterplan_token');
    
    const originalHtml = btn ? btn.innerHTML : '💾 GUARDAR PROYECTO';
    
    if (!user || !repo || !token) {
        setExportBtnState(btn, '⚠️ REQUIERE LOGIN (admin.html)', '#ef4444', false);
        setTimeout(() => setExportBtnState(btn, originalHtml, '', false), 3500);
        alert('⚠️ Para guardar en la nube, inicia sesión una vez en admin.html con tu repositorio GitHub.\n\nLas credenciales quedan guardadas en este navegador.');
        return;
    }
    
    guardarNubeEnCurso = true;
    setExportBtnState(btn, '⏳ GUARDANDO...', '', true);
    
    try {
        if (window.arquitecto3D && window.arquitecto3D.isActive) {
            window.arquitecto3D.syncToAllDrawnLines();
        }
        
        saveToLocal();
        
        const localPayload = buildCloudPayload();
        let shaRef = safeGetStorage(FRESIA_CFG.githubShaStorageKey) || '';
        let remoteData = null;
        
        try {
            const remote = await fetchGithubJsonContents(user, repo, token, FRESIA_CFG.githubDatosFile);
            shaRef = remote.sha || shaRef;
            remoteData = remote.data;
        } catch (e) {
            shaRef = await fetchGithubFileSha(user, repo, token, FRESIA_CFG.githubDatosFile);
        }
        
        let merged;
        if (FRESIA_CFG.mergeRemoteSueloFields) {
            merged = mergeAerialWithRemoteSuelo(remoteData, localPayload);
            delete merged.vista;
        } else {
            merged = remoteData ? Object.assign({}, remoteData, localPayload) : localPayload;
        }
        
        const jsonString = JSON.stringify(merged, null, 2);
        const contentEncoded = btoa(unescape(encodeURIComponent(jsonString)));
        
        const upload = await putGithubContents(
            user, repo, token, FRESIA_CFG.githubDatosFile,
            FRESIA_CFG.githubCommitMessage,
            contentEncoded,
            shaRef,
            (sha) => safeSetStorage(FRESIA_CFG.githubShaStorageKey, sha)
        );
        
        if (upload.ok) {
            setExportBtnState(btn, '✅ GUARDADO EXCELENTE', '#10b981', true);
            flashScreenSuccess();
            setTimeout(() => setExportBtnState(btn, originalHtml, '', false), 2500);
        } else {
            alert('❌ Error al guardar en GitHub: ' + (upload.message || 'desconocido'));
            setExportBtnState(btn, originalHtml, '', false);
        }
    } catch (error) {
        alert('❌ Error de conexión al guardar en la nube. Revisa tu internet e intenta de nuevo.');
        setExportBtnState(btn, originalHtml, '', false);
    } finally {
        guardarNubeEnCurso = false;
    }
}
window.saveToLocal = function() {
    safeSetStorage(FRESIA_CFG.autosaveKey, JSON.stringify({
        configProyecto: ConfigProyecto, origen: OrigenDrone, norte: NorteOffset,
        lotes: BaseDatosLotes, horizontes: PuntosHorizonte, trazos: allDrawnLines
    }));
}
