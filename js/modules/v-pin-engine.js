// ===============================
// PINES OPERATIVOS UNIFICADOS
// ===============================
window.PIN_TOOL_DEFS = {
  lote:       { label: 'Lote',       bucket: 'lotes',      tipo: 'lote',      titulo: 'Lote',       cssClass: 'hotspot-lote custom-hotspot', status: 'disponible' },
  acceso:     { label: 'Acceso',     bucket: 'lotes',      tipo: 'acceso',    titulo: 'Acceso',     cssClass: 'hotspot-lote custom-hotspot' },
  referencia: { label: 'Referencia', bucket: 'lotes',      tipo: 'referencia',titulo: 'Referencia', cssClass: 'hotspot-lote custom-hotspot' },
  horizonte:  { label: 'Horizonte',  bucket: 'horizontes', tipo: 'horizonte', titulo: 'Horizonte',  cssClass: 'hotspot-horizonte custom-hotspot' },
  ruta:       { label: 'Ruta',       bucket: 'horizontes', tipo: 'ruta',      titulo: 'Ruta',       cssClass: 'hotspot-horizonte custom-hotspot' },
  vista360:   { label: 'Vista 360',  bucket: 'lotes',      tipo: 'vista360',  titulo: 'Vista 360',  cssClass: 'hotspot-lote custom-hotspot' },
  casa360:    { label: 'Casa 360',   bucket: 'lotes',      tipo: 'casa360',   titulo: 'Casa 360',   cssClass: 'hotspot-lote custom-hotspot' },
  terreno:    { label: 'Terreno',    bucket: 'lotes',      tipo: 'terreno',   titulo: 'Terreno',    cssClass: 'hotspot-lote custom-hotspot' }
};

window.PinEngine = {
  activeTool: null,

  normalizeType(tipo) {
    const map = {
      'vista360°': 'vista360',
      'casa360°': 'casa360',
      'vista360': 'vista360',
      'casa360': 'casa360'
    };
    return map[tipo] || tipo || 'lote';
  },

  getStore(bucket) {
    return bucket === 'horizontes' ? window.PuntosHorizonte : window.BaseDatosLotes;
  },

  getMock(e) {
    if (typeof getMockEvent === 'function') return getMockEvent(e);
    const t = e.changedTouches && e.changedTouches[0];
    return { clientX: t ? t.clientX : e.clientX, clientY: t ? t.clientY : e.clientY };
  },

  getPYFromEvent(e) {
    const mock = this.getMock(e);

    // Prioridad: motor Ferrari / Three.js
    try {
      if (window.visor360?.getThreeRenderer && window.visor360?.getThreeCamera && window.visor360?.getThreeMesh) {
        const renderer = window.visor360.getThreeRenderer();
        const camera = window.visor360.getThreeCamera();
        const mesh = window.visor360.getThreeMesh();
        if (renderer && camera && mesh && window.THREE) {
          const rect = renderer.domElement.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((mock.clientX - rect.left) / rect.width) * 2 - 1,
            -((mock.clientY - rect.top) / rect.height) * 2 + 1
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);
          const hit = raycaster.intersectObject(mesh)[0];
          if (hit) {
            const pt = hit.point;
            const r = pt.length();
            const pitch = -Math.asin(pt.y / r) * 180 / Math.PI;
            const yaw = -Math.atan2(pt.x, -pt.z) * 180 / Math.PI;
            return {
              pitch: parseFloat(pitch.toFixed(3)),
              yaw: parseFloat(yaw.toFixed(3))
            };
          }
        }
      }
    } catch (err) {}

    // Fallback: Pannellum clásico
    try {
      if (window.visor360?.mouseEventToCoords) {
        const coords = window.visor360.mouseEventToCoords(mock);
        if (coords && !isNaN(coords[0]) && !isNaN(coords[1])) {
          return {
            pitch: parseFloat(coords[0].toFixed(3)),
            yaw: parseFloat(coords[1].toFixed(3))
          };
        }
      }
    } catch (err) {}

    return null;
  },

  buildPin(toolKey, py) {
    const def = window.PIN_TOOL_DEFS[toolKey];
    if (!def) return null;

    const id = `pin_${toolKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      id,
      toolKey,
      bucket: def.bucket,
      tipo: this.normalizeType(def.tipo),
      titulo: def.titulo,
      numero: '',
      status: def.status || '',
      cssClass: def.cssClass || 'hotspot-lote custom-hotspot',
      pitch: py.pitch,
      yaw: py.yaw,
      coordenadasDestino: '',
      url: '',
      videoUrl: ''
    };
  },

  commitPin(pin) {
    pin.tipo = this.normalizeType(pin.tipo);
    const bucket = pin.bucket || ((pin.tipo === 'horizonte' || pin.tipo === 'ruta') ? 'horizontes' : 'lotes');
    const store = this.getStore(bucket);

    const idx = store.findIndex(p => p.id === pin.id);
    if (idx >= 0) store[idx] = { ...store[idx], ...pin };
    else store.push(pin);

    if (typeof window.saveToLocal === 'function') window.saveToLocal();
    if (typeof window.refreshAllHotspots === 'function') window.refreshAllHotspots(true);
    if (typeof window.syncSVGElements === 'function') window.syncSVGElements();
    if (typeof window.updateSVGPaths === 'function') window.updateSVGPaths();
  },

  removePin(pinId) {
    window.BaseDatosLotes = (window.BaseDatosLotes || []).filter(p => p.id !== pinId);
    window.PuntosHorizonte = (window.PuntosHorizonte || []).filter(p => p.id !== pinId);

    if (typeof window.saveToLocal === 'function') window.saveToLocal();
    if (typeof window.refreshAllHotspots === 'function') window.refreshAllHotspots(true);
  },

  activate(toolKey) {
    if (!window.PIN_TOOL_DEFS[toolKey]) return;
    this.activeTool = toolKey;
    document.body.classList.add('pin-v2-active');
    document.body.classList.add('arq2-pin-active');
  },

  deactivate() {
    this.activeTool = null;
    document.body.classList.remove('pin-v2-active');
    document.body.classList.remove('arq2-pin-active');
    // Limpiar estado visual de los botones de pin
    document.querySelectorAll('.arq2-pin-btn').forEach(b => {
      b.classList.remove('active', 'active-pin-tool');
    });
  },

  placeFromEvent(e) {
    if (!this.activeTool) return;
    const py = this.getPYFromEvent(e);
    if (!py) return;

    const pin = this.buildPin(this.activeTool, py);
    if (!pin) return;

    // Crear primero, editar después: evita depender del cierre incierto del modal
    this.commitPin(pin);

    // Permitir editar (titulo para ruta/horizonte, etc)
    if (this.activeTool === 'ruta' || this.activeTool === 'horizonte') {
        const label = this.activeTool === 'ruta' ? '🛣️ PIN RUTA' : '⛰️ PIN HORIZONTE';
        const titulo = prompt(`${label}\nTítulo (ej: ${this.activeTool === 'ruta' ? 'Ruta V-30' : 'Volcán Osorno'}):`);
        if (titulo) { 
            pin.titulo = titulo;
            this.commitPin(pin);
        }
    }

    if (typeof window.openPinEditor === 'function') {
      try { window.openPinEditor(pin, true); } catch (err) {}
    }

    if (typeof window.flashScreenSuccess === 'function') {
        window.flashScreenSuccess();
    }
  }
};

// Captura universal: panorama + SVG overlay
window.bindUnifiedPinEvents = function() {
  const panorama = document.getElementById('panorama-container');
  const svg = document.getElementById('loteo-svg');

  const onTap = (e) => {
    // DOBLE GUARD: PinEngine debe estar activo Y la herramienta maestra debe ser smart-pin-v2
    if (!window.PinEngine?.activeTool) return;
    if (typeof arq2Tool !== 'undefined' && arq2Tool !== 'smart-pin-v2') {
      // La herramienta cambió pero PinEngine no fue desactivado → forzar apagado
      window.PinEngine.deactivate();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    window.PinEngine.placeFromEvent(e);
  };

  if (panorama) {
    panorama.addEventListener('pointerup', onTap, { capture: true });
    panorama.addEventListener('touchend', onTap, { passive: false, capture: true });
  }

  if (svg) {
    svg.addEventListener('pointerup', onTap, { capture: true });
    svg.addEventListener('touchend', onTap, { passive: false, capture: true });
    svg.addEventListener('mouseup', onTap, { capture: true });
  }
};

// Enlazar eventos de botones existentes a PinEngine
window.bindUnifiedPinButtons = function() {
    document.querySelectorAll('.arq2-pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Evitamos que los eventos legacy de arq2 tool interfieran, 
            // aunque después limpiaremos eso en v-calle y v-arquitecto2
            e.stopPropagation();
            
            document.querySelectorAll('.arq2-pin-btn').forEach(b => b.classList.remove('active'));
            const isClosing = btn.classList.contains('active-pin-tool');
            document.querySelectorAll('.arq2-pin-btn').forEach(b => b.classList.remove('active-pin-tool'));
            
            if (!isClosing) {
                btn.classList.add('active');
                btn.classList.add('active-pin-tool');
                const tipo = btn.getAttribute('data-arq2-pin');
                window.PinEngine.activate(tipo);
            } else {
                window.PinEngine.deactivate();
            }
        });
    });
};

document.addEventListener('DOMContentLoaded', () => {
  window.bindUnifiedPinEvents();
  window.bindUnifiedPinButtons();
});
