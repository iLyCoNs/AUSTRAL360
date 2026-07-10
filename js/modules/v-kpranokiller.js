// ================================================
// KpranoKiller v4 — Motor de Herramientas
// FIX CRITICO: stubs para setupDevModes y togglePinsMode
// que fueron eliminadas en la migración a Three.js.
// Sin estas, arq2_setup() nunca se llama y el motor no inicia.
// ================================================
(function () {

    // ── STUBS CRITICOS — deben ir ANTES que cualquier otra cosa ──
    // setupDevModes fue eliminada al migrar de Pannellum a Three.js.
    // La llamada en v-franja-curva.js:55 la necesita para no lanzar
    // ReferenceError que aborta la cadena: setupDevModes → arq2_setup
    if (typeof window.setupDevModes === 'undefined') {
        window.setupDevModes = function () {
            console.log('[KPK-stub] setupDevModes() — stub OK');
        };
    }
    if (typeof window.togglePinsMode === 'undefined') {
        window.togglePinsMode = function (active) {
            console.log('[KPK-stub] togglePinsMode(' + active + ') — stub OK');
            window.isDevModePinsActive = !!active;
        };
    }
    if (typeof window.toggleDrawMode === 'undefined') {
        window.toggleDrawMode = function (active) {
            console.log('[KPK-stub] toggleDrawMode(' + active + ') — stub OK');
            window.isDevModeDrawActive = !!active;
        };
    }

    // ── Variables del panel ──────────────────────────────────────
    var isOpen = false;
    var activeTool = null;
    var motorListo = false;

    var GUIDES = {
        'lote-libre':        'Clic en cada esquina del terreno. Acerca el ultimo punto al primero para cerrar, o presiona Enter.',
        'calle-curva-arq2':  'Clic a lo largo del eje central de la calle. Presiona Enter para finalizar.',
        'eraser':            'Clic sobre cualquier lote, calle o elemento para eliminarlo.',
        'relleno-auto':      'Dibuja el contorno del lote. Al cerrar se asigna numero automaticamente.',
        'fila-variable':     'Dibuja el contorno de toda la hilera. El modal divide proporcionalmente.',
        'kprano-capsule':    'Clic en cualquier punto de la foto para anclar una Capsula 3D.',
        'costura':           'Dibuja un lote que comparte borde con otro existente.'
    };

    var SVG_ICONS = {
        'lote-libre':        '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
        'calle-curva-arq2':  '<path d="M3 17c3-3 5-5 8-5s5 2 9 2"/><path d="M3 7c3 3 5 5 8 5s5-2 9-2"/>',
        'eraser':            '<path d="M20 20H7L3 16l13-13 4 4-6.5 6.5"/><path d="M6 15l3 5"/>',
        'relleno-auto':      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
        'fila-variable':     '<rect x="2" y="7" width="20" height="10" rx="1"/><line x1="8" y1="7" x2="8" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/>',
        'kprano-capsule':    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        'costura':           '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
    };

    var LABELS = {
        'lote-libre': 'Lapiz', 'calle-curva-arq2': 'Calle', 'eraser': 'Borrar',
        'relleno-auto': 'Auto', 'fila-variable': 'Hilera',
        'kprano-capsule': 'Capsula', 'costura': 'Costura'
    };

    function svgIcon(id) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' + (SVG_ICONS[id] || '') + '</svg>';
    }

    function buildPanel() {
        var panel = document.createElement('div');
        panel.id = 'kpk-panel';

        var hdr = document.createElement('div');
        hdr.className = 'kpk-header';
        hdr.innerHTML =
            '<div class="kpk-traffic">' +
            '<span class="kpk-dot kpk-red" id="kpk-btn-close"></span>' +
            '<span class="kpk-dot kpk-yellow"></span>' +
            '<span class="kpk-dot kpk-green"></span>' +
            '</div>' +
            '<span class="kpk-title">KpranoKiller</span>' +
            '<span class="kpk-badge">PRO</span>';
        panel.appendChild(hdr);

        var sb = document.createElement('div');
        sb.className = 'kpk-statusbar';
        sb.innerHTML = '<span class="kpk-dot-status" id="kpk-dot-status"></span><span id="kpk-status-msg">Cargando motor...</span>';
        panel.appendChild(sb);

        panel.appendChild(makeSep());
        panel.appendChild(makeGroupLabel('Diseno de Terreno'));
        panel.appendChild(makeGrid([
            { id: 'lote-libre' }, { id: 'calle-curva-arq2' },
            { id: 'relleno-auto' }, { id: 'fila-variable' }
        ]));
        panel.appendChild(makeGroupLabel('Smart Points'));
        panel.appendChild(makeGrid([{ id: 'kprano-capsule', extra: 'kpk-btn-blue' }]));
        panel.appendChild(makeGroupLabel('Edicion'));
        panel.appendChild(makeGrid([
            { id: 'eraser', extra: 'kpk-btn-red' }, { id: 'costura' }
        ]));
        panel.appendChild(makeSep());

        var guide = document.createElement('div');
        guide.className = 'kpk-guide';
        guide.id = 'kpk-guide';
        guide.textContent = 'Elige una herramienta para comenzar.';
        panel.appendChild(guide);

        var saveBtn = document.createElement('button');
        saveBtn.className = 'kpk-save';
        saveBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Guardar en Nube';
        saveBtn.addEventListener('click', function () {
            if (typeof GlobalCloudSave === 'function') GlobalCloudSave();
        });
        panel.appendChild(saveBtn);
        return panel;
    }

    function makeSep() { var d = document.createElement('div'); d.className = 'kpk-sep'; return d; }
    function makeGroupLabel(t) { var d = document.createElement('div'); d.className = 'kpk-group'; d.textContent = t; return d; }
    function makeGrid(items) {
        var g = document.createElement('div'); g.className = 'kpk-grid';
        items.forEach(function (item) {
            var b = document.createElement('button');
            b.className = 'kpk-btn' + (item.extra ? ' ' + item.extra : '');
            b.dataset.kpkTool = item.id;
            b.innerHTML = svgIcon(item.id) + '<span>' + (LABELS[item.id] || item.id) + '</span>';
            g.appendChild(b);
        });
        return g;
    }

    function buildFAB() {
        var fab = document.createElement('button');
        fab.id = 'kpk-fab';
        fab.title = 'KpranoKiller (Alt+A)';
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.5" fill="currentColor"/></svg>';
        return fab;
    }

    // ── ARRANCAR MOTOR ARQ2 ──────────────────────────────────────
    function arrancarMotor() {
        if (motorListo) return;
        // Llamar arq2_setup si existe y no se llamó aún
        if (typeof arq2_setup === 'function') {
            try {
                arq2_setup();
                console.log('[KPK] arq2_setup() ejecutado correctamente');
            } catch (e) {
                console.warn('[KPK] arq2_setup() error:', e);
            }
        }
        motorListo = true;
        setStatus('idle', 'Motor listo. Selecciona herramienta.');
    }

    // ── ACTIVAR MODO EDICION ─────────────────────────────────────
    function activarMotor() {
        arrancarMotor();
        if (typeof arq2_toggleArquitecto2 === 'function') {
            try { arq2_toggleArquitecto2(true); } catch (e) {}
        }
        // Forzar globales directamente — última palabra
        window.isArquitecto2Active = true;
        document.body.classList.add('arq2-active', 'kpk-edit');
    }

    function desactivarMotor() {
        if (typeof arq2_toggleArquitecto2 === 'function') {
            try { arq2_toggleArquitecto2(false); } catch (e) {}
        }
        window.isArquitecto2Active = false;
        document.body.classList.remove('arq2-active', 'kpk-edit');
    }

    // ── TOGGLE PANEL ─────────────────────────────────────────────
    function toggle(force) {
        isOpen = typeof force === 'boolean' ? force : !isOpen;
        var panel = document.getElementById('kpk-panel');
        var fab   = document.getElementById('kpk-fab');
        if (!panel) return;
        panel.classList.toggle('kpk-open', isOpen);
        if (fab) fab.classList.toggle('kpk-fab-on', isOpen);
        document.body.classList.toggle('kpk-edit', isOpen);
        if (isOpen) {
            activarMotor();
        } else {
            activeTool = null;
            desactivarMotor();
            setStatus('idle', 'Panel cerrado');
            document.querySelectorAll('.kpk-btn').forEach(function (b) { b.classList.remove('kpk-btn-on'); });
        }
    }

    // ── SELECCIONAR HERRAMIENTA ──────────────────────────────────
    function setTool(tool) {
        activeTool = tool;
        document.querySelectorAll('.kpk-btn').forEach(function (b) { b.classList.remove('kpk-btn-on'); });
        var btn = document.querySelector('.kpk-btn[data-kpk-tool="' + tool + '"]');
        if (btn) btn.classList.add('kpk-btn-on');
        var guide = document.getElementById('kpk-guide');
        if (guide) guide.textContent = GUIDES[tool] || 'Herramienta activa.';
        setStatus('active', LABELS[tool] || tool);

        if (typeof arq2_setTool === 'function') {
            try { arq2_setTool(tool); } catch (e) {}
        }
        // Re-forzar SIEMPRE después de arq2_setTool
        window.isArquitecto2Active = true;
        window.arq2Tool = tool;
        document.body.classList.toggle('eraser-mode-active', tool === 'eraser');
        document.body.classList.toggle('calle-mode-active', tool === 'calle-curva-arq2');

        console.log('[KPK] Herramienta:', tool, '| isArquitecto2Active:', window.isArquitecto2Active);
    }

    // ── STATUS ───────────────────────────────────────────────────
    function setStatus(state, msg) {
        var dot  = document.getElementById('kpk-dot-status');
        var text = document.getElementById('kpk-status-msg');
        if (dot) {
            dot.className = 'kpk-dot-status';
            if (state === 'active')  dot.classList.add('kpk-dot-on');
            if (state === 'warning') dot.classList.add('kpk-dot-warn');
        }
        if (text) text.textContent = msg || '';
    }

    // ── INIT ─────────────────────────────────────────────────────
    function init() {
        var panel = buildPanel();
        var fab   = buildFAB();
        document.body.appendChild(panel);
        document.body.appendChild(fab);

        var closeBtn = document.getElementById('kpk-btn-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { toggle(false); });
        fab.addEventListener('click', function () { toggle(); });

        document.querySelectorAll('.kpk-btn[data-kpk-tool]').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!isOpen) toggle(true);
                setTool(btn.dataset.kpkTool);
            });
        });

        // Alt+A — único listener global
        document.addEventListener('keydown', function (e) {
            if (!e.altKey) return;
            if (e.key !== 'a' && e.key !== 'A') return;
            if (e.ctrlKey || e.metaKey) return;
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            document.body.classList.add('kpk-edit');
            toggle();
        });

        // Enter: cerrar polígono / finalizar calle
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' || !isOpen || !activeTool) return;
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (typeof arq2_finalizarLoteLibre === 'function') { try { arq2_finalizarLoteLibre(); } catch (err) {} }
            if (typeof finishCalleDrawing === 'function') { try { finishCalleDrawing(); } catch (err) {} }
        });

        // Arrancar motor después de que todos los scripts terminen de cargar
        setTimeout(arrancarMotor, 800);

        window.kpk_toggle  = toggle;
        window.kpk_setTool = setTool;
        window.kpk_status  = setStatus;
        console.log('[KpranoKiller v4] Listo. Stubs instalados. Alt+A o FAB para abrir.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
