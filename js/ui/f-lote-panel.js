/**
 * f-lote-panel.js — Panel Interactivo de Datos del Lote
 *
 * Expone: window.FerrariUI.openLotePanel(id)
 */

'use strict';

(function() {

  let _currentLoteId = null;
  let _ufValue = 38000; // Referencial, se actualiza vía API

  // Referencias DOM (Edición)
  let _panel, _closeBtn, _btnCancel, _btnSave, _btnRemovePin;
  let _inNumero, _inEstado, _inDimensiones, _inUF, _lblCLP;

  // Referencias DOM (Espectador)
  let _specCloseBtn, _specPillEstado, _specTitle, _specValArea, _specValUF, _specValCLP, _specBtnFoto, _specBtnWsp;
  let _specBtnContact, _specForm, _specFormNote, _specSubmitTxt;
  let _formOpen = false;

  function _getContact() {
    if (window.FerrariBrandDock && typeof window.FerrariBrandDock.getContact === 'function') {
      return window.FerrariBrandDock.getContact();
    }
    return { whatsapp: '', formEmail: '', formEnabled: true };
  }

  function _getProjectName() {
    const b = window.FerrariBrandDock && window.FerrariBrandDock.getBrand
      ? window.FerrariBrandDock.getBrand()
      : null;
    return (b && b.projectName) || 'Proyecto';
  }

  // ─── API UF ────────────────────────────────────────────────────────

  async function _fetchUF() {
    try {
      // API gratuita mindicador.cl
      const response = await fetch('https://mindicador.cl/api/uf');
      if (response.ok) {
        const data = await response.json();
        if (data && data.serie && data.serie.length > 0) {
          _ufValue = data.serie[0].valor;
          console.log('[Ferrari/LotePanel] UF actualizada:', _ufValue);
        }
      }
    } catch (err) {
      console.warn('[Ferrari/LotePanel] Error obteniendo UF, usando valor por defecto.', err);
    }
  }

  // ─── UTILIDADES ────────────────────────────────────────────────────

  function _formatCLP(value) {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value);
  }

  function _updateCLPPreview() {
    const ufInput = parseFloat(_inUF.value);
    if (isNaN(ufInput) || ufInput <= 0) {
      _lblCLP.textContent = 'Ingrese UF para calcular CLP';
      return;
    }
    const clp = Math.round(ufInput * _ufValue);
    _lblCLP.textContent = `~ ${_formatCLP(clp)} CLP`;
  }

  // ─── ACCIONES DEL PANEL ────────────────────────────────────────────

  function openLotePanel(id) {
    const line = window.FerrariState.getLine(id);
    if (!line) return;

    _currentLoteId = id;

    // Cargar datos actuales
    _inNumero.value = line.titulo || '';
    _inEstado.value = line.estado || 'disponible';
    _inDimensiones.value = line.dimensiones || '';
    _inUF.value = line.valorUF || '';

    _updateCLPPreview();

    // Determinar modo espectador (si la barra de herramientas principal está cerrada)
    const mainPanel = document.getElementById('kpk-panel');
    const isSpectator = mainPanel && !mainPanel.classList.contains('kpk-panel--open');
    _panel.classList.toggle('spectator-mode', isSpectator);

    // Si es modo espectador, poblar datos estéticos
    if (isSpectator) {
      _specTitle.textContent = line.titulo || `Lote ${id}`;
      
      const st = line.estado || 'disponible';
      _specPillEstado.dataset.status = st;
      _specPillEstado.textContent = st.charAt(0).toUpperCase() + st.slice(1);
      
      _specValArea.textContent = line.dimensiones ? `${line.dimensiones} m²` : '---';
      _specValUF.textContent = line.valorUF ? `${line.valorUF} UF` : '---';
      
      const ufNum = parseFloat(line.valorUF);
      if (!isNaN(ufNum) && ufNum > 0) {
        const clp = Math.round(ufNum * _ufValue);
        _specValCLP.textContent = _formatCLP(clp);
      } else {
        _specValCLP.textContent = '---';
      }

      const nFotos = Array.isArray(line.fotos) ? line.fotos.filter(f => f && f.src).length : 0;
      if (_specBtnFoto) {
        const label = _specBtnFoto.querySelector('span');
        if (label) label.textContent = nFotos ? `Ver Fotos (${nFotos})` : 'Ver Fotos';
        _specBtnFoto.style.opacity = nFotos ? '1' : '0.55';
      }

      _syncContactUI(line);

      const tagsContainer = document.getElementById('spec-val-tags-container');
      if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (line.caracteristicas && line.caracteristicas.trim()) {
          const tags = line.caracteristicas.split(/[,.;]/).map(t => t.trim()).filter(Boolean);
          if (tags.length) {
            tags.forEach(tag => {
              const span = document.createElement('span');
              span.className = 'kpk-spec-tag';
              span.innerHTML = `<span>#</span>${tag}`;
              tagsContainer.appendChild(span);
            });
            tagsContainer.style.display = 'flex';
          } else {
            tagsContainer.style.display = 'none';
          }
        } else {
          tagsContainer.style.display = 'none';
        }
      }

      _setFormOpen(false);
    }

    // Mostrar panel
    _panel.classList.add('kpk-lote-panel--open');
    
    // Desactivar herramientas mientras se edita (opcional, pero buena práctica UX)
    if (window.FerrariTools) {
      window.FerrariTools.deactivateAllTools();
    }
  }

  function _syncContactUI(line) {
    const c = _getContact();
    const wrap = document.getElementById('spec-contact');
    const note = document.getElementById('spec-form-note');
    const enabled = c.formEnabled !== false && !!(c.formEmail && String(c.formEmail).includes('@'));
    if (wrap) wrap.style.display = enabled ? '' : 'none';
    if (_specBtnWsp) {
      const waPhone = c.whatsapp || c.platformWhatsapp || '';
      const hasWa = !!(waPhone && String(waPhone).replace(/\D/g, '').length >= 8);
      _specBtnWsp.style.display = hasWa ? '' : 'none';
    }
    if (!line) return;
    const proyecto = _getProjectName();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('spec-f-lote', line.titulo || `Lote ${line.id}`);
    set('spec-f-proyecto', proyecto);
    set('spec-f-estado', line.estado || '');
    set('spec-f-superficie', line.dimensiones ? `${line.dimensiones} m²` : '');
    set('spec-f-uf', line.valorUF != null ? String(line.valorUF) : '');
    set('spec-f-subject', `[${proyecto}] Consulta — ${line.titulo || line.id}`);
    if (note) note.textContent = enabled ? 'Recibirás confirmación por correo.' : '';
  }

  function _setFormOpen(on) {
    _formOpen = !!on;
    if (_specForm) _specForm.classList.toggle('is-visible', _formOpen);
    if (_specBtnContact) {
      _specBtnContact.setAttribute('aria-expanded', _formOpen ? 'true' : 'false');
      _specBtnContact.classList.toggle('is-open', _formOpen);
    }
    if (_panel) _panel.classList.toggle('form-open', _formOpen);
  }

  function closeLotePanel() {
    _panel.classList.remove('kpk-lote-panel--open');
    _setFormOpen(false);
    _currentLoteId = null;
  }

  function saveLotePanel() {
    if (!_currentLoteId) return;

    const updates = {
      titulo: _inNumero.value.trim(),
      estado: _inEstado.value,
      dimensiones: _inDimensiones.value.trim(),
      valorUF: _inUF.value ? parseFloat(_inUF.value) : null
    };

    window.FerrariState.updateLine(_currentLoteId, updates);
    window.FerrariCamera.markDirty(); // Forzar update visual del pin y lote
    
    if (window.FerrariUI && window.FerrariUI.showToast) {
      window.FerrariUI.showToast('Lote actualizado', 'success');
    }

    closeLotePanel();

    // Si estamos en Modo Dios / herramienta, guardar automáticamente
    const isGod = new URLSearchParams(window.location.search).get('mode') === 'god';
    if (isGod && window.FerrariUI && typeof window.FerrariUI.save === 'function') {
      window.FerrariUI.save();
    }
  }

  function removePin() {
    if (!_currentLoteId) return;
    if (!confirm('¿Quitar el Smart Pin de este lote?')) return;

    // Eliminamos hasSmartPin y offsets legacy
    window.FerrariState.updateLine(_currentLoteId, {
      hasSmartPin: false,
      pinPosition: null,
      pinPos: null
    });
    
    // Forzar recreación del SVG eliminando el nodo viejo del caché
    if (window.DOMCache && window.DOMCache.paths) {
      const entry = window.DOMCache.paths.get(_currentLoteId);
      if (entry && entry.gNode) entry.gNode.remove();
      window.DOMCache.paths.delete(_currentLoteId);
    }
    if (window.FerrariSVGSync) window.FerrariSVGSync.syncSVGElements();

    window.FerrariCamera.markDirty();
    
    if (window.FerrariUI && window.FerrariUI.showToast) {
      window.FerrariUI.showToast('Smart Pin removido', 'info');
    }
    closeLotePanel();
  }

  // ─── INICIALIZACIÓN ────────────────────────────────────────────────

  function _init() {
    _panel = document.getElementById('kpk-lote-panel');
    if (!_panel) return;

    // Elementos Modo Edición
    _closeBtn = document.getElementById('lote-panel-close');
    _btnCancel = document.getElementById('lote-btn-cancel');
    _btnSave = document.getElementById('lote-btn-save');
    _btnRemovePin = document.getElementById('lote-btn-remove-pin');
    
    _inNumero = document.getElementById('lote-input-numero');
    _inEstado = document.getElementById('lote-input-estado');
    _inDimensiones = document.getElementById('lote-input-dimensiones');
    _inUF = document.getElementById('lote-input-uf');
    _lblCLP = document.getElementById('lote-clp-preview');

    // Elementos Modo Espectador
    _specCloseBtn = document.getElementById('lote-spectator-close');
    _specPillEstado = document.getElementById('spec-pill-estado');
    _specTitle = document.getElementById('spec-title');
    _specValArea = document.getElementById('spec-val-area');
    _specValUF = document.getElementById('spec-val-uf');
    _specValCLP = document.getElementById('spec-val-clp');
    _specBtnFoto = document.getElementById('spec-btn-foto');
    _specBtnWsp = document.getElementById('spec-btn-wsp');
    _specBtnContact = document.getElementById('spec-btn-contact');
    _specForm = document.getElementById('spec-contact-form');
    _specFormNote = document.getElementById('spec-form-note');
    _specSubmitTxt = document.getElementById('spec-submit-txt');

    // Eventos Edición
    _closeBtn.addEventListener('click', closeLotePanel);
    _btnCancel.addEventListener('click', closeLotePanel);
    _btnSave.addEventListener('click', saveLotePanel);
    if (_btnRemovePin) _btnRemovePin.addEventListener('click', removePin);
    _inUF.addEventListener('input', _updateCLPPreview);

    // Eventos Espectador
    if (_specCloseBtn) _specCloseBtn.addEventListener('click', closeLotePanel);
    if (_specBtnFoto) {
      _specBtnFoto.addEventListener('click', () => {
        const line = window.FerrariState.getLine(_currentLoteId);
        if (!line) return;
        const fotos = Array.isArray(line.fotos) ? line.fotos.filter(f => f && f.src) : [];
        if (!fotos.length) {
          if (window.FerrariUI && window.FerrariUI.showToast) {
            window.FerrariUI.showToast('Este lote aún no tiene fotos.', 'info');
          }
          return;
        }
        if (window.FerrariGallery) {
          window.FerrariGallery.open({
            title: line.titulo || 'Galería del lote',
            fotos
          });
        }
      });
    }
    if (_specBtnWsp) {
      _specBtnWsp.addEventListener('click', () => {
        const c = _getContact();
        const waPhone = c.whatsapp || c.platformWhatsapp || '';
        const titulo = _specTitle.textContent || 'un lote';
        const msg = `Hola, me interesa obtener más información sobre el ${titulo} (${_getProjectName()}).`;
        let url = null;
        if (window.FerrariBrandDock && window.FerrariBrandDock.whatsappUrl) {
          url = window.FerrariBrandDock.whatsappUrl(waPhone, msg);
        }
        if (!url) {
          window.FerrariUI && window.FerrariUI.showToast('WhatsApp del proyecto no configurado en Admin.', 'info');
          return;
        }
        window.open(url, '_blank', 'noopener');
      });
    }

    if (_specBtnContact) {
      _specBtnContact.addEventListener('click', () => _setFormOpen(!_formOpen));
    }

    if (_specForm) {
      _specForm.querySelectorAll('.kpk-spec-type input').forEach(inp => {
        inp.addEventListener('change', () => {
          _specForm.querySelectorAll('.kpk-spec-type').forEach(l => {
            l.classList.toggle('is-on', l.querySelector('input').checked);
          });
          const tipo = (_specForm.querySelector('input[name="tipo"]:checked') || {}).value || 'informacion';
          const lote = (document.getElementById('spec-f-lote') || {}).value || 'lote';
          const proyecto = _getProjectName();
          const sub = document.getElementById('spec-f-subject');
          if (sub) {
            sub.value = tipo === 'reserva'
              ? `[${proyecto}] Solicitud de RESERVA — ${lote}`
              : `[${proyecto}] Consulta de información — ${lote}`;
          }
        });
      });
      _specForm.addEventListener('submit', _submitContactForm);
    }

    // Enter para guardar
    _panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !_panel.classList.contains('spectator-mode') && e.target.tagName !== 'TEXTAREA') {
        saveLotePanel();
      }
      if (e.key === 'Escape') closeLotePanel();
    });

    // Exponer API global asegurando que FerrariUI existe
    window.FerrariUI = window.FerrariUI || {};
    window.FerrariUI.openLotePanel = openLotePanel;

    // Obtener UF de forma asíncrona al arrancar
    _fetchUF();

    console.log('[Ferrari/LotePanel] ✓ Módulo inicializado');
  }

  async function _submitContactForm(e) {
    e.preventDefault();
    const c = _getContact();
    const email = (c.formEmail || '').trim();
    if (!email || !email.includes('@')) {
      window.FerrariUI && window.FerrariUI.showToast('Configura el correo FormSubmit en Admin → Contacto.', 'error');
      return;
    }
    if (!_specForm.checkValidity()) {
      _specForm.reportValidity();
      return;
    }
    const honey = _specForm.querySelector('[name="_honey"]');
    if (honey && honey.value) return;

    const fd = new FormData(_specForm);
    const tipo = fd.get('tipo') || 'informacion';
    const payload = {
      name: fd.get('name'),
      email: fd.get('email'),
      phone: fd.get('phone') || '—',
      message: fd.get('message') || '—',
      tipo_solicitud: tipo === 'reserva' ? 'Solicitud de reserva' : 'Solicitud de información',
      lote: fd.get('lote'),
      proyecto: fd.get('proyecto'),
      estado_lote: fd.get('estado') || '—',
      superficie: fd.get('superficie') || '—',
      valor_uf: fd.get('valor_uf') || '—',
      _subject: fd.get('_subject'),
      _template: 'table',
      _captcha: 'false',
      _replyto: fd.get('email')
    };

    const btn = document.getElementById('spec-btn-submit');
    if (btn) btn.disabled = true;
    if (_specSubmitTxt) _specSubmitTxt.textContent = 'Enviando…';
    if (_specFormNote) _specFormNote.textContent = '';

    try {
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'No se pudo enviar');
      window.FerrariUI && window.FerrariUI.showToast('✓ Solicitud enviada. Revisa tu correo.', 'success');
      
      // Disparar alerta silenciosa de WhatsApp al propietario
      if (window.FerrariUI && typeof window.FerrariUI.sendWhatsAppAlert === 'function') {
        window.FerrariUI.sendWhatsAppAlert(
          payload.name,
          payload.phone,
          payload.email,
          payload.lote,
          payload.message
        );
      }

      if (_specFormNote) _specFormNote.textContent = 'Enviado correctamente. Te contactaremos pronto.';
      _specForm.reset();
      _specForm.querySelectorAll('.kpk-spec-type').forEach((l, i) => l.classList.toggle('is-on', i === 0));
      setTimeout(() => _setFormOpen(false), 900);
    } catch (err) {
      window.FerrariUI && window.FerrariUI.showToast(
        'Error al enviar. Confirma el correo en FormSubmit (primer envío) o revisa la config.',
        'error'
      );
      if (_specFormNote) {
        _specFormNote.textContent = 'Si es la primera vez, FormSubmit pide confirmar el correo destino.';
      }
    } finally {
      if (btn) btn.disabled = false;
      if (_specSubmitTxt) _specSubmitTxt.textContent = 'Enviar solicitud';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    _init();
  }

})();
