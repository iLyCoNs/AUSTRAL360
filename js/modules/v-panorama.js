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
function hookRendererOverlay(renderer) { /* reemplazado por registerSVGSyncCallback */ }function attachSmartViewerHandlers(panoramaBase) {
    if (!visor360) return;
    const handleLoad = () => { 
        isWebGLSupported = true; viewerGpuReady = true; smartInitAttempts = 0; 
        const renderer = visor360.getRenderer(); 
        if(renderer) { SmartGpuProfile.patchRenderer(renderer); const canvas = typeof renderer.getCanvas === 'function' ? renderer.getCanvas() : null; SmartGpuProfile.bindContextRecovery(canvas, () => retryPannellumSmart(panoramaBase, true) ); }
        syncFranjaVisualsOnReady();
        if (!isIntroAnimating) revealLoteoOverlay();
    };
    visor360.on('error', () => { isWebGLSupported = false; viewerGpuReady = false; const spText = document.getElementById('splash-loading-text'); if (spText) spText.innerText = 'REINTENTO CON MODO LITE GPU...'; setTimeout(() => retryPannellumSmart(panoramaBase, true), 600); });
    visor360.on('load', handleLoad);
    registerSVGSyncCallback();
    if (visor360.isLoaded && visor360.isLoaded()) { handleLoad(); } else { setTimeout(() => { if (!viewerGpuReady && visor360.getRenderer()) handleLoad(); }, 300); }
}

function injectSVGIntoPannellum() {
    try {
        const pContainer = document.querySelector('.pnlm-container');
        const loteoSvg = document.getElementById('loteo-svg');
        const pUi = document.querySelector('.pnlm-ui');
        if (pContainer && loteoSvg && pUi) {
            const dragfix = document.querySelector('.pnlm-dragfix');
            if (dragfix) pContainer.insertBefore(dragfix, pUi);
            pContainer.insertBefore(loteoSvg, pUi);
            loteoSvg.style.zIndex = '1';
            pUi.style.zIndex = '2';
        }
    } catch(e) {}
}

async function retryPannellumSmart(panoramaBase, forceLite) {
    if (!isTouchDevice()) return; smartInitAttempts++; if (smartInitAttempts > 3) { const sp = document.getElementById('splash-loading-text'); if (sp) sp.innerText = 'ERROR GPU: RECARGA LA P?GINA'; return; } if (forceLite) { SmartGpuProfile.maxDPR = 1; SmartGpuProfile.maxTextureSize = 2048; SmartGpuProfile.isHighEnd = false; } viewerGpuReady = false; if (visor360) { try { visor360.destroy(); } catch (e) {} visor360 = null; }
    const panoramaUrl = await SmartGpuProfile.preparePanorama( panoramaBase, forceLite || smartInitAttempts > 1 );
    visor360 = pannellum.viewer('panorama-container', { type: 'equirectangular', panorama: panoramaUrl, autoLoad: true, compass: false, hfov: 130, pitch: 60, yaw: -45, hotSpots: getHotspotsConfig(), fallback: PANORAMA_FILE, touchPanSpeedCoeffFactor: 1.35, friction: 0.12, showZoomCtrl: false, });
    injectSVGIntoPannellum();
    attachSmartViewerHandlers(panoramaBase);
}

function runPannellumIntroBootstrap() {
    const beginIntro = () => {
        setTimeout(() => {
            const pnlmContainer = document.getElementById('panorama-container'); const uiEngine = document.getElementById('holographic-ui-engine');
            let fsInterval = setInterval(() => { let fsBtn = document.querySelector('.pnlm-fullscreen-toggle-button'); if (fsBtn) { clearInterval(fsInterval); let newBtn = fsBtn.cloneNode(true); fsBtn.parentNode.replaceChild(newBtn, fsBtn); newBtn.addEventListener('click', () => { let docEl = document.documentElement; if (!document.fullscreenElement) { if (docEl.requestFullscreen) docEl.requestFullscreen(); else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen(); newBtn.classList.add('pnlm-fullscreen-toggle-button-active'); } else { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); newBtn.classList.remove('pnlm-fullscreen-toggle-button-active'); } if (isTouchDevice() && visor360 && viewerGpuReady) { setTimeout(() => { const r = visor360.getRenderer(); if (r && r.resize) r.resize(); }, 300); } }); } }, 500);
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
    function handleStart(e) { 
        let mock = getMockEvent(e); 
        startX = mock.clientX; 
        startY = mock.clientY; 
        startTime = Date.now(); 
        
        if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'path') {
            const dragfix = document.querySelector('.pnlm-dragfix');
            if (dragfix) {
                try {
                    let clonedEvent;
                    if (typeof MouseEvent !== 'undefined' && e.type.includes('mouse')) clonedEvent = new MouseEvent(e.type, e);
                    else if (typeof TouchEvent !== 'undefined' && e.type.includes('touch')) clonedEvent = new TouchEvent(e.type, e);
                    else {
                        clonedEvent = new CustomEvent(e.type);
                        Object.assign(clonedEvent, e);
                    }
                    dragfix.dispatchEvent(clonedEvent);
                } catch(err) {}
            }
        }
    }
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
            if (isDevModeDrawActive && !isDevModePinsActive) {
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

    // =====================================================================
    // FIX RAÍZ — Smart Pin sobre polígono SVG
    // El #loteo-svg es hermano de #panorama-container y está por encima en DOM.
    // Los clics sobre sus <path> NO burbujean al container, por eso
    // handleEnd nunca se dispara. Aquí escuchamos en el SVG directamente
    // y enrutamos a arq2_onPanoramaClick cuando está activo el modo Pin V2.
    // =====================================================================
    const loteoSvg = document.getElementById('loteo-svg');
    if (loteoSvg) {
        let svgPinStartX, svgPinStartY, svgPinStartTime;
        loteoSvg.addEventListener('mousedown', (e) => {
            if (!document.body.classList.contains('pin-v2-active') && !document.body.classList.contains('arq2-pin-active')) return;
            const mock = getMockEvent(e);
            svgPinStartX = mock.clientX;
            svgPinStartY = mock.clientY;
            svgPinStartTime = Date.now();
        }, { passive: true });
        loteoSvg.addEventListener('mouseup', (e) => {
            if (!document.body.classList.contains('pin-v2-active') && !document.body.classList.contains('arq2-pin-active')) return;
            if (!isArquitecto2Active) return;
            const mock = getMockEvent(e);
            const dx = mock.clientX - (svgPinStartX || mock.clientX);
            const dy = mock.clientY - (svgPinStartY || mock.clientY);
            const dt = Date.now() - (svgPinStartTime || Date.now());
            // Solo si fue un tap, no un arrastre
            if (dt < 500 && Math.hypot(dx, dy) < 12) {
                e.stopPropagation();
                arq2_onPanoramaClick(mock, false);
            }
        }, { passive: true });
        loteoSvg.addEventListener('touchstart', (e) => {
            if (!document.body.classList.contains('pin-v2-active') && !document.body.classList.contains('arq2-pin-active')) return;
            const mock = getMockEvent(e);
            svgPinStartX = mock.clientX;
            svgPinStartY = mock.clientY;
            svgPinStartTime = Date.now();
        }, { passive: true });
        loteoSvg.addEventListener('touchend', (e) => {
            if (!document.body.classList.contains('pin-v2-active') && !document.body.classList.contains('arq2-pin-active')) return;
            if (!isArquitecto2Active) return;
            const mock = getMockEvent(e);
            const dx = mock.clientX - (svgPinStartX || mock.clientX);
            const dy = mock.clientY - (svgPinStartY || mock.clientY);
            const dt = Date.now() - (svgPinStartTime || Date.now());
            if (dt < 500 && Math.hypot(dx, dy) < 18) {
                arq2_onPanoramaClick(mock, false);
            }
        }, { passive: true });
    }
}

let threeScene, threeCamera, threeRenderer, threeMesh;
let threePitch = 60, threeYaw = -45, threeHFov = 100;
let threeTargetPitch = 60, threeTargetYaw = -45;
let threeIsDragging = false, threeLastMouseX = 0, threeLastMouseY = 0;

async function initPannellum() {
    const touchDev = isTouchDevice();
    const container = document.getElementById('panorama-container');
    container.innerHTML = ''; 
    
    threeScene = new THREE.Scene();
    threeCamera = new THREE.PerspectiveCamera(threeHFov, window.innerWidth / window.innerHeight, 0.1, 1000);
    threeCamera.rotation.order = 'YXZ';
    
    threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    threeRenderer.setSize(window.innerWidth, window.innerHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(threeRenderer.domElement);
    
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    
    const spText = document.getElementById('splash-loading-text');
    if (spText) spText.innerText = 'CARGANDO MOTOR FERRARI 3D...';
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(PANORAMA_FILE, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        const material = new THREE.MeshBasicMaterial({ map: texture });
        threeMesh = new THREE.Mesh(geometry, material);
        threeScene.add(threeMesh);
        if (!pannellumIntroBootstrapped) { pannellumIntroBootstrapped = true; runPannellumIntroBootstrap(); }
    });

    window.addEventListener('resize', () => {
        threeCamera.aspect = window.innerWidth / window.innerHeight;
        threeCamera.updateProjectionMatrix();
        threeRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.visor360 = {
        getPitch: () => threePitch,
        getYaw: () => threeYaw,
        setPitch: (p) => { threeTargetPitch = p; threePitch = p; },
        setYaw: (y) => { threeTargetYaw = y; threeYaw = y; },
        getHfov: () => threeCamera.fov,
        setHfov: (f) => { threeCamera.fov = f; threeCamera.updateProjectionMatrix(); },
        getConfig: () => ({ hotSpots: window.fresia2DVertices || [] }),
        addHotSpot: (hs) => { 
            const layer2D = document.getElementById('fresia-2d-layer');
            if (layer2D && hs.createTooltipFunc) {
                const div = document.createElement('div');
                div.className = 'pnlm-hotspot-base';
                div.id = hs.id;
                div.dataset.pitch = hs.pitch;
                div.dataset.yaw = hs.yaw;
                hs.createTooltipFunc(div, hs.createTooltipArgs);
                layer2D.appendChild(div);
            }
        },
        removeHotSpot: (id) => { 
            const el = document.getElementById(id);
            if(el && el.parentNode) el.parentNode.removeChild(el);
        },
        destroy: () => { threeRenderer.dispose(); container.innerHTML = ''; },
        on: (event, callback) => {
            if (event === 'load') setTimeout(callback, 100);
        },
        getRenderer: () => null,
        isLoaded: () => true,
        mouseEventToCoords: (e) => {
            const rect = threeRenderer.domElement.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
            mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, threeCamera);
            if(threeMesh) {
                const intersects = raycaster.intersectObject(threeMesh);
                if (intersects.length > 0) {
                    const p = intersects[0].point;
                    const radius = 500;
                    const pitch = Math.asin(p.y / radius) * (180 / Math.PI);
                    const yaw = Math.atan2(p.x, -p.z) * (180 / Math.PI);
                    return [pitch, yaw];
                }
            }
            return [threePitch, threeYaw];
        }
    };

    container.addEventListener('mousedown', (e) => { 
        if (e.target.closest('.pnlm-hotspot-base') || e.target.closest('.qa-btn') || e.target.closest('.dev-toolbar') || e.target.closest('#js-dock')) return;
        threeIsDragging = true; threeLastMouseX = e.clientX; threeLastMouseY = e.clientY; 
    });
    window.addEventListener('mouseup', () => { threeIsDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if(!threeIsDragging || window.draggingVertex || window.draggingCalleMove || window.draggingFranjaDiv) return;
        const dx = e.clientX - threeLastMouseX;
        const dy = e.clientY - threeLastMouseY;
        threeLastMouseX = e.clientX; threeLastMouseY = e.clientY;
        threeTargetYaw -= dx * 0.15;
        threeTargetPitch += dy * 0.15;
        threeTargetPitch = Math.max(-85, Math.min(85, threeTargetPitch));
    });
    
    container.addEventListener('touchstart', (e) => { 
        if (e.target.closest('.pnlm-hotspot-base') || e.target.closest('.qa-btn') || e.target.closest('.dev-toolbar') || e.target.closest('#js-dock')) return;
        threeIsDragging = true; threeLastMouseX = e.touches[0].clientX; threeLastMouseY = e.touches[0].clientY; 
    }, {passive: true});
    window.addEventListener('touchend', () => { threeIsDragging = false; });
    window.addEventListener('touchmove', (e) => {
        if(!threeIsDragging || window.draggingVertex || window.draggingCalleMove || window.draggingFranjaDiv) return;
        const dx = e.touches[0].clientX - threeLastMouseX;
        const dy = e.touches[0].clientY - threeLastMouseY;
        threeLastMouseX = e.touches[0].clientX; threeLastMouseY = e.touches[0].clientY;
        threeTargetYaw -= dx * 0.25;
        threeTargetPitch += dy * 0.25;
        threeTargetPitch = Math.max(-85, Math.min(85, threeTargetPitch));
    }, {passive: true});

    function animate() {
        requestAnimationFrame(animate);
        threeYaw += (threeTargetYaw - threeYaw) * 0.12;
        threePitch += (threeTargetPitch - threePitch) * 0.12;
        threeCamera.rotation.y = THREE.MathUtils.degToRad(-threeYaw);
        threeCamera.rotation.x = THREE.MathUtils.degToRad(threePitch);
        threeRenderer.render(threeScene, threeCamera);
        if (window.__fresia_svgSyncFn) window.__fresia_svgSyncFn();
    }
    animate();

    attachSmartViewerHandlers(PANORAMA_FILE);
    if (!panoramaEventsBound) { panoramaEventsBound = true; bindPanoramaPointerEvents(); }
}
