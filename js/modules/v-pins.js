function setupGlobalDelegation() {
    document.body.addEventListener('click', (e) => {
        const qaBtn = e.target.closest('.qa-btn'); if (!qaBtn) return; e.preventDefault(); e.stopPropagation(); const pinId = qaBtn.getAttribute('data-id'); if (!pinId) return; let targetArgs = BaseDatosLotes.find(l => l.id === pinId) || PuntosHorizonte.find(p => p.id === pinId); if (!targetArgs) return;
        if (qaBtn.classList.contains('qa-edit')) { openPinEditor(targetArgs, false); } 
        else if (qaBtn.classList.contains('qa-delete')) { if(confirm(`¿Deseas ELIMINAR permanentemente: "${targetArgs.titulo}"?`)) { BaseDatosLotes = BaseDatosLotes.filter(p => p.id !== pinId); PuntosHorizonte = PuntosHorizonte.filter(p => p.id !== pinId); refreshAllHotspots(); saveToLocal(); } }
    });
}

function setupInAppModal() { 
    const modal = document.getElementById('inapp-modal'); 
    const closeBtn = document.getElementById('js-close-inapp'); 
    const iframe = document.getElementById('inapp-iframe-player'); 
    if(closeBtn) { 
        closeBtn.addEventListener('click', () => { 
            modal.classList.remove('open'); 
            document.body.classList.remove('is-canvas-only');
            setTimeout(() => { 
                iframe.src = ""; 
                // --- FIX: ANTI-FLOTACIÓN DE SVG ---
                if (visor360) {
                    try {
                        // 1. Forzar redibujado del motor WebGL
                        visor360.resize();
                        const r = visor360.getRenderer();
                        if (r && typeof r.resize === 'function') r.resize();
                        
                        // 2. Recalibrar la caché matemática del SVG
                        const container = document.getElementById('panorama-container');
                        if (container) {
                            const rect = container.getBoundingClientRect();
                            DOMCache.viewport.w = rect.width;
                            DOMCache.viewport.h = rect.height;
                            DOMCache.viewport.left = rect.left;
                            DOMCache.viewport.top = rect.top;
                        }
                        
                        // 3. Engañar al navegador para refrescar la matriz de proyección
                        window.dispatchEvent(new Event('resize'));
                        updateSVGPaths();
                    } catch(e) {}
                }
            }, 300); 
        }); 
    } 
}
function extractYouTubeID(url) { if (!url) return null; const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/; const match = url.match(regExp); return (match && match[2].length === 11) ? match[2] : null; }
window.openInAppViewer = function(e, url) { if(e) { e.preventDefault(); e.stopPropagation(); } if(!url) return; const modal = document.getElementById('inapp-modal'); const content = document.getElementById('js-inapp-content'); const iframe = document.getElementById('inapp-iframe-player'); const videoID = extractYouTubeID(url); if(videoID) { content.className = 'inapp-content is-yt'; iframe.src = `https://www.youtube.com/embed/${videoID}?autoplay=1&rel=0&modestbranding=1`; } else { content.className = 'inapp-content is-360'; iframe.src = url; document.body.classList.add('is-canvas-only'); } modal.classList.add('open'); };

function setupModalEditor() {
    const btnCancelPin = document.getElementById('btn-cancel-pin'); const btnSavePin = document.getElementById('btn-save-pin'); const modalContent = document.getElementById('modal-content-box');
    const btnCalcRoute = document.getElementById('pin-calc-route');
    if(modalContent) { modalContent.addEventListener('mousedown', (e) => e.stopPropagation()); modalContent.addEventListener('mouseup', (e) => e.stopPropagation()); modalContent.addEventListener('touchstart', (e) => e.stopPropagation(), {passive: true}); modalContent.addEventListener('touchend', (e) => e.stopPropagation()); }
    if(btnCalcRoute) {
        btnCalcRoute.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!OrigenDrone?.lat) { alert('⚠️ Primero fija el Origen Drone en el panel de pines.'); return; }
            const coordsIn = document.getElementById('pin-coords');
            if (!parseCoordenadasDestino(coordsIn?.value)) { alert('⚠️ Ingresa coordenadas destino válidas (Lat, Lng).'); return; }
            btnCalcRoute.disabled = true;
            btnCalcRoute.innerText = 'Calculando ruta…';
            const scenario = document.getElementById('pin-traffic-scenario')?.value || 'auto';
            const tmp = { coordenadasDestino: coordsIn.value.trim(), rutaEscenarioTrafico: scenario };
            const est = await calcularRutaParaPin(tmp, { scenario });
            btnCalcRoute.disabled = false;
            btnCalcRoute.innerText = '🛣️ Calcular desde Origen Drone';
            if (!est) { alert('⚠️ No se pudo calcular la ruta.'); return; }
            document.getElementById('pin-area').value = est.km;
            document.getElementById('pin-price').value = est.min;
            const hint = document.getElementById('pin-traffic-hint');
            if (hint) hint.innerText = '✓ ' + (est.source === 'osrm' ? 'Ruta por carretera (OSRM)' : 'Estimación topográfica') + ' · ' + (est.etiqueta || 'Tráfico');
        });
    }
    if(btnCancelPin) { btnCancelPin.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); document.getElementById('pin-editor-modal').classList.remove('open'); activePinArgs = null; }); }
    if(btnSavePin) {
        btnSavePin.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation(); if(!activePinArgs) return;
            let rawTitle = document.getElementById('pin-title').value || '';
            if(activePinArgs.tipo === 'lote') {
                if(!rawTitle.toUpperCase().includes('LOTE') && rawTitle !== '') activePinArgs.titulo = 'Lote ' + rawTitle; else if (rawTitle === '') activePinArgs.titulo = 'Lote Sin Nombre'; else activePinArgs.titulo = rawTitle;
                
                let rawArea = document.getElementById('pin-area-lote').value.trim() || '0'; 
                if(rawArea && !rawArea.toLowerCase().includes('m') && !rawArea.toLowerCase().includes('h')) {
                    let numArea = parseFloat(rawArea.replace(',', '.'));
                    if (!isNaN(numArea)) { if (numArea < 100) { rawArea = numArea.toFixed(4).replace('.', ',') + ' HÁ'; } else { rawArea += ' m²'; } }
                }
                activePinArgs.superficie = rawArea;
                
                let rawPrice = document.getElementById('pin-price-lote').value.trim() || '0'; if(rawPrice && !rawPrice.toLowerCase().includes('uf')) rawPrice = 'UF ' + rawPrice; activePinArgs.precio = rawPrice;
                activePinArgs.status = document.getElementById('pin-status').value || 'disponible';
                let imgVal = document.getElementById('pin-img').value; let fallbackImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80"; activePinArgs.imagen = imgVal ? imgVal : fallbackImage;
                let vidVal = document.getElementById('pin-video').value; if (vidVal) activePinArgs.videoUrl = vidVal; else delete activePinArgs.videoUrl;
                activePinArgs.tituloPlano = document.getElementById('pin-titulo-plano')?.value.trim() || '';
                activePinArgs.tituloColor = document.getElementById('pin-titulo-color')?.value || '#1d1d1f';
                activePinArgs.tituloPlanoColor = document.getElementById('pin-titulo-plano-color')?.value || '#0066cc';
                activePinArgs.cardVis = readCardVisFromEditor();
            } else if(activePinArgs.tipo === 'horizonte' || activePinArgs.tipo === 'ruta') {
                activePinArgs.titulo = rawTitle || 'MARCADOR';
                activePinArgs.coordenadasDestino = document.getElementById('pin-coords').value.trim();
                let rawDist = document.getElementById('pin-area').value.trim() || '0';
                let rawTime = document.getElementById('pin-price').value.trim() || '0';
                activePinArgs.distancia = rawDist.toUpperCase().includes('KM') ? rawDist : rawDist + ' KM';
                activePinArgs.tiempo = rawTime.toUpperCase().includes('MIN') ? rawTime : rawTime + ' MIN';
                activePinArgs.rutaEscenarioTrafico = document.getElementById('pin-traffic-scenario')?.value || 'auto';
            } else if(activePinArgs.tipo === 'vista360' || activePinArgs.tipo === 'casa360') { 
                activePinArgs.titulo = rawTitle || (activePinArgs.tipo === 'vista360' ? 'VISTA 360' : 'CASA TOUR'); 
                activePinArgs.url = document.getElementById('pin-video-media').value || '#'; 
            }
            if (isCreatingNewPin) { activePinArgs.id = "nuevo_" + Date.now(); let match = activePinArgs.titulo.match(/\d+/); activePinArgs.numero = match ? match[0].padStart(2, '0') : "00"; if(activePinArgs.tipo === 'horizonte' || activePinArgs.tipo === 'ruta') PuntosHorizonte.push(activePinArgs); else BaseDatosLotes.push(activePinArgs); } else { let match = activePinArgs.titulo.match(/\d+/); activePinArgs.numero = match ? match[0].padStart(2, '0') : "00"; }
            document.getElementById('pin-editor-modal').classList.remove('open'); refreshAllHotspots(); saveToLocal(); 
        });
    }
}

function openPinEditor(args, isNew) {
    activePinArgs = args; isCreatingNewPin = isNew;
    const modalBox = document.getElementById('modal-content-box');
    const badge = document.getElementById('pm-type-badge');
    const labelTitle = document.getElementById('pm-label-title');
    const navSection = document.getElementById('pin-nav-section');
    const cardSection = document.getElementById('pin-card-section');
    const lotePanel = document.getElementById('pm-panel-lote');
    const mediaPanel = document.getElementById('pm-panel-media');
    const titleEl = document.getElementById('modal-title-text');
    const tipo = args.tipo;

    navSection.style.display = 'none';
    cardSection.style.display = 'none';
    lotePanel.style.display = 'none';
    mediaPanel.style.display = 'none';
    modalBox?.classList.remove('modal-lote-edit');
    badge.className = 'pm-badge';

    let displayTitle = args.titulo || '';
    let tituloPlanoVal = args.tituloPlano || '';

    if (tipo === 'lote') {
        titleEl.innerText = isNew ? 'Nuevo Lote' : 'Editar Smart Pin';
        badge.textContent = 'Smart Pin · Lote';
        labelTitle.textContent = 'Número de lote';
        if (!tituloPlanoVal && displayTitle.includes('(')) {
            const m = displayTitle.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
            if (m) { displayTitle = m[1].trim(); tituloPlanoVal = m[2].trim(); }
        }
        if (!isNew) displayTitle = displayTitle.replace(/lote\s*/i, '');
        cardSection.style.display = 'flex';
        lotePanel.style.display = 'flex';
        modalBox?.classList.add('modal-lote-edit');
        document.getElementById('pin-titulo-plano').value = tituloPlanoVal;
        document.getElementById('pin-titulo-color').value = args.tituloColor || '#1d1d1f';
        document.getElementById('pin-titulo-plano-color').value = args.tituloPlanoColor || '#0066cc';
        setCardVisInEditor(args.cardVis);
        document.getElementById('pin-area-lote').value = (args.superficie || '').replace(/m²|m2|km|há|ha/gi, '').trim();
        document.getElementById('pin-price-lote').value = (args.precio || '').replace(/uf|min/gi, '').trim();
        document.getElementById('pin-status').value = args.status || 'disponible';
        document.getElementById('pin-img').value = (args.imagen && !args.imagen.includes('1600596542815') && !args.imagen.includes('1500382017468')) ? args.imagen : '';
        document.getElementById('pin-video').value = args.videoUrl || '';
    } else if (tipo === 'horizonte' || tipo === 'ruta') {
        titleEl.innerText = isNew ? (tipo === 'ruta' ? 'Nuevo Pin Ruta' : 'Nuevo Pin Horizonte') : (tipo === 'ruta' ? 'Editar Pin Ruta' : 'Editar Pin Horizonte');
        badge.textContent = tipo === 'ruta' ? 'Pin Ruta' : 'Pin Horizonte';
        badge.className = 'pm-badge nav';
        labelTitle.textContent = tipo === 'ruta' ? 'Nombre de la ruta' : 'Punto de referencia';
        navSection.style.display = 'flex';
        document.getElementById('pin-coords').value = args.coordenadasDestino || '';
        const scenarioEl = document.getElementById('pin-traffic-scenario');
        if (scenarioEl) scenarioEl.value = args.rutaEscenarioTrafico || 'auto';
        document.getElementById('pin-area').value = (args.distancia || '').replace(/km/gi, '').trim();
        document.getElementById('pin-price').value = (args.tiempo || '').replace(/min/gi, '').trim();
        const calcBtn = document.getElementById('pin-calc-route');
        if (calcBtn) { calcBtn.disabled = false; calcBtn.innerText = '🛣️ Calcular desde Origen Drone'; }
        const trafficHint = document.getElementById('pin-traffic-hint');
        if (trafficHint) trafficHint.innerText = args.rutaEtiquetaTrafico ? ('Último cálculo: ' + args.rutaEtiquetaTrafico) : 'Distancia por carretera + factor tráfico Chile (elige escenario arriba).';
    } else if (tipo === 'vista360' || tipo === 'casa360') {
        titleEl.innerText = isNew ? 'Nuevo Pin 360°' : 'Editar Pin 360°';
        badge.textContent = tipo === 'casa360' ? 'Casa 360°' : 'Vista 360°';
        labelTitle.textContent = 'Título visible';
        mediaPanel.style.display = 'flex';
        document.getElementById('pin-video-media').value = args.url || args.videoUrl || '';
    }

    document.getElementById('pin-title').value = displayTitle;
    document.getElementById('pin-title').placeholder = tipo === 'lote' ? 'Ej: 06' : (tipo === 'horizonte' ? 'Ej: Volcán Osorno' : (tipo === 'ruta' ? 'Ej: Ruta V-362' : 'Título'));
    document.getElementById('pin-editor-modal').classList.add('open');
}

function anclarTrazoActivo() {
    if (currentLineType === 'franja_curva') return;
    if (currentLinePoints.length > 1) {
        if (currentLineType !== 'cortar') {
            const entry = { id: currentTempLineId, tipo: currentLineType, puntos: [...currentLinePoints] };
            if (currentLineType === 'calle') {
                entry.calleAncho = draftCalleAncho;
                entry.calleAlpha = draftCalleAlpha;
                entry.calleLabelScale = draftCalleLabelScale;
                entry.calleShowLabel = draftCalleShowLabel;
                allDrawnLines.push(entry);
            } else {
                allDrawnLines.push(entry);
            }
        }
        currentLinePoints = [];
        currentTempLineId = 'temp_' + Date.now();
        lastCalleTap = null;
        syncCallePanelUI();
        refreshAllHotspots();
        saveToLocal();
    }
}
function toggleDrawMode(forceActive) {
    if (typeof forceActive !== 'boolean') forceActive = !isDevModeDrawActive;
    isDevModeDrawActive = forceActive;
    if (!forceActive) { clearFranjaDraft(); closeCalleToolPanel(); }
    document.getElementById('dev-toolbar-draw')?.classList.toggle('show', isDevModeDrawActive);
    document.body.classList.toggle('dev-mode-active', isDevModeDrawActive);
    refreshAllHotspots();
}
function togglePinsMode(forceActive) {
    if (typeof forceActive !== 'boolean') forceActive = !isDevModePinsActive;
    isDevModePinsActive = forceActive;
    if (!forceActive) deactivateLineaPines();
    document.getElementById('dev-toolbar-pins')?.classList.toggle('show', isDevModePinsActive);
    document.body.classList.toggle('dev-mode-pins-active', isDevModePinsActive);
    refreshAllHotspots();
}

function setupDevModes() {
    if (window.devModesInitialized) return;
    window.devModesInitialized = true;
    
    // Intercept keyboard events to block Pannellum's global movement controls (WASD/arrows) unless typing in input fields
    ['keydown', 'keyup', 'keypress'].forEach(evtType => {
        window.addEventListener(evtType, (e) => {
            const isInput = e.target && (
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'TEXTAREA' || 
                e.target.tagName === 'SELECT' ||
                e.target.isContentEditable ||
                e.target.closest('.smart-pin-wrapper') ||
                e.target.closest('#pin-editor-modal') ||
                e.target.closest('.modal-content') ||
                e.target.closest('#arq2-panel')
            );
            if (isInput) {
                // If it is an input field, stop event propagation so it never bubbles to Pannellum
                e.stopPropagation();
            } else {
                // Si no es un input, bloquear teclas de movimiento (WASD, flechas)
                // EXCEPTO combos modificados como Ctrl+A (modo Arquitecto 2.0)
                const keysToBlock = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Equal', 'Minus'];
                const isArq2Combo = e.code === 'KeyA' && e.altKey && !e.ctrlKey;
                if (!isArq2Combo && (keysToBlock.includes(e.code) || keysToBlock.includes(e.key))) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, true); // Capture phase is critical here!
    });

    document.querySelectorAll('.dev-toolbar').forEach(tb => { tb.addEventListener('mousedown', e => e.stopPropagation()); tb.addEventListener('mouseup', e => e.stopPropagation()); tb.addEventListener('touchstart', e => e.stopPropagation(), {passive: true}); tb.addEventListener('touchend', e => e.stopPropagation()); });
    document.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
        if (e.altKey && !e.ctrlKey && e.code === 'KeyA') { e.preventDefault(); arq2_toggleArquitecto2(); return; }
        if (isArquitecto2Active && e.code === 'Escape') {
            e.preventDefault();
            arq2_clearDraft();
            if (arq2Tool === 'fila-variable') arq2_startDemoAnimation(false);
            refreshAllHotspots(true);
            syncSVGElements();
            updateSVGPaths();
            return;
        }
        if (isArquitecto2Active && (e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); arq2_onEnterKey(); return; }
        if (isLineaPinesActive && lineaPinesPoints.length >= 2 && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
            e.preventDefault();
            applyLineaPinesAlign();
            return;
        }
        if (e.code === 'Enter' && isDevModeDrawActive && currentLineType === 'calle' && currentLinePoints.length >= 2) {
            e.preventDefault();
            finishCalleDrawing();
            return;
        }
        if (e.code === 'Escape' && isLineaPinesActive) {
            e.preventDefault();
            clearLineaPinesDraft();
            refreshAllHotspots(true);
            return;
        }
        if (e.ctrlKey && e.code === 'KeyZ' && isLineaPinesActive && lineaPinesPoints.length > 0) {
            e.preventDefault();
            lineaPinesPoints.pop();
            syncLineaPinesPanelUI();
            refreshAllHotspots(true);
            return;
        }
        if (e.ctrlKey && e.code === 'Space') { e.preventDefault(); if(isDevModePinsActive) togglePinsMode(false); toggleDrawMode(!isDevModeDrawActive); } if (e.ctrlKey && (e.code === 'KeyP' || e.key.toLowerCase() === 'p')) { e.preventDefault(); if(isDevModeDrawActive) toggleDrawMode(false); togglePinsMode(!isDevModePinsActive); } if (e.ctrlKey && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) { e.preventDefault(); if (isDevModeDrawActive) { if (currentLinePoints.length > 0) document.getElementById('btn-undo-point')?.click(); else if (allDrawnLines.length > 0) document.getElementById('btn-delete-last-line')?.click(); } }
    });
    
    document.getElementById('btn-draw-solid')?.addEventListener('click', (e) => { setDrawMode('solida', e.target); }); 
    document.getElementById('btn-draw-dash')?.addEventListener('click', (e) => { setDrawMode('punteada', e.target); }); 
    document.getElementById('btn-draw-street')?.addEventListener('click', (e) => { setDrawMode('calle', e.target); openCalleToolPanel(); }); 
    document.getElementById('btn-draw-cut')?.addEventListener('click', (e) => { setDrawMode('cortar', e.target); });
    document.getElementById('btn-draw-divisoria')?.addEventListener('click', (e) => { clearFranjaDraft(); setDrawMode('divisoria', e.target); });
    document.getElementById('btn-draw-franja')?.addEventListener('click', (e) => { clearFranjaDraft(); closeFranjaLotesModal(); setDrawMode('franja', e.target); });
    document.getElementById('btn-draw-franja-curva')?.addEventListener('click', (e) => { clearFranjaDraft(); closeFranjaLotesModal(); setDrawMode('franja_curva', e.target); });
    document.getElementById('btn-straighten-franja')?.addEventListener('click', enderezarFranjas);
    document.getElementById('btn-eraser')?.addEventListener('click', (e) => { setDrawMode('eraser', e.target); });
    
    function setDrawMode(mode, targetBtn) { 
        if (mode !== 'franja' && mode !== 'franja_curva') clearFranjaDraft(); 
        if (mode !== 'calle') closeCalleToolPanel(); 
        currentLineType = mode; document.body.classList.toggle('eraser-mode-active', mode === 'eraser'); document.querySelectorAll('#dev-toolbar-draw .dev-btn:not(.action):not(.export):not(.export-ai):not(.nuke)').forEach(b => b.classList.remove('active')); if(targetBtn) targetBtn.classList.add('active'); 
    }
    const bindCallePanel = (id, fn) => { const el = document.getElementById(id); if (!el) return; el.addEventListener('input', fn); el.addEventListener('change', fn); };
    bindCallePanel('calle-ui-ancho', (e) => { draftCalleAncho = Math.max(2, Math.min(28, parseFloat(e.target.value) || 8)); syncCallePanelUI(); updateSVGPaths(); refreshAllHotspots(true); });
    bindCallePanel('calle-ui-alpha', (e) => { draftCalleAlpha = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)); syncCallePanelUI(); updateSVGPaths(); });
    bindCallePanel('calle-ui-label', (e) => { draftCalleLabelScale = Math.max(0.5, Math.min(2.5, parseFloat(e.target.value) || 1)); syncCallePanelUI(); refreshAllHotspots(true); });
    bindCallePanel('calle-ui-show-label', (e) => { draftCalleShowLabel = !!e.target.checked; refreshAllHotspots(true); });
    bindCallePanel('calle-ui-snap-franja', (e) => { draftCalleSnapFranja = !!e.target.checked; });
    document.getElementById('btn-calle-finish')?.addEventListener('click', (e) => { e.stopPropagation(); finishCalleDrawing(); });
    document.getElementById('calle-tool-panel')?.addEventListener('mousedown', e => e.stopPropagation());
    document.getElementById('calle-tool-panel')?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    document.getElementById('linea-pines-panel')?.addEventListener('mousedown', e => e.stopPropagation());
    document.getElementById('linea-pines-panel')?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    
    document.getElementById('franja-modal-apply-count')?.addEventListener('click', () => {
        const n = parseInt(document.getElementById('franja-modal-count')?.value, 10) || franjaDraftCount;
        renderFranjaModalRows(Math.max(1, Math.min(200, n)), getFranjaModalWeights());
    });
    document.getElementById('franja-modal-equal')?.addEventListener('click', () => {
        document.querySelectorAll('#franja-modal-rows .franja-weight-input').forEach(inp => { inp.value = franjaDraftBaseM2; });
        renderFranjaModalScalePreview();
    });
    document.getElementById('franja-modal-last-big')?.addEventListener('click', () => {
        const inputs = [...document.querySelectorAll('#franja-modal-rows .franja-weight-input')];
        inputs.forEach((inp, i) => { inp.value = i === inputs.length - 1 ? Math.round(franjaDraftBaseM2 * 1.4) : franjaDraftBaseM2; });
        renderFranjaModalScalePreview();
    });
    document.getElementById('franja-modal-cancel')?.addEventListener('click', () => { closeFranjaLotesModal(); refreshAllHotspots(); });
    document.getElementById('franja-modal-confirm')?.addEventListener('click', commitFranjaFromModal);
    document.getElementById('franja-lotes-modal')?.addEventListener('mousedown', e => e.stopPropagation());
    document.getElementById('franja-lotes-modal')?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    
    document.getElementById('btn-undo-point')?.addEventListener('click', () => { if (currentLinePoints.length > 0) { currentLinePoints.pop(); if (currentLineType === 'calle') syncCallePanelUI(); refreshAllHotspots(); } });

    const btnDeleteLastLine = document.createElement('button'); btnDeleteLastLine.id = 'btn-delete-last-line'; btnDeleteLastLine.style.display = 'none'; document.body.appendChild(btnDeleteLastLine);
    btnDeleteLastLine.addEventListener('click', () => { if (allDrawnLines.length > 0) { allDrawnLines.pop(); refreshAllHotspots(); saveToLocal(); } });
    document.querySelectorAll('.nuke').forEach(btn => { btn.addEventListener('click', limpiarProyecto); }); document.querySelectorAll('.export-ai').forEach(btn => { btn.addEventListener('click', exportarDatosParaIA); });
    document.getElementById('btn-set-drone')?.addEventListener('click', () => { let val = prompt("Fijar Coordenada del Drone (Lat, Lng)\nEj: -41.3245, -72.9832", OrigenDrone ? `${OrigenDrone.lat}, ${OrigenDrone.lng}` : ""); if (val && val.includes(',')) { let parts = val.split(','); OrigenDrone = { lat: parseFloat(parts[0].trim()), lng: parseFloat(parts[1].trim()) }; saveToLocal(); document.getElementById('js-gmap-iframe').src = `https://maps.google.com/maps?q=${OrigenDrone.lat},${OrigenDrone.lng}&t=k&z=16&ie=UTF8&iwloc=&output=embed`; document.getElementById('js-directions-btn').href = `https://www.google.com/maps/dir/?api=1&destination=${OrigenDrone.lat},${OrigenDrone.lng}`; syncRutasDesdeOrigen({ refreshAll: true }).then(() => alert("📍 Origen Drone fijado.\nDistancias de pins ruta/horizonte recalculadas con tráfico.")); } });
    document.getElementById('btn-set-north')?.addEventListener('click', () => { if(!visor360) return; NorteOffset = visor360.getYaw(); saveToLocal(); alert("🧭 Brújula calibrada: El Norte Magnético apunta ahora a tu vista actual.\n(El parámetro 'norte' será incluido al Copiar Datos IA)."); const compassDial = document.getElementById('js-compass'); if(compassDial) compassDial.style.transform = `rotate(${-(visor360.getYaw() - NorteOffset)}deg)`; });
    document.getElementById('btn-edit-titles')?.addEventListener('click', () => { let t = prompt("Título del Proyecto (H1):", ConfigProyecto.titulo); let s = prompt("Subtítulo del Proyecto (p):", ConfigProyecto.subtitulo); if (t !== null && s !== null) { ConfigProyecto.titulo = t || 'PROYECTO INMOBILIARIO'; ConfigProyecto.subtitulo = s || ''; applyProjectConfig(); saveToLocal(); alert("Títulos actualizados temporalmente.\nAl hacer clic en 'COPIAR DATOS IA' se incluirán en el archivo JSON definitivo."); } });
    document.getElementById('btn-linea-pines')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isLineaPinesActive) deactivateLineaPines();
        else activateLineaPines();
        refreshAllHotspots(true);
    });
    document.querySelectorAll('#dev-toolbar-pins .dev-btn:not(.action):not(.export):not(.export-ai):not(.nuke)').forEach(btn => { if(btn.id !== 'btn-set-drone' && btn.id !== 'btn-set-north' && btn.id !== 'btn-edit-titles' && btn.id !== 'btn-linea-pines') { btn.addEventListener('click', (e) => { deactivateLineaPines(); currentPinTypeMap = e.target.dataset.pintype; document.querySelectorAll('#dev-toolbar-pins .dev-btn:not(.action):not(.export):not(.export-ai):not(.nuke)').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); }); } });
    document.getElementById('btn-heatmap')?.addEventListener('click', function() { isHeatmapActive = !isHeatmapActive; this.classList.toggle('active', isHeatmapActive); document.body.classList.toggle('heatmap-mode', isHeatmapActive); updateSVGPaths(); });
    document.getElementById('btn-auto-macro')?.addEventListener('click', () => {
        const plan = collectLotesForAutoMacro();
        if (plan.mode === 'none') return alert("No hay lotes reconocibles.\n\n✓ Franja de lotes ya creada\n✓ Polígonos sólidos / masterplan\n✓ Un recuadro grande para subdividir\n\nActiva Modo Arquitecto y vuelve a intentar.");
        if (plan.mode === 'subdivide') {
            const nStr = prompt('📐 SUBDIVIDIR RECUADRO\n\n¿En cuántos lotes? (divisiones internas punteadas)', '10');
            if (nStr === null) return;
            const N = Math.max(2, Math.min(40, parseInt(nStr, 10) || 10));
            if (!createFranjaFromPolygon(plan.lotes[0], N)) return alert("No se pudo subdividir el polígono.");
            finalizeAutoMacroSession();
        } else if (plan.mode === 'franja-rebuild') {
            if(!confirm("✨ AUTO-MACRO\n\n¿Regenerar franja(s) con bordes sólidos finos y divisiones punteadas?\n\nSe eliminarán los trazos de lote antiguos superpuestos.")) return;
            plan.grupos.forEach(g => rebuildFranjaGroup(g.id));
            finalizeAutoMacroSession();
        } else {
            if(!confirm("✨ AUTO-MACRO\n\n¿Convertir " + plan.lotes.length + " lote(s) a estilo premium?\n• Perímetro: sólido fino\n• Divisiones internas: punteadas\n• Se eliminan trazos antiguos duplicados")) return;
            if (!runAutoMacroTransform(plan.lotes)) return alert("No se pudo aplicar AUTO-MACRO.");
        }
        finalizeAutoMacroSession();
        refreshAllHotspots();
        saveToLocal();
        flashScreenSuccess();
    });
}

function limpiarProyecto() { 
    if(!confirm("⚠️ ¡ADVERTENCIA NUCLEAR! Vas a borrar TODOS los lotes, calles y pines.\n\n¿Estás seguro?")) return; 
    clearFranjaDraft(); 
    BaseDatosLotes = []; 
    PuntosHorizonte = []; 
    allDrawnLines = []; 
    currentLinePoints = []; 
    
    if (window.MotorFerrari && typeof window.MotorFerrari.clearAll === 'function') {
        window.MotorFerrari.clearAll();
    }
    
    document.body.classList.remove('auto-macro-active'); 
    document.body.classList.remove('masterplan-premium-active'); 
    refreshAllHotspots(); 
    localStorage.removeItem(FRESIA_CFG.autosaveKey); 
}

function safeGetStorage(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function safeSetStorage(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
function buildCloudPayload() {
    if (window.MotorFerrari && typeof window.MotorFerrari.syncToAllDrawnLines === 'function') {
        window.MotorFerrari.syncToAllDrawnLines();
    }
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
    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (response.status === 404) return '';
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `HTTP ${response.status}`); }
    const jsonRes = await response.json();
    return jsonRes.sha || '';
}
async function fetchGithubJsonContents(user, repo, token, filename) {
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' } });
    if (response.status === 404) return { sha: '', data: null };
    if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error(err.message || `HTTP ${response.status}`); }
    const jsonRes = await response.json();
    const raw = (jsonRes.content || '').replace(/\n/g, '');
    const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
    return { sha: jsonRes.sha || '', data: decoded };
}
async function putGithubContents(user, repo, token, filename, message, contentEncoded, shaRef, onShaUpdate) {
    const url = `https://api.github.com/repos/${user}/${repo}/contents/${filename}`;
    const attemptPut = async (shaValue, isRetry) => {
        const payload = { message, content: contentEncoded };
        if (shaValue) payload.sha = shaValue;
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
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
async function guardarEnNubeDirecto(btn, originalHtml) {
    const user = safeGetStorage('masterplan_user');
    const repo = safeGetStorage('masterplan_repo');
    const token = safeGetStorage('masterplan_token');
    if (!user || !repo || !token) {
        alert('⚠️ Para guardar en la nube, inicia sesión una vez en admin.html con tu repositorio GitHub.\n\nLas credenciales quedan guardadas en este navegador.');
        setExportBtnState(btn, originalHtml || '☁️ GUARDAR EN LA NUBE', '', false);
        return false;
    }
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
        setExportBtnState(btn, '✅ GUARDADO EN NUBE', '#10b981', true);
        flashScreenSuccess();
        setTimeout(() => setExportBtnState(btn, originalHtml || '☁️ GUARDAR EN LA NUBE', '', false), 2500);
        return true;
    }
    alert('⛔ Error al guardar en GitHub: ' + (upload.message || 'desconocido'));
    setExportBtnState(btn, originalHtml || '☁️ GUARDAR EN LA NUBE', '', false);
    return false;
}
async function exportarDatosParaIA(event) {
    if (guardarNubeEnCurso) return;
    saveToLocal();
    const btn = event && event.target ? event.target : null;
    const originalHtml = btn ? btn.innerHTML : '☁️ GUARDAR EN LA NUBE';
    guardarNubeEnCurso = true;
    setExportBtnState(btn, '☁️ GUARDANDO...', '', true);
    try {
        if (window.self !== window.top) {
            window.parent.postMessage({ type: FRESIA_CFG.savePostMessageType, payload: buildCloudPayload(), file: FRESIA_CFG.saveFile }, '*');
            setExportBtnState(btn, '✅ GUARDADO EN NUBE', '#10b981', true);
            setTimeout(() => setExportBtnState(btn, originalHtml, '', false), 2500);
            return;
        }
        await guardarEnNubeDirecto(btn, originalHtml);
    } catch (error) {
        alert('⚠️ Error de conexión al guardar en la nube. Revisa tu internet e intenta de nuevo.');
        setExportBtnState(btn, originalHtml, '', false);
    } finally {
        guardarNubeEnCurso = false;
    }
}

function renderFranjaLotLabel(hotSpotDiv, args) {
    hotSpotDiv.className = 'franja-lot-label';
    hotSpotDiv.textContent = args.numero || '00';
}
function renderCalleServidumbreLabel(hotSpotDiv, args) {
    hotSpotDiv.className = 'calle-servidumbre-label';
    hotSpotDiv.textContent = 'SERVIDUMBRE DE PASO';
    const scale = args?.labelScale ?? draftCalleLabelScale ?? 1;
    hotSpotDiv.style.transform = `translate(-50%, -50%) scale(${scale})`;
    if (args?.isDraft) hotSpotDiv.style.opacity = '0.72';
}
function renderCalleMoveHandle(hotSpotDiv, args) {
    hotSpotDiv.className = 'calle-move-handle';
    hotSpotDiv.textContent = '✥';
    hotSpotDiv.title = 'Arrastra para mover toda la calle';
    const startDrag = (e) => {
        if (currentLineType === 'eraser' || arq2Tool === 'eraser') return;
        e.stopPropagation(); e.preventDefault();
        const line = allDrawnLines.find(l => l.id === args.lineId && l.tipo === 'calle');
        if (!line) return;
        const mock = getMockEvent(e);
        const coords = visor360?.mouseEventToCoords(mock);
        if (!coords) return;
        hotSpotDiv.classList.add('is-dragging');
        draggingCalleMove = { lineId: args.lineId, origPts: line.puntos.map(pt => [...pt]), startPY: [coords[0], coords[1]], el: hotSpotDiv };
    };
    hotSpotDiv.addEventListener('mousedown', startDrag);
    hotSpotDiv.addEventListener('touchstart', startDrag, { passive: false });
}
function renderFranjaDivHandle(hotSpotDiv, args) {
    hotSpotDiv.className = 'franja-div-handle';
    hotSpotDiv.title = 'Arrastra para mover división (ajustar m²)';
    const startDrag = (e) => {
        e.stopPropagation(); e.preventDefault();
        hotSpotDiv.classList.add('is-dragging');
        draggingFranjaDiv = { gid: args.gid, splitIdx: args.splitIdx, el: hotSpotDiv };
    };
    hotSpotDiv.addEventListener('mousedown', startDrag);
    hotSpotDiv.addEventListener('touchstart', startDrag, { passive: false });
    hotSpotDiv.addEventListener('mousedown', (e) => {
        if (currentLineType !== 'eraser') return;
        e.stopPropagation(); e.preventDefault();
        applyEraserDelete(args.gid);
        refreshAllHotspots(true);
        saveToLocal();
    }, true);
}

function renderHiddenVertex(hotSpotDiv, args) { 
    hotSpotDiv.classList.add('vertex-marker'); hotSpotDiv.id = args.hsId;
    // if (args.isFranjaCorner || args.type === 'franja-grupo') hotSpotDiv.classList.add('franja-corner-marker');
    if (args.isFranjaElastic) hotSpotDiv.classList.add('franja-elastic-node');
    if (!DOMCache.markers[args.lineId]) DOMCache.markers[args.lineId] = { base: [] }; DOMCache.markers[args.lineId].base[args.idx] = hotSpotDiv; 
    if (args.lineId === currentTempLineId) { hotSpotDiv.classList.add('drawing-node'); }
    if (args.lineId === currentTempLineId && args.idx === 0 && currentLinePoints.length >= 3 && currentLineType !== 'cortar' && currentLineType !== 'eraser') { hotSpotDiv.classList.add('origin-vertex'); }
    if (args.lineId === arq2TempLineId && args.idx === 0 && arq2LinePoints.length >= 3 && isArquitecto2Active) { hotSpotDiv.classList.add('origin-vertex'); }
    if (closeOriginHighlighted && ((args.lineId === currentTempLineId && args.idx === 0) || (args.lineId === arq2TempLineId && args.idx === 0))) {
        hotSpotDiv.classList.add('origin-vertex-ready');
    }
    if (args.lineId === currentTempLineId && currentLineType === 'calle' && args.idx === currentLinePoints.length - 1 && currentLinePoints.length >= 2) {
        hotSpotDiv.classList.add('calle-finish-vertex');
    }
    const onEraseVertex = (e) => {
        if (currentLineType !== 'eraser' && arq2Tool !== 'eraser') return;
        e.stopPropagation(); e.preventDefault();
        applyEraserDelete(args.lineId);
        refreshAllHotspots(true);
        saveToLocal();
    };
    hotSpotDiv.addEventListener('mousedown', onEraseVertex);
    hotSpotDiv.addEventListener('touchstart', onEraseVertex, { passive: false });
    if (args.isGuide && currentLineType !== 'eraser' && arq2Tool !== 'eraser' && currentLineType !== 'cortar' && args.type !== 'divisoria' && args.type !== 'borde-macro' && (args.type !== 'calle' || currentLineType === 'calle')) { 
        const startDragGuide = (e) => {
            if (currentLineType === 'eraser' || arq2Tool === 'eraser') return;
            e.stopPropagation(); e.preventDefault();
            const m0 = getMockEvent(e);
            hotSpotDiv.classList.add('is-dragging');
            draggingVertex = { lineId: args.lineId, idx: args.idx, el: hotSpotDiv, hsId: args.hsId, startX: m0.clientX, startY: m0.clientY, target: args.target };
        }; 
        hotSpotDiv.addEventListener('mousedown', startDragGuide); hotSpotDiv.addEventListener('touchstart', startDragGuide, {passive: false}); 
    } 
}

function refreshAllHotspots(skipIntegrity) {
    if(!visor360) return; 
    if (!skipIntegrity) ensureFranjaIntegrity(); 
    
    // Importar trazos 3D Ferrari (calles/lotes)
    if (window.MotorFerrari && typeof window.MotorFerrari.importAllDrawnLines === 'function') {
        window.MotorFerrari.importAllDrawnLines();
    }

    DOMCache.markers = {}; const currentSpots = visor360.getConfig().hotSpots || [];
    for (let i = currentSpots.length - 1; i >= 0; i--) { if(currentSpots[i].id) { try { visor360.removeHotSpot(currentSpots[i].id); } catch(err) {} } }
    document.querySelectorAll('.pnlm-hotspot-base').forEach(el => { try { if(el.parentNode) el.parentNode.removeChild(el); } catch(err) {} });
    
    setTimeout(() => { 
        getHotspotsConfig().forEach(hs => { try { visor360.addHotSpot(hs); } catch(err) {} }); 

        syncSVGElements(); 
        if (typeof window.arq2_recalcAllPolygonStatuses === 'function') window.arq2_recalcAllPolygonStatuses();
        updateSVGPaths(); 
        renderSidebarList(BaseDatosLotes); 
    }, 10);
}


function bindPinEvents(element, args, hotSpotDiv) {
    const pickPin = (e) => {
        if (e.target.closest('.pin-quick-actions') || e.target.closest('.qa-btn')) return;
        if (isDevModePinsActive && !pickedPin) { e.stopPropagation(); pickedPin = args; hotSpotDiv.style.opacity = '0.0'; }
    };
    element.addEventListener('mousedown', pickPin); element.addEventListener('touchstart', pickPin, {passive: false});
    element.addEventListener('dblclick', (e) => {
        if (e.target.closest('.pin-quick-actions') || e.target.closest('.qa-btn')) return;
        if (isDevModePinsActive) { e.stopPropagation(); openPinEditor(args, false); }
    });
}

function addQuickActions(parent, args) {
    const qa = document.createElement('div'); qa.classList.add('pin-quick-actions');
    qa.innerHTML = `<button class="qa-btn qa-edit" data-id="${args.id}" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button class="qa-btn qa-delete" data-id="${args.id}" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
    parent.appendChild(qa);
}
function setupPinResizing() { document.addEventListener('wheel', (event) => { if (event.shiftKey && !isDevModeDrawActive && !isDevModePinsActive) { event.preventDefault(); event.stopPropagation(); if (event.deltaY < 0 && currentPinSizeIndex < 3) currentPinSizeIndex++; else if (event.deltaY > 0 && currentPinSizeIndex > 0) currentPinSizeIndex--; refreshAllHotspots(); } }, { passive: false }); }

function getCardVis(args) {
    const defaults = { titulo: true, tituloPlano: true, precio: true, precioCLP: true, imagen: true, statusPill: true, superficie: true, terreno: true, favorito: true, acciones: true };
    if (!args?.cardVis) return defaults;
    return Object.assign({}, defaults, args.cardVis);
}
function readCardVisFromEditor() {
    const vis = {};
    document.querySelectorAll('.card-vis-toggle').forEach(cb => { vis[cb.dataset.vis] = cb.checked; });
    return vis;
}
function setCardVisInEditor(cardVis) {
    const v = getCardVis({ cardVis });
    document.querySelectorAll('.card-vis-toggle').forEach(cb => { cb.checked = v[cb.dataset.vis] !== false; });
}
function buildCardTitleHTML(args, vis) {
    if (!vis.titulo && !vis.tituloPlano) return '';
    const c1 = args.tituloColor || '#1d1d1f';
    const c2 = args.tituloPlanoColor || '#0066cc';
    const main = args.titulo || 'Lote Sin Nombre';
    const plano = (args.tituloPlano || '').trim();
    let html = '<div class="card-title-row">';
    if (vis.titulo) html += `<span class="card-title-main" style="color:${c1}">${main}</span>`;
    if (vis.tituloPlano && plano) html += `<span class="card-title-plano" style="color:${c2}"> (${plano})</span>`;
    html += '</div>';
    return html;
}

const SVG_WAZE = '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="#111827" d="M12 4.5C9 4.5 6.8 6.6 6.8 9.4c0 1.5.6 2.9 1.6 3.8v4.3l3.6-2 3.6 2v-4.3c1-1 1.6-2.3 1.6-3.8 0-2.8-2.2-4.9-5.4-4.9z"/><circle cx="9.6" cy="9.6" r="1.15" fill="#fff"/><circle cx="14.4" cy="9.6" r="1.15" fill="#fff"/><path d="M10 12.2c.6.7 1.2 1.1 2 1.1s1.4-.4 2-1.1" stroke="#fff" stroke-width="1" fill="none" stroke-linecap="round"/><circle cx="8.8" cy="15.6" r="1.25" fill="#111827"/><circle cx="15.2" cy="15.6" r="1.25" fill="#111827"/></svg>';
const SVG_MAPS_PIN = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';

function getNavPinLinks(args) {
    const destLatLon = args.coordenadasDestino ? args.coordenadasDestino.replace(/\s/g, '') : '';
    const destinoQuery = destLatLon || encodeURIComponent(args.titulo || '');
    const linkWaze = destLatLon ? `https://www.waze.com/ul?ll=${destLatLon}&navigate=yes` : `https://www.waze.com/ul?q=${destinoQuery}&navigate=yes`;
    let linkGmapsFromProject = `https://www.google.com/maps/dir/?api=1&destination=${destinoQuery}&travelmode=driving`;
    if (OrigenDrone?.lat) linkGmapsFromProject = `https://www.google.com/maps/dir/?api=1&origin=${OrigenDrone.lat},${OrigenDrone.lng}&destination=${destinoQuery}&travelmode=driving`;
    return { linkWaze, linkGmapsFromProject, destinoQuery };
}
function buildNavGlassPillMarkup(args, opts) {
    opts = opts || {};
    const links = getNavPinLinks(args);
    const distArr = parseMetricaRuta(args.distancia, 'KM');
    const timeArr = parseMetricaRuta(args.tiempo, 'MIN');
    const title = (opts.title || args.titulo || 'RUTA').toUpperCase();
    const trafficTip = args.rutaEtiquetaTrafico ? ' title="' + args.rutaEtiquetaTrafico.replace(/"/g, '&quot;') + '"' : '';
    const trfBadge = opts.showTrafficBadge !== false ? '<span class="ruta-traffic-badge">TRF</span>' : '';
    const pillExtra = `<div class="ruta-divider"></div><div class="ruta-metrics"><span class="ruta-val">${distArr.v}<small>${distArr.u}</small></span><span class="ruta-val"${trafficTip}>~${timeArr.v}<small>${timeArr.u}</small>${trfBadge}</span></div><div class="ruta-links"><a href="${links.linkWaze}" target="_blank" class="r-link waze" title="Ir con Waze" draggable="false">${SVG_WAZE}</a><a href="${links.linkGmapsFromProject}" target="_blank" class="r-link gmaps" title="Ir con Google Maps" draggable="false">${SVG_MAPS_PIN}</a></div>`;
    if (opts.horizonMobileExpand) {
        const arrowBtn = '<button type="button" class="horizon-expand-arrow" aria-label="Desplegar distancia y navegación"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>';
        return `<span class="ruta-title">${title}</span>${arrowBtn}<div class="horizon-pill-extra">${pillExtra}</div>`;
    }
    if (opts.rutaMobileExpand) {
        const arrowBtn = '<button type="button" class="ruta-expand-arrow" aria-label="Desplegar distancia y navegación"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>';
        return `<span class="ruta-title">${title}</span>${arrowBtn}<div class="horizon-pill-extra">${pillExtra}</div>`;
    }
    return `<span class="ruta-title">${title}</span>${pillExtra}`;
}
function setupNavPinTouchInteractions() {
    if (setupNavPinTouchInteractions._bound) return;
    setupNavPinTouchInteractions._bound = true;
    let lastTap = 0;

    const toggleNavArrow = (e) => {
        if (document.body.classList.contains('dev-mode-pins-active')) return;
        
        const rutaArrow = e.target.closest('.ruta-hud-wrapper .ruta-expand-arrow');
        if (rutaArrow) {
            const wrapper = rutaArrow.closest('.ruta-hud-wrapper');
            if (!wrapper) return;
            e.preventDefault(); e.stopPropagation();
            const now = Date.now();
            if (now - lastTap < 300) return;
            lastTap = now;
            document.querySelectorAll('.ruta-hud-wrapper.ruta-pill-expanded').forEach(el => { if (el !== wrapper) el.classList.remove('ruta-pill-expanded'); });
            wrapper.classList.toggle('ruta-pill-expanded');
            return;
        }
        
        const horizonArrow = e.target.closest('.horizon-hud-wrapper .horizon-expand-arrow');
        if (horizonArrow) {
            const wrapper = horizonArrow.closest('.horizon-hud-wrapper');
            if (!wrapper) return;
            e.preventDefault(); e.stopPropagation();
            const now = Date.now();
            if (now - lastTap < 300) return;
            lastTap = now;
            document.querySelectorAll('.horizon-hud-wrapper.horizon-pill-expanded').forEach(el => { if (el !== wrapper) el.classList.remove('horizon-pill-expanded'); });
            wrapper.classList.toggle('horizon-pill-expanded');
            return;
        }
    };

    // Activamos los eventos tanto para táctil como para mouse universalmente
    document.addEventListener('touchend', toggleNavArrow, { passive: false, capture: true });
    document.addEventListener('click', toggleNavArrow, { capture: true });

    document.addEventListener('mousedown', (e) => {
        if (document.body.classList.contains('dev-mode-pins-active')) return;
        if (!e.target.closest('.horizon-hud-wrapper') && !e.target.closest('.ruta-hud-wrapper')) {
            document.querySelectorAll('.horizon-hud-wrapper.horizon-pin-open').forEach(el => el.classList.remove('horizon-pin-open'));
            document.querySelectorAll('.horizon-hud-wrapper.horizon-pill-expanded').forEach(el => el.classList.remove('horizon-pill-expanded'));
            document.querySelectorAll('.ruta-hud-wrapper.ruta-pill-expanded').forEach(el => el.classList.remove('ruta-pill-expanded'));
        }
    });
}

// Inicializar globalmente los listeners (incluyendo el bloqueo de teclado WASD para Pannellum)
setupDevModes();
