let isPegmanDragging = false, pegmanLastX = 0, pegmanLastY = 0, pegmanTilt = 0, pegmanTargetTilt = 0, pegmanAnimFrame = null;
function animatePegmanPendulum() { if(isPegmanDragging) { pegmanTilt += (pegmanTargetTilt - pegmanTilt) * 0.15; const ghost = document.getElementById('pegman-ghost'); if (ghost) ghost.style.transform = `rotate(${pegmanTilt}deg)`; pegmanTargetTilt *= 0.85; pegmanAnimFrame = requestAnimationFrame(animatePegmanPendulum); } }
function setupPegmanEngine() {
    const pegmanBtn = document.getElementById('js-pegman'), ghost = document.getElementById('pegman-ghost'); if(!pegmanBtn || !ghost) return;
    const startDrag = (e) => { e.preventDefault(); e.stopPropagation(); isPegmanDragging = true; document.body.classList.add('pegman-dragging'); let mock = getMockEvent(e); pegmanLastX = mock.clientX; pegmanLastY = mock.clientY; ghost.style.left = (pegmanLastX - 7) + 'px'; ghost.style.top = (pegmanLastY - 2) + 'px'; ghost.classList.add('active'); pegmanTilt = 0; pegmanTargetTilt = 0; cancelAnimationFrame(pegmanAnimFrame); animatePegmanPendulum(); };
    const doDrag = (e) => { if(!isPegmanDragging) return; e.preventDefault(); let mock = getMockEvent(e); if(mock.clientX) { let deltaX = mock.clientX - pegmanLastX; pegmanTargetTilt = deltaX * 1.5; if(pegmanTargetTilt > 45) pegmanTargetTilt = 45; if(pegmanTargetTilt < -45) pegmanTargetTilt = -45; pegmanLastX = mock.clientX; pegmanLastY = mock.clientY; } ghost.style.left = (pegmanLastX - 7) + 'px'; ghost.style.top = (pegmanLastY - 2) + 'px'; };
    const endDrag = (e) => { if(!isPegmanDragging) return; isPegmanDragging = false; document.body.classList.remove('pegman-dragging'); ghost.classList.remove('active'); cancelAnimationFrame(pegmanAnimFrame); if(!visor360) return; let mockEvent = { clientX: pegmanLastX, clientY: pegmanLastY }; let coords = visor360.mouseEventToCoords(mockEvent); if(coords && !isNaN(coords[0])) { let p = coords[0], y = coords[1]; let closestUrl = null; let minDist = 15; BaseDatosLotes.forEach(l => { if(l.videoUrl) { let d = Math.sqrt(Math.pow(l.pitch - p, 2) + Math.pow(l.yaw - y, 2)); if(d < minDist) { minDist = d; closestUrl = l.videoUrl; } } if(l.tipo === 'vista360' && l.url) { let d = Math.sqrt(Math.pow(l.pitch - p, 2) + Math.pow(l.yaw - y, 2)); if(d < minDist) { minDist = d; closestUrl = l.url; } } }); if(closestUrl) { openInAppViewer(null, closestUrl); } else { const fabContainer = document.getElementById('js-pegman'); fabContainer.classList.add('shake'); setTimeout(() => fabContainer.classList.remove('shake'), 400); } } };
    pegmanBtn.addEventListener('mousedown', startDrag); pegmanBtn.addEventListener('touchstart', startDrag, {passive: false}); window.addEventListener('mousemove', doDrag); window.addEventListener('touchmove', doDrag, {passive: false}); window.addEventListener('mouseup', endDrag); window.addEventListener('touchend', endDrag);
}

// Sincronización directa con el loop de pannellum:
// window.__fresia_svgSyncFn se llama desde dentro de pannellum.js
// justo DESPUÉS de que calcula el pitch/yaw/hfov final del frame y actualiza hotspots.
// Esto garantiza que el SVG nunca va un frame por detrás del render WebGL.
function registerSVGSyncCallback() {
    window.__fresia_svgSyncFn = function () {
        if (!isSvgRenderAllowed() || !shouldUpdateSVGThisFrame()) return;
        updateSVGPaths();
        const compassDial = document.getElementById('js-compass');
        if (compassDial) compassDial.style.transform = `rotate(${-(visor360.getYaw() - NorteOffset)}deg)`;
        if (!isTouchDevice() || TouchPerfPhase1.shouldUpdateOverlayDecorThisFrame()) TouchPerfPhase1.applyOverlayDecor();
    };
}
// Mantener hookRendererOverlay como fallback vacío para no romper llamadas existentes
function hookRendererOverlay(renderer) { /* reemplazado por registerSVGSyncCallback */ }

function attachSmartViewerHandlers(panoramaBase) {
    if (!visor360) return;
    const handleLoad = () => { 
        isWebGLSupported = true; viewerGpuReady = true; smartInitAttempts = 0; 
        const renderer = visor360.getRenderer(); 
        if(renderer) { SmartGpuProfile.patchRenderer(renderer); const canvas = typeof renderer.getCanvas === 'function' ? renderer.getCanvas() : null; SmartGpuProfile.bindContextRecovery(canvas, () => retryPannellumSmart(panoramaBase, true) ); }
        // NOTA ARQUITECTÓNICA PERMANENTE: El SVG #loteo-svg ya vive en el HTML como capa
        // independiente (hermano de #panorama-container). NO moverlo a .pnlm-ui jamás.
        // Moverlo dentro de Pannellum lo introduce en su stacking context 3D (translateZ(9999px))
        // y eso provoca el flotamiento irrecuperable de la calle en todos los dispositivos.
        syncFranjaVisualsOnReady();
        if (!isIntroAnimating) revealLoteoOverlay();
    };
    visor360.on('error', () => { isWebGLSupported = false; viewerGpuReady = false; const spText = document.getElementById('splash-loading-text'); if (spText) spText.innerText = 'REINTENTO CON MODO LITE GPU...'; setTimeout(() => retryPannellumSmart(panoramaBase, true), 600); });
    visor360.on('load', handleLoad);
    registerSVGSyncCallback();
    if (visor360.isLoaded && visor360.isLoaded()) { handleLoad(); } else { setTimeout(() => { if (!viewerGpuReady && visor360.getRenderer()) handleLoad(); }, 300); }
}

async function retryPannellumSmart(panoramaBase, forceLite) {
    if (!isTouchDevice()) return; smartInitAttempts++; if (smartInitAttempts > 3) { const sp = document.getElementById('splash-loading-text'); if (sp) sp.innerText = 'ERROR GPU: RECARGA LA PÁGINA'; return; } if (forceLite) { SmartGpuProfile.maxDPR = 1; SmartGpuProfile.maxTextureSize = 2048; SmartGpuProfile.isHighEnd = false; } viewerGpuReady = false; if (visor360) { try { visor360.destroy(); } catch (e) {} visor360 = null; }
    const panoramaUrl = await SmartGpuProfile.preparePanorama( panoramaBase, forceLite || smartInitAttempts > 1 );
    visor360 = pannellum.viewer('panorama-container', { type: 'equirectangular', panorama: panoramaUrl, autoLoad: true, compass: false, hfov: 130, pitch: 60, yaw: -45, hotSpots: getHotspotsConfig(), fallback: PANORAMA_FILE, touchPanSpeedCoeffFactor: 1.35, friction: 0.12, showZoomCtrl: false, });
    attachSmartViewerHandlers(panoramaBase);
}

function runPannellumIntroBootstrap() {
    const beginIntro = () => {
        setTimeout(() => {
            const pnlmContainer = document.getElementById('panorama-container'); const uiEngine = document.getElementById('holographic-ui-engine');
            // FIX PERMANENTE: NO mover #loteo-svg dentro de .pnlm-ui. Ya es una capa independiente en el HTML.
            let fsInterval = setInterval(() => { let fsBtn = document.querySelector('.pnlm-fullscreen-toggle-button'); if (fsBtn) { clearInterval(fsInterval); let newBtn = fsBtn.cloneNode(true); fsBtn.parentNode.replaceChild(newBtn, fsBtn); newBtn.addEventListener('click', () => { let docEl = document.documentElement; if (!document.fullscreenElement) { if (docEl.requestFullscreen) docEl.requestFullscreen(); else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen(); newBtn.classList.add('pnlm-fullscreen-toggle-button-active'); } else { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); newBtn.classList.remove('pnlm-fullscreen-toggle-button-active'); } if (isTouchDevice() && visor360 && viewerGpuReady) { setTimeout(() => { const r = visor360.getRenderer(); if (r && r.resize) r.resize(); }, 300); } }); } }, 500);
            // FIX PERMANENTE DE Z-INDEX: NO mover #holographic-ui-engine dentro de #panorama-container.
            // Si lo mueve, el uiEngine queda atrapado en el stacking context z-index:0 del panorama-container,
            // y el SVG (z-index:1 en body) aparece encima del dock y de toda la UI. Ambos deben vivir en body.
            if (!visor360) return; 

            visor360.setHfov(DEFAULT_HFOV, 2500); 
            visor360.setPitch(-40, 2500);

            const urlParams = new URLSearchParams(window.location.search); const targetLoteId = urlParams.get('lote');
            
            setTimeout(() => {
                if (targetLoteId) { 
                    const searchStr = targetLoteId.toLowerCase().replace(/\s/g, ''); const targetPin = BaseDatosLotes.find( (l) => (l.titulo || '').toLowerCase().replace(/\s/g, '').includes(searchStr) || (l.numero || '') === targetLoteId, ); if (targetPin) visor360.lookAt(targetPin.pitch, targetPin.yaw, 70, 3000); else visor360.lookAt(5, 15, 100, 3000); 
                    setTimeout(() => { revealLoteoOverlay(); }, 3000);
                } else {
                    if (FRESIA_CFG.vista === 'suelo') {
                        // --- CINEMÁTICA VISTA SUELO (3 Puntos -> TinyHouse) ---
                        // Punto 1: Paneamos hacia un costado del Norte
                        visor360.lookAt(15, NorteOffset - 70, 110, 2500);
                        setTimeout(() => {
                            // Punto 2: Barrido largo cruzando el horizonte
                            visor360.lookAt(0, NorteOffset + 50, 95, 3000);
                            setTimeout(() => {
                                // Punto 3: Buscar "TinyHouse" y enfocar
                                const tinyPin = BaseDatosLotes.find(p => p.titulo && p.titulo.toLowerCase().includes('tinyhouse')) || PuntosHorizonte.find(p => p.titulo && p.titulo.toLowerCase().includes('tinyhouse'));
                                if (tinyPin) {
                                    visor360.lookAt(tinyPin.pitch, tinyPin.yaw, 80, 3500);
                                } else {
                                    visor360.lookAt(5, NorteOffset, 85, 3500); // Fallback al Norte si no existe
                                }
                                setTimeout(() => { revealLoteoOverlay(); }, 3500);
                            }, 3000);
                        }, 2500);
                    } else {
                        // --- CINEMÁTICA VISTA AÉREA NORMAL ---
                        visor360.lookAt(5, 15, 100, 3000); 
                        setTimeout(() => {
                            visor360.lookAt(-89, 65, 115, 3000);
                            setTimeout(() => { revealLoteoOverlay(); }, 3000);
                        }, 3000);
                    }
                }
            }, 1500);
        }, 1000);
    };
    if (isTouchDevice() && !viewerGpuReady) { let loops = 0; const waitGpu = setInterval(() => { loops++; if (viewerGpuReady || loops > 30) { clearInterval(waitGpu); viewerGpuReady = true; beginIntro(); } }, 100); return; } beginIntro();
}

function bindPanoramaPointerEvents() {
    const container = document.getElementById('panorama-container'); let startX, startY, startTime; let lastClickTime = 0;
    function handleStart(e) { let mock = getMockEvent(e); startX = mock.clientX; startY = mock.clientY; startTime = Date.now(); }
    function handleEnd(e) {
        if (draggingCalleMove) {
            if (draggingCalleMove.el) draggingCalleMove.el.classList.remove('is-dragging');
            draggingCalleMove = null;
            refreshAllHotspots();
            saveToLocal();
            return;
        }
        if (draggingFranjaDiv) {
            const gid = draggingFranjaDiv.gid;
            if (draggingFranjaDiv.el) draggingFranjaDiv.el.classList.remove('is-dragging');
            draggingFranjaDiv = null;
            const grp = allDrawnLines.find(l => l.id === gid);
            if (grp && grp.tipo === 'franja-curva-grupo') {
                if (window.rebuildFranjaCurvaGroup) rebuildFranjaCurvaGroup(gid);
            } else if (grp && grp.tipo === 'franja-grupo') {
                if (window.rebuildFranjaGroup) rebuildFranjaGroup(gid);
            }
            refreshAllHotspots();
            saveToLocal();
            return;
        }
        if (draggingVertex) { 
            if(draggingVertex.el) draggingVertex.el.classList.remove('is-dragging'); 
            let mock = getMockEvent(e);
            const sx = draggingVertex.startX ?? mock.clientX;
            const sy = draggingVertex.startY ?? mock.clientY;
            const wasTap = Math.hypot(mock.clientX - sx, mock.clientY - sy) < 8;
            const isCalleFinishVtx = currentLineType === 'calle' && draggingVertex.lineId === currentTempLineId && draggingVertex.idx === currentLinePoints.length - 1 && currentLinePoints.length >= 2;
            if (wasTap && isCalleFinishVtx) {
                draggingVertex = null;
                window.lastMouseX = undefined;
                window.lastMouseY = undefined;
                finishCalleDrawing();
                return;
            }
            let snap = arq2_findNearestEdgeOrVertex(mock.clientX, mock.clientY, draggingVertex.lineId, 25);
            let coords;
            if (snap) {
                coords = [snap.pitch, snap.yaw];
            } else {
                coords = visor360.mouseEventToCoords(mock);
            }
            if (snapCursor) snapCursor.classList.remove('active', 'is-costura');
            if (coords && !isNaN(coords[0])) {
                applyDraggedVertexCoords(coords);
                const lineId = draggingVertex.lineId;
                const line = allDrawnLines.find(l => l.id === lineId);
                if (line && (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote')) {
                    // Always re-register shared edges after moving a vertex to dynamically update shared boundaries
                    arq2_registerSharedEdges(lineId);
                }
            }
            draggingVertex = null; 
            window.lastMouseX = undefined;
            window.lastMouseY = undefined;
            refreshAllHotspots(true); 
            saveToLocal(); 
            return; 
        }
        let mock = getMockEvent(e);
        if (isDevModePinsActive && pickedPin) {
            if (e.target && e.target.closest && (e.target.closest('.pin-quick-actions') || e.target.closest('.qa-btn'))) {
                pickedPin = null; document.getElementById('ghost-pin').classList.remove('active');
                document.querySelectorAll('.pnlm-hotspot-base').forEach(el => { el.style.opacity = ''; });
                return;
            }
            const coords = visor360.mouseEventToCoords(mock); if (coords && !isNaN(coords[0])) { pickedPin.pitch = parseFloat(coords[0].toFixed(2)); pickedPin.yaw = parseFloat(coords[1].toFixed(2)); } pickedPin = null; document.getElementById('ghost-pin').classList.remove('active'); refreshAllHotspots(); saveToLocal(); return;
        }
        const timeDiff = Date.now() - startTime; const moveDist = Math.sqrt( Math.pow(mock.clientX - startX, 2) + Math.pow(mock.clientY - startY, 2) );
        if (timeDiff < 500 && moveDist < 10) {
            if (isArquitecto2Active && visor360) {
                const isDbl = Date.now() - lastClickTime < 350;
                arq2_onPanoramaClick(mock, isDbl);
                lastClickTime = Date.now();
                return;
            }
            if (Date.now() - lastClickTime < 350 && isDevModeDrawActive && currentLineType !== 'franja' && currentLineType !== 'franja_curva') {
                if (currentLineType === 'calle' && currentLinePoints.length >= 2) {
                    finishCalleDrawing();
                    lastClickTime = 0;
                    return;
                }
                if (currentLineType !== 'calle') {
                    anclarTrazoActivo();
                    lastClickTime = 0;
                    return;
                }
            }
            lastClickTime = Date.now();
            if (isDevModeDrawActive && currentLineType === 'eraser') { runEraserAtEvent(mock); return; }
            if (isDevModeDrawActive && (currentLineType === 'franja' || currentLineType === 'franja_curva')) {
                if (!franjaCornerA) {
                    const coords = visor360.mouseEventToCoords(mock); if (!coords) return;
                    const snapA = snapFranjaScreenRect(mock.clientX, mock.clientY, mock.clientX, mock.clientY);
                    franjaCornerA = { sx: snapA.x1, sy: snapA.y1, pitch: parseFloat(coords[0].toFixed(3)), yaw: parseFloat(coords[1].toFixed(3)) };
                    try { visor360.addHotSpot({ id: 'franja_preview_a', pitch: franjaCornerA.pitch, yaw: franjaCornerA.yaw, createTooltipFunc: (div) => { div.classList.add('vertex-marker','franja-corner-marker','drawing-node'); div.id = 'franja_preview_a'; }, createTooltipArgs: {} }); } catch(e) {}
                } else {
                    const built = buildFranjaScreenPointsSnapped(franjaCornerA.sx, franjaCornerA.sy, mock.clientX, mock.clientY, Math.max(1, franjaDraftCount));
                    if (!built) { clearFranjaDraft(); alert('⚠️ No se pudo proyectar la franja. Ajusta la vista.'); return; }
                    const snap = built.snap;
                    franjaPendingCreate = { ax: franjaCornerA.sx, ay: franjaCornerA.sy, bx: mock.clientX, by: mock.clientY, snap, tipo: currentLineType };
                    clearFranjaDraft();
                    openFranjaLotesModal(franjaDraftCount, commitFranjaFromModal);
                }
                return;
            }
            if (isDevModeDrawActive) {
                if (currentLineType === 'calle') { handleCalleDrawClick(mock); return; }
                const coords = visor360.mouseEventToCoords(mock); if (!coords) return; let p = coords[0], y = coords[1];
                if (currentLineType === 'cortar') {
                    currentLinePoints.push([p, y]);
                    if (currentLinePoints.length === 2) {
                        let didSplit = attemptSplit(currentLinePoints[0], currentLinePoints[1]);
                        if(!didSplit) { flashScreenError(); }
                        currentLinePoints = []; currentTempLineId = 'temp_' + Date.now(); refreshAllHotspots(); saveToLocal();
                    } else {
                        visor360.addHotSpot({ pitch: p, yaw: y, id: 'temp_base_pt_' + Date.now(), createTooltipFunc: renderHiddenVertex, createTooltipArgs: { lineId: currentTempLineId, type: currentLineType, isGuide: true, idx: currentLinePoints.length - 1, hsId: 'temp_base_pt_' + Date.now() }, }); syncSVGElements(); updateSVGPaths();
                    } return;
                }
                if (snappedCoords) { p = snappedCoords[0]; y = snappedCoords[1]; }
                let isClosingShape = false;
                if (currentLineType !== 'calle' && currentLineType !== 'franja_curva' && currentLinePoints.length >= 3) {
                    if (isNearPolygonOriginPY(p, y, currentLinePoints[0]) && canTriggerPolygonAutoClose()) isClosingShape = true;
                }
                if (isClosingShape) { lastDevDrawClickMs = Date.now(); anclarTrazoActivo(); } else { currentLinePoints.push([p, y]); lastDevDrawClickMs = Date.now(); let _hid = 'temp_base_pt_'+Date.now(); visor360.addHotSpot({ pitch: p, yaw: y, id: _hid, createTooltipFunc: renderHiddenVertex, createTooltipArgs: { lineId: currentTempLineId, type: currentLineType, isGuide: true, idx: currentLinePoints.length-1, hsId: _hid }, }); syncSVGElements(); updateSVGPaths(); }
            } else if (isDevModePinsActive && isLineaPinesActive && !pickedPin) {
                if (e.target && e.target.closest('.qa-btn')) return;
                handleLineaPinesClick(mock);
            } else if (isDevModePinsActive && !pickedPin) {
                if (e.target && e.target.closest('.qa-btn')) return; const coords = visor360.mouseEventToCoords(mock); if (!coords) return; const p = coords[0].toFixed(2), y = coords[1].toFixed(2); let baseArgs = { pitch: parseFloat(p), yaw: parseFloat(y) };
                if (currentPinTypeMap === 'horizonte' || currentPinTypeMap === 'ruta') {
                    const label = currentPinTypeMap === 'ruta' ? '🛣️ PIN RUTA' : '⛰️ PIN HORIZONTE';
                    const titulo = prompt(`${label}\nTítulo (ej: ${currentPinTypeMap === 'ruta' ? 'Ruta V-30' : 'Volcán Osorno'}):`);
                    if (titulo) { 
                        baseArgs.titulo = titulo; baseArgs.tipo = currentPinTypeMap; 
                        baseArgs.coordenadasDestino = '';
                        openPinEditor(baseArgs, true); 
                    }
                } else if (currentPinTypeMap === 'vista360' || currentPinTypeMap === 'casa360') { 
                    baseArgs.tipo = currentPinTypeMap; 
                    openPinEditor(baseArgs, true); 
                } else { baseArgs.tipo = 'lote'; baseArgs.status = currentPinTypeMap; openPinEditor(baseArgs, true); }
            }
        }
    }
    function handleMove(e) {
        let mock = getMockEvent(e); if (mock.clientX === undefined) return;
        if (draggingCalleMove) {
            if (e.cancelable) e.preventDefault();
            const coords = visor360?.mouseEventToCoords(mock);
            const line = allDrawnLines.find(l => l.id === draggingCalleMove.lineId);
            if (coords && line && draggingCalleMove.origPts) {
                const dP = coords[0] - draggingCalleMove.startPY[0];
                const dY = coords[1] - draggingCalleMove.startPY[1];
                line.puntos = draggingCalleMove.origPts.map(pt => [pt[0] + dP, pt[1] + dY]);
            }
            syncSVGElements(); updateSVGPaths();
            refreshAllHotspots(true);
            return;
        }
        if (draggingFranjaDiv) {
            if (e.cancelable) e.preventDefault();
            applyFranjaDivDrag(draggingFranjaDiv.gid, draggingFranjaDiv.splitIdx, mock.clientX, mock.clientY);
            syncSVGElements(); updateSVGPaths();
            return;
        }
        if (draggingVertex) {
            if (e.cancelable) e.preventDefault();
            window.lastMouseX = mock.clientX; window.lastMouseY = mock.clientY;
            try {
                let snap = arq2_findNearestEdgeOrVertex(mock.clientX, mock.clientY, draggingVertex.lineId, 25);
                let coords;
                if (snap) {
                    coords = [snap.pitch, snap.yaw];
                    if (snapCursor) {
                        snapCursor.style.left = snap.screenX + 'px';
                        snapCursor.style.top = snap.screenY + 'px';
                        snapCursor.classList.add('active', 'is-costura');
                    }
                } else {
                    coords = visor360?.mouseEventToCoords(mock);
                    if (snapCursor) snapCursor.classList.remove('active', 'is-costura');
                }
                if (coords && !isNaN(coords[0])) applyDraggedVertexCoords(coords);
            } catch(err) {}
            syncSVGElements(); updateSVGPaths();
            return;
        }
        if (isDevModePinsActive && pickedPin) { if (e.cancelable) e.preventDefault(); const gPin = document.getElementById('ghost-pin'); gPin.classList.add('active'); gPin.style.left = mock.clientX + 'px'; gPin.style.top = mock.clientY + 'px'; return; }
        if (isDevModePinsActive && isLineaPinesActive && visor360) {
            window.lastMouseX = mock.clientX; window.lastMouseY = mock.clientY;
            updateSVGPaths();
            return;
        }
        if (isArquitecto2Active && visor360) {
            arq2_onPanoramaMove(mock);
            return;
        }
        if (isDevModeDrawActive && (currentLineType === 'franja' || currentLineType === 'franja_curva') && franjaCornerA) {
            window.lastMouseX = mock.clientX; window.lastMouseY = mock.clientY;
            updateFranjaPreview(mock.clientX, mock.clientY);
            syncSVGElements(); updateSVGPaths();
            if (snapCursor) snapCursor.classList.remove('active');
            return;
        }
        if (!isDevModeDrawActive || !visor360 || currentLineType === 'eraser') { if (snapCursor) snapCursor.classList.remove('active'); return; }
        if (isDevModeDrawActive) { window.lastMouseX = mock.clientX; window.lastMouseY = mock.clientY; updateSVGPaths(); }
        
        try { const coords = visor360.mouseEventToCoords(mock); updateDrawModeSnap(mock, coords); } catch (err) {}
    }
    container.addEventListener('mousedown', handleStart); container.addEventListener('touchstart', handleStart, { passive: false }); window.addEventListener('mouseup', handleEnd); window.addEventListener('touchend', handleEnd); window.addEventListener('mousemove', handleMove); window.addEventListener('touchmove', handleMove, { passive: false });
}

async function initPannellum() {
    const touchDev = isTouchDevice();
    if (!touchDev && !isWebGLSupported) { const spText = document.getElementById('splash-loading-text'); if (spText) spText.innerText = 'MODO DE COMPATIBILIDAD (SIN GPU)...'; const svg = document.getElementById('loteo-svg'); if (svg) svg.style.display = 'none'; }
    let panoramaUrl = PANORAMA_FILE;
    if (touchDev) { SmartGpuProfile.init(); viewerGpuReady = false; const spText = document.getElementById('splash-loading-text'); if (spText) spText.innerText = 'OPTIMIZANDO GPU PARA MÓVILES...'; panoramaUrl = await SmartGpuProfile.preparePanorama(PANORAMA_FILE, false); if (spText) spText.innerText = 'CARGANDO PANORAMA 360°...'; }
    const viewerConfig = { type: 'equirectangular', panorama: panoramaUrl, autoLoad: true, compass: false, hfov: 130, pitch: 60, yaw: -45, hotSpots: getHotspotsConfig(), fallback: PANORAMA_FILE, };
    if (touchDev) { viewerConfig.touchPanSpeedCoeffFactor = 1.35; viewerConfig.friction = 0.12; viewerConfig.showZoomCtrl = false; }
    visor360 = pannellum.viewer('panorama-container', viewerConfig);
    attachSmartViewerHandlers(PANORAMA_FILE);
    if (!pannellumIntroBootstrapped) { pannellumIntroBootstrapped = true; runPannellumIntroBootstrap(); }
    if (!panoramaEventsBound) { panoramaEventsBound = true; bindPanoramaPointerEvents(); }
}
