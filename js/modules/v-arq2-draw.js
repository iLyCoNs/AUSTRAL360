function arq2_finishLoteOrganico(rawPoints, useCostura) {
    const minPts = useCostura ? 2 : 3;
    if (!rawPoints || rawPoints.length < minPts) return;
    // Snap vertices to existing neighbor polygons for both costura and standard lote-libre
    // so they align perfectly without gaps or overlaps
    let snappedRaw = arq2_snapVerticesToExisting(rawPoints);
    
    // FIX: Calco Perfecto (Lote Libre se une automáticamente a la curva de la calle).
    // Si dos vértices consecutivos de este lote fueron anclados (snapped) al mismo borde de la misma calle,
    // rellenamos el espacio con todos los puntos intermedios de esa curva de calle para crear un empalme perfecto.
    if (!useCostura && snappedRaw.length >= 3) {
        let tracedPoints = [];
        for (let i = 0; i < snappedRaw.length; i++) {
            let curr = snappedRaw[i];
            let next = snappedRaw[(i + 1) % snappedRaw.length];
            tracedPoints.push(curr);
            
            let snap1 = curr[2];
            let snap2 = next[2];
            
            if (snap1 && snap2 && snap1.lineId === snap2.lineId && snap1.edgeType === snap2.edgeType) {
                const street = allDrawnLines.find(l => l.id === snap1.lineId);
                if (street) {
                    const edgePts = snap1.edgeType === 'left' ? street.left : (snap1.edgeType === 'right' ? street.right : street.puntosSuavizados);
                    if (edgePts && edgePts.length > 0) {
                        let idx1 = snap1.pointIndex;
                        let idx2 = snap2.pointIndex;
                        let step = idx2 > idx1 ? 1 : -1;
                        // Insertar puntos intermedios de la curva
                        for (let j = idx1 + step; j !== idx2; j += step) {
                            if (edgePts[j]) {
                                tracedPoints.push([edgePts[j][0], edgePts[j][1], { ...snap1, pointIndex: j }]);
                            }
                        }
                    }
                }
            }
        }
        snappedRaw = tracedPoints;
    }
    
    const anchors = snappedRaw.map(p => [...p]);
    const smoothIntensity = arq2SmoothIntensity;
    let smoothed;

    // Special case: costura = dividing line — try to split parent lot first
    if (useCostura && snappedRaw.length >= 2) {
        const splitOK = arq2_trySplitParentLote(snappedRaw);
        // Always save the dashed dividing line (visible separator on top of the two new lots)
        const id = 'arq2_org_' + Date.now();
        const costuraEstiloGuardado = arq2CosturaStyle || 'punteada';
        const entry = {
            id, tipo: 'lote-organico',
            puntos: snappedRaw.map(p => [...p]),
            ejeOriginal: arq2LinePoints.map(p => [...p]),
            sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {},
            costuraStyle: costuraEstiloGuardado,
            costuraEstilo: costuraEstiloGuardado,
            esDivisoria: true
        };
        allDrawnLines.push(entry);
        arq2_clearDraft();
        refreshAllHotspots(true);
        saveToLocal();
        flashScreenSuccess();
        arq2_setStatusText(splitOK ? 'Lote subdividido ✓' : 'Línea divisoria guardada ✓');
        return;
    }

    // For costura with 3+ points: clip to parent lot boundary before saving
    if (useCostura) {
        // For costura (internal subdivisions): keep anchor points exact, minimal smoothing
        smoothed = arq2_adaptiveSmooth(snappedRaw, null, Math.min(smoothIntensity, 2));
        smoothed = arq2_restoreAnchoredVertices(smoothed, anchors, 0.04);
        // Clip: any vertex that escaped the parent lot boundary is projected back onto it
        smoothed = arq2_clipCosturaToParent(smoothed);

    } else {

        smoothed = arq2_adaptiveSmooth(snappedRaw, null, smoothIntensity);
        smoothed = arq2_restoreAnchoredVertices(smoothed, anchors, 0.08);
    }
    smoothed = arq2_sanitizePolylinePoints(smoothed);
    if (smoothed.length < 3) return;
    const id = 'arq2_org_' + Date.now();
    const costuraEstiloGuardado = useCostura ? (arq2CosturaStyle || 'punteada') : null;
    const entry = { id, tipo: 'lote-organico', puntos: smoothed, ejeOriginal: arq2LinePoints.map(p => [...p]), sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {}, suavizadoIntensidad: smoothIntensity };
    if (useCostura) {
        entry.costuraStyle = costuraEstiloGuardado;
        entry.costuraEstilo = costuraEstiloGuardado;
    }
    if (!arq2_applyAutoFill(entry)) return;
    allDrawnLines.push(entry);
    // Register shared edges so adjacent lots (costura and standard lote-libre)
    // automatically find their shared boundaries and style them as single dashed lines.
    arq2_registerSharedEdges(id);
    const areaPx = arq2_estimatePolygonScreenAreaPx(smoothed);
    if (areaPx < 40) arq2_showSmallShapeSmoothHint(id);
    arq2_clearDraft();
    refreshAllHotspots(true);
    saveToLocal();
    flashScreenSuccess();
    arq2_setStatusText('Lote ' + entry.arq2Numero + ' guardado ✓');
}

function arq2_shouldAutoCloseAt(p, y, isDblClick) {
    const pts = arq2_getActiveDrawPoints();
    // Costura can close with 2 points (forming a line that divides a lot)
    const minPts = arq2Tool === 'fila-variable' ? 4 : (arq2Tool === 'costura' ? 2 : 3);
    if (pts.length < minPts) return false;
    if (!isNearPolygonOriginPY(p, y, pts[0])) return false;
    return isDblClick || canTriggerPolygonAutoClose();
}
function arq2_tryClosePolygon(isDblClick, p, y) {
    if (arq2Tool === 'calle-curva-arq2') return false;
    const pts = arq2LinePoints;
    const minPts = arq2Tool === 'fila-variable' ? 4 : (arq2Tool === 'costura' ? 2 : 3);
    if (pts.length < minPts) return false;
    if (p == null || y == null) return false;
    if (!arq2_shouldAutoCloseAt(p, y, isDblClick)) return false;
    if (arq2Tool === 'fila-variable') arq2_finishFilaContour();
    else arq2_finishLoteOrganico([...pts], arq2Tool === 'costura');
    return true;
}
// =========================================================
// FASE 1 — FILA SOBRE CALLE (Fila Variable Radial)
// =========================================================

/**
 * Given a pitch/yaw click point, find the nearest street border (left or right)
 * within tolerance and return { streetId, side, borderPts }.
 */
function arq2_findNearestStreetBorderPY(pitch, yaw) {
    const proj = getPanoramaScreenProjector();
    if (!proj) return null;
    const clickScreen = proj.toScreen(pitch, yaw);
    if (!clickScreen) return null;
    const [csx, csy] = clickScreen;
    const TOL_PX = 40; // pixels on screen
    let bestDist = TOL_PX;
    let best = null;
    for (const street of allDrawnLines) {
        if (street.tipo !== 'calle-curva-arq2') continue;
        for (const side of ['left', 'right']) {
            const border = street[side];
            if (!border || border.length < 2) continue;
            // Find closest point on this polyline to the click
            for (let i = 0; i < border.length - 1; i++) {
                const s1 = proj.toScreen(border[i][0], border[i][1]);
                const s2 = proj.toScreen(border[i+1][0], border[i+1][1]);
                if (!s1 || !s2) continue;
                // Distance from click to segment s1→s2
                const dx = s2[0]-s1[0], dy = s2[1]-s1[1];
                const lenSq = dx*dx + dy*dy;
                let t = lenSq > 0 ? ((csx-s1[0])*dx + (csy-s1[1])*dy) / lenSq : 0;
                t = Math.max(0, Math.min(1, t));
                const px = s1[0]+t*dx, py = s1[1]+t*dy;
                const d = Math.hypot(csx-px, csy-py);
                if (d < bestDist) {
                    bestDist = d;
                    best = { streetId: street.id, side, borderPts: border.map(p => [...p]) };
                }
            }
        }
    }
    return best;
}

/**
 * Given a border polyline in PY space and a depth factor (in pitch/yaw units,
 * scaled from meters by the current camera projection), generate the inward
 * perpendicular offset (ejeFondo).
 * 
 * depthFactor here is a "virtual depth" from 5 to 120; we convert it to PY 
 * degrees using a rough scale of 0.003 deg/meter (tuneable).
 */
function arq2_projectBorderInward(borderPts, depthFactor) {
    const proj = getPanoramaScreenProjector();
    if (!proj || !borderPts || borderPts.length < 2) return null;
    // Convert depthFactor (meters) to screen pixels using current camera
    // We use 2.5px per meter as a reasonable default for typical field of view
    const PX_PER_METER = 2.5;
    const depthPx = depthFactor * PX_PER_METER;
    const fondoPts = [];
    for (let i = 0; i < borderPts.length; i++) {
        const cur = borderPts[i];
        // Compute tangent direction along the border
        const prev = borderPts[Math.max(0, i-1)];
        const next = borderPts[Math.min(borderPts.length-1, i+1)];
        const sCur = proj.toScreen(cur[0], cur[1]);
        const sPrev = proj.toScreen(prev[0], prev[1]);
        const sNext = proj.toScreen(next[0], next[1]);
        if (!sCur || !sPrev || !sNext) continue;
        // Tangent in screen space
        let tx = sNext[0] - sPrev[0], ty = sNext[1] - sPrev[1];
        const tlen = Math.hypot(tx, ty);
        if (tlen < 0.01) continue;
        tx /= tlen; ty /= tlen;
        // Normal (perpendicular, pointing inward — we'll pick the right direction later)
        let nx = -ty, ny = tx;
        // Inward offset in screen space
        const sx = sCur[0] + nx * depthPx;
        const sy = sCur[1] + ny * depthPx;
        const fondoPY = proj.toPY(sx, sy);
        if (fondoPY) fondoPts.push([parseFloat(fondoPY[0].toFixed(4)), parseFloat(fondoPY[1].toFixed(4))]);
    }
    if (fondoPts.length < 2) return null;
    // Ensure fondo goes in a consistent direction relative to the border
    // (it might be mirrored; the calling code handles orientation via arq2_validatePolylineDirection)
    return fondoPts;
}

/**
 * Build the closed contour polygon for fila-calle:
 * [border[0], border[1..n-1], fondo[n-1..0]]
 */
function arq2_buildFilaCalleContorno(borderPts, fondoPts) {
    if (!borderPts || !fondoPts || borderPts.length < 2 || fondoPts.length < 2) return null;
    // Combine: go along border left→right, then fondo right→left to close
    const contorno = [...borderPts, ...[...fondoPts].reverse()];
    return arq2_sanitizePolylinePoints(contorno);
}

/**
 * Recompute the contorno from current arq2FilaCalle state and store it.
 * Returns the contorno if successful, null otherwise.
 */
function arq2_computeFilaCalleContorno() {
    if (!arq2FilaCalle?.borderPts) return null;
    const fondo = arq2_projectBorderInward(arq2FilaCalle.borderPts, arq2FilaCalle.depthFactor);
    if (!fondo) return null;
    const contorno = arq2_buildFilaCalleContorno(arq2FilaCalle.borderPts, fondo);
    if (!contorno || contorno.length < 4) return null;
    arq2FilaCalle.contorno = contorno;
    arq2FilaCalle.ejeFondo = fondo;
    return contorno;
}

/**
 * Update the SVG preview: highlight the selected border in cyan, draw the
 * projected contorno polygon in green.
 */
function arq2_updateFilaCallePreview() {
    const svg = document.getElementById('loteo-svg');
    // Remove old preview elements
    document.getElementById('arq2-fila-calle-preview')?.remove();
    if (!svg || !arq2FilaCalle?.borderPts || arq2Tool !== 'fila-calle') return;
    const proj = getPanoramaScreenProjector();
    if (!proj) return;
    const ctx = arq2_getCameraContext();
    if (!ctx) return;
    const { getCam, cx, cy_screen: cySc, f } = ctx;
    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.id = 'arq2-fila-calle-preview';
    g.style.pointerEvents = 'none';
    // Draw highlighted border
    const dBorder = arq2_projectOpenPolylineD(arq2FilaCalle.borderPts, getCam, cx, cySc, f);
    if (dBorder) {
        const borderPath = document.createElementNS(ns, 'path');
        borderPath.setAttribute('d', dBorder);
        borderPath.setAttribute('fill', 'none');
        borderPath.setAttribute('stroke', '#06b6d4');
        borderPath.setAttribute('stroke-width', '4');
        borderPath.setAttribute('stroke-dasharray', 'none');
        borderPath.style.opacity = '0.9';
        g.appendChild(borderPath);
    }
    // Draw projected contorno if available
    const contorno = arq2_computeFilaCalleContorno();
    if (contorno && contorno.length >= 4) {
        const dContorno = arq2_projectPolylineD(contorno, true, getCam, cx, cySc, f);
        if (dContorno) {
            const fillPath = document.createElementNS(ns, 'path');
            fillPath.setAttribute('d', dContorno);
            fillPath.setAttribute('fill', 'rgba(16,185,129,0.12)');
            fillPath.setAttribute('stroke', '#10b981');
            fillPath.setAttribute('stroke-width', '2');
            fillPath.setAttribute('stroke-dasharray', '5,4');
            g.appendChild(fillPath);
        }
    }
    svg.appendChild(g);
}

/**
 * Commit the fila-calle lot row using the selected border and depth.
 * Uses arq2_commitFilaVariable internally.
 */
function arq2_commitFilaCalle(weights) {
    if (!arq2FilaCalle?.borderPts) {
        alert('⚠ Selecciona primero el borde de una calle.');
        return;
    }
    const contorno = arq2_computeFilaCalleContorno();
    if (!contorno || contorno.length < 4) {
        alert('⚠ No se pudo proyectar la profundidad. Ajusta la vista o elige otro borde.');
        return;
    }
    // Temporarily set arq2PendingFila so arq2_commitFilaVariable can work
    arq2PendingFila = { contorno };
    arq2_commitFilaVariable(weights);
    // arq2_commitFilaVariable calls arq2_clearDraft internally via arq2PendingFila = null
    arq2FilaCalle = null;
    arq2_updateFilaCallePreview();
}

/**
 * Set up slider/confirm/cancel listeners for fila-calle panel.
 * Only called once per tool activation (idempotent via data attribute).
 */
function arq2_setupFilaCalleListeners() {
    const depthSlider = document.getElementById('arq2-fila-calle-depth');
    const depthVal = document.getElementById('arq2-fila-calle-depth-val');
    const confirmBtn = document.getElementById('arq2-fila-calle-confirm');
    const cancelBtn = document.getElementById('arq2-fila-calle-cancel');
    if (depthSlider && !depthSlider.dataset.filaCalleReady) {
        depthSlider.dataset.filaCalleReady = '1';
        depthSlider.addEventListener('input', () => {
            const v = parseFloat(depthSlider.value) || 30;
            if (depthVal) depthVal.textContent = v;
            if (arq2FilaCalle) {
                arq2FilaCalle.depthFactor = v;
                arq2_updateFilaCallePreview();
            }
        });
    }
    if (confirmBtn && !confirmBtn.dataset.filaCalleReady) {
        confirmBtn.dataset.filaCalleReady = '1';
        confirmBtn.addEventListener('click', () => {
            if (!arq2FilaCalle?.borderPts) return;
            const contorno = arq2_computeFilaCalleContorno();
            if (!contorno || contorno.length < 4) {
                arq2_setStatusText('⚠ No se pudo proyectar el polígono. Ajusta la profundidad.');
                return;
            }
            arq2PendingFila = { contorno };
            openFranjaLotesModal(4, (weights) => {
                arq2_commitFilaCalle(weights);
            });
            arq2_updatePanelStep();
        });
    }
    if (cancelBtn && !cancelBtn.dataset.filaCalleReady) {
        cancelBtn.dataset.filaCalleReady = '1';
        cancelBtn.addEventListener('click', () => {
            arq2FilaCalle = null;
            arq2_updateFilaCallePreview();
            arq2_updatePanelStep();
            arq2_setStatusText('Selección cancelada — haz clic en el borde de una calle.');
        });
    }
}

function arq2_commitFilaVariable(weights) {

    if (!arq2PendingFila?.contorno || !weights?.length) return;
    const contorno = arq2_sanitizePolylinePoints(arq2PendingFila.contorno);
    if (contorno.length < 4) {
        alert('No se pudo generar la fila. Intenta con un contorno más simple (4-6 puntos) y vuelve a intentar.');
        return;
    }
    
    // Si el usuario dibujó exactamente 4 vértices (como el Lote Libre tradicional o Franja original),
    // interceptamos y generamos la herramienta Franja original (franja-grupo) 
    // que tiene subdivisiones rectas, paralelas y permite arrastrar sus esquinas de color verde.
    if (contorno.length === 4) {
        const axes = arq2_detectEjeYFondo(contorno);
        if (axes) {
            const { ejeFrente, ejeFondo } = axes;
            if (ejeFrente.length >= 2 && ejeFondo.length >= 2) {
                const wInput = document.getElementById('arq2-fila-calle-m2');
                let N = parseInt(wInput?.value, 10) || weights.length;
                if (N <= 0 || N > 200) N = weights.length;
                const newWeights = Array(N).fill(1);
                const splits = weightsToFranjaSplits(newWeights);
                
                const topPts = []; topPts[0] = ejeFrente[0]; topPts[N] = ejeFrente[ejeFrente.length - 1];
                const botPts = []; botPts[0] = ejeFondo[0]; botPts[N] = ejeFondo[ejeFondo.length - 1];
                
                // finalizeNewFranja creates the old draggable franja-grupo
                const gid = finalizeNewFranja(topPts, botPts, N, null, splits);
                if (gid) {
                    arq2PendingFila = null;
                    arq2FilaVariableContorno = null;
                    arq2_clearDraft();
                    syncSVGElements();
                    refreshAllHotspots(true);
                    saveToLocal();
                    flashScreenSuccess();
                    arq2_setStatusText('Franja Lotes creada con éxito ✓');
                    return;
                }
            }
        }
    }
    const axes = arq2_detectEjeYFondo(contorno);
    if (!axes) { alert('⚠ No se pudo detectar frente y fondo del contorno. Usa al menos 4 vértices bien definidos.'); return; }
    const { ejeFrente, ejeFondo } = axes;
    const frontLen = getPolylineLength(ejeFrente), backLen = getPolylineLength(ejeFondo);
    if (frontLen < 1e-6 || backLen < 1e-6) {
        console.warn('[Fila Variable] Ejes con longitud cero', { ejeFrente, ejeFondo, contorno });
        alert('No se pudo generar la fila. Intenta con un contorno más simple (4-6 puntos) y vuelve a intentar.');
        return;
    }
    const divs = arq2_buildFilaInternalDivisions(ejeFrente, ejeFondo, weights);
    const lotCentroids = arq2_computeFilaLotCentroids(ejeFrente, ejeFondo, weights);
    if (contorno.length < 3 || !lotCentroids.length) {
        alert('No se pudo generar la fila. Intenta con un contorno más simple (4-6 puntos) y vuelve a intentar.');
        return;
    }
    const gid = 'arq2_fila_' + Date.now();
    allDrawnLines.push({
        id: gid,
        tipo: 'fila-variable-lote',
        puntos: contorno.map(p => [...p]),
        arq2Grupo: gid,
        arq2FilaLotes: lotCentroids,
        ejeFrente: ejeFrente.map(p => [...p]),
        ejeFondo: ejeFondo.map(p => [...p]),
        sharedSegs: [],
        sharedSegStyles: {},
        loteStatus: 'disponible'
    });
    divs.forEach((pts, idx) => {
        if (!pts?.length || !arq2_isValidPYPoint(pts[0]) || !arq2_isValidPYPoint(pts[1])) return;
        allDrawnLines.push({ id: gid + '_div_' + (idx + 1), tipo: 'divisoria', puntos: pts, arq2Grupo: gid, franjaGrupo: gid });
    });
    arq2_registerSharedEdges(gid);
    arq2_mergeSharedBoundaryVertices(gid);
    arq2PendingFila = null;
    arq2FilaVariableContorno = null;
    arq2_clearDraft();
    syncSVGElements();
    refreshAllHotspots(true);
    saveToLocal();
    flashScreenSuccess();
    arq2_setStatusText('Hilera variable: ' + weights.length + ' lotes — un contorno + ' + divs.length + ' divisiones ✓');
}
function arq2_updateGuideline() {
    if (arq2LinePoints.length === 0) {
        arq2Guideline = null;
        return;
    }
    const lastPt = arq2LinePoints[arq2LinePoints.length - 1];
    const tol = 0.08;
    const streets = allDrawnLines.filter(l => l.tipo === 'calle-curva-arq2');
    for (let street of streets) {
        const leftProj = arq2_projectPointOnPolyline(lastPt, street.left);
        const rightProj = arq2_projectPointOnPolyline(lastPt, street.right);
        
        let border = null, proj = null;
        if (leftProj && leftProj.dist < tol) {
            border = street.left;
            proj = leftProj;
        } else if (rightProj && rightProj.dist < tol) {
            border = street.right;
            proj = rightProj;
        }
        
        if (border && proj) {
            const idx = proj.idx;
            const p1 = border[idx], p2 = border[idx + 1];
            let dx = p2[0] - p1[0];
            let dy = p2[1] - p1[1];
            let len = Math.hypot(dx, dy);
            if (len > 1e-6) {
                let nx = -dy / len;
                let ny = dx / len;
                const otherBorder = border === street.left ? street.right : street.left;
                const midOther = getPointAlongPolyline(otherBorder, 0.5);
                const dPlus = Math.hypot(lastPt[0] + nx * 0.1 - midOther[0], lastPt[1] + ny * 0.1 - midOther[1]);
                const dMinus = Math.hypot(lastPt[0] - nx * 0.1 - midOther[0], lastPt[1] - ny * 0.1 - midOther[1]);
                if (dPlus > dMinus) {
                    nx = -nx;
                    ny = -ny;
                }
                arq2Guideline = {
                    start: [...lastPt],
                    dir: [nx, ny]
                };
                return;
            }
        }
    }
    arq2Guideline = null;
}