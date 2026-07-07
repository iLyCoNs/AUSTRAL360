function arq2_onPanoramaMove(mock) {
    if (!isArquitecto2Active || !visor360) return;
    window.lastMouseX = mock.clientX;
    window.lastMouseY = mock.clientY;
    
    if (arq2Tool === 'eraser') {
        if (snapCursor) snapCursor.classList.remove('active');
        arq2_refreshFeedbackVisuals(mock);
        syncSVGElements();
        updateSVGPaths();
        return;
    }
    
    arq2CosturaSnap = arq2_findNearestEdgeOrVertex(mock.clientX, mock.clientY, arq2TempLineId, 7);
    // For Lote Libre, only keep the snap indicator if the target is a STREET edge
    if (arq2CosturaSnap && arq2Tool === 'lote-libre') {
        const snapLine = arq2CosturaSnap.lineId ? allDrawnLines.find(l => l.id === arq2CosturaSnap.lineId) : null;
        const isStreet = snapLine && (snapLine.tipo === 'calle-curva-arq2' || snapLine.tipo === 'calle' || snapLine.tipo === 'calle-curva-arq2-preview');
        if (!isStreet) arq2CosturaSnap = null;
    }

    // CLOSE SNAP FOR POLYGONS (lote-libre, fila-variable, calle-curva-arq2):
    // when >= 3 points placed, check if cursor is near the very first vertex to snap like a magnet.
    const isPolygonTool = arq2Tool === 'lote-libre' || arq2Tool === 'fila-variable' || arq2Tool === 'calle-curva-arq2';
    if (!arq2CosturaSnap && isPolygonTool && arq2LinePoints.length >= 3) {
        const firstPt = arq2LinePoints[0];
        const proj2 = getPanoramaScreenProjector();
        if (proj2) {
            const sc = proj2.toScreen(firstPt[0], firstPt[1]);
            if (sc) {
                const sx = DOMCache.viewport.left + sc[0], sy = DOMCache.viewport.top + sc[1];
                const dist = Math.hypot(mock.clientX - sx, mock.clientY - sy);
                if (dist < 22) { // within 22px of first vertex
                    arq2CosturaSnap = {
                        pitch: firstPt[0], yaw: firstPt[1],
                        screenX: sx, screenY: sy,
                        kind: 'calle-close'
                    };
                }
            }
        }
    }

    
    if (!arq2CosturaSnap && arq2Guideline && arq2LinePoints.length > 0 && visor360) {
        const coords = visor360.mouseEventToCoords(mock);
        if (coords && !isNaN(coords[0])) {
            const start = arq2Guideline.start;
            const dir = arq2Guideline.dir;
            const dx = coords[0] - start[0];
            const dy = coords[1] - start[1];
            const s = dx * dir[0] + dy * dir[1];
            if (s > 0) {
                const px = start[0] + s * dir[0];
                const py = start[1] + s * dir[1];
                const distDeg = Math.hypot(coords[0] - px, coords[1] - py);
                if (distDeg < 0.08) {
                    const proj = getPanoramaScreenProjector();
                    if (proj) {
                        const sc = proj.toScreen(px, py);
                        if (sc) {
                            arq2CosturaSnap = {
                                pitch: px,
                                yaw: py,
                                screenX: DOMCache.viewport.left + sc[0],
                                screenY: DOMCache.viewport.top + sc[1],
                                kind: 'guideline'
                            };
                        }
                    }
                }
            }
        }
    }
    
    if (snapCursor) {
        if (arq2CosturaSnap) {
            snapCursor.style.left = arq2CosturaSnap.screenX + 'px';
            snapCursor.style.top = arq2CosturaSnap.screenY + 'px';
            if (arq2CosturaSnap.kind === 'calle-close') {
                snapCursor.classList.add('active', 'is-closing');
                snapCursor.classList.remove('is-costura', 'is-calle-finish', 'is-calle-edge');
            } else {
                snapCursor.classList.add('active', 'is-costura');
                snapCursor.classList.remove('is-closing', 'is-calle-finish', 'is-calle-edge');
            }
        } else {
            snapCursor.classList.remove('active', 'is-costura', 'is-closing', 'is-calle-finish', 'is-calle-edge');
        }
    }
    arq2_refreshFeedbackVisuals(mock);
    syncSVGElements();
    updateSVGPaths();
}
function arq2_onPanoramaClick(mock, isDblClick) {
    if (!isArquitecto2Active || !visor360) return;
    if (document.getElementById('franja-lotes-modal')?.classList.contains('open')) return;
    if (arq2Tool === 'eraser') {
        runEraserAtEvent(mock);
        return;
    }
    const coords = visor360.mouseEventToCoords(mock);
    if (!coords || isNaN(coords[0])) return;
    
    if (arq2Tool === 'smart-pin-v2') {
        let p = parseFloat(coords[0].toFixed(3)), y = parseFloat(coords[1].toFixed(3));
        let num = prompt("Número/Nombre del Lote:", "00");
        if (num === null) return;
        let precio = prompt("Precio (opcional, ej: 1.500 UF):", "");
        if (precio === null) return;
        let estado = prompt("Estado (disponible, reservado, vendido):", "disponible") || "disponible";
        estado = estado.toLowerCase().trim();
        let videoUrl = prompt("URL de Recorrido 360 (opcional):", "");
        
        let nuevoPin = {
            id: 'pin_v2_' + Date.now(),
            pitch: p,
            yaw: y,
            numero: num,
            precio: precio,
            status: estado,
            videoUrl: videoUrl,
            createTooltipFunc: generarSmartPin,
            createTooltipArgs: { 
                id: 'pin_v2_' + Date.now(), 
                numero: num, 
                precio: precio, 
                status: estado, 
                videoUrl: videoUrl 
            }
        };
        
        // Guardar en array global y renderizar
        if (!window.BaseDatosLotes) window.BaseDatosLotes = [];
        window.BaseDatosLotes.push(nuevoPin);
        
        try {
            visor360.addHotSpot(nuevoPin);
            window.BaseDatosLotes.push(nuevoPin);
            if (typeof window.arq2_recalcAllPolygonStatuses === 'function') window.arq2_recalcAllPolygonStatuses();
            if (typeof window.saveToLocal === 'function') window.saveToLocal();
        } catch(e) {}
        
        return;
    }
    
    let p = parseFloat(coords[0].toFixed(3)), y = parseFloat(coords[1].toFixed(3));
    // Snap on click ONLY for costura, calle-curva, and lote-libre (street edges only).
    // For lote-libre: only snap when the snap target is a street (aligns lot to calle inner border).
    // For other polygon tools: no snap (prevents floating from street interpolation point corruption).
    const snapLine = arq2CosturaSnap?.lineId ? allDrawnLines.find(l => l.id === arq2CosturaSnap.lineId) : null;
    const isStreetEdge = snapLine && (snapLine.tipo === 'calle-curva-arq2' || snapLine.tipo === 'calle' || snapLine.tipo === 'calle-curva-arq2-preview');
    const shouldApplySnap = arq2CosturaSnap && (
        arq2Tool === 'costura' ||
        arq2Tool === 'calle-curva-arq2' ||
        arq2CosturaSnap.kind === 'calle-close' ||
        (arq2Tool === 'lote-libre' && isStreetEdge)
    );
    if (shouldApplySnap) {
        p = parseFloat(arq2CosturaSnap.pitch.toFixed(3));
        y = parseFloat(arq2CosturaSnap.yaw.toFixed(3));
    }

    // === FILA SOBRE CALLE: intercept click to select street border ===
    if (arq2Tool === 'fila-calle') {
        const hit = arq2_findNearestStreetBorderPY(p, y);
        if (hit) {
            const depthEl = document.getElementById('arq2-fila-calle-depth');
            arq2FilaCalle = {
                streetId: hit.streetId,
                side: hit.side,
                borderPts: hit.borderPts,
                depthFactor: depthEl ? parseFloat(depthEl.value) || 30 : 30
            };
            arq2_updateFilaCallePreview();
            arq2_updatePanelStep();
            arq2_setStatusText('Borde de calle seleccionado ✓  — Ajusta la profundidad y haz clic en «Definir Lotes».');
        } else {
            arq2_setStatusText('⚠ Haz clic directamente sobre el borde interior de una calle dibujada.');
        }
        return;
    }

    if (arq2Tool === 'costura' && arq2LinePoints.length === 0 && !arq2CosturaSnap) {
        const selId = findClosestLineAtScreen(mock.clientX, mock.clientY, 28);
        const sel = selId && allDrawnLines.find(l => l.id === selId);
        // Select ANY costura lot (with or without sharedSegs) so user can change its style
        if (sel && (sel.tipo === 'lote-organico' || sel.tipo === 'fila-variable-lote') &&
            (sel.costuraEstilo || sel.costuraStyle || sel.sharedSegs?.length)) {
            arq2_selectCosturaLine(selId);
            return;
        }
    }

    // === POLYGON CLOSE: detect loop close (lote-libre, fila-variable, calle-curva) ===
    const isPolygonTool = arq2Tool === 'lote-libre' || arq2Tool === 'fila-variable' || arq2Tool === 'calle-curva-arq2';
    if (isPolygonTool && arq2LinePoints.length >= 3 && canTriggerPolygonAutoClose()) {
        const origin = arq2LinePoints[0];
        const isNearOrigin = isNearPolygonOriginPY(p, y, origin);
        if (isNearOrigin) {
            if (arq2Tool === 'calle-curva-arq2') {
                arq2LinePoints.push([...origin]);
                lastArq2DrawClickMs = Date.now();
                arq2_finishCalleCurva();
            } else if (arq2Tool === 'fila-variable') {
                lastArq2DrawClickMs = Date.now();
                arq2_finishFilaContour();
            } else {
                lastArq2DrawClickMs = Date.now();
                arq2_finishLoteOrganico([...arq2LinePoints], false);
            }
            return;
        }
    }

    if (arq2Tool === 'fila-variable' && arq2LinePoints.length === 0) arq2_stopDemoAnimation();
    arq2SelectedLineId = null;
    document.querySelectorAll('.arq2-costura-selected').forEach(g => g.classList.remove('arq2-costura-selected'));
    arq2LinePoints.push([p, y]);
    arq2_updateGuideline();
    lastArq2DrawClickMs = Date.now();
    arq2_refreshFeedbackVisuals(mock);
    refreshAllHotspots(true);
    syncSVGElements();
    updateSVGPaths();
}
function arq2_onEnterKey() {
    if (!isArquitecto2Active) return false;
    if (arq2Tool === 'calle-curva-arq2' && arq2LinePoints.length >= 2) {
        arq2_finishCalleCurva();
        return true;
    }
    if (arq2Tool === 'fila-variable' && arq2LinePoints.length >= 4) {
        arq2_finishFilaContour();
        return true;
    }
    // Costura with 2+ points: create a straight dashed dividing line (not polygon close)
    if (arq2Tool === 'costura' && arq2LinePoints.length >= 2) {
        arq2_finishLoteOrganico([...arq2LinePoints], true);
        return true;
    }
    if (arq2Tool !== 'fila-variable' && arq2Tool !== 'calle-curva-arq2' && arq2LinePoints.length >= 3) {
        arq2_finishLoteOrganico([...arq2LinePoints], arq2Tool === 'costura');
        return true;
    }
    return false;
}

function arq2_setup() {
    document.getElementById('arq2-panel-close')?.addEventListener('click', () => arq2_toggleArquitecto2(false));
    document.querySelectorAll('.arq2-tool-btn').forEach(btn => btn.addEventListener('click', () => arq2_setTool(btn.dataset.arq2Tool)));
    ['arq2-panel', 'franja-lotes-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('mousedown', e => e.stopPropagation());
        el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    });
    document.getElementById('arq2-smooth-toggle')?.addEventListener('change', (e) => {
        arq2SmoothCurves = !!e.target.checked;
        arq2SmoothIntensity = arq2SmoothCurves ? Math.max(1, arq2SmoothIntensity || 5) : 0;
        arq2_syncSmoothIntensityUI();
        arq2_updatePanelStep();
    });
    arq2_ensureSmoothIntensityPanel();
    document.getElementById('arq2-lote-libre-hide-streets')?.addEventListener('change', () => {
        refreshAllHotspots(true);
    });
    document.getElementById('arq2-costura-punteada')?.addEventListener('click', () => {
        arq2CosturaStyle = 'punteada';
        if (arq2SelectedLineId) {
            const sel = allDrawnLines.find(l => l.id === arq2SelectedLineId);
            if (sel) { sel.costuraEstilo = 'punteada'; sel.costuraStyle = 'punteada'; }
            arq2_setCosturaStyleForLine(arq2SelectedLineId, 'punteada');
        }
        arq2_updatePanelStep();
        updateSVGPaths();
        saveToLocal();
    });
    document.getElementById('arq2-costura-solida')?.addEventListener('click', () => {
        arq2CosturaStyle = 'solida';
        if (arq2SelectedLineId) {
            const sel = allDrawnLines.find(l => l.id === arq2SelectedLineId);
            if (sel) { sel.costuraEstilo = 'solida'; sel.costuraStyle = 'solida'; }
            arq2_setCosturaStyleForLine(arq2SelectedLineId, 'solida');
        }
        arq2_updatePanelStep();
        updateSVGPaths();
        saveToLocal();
    });
    document.getElementById('arq2-costura-toggle-selected')?.addEventListener('click', arq2_toggleSelectedCosturaStyle);
    document.getElementById('arq2-fila-demo-replay')?.addEventListener('click', () => arq2_startDemoAnimation(true));
    arq2_ensurePanelExtras();
    arq2_ensureSmoothIntensityPanel();
    arq2_updatePanelStep();
}

function shouldClosePolygonLine(lineId, lineData) {
    if (!lineData) return false;
    if (lineData.tipo === 'calle' || lineData.tipo === 'cortar' || lineData.tipo === 'calle-curva-arq2' || lineData.tipo === 'calle-curva-arq2-preview' || lineData.tipo === 'divisoria' || lineData.tipo === 'borde-macro' || lineData.tipo === 'arista_solida' || lineData.tipo === 'arista_punteada') return false;
    if (lineData.tipo === 'franja-preview-div' || lineData.tipo === 'linea-pines-guia') return false;
    if (lineId === currentTempLineId || lineId === lineaPinesTempId || lineId === arq2TempLineId) return false;
    if (lineData.tipo === 'lote-organico-preview') return false;
    if (lineData.tipo === 'franja-preview') return lineId === 'franja_preview_quad' || lineId === 'franja_curva_preview_strip';
    if (lineData.tipo === 'franja-curva-grupo') return true;
    if (lineData.tipo === 'lote-organico' || lineData.tipo === 'fila-variable-lote') return true;
    return true;
}

// --- MOTOR GEOMÉTRICO FRANJA CURVA ---
function getPolylineLength(pts) { let len = 0; for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]); return len; }
function getPointAlongPolyline(pts, t) {
    if (!pts || pts.length < 2) return pts?.[0] ? [...pts[0]] : null;
    if (t <= 0) return [...pts[0]]; if (t >= 1) return [...pts[pts.length - 1]];
    const totalLen = getPolylineLength(pts);
    if (totalLen < 1e-8) return [...pts[0]];
    const target = totalLen * t; let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]);
        if (d < 1e-10) continue;
        if (acc + d >= target) { const segT = (target - acc) / d; return [pts[i][0] + (pts[i+1][0] - pts[i][0]) * segT, pts[i][1] + (pts[i+1][1] - pts[i][1]) * segT]; }
        acc += d;
    }
    return [...pts[pts.length - 1]];
}
function extractPolylineSegment(pts, tStart, tEnd) {
    const len = getPolylineLength(pts), dStart = len * tStart, dEnd = len * tEnd, res = [getPointAlongPolyline(pts, tStart)];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const d = Math.hypot(pts[i+1][0] - pts[i][0], pts[i+1][1] - pts[i][1]);
        if (acc + d > dStart && acc < dEnd) res.push([...pts[i+1]]);
        acc += d;
    }
    res.push(getPointAlongPolyline(pts, tEnd));
    return res;
}