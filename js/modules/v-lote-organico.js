function arq2_getCalleBorders(line) {
    if (!line) return { left: [], right: [] };
    
    if (typeof getCalleHalfWidthPx === 'function' && typeof arq2_offsetSplinePath === 'function') {
        if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
            const halfWidthPx = getCalleHalfWidthPx(line.ancho);
            const isClosed = line.ejeIsClosed || false;
            const eje = line.puntosSuavizados || line.puntos || [];
            let ejeLoop = eje;
            if (isClosed && eje.length > 0 && Math.hypot(eje[0][0]-eje[eje.length-1][0], eje[0][1]-eje[eje.length-1][1]) < 0.05) {
                ejeLoop = eje.slice(0, -1);
            }
            const offset = arq2_offsetSplinePath(ejeLoop, halfWidthPx, line.calleRetorno || false, isClosed);
            if (offset && offset.left && offset.right) return offset;
        }
        if (line.tipo === 'calle') {
            const halfWidthPx = getCalleHalfWidthPx(line.calleAncho);
            const offset = arq2_offsetSplinePath(line.puntos, halfWidthPx, false, false);
            if (offset && offset.left && offset.right) return offset;
        }
    }
    
    if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
        return { left: line.left || [], right: line.right || [] };
    }
    return { left: line.puntos || [], right: line.puntos || [] };
}
function arq2_getSnapPolylinePoints(line) {
    if (!line) return [];
    if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview' || line.tipo === 'calle') {
        const borders = arq2_getCalleBorders(line);
        const pts = [];
        if (borders.left?.length) pts.push(...borders.left);
        if (borders.right?.length) pts.push(...borders.right);
        return pts;
    }
    if (line.tipo === 'franja-curva-grupo') {
        const pts = [];
        if (line.frente?.length) pts.push(...line.frente);
        if (line.fondo?.length) pts.push(...line.fondo);
        return pts;
    }
    return line.puntos || [];
}
function arq2_isUniversalSnapTarget(line) {
    if (!line || line.tipo === 'divisoria' || line.tipo === 'cortar' || line.tipo === 'linea-pines-guia') return false;
    if (line.tipo === 'franja-preview' || line.tipo === 'franja-preview-div') return false;
    return arq2_getSnapPolylinePoints(line).length >= 2;
}
function arq2_isLineClosedForSnap(line) {
    if (line.tipo === 'calle' || line.tipo === 'cortar' || line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') return false;
    const pts = arq2_getSewPolygonPoints(line);
    return pts.length >= 3;
}
function arq2_findNearestEdgeOrVertex(screenX, screenY, excludeLineId, radiusPx = 7) {
    if (arq2Tool === 'calle-curva-arq2' && document.getElementById('arq2-calle-no-snap')?.checked) return null;
    const proj = getPanoramaScreenProjector();
    if (!proj) return null;
    const sx = screenX - DOMCache.viewport.left, sy = screenY - DOMCache.viewport.top;
    // Use only the provided radius (no forced minimum) so snap isn't too aggressive in tight areas
    const effectiveRadius = radiusPx;
    let best = null, bestD = effectiveRadius;

    const tryPt = (pitch, yaw, meta) => {
        const sc = proj.toScreen(pitch, yaw);
        if (!sc) return;
        const d = Math.hypot(sc[0] - sx, sc[1] - sy);
        if (d < bestD) { bestD = d; best = { pitch, yaw, screenX: DOMCache.viewport.left + sc[0], screenY: DOMCache.viewport.top + sc[1], ...meta }; }
    };
    allDrawnLines.forEach(line => {
        if (line.id === excludeLineId || !arq2_isUniversalSnapTarget(line)) return;
        // When drawing a street, ONLY snap to other street edges - NOT to lote polygon vertices
        // (snapping to lot vertices causes the street path to jump/hook unexpectedly)
        const isDrawingStreet = arq2Tool === 'calle-curva-arq2';
        if (isDrawingStreet && line.tipo !== 'calle-curva-arq2' && line.tipo !== 'calle-curva-arq2-preview' && line.tipo !== 'calle') return;

        if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview' || line.tipo === 'calle') {
            const borders = arq2_getCalleBorders(line);
            const polylines = [borders.left || [], borders.right || []];
            polylines.forEach((poly, polyIdx) => {
                if (poly.length < 2) return;
                poly.forEach((pt, vi) => tryPt(pt[0], pt[1], { lineId: line.id, kind: 'vertex', vertexIdx: vi, side: polyIdx === 0 ? 'left' : 'right' }));
                const segCount = poly.length - 1;
                for (let i = 0; i < segCount; i++) {
                    const p1 = poly[i], p2 = poly[i + 1];
                    const s1 = proj.toScreen(p1[0], p1[1]), s2 = proj.toScreen(p2[0], p2[1]);
                    if (!s1 || !s2) continue;
                    const dx = s2[0] - s1[0], dy = s2[1] - s1[1], len2 = dx * dx + dy * dy;
                    if (len2 < 1e-6) continue;
                    let t = ((sx - s1[0]) * dx + (sy - s1[1]) * dy) / len2;
                    t = Math.max(0, Math.min(1, t));
                    const px = s1[0] + t * dx, py = s1[1] + t * dy;
                    const d = Math.hypot(px - sx, py - sy);
                    if (d < bestD) {
                        const pyPt = proj.toPY(px, py);
                        if (pyPt) best = { pitch: pyPt[0], yaw: pyPt[1], screenX: DOMCache.viewport.left + px, screenY: DOMCache.viewport.top + py, lineId: line.id, kind: 'edge', side: polyIdx === 0 ? 'left' : 'right', segIdx: i, t };
                    }
                }
            });
            return;
        }
        const pts = arq2_getSnapPolylinePoints(line);
        pts.forEach((pt, vi) => tryPt(pt[0], pt[1], { lineId: line.id, kind: 'vertex', vertexIdx: vi }));
        const closed = arq2_isLineClosedForSnap(line);
        const segCount = closed ? pts.length : pts.length - 1;
        for (let i = 0; i < segCount; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            const s1 = proj.toScreen(p1[0], p1[1]), s2 = proj.toScreen(p2[0], p2[1]);
            if (!s1 || !s2) continue;
            const dx = s2[0] - s1[0], dy = s2[1] - s1[1], len2 = dx * dx + dy * dy;
            if (len2 < 1e-6) continue;
            let t = ((sx - s1[0]) * dx + (sy - s1[1]) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = s1[0] + t * dx, py = s1[1] + t * dy;
            const d = Math.hypot(px - sx, py - sy);
            if (d < bestD) {
                const pyPt = proj.toPY(px, py);
                if (pyPt) best = { pitch: pyPt[0], yaw: pyPt[1], screenX: DOMCache.viewport.left + px, screenY: DOMCache.viewport.top + py, lineId: line.id, kind: 'edge', segIdx: i, t };
            }
        }
    });
    return best;
}
function arq2_getSewPolygonPoints(line) {
    if (line.tipo === 'franja-curva-grupo' && line.frente?.length >= 2 && line.fondo?.length >= 2) {
        return [...line.frente, ...[...line.fondo].reverse()];
    }
    return line.puntos || [];
}
function arq2_segMatchTol(p1, p2, q1, q2, tol = 0.05) {
    const d11 = Math.hypot(p1[0] - q1[0], p1[1] - q1[1]), d22 = Math.hypot(p2[0] - q2[0], p2[1] - q2[1]);
    const d12 = Math.hypot(p1[0] - q2[0], p1[1] - q2[1]), d21 = Math.hypot(p2[0] - q1[0], p2[1] - q1[1]);
    return (d11 < tol && d22 < tol) || (d12 < tol && d21 < tol);
}
function arq2_segMatchScreenOrPY(p1, p2, q1, q2, proj, tolDeg = 0.08, tolPx = 10) {
    if (arq2_segMatchTol(p1, p2, q1, q2, tolDeg)) return true;
    if (!proj) return false;
    const s1 = proj.toScreen(p1[0], p1[1]), s2 = proj.toScreen(p2[0], p2[1]);
    const t1 = proj.toScreen(q1[0], q1[1]), t2 = proj.toScreen(q2[0], q2[1]);
    if (!s1 || !s2 || !t1 || !t2) return false;
    return (Math.hypot(s1[0] - t1[0], s1[1] - t1[1]) < tolPx && Math.hypot(s2[0] - t2[0], s2[1] - t2[1]) < tolPx)
        || (Math.hypot(s1[0] - t2[0], s1[1] - t2[1]) < tolPx && Math.hypot(s2[0] - t1[0], s2[1] - t1[1]) < tolPx);
}
function arq2_isEdgeSharedWithOrganicLote(p1, p2) {
    const proj = getPanoramaScreenProjector();
    const organicLots = allDrawnLines.filter(l => l.tipo === 'lote-organico' || l.tipo === 'fila-variable-lote');
    for (let lot of organicLots) {
        const pts = lot.puntos;
        if (!pts) continue;
        for (let i = 0; i < pts.length; i++) {
            const q1 = pts[i], q2 = pts[(i + 1) % pts.length];
            if (arq2_segMatchScreenOrPY(p1, p2, q1, q2, proj, 0.08, 12)) {
                return true;
            }
        }
    }
    return false;
}
function arq2_projectPointOnPolyline(p, poly) {
    if (!poly || poly.length < 2) return null;
    let bestDist = Infinity;
    let bestPt = null;
    let bestIdx = -1;
    let bestT = 0;
    for (let i = 0; i < poly.length - 1; i++) {
        const a = poly[i], b = poly[i + 1];
        const proj = projectPointOnSegment(p, a, b);
        const d = Math.hypot(p[0] - proj[0], p[1] - proj[1]);
        if (d < bestDist) {
            bestDist = d;
            bestPt = proj;
            bestIdx = i;
            bestT = projectionT(p, a, b);
            bestT = Math.max(0, Math.min(1, bestT));
        }
    }
    return { dist: bestDist, point: bestPt, idx: bestIdx, t: bestT };
}
function arq2_stitchOrganicLoteToStreets(pts) {
    if (!pts || pts.length < 3) return pts;
    const tol = 0.08; // tolerance in degrees (pitch/yaw) for snapping to street border
    const stitched = [];
    const n = pts.length;
    
    for (let i = 0; i < n; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        
        let matchedStreet = null;
        let matchedBorder = null; // 'left' or 'right'
        let proj1 = null;
        let proj2 = null;
        
        const streets = allDrawnLines.filter(l => l.tipo === 'calle-curva-arq2');
        for (let street of streets) {
            const leftProj = arq2_projectPointOnPolyline(p1, street.left);
            const rightProj = arq2_projectPointOnPolyline(p1, street.right);
            
            if (leftProj && leftProj.dist < tol) {
                const leftProj2 = arq2_projectPointOnPolyline(p2, street.left);
                if (leftProj2 && leftProj2.dist < tol) {
                    matchedStreet = street;
                    matchedBorder = 'left';
                    proj1 = leftProj;
                    proj2 = leftProj2;
                    break;
                }
            }
            if (rightProj && rightProj.dist < tol) {
                const rightProj2 = arq2_projectPointOnPolyline(p2, street.right);
                if (rightProj2 && rightProj2.dist < tol) {
                    matchedStreet = street;
                    matchedBorder = 'right';
                    proj1 = rightProj;
                    proj2 = rightProj2;
                    break;
                }
            }
        }
        
        if (matchedStreet && matchedBorder && proj1 && proj2) {
            const border = matchedBorder === 'left' ? matchedStreet.left : matchedStreet.right;
            const segmentPoints = [];
            
            const idx1 = proj1.idx, idx2 = proj2.idx;
            const t1 = proj1.t, t2 = proj2.t;
            
            segmentPoints.push(proj1.point);
            
            if (idx1 < idx2 || (idx1 === idx2 && t1 < t2)) {
                for (let k = idx1 + 1; k <= idx2; k++) {
                    segmentPoints.push(border[k]);
                }
            } else if (idx1 > idx2 || (idx1 === idx2 && t1 > t2)) {
                for (let k = idx1; k > idx2; k--) {
                    segmentPoints.push(border[k]);
                }
            }
            segmentPoints.push(proj2.point);
            
            for (let k = 0; k < segmentPoints.length - 1; k++) {
                stitched.push(segmentPoints[k]);
            }
        } else {
            stitched.push(p1);
        }
    }
    return stitched;
}
function arq2_insertVerticesIntoMatchingEdges(lineId) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.puntos || line.puntos.length < 3) return;
    const proj = getPanoramaScreenProjector();
    
    allDrawnLines.forEach(other => {
        if (other.id === lineId) return;
        const oPts = arq2_getSewPolygonPoints(other);
        if (!oPts || oPts.length < 3) return;
        if (other.tipo === 'divisoria' || other.tipo === 'cortar' || other.tipo === 'linea-pines-guia') return;
        
        const closed = other.tipo !== 'calle';
        const segCount = closed ? oPts.length : oPts.length - 1;
        
        const insertions = [];
        
        line.puntos.forEach(pt => {
            for (let i = 0; i < segCount; i++) {
                const p1 = oPts[i], p2 = oPts[(i + 1) % oPts.length];
                
                const dToP1 = Math.hypot(pt[0] - p1[0], pt[1] - p1[1]);
                const dToP2 = Math.hypot(pt[0] - p2[0], pt[1] - p2[1]);
                if (dToP1 < 0.02 || dToP2 < 0.02) continue;
                
                let isNear = false;
                let t = 0.5;
                if (proj) {
                    const sPt = proj.toScreen(pt[0], pt[1]);
                    const s1 = proj.toScreen(p1[0], p1[1]);
                    const s2 = proj.toScreen(p2[0], p2[1]);
                    if (sPt && s1 && s2) {
                        const dx = s2[0] - s1[0], dy = s2[1] - s1[1];
                        const len2 = dx * dx + dy * dy;
                        if (len2 > 1e-6) {
                            t = ((sPt[0] - s1[0]) * dx + (sPt[1] - s1[1]) * dy) / len2;
                            if (t > 0.01 && t < 0.99) {
                                const px = s1[0] + t * dx, py = s1[1] + t * dy;
                                const d = Math.hypot(px - sPt[0], py - sPt[1]);
                                if (d < 10) {
                                    isNear = true;
                                }
                            }
                        }
                    }
                } else {
                    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
                    const len2 = dx * dx + dy * dy;
                    if (len2 > 1e-8) {
                        t = ((pt[0] - p1[0]) * dx + (pt[1] - p1[1]) * dy) / len2;
                        if (t > 0.01 && t < 0.99) {
                            const px = p1[0] + t * dx, py = p1[1] + t * dy;
                            const d = Math.hypot(px - pt[0], py - pt[1]);
                            if (d < 0.04) {
                                isNear = true;
                            }
                        }
                    }
                }
                
                if (isNear) {
                    insertions.push({ segIdx: i, pt: [...pt], t });
                    break;
                }
            }
        });
        
        if (insertions.length > 0) {
            insertions.sort((a, b) => {
                if (a.segIdx !== b.segIdx) return b.segIdx - a.segIdx;
                return b.t - a.t;
            });
            insertions.forEach(ins => {
                other.puntos.splice(ins.segIdx + 1, 0, ins.pt);
            });
        }
    });
}
window.arq2_recalcLoteOrganico = function(linea) {
    if (!linea.ejeOriginal) return;
    const smoothIntensity = typeof linea.suavizadoIntensidad !== 'undefined' ? linea.suavizadoIntensidad : (typeof arq2SmoothIntensity !== 'undefined' ? arq2SmoothIntensity : 5);
    const useCostura = !!(linea.costuraEstilo || linea.costuraStyle);
    let smoothed;
    if (useCostura) {
        smoothed = typeof arq2_adaptiveSmooth === 'function' ? arq2_adaptiveSmooth(linea.ejeOriginal, null, Math.min(smoothIntensity, 2)) : linea.ejeOriginal;
        if (typeof arq2_restoreAnchoredVertices === 'function') smoothed = arq2_restoreAnchoredVertices(smoothed, linea.ejeOriginal, 0.04);
        if (typeof arq2_clipCosturaToParent === 'function') smoothed = arq2_clipCosturaToParent(smoothed);
    } else {
        smoothed = typeof arq2_adaptiveSmooth === 'function' ? arq2_adaptiveSmooth(linea.ejeOriginal, null, smoothIntensity) : linea.ejeOriginal;
        if (typeof arq2_restoreAnchoredVertices === 'function') smoothed = arq2_restoreAnchoredVertices(smoothed, linea.ejeOriginal, 0.08);
    }
    if (typeof arq2_sanitizePolylinePoints === 'function') smoothed = arq2_sanitizePolylinePoints(smoothed);
    if (smoothed && smoothed.length >= 3) linea.puntos = smoothed;
};

function arq2_crossInjectVertices(lineId) {
    const nue = allDrawnLines.find(l => l.id === lineId);
    if (!nue || nue.tipo !== 'lote-organico' || !nue.ejeOriginal) return;

    const checkInject = (sourceLot, targetLot) => {
        let mod = false;
        for (let v of sourceLot.ejeOriginal) {
            const n = targetLot.ejeOriginal.length;
            for (let k = 0; k < n; k++) {
                const p1 = targetLot.ejeOriginal[k], p2 = targetLot.ejeOriginal[(k + 1) % n];
                if (Math.hypot(v[0]-p1[0], v[1]-p1[1]) < 1e-3 || Math.hypot(v[0]-p2[0], v[1]-p2[1]) < 1e-3) continue;
                const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
                const len2 = dx * dx + dy * dy;
                if (len2 < 1e-10) continue;
                let t = ((v[0] - p1[0]) * dx + (v[1] - p1[1]) * dy) / len2;
                if (t > 0.001 && t < 0.999) {
                    const projX = p1[0] + t * dx, projY = p1[1] + t * dy;
                    if (Math.hypot(v[0] - projX, v[1] - projY) < 1e-3) {
                        targetLot.ejeOriginal.splice(k + 1, 0, [...v]);
                        mod = true;
                        break;
                    }
                }
            }
        }
        return mod;
    };

    let modifiedNue = false;
    allDrawnLines.forEach(other => {
        if (other.id === nue.id || other.tipo !== 'lote-organico' || !other.ejeOriginal) return;
        
        let modOther = false;
        let loopSafety = 10;
        while(checkInject(nue, other) && loopSafety-- > 0) modOther = true;
        loopSafety = 10;
        while(checkInject(other, nue) && loopSafety-- > 0) modifiedNue = true;

        if (modOther) window.arq2_recalcLoteOrganico(other);
    });

    if (modifiedNue) window.arq2_recalcLoteOrganico(nue);
}

function arq2_registerSharedEdges(newLineId) {
    arq2_crossInjectVertices(newLineId);
    const nue = allDrawnLines.find(l => l.id === newLineId);
    const nuePts = arq2_getSewPolygonPoints(nue);
    if (!nue || !nuePts || nuePts.length < 3) return;
    // Always reset to avoid stale data from previous registrations
    nue.sharedSegs = [];
    nue.sharedSegStyles = {};
    nue.sharedSegMeta = {};
    const costuraEstilo = arq2_getCosturaEstilo(nue);
    const nSeg = nuePts.length;
    const proj = getPanoramaScreenProjector();
    allDrawnLines.forEach(other => {
        if (other.id === newLineId) return;
        const oPts = arq2_getSewPolygonPoints(other);
        if (!oPts || oPts.length < 2) return;
        if (other.tipo === 'divisoria' || other.tipo === 'cortar' || other.tipo === 'linea-pines-guia') return;
        other.sharedSegs = other.sharedSegs || [];
        other.sharedSegStyles = other.sharedSegStyles || {};
        other.sharedSegMeta = other.sharedSegMeta || {};
        const isStreet = (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle');
        const oClosed = !isStreet && other.tipo !== 'calle';
        const oSegCount = oClosed ? oPts.length : oPts.length - 1;
        for (let i = 0; i < nSeg; i++) {
            const a1 = nuePts[i], a2 = nuePts[(i + 1) % nSeg];
            for (let j = 0; j < oSegCount; j++) {
                const b1 = oPts[j], b2 = oPts[(j + 1) % oPts.length];
                if (!arq2_segMatchScreenOrPY(a1, a2, b1, b2, proj, 0.08, 12)) continue;
                const oIdx = j % oPts.length;
                // Style: solid if touching a street, dashed if touching another lote
                const style = isStreet ? 'solida' : costuraEstilo;
                
                // Prioritize 'solida' style (street match). Do not overwrite with 'punteada'.
                if (isStreet) {
                    if (!nue.sharedSegs.includes(i)) nue.sharedSegs.push(i);
                    nue.sharedSegStyles[i] = 'solida';
                    nue.sharedSegMeta[i] = { lineId: other.id, segIdx: oIdx, isStreet: true };
                } else {
                    // Touching another lot: only assign style if not already marked solid by a street
                    if (nue.sharedSegStyles[i] !== 'solida') {
                        if (!nue.sharedSegs.includes(i)) nue.sharedSegs.push(i);
                        nue.sharedSegStyles[i] = style;
                        nue.sharedSegMeta[i] = { lineId: other.id, segIdx: oIdx, isStreet: false };
                    }
                    if (other.sharedSegStyles[oIdx] !== 'solida') {
                        if (!other.sharedSegs.includes(oIdx)) other.sharedSegs.push(oIdx);
                        other.sharedSegStyles[oIdx] = style;
                        other.sharedSegMeta[oIdx] = { lineId: nue.id, segIdx: i, isStreet: false };
                    }
                }
            }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOT SUBDIVISION: split a parent lote-organico along a multi-point polyline
// ─────────────────────────────────────────────────────────────────────────────
function arq2_trySplitParentLote(costuraPoints) {
    if (!costuraPoints || costuraPoints.length < 2) return false;
    const ptA = costuraPoints[0];
    const ptB = costuraPoints[costuraPoints.length - 1];
    const THRESH = 0.25; // distancia máxima en grados para considerarse sobre el límite del lote

    function _distToBoundary(pt, poly) {
        let minD = Infinity;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p1 = poly[i], p2 = poly[(i + 1) % n];
            const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len2 = dx * dx + dy * dy;
            if (len2 < 1e-10) continue;
            const t = Math.max(0, Math.min(1, ((pt[0]-p1[0])*dx + (pt[1]-p1[1])*dy) / len2));
            minD = Math.min(minD, Math.hypot(pt[0]-p1[0]-t*dx, pt[1]-p1[1]-t*dy));
        }
        return minD;
    }

    function _snapToBoundary(pt, poly) {
        let best = null, bestD = Infinity;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const p1 = poly[i], p2 = poly[(i + 1) % n];
            const dx = p2[0]-p1[0], dy = p2[1]-p1[1], len2 = dx*dx+dy*dy;
            if (len2 < 1e-10) continue;
            const t = Math.max(0.001, Math.min(0.999, ((pt[0]-p1[0])*dx + (pt[1]-p1[1])*dy) / len2));
            const sx = p1[0]+t*dx, sy = p1[1]+t*dy;
            const d = Math.hypot(pt[0]-sx, pt[1]-sy);
            if (d < bestD) { bestD = d; best = { edgeIdx: i, t, snap: [sx, sy] }; }
        }
        return best;
    }

    // Buscar el lote padre que contenga ambos extremos del trazado cerca de su límite
    let bestLot = null, bestScore = Infinity;
    allDrawnLines.forEach(line => {
        if (line.tipo !== 'lote-organico') return;
        if (line.costuraEstilo || line.costuraStyle || line.esDivisoria) return;
        const poly = line.puntos;
        if (!poly || poly.length < 3) return;
        const score = Math.max(_distToBoundary(ptA, poly), _distToBoundary(ptB, poly));
        if (score < bestScore) { bestScore = score; bestLot = line; }
    });

    if (!bestLot || bestScore > THRESH) return false;

    const poly = bestLot.puntos, n = poly.length;
    let locA = _snapToBoundary(ptA, poly);
    let locB = _snapToBoundary(ptB, poly);

    if (!locA) return false;

    // Si el último punto está adentro del lote, extendemos el último segmento hacia el borde opuesto
    if (_distToBoundary(ptB, poly) > THRESH * 0.5 && costuraPoints.length >= 2) {
        const lastPt = costuraPoints[costuraPoints.length - 1];
        const prevPt = costuraPoints[costuraPoints.length - 2];
        const dirX = lastPt[0]-prevPt[0], dirY = lastPt[1]-prevPt[1];
        const dirLen = Math.hypot(dirX, dirY);
        if (dirLen > 1e-6) {
            const nx = dirX/dirLen, ny = dirY/dirLen;
            let bestT = Infinity, bestLoc = null;
            for (let i = 0; i < n; i++) {
                const p1 = poly[i], p2 = poly[(i+1)%n];
                const ex = p2[0]-p1[0], ey = p2[1]-p1[1];
                const denom = nx*ey - ny*ex;
                if (Math.abs(denom) < 1e-10) continue;
                const t  = ((p1[0]-ptB[0])*ey - (p1[1]-ptB[1])*ex) / denom;
                const s  = ((p1[0]-ptB[0])*ny - (p1[1]-ptB[1])*nx) / denom;
                if (t > 0.001 && s >= 0 && s <= 1 && t < bestT) {
                    bestT = t;
                    const ix = ptB[0]+nx*t, iy = ptB[1]+ny*t;
                    const st = Math.max(0.001, Math.min(0.999, ((ix-p1[0])*ex+(iy-p1[1])*ey)/(ex*ex+ey*ey)));
                    bestLoc = { edgeIdx: i, t: st, snap: [ix, iy] };
                }
            }
            if (bestLoc) {
                locB = bestLoc;
                costuraPoints.push(bestLoc.snap);
            }
        }
    }

    if (!locB) return false;
    if (locA.edgeIdx === locB.edgeIdx && Math.abs(locA.t - locB.t) < 0.05) return false;

    // Ordenar los puntos A y B según el sentido de recorrido del polígono padre
    const posA = locA.edgeIdx + locA.t, posB = locB.edgeIdx + locB.t;
    let loc1, loc2, costuraPathForward;
    if (posA < posB) {
        loc1 = locA;
        loc2 = locB;
        costuraPathForward = costuraPoints.map(pt => [...pt]);
    } else {
        loc1 = locB;
        loc2 = locA;
        costuraPathForward = [...costuraPoints].reverse().map(pt => [...pt]);
    }

    const pt1 = loc1.snap, pt2 = loc2.snap;
    const edge1 = loc1.edgeIdx, edge2 = loc2.edgeIdx;

    // Reemplazar extremos de la costura por sus intersecciones exactas en el límite del lote
    costuraPathForward[0] = [...pt1];
    costuraPathForward[costuraPathForward.length - 1] = [...pt2];

    // Sub-polígono 1: sigue el perímetro del lote de edge1 a edge2, y regresa por la costura invertida de pt2 a pt1
    const sub1 = [[...pt1]];
    for (let i = edge1 + 1; i <= edge2; i++) {
        sub1.push([...poly[i % n]]);
    }
    if (Math.hypot(pt2[0] - sub1[sub1.length - 1][0], pt2[1] - sub1[sub1.length - 1][1]) > 1e-5) {
        sub1.push([...pt2]);
    }
    for (let i = costuraPathForward.length - 2; i > 0; i--) {
        sub1.push([...costuraPathForward[i]]);
    }

    // Sub-polígono 2: sigue la costura de pt1 a pt2, y regresa por el perímetro del lote de edge2 a edge1
    const sub2 = [[...pt1]];
    for (let i = 1; i < costuraPathForward.length - 1; i++) {
        sub2.push([...costuraPathForward[i]]);
    }
    if (Math.hypot(pt2[0] - sub2[sub2.length - 1][0], pt2[1] - sub2[sub2.length - 1][1]) > 1e-5) {
        sub2.push([...pt2]);
    }
    for (let i = edge2 + 1; i <= edge1 + n; i++) {
        sub2.push([...poly[i % n]]);
    }

    if (sub1.length < 3 || sub2.length < 3) return false;

    const id1 = 'arq2_org_' + Date.now();
    const id2 = 'arq2_org_' + (Date.now() + 1);
    const entry1 = { id: id1, tipo: 'lote-organico', puntos: sub1, sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {} };
    const entry2 = { id: id2, tipo: 'lote-organico', puntos: sub2, sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {} };

    if (!arq2_applyAutoFill(entry1) || !arq2_applyAutoFill(entry2)) return false;

    // Reemplazar el lote padre por los dos nuevos sublotes subdivididos
    const parentIdx = allDrawnLines.findIndex(l => l.id === bestLot.id);
    if (parentIdx >= 0) allDrawnLines.splice(parentIdx, 1, entry1, entry2);
    else allDrawnLines.push(entry1, entry2);

    // Registrar bordes compartidos para renderizarlos como líneas discontinuas
    arq2_registerSharedEdges(id1);
    arq2_registerSharedEdges(id2);

    return true;
}

function arq2_snapVerticesToExisting(points) {
    if (!points || !points.length) return points;
    const proj = getPanoramaScreenProjector();
    return points.map(pt => {
        // Threshold: 0.06 degrees
        let best = null, bestD = 0.06;
        allDrawnLines.forEach(line => {
            if (!arq2_isUniversalSnapTarget(line)) return;
            let linePts;
            if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
                linePts = [...(line.left || []), ...(line.right || [])];
            } else {
                linePts = arq2_getSewPolygonPoints(line);
            }
            if (!linePts || linePts.length < 2) return;
            // 1. Vertex snap
            linePts.forEach(v => {
                const d = Math.hypot(pt[0] - v[0], pt[1] - v[1]);
                if (d < bestD) { bestD = d; best = v; }
            });
            // 2. Edge snap (nearest point on any segment of this line)
            const isClosed = (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote');
            const segN = isClosed ? linePts.length : linePts.length - 1;
            for (let i = 0; i < segN; i++) {
                const p1 = linePts[i], p2 = linePts[(i + 1) % linePts.length];
                const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
                const len2 = dx * dx + dy * dy;
                if (len2 < 1e-10) continue;
                let t = ((pt[0] - p1[0]) * dx + (pt[1] - p1[1]) * dy) / len2;
                t = Math.max(0, Math.min(1, t));
                const nearX = p1[0] + t * dx, nearY = p1[1] + t * dy;
                const d = Math.hypot(pt[0] - nearX, pt[1] - nearY);
                if (d < bestD) { bestD = d; best = [nearX, nearY]; }
            }
        });
        return best ? [parseFloat(best[0].toFixed(4)), parseFloat(best[1].toFixed(4))] : [...pt];
    });
}

// After snapping costura vertices, project any that fell outside the parent lot back onto its boundary
function arq2_clipCosturaToParent(points) {
    if (!points || points.length < 2) return points;

    // Find the parent lot (non-costura lote-organico that all points are closest to)
    let bestLot = null, bestScore = Infinity;
    allDrawnLines.forEach(line => {
        if (line.tipo !== 'lote-organico') return;
        if (line.costuraEstilo || line.costuraStyle || line.esDivisoria) return;
        const poly = line.puntos;
        if (!poly || poly.length < 3) return;
        // Score = average distance of all costura points to lot boundary
        let totalD = 0;
        points.forEach(pt => {
            let minD = Infinity;
            const n = poly.length;
            for (let i = 0; i < n; i++) {
                const p1 = poly[i], p2 = poly[(i+1)%n];
                const dx = p2[0]-p1[0], dy = p2[1]-p1[1], len2 = dx*dx+dy*dy;
                if (len2 < 1e-10) continue;
                const t = Math.max(0, Math.min(1, ((pt[0]-p1[0])*dx+(pt[1]-p1[1])*dy)/len2));
                minD = Math.min(minD, Math.hypot(pt[0]-p1[0]-t*dx, pt[1]-p1[1]-t*dy));
            }
            totalD += minD;
        });
        const score = totalD / points.length;
        if (score < bestScore) { bestScore = score; bestLot = line; }
    });

    if (!bestLot || bestScore > 0.5) return points; // no clear parent, skip clipping

    const poly = bestLot.puntos, n = poly.length;

    // Simple point-in-polygon (ray casting)
    function inPolygon(pt) {
        let inside = false;
        for (let i = 0, j = n-1; i < n; j = i++) {
            const xi = poly[i][0], yi = poly[i][1];
            const xj = poly[j][0], yj = poly[j][1];
            if (((yi > pt[1]) !== (yj > pt[1])) && (pt[0] < (xj-xi)*(pt[1]-yi)/(yj-yi)+xi)) inside = !inside;
        }
        return inside;
    }

    // Project a point to the nearest edge of the polygon
    function projectToBoundary(pt) {
        let best = null, bestD = Infinity;
        for (let i = 0; i < n; i++) {
            const p1 = poly[i], p2 = poly[(i+1)%n];
            const dx = p2[0]-p1[0], dy = p2[1]-p1[1], len2 = dx*dx+dy*dy;
            if (len2 < 1e-10) continue;
            const t = Math.max(0.001, Math.min(0.999, ((pt[0]-p1[0])*dx+(pt[1]-p1[1])*dy)/len2));
            const sx = p1[0]+t*dx, sy = p1[1]+t*dy;
            const d = Math.hypot(pt[0]-sx, pt[1]-sy);
            if (d < bestD) { bestD = d; best = [sx, sy]; }
        }
        return best || pt;
    }

    // Clip each vertex: if outside the lot, project back to boundary
    return points.map(pt => inPolygon(pt) ? pt : projectToBoundary(pt));
}



function arq2_weldVerticesToNeighbors(lineId) {
    const nue = allDrawnLines.find(l => l.id === lineId);
    const nuePts = nue?.puntos;
    if (!nuePts || nuePts.length < 3) return;
    const n = nuePts.length;
    allDrawnLines.forEach(other => {
        if (other.id === lineId) return;
        const oPts = arq2_getSewPolygonPoints(other);
        if (!oPts || oPts.length < 2) return;
        if (other.tipo === 'divisoria' || other.tipo === 'cortar') return;
        const oClosed = other.tipo !== 'calle';
        const oSegCount = oClosed ? oPts.length : oPts.length - 1;
        for (let i = 0; i < n; i++) {
            const a1 = nuePts[i], a2 = nuePts[(i + 1) % n];
            for (let j = 0; j < oSegCount; j++) {
                const b1 = oPts[j], b2 = oPts[(j + 1) % oPts.length];
                if (!arq2_segMatchTol(a1, a2, b1, b2, 0.05)) continue;
                const d11 = Math.hypot(a1[0] - b1[0], a1[1] - b1[1]), d22 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
                if (d11 < 0.05 && d22 < 0.05) {
                    nue.puntos[i] = [parseFloat(b1[0].toFixed(4)), parseFloat(b1[1].toFixed(4))];
                    nue.puntos[(i + 1) % n] = [parseFloat(b2[0].toFixed(4)), parseFloat(b2[1].toFixed(4))];
                } else {
                    nue.puntos[i] = [parseFloat(b2[0].toFixed(4)), parseFloat(b2[1].toFixed(4))];
                    nue.puntos[(i + 1) % n] = [parseFloat(b1[0].toFixed(4)), parseFloat(b1[1].toFixed(4))];
                }
            }
        }
    });
}
function arq2_getSharedSegStyle(lineData, segIdx) {
    if (!lineData?.sharedSegs?.includes(segIdx)) return null;
    const meta = lineData.sharedSegMeta?.[segIdx];
    const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
    if (other && (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle')) {
        return 'solida';
    }
    return lineData.sharedSegStyles?.[segIdx] || lineData.costuraEstilo || lineData.costuraStyle || 'punteada';
}