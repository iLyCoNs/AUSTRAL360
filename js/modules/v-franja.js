function lineIntersectsPolygon(lineA, lineB, poly) {
    if (!poly || poly.length < 3) return false;
    for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length;
        if (intersectSegments2D(lineA, lineB, poly[i], poly[j])) return true;
    }
    const c = polyCentroid(poly);
    if (!c) return false;
    const proj = projectPointOnSegment(c, lineA, lineB);
    return Math.hypot(c[0] - proj[0], c[1] - proj[1]) < 1.5;
}
function lineNearFranjaLot(lineA, lineB, lot) {
    if (lineIntersectsPolygon(lineA, lineB, lot.puntos)) return true;
    const c = polyCentroid(lot.puntos);
    if (!c) return false;
    const proj = projectPointOnSegment(c, lineA, lineB);
    const perp = Math.hypot(c[0] - proj[0], c[1] - proj[1]);
    const t = projectionT(c, lineA, lineB);
    return perp < 14 && t >= -0.08 && t <= 1.08;
}
function getFranjaLotPinPosition(lot, lineA, lineB) {
    const pts = lot.puntos;
    if (pts.length >= 4) {
        const topMid = lerpPY(pts[0], pts[1], 0.5);
        const botMid = lerpPY(pts[3], pts[2], 0.5);
        const hit = intersectSegments2D(topMid, botMid, lineA, lineB);
        if (hit) return hit;
    }
    const c = polyCentroid(pts);
    if (!c) return lineA;
    const onLine = projectPointOnSegment(c, lineA, lineB);
    return onLine;
}
function findPinForFranjaNumero(numero) {
    const n = parseInt(numero, 10);
    return BaseDatosLotes.find(p => p.tipo === 'lote' && (
        p.numero === numero || p.numero === String(n) ||
        (p.titulo && String(p.titulo).trim() === String(numero).trim()) ||
        (p.titulo && parseInt(String(p.titulo).replace(/\D/g, ''), 10) === n)
    ));
}
function syncLineaPinesPanelUI() {
    const status = document.getElementById('linea-pines-status');
    const n = lineaPinesPoints.length;
    const ready = n >= 2;
    if (status) {
        status.classList.toggle('is-ready', ready);
        status.textContent = ready
            ? `${n} puntos — pulsa Enter para alinear ${n >= 2 ? 'los pines' : ''}`
            : (n === 1 ? '1 punto — coloca el final de la línea guía' : 'Clic en el mapa: punto inicial y final de la fila');
    }
}
function deactivateLineaPines() {
    isLineaPinesActive = false;
    lineaPinesPoints = [];
    lineaPinesTempId = 'linea_pins_' + Date.now();
    window.lastMouseX = undefined;
    window.lastMouseY = undefined;
    document.getElementById('btn-linea-pines')?.classList.remove('active');
    document.body.classList.remove('linea-pines-active');
    document.getElementById('linea-pines-panel')?.classList.remove('open');
    syncLineaPinesPanelUI();
}
function activateLineaPines() {
    isLineaPinesActive = true;
    lineaPinesPoints = [];
    lineaPinesTempId = 'linea_pins_' + Date.now();
    document.getElementById('btn-linea-pines')?.classList.add('active');
    document.body.classList.add('linea-pines-active');
    document.getElementById('linea-pines-panel')?.classList.add('open');
    document.querySelectorAll('#dev-toolbar-pins .dev-btn[data-pintype]').forEach(b => b.classList.remove('active'));
    syncLineaPinesPanelUI();
    refreshAllHotspots(true);
}
function clearLineaPinesDraft() {
    lineaPinesPoints = [];
    lineaPinesTempId = 'linea_pins_' + Date.now();
    window.lastMouseX = undefined;
    window.lastMouseY = undefined;
    syncLineaPinesPanelUI();
    refreshAllHotspots(true);
}
function handleLineaPinesClick(mock) {
    const coords = visor360.mouseEventToCoords(mock);
    if (!coords || isNaN(coords[0])) return;
    lineaPinesPoints.push([coords[0], coords[1]]);
    syncLineaPinesPanelUI();
    syncSVGElements();
    updateSVGPaths();
    refreshAllHotspots(true);
}
function applyLineaPinesAlign() {
    if (lineaPinesPoints.length < 2) {
        alert('⚠️ Coloca al menos 2 puntos para definir la línea de alineación.');
        return false;
    }
    migrateFranjaGroupsFromData();
    const lots = allDrawnLines.filter(l => l.tipo === 'area-invisible' && l.franjaGrupo && l.franjaNumero && l.puntos.length >= 3);
    if (!lots.length) {
        alert('⚠️ No hay lotes de franja.\n\nCrea una franja con 🏘️ Franja Lotes (Modo Arquitecto) primero.');
        return false;
    }

    const defaultStatus = ['disponible', 'reservado', 'vendido', 'no_disponible'].includes(currentPinTypeMap) ? currentPinTypeMap : 'disponible';
    let updated = 0, created = 0;

    lots.forEach(lot => {
        let pinPt = null;
        // Calculamos el centro vertical exacto del lote actual
        const topMid = lerpPY(lot.puntos[0], lot.puntos[1], 0.5);
        const botMid = lerpPY(lot.puntos[3], lot.puntos[2], 0.5);

        // Disparamos un rayo láser para ver dónde cruza el trazo del usuario
        for (let i = 0; i < lineaPinesPoints.length - 1; i++) {
            const hit = intersectSegments2D(topMid, botMid, lineaPinesPoints[i], lineaPinesPoints[i+1]);
            if (hit) { pinPt = hit; break; }
        }

        // Si la línea no cruzó de arriba a abajo, buscamos el punto más cercano al centroide
        if (!pinPt) {
            const c = polyCentroid(lot.puntos);
            if (c) {
                let minDist = Infinity;
                for (let i = 0; i < lineaPinesPoints.length - 1; i++) {
                    const proj = projectPointOnSegment(c, lineaPinesPoints[i], lineaPinesPoints[i+1]);
                    const d = Math.hypot(c[0]-proj[0], c[1]-proj[1]);
                    if (d < minDist && d < 10) { minDist = d; pinPt = proj; }
                }
            }
        }

        if (pinPt) {
            const numero = lot.franjaNumero;
            const pitch = parseFloat(pinPt[0].toFixed(3));
            const yaw = parseFloat(pinPt[1].toFixed(3));
            let pin = findPinForFranjaNumero(numero);
            if (pin) { 
                pin.pitch = pitch; pin.yaw = yaw; updated++; 
            } else {
                BaseDatosLotes.push({ id: 'lp_' + lot.franjaGrupo + '_' + (lot.franjaIdx ?? 0) + '_' + Date.now(), tipo: 'lote', titulo: numero, numero: numero, status: defaultStatus, pitch, yaw });
                created++;
            }
        }
    });

    if (updated === 0 && created === 0) { 
        alert('⚠️ La línea no cruzó ningún lote de franja.\n\nAjusta el trazo para que atraviese la hilera de lotes.'); 
        return false; 
    }
    
    clearLineaPinesDraft();
    saveToLocal();
    refreshAllHotspots();
    flashScreenSuccess();
    return true;
}
function getPanoramaScreenProjector() {
    if (!visor360) return null;
    const ctnr = document.getElementById('panorama-container');
    const W = DOMCache.viewport.w || ctnr?.clientWidth || 0;
    const H = DOMCache.viewport.h || ctnr?.clientHeight || 0;
    const camP = visor360.getPitch() * Math.PI / 180, camYw = visor360.getYaw() * Math.PI / 180, hfov = visor360.getHfov();
    const scp = Math.sin(camP), ccp = Math.cos(camP), fc = 0.5 * W / Math.tan(hfov * Math.PI / 360), cxW = W / 2, cyH = H / 2;
    return {
        toScreen(pitch, yaw) {
            const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180, sp = Math.sin(p), cp2 = Math.cos(p);
            let yd = y - camYw; while (yd > Math.PI) yd -= 2 * Math.PI; while (yd < -Math.PI) yd += 2 * Math.PI;
            const sy = Math.sin(yd), cy2 = Math.cos(yd), z = sp * scp + cp2 * cy2 * ccp;
            return z > 0.0001 ? [cxW + (cp2 * sy / z) * fc, cyH - ((sp * ccp - cp2 * cy2 * scp) / z) * fc] : null;
        },
        toPY(sx, sy) {
            return screenPointToPanorama(DOMCache.viewport.left + sx, DOMCache.viewport.top + sy);
        },
        lerpSc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    };
}
function buildFranjaPointsFromCorners(TL, TR, BR, BL, N, splits) {
    const ts = splits && splits.length === N + 1 ? splits : Array.from({ length: N + 1 }, (_, i) => i / N);
    const proj = getPanoramaScreenProjector();
    const topPts = [], botPts = [];
    if (proj) {
        const tlSc = proj.toScreen(TL[0], TL[1]), trSc = proj.toScreen(TR[0], TR[1]);
        const brSc = proj.toScreen(BR[0], BR[1]), blSc = proj.toScreen(BL[0], BL[1]);
        if (tlSc && trSc && brSc && blSc) {
            for (let i = 0; i <= N; i++) {
                const t = ts[i];
                const tp = proj.toPY(...proj.lerpSc(tlSc, trSc, t)), bp = proj.toPY(...proj.lerpSc(blSc, brSc, t));
                if (!tp || !bp) break;
                topPts.push(tp); botPts.push(bp);
            }
            if (topPts.length === N + 1) return { topPts, botPts };
            topPts.length = 0; botPts.length = 0;
        }
    }
    for (let i = 0; i <= N; i++) {
        const t = ts[i];
        topPts.push(lerpPY(TL, TR, t)); botPts.push(lerpPY(BL, BR, t));
    }
    return { topPts, botPts };
}
function syncMacroActiveClass() {
    document.body.classList.toggle('auto-macro-active',
        allDrawnLines.some(l => isMacroEdgeType(l.tipo) || l.tipo === 'area-invisible' || l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo'));
}
function syncFranjaVisualsOnReady() {
    migrateFranjaGroupsFromData();
    allDrawnLines.filter(l => l.tipo === 'franja-grupo').forEach(g => rebuildFranjaGroup(g.id));
    allDrawnLines.filter(l => l.tipo === 'franja-curva-grupo').forEach(g => rebuildFranjaCurvaGroup(g.id));
    ensureFranjaIntegrity();
    syncMacroActiveClass();
}
function ensureFranjaSplits(grp) {
    const N = grp.franjaCount || 2;
    if (!grp.franjaSplits || grp.franjaSplits.length !== N + 1) {
        grp.franjaSplits = Array.from({ length: N + 1 }, (_, i) => i / N);
    }
    return grp.franjaSplits;
}
function weightsToFranjaSplits(weights) {
    const w = weights.map(v => Math.max(0.001, parseFloat(String(v).replace(',', '.')) || 1));
    const total = w.reduce((a, b) => a + b, 0);
    const splits = [0];
    let acc = 0;
    for (let i = 0; i < w.length - 1; i++) {
        acc += w[i];
        splits.push(acc / total);
    }
    splits.push(1);
    return splits;
}
function getFranjaSplitTs(N, customSplits) {
    if (customSplits && customSplits.length === N + 1) return customSplits;
    return Array.from({ length: N + 1 }, (_, i) => i / N);
}
function inferFranjaSplitsFromLotes(corners, sortedLotes) {
    const N = sortedLotes.length;
    const [TL, TR] = corners;
    const splits = [0];
    const proj = getPanoramaScreenProjector();
    let tlSc = null, trSc = null, len2 = 0, dx = 0, dy = 0;
    if (proj) {
        tlSc = proj.toScreen(TL[0], TL[1]); trSc = proj.toScreen(TR[0], TR[1]);
        if (tlSc && trSc) { dx = trSc[0] - tlSc[0]; dy = trSc[1] - tlSc[1]; len2 = dx * dx + dy * dy; }
    }
    for (let i = 1; i < N; i++) {
        const lot = sortedLotes[i];
        const sep = lot.puntos && lot.puntos[0];
        let t = i / N;
        if (tlSc && trSc && len2 > 1 && sep) {
            const sc = proj.toScreen(sep[0], sep[1]);
            if (sc) t = Math.max(0.01, Math.min(0.99, ((sc[0] - tlSc[0]) * dx + (sc[1] - tlSc[1]) * dy) / len2));
        }
        splits.push(t);
    }
    splits.push(1);
    for (let i = 1; i < splits.length - 1; i++) splits[i] = Math.max(splits[i - 1] + 0.02, splits[i]);
    splits[splits.length - 1] = 1; splits[0] = 0;
    return splits;
}
function promoteMacroEdgesToFranja(edges) {
    if (!edges || edges.length < 3) return false;
    const divisoria = edges.filter(e => e.tipo === 'divisoria');
    const borde = edges.filter(e => e.tipo === 'borde-macro');
    const pool = borde.length >= 3 ? borde : edges;
    const allPts = [];
    pool.forEach(e => e.puntos.forEach(p => allPts.push(p)));
    const proj = getPanoramaScreenProjector();
    if (!proj) return false;
    const tagged = allPts.map(p => ({ py: p, sc: proj.toScreen(p[0], p[1]) })).filter(x => x.sc);
    if (tagged.length < 4) return false;
    const TL = tagged.reduce((m, p) => p.sc[0] + p.sc[1] < m.sc[0] + m.sc[1] ? p : m).py;
    const TR = tagged.reduce((m, p) => p.sc[0] - p.sc[1] > m.sc[0] - m.sc[1] ? p : m).py;
    const BR = tagged.reduce((m, p) => p.sc[0] + p.sc[1] > m.sc[0] + m.sc[1] ? p : m).py;
    const BL = tagged.reduce((m, p) => p.sc[0] - p.sc[1] < m.sc[0] - m.sc[1] ? p : m).py;
    const N = Math.max(2, divisoria.length + 1);
    const corners = [TL, TR, BR, BL].map(p => [...p]);
    let splits = Array.from({ length: N + 1 }, (_, i) => i / N);
    const tlSc = proj.toScreen(TL[0], TL[1]), trSc = proj.toScreen(TR[0], TR[1]);
    if (divisoria.length && tlSc && trSc) {
        const dx = trSc[0] - tlSc[0], dy = trSc[1] - tlSc[1], len2 = dx * dx + dy * dy;
        if (len2 > 1) {
            const divTs = divisoria.map(div => {
                const mid = [(div.puntos[0][0] + div.puntos[1][0]) / 2, (div.puntos[0][1] + div.puntos[1][1]) / 2];
                const msc = proj.toScreen(mid[0], mid[1]);
                return msc ? ((msc[0] - tlSc[0]) * dx + (msc[1] - tlSc[1]) * dy) / len2 : null;
            }).filter(t => t !== null).sort((a, b) => a - b);
            if (divTs.length) {
                splits = [0, ...divTs, 1];
                for (let i = 1; i < splits.length - 1; i++) splits[i] = Math.max(splits[i - 1] + 0.02, Math.min(0.98, splits[i]));
                splits[splits.length - 1] = 1;
            }
        }
    }
    const edgeIds = new Set(edges.map(e => e.id));
    allDrawnLines = allDrawnLines.filter(l => !edgeIds.has(l.id));
    const gid = 'franja_' + Date.now();
    allDrawnLines.push({ id: gid, tipo: 'franja-grupo', franjaCount: N, puntos: corners, franjaSplits: splits });
    rebuildFranjaGroup(gid);
    return true;
}
function ensureFranjaIntegrity() {
    migrateFranjaGroupsFromData();
    allDrawnLines.filter(l => l.tipo === 'franja-grupo').forEach(g => {
        const nFills = allDrawnLines.filter(l => l.franjaGrupo === g.id && l.tipo === 'area-invisible').length;
        if (nFills !== (g.franjaCount || 0)) rebuildFranjaGroup(g.id);
    });
    allDrawnLines.filter(l => l.tipo === 'franja-curva-grupo').forEach(g => {
        const nFills = allDrawnLines.filter(l => l.franjaGrupo === g.id && l.tipo === 'area-invisible').length;
        if (nFills !== (g.franjaCount || 0)) rebuildFranjaCurvaGroup(g.id);
    });
    const orphans = allDrawnLines.filter(l => l.tipo === 'area-invisible' && !l.franjaGrupo);
    if (orphans.length >= 2) { promoteClusterToFranja(orphans); return; }
    const orphanEdges = allDrawnLines.filter(l => isMacroEdgeType(l.tipo) && !l.franjaGrupo);
    if (orphanEdges.length >= 3) promoteMacroEdgesToFranja(orphanEdges);
    ensureStitchedDivisorias();
    syncMacroActiveClass();
}
function distPointToSegment2D(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    if (len2 < 0.0001) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function pointInPolygonPY(p, y, pts) {
    if (!pts || pts.length < 3) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
        if (((yi > y) !== (yj > y)) && (p < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
    }
    return inside;
}
function findClosestLineAtPanorama(p, y, maxDist) {
    let bestId = null, bestD = maxDist;
    allDrawnLines.forEach(line => {
        const pts = line.puntos;
        if (!pts || pts.length < 1) return;
        pts.forEach(pt => {
            const d = Math.hypot(pt[0] - p, pt[1] - y);
            if (d < bestD) { bestD = d; bestId = line.id; }
        });
        const closed = line.tipo !== 'calle' && line.tipo !== 'cortar' && line.tipo !== 'divisoria' && line.tipo !== 'borde-macro' && pts.length >= 3;
        if (closed && pointInPolygonPY(p, y, pts)) {
            const cP = pts.reduce((s, pt) => s + pt[0], 0) / pts.length, cY = pts.reduce((s, pt) => s + pt[1], 0) / pts.length;
            const d = Math.hypot(cP - p, cY - y);
            if (d < bestD) { bestD = d; bestId = line.id; }
        }
        for (let i = 0; i < pts.length; i++) {
            if (line.tipo !== 'cortar' && !closed && i === pts.length - 1) break;
            const a = pts[i], b = pts[(i + 1) % pts.length];
            const d = distPointToSegment2D(p, y, a[0], a[1], b[0], b[1]);
            if (d < bestD) { bestD = d; bestId = line.id; }
        }
    });
    return bestId;
}
function findClosestLineAtScreen(clientX, clientY, maxPx) {
    const proj = getPanoramaScreenProjector();
    if (!proj) return null;
    const sx = clientX - DOMCache.viewport.left, sy = clientY - DOMCache.viewport.top;
    let bestId = null, bestD = maxPx;
    allDrawnLines.forEach(line => {
        const pts = line.puntos;
        if (!pts || pts.length < 1) return;
        const closed = line.tipo !== 'calle' && line.tipo !== 'cortar' && line.tipo !== 'divisoria' && line.tipo !== 'borde-macro' && pts.length >= 3;
        const scPts = pts.map(pt => proj.toScreen(pt[0], pt[1])).filter(Boolean);
        if (closed && scPts.length >= 3) {
            let inside = false;
            for (let i = 0, j = scPts.length - 1; i < scPts.length; j = i++) {
                const xi = scPts[i][0], yi = scPts[i][1], xj = scPts[j][0], yj = scPts[j][1];
                if (((yi > sy) !== (yj > sy)) && (sx < (xj - xi) * (sy - yi) / (yj - yi + 1e-12) + xi)) inside = !inside;
            }
            if (inside) {
                const cx = scPts.reduce((s, p) => s + p[0], 0) / scPts.length;
                const cy = scPts.reduce((s, p) => s + p[1], 0) / scPts.length;
                const d = Math.hypot(sx - cx, sy - cy);
                if (d < bestD) { bestD = d; bestId = line.id; }
            }
        }
        for (let i = 0; i < pts.length; i++) {
            if (line.tipo !== 'cortar' && !closed && i === pts.length - 1) break;
            const p1 = proj.toScreen(pts[i][0], pts[i][1]), p2 = proj.toScreen(pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]);
            if (!p1 || !p2) continue;
            const d = distPointToSegment2D(sx, sy, p1[0], p1[1], p2[0], p2[1]);
            if (d < bestD) { bestD = d; bestId = line.id; }
        }
    });
    return bestId;
}
function applyEraserDelete(lineId) {
    if (lineId === currentTempLineId) { currentLinePoints = []; return true; }
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line) return false;
    if (line.tipo === 'fila-variable-lote') {
        allDrawnLines = allDrawnLines.filter(l => l.id !== line.id && l.arq2Grupo !== line.id);
        return true;
    }
    const gid = line.tipo === 'franja-grupo' ? line.id : (line.franjaGrupo || null);
    if (gid) {
        allDrawnLines = allDrawnLines.filter(l => {
            if (l.id === gid || l.franjaGrupo === gid) return false;
            if (l.franjaStitch === gid || (l.franjaGrupo === gid)) return false;
            return true;
        });
        if (!allDrawnLines.some(l => l.tipo === 'franja-grupo' || isMacroEdgeType(l.tipo) || l.tipo === 'area-invisible')) {
            document.body.classList.remove('auto-macro-active');
        }
        return true;
    }
    allDrawnLines = allDrawnLines.filter(l => l.id !== lineId);
    return true;
}
function runEraserAtEvent(mock) {
    if (!visor360) return;
    const coords = visor360.mouseEventToCoords(mock);
    if (!coords) return;
    const lineId = findClosestLineAtScreen(mock.clientX, mock.clientY, 32)
        || findClosestLineAtPanorama(coords[0], coords[1], 8);
    if (lineId) {
        applyEraserDelete(lineId);
        refreshAllHotspots(true);
        saveToLocal();
    }
}
function bindSvgEraser(el, lineId) {
    if (!el || el.dataset.eraserBound) return;
    el.dataset.eraserBound = '1';
    const onErase = (e) => {
        if (currentLineType !== 'eraser' && arq2Tool !== 'eraser') return;
        e.stopPropagation(); e.preventDefault();
        applyEraserDelete(lineId);
        refreshAllHotspots(true);
        saveToLocal();
    };
    el.addEventListener('mousedown', onErase);
    el.addEventListener('touchstart', onErase, { passive: false });
}
function sortLotesAlongStrip(lotes) {
    return [...lotes].sort((a, b) => {
        const ca = a.puntos.reduce((s, p, i) => i ? s + p[1] : p[1], 0) / a.puntos.length;
        const cb = b.puntos.reduce((s, p, i) => i ? s + p[1] : p[1], 0) / b.puntos.length;
        if (Math.abs(ca - cb) > 0.5) return ca - cb;
        const pa = a.puntos.reduce((s, p) => s + p[0], 0) / a.puntos.length;
        const pb = b.puntos.reduce((s, p) => s + p[0], 0) / b.puntos.length;
        return pa - pb;
    });
}
function purgeAllNonFranjaLoteTrazos() {
    allDrawnLines = allDrawnLines.filter(l => {
        if (l.tipo === 'franja-grupo' || l.franjaGrupo || isMacroEdgeType(l.tipo)) return true;
        if (l.tipo === 'calle' || l.tipo === 'cortar' || l.tipo === 'neon') return true;
        if (isAutoMacroLotePoly(l)) return false;
        return true;
    });
}
function promoteClusterToFranja(children) {
    if (!children || children.length < 2) return false;
    const sorted = sortLotesAlongStrip(children);
    const N = sorted.length;
    const first = sorted[0].puntos, last = sorted[N - 1].puntos;
    if (!first || first.length < 4 || !last || last.length < 4) return false;
    const childIds = new Set(sorted.map(c => c.id));
    allDrawnLines = allDrawnLines.filter(l => {
        if (childIds.has(l.id)) return false;
        if (isMacroEdgeType(l.tipo) && !l.franjaGrupo) return false;
        return true;
    });
    const corners = [first[0], first[1], last[2], last[3]].map(p => [...p]);
    const gid = 'franja_' + Date.now();
    allDrawnLines.push({
        id: gid, tipo: 'franja-grupo', franjaCount: N,
        puntos: corners, franjaSplits: inferFranjaSplitsFromLotes(corners, sorted)
    });
    rebuildFranjaGroup(gid);
    return true;
}
function applyFranjaDivDrag(gid, splitIdx, clientX, clientY) {
    const grp = allDrawnLines.find(l => l.id === gid && (l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo'));
    if (!grp) return;
    const splits = ensureFranjaSplits(grp);
    const proj = getPanoramaScreenProjector();
    if (!proj) return;
    const minGap = 0.025;
    let t;
    if (grp.tipo === 'franja-curva-grupo') {
        t = projectScreenTOnPolyline(grp.frente, clientX, clientY, proj);
        if (t == null) return;
    } else {
        const [TL, TR] = grp.puntos;
        const tlSc = proj.toScreen(TL[0], TL[1]), trSc = proj.toScreen(TR[0], TR[1]);
        if (!tlSc || !trSc) return;
        const sx = clientX - DOMCache.viewport.left, sy = clientY - DOMCache.viewport.top;
        const dx = trSc[0] - tlSc[0], dy = trSc[1] - tlSc[1];
        const len2 = dx * dx + dy * dy;
        if (len2 < 1) return;
        t = ((sx - tlSc[0]) * dx + (sy - tlSc[1]) * dy) / len2;
    }
    t = Math.max(splits[splitIdx - 1] + minGap, Math.min(splits[splitIdx + 1] - minGap, t));
    splits[splitIdx] = t;
    if (grp.tipo === 'franja-curva-grupo') rebuildFranjaCurvaGroup(gid);
    else rebuildFranjaGroup(gid);
}
function getPathClassForLine(line) {
    if (line.tipo === 'masterplan_fill') return 'linea-relleno-mp';
    if (line.tipo === 'neon') return 'linea-neon';
    if (line.tipo === 'punteada') return 'linea-punteada';
    if (line.tipo === 'cortar') return 'linea-corte';
    if (line.tipo === 'area-invisible') return 'linea-area-fill';
    if (line.tipo === 'divisoria') return 'linea-divisoria';
    if (line.tipo === 'borde-macro') return 'linea-borde-macro';
    if (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote') return 'linea-solida';
    return 'linea-solida';
}
function resolveSvgLayerForLine(line, layers) {
    const { lLotes, lAristas } = layers;
    if (!line) return lLotes;
    if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
        const lArq2 = document.getElementById('layer-calles-arq2');
        return lArq2 || layers.lAsfalto || lLotes;
    }
    if (line.tipo === 'divisoria' || line.tipo === 'borde-macro') return lAristas;
    if (line.tipo === 'arista_solida' || line.tipo === 'arista_punteada') return lAristas;
    if (line.tipo === 'franja-preview-div' || line.tipo === 'linea-pines-guia') return lAristas;
    if (line.tipo === 'franja-grupo' || line.tipo === 'franja-curva-grupo' || line.tipo === 'franja-preview') return lLotes;
    return lLotes;
}
function ensureSvgLayerOrder(svg) {
    if (!svg) return;
    ['layer-calles-bordes', 'layer-calles-asfalto', 'layer-calles-arq2', 'layer-lotes', 'layer-aristas', 'arq2-demo-layer', 'layer-arq2-feedback'].forEach(id => {
        const g = document.getElementById(id);
        if (g && g.parentNode === svg) svg.appendChild(g);
    });
}
function straightenFranjaGroup(gid) {
    const grp = allDrawnLines.find(l => l.id === gid && (l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo'));
    if (!grp) return false;
    
    if (grp.tipo === 'franja-curva-grupo') {
        grp.tipo = 'franja-grupo';
        grp.puntos = [grp.frente[0], grp.frente[grp.frente.length-1], grp.fondo[grp.fondo.length-1], grp.fondo[0]];
        delete grp.frente; delete grp.fondo;
        rebuildFranjaGroup(gid);
        return true;
    }

    if (grp.puntos.length < 4) return false;
    const proj = getPanoramaScreenProjector();
    if (!proj) return false;
    const scPts = grp.puntos.map(py => ({ sc: proj.toScreen(py[0], py[1]) })).filter(p => p.sc);
    if (scPts.length < 4) return false;
    const TLsc = scPts.reduce((m, p) => p.sc[0] + p.sc[1] < m.sc[0] + m.sc[1] ? p : m).sc;
    const TRsc = scPts.reduce((m, p) => p.sc[0] - p.sc[1] > m.sc[0] - m.sc[1] ? p : m).sc;
    const BRsc = scPts.reduce((m, p) => p.sc[0] + p.sc[1] > m.sc[0] + m.sc[1] ? p : m).sc;
    const BLsc = scPts.reduce((m, p) => p.sc[0] - p.sc[1] < m.sc[0] - m.sc[1] ? p : m).sc;
    const nTL = proj.toPY(TLsc[0], TLsc[1]), nTR = proj.toPY(TRsc[0], TRsc[1]);
    const nBR = proj.toPY(BRsc[0], BRsc[1]), nBL = proj.toPY(BLsc[0], BLsc[1]);
    if (!nTL || !nTR || !nBR || !nBL) return false;
    grp.puntos = [nTL, nTR, nBR, nBL];
    rebuildFranjaGroup(gid);
    return true;
}
function enderezarFranjas() {
    migrateFranjaGroupsFromData();
    const grupos = allDrawnLines.filter(l => l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo');
    if (!grupos.length) return alert('No hay franjas de lotes.\n\nUsa 🏘️ Franja Lotes, 〰️ Franja Curva o ✨ AUTO-MACRO primero.');
    if (!confirm(`📏 ENDEREZAR ${grupos.length} franja(s)\n\n• Bordes superiores/inferiores rectos\n• Divisiones verticales alineadas\n• Estilo levantamiento topográfico\n\n¿Continuar?`)) return;
    let ok = 0;
    grupos.forEach(g => { if (straightenFranjaGroup(g.id)) ok++; });
    if (ok) { refreshAllHotspots(); saveToLocal(); flashScreenSuccess(); }
    else alert('⚠️ Enderezado incompleto. Centra la vista para ver toda la franja en pantalla.');
}
function getFranjaChildLines(gid) {
    return allDrawnLines.filter(l => l.franjaGrupo === gid && l.tipo === 'area-invisible');
}
function rebuildMacroEdgesForFranjaGroup(gid) {
    const lotes = getFranjaChildLines(gid);
    if (!lotes.length) return;
    allDrawnLines = allDrawnLines.filter(l => !(l.franjaGrupo === gid && (l.tipo === 'divisoria' || l.tipo === 'borde-macro')));
    const { macroLines } = buildAutoMacroFromLotes(lotes);
    macroLines.forEach(m => { m.franjaGrupo = gid; });
    allDrawnLines.push(...macroLines);
}
function getFranjaStripById(gid) {
    return allDrawnLines.find(l => l.id === gid && (l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo'));
}
function normalizeFranjaStripToRect(gid) {
    const grp = getFranjaStripById(gid);
    if (!grp) return null;
    if (grp.tipo === 'franja-curva-grupo') straightenFranjaGroup(gid);
    return allDrawnLines.find(l => l.id === gid && l.tipo === 'franja-grupo') || null;
}
function resamplePolylineToCount(pts, count) {
    if (!pts?.length || count < 2) return pts ? pts.map(p => [...p]) : [];
    const out = [];
    for (let i = 0; i < count; i++) out.push(getPointAlongPolyline(pts, i / (count - 1)));
    return out;
}
function getScreenOverlapX(a, b) {
    const left = Math.max(a.left, b.left), right = Math.min(a.right, b.right);
    return right - left >= 10 ? { left, right, width: right - left } : null;
}
function isFranjaLotCentroidVisible(linea) {
    if (!linea?.franjaGrupo || !linea.puntos?.length) return true;
    const rect = getFranjaGrupoScreenRects().find(r => r.gid === linea.franjaGrupo);
    const proj = getPanoramaScreenProjector();
    if (!rect || !proj) return true;
    let cP = 0, cY = 0;
    linea.puntos.forEach(pt => { cP += pt[0]; cY += pt[1]; });
    cP /= linea.puntos.length; cY /= linea.puntos.length;
    const sc = proj.toScreen(cP, cY);
    if (!sc) return false;
    const pad = 16;
    return sc[0] >= rect.left - pad && sc[0] <= rect.right + pad && sc[1] >= rect.top - pad && sc[1] <= rect.bottom + pad;
}
function pyDist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function assignPyIfChanged(target, idx, next, changedRef, tol) {
    if (pyDist(target[idx], next) > tol) { target[idx] = next; changedRef.v = true; }
}
function weldFranjaCurvaToNeighbors(gid) {
    const grp = getFranjaStripById(gid);
    if (!grp || grp.tipo !== 'franja-curva-grupo') return false;
    const proj = getPanoramaScreenProjector();
    const nr = getFranjaGrupoScreenRects().find(r => r.gid === gid);
    if (!proj || !nr) return false;
    const SNAP = 52;
    const CORNER_SNAP = 56;
    const TOL = 0.025;
    const changed = { v: false };
    getFranjaGrupoScreenRects().forEach(or => {
        if (or.gid === gid) return;
        const neighbor = getFranjaStripById(or.gid);
        if (!neighbor) return;
        
        let cornerList = [];
        if (neighbor.tipo === 'franja-grupo' && neighbor.puntos?.length >= 4) {
            cornerList = [neighbor.puntos[0], neighbor.puntos[1], neighbor.puntos[2], neighbor.puntos[3]];
        } else if (neighbor.tipo === 'franja-curva-grupo' && neighbor.frente?.length && neighbor.fondo?.length) {
            cornerList = [
                neighbor.frente[0], neighbor.frente[neighbor.frente.length - 1],
                neighbor.fondo[0], neighbor.fondo[neighbor.fondo.length - 1]
            ];
        }
        
        const nF = grp.frente.length - 1, nB = grp.fondo.length - 1;
        if (nF < 1 || nB < 1) return;
        const ovl = getScreenOverlapX(nr, or);
        
        if (ovl && Math.abs(nr.bottom - or.top) < SNAP) {
            const pL = proj.toPY(ovl.left, or.top), pR = proj.toPY(ovl.right, or.top);
            if (pL && pR) {
                for (let i = 0; i <= nB; i++) assignPyIfChanged(grp.fondo, i, lerpPY(pL, pR, i / nB), changed, TOL);
            }
        } else if (ovl && Math.abs(nr.top - or.bottom) < SNAP) {
            const pL = proj.toPY(ovl.left, or.bottom), pR = proj.toPY(ovl.right, or.bottom);
            if (pL && pR) {
                for (let i = 0; i <= nF; i++) assignPyIfChanged(grp.frente, i, lerpPY(pL, pR, i / nF), changed, TOL);
            }
        }
        
        if (cornerList.length === 4) {
            const snapIdx = (arr, idx) => {
                const sc = proj.toScreen(arr[idx][0], arr[idx][1]);
                if (!sc) return;
                let best = arr[idx], bestD = CORNER_SNAP;
                cornerList.forEach(c => {
                    const cs = proj.toScreen(c[0], c[1]);
                    if (!cs) return;
                    const d = Math.hypot(sc[0] - cs[0], sc[1] - cs[1]);
                    if (d < bestD) { bestD = d; best = [...c]; }
                });
                assignPyIfChanged(arr, idx, best, changed, TOL);
            };
            snapIdx(grp.frente, 0); snapIdx(grp.frente, nF);
            snapIdx(grp.fondo, 0); snapIdx(grp.fondo, nB);
        }
    });
    
    if (changed.v) {
        rebuildFranjaCurvaGroup(gid);
        ensureStitchedDivisorias();
        getFranjaGrupoScreenRects().forEach(or => {
            if (or.gid === gid) return;
            const nb = getFranjaStripById(or.gid);
            if (nb?.tipo === 'franja-grupo') rebuildFranjaGroup(or.gid);
        });
    }
    return changed.v;
}
function getFranjaSplitRailPoints(grp) {
    const N = grp.franjaCount || 2;
    const splits = ensureFranjaSplits(grp);
    if (grp.tipo === 'franja-grupo' && grp.puntos?.length >= 4) {
        const built = buildFranjaPointsFromCorners(grp.puntos[0], grp.puntos[1], grp.puntos[2], grp.puntos[3], N, splits);
        return built ? { topPts: built.topPts, botPts: built.botPts, N, splits } : null;
    }
    if (grp.tipo === 'franja-curva-grupo' && grp.frente?.length >= 2 && grp.fondo?.length >= 2) {
        const topPts = [], botPts = [];
        for (let i = 0; i <= N; i++) {
            topPts.push(getPointAlongPolyline(grp.frente, splits[i]));
            botPts.push(getPointAlongPolyline(grp.fondo, splits[i]));
        }
        return { topPts, botPts, N, splits };
    }
    return null;
}
function injectFranjaInternalDivisorias(macroLines, gid, topPts, botPts, N) {
    const out = [...macroLines];
    for (let i = 1; i < N; i++) {
        const p1 = [...topPts[i]], p2 = [...botPts[i]];
        let hasDiv = out.some(m => m.tipo === 'divisoria' && m.puntos?.length >= 2 && edgeMatchesLine(m.puntos[0], m.puntos[1], p1, p2, 0.15));
        if (!hasDiv) {
            out.push({ id: 'div_int_' + gid + '_' + i, tipo: 'divisoria', puntos: [p1, p2], franjaGrupo: gid, franjaDivIdx: i });
        }
        out.forEach((m, j) => {
            if (m.tipo === 'borde-macro' && m.puntos?.length >= 2 && edgeMatchesLine(m.puntos[0], m.puntos[1], p1, p2, 0.15)) {
                out[j] = { ...m, tipo: 'divisoria' };
            }
        });
    }
    return out;
}
function projectScreenTOnPolyline(pts, clientX, clientY, proj) {
    const sx = clientX - DOMCache.viewport.left, sy = clientY - DOMCache.viewport.top;
    const hit = proj.toPY(sx, sy);
    if (!hit) return null;
    const len = getPolylineLength(pts);
    if (len < 1e-6) return 0;
    let bestT = 0, bestD = Infinity, acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
        const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
        const dx = bx - ax, dy = by - ay, segLen2 = dx * dx + dy * dy;
        const segLen = Math.hypot(dx, dy);
        let segT = segLen2 < 1e-9 ? 0 : ((hit[0] - ax) * dx + (hit[1] - ay) * dy) / segLen2;
        segT = Math.max(0, Math.min(1, segT));
        const px = ax + segT * dx, py = ay + segT * dy;
        const dist = Math.hypot(hit[0] - px, hit[1] - py);
        if (dist < bestD) { bestD = dist; bestT = (acc + segT * segLen) / len; }
        acc += segLen;
    }
    return bestT;
}
function rebuildFranjaGroup(gid) {
    const grp = allDrawnLines.find(l => l.id === gid && l.tipo === 'franja-grupo');
    if (!grp || grp.puntos.length < 4) return;
    const N = grp.franjaCount || 2;
    const splits = ensureFranjaSplits(grp);
    allDrawnLines = allDrawnLines.filter(l => l.franjaGrupo !== gid);
    const rails = getFranjaSplitRailPoints(grp);
    if (!rails) return;
    const { topPts, botPts } = rails;
    const draftPolys = [];
    for (let i = 0; i < N; i++) {
        draftPolys.push({
            id: gid + '_' + i, tipo: 'solida', franjaGrupo: gid, franjaIdx: i,
            franjaNumero: String(i + 1).padStart(2, '0'),
            puntos: [topPts[i], topPts[i + 1], botPts[i + 1], botPts[i]]
        });
    }
    const { invisibleFills, macroLines } = buildAutoMacroFromLotes(draftPolys);
    let edges = injectFranjaInternalDivisorias(macroLines, gid, topPts, botPts, N);
    invisibleFills.forEach((f, i) => {
        f.franjaGrupo = gid; f.franjaIdx = i; f.franjaNumero = draftPolys[i].franjaNumero; f.id = gid + '_' + i;
    });
    edges.forEach(m => { m.franjaGrupo = gid; });
    allDrawnLines.push(...invisibleFills, ...edges);
    document.body.classList.add('auto-macro-active');
}
function migrateFranjaGroupsFromData() {
    const childRe = /^franja_\d+_\d+$/;
    const groups = new Map();
    allDrawnLines.forEach(l => {
        if (!childRe.test(l.id) || !isAutoMacroLotePoly(l)) return;
        const gid = l.id.replace(/_\d+$/, '');
        if (!groups.has(gid)) groups.set(gid, []);
        groups.get(gid).push(l);
    });
    groups.forEach((children, gid) => {
        if (allDrawnLines.some(l => l.id === gid && l.tipo === 'franja-grupo')) return;
        const sorted = [...children].sort((a, b) => parseInt(a.id.split('_').pop()) - parseInt(b.id.split('_').pop()));
        if (!sorted.length) return;
        const N = sorted.length;
        const first = sorted[0].puntos, last = sorted[N-1].puntos;
        if (!first || first.length < 4 || !last || last.length < 4) return;
        allDrawnLines.push({
            id: gid, tipo: 'franja-grupo', franjaCount: N,
            puntos: [first[0], first[1], last[2], last[3]].map(p => [...p])
        });
        sorted.forEach((c, i) => {
            c.franjaGrupo = gid; c.franjaIdx = i; c.franjaNumero = String(i + 1).padStart(2, '0');
        });
    });
}
function createFranjaFromPolygon(poly, N) {
    if (!poly || poly.puntos.length < 4) return false;
    const gid = 'franja_' + Date.now();
    allDrawnLines = allDrawnLines.filter(l => l.id !== poly.id);
    allDrawnLines.push({
        id: gid, tipo: 'franja-grupo', franjaCount: N,
        puntos: poly.puntos.slice(0, 4).map(p => [...p])
    });
    rebuildFranjaGroup(gid);
    return true;
}
function collectLotesForAutoMacro() {
    migrateFranjaGroupsFromData();
    const grupos = allDrawnLines.filter(l => l.tipo === 'franja-grupo');
    let lotes = allDrawnLines.filter(l => isAutoMacroLotePoly(l) && l.tipo !== 'franja-grupo');
    if (grupos.length) return { mode: 'franja-rebuild', grupos, lotes };
    if (lotes.length >= 2) return { mode: 'macro', lotes };
    if (lotes.length === 1 && lotes[0].puntos.length >= 4) return { mode: 'subdivide', lotes };
    return { mode: 'none', lotes: [] };
}
function syncFranjaVertexDrag(linea, idx, coords) {
    const old = [...linea.puntos[idx]];
    getFranjaChildLines(linea.franjaGrupo).forEach(l => {
        l.puntos.forEach((pt, i) => {
            if (Math.hypot(pt[0]-old[0], pt[1]-old[1]) < 0.08) l.puntos[i] = [coords[0], coords[1]];
        });
    });
    linea.puntos[idx] = [coords[0], coords[1]];
}
function applyDraggedVertexCoords(coords) {
    if (!draggingVertex || !coords || isNaN(coords[0])) return;
    if (draggingVertex.lineId === currentTempLineId) {
        currentLinePoints[draggingVertex.idx] = [coords[0], coords[1]];
        return;
    }
    const linea = allDrawnLines.find(l => l.id === draggingVertex.lineId);
    if (!linea) return;
    if (linea.tipo === 'franja-grupo') {
        linea.puntos[draggingVertex.idx] = [coords[0], coords[1]];
        rebuildFranjaGroup(linea.id);
        return;
    }
    if (linea.tipo === 'franja-curva-grupo') {
        if (draggingVertex.target === 'frente') linea.frente[draggingVertex.idx] = [coords[0], coords[1]];
        if (draggingVertex.target === 'fondo') linea.fondo[draggingVertex.idx] = [coords[0], coords[1]];
        rebuildFranjaCurvaGroup(linea.id);
        weldFranjaCurvaToNeighbors(linea.id);
        return;
    }
    if (linea.franjaGrupo) {
        syncFranjaVertexDrag(linea, draggingVertex.idx, coords);
        rebuildMacroEdgesForFranjaGroup(linea.franjaGrupo);
        return;
    }
    if (linea.tipo === 'calle-curva-arq2') {
        linea.ejeOriginal[draggingVertex.idx] = [coords[0], coords[1]];
        const geo = arq2_buildCalleCurvaGeometry(linea.ejeOriginal, linea.ancho, linea.calleCurvaAlpha, linea.calleRetorno);
        if (geo) {
            linea.puntosSuavizados = geo.puntosSuavizados;
            linea.left = geo.left;
            linea.right = geo.right;
            linea.puntos = geo.fillPoly;
            linea.ejeIsClosed = geo.ejeIsClosed;
        }
        return;
    }
    if (linea.tipo === 'lote-organico' && linea.ejeOriginal && window.arq2_getSnapGeometry) {
        linea.ejeOriginal[draggingVertex.idx] = [coords[0], coords[1]];
        const useCostura = !!linea.costuraStyle;
        const geoSnap = window.arq2_getSnapGeometry(linea.ejeOriginal);
        if (geoSnap) {
            let smoothed;
            if (useCostura) {
                smoothed = window.arq2_adaptiveSmooth(geoSnap.snappedRaw, null, Math.min(linea.suavizadoIntensidad || 1, 2));
                smoothed = window.arq2_restoreAnchoredVertices(smoothed, geoSnap.anchors, 0.04);
                if (window.arq2_clipCosturaToParent) {
                    smoothed = window.arq2_clipCosturaToParent(smoothed);
                }
            } else {
                smoothed = window.arq2_adaptiveSmooth(geoSnap.snappedRaw, null, linea.suavizadoIntensidad || 1);
                smoothed = window.arq2_restoreAnchoredVertices(smoothed, geoSnap.anchors, 0.08);
            }
            if (window.arq2_sanitizePolylinePoints) {
                smoothed = window.arq2_sanitizePolylinePoints(smoothed);
            }
            if (smoothed && smoothed.length >= 3) {
                linea.puntos = smoothed;
            }
        }
        return;
    }
    linea.puntos[draggingVertex.idx] = [coords[0], coords[1]];
}