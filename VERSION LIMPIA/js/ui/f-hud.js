/**
 * f-hud.js — HUD de información en pantalla
 *
 * Muestra:
 *   - Pitch, Yaw, HFOV de la cámara (actualizado cada 10 frames desde rAF)
 *   - Nombre de herramienta activa + conteo de vértices
 *   - Hint de controles durante el dibujo
 */

'use strict';

(function() {

  // ─── REFERENCIAS DOM (cacheadas en init) ─────────────────────────
  let _elPitch   = null;
  let _elYaw     = null;
  let _elHfov    = null;
  let _elHudDraw = null;
  let _elTool    = null;
  let _elCount   = null;
  let _elHint    = null;

  function init() {
    _elPitch   = document.getElementById('hud-pitch');
    _elYaw     = document.getElementById('hud-yaw');
    _elHfov    = document.getElementById('hud-hfov');
    _elHudDraw = document.getElementById('kpk-hud-draw');
    _elTool    = document.getElementById('hud-tool-name');
    _elCount   = document.getElementById('hud-vertex-count');
    _elHint    = document.getElementById('hud-hint');
    console.log('[Ferrari/HUD] ✓ Inicializado');
  }

  // ─── COORDS — Llamado cada 10 frames desde rAF ───────────────────

  function updateCoords() {
    if (!window.FerrariCamera || !window.FerrariCamera.getClampedView) return;

    // Mostrar el pitch que realmente usa WebGL/SVG (clampeado), no el crudo del drag
    const view = window.FerrariCamera.getClampedView();
    const p = view.pitch;
    const y = view.yaw;
    const h = view.hfov;

    if (_elPitch) _elPitch.textContent = `P: ${p.toFixed(1)}°`;
    if (_elYaw)   _elYaw.textContent   = `Y: ${y.toFixed(1)}°`;
    if (_elHfov)  _elHfov.textContent  = `HFOV: ${h.toFixed(0)}°`;
  }

  // ─── DRAW INFO ────────────────────────────────────────────────────

  const TOOL_LABELS = {
    'lote-libre':        'Lote Libre',
    'lote-organico':     'Lote Orgánico',
    'calle':             'Calle Recta',
    'calle-curva-arq2':  'Calle Curva',
    'geo-north':         'Fijar Norte',
    'geo-horizonte':     'Pin Horizonte',
    'geo-ruta':          'Pin Ruta',
    'kmz-manip':         'Mover calco KMZ'
  };

  const TOOL_HINTS = {
    'lote-libre':        'Click: vértice · Enter/2×click: cerrar · Esc: cancelar · Ctrl+Z: deshacer',
    'lote-organico':     'Click: vértice · Enter/2×click: cerrar · Esc: cancelar · Ctrl+Z: deshacer',
    'calle':             'Click: punto · Enter/2×click: terminar · Esc: cancelar',
    'calle-curva-arq2':  'Click: punto · Enter/2×click: terminar · Esc: cancelar',
    'geo-north':         'Click en la dirección del Norte real para calibrar la brújula',
    'geo-horizonte':     'Click · busca ciudad/volcán · coords automáticas · Maps/Waze',
    'geo-ruta':          'Click · busca acceso/carretera · GPS automático · Maps/Waze',
    'kmz-manip':         'Arrastra: mover · Shift+arrastre o rueda: escalar · Esc: salir'
  };

  function showDraw(tipo) {
    if (!_elHudDraw) return;
    if (_elTool)  _elTool.textContent  = TOOL_LABELS[tipo] || tipo;
    if (_elCount) _elCount.textContent = '0 vértices';
    if (_elHint)  _elHint.textContent  = TOOL_HINTS[tipo]  || 'Click para agregar puntos';
    _elHudDraw.style.display = 'flex';
  }

  function hideDraw() {
    if (_elHudDraw) _elHudDraw.style.display = 'none';
  }

  function updateDraw(tipo, count) {
    if (!_elHudDraw || _elHudDraw.style.display === 'none') return;
    if (_elCount) {
      _elCount.textContent = `${count} vértic${count === 1 ? 'e' : 'es'}`;
    }
  }

  // ─── ARRANQUE ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ─── API PÚBLICA ────────────────────────────────────────────────────
  window.FerrariHUD = { updateCoords, showDraw, hideDraw, updateDraw };

  console.log('[Ferrari/HUD] ✓ Módulo cargado');

})();
