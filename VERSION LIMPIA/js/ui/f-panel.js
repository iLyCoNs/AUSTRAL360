/**
 * f-panel.js — Panel de herramientas KPK + FAB + Coordinador global de tools
 *
 * REGLAS:
 * - Listeners registrados UNA SOLA VEZ en DOMContentLoaded (flag _bound)
 * - ALT+A → toggle panel (tecla global)
 * - deactivateAllTools() centralizado aquí como window.FerrariTools
 * - Lección 2: capture:false en todos los listeners de tools
 */

'use strict';

(function() {

  let _panelOpen = false;
  let _bound     = false;

  // ─── REGISTRO DE HERRAMIENTAS ─────────────────────────────────────
  // Cada tool se registra aquí para poder desactivarlas todas de golpe

  const _toolRegistry = [];

  function registerTool(toolObj) {
    _toolRegistry.push(toolObj);
  }

  /**
   * Desactiva TODAS las herramientas registradas.
   * Llamado SIEMPRE antes de activar cualquier herramienta (Lección 2).
   */
  function deactivateAllTools() {
    window.currentTool = null;
    _toolRegistry.forEach(t => {
      if (typeof t.deactivate === 'function') t.deactivate();
    });
    // Limpiar estado visual de botones
    document.querySelectorAll('.kpk-tool-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    });
  }

  // ─── EXPONER FerrariTools INMEDIATAMENTE ─────────────────────────
  // (otros módulos lo necesitan en su init)
  window.FerrariTools = {
    registerTool,
    deactivateAllTools
  };

  // ─── INICIALIZACIÓN ──────────────────────────────────────────────

  function init() {
    if (_bound) return;
    _bound = true;

    // Registrar herramientas
    registerTool(window.FerrariDrawLote);
    registerTool(window.FerrariDrawCalle);
    registerTool(window.FerrariDrawHilera);
    registerTool(window.FerrariEraser);
    registerTool(window.FerrariEdit);
    registerTool(window.FerrariAddPin);
    registerTool(window.FerrariGeoTools);
    if (window.FerrariKmzCalco) {
      registerTool(window.FerrariKmzCalco);
    }

    // Registrar eventos de cada tool (una sola vez)
    window.FerrariDrawLote.bindEvents();
    window.FerrariDrawCalle.bindEvents();
    window.FerrariDrawHilera.bindEvents();
    window.FerrariEraser.bindEvents();
    window.FerrariEdit.bindEvents();
    window.FerrariAddPin.bindEvents();
    window.FerrariGeoTools.bindEvents();
    if (window.FerrariKmzCalco && window.FerrariKmzCalco.bindEvents) {
      window.FerrariKmzCalco.bindEvents();
    }

    // ── Panel toggle ─────────────────────────────────────────────
    const close = document.getElementById('kpk-panel-close');
    close && close.addEventListener('click', togglePanel, false);

    // ── ALT+A global ─────────────────────────────────────────────
    document.addEventListener('keydown', function(e) {
      if (e.altKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        togglePanel();
      }
    }, false);

    // ── Botones de herramientas ───────────────────────────────────
    _bindToolButton('tool-lote-libre',    () => _activateTool('lote-libre'));
    _bindToolButton('tool-lote-organico', () => _activateTool('lote-organico'));
    _bindToolButton('tool-calle',         () => _activateTool('calle'));
    _bindToolButton('tool-calle-arq2',    () => _activateTool('calle-curva-arq2'));
    _bindToolButton('tool-hilera',        () => _activateTool('hilera'));
    _bindToolButton('tool-edit',          () => _activateTool('edit'));
    _bindToolButton('tool-eraser',        () => _activateTool('eraser'));
    _bindToolButton('tool-smart-pin',     () => _activateTool('smart-pin'));
    _bindToolButton('tool-geo-north',     () => _activateTool('geo-north'));
    _bindToolButton('tool-geo-origin',    () => _activateTool('geo-origin'));
    _bindToolButton('tool-geo-horizonte', () => _activateTool('geo-horizonte'));
    _bindToolButton('tool-geo-ruta',      () => _activateTool('geo-ruta'));
    _bindToolButton('tool-geo-nearby',    () => _activateTool('geo-nearby'));

    // ── Botones de acción ─────────────────────────────────────────
    const btnUndo      = document.getElementById('action-undo');
    const btnFinish    = document.getElementById('action-finish');
    const btnCancel    = document.getElementById('action-cancel');
    const btnClearAll  = document.getElementById('action-clear-all');

    btnUndo && btnUndo.addEventListener('click', function() {
      if (window.FerrariOverlay.hasActiveDrawing()) {
        window.FerrariOverlay.removeLastPoint();
      }
    }, false);

    btnFinish && btnFinish.addEventListener('click', function() {
      const pts = window.FerrariOverlay.getActivePoints();
      if (pts.length < 2) {
        window.FerrariUI && window.FerrariUI.showToast('Se necesitan al menos 2 vértices.', 'error');
        return;
      }
      // Delegar al tool activo
      _dispatchFinish();
    }, false);

    btnCancel && btnCancel.addEventListener('click', function() {
      window.FerrariOverlay.clearOverlay();
      window.FerrariOverlay.startDrawing([]);
      window.FerrariHUD && window.FerrariHUD.hideDraw();
      window.FerrariUI  && window.FerrariUI.showToast('Dibujo cancelado.', 'info');
    }, false);

    btnClearAll && btnClearAll.addEventListener('click', function() {
      if (!confirm('¿Borrar TODOS los elementos dibujados? Esta acción no se puede deshacer.')) return;
      deactivateAllTools();
      window.FerrariOverlay.clearOverlay();
      window.FerrariState.clearAll();
      window.FerrariUI && window.FerrariUI.showToast('Todo borrado.', 'success');
    }, false);

    console.log('[Ferrari/Panel] ✓ Panel inicializado, ALT+A activo');
  }

  // ─── TOGGLE PANEL ────────────────────────────────────────────────

  function togglePanel() {
    _panelOpen = !_panelOpen;

    const panel = document.getElementById('kpk-panel');
    const fab   = document.getElementById('kpk-fab');

    if (panel) panel.classList.toggle('kpk-panel--open', _panelOpen);
    if (fab)   fab.classList.toggle('hidden', _panelOpen);
    document.body.classList.toggle('f-tool-mode', _panelOpen);

    try {
      document.dispatchEvent(new CustomEvent('ferrari:panel-toggle', { detail: { open: _panelOpen } }));
    } catch (e) {}

    if (window.FerrariBuyerDock && window.FerrariBuyerDock.refresh) {
      window.FerrariBuyerDock.refresh();
    }
    if (window.FerrariGeoPins && window.FerrariGeoPins.rebuild) {
      window.FerrariGeoPins.rebuild();
    }
  }

  function openPanel()  { if (!_panelOpen)  togglePanel(); }
  function closePanel() { if (_panelOpen)   togglePanel(); }
  function isOpen() { return _panelOpen; }
  function isToolMode() {
    const panel = document.getElementById('kpk-panel');
    return !!(panel && panel.classList.contains('kpk-panel--open'));
  }

  // ─── ACTIVACIÓN DE HERRAMIENTAS ──────────────────────────────────

  function _activateTool(tipo) {
    switch(tipo) {
      case 'lote-libre':
      case 'lote-organico':
        window.FerrariDrawLote.activate(tipo);
        break;
      case 'calle':
      case 'calle-curva-arq2':
        window.FerrariDrawCalle.activate(tipo);
        break;
      case 'hilera':
        window.FerrariDrawHilera.activate();
        break;
      case 'edit':
        window.FerrariEdit.activate();
        break;
      case 'eraser':
        window.FerrariEraser.activate();
        break;
      case 'smart-pin':
        window.FerrariAddPin.activate();
        break;
      case 'geo-north':
        window.FerrariGeoTools.activate('north');
        break;
      case 'geo-origin':
        window.FerrariGeoTools.openOriginDialog();
        // No deja tool activo (es un diálogo)
        document.querySelectorAll('.kpk-tool-btn').forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        });
        return;
      case 'geo-horizonte':
        window.FerrariGeoTools.activate('horizonte');
        break;
      case 'geo-ruta':
        window.FerrariGeoTools.activate('ruta');
        break;
      case 'geo-nearby':
        if (window.FerrariGeoTools.openNearbyDialog) {
          window.FerrariGeoTools.openNearbyDialog();
        } else {
          window.FerrariGeoTools.fetchNearby(8000);
        }
        document.querySelectorAll('.kpk-tool-btn').forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        });
        return;
    }

    // Marcar botón activo DESPUÉS de activar, ya que las herramientas pueden llamar a deactivateAllTools internamente
    document.querySelectorAll('.kpk-tool-btn').forEach(btn => {
      const isCurrent = btn.dataset.tool === tipo;
      btn.classList.toggle('active', isCurrent);
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });
  }

  function _bindToolButton(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function() {
      // Si ya está activo este tool, desactivar (toggle)
      const isCurrent = btn.classList.contains('active');
      if (isCurrent) {
        deactivateAllTools();
        window.FerrariHUD && window.FerrariHUD.hideDraw();
      } else {
        handler();
      }
    }, false);
  }

  /**
   * Delega el "finalizar" al tool activo actualmente.
   */
  function _dispatchFinish() {
    if (window.FerrariDrawLote.isActive()) {
      // Simular Enter
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else if (window.FerrariDrawCalle.isActive()) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
  }

  // ─── ARRANQUE ────────────────────────────────────────────────────
  // Usamos 'load' en lugar de 'DOMContentLoaded' para garantizar que
  // los módulos de tools (que vienen DESPUÉS en el HTML) ya estén cargados.
  // En modo viewer: no se registran herramientas ni eventos de panel.
  if (window.FERRARI_MODE === 'viewer') {
    console.log('[Ferrari/Panel] Modo viewer: panel de herramientas desactivado');
  } else {
    window.addEventListener('load', init, { once: true });
  }

  // ─── API PÚBLICA ─────────────────────────────────────────────────
  window.FerrariPanel = { togglePanel, openPanel, closePanel, isOpen, isToolMode };

  console.log('[Ferrari/Panel] ✓ Módulo cargado');

})();
