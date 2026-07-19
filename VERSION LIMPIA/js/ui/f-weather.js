/**
 * f-weather.js — Widget meteorológico premium para KPrano Killer 360
 * API: Open-Meteo (gratuita, sin key, datos WMO oficiales)
 * Coordenadas: window.FerrariGeo.droneOrigin (lat/lng del proyecto)
 * Diseño: macOS glassmorphism ultra-blur, draggable, arrastrable
 */
'use strict';

(function () {

  const WMO_CODES = {
    0:  { label: 'Despejado',      icon: '☀️' },
    1:  { label: 'Mayormente despejado', icon: '🌤️' },
    2:  { label: 'Parcialmente nublado', icon: '⛅' },
    3:  { label: 'Nublado',        icon: '☁️' },
    45: { label: 'Niebla',         icon: '🌫️' },
    48: { label: 'Niebla helada',  icon: '🌫️' },
    51: { label: 'Llovizna leve',  icon: '🌦️' },
    53: { label: 'Llovizna',       icon: '🌦️' },
    55: { label: 'Llovizna intensa', icon: '🌧️' },
    61: { label: 'Lluvia leve',    icon: '🌧️' },
    63: { label: 'Lluvia',         icon: '🌧️' },
    65: { label: 'Lluvia intensa', icon: '🌧️' },
    71: { label: 'Nieve leve',     icon: '🌨️' },
    73: { label: 'Nieve',          icon: '❄️' },
    75: { label: 'Nieve intensa',  icon: '❄️' },
    80: { label: 'Chubascos',      icon: '🌦️' },
    81: { label: 'Chubascos',      icon: '🌧️' },
    82: { label: 'Chubascos fuertes', icon: '⛈️' },
    85: { label: 'Nieve moderada', icon: '🌨️' },
    86: { label: 'Nieve intensa',  icon: '❄️' },
    95: { label: 'Tormenta',       icon: '⛈️' },
    96: { label: 'Tormenta con granizo', icon: '⛈️' },
    99: { label: 'Tormenta fuerte', icon: '🌩️' }
  };

  const WIND_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

  function windDir(deg) {
    return WIND_DIRS[Math.round(deg / 45) % 8];
  }

  let _widget = null;
  let _dragging = false;
  let _dragOffX = 0;
  let _dragOffY = 0;
  let _refreshTimer = null;
  let _collapsed = false;

  // ─── Crear el DOM del widget ───────────────────────────────────────────────
  function createWidget() {
    const el = document.createElement('div');
    el.id = 'kpk-weather-widget';
    el.className = 'kpk-weather';
    el.setAttribute('role', 'complementary');
    el.setAttribute('aria-label', 'Widget del clima');
    el.innerHTML = `
      <div class="kpk-weather__handle" id="kpk-weather-handle" title="Arrastrar">
        <div class="kpk-weather__grip">
          <span></span><span></span><span></span>
        </div>
        <button class="kpk-weather__collapse" id="kpk-weather-toggle" title="Minimizar">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="kpk-weather__body" id="kpk-weather-body">
        <div class="kpk-weather__main">
          <div class="kpk-weather__icon" id="kpk-w-icon">—</div>
          <div class="kpk-weather__temp" id="kpk-w-temp">—</div>
        </div>
        <div class="kpk-weather__label" id="kpk-w-label">Cargando clima…</div>
        <div class="kpk-weather__details" id="kpk-w-details"></div>
        <div class="kpk-weather__footer" id="kpk-w-footer"></div>
      </div>
    `;
    document.body.appendChild(el);
    _widget = el;

    // ── Drag ──────────────────────────────────────────────────────────────────
    const handle = el.querySelector('#kpk-weather-handle');
    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      _dragging = true;
      const rect = el.getBoundingClientRect();
      _dragOffX = e.clientX - rect.left;
      _dragOffY = e.clientY - rect.top;
      el.style.transition = 'none';
      e.preventDefault();
    });
    handle.addEventListener('touchstart', (e) => {
      if (e.target.closest('button')) return;
      _dragging = true;
      const t = e.touches[0];
      const rect = el.getBoundingClientRect();
      _dragOffX = t.clientX - rect.left;
      _dragOffY = t.clientY - rect.top;
      el.style.transition = 'none';
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      if (!_dragging) return;
      moveTo(e.clientX - _dragOffX, e.clientY - _dragOffY);
    });
    document.addEventListener('touchmove', (e) => {
      if (!_dragging) return;
      const t = e.touches[0];
      moveTo(t.clientX - _dragOffX, t.clientY - _dragOffY);
    }, { passive: true });
    document.addEventListener('mouseup',  () => { _dragging = false; });
    document.addEventListener('touchend', () => { _dragging = false; });

    // ── Collapse ──────────────────────────────────────────────────────────────
    el.querySelector('#kpk-weather-toggle').addEventListener('click', toggleCollapse);

    return el;
  }

  function moveTo(x, y) {
    const maxX = window.innerWidth  - _widget.offsetWidth;
    const maxY = window.innerHeight - _widget.offsetHeight;
    _widget.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    _widget.style.top  = Math.max(0, Math.min(y, maxY)) + 'px';
    _widget.style.right  = 'auto';
    _widget.style.bottom = 'auto';
  }

  function toggleCollapse() {
    _collapsed = !_collapsed;
    const body = _widget.querySelector('#kpk-weather-body');
    const btn  = _widget.querySelector('#kpk-weather-toggle');
    body.style.display = _collapsed ? 'none' : '';
    _widget.classList.toggle('kpk-weather--collapsed', _collapsed);
    btn.innerHTML = _collapsed
      ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 2v6M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
      : `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  }

  // ─── Fetch Open-Meteo ──────────────────────────────────────────────────────
  async function fetchWeather() {
    const origin = window.FerrariGeo && window.FerrariGeo.droneOrigin;
    if (!origin || origin.lat == null || origin.lng == null) {
      setError('Sin coordenadas de origen.');
      return;
    }

    const { lat, lng } = origin;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation` +
      `&wind_speed_unit=kmh&timezone=auto&forecast_days=1`;

    try {
      setLoading();
      const res  = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderWeather(data, lat, lng);
    } catch (err) {
      console.warn('[KPK/Weather]', err);
      setError('No se pudo obtener el clima.');
    }
  }

  function setLoading() {
    const icon = _widget.querySelector('#kpk-w-icon');
    const temp = _widget.querySelector('#kpk-w-temp');
    const lbl  = _widget.querySelector('#kpk-w-label');
    if (icon) icon.textContent = '⟳';
    if (temp) temp.textContent = '—';
    if (lbl)  lbl.textContent  = 'Actualizando…';
  }

  function setError(msg) {
    const lbl = _widget.querySelector('#kpk-w-label');
    const det = _widget.querySelector('#kpk-w-details');
    if (lbl) lbl.textContent = msg;
    if (det) det.innerHTML = '';
  }

  function renderWeather(data, lat, lng) {
    const c    = data.current;
    const wmo  = WMO_CODES[c.weather_code] || { label: 'Desconocido', icon: '❓' };
    const temp = Math.round(c.temperature_2m);
    const feel = Math.round(c.apparent_temperature);
    const wind = Math.round(c.wind_speed_10m);
    const dir  = windDir(c.wind_direction_10m);
    const hum  = c.relative_humidity_2m;
    const prec = c.precipitation;
    const tz   = data.timezone_abbreviation || '';

    // Hora local en la zona del proyecto
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    _widget.querySelector('#kpk-w-icon').textContent = wmo.icon;
    _widget.querySelector('#kpk-w-temp').textContent = `${temp}°`;
    _widget.querySelector('#kpk-w-label').textContent = wmo.label;
    _widget.querySelector('#kpk-w-details').innerHTML = `
      <span title="Sensación térmica">ST ${feel}°</span>
      <span title="Humedad">💧 ${hum}%</span>
      <span title="Viento">${dir} ${wind} km/h</span>
      ${prec > 0 ? `<span title="Precipitación">🌂 ${prec.toFixed(1)} mm</span>` : ''}
    `;
    _widget.querySelector('#kpk-w-footer').textContent =
      `${lat.toFixed(4)}, ${lng.toFixed(4)} · ${timeStr}`;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    createWidget();

    // Esperar a que FerrariGeo tenga el origen (puede tardar si carga async)
    let attempts = 0;
    const tryFetch = () => {
      const origin = window.FerrariGeo && window.FerrariGeo.droneOrigin;
      if (origin && origin.lat != null) {
        fetchWeather();
      } else if (attempts++ < 20) {
        setTimeout(tryFetch, 500);
      } else {
        setError('Configura el origen del dron para ver el clima.');
      }
    };
    tryFetch();

    // Actualizar cada 15 minutos
    _refreshTimer = setInterval(fetchWeather, 15 * 60 * 1000);

    // Actualizar cuando cambia el origen del drone
    document.addEventListener('ferrari:geo-changed', fetchWeather);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // API pública mínima
  window.FerrariWeather = { refresh: fetchWeather };

})();
