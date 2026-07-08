function arq2_catmullRomSmooth(points, segmentsPerCurve = 8) {
    if (!points || points.length < 3) return points ? points.map(p => [...p]) : [];
    const pts = points.map(p => [...p]), n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
        for (let s = 0; s < segmentsPerCurve; s++) {
            const u = s / segmentsPerCurve, u2 = u * u, u3 = u2 * u;
            const pitch = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
            const yaw = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
            if (s === 0 && i > 0) continue;
            out.push([parseFloat(pitch.toFixed(4)), parseFloat(yaw.toFixed(4))]);
        }
    }
    return out.length >= 3 ? out : pts;
}
function arq2_detectCornerAngle(pPrev, pCurr, pNext) {
    const v1x = pCurr[0] - pPrev[0], v1y = pCurr[1] - pPrev[1];
    const v2x = pNext[0] - pCurr[0], v2y = pNext[1] - pCurr[1];
    const len1 = Math.hypot(v1x, v1y), len2 = Math.hypot(v2x, v2y);
    if (len1 < 1e-8 || len2 < 1e-8) return 180;
    const dot = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (len1 * len2)));
    return 180 - (Math.acos(dot) * 180 / Math.PI);
}
function arq2_catmullRomOpen(points, segmentsPerCurve = 8) {
    if (!points || points.length < 2) return points ? points.map(p => [...p]) : [];
    if (points.length === 2) return [points[0].map(v => v), points[1].map(v => v)];
    const out = [[...points[0]]];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(points.length - 1, i + 2)];
        for (let s = 1; s <= segmentsPerCurve; s++) {
            const u = s / segmentsPerCurve, u2 = u * u, u3 = u2 * u;
            const pitch = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3);
            const yaw = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3);
            out.push([parseFloat(pitch.toFixed(4)), parseFloat(yaw.toFixed(4))]);
        }
    }
    return out;
}
function arq2_resamplePolylineGroundStraight(pts, totalSamples = 64) {
    if (!pts || pts.length < 2) return pts ? pts.map(p => [...p]) : [];
    const out = [];
    const pyToGround = (p, y) => {
        const pitchRad = Math.min(p, -0.001) * Math.PI / 180;
        const yawRad = y * Math.PI / 180;
        const cot = 1 / Math.tan(pitchRad);
        return { gx: -cot * Math.sin(yawRad), gz: -cot * Math.cos(yawRad) };
    };
    const groundToPY = (gx, gz) => {
        const yawRad = Math.atan2(gx, gz);
        const pitchRad = Math.atan2(-1, Math.hypot(gx, gz));
        return [pitchRad * 180 / Math.PI, yawRad * 180 / Math.PI];
    };
    const groundPts = pts.map(pt => pyToGround(pt[0], pt[1]));
    let totalDist = 0;
    const segDists = [];
    for (let i = 0; i < groundPts.length - 1; i++) {
        const d = Math.hypot(groundPts[i+1].gx - groundPts[i].gx, groundPts[i+1].gz - groundPts[i].gz);
        segDists.push(d);
        totalDist += d;
    }
    if (totalDist < 0.0001) return pts.map(p => [...p]);
    out.push([...pts[0]]);
    for (let i = 0; i < groundPts.length - 1; i++) {
        const p1 = groundPts[i];
        const p2 = groundPts[i+1];
        const segDist = segDists[i];
        let samplesForSeg = Math.max(1, Math.round((segDist / totalDist) * totalSamples));
        if (i === groundPts.length - 2) {
            samplesForSeg = totalSamples - (out.length - 1);
            if (samplesForSeg < 1) samplesForSeg = 1;
        }
        for (let j = 1; j <= samplesForSeg; j++) {
            const t = j / samplesForSeg;
            if (t >= 0.999) {
                out.push([...pts[i+1]]);
            } else {
                const interpX = p1.gx + t * (p2.gx - p1.gx);
                const interpZ = p1.gz + t * (p2.gz - p1.gz);
                out.push(groundToPY(interpX, interpZ));
            }
        }
    }
    return out;
}

function arq2_smoothCalleAxis(points) {
    if (!points || points.length < 2) return points ? points.map(p => [...p]) : [];
    const curvatura = draftCalleCurvaCurvatura;
    if (curvatura <= 0) return points.map(p => [...p]); 
    
    // Generate linear points with EXACTLY the same parameterization as catmull:
    const linearPts = [[...points[0]]];
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        for (let s = 1; s <= 12; s++) {
            const u = s / 12;
            linearPts.push([
                p1[0] + (p2[0] - p1[0]) * u,
                p1[1] + (p2[1] - p1[1]) * u
            ]);
        }
    }
    
    if (curvatura <= 0) return linearPts; 
    
    const catmull = arq2_catmullRomOpen(points, 12);
    if (curvatura >= 10) return catmull;
    
    const t = curvatura / 10;
    
    return catmull.map((c, i) => {
        const r = linearPts[i] || c;
        return [r[0] + (c[0] - r[0]) * t, r[1] + (c[1] - r[1]) * t];
    });
}

function arq2_estimateScreenCurvatureRadius(points, i, proj) {
    if (!points || points.length < 2 || !proj) return Infinity;
    const i0 = Math.max(0, i - 1), i1 = i, i2 = Math.min(points.length - 1, i + 1);
    if (i0 === i1 || i1 === i2) return Infinity;
    const s0 = proj.toScreen(points[i0][0], points[i0][1]);
    const s1 = proj.toScreen(points[i1][0], points[i1][1]);
    const s2 = proj.toScreen(points[i2][0], points[i2][1]);
    if (!s0 || !s1 || !s2) return Infinity;
    const a = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
    const b = Math.hypot(s2[0] - s1[0], s2[1] - s1[1]);
    const c = Math.hypot(s2[0] - s0[0], s2[1] - s0[1]);
    const area2 = Math.abs((s1[0] - s0[0]) * (s2[1] - s0[1]) - (s1[1] - s0[1]) * (s2[0] - s0[0]));
    if (area2 < 1e-3) return Infinity;
    return (a * b * c) / area2;
}
function arq2_chaikinOpenSmoothOnce(points) {
    if (!points || points.length < 3) return points ? points.map(p => [...p]) : [];
    const out = [[...points[0]]];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i], p1 = points[i + 1];
        out.push([parseFloat((p0[0] * 0.75 + p1[0] * 0.25).toFixed(4)), parseFloat((p0[1] * 0.75 + p1[1] * 0.25).toFixed(4))]);
        out.push([parseFloat((p0[0] * 0.25 + p1[0] * 0.75).toFixed(4)), parseFloat((p0[1] * 0.25 + p1[1] * 0.75).toFixed(4))]);
    }
    out.push([...points[points.length - 1]]);
    return out;
}
function arq2_enforceMinCurveRadius(smoothedPoints, minRadiusPx) {
    const proj = getPanoramaScreenProjector();
    if (!proj || !smoothedPoints || smoothedPoints.length < 3) return smoothedPoints ? smoothedPoints.map(p => [...p]) : [];
    let pts = smoothedPoints.map(p => [...p]);
    const minR = Math.max(1, minRadiusPx || 1);
    for (let pass = 0; pass < 10; pass++) {
        let changed = false;
        let newPts = pts.map(p => [...p]);
        for (let i = 1; i < pts.length - 1; i++) {
            const r = arq2_estimateScreenCurvatureRadius(pts, i, proj);
            if (r < minR) {
                const prev = pts[i - 1], next = pts[i + 1];
                newPts[i] = [
                    parseFloat(((prev[0] + pts[i][0] + next[0]) / 3).toFixed(5)),
                    parseFloat(((prev[1] + pts[i][1] + next[1]) / 3).toFixed(5))
                ];
                changed = true;
            }
        }
        pts = newPts;
        if (!changed) break;
        if (pass === 4 || pass === 8) pts = arq2_chaikinOpenSmoothOnce(pts);
    }
    return pts;
}
function arq2_removeSelfIntersections(pointsArray) {
    if (!pointsArray || pointsArray.length < 4) return pointsArray ? pointsArray.map(p => [...p]) : [];
    let pts = pointsArray.map(p => [...p]);
    for (let pass = 0; pass < 16; pass++) {
        let removed = false;
        outer: for (let i = 0; i < pts.length - 3; i++) {
            const a1 = pts[i], a2 = pts[i + 1];
            for (let j = i + 2; j < pts.length - 1; j++) {
                const b1 = pts[j], b2 = pts[j + 1];
                const hit = intersectSegments(a1, a2, b1, b2);
                if (!hit) continue;
                const hx = parseFloat(hit[0].toFixed(4)), hy = parseFloat(hit[1].toFixed(4));
                pts = pts.slice(0, i + 1).concat([[hx, hy]], pts.slice(j + 1));
                removed = true;
                break outer;
            }
        }
        if (!removed) break;
    }
    return pts.length >= 2 ? pts : pointsArray.map(p => [...p]);
}
function arq2_getCalleCurvaHalfWidthDeg(anchoFactor) {
    // Return street half-width in PY degrees (pitch/yaw angular space).
    // This value is perspective-independent: the street appears the same width
    // from any camera yaw/pitch angle.
    // Calibration: factor=8 (default) -> ~1.1 degrees half-width.
    // Range: factor 4->0.55 deg, factor 15->2.05 deg (linear).
    const factor = Math.max(4, Math.min(15, anchoFactor || arq2CalleCurvaAncho || 8));
    return 0.55 + (factor - 4) * (1.5 / 11); // 0.55 at 4, 2.05 at 15
}
// Keep for migration compatibility
function arq2_getCalleCurvaHalfWidthPx(anchoFactor) {
    const factor = Math.max(4, Math.min(15, anchoFactor || arq2CalleCurvaAncho || 8));
    return getCalleHalfWidthPx(factor * 0.72);
}
function arq2_isCalleEjeClosed(eje) {
    if (!eje || eje.length < 3) return false;
    const first = eje[0], last = eje[eje.length - 1];
    return Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.25;
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

function arq2_snapStreetBorderToLots(borderPoints, snapTolDeg = 0.32) {
    if (!borderPoints || borderPoints.length === 0) return borderPoints;
    const lots = allDrawnLines.filter(l => l.tipo === 'lote-organico' || l.tipo === 'fila-variable-lote' || l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo');
    if (lots.length === 0) return borderPoints;
    
    return borderPoints.map(pt => {
        let bestDist = snapTolDeg;
        let bestPt = pt;
        for (let lot of lots) {
            const pts = lot.puntos || [];
            if (pts.length < 3) continue;
            const proj = arq2_projectPointOnPolyline(pt, pts);
            if (proj && proj.dist < bestDist) {
                bestDist = proj.dist;
                bestPt = proj.point;
            }
        }
        return bestPt;
    });
}

// Compute the half-angular-width in DEGREES for the curved street tool.
// Retorna cuántos grados separa el eje central del borde lateral en la esfera.
// Al ser grados absolutos (independientes del FOV/pantalla), la geometría resultante
// es idéntica en cualquier dispositivo: escritorio, móvil, iframe.
function arq2_getCalleCurvaHalfWidthDeg(anchoFactor) {
    const factor = Math.max(4, Math.min(15, anchoFactor || arq2CalleCurvaAncho || 8));
    // 0.04° por unidad → ancho 4 = 0.16°/lado, ancho 8 = 0.32°/lado, ancho 15 = 0.6°/lado
    // Calibrado para que ancho 4 coincida visualmente con la calle de tierra real del proyecto.
    return factor * 0.04; // grados
}
// Alias en px para compatibilidad con el resto del código que aún lo llame:
function arq2_getCalleCurvaHalfWidthPxDyn(anchoFactor) {
    return arq2_getCalleCurvaHalfWidthDeg(anchoFactor);
}

// Push a PY point along a screen-space normal by offsetPx pixels,
// returning the new PY coordinates. Uses the panorama projector.
function arq2_pushScreenNormal(py, nxPx, nyPx, offsetPx, proj) {
    if (!proj || offsetPx <= 0) return py;
    const sc = proj.toScreen(py[0], py[1]);
    if (!sc) return py;
    const len = Math.hypot(nxPx, nyPx) || 1;
    const ux = nxPx / len, uy = nyPx / len;
    // Iterative scale correction (same as pushPanoramaAlongScreenNormal)
    let scale = 1;
    let best = null;
    for (let i = 0; i < 5; i++) {
        const tx = sc[0] + ux * offsetPx * scale;
        const ty = sc[1] + uy * offsetPx * scale;
        const candidate = proj.toPY(tx, ty);
        if (!candidate) break;
        const chk = proj.toScreen(candidate[0], candidate[1]);
        if (!chk) { best = candidate; break; }
        const actual = Math.hypot(chk[0] - sc[0], chk[1] - sc[1]);
        if (actual >= offsetPx * 0.97) return candidate;
        scale *= offsetPx / Math.max(actual, 0.001);
        best = candidate;
    }
    return best || py;
}

// Spherical-space offset spline: desplaza los bordes de la calle directamente
// en coordenadas esféricas (Pitch/Yaw), sin depender de la cámara ni del FOV.
// La normal se calcula sobre la tangente en la esfera unitaria, lo que garantiza
// que la geometría sea absolutamente estable sin importar dónde mire la cámara.
function arq2_offsetSplinePath(smoothedPoints, halfWidthDeg, calleRetorno = false, isClosed = false) {
    if (!smoothedPoints || smoothedPoints.length < 2) return { left: [], right: [] };

    const D2R = Math.PI / 180;
    const R2D = 180 / Math.PI;
    const MITER_LIMIT = 10.0;

    // Convierte [pitch, yaw] en vector 3D unitario sobre la esfera
    function toVec(pt) {
        const p = pt[0] * D2R, y = pt[1] * D2R;
        return [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
    }
    // Convierte vector 3D de vuelta a [pitch, yaw]
    function fromVec(v) {
        const len = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
        const vn = [v[0]/len, v[1]/len, v[2]/len];
        const pitch = Math.asin(Math.max(-1, Math.min(1, vn[1]))) * R2D;
        const yaw = Math.atan2(vn[0], vn[2]) * R2D;
        return [pitch, yaw];
    }
    // Desplaza un punto PY lateralmente sobre la esfera por angleDeg grados.
    // sideDir = dirección lateral (perpendicular al eje y al vector posición).
    // Fórmula: arco de gran círculo lateral = v*cos(θ) + sideDir*sin(θ)
    // NOTA: Rodrigues rotación alrededor de sideDir mueve LONGITUDINALMENTE — no se usa.
    function pushSphere(pt, sideDir, angleDeg) {
        const v = toVec(pt);
        const a = angleDeg * D2R;
        // v y sideDir son perpendiculares (v es posición, sideDir = v×tn)
        // El punto en la esfera a 'a' radianes lateral es:
        return fromVec([
            v[0] * Math.cos(a) + sideDir[0] * Math.sin(a),
            v[1] * Math.cos(a) + sideDir[1] * Math.sin(a),
            v[2] * Math.cos(a) + sideDir[2] * Math.sin(a)
        ]);
    }
    // Normal esférica perpendicular a la tangente entre dos puntos PY
    function sphereNormal(a, b) {
        const va = toVec(a), vb = toVec(b);
        // Tangente en esfera: componente de vb perpendicular a va
        const dot = va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2];
        const t = [vb[0]-dot*va[0], vb[1]-dot*va[1], vb[2]-dot*va[2]];
        const tlen = Math.sqrt(t[0]*t[0]+t[1]*t[1]+t[2]*t[2]);
        if (tlen < 1e-8) return null;
        const tn = [t[0]/tlen, t[1]/tlen, t[2]/tlen];
        // Normal = va × tn (perpendicular a ambos)
        return [
            va[1]*tn[2]-va[2]*tn[1],
            va[2]*tn[0]-va[0]*tn[2],
            va[0]*tn[1]-va[1]*tn[0]
        ];
    }
    // Media ponderada de dos normales esféricas (para miter)
    function avgNormals(n1, n2) {
        if (!n1) return n2; if (!n2) return n1;
        const s = [n1[0]+n2[0], n1[1]+n2[1], n1[2]+n2[2]];
        const len = Math.sqrt(s[0]*s[0]+s[1]*s[1]+s[2]*s[2]);
        if (len < 1e-8) return n1;
        return [s[0]/len, s[1]/len, s[2]/len];
    }

    const left = [], right = [];
    const n = smoothedPoints.length;
    const limit = isClosed ? n : (calleRetorno ? n - 1 : n);

    for (let i = 0; i < limit; i++) {
        const cur = smoothedPoints[i];
        let norm;

        if (!isClosed && (i === 0 || i === n - 1)) {
            const refIdx = i === 0 ? Math.min(1, n-1) : Math.max(0, n-2);
            const ref = smoothedPoints[refIdx];
            norm = i === 0 ? sphereNormal(cur, ref) : sphereNormal(ref, cur);
        } else {
            const iPrev = isClosed ? (i - 1 + n) % n : i - 1;
            const iNext = isClosed ? (i + 1) % n : i + 1;
            const nIn  = sphereNormal(smoothedPoints[iPrev], cur);
            const nOut = sphereNormal(cur, smoothedPoints[iNext]);
            norm = avgNormals(nIn, nOut);
        }
        if (!norm) continue;

        const lPY = pushSphere(cur,  norm, halfWidthDeg);
        const rPY = pushSphere(cur, [- norm[0], -norm[1], -norm[2]], halfWidthDeg);
        if (lPY) left.push([parseFloat(lPY[0].toFixed(4)), parseFloat(lPY[1].toFixed(4))]);
        if (rPY) right.push([parseFloat(rPY[0].toFixed(4)), parseFloat(rPY[1].toFixed(4))]);
    }

    if (calleRetorno && smoothedPoints.length >= 2) {
        // U-turn cap: calcular el semicírculo en esfera
        const lastPt = smoothedPoints[smoothedPoints.length - 1];
        const prevPt = smoothedPoints[Math.max(0, smoothedPoints.length - 2)];
        const capNorm = sphereNormal(prevPt, lastPt);
        if (capNorm) {
            const numPoints = 16;
            for (let j = 0; j <= numPoints / 2; j++) {
                const ang = halfWidthDeg * Math.cos(Math.PI * j / numPoints);
                const capPY = pushSphere(lastPt, capNorm, ang);
                if (capPY) left.push([parseFloat(capPY[0].toFixed(4)), parseFloat(capPY[1].toFixed(4))]);
            }
            for (let j = numPoints; j > numPoints / 2; j--) {
                const ang = halfWidthDeg * Math.cos(Math.PI * j / numPoints);
                const capPY = pushSphere(lastPt, capNorm, ang);
                if (capPY) right.push([parseFloat(capPY[0].toFixed(4)), parseFloat(capPY[1].toFixed(4))]);
            }
        }
    }

    return {
        left: arq2_removeSelfIntersections(left),
        right: arq2_removeSelfIntersections(right)
    };
}

function arq2_getCalleCurvaAlpha(lineData) {
    return Math.max(0.15, Math.min(1, lineData?.calleCurvaAlpha ?? draftCalleCurvaAlpha ?? 0.55));
}
function arq2_applyCalleCurvaFillStyle(pathEl, alpha) {
    if (!pathEl) return;
    const a = arq2_getCalleCurvaAlpha({ calleCurvaAlpha: alpha });
    pathEl.setAttribute('fill-rule', 'evenodd');
    pathEl.style.fillRule = 'evenodd';
    pathEl.style.fillOpacity = a;
    
    // Do not alter layer opacity globally, rely on per-path fillOpacity.
}

function arq2_buildCalleCurvaGeometry(ejeOriginal, anchoFactor, alphaFactor, calleRetorno = false) {
    let eje = arq2_smoothCalleAxis(ejeOriginal);
    // Use screen-pixel half-width: same visual formula as old "calle" tool
    const halfWidthPx = arq2_getCalleCurvaHalfWidthPxDyn(anchoFactor);
    // Minimum curve radius in screen pixels to avoid overly tight bends (only if they want curvature)
    if (draftCalleCurvaCurvatura > 0) {
        eje = arq2_enforceMinCurveRadius(eje, halfWidthPx * 1.3);
    }
    // Detect if the user drew a closed loop (manzana)
    const ejeIsClosed = arq2_isCalleEjeClosed(ejeOriginal);
    let left, right;
    if (ejeIsClosed) {
        const ejeLoop = eje[eje.length - 1] &&
            Math.hypot(eje[0][0]-eje[eje.length-1][0], eje[0][1]-eje[eje.length-1][1]) < 0.05
            ? eje.slice(0, -1) : eje;
        const offset = arq2_offsetSplinePath(ejeLoop, halfWidthPx, false, true);
        left = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.left) : offset.left;
        right = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.right) : offset.right;
        if (left.length > 1) left.push([...left[0]]);
        if (right.length > 1) right.push([...right[0]]);
    } else {
        const offset = arq2_offsetSplinePath(eje, halfWidthPx, calleRetorno, false);
        left = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.left) : offset.left;
        right = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.right) : offset.right;
    }
    if (left.length < 2 || right.length < 2) return null;
    const calleCurvaAlpha = Math.max(0.15, Math.min(1, alphaFactor ?? draftCalleCurvaAlpha ?? 0.55));
    return {
        ejeOriginal: ejeOriginal.map(p => [...p]),
        puntosSuavizados: eje,
        ancho: anchoFactor,
        calleCurvaAlpha,
        calleRetorno,
        ejeIsClosed,
        left,
        right,
        fillPoly: [...left, ...[...right].reverse()],
        halfWidthPx
    };
}
function clipLine2D(x0, y0, x1, y1, xmin, ymin, xmax, ymax) {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    function computeOutCode(x, y) {
        let code = INSIDE;
        if (x < xmin) code |= LEFT;
        else if (x > xmax) code |= RIGHT;
        if (y < ymin) code |= BOTTOM;
        else if (y > ymax) code |= TOP;
        return code;
    }
    let outcode0 = computeOutCode(x0, y0), outcode1 = computeOutCode(x1, y1), accept = false;
    while (true) {
        if (!(outcode0 | outcode1)) { accept = true; break; }
        else if (outcode0 & outcode1) { break; }
        else {
            let x, y, outcodeOut = outcode0 ? outcode0 : outcode1;
            if (outcodeOut & TOP) { x = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0); y = ymax; }
            else if (outcodeOut & BOTTOM) { x = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0); y = ymin; }
            else if (outcodeOut & RIGHT) { y = y0 + (y1 - y0) * (xmax - x0) / (x1 - x0); x = xmax; }
            else if (outcodeOut & LEFT) { y = y0 + (y1 - y0) * (xmin - x0) / (x1 - x0); x = xmin; }
            if (outcodeOut === outcode0) { x0 = x; y0 = y; outcode0 = computeOutCode(x0, y0); }
            else { x1 = x; y1 = y; outcode1 = computeOutCode(x1, y1); }
        }
    }
    return accept ? { x1: x0, y1: y0, x2: x1, y2: y1 } : null;
}

function arq2_projectOpenPolylineD(pts, getCamFn, cx, cySc, f) {
    if (!pts || pts.length < 2) return '';
    const NEAR = 0.0001; 
    const W = cx * 2, H = cySc * 2;
    const padding = Math.max(W, H);
    const bounds = [-padding, -padding, W + padding, H + padding];
    
    let d = '', hasVisible = false;
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= NEAR && c2.z <= NEAR) continue;
        
        let s1, s2;
        if (c1.z > NEAR) { s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f }; }
        else { const t = (NEAR - c1.z) / (c2.z - c1.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / NEAR) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / NEAR) * f }; }
        
        if (c2.z > NEAR) { s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f }; }
        else { const t = (NEAR - c2.z) / (c1.z - c2.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / NEAR) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / NEAR) * f }; }
        
        if (isNaN(s1.x) || isNaN(s1.y) || isNaN(s2.x) || isNaN(s2.y)) continue;
        
        const clipped = clipLine2D(s1.x, s1.y, s2.x, s2.y, bounds[0], bounds[1], bounds[2], bounds[3]);
        if (!clipped) continue;
        
        hasVisible = true;
        if (d === '') d += `M ${clipped.x1},${clipped.y1} L ${clipped.x2},${clipped.y2} `;
        else {
            const distSq = (clipped.x1 - s1.x)**2 + (clipped.y1 - s1.y)**2;
            if (distSq > 1 || c1.z <= NEAR) d += `M ${clipped.x1},${clipped.y1} `;
            d += `L ${clipped.x2},${clipped.y2} `;
        }
    }
    return hasVisible ? d : '';
}
function arq2_projectScreenCapLine(sA, sB) {
    if (!sA || !sB) return '';
    return `M ${sA.x},${sA.y} L ${sB.x},${sB.y}`;
}
function arq2_projectCalleCurvaPaths(lineData, getCamFn, cx, cySc, f) {
    // Build a projector wrapper using the current getCamFn (called per-frame)
    const proj = {
        toScreen: (pitch, yaw) => {
            const c = getCamFn(pitch, yaw);
            if (c.z <= 0.0001) return null;
            return [cx + (c.x / c.z) * f, cySc - (c.y / c.z) * f];
        },
        toPY: (sx, sy) => {
            // Invert the perspective projection: screen → unit sphere → PY
            // x_cam = (sx - cx) / f, y_cam = (cySc - sy) / f, z_cam = 1 (unnormalized)
            const x_cam = (sx - cx) / f;
            const y_cam = (cySc - sy) / f;
            const len = Math.sqrt(x_cam * x_cam + y_cam * y_cam + 1);
            const xn = x_cam / len, yn = y_cam / len, zn = 1 / len;
            // Rotate from camera space back to world space
            // getCam uses: x = cos_p*sin_yd, y = sin_p*cos_cp - cos_p*cos_yd*sin_cp,
            //              z = sin_p*sin_cp + cos_p*cos_yd*cos_cp
            // We need the inverse: apply transpose of rotation matrix
            // Camera rotation: Ry(camYaw) * Rx(-camPitch)
            // Use getPanoramaScreenProjector if available
            const globalProj = getPanoramaScreenProjector();
            if (!globalProj) return null;
            return globalProj.toPY(sx, sy);
        }
    };

    // Use fixed Pitch/Yaw geometry for finalized streets so they undergo proper 3D perspective foreshortening.
    // Only recalculate dynamically for the preview line while the user is actively drawing/editing.
    let left, right;
    if (lineData.tipo === 'calle-curva-arq2-preview' && lineData.puntosSuavizados && lineData.puntosSuavizados.length >= 2) {
        const halfWidthPx = arq2_getCalleCurvaHalfWidthPxDyn(lineData.ancho);
        const ejeIsClosed = lineData.ejeIsClosed;

        if (ejeIsClosed) {
            const eje = lineData.puntosSuavizados;
            const ejeLoop = eje[eje.length - 1] &&
                Math.hypot(eje[0][0]-eje[eje.length-1][0], eje[0][1]-eje[eje.length-1][1]) < 0.05
                ? eje.slice(0, -1) : eje;
            const offset = arq2_offsetSplinePath(ejeLoop, halfWidthPx, false, true);
            left = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.left) : offset.left;
            right = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.right) : offset.right;
            if (left.length > 1) left = [...left, left[0]];
            if (right.length > 1) right = [...right, right[0]];
        } else {
            const offset = arq2_offsetSplinePath(lineData.puntosSuavizados, halfWidthPx, lineData.calleRetorno || false, false);
            left = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.left) : offset.left;
            right = window.arq2_removeSelfIntersections ? window.arq2_removeSelfIntersections(offset.right) : offset.right;
        }
    } else {
        // Fallback: use stored left/right if available
        left = lineData.left || [];
        right = lineData.right || [];
    }
    if (!left?.length || !right?.length) return null;

    const NEAR = 0.0001;
    const toScreenRaw = (py) => {
        const c = getCamFn(py[0], py[1]);
        return { c, s: c.z > NEAR ? { x: cx + (c.x / c.z) * f, y: cySc - (c.y / c.z) * f } : null };
    };

    const lData = left.map(toScreenRaw);
    const rData = right.map(toScreenRaw);
    
    const fillHidden = lData.some(d => d.c.z <= NEAR) || rData.some(d => d.c.z <= NEAR);

    let dFill = '';
    if (!fillHidden) {
        if (lineData.ejeIsClosed) {
            let dOuter = `M ${rData[0].s.x},${rData[0].s.y}`;
            for (let i = 1; i < rData.length; i++) dOuter += ` L ${rData[i].s.x},${rData[i].s.y}`;
            dOuter += ' Z';
            let dInner = `M ${lData[0].s.x},${lData[0].s.y}`;
            for (let i = 1; i < lData.length; i++) dInner += ` L ${lData[i].s.x},${lData[i].s.y}`;
            dInner += ' Z';
            dFill = dOuter + ' ' + dInner;
        } else {
            dFill = `M ${lData[0].s.x},${lData[0].s.y}`;
            for (let i = 1; i < lData.length; i++) dFill += ` L ${lData[i].s.x},${lData[i].s.y}`;
            for (let i = rData.length - 1; i >= 0; i--) dFill += ` L ${rData[i].s.x},${rData[i].s.y}`;
            dFill += ' Z';
        }
    }

    const dLeft = arq2_projectOpenPolylineD(left, getCamFn, cx, cySc, f);
    const dRight = arq2_projectOpenPolylineD(right, getCamFn, cx, cySc, f);
    const capStart = lineData.ejeIsClosed ? '' : (lData[0].s && rData[0].s ? arq2_projectScreenCapLine(lData[0].s, rData[0].s) : '');
    const capEnd = (lineData.ejeIsClosed || lineData.calleRetorno) ? '' : (lData[lData.length - 1].s && rData[rData.length - 1].s ? arq2_projectScreenCapLine(lData[lData.length - 1].s, rData[rData.length - 1].s) : '');
    return { dFill, dLeft, dRight, capStart, capEnd, calleCurvaAlpha: lineData.calleCurvaAlpha };
}

function arq2_finishCalleCurva() {
    if (arq2LinePoints.length < 2) { alert('Coloca al menos 2 puntos en el eje central de la calle.'); return; }
    
    // Auto-close check: if finishing draw close to origin, merge them exactly to close loop (manzana)
    const first = arq2LinePoints[0];
    const last = arq2LinePoints[arq2LinePoints.length - 1];
    const dist = Math.hypot(first[0] - last[0], first[1] - last[1]);
    if (dist < 4.0 && arq2LinePoints.length >= 3) {
        arq2LinePoints[arq2LinePoints.length - 1] = [...first];
    }
    
    const geo = arq2_buildCalleCurvaGeometry([...arq2LinePoints], arq2CalleCurvaAncho, draftCalleCurvaAlpha, arq2CalleRetorno);
    if (!geo) { alert('No se pudo generar la calle curva. Ajusta la vista e intenta de nuevo.'); return; }
    const id = 'arq2_calle_' + Date.now();
    allDrawnLines.push({
        id,
        tipo: 'calle-curva-arq2',
        ejeOriginal: geo.ejeOriginal,
        puntosSuavizados: geo.puntosSuavizados,
        ancho: geo.ancho,
        calleCurvaAlpha: geo.calleCurvaAlpha,
        calleRetorno: arq2CalleRetorno,
        ejeIsClosed: geo.ejeIsClosed,
        left: geo.left,
        right: geo.right,
        puntos: geo.fillPoly
    });
    arq2_clearDraft();
    refreshAllHotspots(true);
    saveToLocal();
    flashScreenSuccess();
    arq2_setStatusText('Calle curva guardada ✓');
}
function arq2_getCalleCurvaPreviewLineData() {
    let eje = arq2LinePoints.map(p => [...p]);
    if (window.lastMouseX !== undefined && visor360) {
        const proj = getPanoramaScreenProjector();
        const mx = window.lastMouseX - DOMCache.viewport.left, my = window.lastMouseY - DOMCache.viewport.top;
        if (proj) {
            const py = proj.toPY(mx, my);
            if (py) eje.push([parseFloat(py[0].toFixed(3)), parseFloat(py[1].toFixed(3))]);
        }
    }
    if (eje.length < 2) return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: eje, puntos: eje, calleCurvaAlpha: draftCalleCurvaAlpha };
    const geo = arq2_buildCalleCurvaGeometry(eje, arq2CalleCurvaAncho, draftCalleCurvaAlpha, arq2CalleRetorno);
    if (!geo) return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: eje, puntos: eje, calleCurvaAlpha: draftCalleCurvaAlpha };
    return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: geo.ejeOriginal, puntosSuavizados: geo.puntosSuavizados, ancho: geo.ancho, calleCurvaAlpha: geo.calleCurvaAlpha, calleRetorno: arq2CalleRetorno, ejeIsClosed: geo.ejeIsClosed, left: geo.left, right: geo.right, puntos: geo.fillPoly };
}
function arq2_syncCalleCurvaPanelUI() {
    const valEl = document.getElementById('arq2-calle-ancho-val');
    const slider = document.getElementById('arq2-calle-ancho');
    const bar = document.getElementById('arq2-calle-width-preview-bar');
    const alphaEl = document.getElementById('arq2-calle-alpha');
    const alphaVal = document.getElementById('arq2-calle-alpha-val');
    const cb = document.getElementById('arq2-calle-retorno');
    const colorEl = document.getElementById('arq2-calle-color');
    if (slider) slider.value = arq2CalleCurvaAncho;
    if (valEl) valEl.textContent = arq2CalleCurvaAncho.toFixed(1);
    if (bar) {
        bar.style.width = Math.max(8, Math.min(100, ((arq2CalleCurvaAncho - 4) / 11) * 100)) + '%';
        bar.style.opacity = String(draftCalleCurvaAlpha);
    }
    if (alphaEl) alphaEl.value = draftCalleCurvaAlpha;
    if (alphaVal) alphaVal.textContent = Math.round(draftCalleCurvaAlpha * 100) + '%';
    if (colorEl && typeof draftCalleCurvaColor !== 'undefined') colorEl.value = draftCalleCurvaColor;
    if (cb) cb.checked = arq2CalleRetorno;
}
function arq2_bindCalleCurvaAlphaSlider() {
    const alphaEl = document.getElementById('arq2-calle-alpha');
    if (!alphaEl || alphaEl.dataset.bound === '1') return;
    alphaEl.dataset.bound = '1';
    alphaEl.addEventListener('input', (e) => {
        draftCalleCurvaAlpha = Math.max(0.15, Math.min(1, parseFloat(e.target.value) || 0.55));
        arq2_syncCalleCurvaPanelUI();
        syncSVGElements();
        updateSVGPaths();
    });
}
function arq2_ensurePanelExtras() {
    const bindInput = (id, eventType, callback) => {
        const el = document.getElementById(id);
        if (el && !el.dataset.boundExtras) {
            el.dataset.boundExtras = '1';
            el.addEventListener(eventType, callback);
        }
    };

    const arq2_updateSelectedCalleCurva = () => {
        if (typeof arq2SelectedLineId !== 'undefined' && arq2SelectedLineId) {
            const line = window.allDrawnLines.find(l => l.id === arq2SelectedLineId);
            if (line && (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle')) {
                if (typeof arq2CalleCurvaAncho !== 'undefined') line.calleCurvaAncho = arq2CalleCurvaAncho;
                if (line.tipo === 'calle' && typeof arq2CalleCurvaAncho !== 'undefined') line.ancho = arq2CalleCurvaAncho;
                if (typeof draftCalleCurvaCurvatura !== 'undefined') line.calleCurvaCurvatura = draftCalleCurvaCurvatura;
                if (typeof draftCalleCurvaAlpha !== 'undefined') line.calleCurvaAlpha = draftCalleCurvaAlpha;
                if (line.tipo === 'calle' && typeof draftCalleCurvaAlpha !== 'undefined') line.alpha = draftCalleCurvaAlpha;
                line.calleColor = typeof draftCalleCurvaColor !== 'undefined' ? draftCalleCurvaColor : '#5a5f69';
                if (typeof arq2CalleRetorno !== 'undefined') line.calleRetorno = arq2CalleRetorno;
                if (typeof saveToLocal === 'function') saveToLocal();
            }
        }
    };

    bindInput('arq2-calle-ancho', 'input', (e) => {
        window.arq2CalleCurvaAncho = Math.max(2, Math.min(28, parseFloat(e.target.value) || 8));
        const valEl = document.getElementById('arq2-calle-ancho-val');
        if (valEl) valEl.textContent = window.arq2CalleCurvaAncho + 'm';
        if (typeof arq2_syncCalleCurvaPanelUI === 'function') arq2_syncCalleCurvaPanelUI();
        arq2_updateSelectedCalleCurva();
        if (typeof syncSVGElements === 'function') syncSVGElements();
        if (typeof updateSVGPaths === 'function') updateSVGPaths();
    });

    bindInput('arq2-calle-curvatura', 'input', (e) => {
        window.draftCalleCurvaCurvatura = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
        const valEl = document.getElementById('arq2-calle-curvatura-val');
        if (valEl) valEl.textContent = window.draftCalleCurvaCurvatura;
        arq2_updateSelectedCalleCurva();
        if (typeof syncSVGElements === 'function') syncSVGElements();
        if (typeof updateSVGPaths === 'function') updateSVGPaths();
    });

    bindInput('arq2-calle-alpha', 'input', (e) => {
        window.draftCalleCurvaAlpha = Math.max(0.15, Math.min(1, parseFloat(e.target.value) || 0.55));
        const valEl = document.getElementById('arq2-calle-alpha-val');
        if (valEl) valEl.textContent = Math.round(window.draftCalleCurvaAlpha * 100) + '%';
        arq2_updateSelectedCalleCurva();
        if (typeof syncSVGElements === 'function') syncSVGElements();
        if (typeof updateSVGPaths === 'function') updateSVGPaths();
    });

    bindInput('arq2-calle-retorno', 'change', (e) => {
        window.arq2CalleRetorno = !!e.target.checked;
        arq2_updateSelectedCalleCurva();
        if (typeof syncSVGElements === 'function') syncSVGElements();
        if (typeof updateSVGPaths === 'function') updateSVGPaths();
    });

    bindInput('arq2-calle-color', 'input', (e) => {
        window.draftCalleCurvaColor = e.target.value;
        arq2_updateSelectedCalleCurva();
        if (typeof syncSVGElements === 'function') syncSVGElements();
        if (typeof updateSVGPaths === 'function') updateSVGPaths();
    });

    bindInput('arq2-calle-no-snap', 'change', (e) => {
        document.body.classList.toggle('calle-no-snap-active', e.target.checked);
    });

    if (typeof arq2_bindPinRowButtons === 'function') arq2_bindPinRowButtons();
}

// =====================================================================
// ARQUITECTO 2.0 — Sistema de Pines (calco del Modo Pines Ctrl+P)
// =====================================================================

window.arq2PinSubTool = null; // 'horizonte' | 'ruta' | 'vista360' | 'casa360' | null

/**
 * Activa/desactiva un subtipo de pin en el panel Arq2.
 * Toggle: si ya estaba activo lo desactiva; si no, lo activa.
 * Gestiona ghost-mode para polígonos SVG.
 */
function arq2_setPinSubTool(tipo) {
    if (window.arq2PinSubTool === tipo) {
        // Toggle off
        window.arq2PinSubTool = null;
    } else {
        window.arq2PinSubTool = tipo;
    }

    // Ghost Mode: desactiva pointer-events en polígonos cuando hay un pin activo
    const pinActivo = window.arq2PinSubTool !== null;
    document.body.classList.toggle('arq2-pin-active', pinActivo);

    // Marcar visualmente el botón activo
    document.querySelectorAll('.arq2-pin-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.arq2Pin === window.arq2PinSubTool);
    });

    // Desactivar Línea Pines si estaba activa
    if (pinActivo && typeof deactivateLineaPines === 'function') {
        deactivateLineaPines();
    }
    
    // Desmarcar arq2-btn-linea-pines
    document.getElementById('arq2-btn-linea-pines')?.classList.toggle('active', false);
}

// Expose to window for Arq 3.0 (Motor Ferrari)
window.arq2_buildCalleCurvaGeometry = arq2_buildCalleCurvaGeometry;
window.arq2CalleCurvaAncho = 8;
window.draftCalleCurvaAlpha = 0.55;
window.arq2CalleRetorno = false;
window.draftCalleCurvaCurvatura = 5;
window.draftCalleCurvaColor = '#5a5f69';

/**
 * Bindea los botones de la fila de pines Arq2 (idempotente — no duplica listeners).
 */
function arq2_bindPinRowButtons() {
    // — Botones de tipo pin (Horizonte, Ruta, 360°, Casa) —
    document.querySelectorAll('.arq2-pin-btn').forEach(btn => {
        if (btn.dataset.pinRowBound) return;
        btn.dataset.pinRowBound = '1';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tipo = btn.dataset.arq2Pin;
            arq2_setPinSubTool(tipo);
        });
    });

    // — Línea Pines —
    const btnLP = document.getElementById('arq2-btn-linea-pines');
    if (btnLP && !btnLP.dataset.arq2Bound) {
        btnLP.dataset.arq2Bound = '1';
        btnLP.addEventListener('click', (e) => {
            e.stopPropagation();
            // Asegurar que el modo pines esté activo para que handleLineaPinesClick funcione
            if (!window.isDevModePinsActive) {
                if (typeof togglePinsMode === 'function') togglePinsMode(true);
            }
            if (typeof isLineaPinesActive !== 'undefined' && isLineaPinesActive) {
                if (typeof deactivateLineaPines === 'function') deactivateLineaPines();
                btnLP.classList.remove('active');
            } else {
                if (typeof activateLineaPines === 'function') activateLineaPines();
                btnLP.classList.add('active');
            }
            // Cancelar pin subtool si había uno activo
            if (window.arq2PinSubTool) arq2_setPinSubTool(null);
        });
    }

    // — Origen Drone —
    const btnDrone = document.getElementById('arq2-btn-drone');
    if (btnDrone && !btnDrone.dataset.arq2Bound) {
        btnDrone.dataset.arq2Bound = '1';
        btnDrone.addEventListener('click', () => {
            // Reusar el mismo handler que el botón clásico (o reproducirlo inline)
            const existingBtn = document.getElementById('btn-set-drone');
            if (existingBtn) { existingBtn.click(); return; }
            // Fallback inline (idéntico al handler de v-pins.js)
            let val = prompt('Fijar Coordenada del Drone (Lat, Lng)\nEj: -41.3245, -72.9832',
                window.OrigenDrone ? `${window.OrigenDrone.lat}, ${window.OrigenDrone.lng}` : '');
            if (val && val.includes(',')) {
                let parts = val.split(',');
                window.OrigenDrone = { lat: parseFloat(parts[0].trim()), lng: parseFloat(parts[1].trim()) };
                if (typeof saveToLocal === 'function') saveToLocal();
                document.getElementById('js-gmap-iframe') &&
                    (document.getElementById('js-gmap-iframe').src = `https://maps.google.com/maps?q=${window.OrigenDrone.lat},${window.OrigenDrone.lng}&t=k&z=16&ie=UTF8&iwloc=&output=embed`);
                if (typeof syncRutasDesdeOrigen === 'function')
                    syncRutasDesdeOrigen({ refreshAll: true }).then(() => alert('📍 Origen Drone fijado.\nDistancias recalculadas con tráfico.'));
            }
        });
    }

    // — Fijar Norte —
    const btnNorth = document.getElementById('arq2-btn-north');
    if (btnNorth && !btnNorth.dataset.arq2Bound) {
        btnNorth.dataset.arq2Bound = '1';
        btnNorth.addEventListener('click', () => {
            const existingBtn = document.getElementById('btn-set-north');
            if (existingBtn) { existingBtn.click(); return; }
            // Fallback inline
            if (!window.visor360) return;
            window.NorteOffset = window.visor360.getYaw();
            if (typeof saveToLocal === 'function') saveToLocal();
            alert('🧭 Brújula calibrada: El Norte Magnético apunta ahora a tu vista actual.');
            const compassDial = document.getElementById('js-compass');
            if (compassDial) compassDial.style.transform = `rotate(${-(window.visor360.getYaw() - window.NorteOffset)}deg)`;
        });
    }

    // — Limpiar Todo —
    const btnLimpiar = document.getElementById('arq2-btn-limpiar');
    if (btnLimpiar && !btnLimpiar.dataset.arq2Bound) {
        btnLimpiar.dataset.arq2Bound = '1';
        btnLimpiar.addEventListener('click', () => {
            if (typeof limpiarProyecto === 'function') { limpiarProyecto(); return; }
            // Fallback inline
            if (!confirm('⚠️ ¡ADVERTENCIA NUCLEAR! Vas a borrar TODOS los lotes, calles y pines.\n\n¿Estás seguro?')) return;
            if (typeof clearFranjaDraft === 'function') clearFranjaDraft();
            window.BaseDatosLotes = []; window.PuntosHorizonte = []; window.allDrawnLines = []; window.currentLinePoints = [];
            document.body.classList.remove('auto-macro-active', 'masterplan-premium-active');
            if (typeof refreshAllHotspots === 'function') refreshAllHotspots();
            localStorage.removeItem(window.FRESIA_CFG?.autosaveKey);
        });
    }
}