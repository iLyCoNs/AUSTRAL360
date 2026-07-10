// ================================================
// KpranoKiller — Menu de Herramientas
// Autonomo. Alt+A abre/cierra. FAB siempre visible.
// ================================================
(function () {

    var isOpen = false;
    var activeTool = null;

    var GUIDES = {
        'lote-libre':        'Haz clic en cada esquina del terreno. Acerca el ultimo punto al primero para cerrar, o presiona Enter.',
        'calle-curva-arq2':  'Haz clic a lo largo del eje central de la calle. Presiona Enter para finalizar.',
        'eraser':            'Haz clic sobre cualquier lote, calle o elemento para eliminarlo.',
        'relleno-auto':      'Dibuja el contorno del lote. Al cerrar se asigna numero automaticamente.',
        'fila-variable':     'Dibuja el contorno de toda la hilera. El modal divide proporcionalmente.',
        'kprano-capsule':    'Haz clic en cualquier punto de la foto para anclar una Capsula 3D.',
        'costura':           'Dibuja un lote que comparte borde con otro existente.'
    };

    var SVG_ICONS = {
        'lote-libre':        '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/>',
        'calle-curva-arq2':  '<path d="M3 17c3-3 5-5 8-5s5 2 9 2"/><path d="M3 7c3 3 5 5 8 5s5-2 9-2"/>',
        'eraser':            '<path d="M20 20H7L3 16l13-13 4 4-6.5 6.5"/><path d="M6 15l3 5"/>',
        'relleno-auto':      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
        'fila-variable':     '<rect x="2" y="7" width="20" height="10" rx="1"/><line x1="8" y1="7" x2="8" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/>',
        'kprano-capsule':    '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
        'costura':           '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>'
    };

    var LABELS = {
        'lote-libre': 'Lote', 'calle-curva-arq2': 'Calle', 'eraser': 'Borrar',
        'relleno-auto': 'Auto', 'fila-variable': 'Hilera',
        'kprano-capsule': 'Capsula', 'costura': 'Costura'
    };

    function svgIcon(id) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' + SVG_ICONS[id] + '</svg>';
    }

    function makeToolBtn(id, extra) {
        var btn = document.createElement('button');
        btn.className = 'kpk-btn' + (extra ? ' ' + extra : '');
        btn.dataset.kpkTool = id;
        btn.innerHTML = svgIcon(id) + '<span>' + LABELS[id] + '</span>';
        return btn;
    }

    function makeGroupLabel(text) {
        var d = document.createElement('div');
        d.className = 'kpk-group';
        d.textContent = text;
        return d;
    }

    function makeGrid(ids, extras) {
        var grid = document.createElement('div');
        grid.className = 'kpk-grid';
        ids.forEach(function(id, i) {
            grid.appendChild(makeToolBtn(id, extras && extras[i]));
        });
        return grid;
    }

    function buildPanel() {
        var panel = document.createElement('div');
        panel.id = 'kpk-panel';

        // Header
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

        // Status
        var sb = document.createElement('div');
        sb.className = 'kpk-statusbar';
        sb.innerHTML = '<span class="kpk-dot-status" id="kpk-dot-status"></span><span id="kpk-status-msg">Selecciona una herramienta</span>';
        panel.appendChild(sb);

        // Separador
        var sep0 = document.createElement('div');
        sep0.className = 'kpk-sep';
        panel.appendChild(sep0);

        // Grupo Terreno
        panel.appendChild(makeGroupLabel('Diseno de Terreno'));
        panel.appendChild(makeGrid(['lote-libre', 'calle-curva-arq2', 'relleno-auto', 'fila-variable'], [null, null, null, null]));

        // Grupo Smart Points
        panel.appendChild(makeGroupLabel('Smart Points'));
        panel.appendChild(makeGrid(['kprano-capsule'], ['kpk-btn-blue']));

        // Grupo Edicion
        panel.appendChild(makeGroupLabel('Edicion'));
        panel.appendChild(makeGrid(['eraser', 'costura'], ['kpk-btn-red', null]));

        // Separador
        var sep1 = document.createElement('div');
        sep1.className = 'kpk-sep';
        panel.appendChild(sep1);

        // Guia
        var guide = document.createElement('div');
        guide.className = 'kpk-guide';
        guide.id = 'kpk-guide';
        guide.textContent = 'Elige una herramienta para comenzar a disenar sobre la foto 360.';
        panel.appendChild(guide);

        // Guardar
        var saveBtn = document.createElement('button');
        saveBtn.className = 'kpk-save';
        saveBtn.innerHTML = svgIcon('lote-libre').replace(SVG_ICONS['lote-libre'],
            '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>') +
            ' Guardar en Nube';
        saveBtn.addEventListener('click', function() {
            if (typeof GlobalCloudSave === 'function') GlobalCloudSave();
        });
        panel.appendChild(saveBtn);

        return panel;
    }

    function buildFAB() {
        var fab = document.createElement('button');
        fab.id = 'kpk-fab';
        fab.title = 'KpranoKiller (Alt+A)';
        fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r="0.5" fill="currentColor"/></svg>';
        return fab;
    }

    function toggle(force) {
        isOpen = typeof force === 'boolean' ? force : !isOpen;
        var panel = document.getElementById('kpk-panel');
        var fab   = document.getElementById('kpk-fab');
        if (!panel) return;
        panel.classList.toggle('kpk-open', isOpen);
        if (fab) fab.classList.toggle('kpk-fab-on', isOpen);
        document.body.classList.toggle('kpk-edit', isOpen);

        // Activar motor de dibujo
        // 1. Llamar arq2_toggleArquitecto2 primero (el puede tener su propia variable interna)
        if (typeof arq2_toggleArquitecto2 === 'function') {
            try { arq2_toggleArquitecto2(isOpen); } catch(e) {}
        }
        // 2. Forzar el estado global DESPUES, para que KPK tenga la ultima palabra
        window.isArquitecto2Active = isOpen;
        document.body.classList.toggle('arq2-active', isOpen);
        // 3. Si se cierra, limpiar herramienta
        if (!isOpen && typeof arq2_setTool === 'function') {
            try { arq2_setTool(null); } catch(e) {}
        }
        if (!isOpen) {
            activeTool = null;
            setStatus('idle', 'Panel cerrado');
            document.querySelectorAll('.kpk-btn').forEach(function(b) { b.classList.remove('kpk-btn-on'); });
        }
    }

    function setTool(tool) {
        activeTool = tool;
        document.querySelectorAll('.kpk-btn').forEach(function(b) { b.classList.remove('kpk-btn-on'); });
        var btn = document.querySelector('.kpk-btn[data-kpk-tool="' + tool + '"]');
        if (btn) btn.classList.add('kpk-btn-on');
        var guide = document.getElementById('kpk-guide');
        if (guide) guide.textContent = GUIDES[tool] || 'Herramienta activa.';
        setStatus('active', tool);
        // Llamar motor arq2
        if (typeof arq2_setTool === 'function') {
            try { arq2_setTool(tool); } catch(e) {}
        } else {
            window.arq2Tool = tool;
        }
    }

    function setStatus(state, msg) {
        var dot  = document.getElementById('kpk-dot-status');
        var text = document.getElementById('kpk-status-msg');
        if (dot) {
            dot.className = 'kpk-dot-status';
            if (state === 'active') dot.classList.add('kpk-dot-on');
            if (state === 'warning') dot.classList.add('kpk-dot-warn');
        }
        if (text) text.textContent = msg || '';
    }

    function init() {
        var panel = buildPanel();
        var fab   = buildFAB();
        document.body.appendChild(panel);
        document.body.appendChild(fab);

        var closeBtn = document.getElementById('kpk-btn-close');
        if (closeBtn) closeBtn.addEventListener('click', function() { toggle(false); });
        fab.addEventListener('click', function() { toggle(); });

        document.querySelectorAll('.kpk-btn[data-kpk-tool]').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                setTool(btn.dataset.kpkTool);
            });
        });

        // Alt+A — unico listener global. Funciona aunque el FAB este oculto.
        document.addEventListener('keydown', function(e) {
            if (!e.altKey) return;
            if (e.key !== 'a' && e.key !== 'A') return;
            if (e.ctrlKey || e.metaKey) return;
            var tag = document.activeElement && document.activeElement.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            e.preventDefault();
            // Mostrar FAB la primera vez antes de toggle
            document.body.classList.add('kpk-edit');
            toggle();
        });

        window.kpk_toggle  = toggle;
        window.kpk_setTool = setTool;
        window.kpk_status  = setStatus;
        console.log('[KpranoKiller] Listo — Alt+A o FAB para abrir panel.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
