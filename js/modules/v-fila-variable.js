function arq2_polylineDirectionVector(pts) {
    if (!pts || pts.length < 2) return null;
    return [pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1]];
}
function arq2_validatePolylineDirection(frontPoints, backPoints) {
    const back = backPoints.map(p => [...p]);
    const v1 = arq2_polylineDirectionVector(frontPoints), v2 = arq2_polylineDirectionVector(back);
    if (!v1 || !v2) return { back, reversed: false, conflict: false };
    const len1 = Math.hypot(v1[0], v1[1]), len2 = Math.hypot(v2[0], v2[1]);
    if (len1 < 1e-6 || len2 < 1e-6) return { back, reversed: false, conflict: false };
    const dot = (v1[0] * v2[0] + v1[1] * v2[1]) / (len1 * len2);
    const angleBetween = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
    const reversed = angleBetween > 90;
    if (reversed) back.reverse();
    return { back, reversed, conflict: angleBetween > 90 };
}
function arq2_chainFromContour(contorno, startIdx, endIdx) {
    const n = contorno.length;
    const chain = [];
    let i = startIdx;
    while (true) {
        chain.push([...contorno[i]]);
        if (i === endIdx) break;
        i = (i + 1) % n;
    }
    return chain;
}
function arq2_expandColinearChain(contorno, edgeStartIdx) {
    const n = contorno.length;
    let s = edgeStartIdx;
    let e = (edgeStartIdx + 1) % n;
    let next = (e + 1) % n;
    while (next !== s && n > 3 && arq2_detectCornerAngle(contorno[e], contorno[next], contorno[(next + 1) % n]) > 150) {
        e = next;
        next = (e + 1) % n;
    }
    let prev = (s - 1 + n) % n;
    while (prev !== e && n > 3 && arq2_detectCornerAngle(contorno[prev], contorno[s], contorno[(s + 1) % n]) > 150) {
        s = prev;
        prev = (s - 1 + n) % n;
    }
    return arq2_chainFromContour(contorno, s, e);
}
function arq2_detectEjeYFondo(contornoPoints) {
    const n = contornoPoints.length;
    if (n < 4) return null;
    let bestI = 0, bestLen = 0;
    for (let i = 0; i < n; i++) {
        const len = Math.hypot(contornoPoints[(i + 1) % n][0] - contornoPoints[i][0], contornoPoints[(i + 1) % n][1] - contornoPoints[i][1]);
        if (len > bestLen) { bestLen = len; bestI = i; }
    }
    const ejeFrente = arq2_expandColinearChain(contornoPoints, bestI);
    const fMid = getPointAlongPolyline(ejeFrente, 0.5);
    let oppI = (bestI + Math.floor(n / 2)) % n, oppScore = -1;
    for (let j = 0; j < n; j++) {
        if (j === bestI || j === (bestI + 1) % n) continue;
        const p1 = contornoPoints[j], p2 = contornoPoints[(j + 1) % n];
        const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const d = Math.hypot(mid[0] - fMid[0], mid[1] - fMid[1]);
        if (d > oppScore) { oppScore = d; oppI = j; }
    }
    let ejeFondo = arq2_expandColinearChain(contornoPoints, oppI);
    ejeFondo = arq2_validatePolylineDirection(ejeFrente, ejeFondo).back;
    return { ejeFrente, ejeFondo };
}
function arq2_pointAtArcLength(ejePoints, targetLength) {
    const total = getPolylineLength(ejePoints);
    if (total < 1e-8) return [...ejePoints[0]];
    return getPointAlongPolyline(ejePoints, Math.min(1, Math.max(0, targetLength / total)));
}
function arq2_computeFilaTCuts(weights) {
    const total = weights.reduce((a, b) => a + (parseFloat(b) || 0), 0) || 1;
    const cum = [0];
    let acc = 0;
    for (let i = 0; i < weights.length; i++) { acc += (parseFloat(weights[i]) || 0) / total; cum.push(acc); }
    return cum;
}
function arq2_getFilaRadialDivision(ejeFrente, ejeFondo, t) {
    const tp = getPointAlongPolyline(ejeFrente, t);
    const tEps = 0.01;
    const tPrev = Math.max(0, t - tEps);
    const tNext = Math.min(1, t + tEps);
    const pPrev = getPointAlongPolyline(ejeFrente, tPrev);
    const pNext = getPointAlongPolyline(ejeFrente, tNext);
    let dx = pNext[0] - pPrev[0];
    let dy = pNext[1] - pPrev[1];
    let len = Math.hypot(dx, dy);
    if (len < 1e-6) {
        return [tp, getPointAlongPolyline(ejeFondo, t)];
    }
    let nx = -dy / len;
    let ny = dx / len;
    const midFondo = getPointAlongPolyline(ejeFondo, 0.5);
    const dPlus = Math.hypot(tp[0] + nx * 0.1 - midFondo[0], tp[1] + ny * 0.1 - midFondo[1]);
    const dMinus = Math.hypot(tp[0] - nx * 0.1 - midFondo[0], tp[1] - ny * 0.1 - midFondo[1]);
    if (dMinus < dPlus) {
        nx = -nx;
        ny = -ny;
    }
    const rayStart = tp;
    const rayEnd = [tp[0] + nx * 10.0, tp[1] + ny * 10.0];
    let bp = null;
    let minRayT = Infinity;
    for (let i = 0; i < ejeFondo.length - 1; i++) {
        const b1 = ejeFondo[i], b2 = ejeFondo[i + 1];
        const hit = intersectSegments(rayStart, rayEnd, b1, b2);
        if (hit) {
            const d = Math.hypot(hit[0] - rayStart[0], hit[1] - rayStart[1]);
            if (d < minRayT) {
                minRayT = d;
                bp = hit;
            }
        }
    }
    if (bp) {
        return [tp, bp];
    }
    return [tp, getPointAlongPolyline(ejeFondo, t)];
}
function arq2_buildFilaInternalDivisions(ejeFrente, ejeFondo, weights) {
    const cum = arq2_computeFilaTCuts(weights);
    const divs = [];
    for (let i = 1; i < cum.length - 1; i++) {
        const pts = arq2_getFilaRadialDivision(ejeFrente, ejeFondo, cum[i]);
        const tp = pts[0], bp = pts[1];
        if (!arq2_isValidPYPoint(tp) || !arq2_isValidPYPoint(bp)) {
            console.warn('[Fila Variable] División inválida en t=' + cum[i], { tp, bp, ejeFrente, ejeFondo });
            continue;
        }
        divs.push([[...tp], [...bp]]);
    }
    return divs;
}
function arq2_computeFilaLotCentroids(ejeFrente, ejeFondo, weights) {
    const cum = arq2_computeFilaTCuts(weights);
    const lots = [];
    for (let i = 0; i < weights.length; i++) {
        const tMid = (cum[i] + cum[i + 1]) / 2;
        const pts = arq2_getFilaRadialDivision(ejeFrente, ejeFondo, tMid);
        const pf = pts[0], pb = pts[1];
        lots.push({
            numero: String(i + 1).padStart(2, '0'),
            centroid: [(pf[0] + pb[0]) / 2, (pf[1] + pb[1]) / 2],
            m2: parseFloat(weights[i]) || 0
        });
    }
    return lots;
}
function arq2_finishFilaContour() {
    if (arq2LinePoints.length < 4) { alert('⚠ Dibuja al menos 4 puntos para el contorno completo de la hilera.'); return; }
    const raw = arq2_sanitizePolylinePoints([...arq2LinePoints]);
    if (raw.length < 4) { alert('⚠ Contorno inválido. Usa 4–6 vértices bien definidos.'); return; }
    arq2FilaVariableContorno = arq2SmoothCurves ? arq2_adaptiveSmooth(raw, 8) : raw;
    arq2FilaVariableContorno = arq2_sanitizePolylinePoints(arq2FilaVariableContorno);
    if (arq2FilaVariableContorno.length < 4) { alert('⚠ No se pudo generar la fila. Intenta con un contorno más simple (4-6 puntos) y vuelve a intentar.'); return; }
    arq2PendingFila = { contorno: [...arq2FilaVariableContorno] };
    arq2LinePoints = [];
    arq2TempLineId = 'arq2_temp_' + Date.now();
    arq2_stopDemoAnimation();
    openFranjaLotesModal(4, null);
    arq2_updatePanelStep();
}
function arq2_resamplePolylineEqualArc(pts, sampleCount = 64) {
    if (!pts || pts.length < 2) return pts ? pts.map(p => [...p]) : [];
    const out = [];
    for (let i = 0; i <= sampleCount; i++) out.push(getPointAlongPolyline(pts, i / sampleCount));
    return out;
}
function arq2_distributeVariableWidthsAlongSpline(splinePoints, weightsArray) {
    if (!splinePoints || splinePoints.length < 2 || !weightsArray?.length) return [];
    const weights = weightsArray.map(w => Math.sqrt(Math.max(1, parseFloat(w) || 1)));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const cum = [0];
    let acc = 0;
    for (let i = 0; i < weights.length; i++) { acc += weights[i] / total; cum.push(acc); }
    return cum.map(t => getPointAlongPolyline(splinePoints, Math.min(1, Math.max(0, t))));
}

// Live preview function for Fila Variable (New Franja) called by v-automacro.js
window.arq2_updateFilaVariableLivePreview = function(weights) {
    if (!arq2PendingFila?.contorno || !weights?.length) return;
    const contorno = arq2_sanitizePolylinePoints(arq2PendingFila.contorno);
    if (contorno.length < 4) return;
    const axes = arq2_detectEjeYFondo(contorno);
    if (!axes) return;

    // Outer boundary
    franjaPreviewQuad = contorno;
    franjaPreviewDivs = [];

    // Internal divisions
    const divs = arq2_buildFilaInternalDivisions(axes.ejeFrente, axes.ejeFondo, weights);
    divs.forEach((pts, idx) => {
        if (!pts?.length || !arq2_isValidPYPoint(pts[0]) || !arq2_isValidPYPoint(pts[1])) return;
        franjaPreviewDivs.push({
            id: 'franja_preview_div_' + idx,
            tipo: 'franja-preview-div',
            puntos: pts
        });
    });

    if (typeof updateSVGPaths === 'function') updateSVGPaths();
};