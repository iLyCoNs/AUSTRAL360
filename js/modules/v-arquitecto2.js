// ==========================================
// MOTOR ARQUITECTO 2.0 (Extraído de viewer.js)
// ==========================================

function arq2_isValidPYPoint(pt) {
    return Array.isArray(pt) && pt.length >= 2 && isFinite(pt[0]) && isFinite(pt[1]) && !isNaN(pt[0]) && !isNaN(pt[1]);
}

function arq2_sanitizePolylinePoints(pts) {
    if (!pts?.length) return [];
    const out = [];
    pts.forEach(pt => {
        if (!arq2_isValidPYPoint(pt)) return;
        if (out.length && Math.hypot(pt[0] - out[out.length - 1][0], pt[1] - out[out.length - 1][1]) < 1e-6) return;
        out.push([parseFloat(pt[0]), parseFloat(pt[1])]);
    });
    return out;
}

function arq2_restoreAnchoredVertices(smoothed, anchors, tol = 0.08) {
    if (!anchors?.length || !smoothed?.length) return smoothed;
    return smoothed.map(pt => {
        let best = null, bestD = tol;
        anchors.forEach(a => {
            const d = Math.hypot(pt[0] - a[0], pt[1] - a[1]);
            if (d < bestD) { bestD = d; best = a; }
        });
        return best ? [parseFloat(best[0].toFixed(4)), parseFloat(best[1].toFixed(4))] : pt;
    });
}

function arq2_mergeSharedBoundaryVertices(lineId) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.puntos || !line.sharedSegs?.length) return;
    line.sharedSegs.forEach(segIdx => {
        const meta = line.sharedSegMeta?.[segIdx];
        if (!meta?.lineId) return;
        const other = allDrawnLines.find(l => l.id === meta.lineId);
        if (!other?.puntos) return;
        const n = line.puntos.length, on = other.puntos.length;
        const i1 = segIdx, i2 = (segIdx + 1) % n;
        const j1 = meta.segIdx, j2 = (meta.segIdx + 1) % on;
        const mid1 = [(line.puntos[i1][0] + other.puntos[j1][0]) / 2, (line.puntos[i1][1] + other.puntos[j1][1]) / 2];
        const mid2 = [(line.puntos[i2][0] + other.puntos[j2][0]) / 2, (line.puntos[i2][1] + other.puntos[j2][1]) / 2];
        line.puntos[i1] = [parseFloat(mid1[0].toFixed(4)), parseFloat(mid1[1].toFixed(4))];
        line.puntos[i2] = [parseFloat(mid2[0].toFixed(4)), parseFloat(mid2[1].toFixed(4))];
        other.puntos[j1] = [...line.puntos[i1]];
        other.puntos[j2] = [...line.puntos[i2]];
    });
}

function arq2_applyCosturaStrokeAttrs(pathEl, style) {
    if (!pathEl) return;
    const isPunteada = style !== 'solida';
    pathEl.setAttribute('stroke-dasharray', isPunteada ? '6,6' : 'none');
    pathEl.setAttribute('data-shared-edge', 'true');
    pathEl.setAttribute('data-costura-style', isPunteada ? 'punteada' : 'solida');
}

function arq2_getCosturaEstilo(lineData) {
    return lineData?.costuraEstilo || lineData?.costuraStyle || arq2CosturaStyle || 'punteada';
}

function arq2_applyCosturaEstiloToPath(pathEl, estilo) {
    if (!pathEl) return;
    const isPunteada = estilo !== 'solida';
    pathEl.setAttribute('data-costura-style', isPunteada ? 'punteada' : 'solida');
    pathEl.setAttribute('stroke-dasharray', isPunteada ? '6,6' : 'none');
    pathEl.style.setProperty('stroke-dasharray', isPunteada ? '6,6' : 'none', 'important');
    pathEl.style.setProperty('stroke', 'rgba(255,255,255,0.92)', 'important');
    pathEl.style.setProperty('stroke-width', '2px', 'important');
}

function arq2_resolveSharedSegStyle(lineData, segIdx) {
    if (!lineData?.sharedSegs?.includes(segIdx)) return null;
    const meta = lineData.sharedSegMeta?.[segIdx];
    const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
    if (other && (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle')) {
        return 'solida';
    }
    const segStyle = lineData.sharedSegStyles?.[segIdx];
    if (segStyle === 'punteada' || segStyle === 'solida') return segStyle;
    return arq2_getCosturaEstilo(lineData);
}

function arq2_syncCosturaStylesFromLineEstilo(lineId) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.sharedSegs?.length) return;
    const estilo = arq2_getCosturaEstilo(line);
    line.costuraEstilo = estilo;
    line.costuraStyle = estilo;
    line.sharedSegs.forEach(i => {
        const meta = line.sharedSegMeta?.[i];
        const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
        if (other && (other.tipo === 'calle-curva-arq2' || other.tipo === 'calle-curva-arq2-preview' || other.tipo === 'calle')) {
            line.sharedSegStyles[i] = 'solida';
        } else {
            line.sharedSegStyles[i] = estilo;
        }
    });
}

function arq2_buildSharedEdgePaths(pts, sharedSegs, sharedStyles, isClosed, getCamFn, cx, cySc, f, costuraDefault) {
    let dPunteada = '', dSolida = '';
    const defaultStyle = costuraDefault || 'punteada';
    const segN = isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < segN; i++) {
        if (!sharedSegs || !sharedSegs.includes(i)) continue;
        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= 0.0001 && c2.z <= 0.0001) continue;
        let s1, s2;
        if (c1.z > 0.0001) s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f };
        else { const t = c1.z / (c1.z - c2.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / 0.0001) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / 0.0001) * f }; }
        if (c2.z > 0.0001) s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f };
        else { const t = c2.z / (c2.z - c1.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / 0.0001) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / 0.0001) * f }; }
        let segStr;
        if (s1.x < s2.x || (s1.x === s2.x && s1.y < s2.y)) {
            segStr = `M ${s1.x},${s1.y} L ${s2.x},${s2.y} `;
        } else {
            segStr = `M ${s2.x},${s2.y} L ${s1.x},${s1.y} `;
        }
        const style = (sharedStyles && sharedStyles[i]) || defaultStyle;
        if (style === 'solida') dSolida += segStr;
        else dPunteada += segStr;
    }
    return { dPunteada, dSolida };
}

function arq2_ensureOrganicPathLayers(gNode, lineData) {
    if (!gNode) return null;
    const roleSpec = [
        { role: 'fill', cls: 'linea-organico-fill', apply: 'fill' },
        { role: 'perimeter', cls: 'linea-organico-perimetro', apply: 'perimeter' },
        { role: 'shared-punteada', cls: 'linea-punteada-costura', apply: 'dash' },
        { role: 'shared-solida', cls: 'linea-solida-costura', apply: 'shared-solid' }
    ];
    const byRole = {};
    Array.from(gNode.querySelectorAll('path')).forEach(p => {
        const role = p.dataset.edgeRole;
        if (role) byRole[role] = p;
    });
    roleSpec.forEach(spec => {
        if (!byRole[spec.role]) {
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.dataset.edgeRole = spec.role;
            p.setAttribute('class', spec.cls);
            byRole[spec.role] = p;
            gNode.appendChild(p);
        }
    });
    const ordered = roleSpec.map(spec => {
        const p = byRole[spec.role];
        p.setAttribute('class', spec.cls);
        if (spec.apply === 'dash') arq2_applyCosturaEstiloToPath(p, 'punteada');
        else if (spec.apply === 'shared-solid') arq2_applyCosturaEstiloToPath(p, 'solida');
        else arq2_applyOrganicPathAttrs(p, spec.apply);
        return p;
    });
    ordered.forEach(p => gNode.appendChild(p));
    if (lineData?.id && DOMCache.paths[lineData.id]) DOMCache.paths[lineData.id].base = ordered;
    return ordered;
}

function arq2_syncOrganicLotePaths(lineData, cacheObj, getCamFn, cx, cySc, f) {
    if (!lineData?.puntos?.length || !cacheObj) return;
    if (cacheObj.gNode) {
        const ordered = arq2_ensureOrganicPathLayers(cacheObj.gNode, lineData);
        if (ordered) cacheObj.base = ordered;
    }
    if (!cacheObj.base || cacheObj.base.length < 4) return;
    const paths = cacheObj.base;
    const costuraEstilo = arq2_getCosturaEstilo(lineData);
    // A "costura lot" is one the user explicitly drew with the Costura tool
    const isCosturaLot = !!(lineData.costuraEstilo || lineData.costuraStyle);

    // Mark the group element so CSS can target it
    if (cacheObj.gNode) cacheObj.gNode.setAttribute('data-costura-estilo', isCosturaLot ? costuraEstilo : 'none');

    // Fill is always the same
    const dFill = arq2_projectPolylineD(lineData.puntos, true, getCamFn, cx, cySc, f);
    paths[0].setAttribute('d', dFill.trim() || 'M -999 -999');
    arq2_applyOrganicPathAttrs(paths[0], 'fill');

    if (isCosturaLot) {
        // --- COSTURA LOT: render ALL edges in the costura style (dashed or solid) ---
        // paths[1]: solid perimeter Ã¢â€ â€™ hidden for costura lots
        paths[1].setAttribute('d', 'M -999 -999');
        paths[1].style.cssText = 'display:none !important;';

        // Special case: 2-point costura = simple dividing LINE (not a polygon)
        if (lineData.puntos.length === 2) {
            const p1 = lineData.puntos[0], p2 = lineData.puntos[1];
            const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
            let lineD = 'M -999 -999';
            if (c1.z > 0.0001 && c2.z > 0.0001) {
                const s1x = cx + (c1.x / c1.z) * f, s1y = cySc - (c1.y / c1.z) * f;
                const s2x = cx + (c2.x / c2.z) * f, s2y = cySc - (c2.y / c2.z) * f;
                lineD = `M ${s1x},${s1y} L ${s2x},${s2y}`;
            }
            paths[0].setAttribute('d', 'M -999 -999');
            paths[0].style.cssText = 'display:none;';
            paths[2].setAttribute('d', lineD);
            paths[2].style.cssText = 'fill:none !important; stroke:rgba(255,255,255,0.92) !important; stroke-width:2px !important; stroke-dasharray:6,6 !important; vector-effect:non-scaling-stroke; pointer-events:none;';
            paths[2].setAttribute('data-costura-style', 'punteada');
            paths[3].setAttribute('d', 'M -999 -999');
            paths[3].style.cssText = 'stroke:none !important; fill:none !important;';
            return;
        }

        // Build ALL edges of this lot (pass null to include every segment)
        const dAllEdges = arq2_buildNonSharedEdgePaths(lineData.puntos, null, true, getCamFn, cx, cySc, f);
        const edgesD = dAllEdges.trim() || 'M -999 -999';

        if (costuraEstilo === 'solida') {
            // paths[2]: dashed Ã¢â€ â€™ empty; paths[3]: solid costura Ã¢â€ â€™ all edges
            paths[2].setAttribute('d', 'M -999 -999');
            paths[2].style.cssText = 'stroke:none !important; fill:none !important;';
            paths[3].setAttribute('d', edgesD);
            // Force solid costura style directly
            paths[3].style.cssText = 'fill:none !important; stroke:rgba(255,255,255,0.92) !important; stroke-width:2px !important; stroke-dasharray:none !important; vector-effect:non-scaling-stroke; pointer-events:none;';
            paths[3].setAttribute('data-costura-style', 'solida');
        } else {
            // paths[2]: dashed Ã¢â€ â€™ all edges; paths[3]: solid costura Ã¢â€ â€™ empty
            paths[2].setAttribute('d', edgesD);
            // Force dashed costura style directly Ã¢â‚¬â€ maximum specificity via cssText
            paths[2].style.cssText = 'fill:none !important; stroke:rgba(255,255,255,0.92) !important; stroke-width:2px !important; stroke-dasharray:6,6 !important; vector-effect:non-scaling-stroke; pointer-events:none;';
            paths[2].setAttribute('data-costura-style', 'punteada');
            paths[3].setAttribute('d', 'M -999 -999');
            paths[3].style.cssText = 'stroke:none !important; fill:none !important;';
        }
    } else {
        // --- LOTE LIBRE: standard rendering with shared-segment awareness ---
        paths[1].style.cssText = '';
        paths[2].style.cssText = '';
        paths[3].style.cssText = '';
        const shared = arq2_buildSharedEdgePaths(lineData.puntos, lineData.sharedSegs, lineData.sharedSegStyles, true, getCamFn, cx, cySc, f, costuraEstilo);
        const dPerimeter = arq2_buildNonSharedEdgePaths(lineData.puntos, lineData.sharedSegs, true, getCamFn, cx, cySc, f);
        paths[1].setAttribute('d', dPerimeter.trim() || 'M -999 -999');
        arq2_applyOrganicPathAttrs(paths[1], 'perimeter');
        paths[2].setAttribute('d', shared.dPunteada.trim() || 'M -999 -999');
        arq2_applyCosturaEstiloToPath(paths[2], 'punteada');
        paths[3].setAttribute('d', shared.dSolida.trim() || 'M -999 -999');
        arq2_applyCosturaEstiloToPath(paths[3], 'solida');
    }
}

function arq2_applyOrganicPathAttrs(pathEl, role) {
    if (!pathEl) return;
    if (role === 'solid') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.16)');
        pathEl.setAttribute('fill-opacity', '1');
        pathEl.setAttribute('stroke', '#ffffff');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.style.pointerEvents = 'auto';
        pathEl.style.mixBlendMode = 'normal';
    } else if (role === 'fill') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.16)');
        pathEl.setAttribute('fill-opacity', '1');
        pathEl.setAttribute('stroke', 'none');
        pathEl.style.setProperty('stroke', 'none', 'important');
        pathEl.style.pointerEvents = 'auto';
        pathEl.style.mixBlendMode = 'normal';
    } else if (role === 'dash') {
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', '#ffffff');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', '6,6');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
    } else if (role === 'shared-solid') {
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', '#ffffff');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', 'none');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
    } else if (role === 'perimeter') {
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', '#ffffff');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', 'none');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
    } else if (role === 'preview') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.10)');
        pathEl.setAttribute('stroke', '#10b981');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', '4 4');
        pathEl.style.pointerEvents = 'none';
    }
}

function arq2_getCameraContext() {
    const container = document.getElementById('panorama-container');
    if (!visor360 || !container) return null;
    const w = container.clientWidth, h = container.clientHeight;
    const cp = visor360.getPitch() * Math.PI / 180, cy = -visor360.getYaw() * Math.PI / 180, hfov = visor360.getHfov();
    const sin_cp = Math.sin(cp), cos_cp = Math.cos(cp);
    const f = 0.5 * w / Math.tan(hfov * Math.PI / 360), cx = w / 2, cy_screen = h / 2;
    function getCam(pitch, yaw) {
        const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180, sin_p = Math.sin(p), cos_p = Math.cos(p);
        let y_diff = y - cy; while (y_diff > Math.PI) y_diff -= 2 * Math.PI; while (y_diff < -Math.PI) y_diff += 2 * Math.PI;
        const sin_yd = Math.sin(y_diff), cos_yd = Math.cos(y_diff);
        return { x: cos_p * sin_yd, y: sin_p * cos_cp - cos_p * cos_yd * sin_cp, z: sin_p * sin_cp + cos_p * cos_yd * cos_cp };
    }
    return { getCam, cx, cy_screen, f };
}

function arq2_projectPolylineD(pts, isClosed, getCamFn, cx, cySc, f) {
    if (!pts || pts.length < 2) return '';
    let d = '', hasVisible = false, wasSkipped = true;
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
        if (!isClosed && i === pts.length - 1) break;
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= 0.0001 && c2.z <= 0.0001) {
            wasSkipped = true;
            continue;
        }
        let s1, s2;
        if (c1.z > 0.0001) { s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f }; hasVisible = true; }
        else { const t = c1.z / (c1.z - c2.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / 0.0001) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / 0.0001) * f }; }
        if (c2.z > 0.0001) { s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f }; hasVisible = true; }
        else { const t = c2.z / (c2.z - c1.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / 0.0001) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / 0.0001) * f }; }
        if (isNaN(s1.x) || isNaN(s1.y) || isNaN(s2.x) || isNaN(s2.y)) {
            console.warn('[Fila Variable] Punto de proyección inválido', { p1, p2, s1, s2 });
            wasSkipped = true;
            continue;
        }
        if (d === '' || wasSkipped) d += `M ${s1.x},${s1.y} L ${s2.x},${s2.y} `;
        else { if (c1.z <= 0.0001) d += `M ${s1.x},${s1.y} `; d += `L ${s2.x},${s2.y} `; }
        wasSkipped = false;
    }
    if (isClosed && d.trim()) d += ' Z';
    return hasVisible ? d : '';
}

window.arq2VueloGhost = null;

function arq2_getVueloPointsPY() {
    return (window.arq2VueloPoints || []).map(p => [p.pitch, p.yaw]);
}

function arq2_getActiveDrawPoints() {
    if (arq2Tool === 'vuelo-cinematico') return arq2_getVueloPointsPY();
    return arq2LinePoints;
}

function arq2_saveVueloCinematico() {
    const pts = (window.arq2VueloPoints || []).slice(0, 3);
    if (pts.length < 2) {
        const sem = document.getElementById('arq2-semaphore');
        if (sem) { sem.className = 'arq2-semaphore arq2-sem-red'; sem.textContent = '⚠️ Coloca al menos 2 puntos de visión antes de guardar.'; setTimeout(() => { sem.className = 'arq2-semaphore arq2-sem-green'; sem.textContent = 'Trazo limpio'; }, 3000); }
        return false;
    }

    if (window.FRESIA_CFG?.vista === 'suelo') {
        ConfigProyecto.vueloCinematicoSuelo = pts;
    } else {
        ConfigProyecto.vueloCinematico = pts;
    }

    // Guardar local primero
    if (typeof saveToLocal === 'function') saveToLocal();

    // Feedback inmediato
    const sem = document.getElementById('arq2-semaphore');
    if (sem) { sem.className = 'arq2-semaphore arq2-sem-green'; sem.textContent = `🎬 Cinemática guardada con ${pts.length} puntos ✅`; setTimeout(() => { if (sem.textContent.startsWith('🎬')) { sem.className = 'arq2-semaphore arq2-sem-green'; sem.textContent = 'Trazo limpio'; }}, 3000); }

    // Guardar en nube usando la función real del sistema (tiene credenciales y lógica de merge)
    if (typeof GlobalCloudSave === 'function') {
        // Simulamos click silencioso al botón de guardar (la función ya tiene todo)
        setTimeout(() => GlobalCloudSave(), 100);
    }

    arq2_setTool('lote-libre');
    return true;
}

function arq2_clearVueloDraft() {
    window.arq2VueloPoints = [];
    window.arq2VueloGhost = null;
}

function arq2_checkInvasion(p1, p2) {
    if (!p1 || !p2) return false;
    for (const line of allDrawnLines) {
        if (line.tipo === 'calle' && line.puntos?.length >= 2) {
            for (let i = 0; i < line.puntos.length - 1; i++) {
                if (intersectSegments(p1, p2, line.puntos[i], line.puntos[i + 1])) return true;
            }
        }
        if (line.tipo === 'borde-macro' && line.puntos?.length >= 3) {
            for (let i = 0; i < line.puntos.length; i++) {
                const a = line.puntos[i], b = line.puntos[(i + 1) % line.puntos.length];
                if (intersectSegments(p1, p2, a, b)) return true;
            }
        }
    }
    return false;
}

function arq2_ensureFeedbackLayer() {
    const svg = document.getElementById('loteo-svg');
    if (!svg || document.getElementById('layer-arq2-feedback')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.id = 'layer-arq2-feedback';
    const band = document.createElementNS(ns, 'path');
    band.id = 'arq2-rubber-band';
    band.setAttribute('d', '');
    const verts = document.createElementNS(ns, 'g');
    verts.id = 'arq2-vertices';
    const magnet = document.createElementNS(ns, 'circle');
    magnet.id = 'arq2-snap-magnet';
    magnet.setAttribute('r', '10');
    magnet.style.display = 'none';
    layer.appendChild(band);
    layer.appendChild(verts);
    const guides = document.createElementNS(ns, 'g');
    guides.id = 'arq2-fila-guides';
    layer.appendChild(guides);
    layer.appendChild(magnet);
    svg.appendChild(layer);
}

function arq2_clearVisualFeedback() {
    document.getElementById('arq2-rubber-band')?.setAttribute('d', '');
    document.getElementById('arq2-rubber-band')?.classList.remove('arq2-invasion-warning');
    const verts = document.getElementById('arq2-vertices');
    if (verts) verts.innerHTML = '';
    const magnet = document.getElementById('arq2-snap-magnet');
    if (magnet) { magnet.style.display = 'none'; magnet.classList.remove('arq2-snap-pulse'); }
    const counter = document.getElementById('arq2-live-counter');
    if (counter) counter.style.display = 'none';
    const tip = document.getElementById('arq2-invasion-tooltip');
    if (tip) tip.style.display = 'none';
    arq2InvasionActive = false;
    const guides = document.getElementById('arq2-fila-guides');
    if (guides) guides.innerHTML = '';
}

function arq2_resolveActiveStepId() {
    const pts = arq2_getActiveDrawPoints();
    if (arq2Tool === 'eraser') {
        return 'corners';
    }
    if (arq2Tool === 'calle-curva-arq2') {
        if (pts.length === 0) return 'draw';
        return pts.length >= 2 ? 'finish' : 'draw';
    }
    if (arq2Tool === 'fila-variable') {
        if (document.getElementById('franja-lotes-modal')?.classList.contains('open') || arq2PendingFila?.contorno) return 'modal';
        if (pts.length === 0) return 'contorno';
        if (pts.length >= 3) {
            const last = pts[pts.length - 1];
            if (Math.hypot(last[0] - pts[0][0], last[1] - pts[0][1]) < SNAP_DISTANCE * 1.2) return 'contorno';
        }
        return 'contorno';
    }
    if (arq2Tool === 'fila-calle') {
        if (document.getElementById('franja-lotes-modal')?.classList.contains('open')) return 'modal';
        if (arq2FilaCalle?.borderPts) return 'depth';
        return 'select';
    }
    const toolKey = arq2Tool === 'relleno-auto' ? 'relleno-auto' : (arq2Tool === 'costura' ? 'costura' : 'lote-libre');
    if (pts.length === 0) return 'corners';
    if (pts.length >= 3) {
        const last = pts[pts.length - 1];
        if (Math.hypot(last[0] - pts[0][0], last[1] - pts[0][1]) < SNAP_DISTANCE * 1.2) return 'close';
    }
    return pts.length >= 2 ? 'curve' : 'corners';
}

function arq2_updatePanelStep() {
    const list = document.getElementById('arq2-steps-list');
    const sem = document.getElementById('arq2-semaphore');
    const smoothRow = document.getElementById('arq2-smooth-row');
    const filaDesc = document.getElementById('arq2-fila-desc');
    if (!list) return;
    const toolKey = arq2Tool === 'calle-curva-arq2' ? 'calle-curva-arq2' : (arq2Tool === 'relleno-auto' ? 'relleno-auto' : (arq2Tool === 'costura' ? 'costura' : (arq2Tool === 'fila-variable' ? 'fila-variable' : (arq2Tool === 'fila-calle' ? 'fila-calle' : (arq2Tool === 'eraser' ? 'eraser' : 'lote-libre')))));
    const activeId = arq2_resolveActiveStepId();
    const steps = ARQ2_STEPS.filter(s => s.tool === toolKey);
    list.innerHTML = '';
    steps.forEach(step => {
        const li = document.createElement('li');
        li.textContent = step.text;
        if (step.id === activeId) li.classList.add('arq2-step-active');
        list.appendChild(li);
    });
    if (smoothRow) {
        smoothRow.style.display = (toolKey === 'lote-libre' || toolKey === 'costura' || toolKey === 'relleno-auto') ? 'flex' : 'none';
    }
    const costuraRow = document.getElementById('arq2-costura-style-row');
    const costuraToggle = document.getElementById('arq2-costura-toggle-selected');
    const demoReplay = document.getElementById('arq2-fila-demo-replay');
    if (costuraRow) costuraRow.style.display = toolKey === 'costura' ? 'flex' : 'none';
    if (costuraToggle) {
        const sel = arq2SelectedLineId && allDrawnLines.find(l => l.id === arq2SelectedLineId);
        // Show toggle for any costura lot (even without sharedSegs, the new rendering uses costuraEstilo directly)
        const showSel = toolKey === 'costura' && sel && (sel.costuraEstilo || sel.costuraStyle || sel.sharedSegs?.length);
        costuraToggle.style.display = showSel ? 'block' : 'none';
        if (showSel) {
            const cur = sel.costuraEstilo || sel.costuraStyle || sel.sharedSegStyles?.[sel.sharedSegs?.[0]] || 'punteada';
            costuraToggle.textContent = cur === 'punteada' ? 'Cambiar a sÃƒÂ³lida' : 'Cambiar a punteada';
        }
    }
    if (demoReplay) demoReplay.style.display = toolKey === 'fila-variable' ? 'block' : 'none';
    if (filaDesc) filaDesc.style.display = toolKey === 'fila-variable' ? 'block' : 'none';
    // Fila sobre Calle panel
    const filaCalleRow = document.getElementById('arq2-fila-calle-row');
    if (filaCalleRow) {
        filaCalleRow.style.display = toolKey === 'fila-calle' ? 'block' : 'none';
    }
    if (toolKey === 'fila-calle') {
        const confirmBtn = document.getElementById('arq2-fila-calle-confirm');
        const cancelBtn = document.getElementById('arq2-fila-calle-cancel');
        const hasSelection = !!(arq2FilaCalle?.borderPts);
        if (confirmBtn) confirmBtn.style.display = hasSelection ? 'block' : 'none';
        if (cancelBtn) cancelBtn.style.display = hasSelection ? 'block' : 'none';
    }
    const calleRow = document.getElementById('arq2-calle-curva-row');
    if (calleRow) calleRow.style.display = toolKey === 'calle-curva-arq2' ? 'flex' : 'none';
    const smoothRow2 = document.getElementById('arq2-smooth-row');
    if (smoothRow2) smoothRow2.style.display = (toolKey === 'lote-libre' || toolKey === 'costura' || toolKey === 'relleno-auto') ? 'flex' : 'none';
    document.getElementById('arq2-costura-punteada')?.classList.toggle('active', arq2CosturaStyle === 'punteada');
    document.getElementById('arq2-costura-solida')?.classList.toggle('active', arq2CosturaStyle === 'solida');
    if (sem) {
        sem.classList.remove('arq2-sem-green', 'arq2-sem-yellow', 'arq2-sem-red');
        if (arq2InvasionActive) {
            sem.textContent = 'Ã°Å¸â€Â´ Cruzando calle o lÃƒÂ­mite, corrige el punto';
            sem.classList.add('arq2-sem-red');
        } else if (arq2CosturaSnap && isArquitecto2Active) {
            sem.textContent = 'Ã°Å¸Å¸Â¡ ImÃƒÂ¡n activo Ã¢â‚¬â€ puedes encadenar a forma existente';
            sem.classList.add('arq2-sem-yellow');
        } else {
            sem.textContent = 'Ã°Å¸Å¸Â¢ Trazo limpio';
            sem.classList.add('arq2-sem-green');
        }
    }
}

function arq2_updateLiveCounter(mock) {
    const el = document.getElementById('arq2-live-counter');
    const tip = document.getElementById('arq2-invasion-tooltip');
    if (!el || !mock) return;
    const pts = arq2_getActiveDrawPoints();
    if (pts.length === 0) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.style.left = mock.clientX + 'px';
    el.style.top = mock.clientY + 'px';
    if (arq2Tool === 'fila-variable' && document.getElementById('franja-lotes-modal')?.classList.contains('open')) {
        const weights = getFranjaModalWeights();
        const total = weights.reduce((a, b) => a + b, 0);
        const activeIdx = Math.min(weights.length - 1, Math.max(0, document.querySelector('.franja-weight-input:focus') ? Array.from(document.querySelectorAll('.franja-weight-input')).indexOf(document.activeElement) : 0));
        const current = weights[activeIdx] || 0;
        el.textContent = 'Lote actual: ' + current + ' mÃ‚Â² | Total hilera: ' + total + ' mÃ‚Â²';
    } else {
        el.textContent = 'VÃƒÂ©rtices: ' + pts.length + (arq2Tool === 'fila-variable' ? ' (mÃƒÂ­n. 4)' : '');
    }
    if (tip) {
        if (arq2InvasionActive) {
            tip.style.display = 'block';
            tip.style.left = mock.clientX + 'px';
            tip.style.top = mock.clientY + 'px';
        } else tip.style.display = 'none';
    }
}

function arq2_refreshVertexMarkers(ctx) {
    const vertsG = document.getElementById('arq2-vertices');
    if (!vertsG || !ctx) return;
    const ns = 'http://www.w3.org/2000/svg';
    const { getCam, cx, cy_screen, f } = ctx;
    const points = arq2_getActiveDrawPoints();
    vertsG.innerHTML = '';
    
    if (arq2Tool === 'vuelo-cinematico') {
        // Render connecting lines for cinematic
        if (points.length > 1) {
            const path = document.createElementNS(ns, 'path');
            let d = '';
            points.forEach((pt, idx) => {
                const c = getCam(pt[0], pt[1]);
                if (c.z > 0.0001) {
                    const x = cx + (c.x / c.z) * f, y = cy_screen - (c.y / c.z) * f;
                    d += (idx === 0 ? `M ${x},${y}` : ` L ${x},${y}`);
                }
            });
            if (d) {
                path.setAttribute('d', d);
                path.setAttribute('stroke', '#a855f7'); // Purple for cinematic
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke-dasharray', '4 4');
                path.setAttribute('fill', 'none');
                vertsG.appendChild(path);
            }
        }
        
        // Render numbered pins
        points.forEach((pt, idx) => {
            const c = getCam(pt[0], pt[1]);
            if (c.z <= 0.0001) return;
            const x = cx + (c.x / c.z) * f, y = cy_screen - (c.y / c.z) * f;
            
            const g = document.createElementNS(ns, 'g');
            g.setAttribute('transform', `translate(${x}, ${y})`);
            
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('r', idx === points.length - 1 ? '12' : '10');
            circle.setAttribute('fill', '#a855f7');
            circle.setAttribute('stroke', '#ffffff');
            circle.setAttribute('stroke-width', '2');
            if (idx === points.length - 1) circle.classList.add('arq2-vertex-pulse');
            
            const text = document.createElementNS(ns, 'text');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('dominant-baseline', 'central');
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('font-size', '10px');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('font-family', 'Inter, sans-serif');
            text.textContent = `P${idx + 1}`;
            
            g.appendChild(circle);
            g.appendChild(text);
            vertsG.appendChild(g);
        });
        
        // Render reticle on hover ghost point
        if (window.arq2VueloGhost) {
            const cGhost = getCam(window.arq2VueloGhost[0], window.arq2VueloGhost[1]);
            if (cGhost.z > 0.0001) {
                const gx = cx + (cGhost.x / cGhost.z) * f, gy = cy_screen - (cGhost.y / cGhost.z) * f;
                const reticle = document.createElementNS(ns, 'g');
                reticle.setAttribute('transform', `translate(${gx}, ${gy})`);
                
                const rCircle = document.createElementNS(ns, 'circle');
                rCircle.setAttribute('r', '15');
                rCircle.setAttribute('fill', 'none');
                rCircle.setAttribute('stroke', 'rgba(168, 85, 247, 0.7)');
                rCircle.setAttribute('stroke-width', '2');
                
                const cross1 = document.createElementNS(ns, 'line');
                cross1.setAttribute('x1', '-20'); cross1.setAttribute('y1', '0');
                cross1.setAttribute('x2', '20'); cross1.setAttribute('y2', '0');
                cross1.setAttribute('stroke', 'rgba(168, 85, 247, 0.7)');
                cross1.setAttribute('stroke-width', '2');
                
                const cross2 = document.createElementNS(ns, 'line');
                cross2.setAttribute('x1', '0'); cross2.setAttribute('y1', '-20');
                cross2.setAttribute('x2', '0'); cross2.setAttribute('y2', '20');
                cross2.setAttribute('stroke', 'rgba(168, 85, 247, 0.7)');
                cross2.setAttribute('stroke-width', '2');
                
                reticle.appendChild(rCircle);
                reticle.appendChild(cross1);
                reticle.appendChild(cross2);
                vertsG.appendChild(reticle);
            }
        }
    } else {
        // Original basic circles for other tools
        points.forEach((pt, idx) => {
            const c = getCam(pt[0], pt[1]);
            if (c.z <= 0.0001) return;
            const x = cx + (c.x / c.z) * f, y = cy_screen - (c.y / c.z) * f;
            const circle = document.createElementNS(ns, 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            if (idx === points.length - 1) {
                circle.setAttribute('r', '6');
                circle.classList.add('arq2-vertex-pulse');
            } else {
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', '#10b981');
                circle.setAttribute('stroke', '#ffffff');
                circle.setAttribute('stroke-width', '1');
            }
            vertsG.appendChild(circle);
        });
    }

    // === VÃƒâ€°RTICES IMAGINARIOS: Miter corner guides for calle-curva ===
    // Show left/right road-edge diamonds at each placed axis vertex
    if (arq2Tool === 'calle-curva-arq2' && points.length >= 1) {
        const proj = getPanoramaScreenProjector();
        const halfDeg = arq2_getCalleCurvaHalfWidthDeg(arq2CalleCurvaAncho);
        if (proj) {
            const n = points.length;
            const MITER_LIMIT = 3.0;
            points.forEach((pt, i) => {
                // Compute normal in PY space (same logic as arq2_offsetSplinePath)
                let nx = 0, ny = 0;
                if (n === 1) { nx = 0; ny = 1; }
                else if (i === 0) {
                    const ref = points[1];
                    const dx = ref[0] - pt[0], dy = ref[1] - pt[1];
                    const len = Math.hypot(dx, dy);
                    if (len < 1e-8) return;
                    nx = -dy / len; ny = dx / len;
                } else if (i === n - 1) {
                    const ref = points[i-1];
                    const dx = pt[0] - ref[0], dy = pt[1] - ref[1];
                    const len = Math.hypot(dx, dy);
                    if (len < 1e-8) return;
                    nx = -dy / len; ny = dx / len;
                } else {
                    const prev = points[i-1], next = points[i+1];
                    const dxi = pt[0]-prev[0], dyi = pt[1]-prev[1];
                    const dxo = next[0]-pt[0], dyo = next[1]-pt[1];
                    const leni = Math.hypot(dxi, dyi), leno = Math.hypot(dxo, dyo);
                    if (leni < 1e-8 || leno < 1e-8) return;
                    const nxi = -dyi/leni, nyi = dxi/leni;
                    const nxo = -dyo/leno, nyo = dxo/leno;
                    const mx = nxi+nxo, my = nyi+nyo;
                    const mLen = Math.hypot(mx, my);
                    if (mLen < 1e-8) { nx = nxi; ny = nyi; }
                    else {
                        const dot = nxi*nxo + nyi*nyo;
                        const scale = Math.min(MITER_LIMIT, 2.0 / (1.0 + Math.max(-0.9, dot)));
                        nx = (mx/mLen)*scale; ny = (my/mLen)*scale;
                    }
                }
                // Compute edge points in PY, then project to screen
                const lPY = [pt[0] + nx * halfDeg, pt[1] + ny * halfDeg];
                const rPY = [pt[0] - nx * halfDeg, pt[1] - ny * halfDeg];
                const r = 5;
                [lPY, rPY].forEach(edgePY => {
                    const sc = proj.toScreen(edgePY[0], edgePY[1]);
                    if (!sc) return;
                    const diamond = document.createElementNS(ns, 'polygon');
                    diamond.setAttribute('points',
                        `${sc[0]},${sc[1]-r} ${sc[0]+r},${sc[1]} ${sc[0]},${sc[1]+r} ${sc[0]-r},${sc[1]}`);
                    diamond.setAttribute('fill', 'rgba(6,182,212,0.35)');
                    diamond.setAttribute('stroke', '#06b6d4');
                    diamond.setAttribute('stroke-width', '1.5');
                    vertsG.appendChild(diamond);
                });
            });
        }
    }
}

function arq2_refreshFeedbackVisuals(mock) {
    if (!isArquitecto2Active) return;
    arq2_ensureFeedbackLayer();
    const ctx = arq2_getCameraContext();
    if (!ctx) return;
    arq2_refreshVertexMarkers(ctx);
    const band = document.getElementById('arq2-rubber-band');
    const points = arq2_getActiveDrawPoints();
    if (band && points.length > 0 && mock && visor360) {
        const last = points[points.length - 1];
        const coords = visor360.mouseEventToCoords(mock);
        arq2InvasionActive = coords ? arq2_checkInvasion(last, [coords[0], coords[1]]) : false;
        const cLast = ctx.getCam(last[0], last[1]);
        const mx = mock.clientX - DOMCache.viewport.left, my = mock.clientY - DOMCache.viewport.top;
        if (cLast.z > 0.0001) {
            band.setAttribute('d', `M ${ctx.cx + (cLast.x / cLast.z) * ctx.f},${ctx.cy_screen - (cLast.y / cLast.z) * ctx.f} L ${mx},${my}`);
            band.classList.toggle('arq2-invasion-warning', arq2InvasionActive);
        } else band.setAttribute('d', '');
    } else if (band) { band.setAttribute('d', ''); band.classList.remove('arq2-invasion-warning'); arq2InvasionActive = false; }
    const magnet = document.getElementById('arq2-snap-magnet');
    if (magnet && arq2CosturaSnap) {
        const sc = ctx.getCam(arq2CosturaSnap.pitch, arq2CosturaSnap.yaw);
        if (sc.z > 0.0001) {
            magnet.style.display = '';
            magnet.setAttribute('cx', ctx.cx + (sc.x / sc.z) * ctx.f);
            magnet.setAttribute('cy', ctx.cy_screen - (sc.y / sc.z) * ctx.f);
            magnet.classList.add('arq2-snap-pulse');
        } else magnet.style.display = 'none';
    } else if (magnet) { magnet.style.display = 'none'; magnet.classList.remove('arq2-snap-pulse'); }
    arq2_updateLiveCounter(mock);
    arq2_updatePanelStep();
    const pts = arq2_getActiveDrawPoints();
    if (mock && pts.length >= 3 && visor360) {
        const coords = visor360.mouseEventToCoords(mock);
        const near = coords && isNearPolygonOriginPY(coords[0], coords[1], pts[0]) && canTriggerPolygonAutoClose();
        updateCloseOriginHighlight(!!near);
    } else updateCloseOriginHighlight(false);
}

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
    
    const catmull = arq2_catmullRomOpen(points, 12);
    
    // Centripetal clamp: prevent catmull from overshooting past the segment bounds which causes 360 knots
    for (let i = 0; i < catmull.length; i++) {
        const lin = linearPts[i];
        if (lin) {
            // Maximum deviation allowed from linear segment is roughly the segment length
            const maxDev = 3.0; // max degrees deviation
            const dx = catmull[i][0] - lin[0], dy = catmull[i][1] - lin[1];
            const dev = Math.hypot(dx, dy);
            if (dev > maxDev) {
                catmull[i][0] = lin[0] + (dx / dev) * maxDev;
                catmull[i][1] = lin[1] + (dy / dev) * maxDev;
            }
        }
    }

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
        for (let i = 1; i < pts.length - 1; i++) {
            const r = arq2_estimateScreenCurvatureRadius(pts, i, proj);
            if (r < minR) {
                const prev = pts[i - 1], next = pts[i + 1];
                pts[i] = [
                    parseFloat(((prev[0] + pts[i][0] + next[0]) / 3).toFixed(4)),
                    parseFloat(((prev[1] + pts[i][1] + next[1]) / 3).toFixed(4))
                ];
                changed = true;
            }
        }
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

function arq2_getCalleCurvaHalfWidthDeg(anchoMetros) {
    // 1m = ~0.275 degrees full width -> half width = 0.1375 degrees per meter
    const w = anchoMetros || arq2CalleCurvaAncho || 8;
    return w * 0.1375;
}

function arq2_isCalleEjeClosed(eje) {
    if (!eje || eje.length < 3) return false;
    const first = eje[0], last = eje[eje.length - 1];
    return Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.25;
}

function arq2_offsetSplinePath(smoothedPoints, halfWidthDeg, calleRetorno = false, isClosed = false) {
    if (!smoothedPoints || smoothedPoints.length < 2) return { left: [], right: [] };
    const left = [], right = [];
    const n = smoothedPoints.length;
    const limit = isClosed ? n : (calleRetorno ? n - 1 : n);

    for (let i = 0; i < limit; i++) {
        const cur = smoothedPoints[i];
        
        if (!isClosed && (i === 0 || i === n - 1)) {
            const ref = i === 0 ? smoothedPoints[Math.min(1, n - 1)]
                                 : smoothedPoints[Math.max(0, n - 2)];
            const dx = (i === 0) ? ref[0] - cur[0] : cur[0] - ref[0];
            const dy = (i === 0) ? ref[1] - cur[1] : cur[1] - ref[1];
            const len = Math.hypot(dx, dy);
            if (len < 1e-8) continue;
            const nx = -dy / len, ny = dx / len;
            left.push([parseFloat((cur[0] + nx * halfWidthDeg).toFixed(4)), parseFloat((cur[1] + ny * halfWidthDeg).toFixed(4))]);
            right.push([parseFloat((cur[0] - nx * halfWidthDeg).toFixed(4)), parseFloat((cur[1] - ny * halfWidthDeg).toFixed(4))]);
        } else {
            const iPrev = isClosed ? (i - 1 + n) % n : i - 1;
            const iNext = isClosed ? (i + 1) % n : i + 1;
            const prev = smoothedPoints[iPrev];
            const next = smoothedPoints[iNext];
            const dxi = cur[0] - prev[0], dyi = cur[1] - prev[1];
            const dxo = next[0] - cur[0], dyo = next[1] - cur[1];
            const leni = Math.hypot(dxi, dyi), leno = Math.hypot(dxo, dyo);
            if (leni < 1e-8 || leno < 1e-8) continue;
            const nxi = -dyi / leni, nyi = dxi / leni;
            const nxo = -dyo / leno, nyo = dxo / leno;
            const dot = nxi * nxo + nyi * nyo;
            
            if (dot < 0.5) {
                left.push([parseFloat((cur[0] + nxi * halfWidthDeg).toFixed(4)), parseFloat((cur[1] + nyi * halfWidthDeg).toFixed(4))]);
                right.push([parseFloat((cur[0] - nxi * halfWidthDeg).toFixed(4)), parseFloat((cur[1] - nyi * halfWidthDeg).toFixed(4))]);
                left.push([parseFloat((cur[0] + nxo * halfWidthDeg).toFixed(4)), parseFloat((cur[1] + nyo * halfWidthDeg).toFixed(4))]);
                right.push([parseFloat((cur[0] - nxo * halfWidthDeg).toFixed(4)), parseFloat((cur[1] - nyo * halfWidthDeg).toFixed(4))]);
            } else {
                const mx = nxi + nxo, my = nyi + nyo;
                const mLen = Math.hypot(mx, my);
                if (mLen < 1e-8) {
                    left.push([parseFloat((cur[0] + nxi * halfWidthDeg).toFixed(4)), parseFloat((cur[1] + nyi * halfWidthDeg).toFixed(4))]);
                    right.push([parseFloat((cur[0] - nxi * halfWidthDeg).toFixed(4)), parseFloat((cur[1] - nyi * halfWidthDeg).toFixed(4))]);
                } else {
                    const miterScale = 2.0 / (1.0 + Math.max(-0.9, dot));
                    const cappedScale = Math.min(miterScale, 2.5);
                    const nx = (mx / mLen) * cappedScale;
                    const ny = (my / mLen) * cappedScale;
                    left.push([parseFloat((cur[0] + nx * halfWidthDeg).toFixed(4)), parseFloat((cur[1] + ny * halfWidthDeg).toFixed(4))]);
                    right.push([parseFloat((cur[0] - nx * halfWidthDeg).toFixed(4)), parseFloat((cur[1] - ny * halfWidthDeg).toFixed(4))]);
                }
            }
        }
    }
    
    if (calleRetorno) {
        // Build the U-turn cap in PY degree space (angular, not screen pixels)
        const lastIdx = smoothedPoints.length - 1;
        const prev = smoothedPoints[Math.max(0, lastIdx - 1)];
        const last = smoothedPoints[lastIdx];
        const dx = last[0] - prev[0], dy = last[1] - prev[1];
        const len = Math.hypot(dx, dy);
        if (len > 1e-8) {
            const fx = dx / len, fy = dy / len;
            // Center of the U-turn cap is ahead of the last point
            const centerP = last[0] + fx * (halfWidthDeg * 0.6);
            const centerY = last[1] + fy * (halfWidthDeg * 0.6);
            const r = halfWidthDeg * 1.8;
            const phi = Math.atan2(fy, fx);
            const numPoints = 16;
            for (let j = 0; j <= numPoints / 2; j++) {
                const ang = (phi - Math.PI / 2) + (Math.PI * j / numPoints);
                left.push([parseFloat((centerP + Math.cos(ang) * r).toFixed(4)), parseFloat((centerY + Math.sin(ang) * r).toFixed(4))]);
            }
            for (let j = numPoints; j > numPoints / 2; j--) {
                const ang = (phi - Math.PI / 2) + (Math.PI * j / numPoints);
                right.push([parseFloat((centerP + Math.cos(ang) * r).toFixed(4)), parseFloat((centerY + Math.sin(ang) * r).toFixed(4))]);
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
}

function arq2_buildCalleCurvaGeometry(ejeOriginal, anchoFactor, alphaFactor, calleRetorno = false) {
    let eje = arq2_smoothCalleAxis(ejeOriginal);
    const anchoMetros = anchoFactor || window.arq2CalleCurvaAncho || 8;
    const ejeIsClosed = arq2_isCalleEjeClosed(ejeOriginal);
    
    if (window.GeometryEngine) {
        // Enviar al motor matemático 2D en metros reales
        const geo = window.GeometryEngine.buildCalleCurvaEsferica(eje, anchoMetros, ejeIsClosed, calleRetorno);
        if (geo) {
            const calleCurvaAlpha = Math.max(0.15, Math.min(1, alphaFactor ?? window.draftCalleCurvaAlpha ?? 0.55));
            return {
                ejeOriginal: ejeOriginal.map(p => [...p]),
                puntosSuavizados: eje,
                ancho: anchoFactor,
                calleCurvaAlpha,
                calleRetorno,
                ejeIsClosed,
                left: geo.left,
                right: geo.right,
                fillPoly: geo.fillPoly,
                halfDeg: (anchoMetros * 0.1375) // legacy fallback param
            };
        }
    }

    // Fallback Legacy (Grados angulares)
    const halfDeg = arq2_getCalleCurvaHalfWidthDeg(anchoFactor);
    if (window.draftCalleCurvaCurvatura > 0) {
        eje = arq2_enforceMinCurveRadius(eje, halfDeg * 1.3);
    }
    let left, right;
    if (ejeIsClosed) {
        const ejeLoop = eje[eje.length - 1] &&
            Math.hypot(eje[0][0]-eje[eje.length-1][0], eje[0][1]-eje[eje.length-1][1]) < 0.05
            ? eje.slice(0, -1) : eje;
        const offset = arq2_offsetSplinePath(ejeLoop, halfDeg, false, true);
        left = arq2_removeSelfIntersections(offset.left);
        right = arq2_removeSelfIntersections(offset.right);
        if (left.length > 1) left.push([...left[0]]);
        if (right.length > 1) right.push([...right[0]]);
    } else {
        const offset = arq2_offsetSplinePath(eje, halfDeg, calleRetorno, false);
        left = arq2_removeSelfIntersections(offset.left);
        right = arq2_removeSelfIntersections(offset.right);
    }
    if (left.length < 2 || right.length < 2) return null;
    const calleCurvaAlpha = Math.max(0.15, Math.min(1, alphaFactor ?? window.draftCalleCurvaAlpha ?? 0.55));
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
        halfDeg
    };
}

function arq2_projectOpenPolylineD(pts, getCamFn, cx, cySc, f) {
    if (!pts || pts.length < 2) return '';
    let d = '', hasVisible = false;
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= 0.0001 && c2.z <= 0.0001) continue;
        let s1, s2;
        if (c1.z > 0.0001) { s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f }; hasVisible = true; }
        else { const t = c1.z / (c1.z - c2.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / 0.0001) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / 0.0001) * f }; }
        if (c2.z > 0.0001) { s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f }; hasVisible = true; }
        else { const t = c2.z / (c2.z - c1.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / 0.0001) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / 0.0001) * f }; }
        if (isNaN(s1.x) || isNaN(s1.y) || isNaN(s2.x) || isNaN(s2.y)) continue;
        if (d === '') d += `M ${s1.x},${s1.y} L ${s2.x},${s2.y} `;
        else { if (c1.z <= 0.0001) d += `M ${s1.x},${s1.y} `; d += `L ${s2.x},${s2.y} `; }
    }
    return hasVisible ? d : '';
}

function arq2_projectScreenCapLine(sA, sB) {
    if (!sA || !sB) return '';
    return `M ${sA.x},${sA.y} L ${sB.x},${sB.y}`;
}

function arq2_projectCalleCurvaPaths(lineData, getCamFn, cx, cySc, f) {
    const left = lineData.left, right = lineData.right;
    if (!left?.length || !right?.length) return null;
    const toScreen = (py) => {
        const c = getCamFn(py[0], py[1]);
        if (c.z <= 0.0001) return null;
        return { x: cx + (c.x / c.z) * f, y: cySc - (c.y / c.z) * f };
    };
    const sLeft = left.map(toScreen).filter(Boolean);
    const sRight = right.map(toScreen).filter(Boolean);
    if (sLeft.length < 2 || sRight.length < 2) return null;

    let dFill;
    if (lineData.ejeIsClosed) {
        // Closed-loop (manzana): two separate ring paths Ã¢â€ â€™ evenodd creates the road band
        // Outer ring: right border (larger perimeter goes first for evenodd winding)
        let dOuter = `M ${sRight[0].x},${sRight[0].y}`;
        for (let i = 1; i < sRight.length; i++) dOuter += ` L ${sRight[i].x},${sRight[i].y}`;
        dOuter += ' Z';
        // Inner ring: left border
        let dInner = `M ${sLeft[0].x},${sLeft[0].y}`;
        for (let i = 1; i < sLeft.length; i++) dInner += ` L ${sLeft[i].x},${sLeft[i].y}`;
        dInner += ' Z';
        dFill = dOuter + ' ' + dInner;
    } else {
        // Open street: single polygon (left Ã¢â€ â€™ right reversed)
        dFill = `M ${sLeft[0].x},${sLeft[0].y}`;
        for (let i = 1; i < sLeft.length; i++) dFill += ` L ${sLeft[i].x},${sLeft[i].y}`;
        for (let i = sRight.length - 1; i >= 0; i--) dFill += ` L ${sRight[i].x},${sRight[i].y}`;
        dFill += ' Z';
    }

    const dLeft = arq2_projectOpenPolylineD(left, getCamFn, cx, cySc, f);
    const dRight = arq2_projectOpenPolylineD(right, getCamFn, cx, cySc, f);
    const capStart = lineData.ejeIsClosed ? '' : arq2_projectScreenCapLine(sLeft[0], sRight[0]);
    const capEnd = (lineData.ejeIsClosed || lineData.calleRetorno) ? '' : arq2_projectScreenCapLine(sLeft[sLeft.length - 1], sRight[sRight.length - 1]);
    return { dFill, dLeft, dRight, capStart, capEnd, calleCurvaAlpha: lineData.calleCurvaAlpha };
}

function arq2_getCommittedCalleCurvaAxis() {
    let eje = arq2LinePoints.map(p => [...p]);
    const proj = getPanoramaScreenProjector();

    if (window.lastMouseX !== undefined && visor360 && proj) {
        const mx = window.lastMouseX - DOMCache.viewport.left;
        const my = window.lastMouseY - DOMCache.viewport.top;
        const py = proj.toPY(mx, my);

        if (py) {
            const last = eje[eje.length - 1];
            const cand = [parseFloat(py[0].toFixed(3)), parseFloat(py[1].toFixed(3))];
            if (!last || Math.hypot(cand[0] - last[0], cand[1] - last[1]) > 1e-3) {
                eje.push(cand);
            }
        }
    }

    return arq2_sanitizePolylinePoints(eje);
}

function arq2_finishCalleCurva() {
    const eje = arq2_getCommittedCalleCurvaAxis();
    if (eje.length < 2) { 
        alert('Coloca al menos 2 puntos en el eje central de la calle.'); 
        return; 
    }
    
    const geo = arq2_buildCalleCurvaGeometry(
        eje,
        arq2CalleCurvaAncho,
        draftCalleCurvaAlpha,
        arq2CalleRetorno
    );

    if (!geo) {
        alert('No se pudo generar la calle curva. Ajusta la vista e intenta de nuevo.');
        return;
    }
    
    const id = 'arq2_calle_' + Date.now();
    allDrawnLines.push({
        id,
        tipo: 'calle-curva-arq2',
        geometryVersion: 2,
        ejeOriginal: geo.ejeOriginal.map(p => [...p]),
        puntosSuavizados: geo.puntosSuavizados.map(p => [...p]),
        ancho: geo.ancho,
        calleCurvaAncho: geo.ancho,
        calleCurvaAlpha: geo.calleCurvaAlpha,
        calleRetorno: !!geo.calleRetorno,
        ejeIsClosed: !!geo.ejeIsClosed,
        left: geo.left.map(p => [...p]),
        right: geo.right.map(p => [...p]),
        fillPoly: geo.fillPoly.map(p => [...p]),
        puntos: geo.fillPoly.map(p => [...p]),
        halfDeg: geo.halfDeg
    });
    
    arq2_clearDraft();
    refreshAllHotspots(true);
    saveToLocal();
    flashScreenSuccess();
    arq2_setStatusText('Calle curva guardada Ã¢Å“â€œ');
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
    if (eje.length < 2) return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: eje, puntos: eje, calleCurvaAlpha: draftCalleCurvaAlpha, calleColor: draftCalleCurvaColor };
    const geo = arq2_buildCalleCurvaGeometry(eje, arq2CalleCurvaAncho, draftCalleCurvaAlpha, arq2CalleRetorno);
    if (!geo) return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: eje, puntos: eje, calleCurvaAlpha: draftCalleCurvaAlpha, calleColor: draftCalleCurvaColor };
    return { id: arq2TempLineId, tipo: 'calle-curva-arq2-preview', ejeOriginal: geo.ejeOriginal, puntosSuavizados: geo.puntosSuavizados, ancho: geo.ancho, calleCurvaAlpha: geo.calleCurvaAlpha, calleColor: draftCalleCurvaColor, calleRetorno: arq2CalleRetorno, left: geo.left, right: geo.right, puntos: geo.fillPoly };
}

function arq2_syncCalleCurvaPanelUI() {
    const valEl = document.getElementById('arq2-calle-ancho-val');
    const slider = document.getElementById('arq2-calle-ancho');
    const bar = document.getElementById('arq2-calle-width-preview-bar');
    const alphaEl = document.getElementById('arq2-calle-alpha');
    const alphaVal = document.getElementById('arq2-calle-alpha-val');
    const colorEl = document.getElementById('arq2-calle-color');
    const cb = document.getElementById('arq2-calle-retorno');
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

function arq2_bindCalleCurvaColorPicker() {
    const el = document.getElementById('arq2-calle-color');
    if (!el || el.dataset.bound === '1') return;
    el.dataset.bound = '1';
    el.addEventListener('input', (e) => {
        draftCalleCurvaColor = e.target.value;
        arq2_syncCalleCurvaPanelUI();
        syncSVGElements();
        updateSVGPaths();
    });
}

function arq2_ensurePanelExtras() {
    const row = document.querySelector('.arq2-tool-row');
        const rowEl = document.createElement('div');
        rowEl.id = 'arq2-calle-curva-row';
        rowEl.className = 'arq2-calle-curva-row';
        rowEl.innerHTML = '<label>Ancho calle <span id="arq2-calle-ancho-val">8.0</span></label><input type="range" id="arq2-calle-ancho" min="4" max="15" step="0.5" value="8"><div id="arq2-calle-width-preview"><div id="arq2-calle-width-preview-bar"></div></div>' +
            '<label>Curvatura <span id="arq2-calle-curvatura-val">5</span> <span style="font-size:10px;color:#94a3b8">(0=recta / 10=muy curva)</span></label><input type="range" id="arq2-calle-curvatura" min="0" max="10" step="1" value="5">' +
            '<label>Transparencia <span id="arq2-calle-alpha-val">55%</span></label><input type="range" id="arq2-calle-alpha" min="0.15" max="1" step="0.05" value="0.55">' +
            '<div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;"><label style="margin:0;">Color Asfalto</label><input type="color" id="arq2-calle-color" value="#5a5f69" style="cursor:pointer; background:none; border:none; width: 30px; height: 30px;"></div>' +
            '<div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;"><input type="checkbox" id="arq2-calle-retorno" style="cursor:pointer;"><label for="arq2-calle-retorno" style="cursor:pointer; margin: 0; font-size: 11px; color: #fff;">Retorno Circular (Cul-de-sac)</label></div>' +
            '<div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;"><input type="checkbox" id="arq2-calle-no-snap" style="cursor:pointer;"><label for="arq2-calle-no-snap" style="cursor:pointer; margin: 0; font-size: 11px; color: #fca5a5;">Despejar puntos de arrastre (Sin imÃƒÂ¡n)</label></div>' +
            '<div style="margin-top: 10px; font-size: 11px; color: #10b981;"><i>Tip: Toca una calle ya dibujada para editarla (Color, Ancho, etc.) y presiona ENTER para guardar.</i></div>';

        let arq2Panel = document.getElementById('arq2-panel');
        if (!arq2Panel) {
            arq2Panel = document.createElement('div');
            arq2Panel.id = 'arq2-panel';
            arq2Panel.style.display = 'none';
            arq2Panel.style.position = 'absolute';
            arq2Panel.style.pointerEvents = 'none';
            document.body.appendChild(arq2Panel);
        }
        arq2Panel.appendChild(rowEl);
        
        const slider = document.getElementById('arq2-calle-ancho');
        slider.addEventListener('input', (e) => {
            arq2CalleCurvaAncho = parseFloat(e.target.value);
            arq2_syncCalleCurvaPanelUI();
            syncSVGElements();
            updateSVGPaths();
        });
        const sliderCurvatura = document.getElementById('arq2-calle-curvatura');
        sliderCurvatura.addEventListener('input', (e) => {
            draftCalleCurvaCurvatura = parseFloat(e.target.value);
            const valEl = document.getElementById('arq2-calle-curvatura-val');
            if (valEl) valEl.textContent = draftCalleCurvaCurvatura;
            arq2_updateSelectedCalleCurva();
            syncSVGElements();
            updateSVGPaths();
        });

        if (typeof arq2_bindPinRowButtons === 'function') arq2_bindPinRowButtons();
        
        const cb = document.getElementById('arq2-calle-retorno');
        if (cb) {
            cb.addEventListener('change', (e) => {
                arq2CalleRetorno = e.target.checked;
                arq2_updateSelectedCalleCurva();
                syncSVGElements();
                updateSVGPaths();
            });
        }
        
        document.getElementById('arq2-calle-no-snap')?.addEventListener('change', (e) => {
            document.body.classList.toggle('calle-no-snap-active', e.target.checked);
        });
        
        // Ensure alpha slider syncs selected street too if redefined inline
        const oldBind = window.arq2_bindCalleCurvaAlphaSlider;
        if (!window.arq2_bindCalleCurvaAlphaSlider) {
            window.arq2_bindCalleCurvaAlphaSlider = function() {
                const alphaEl = document.getElementById('arq2-calle-alpha');
                if (!alphaEl || alphaEl.dataset.boundUpdated === '1') return;
                alphaEl.dataset.boundUpdated = '1';
                alphaEl.addEventListener('input', (e) => {
                    draftCalleCurvaAlpha = Math.max(0.15, Math.min(1, parseFloat(e.target.value) || 0.55));
                    arq2_syncCalleCurvaPanelUI();
                    arq2_updateSelectedCalleCurva();
                    syncSVGElements();
                    updateSVGPaths();
                });
            };
            window.arq2_bindCalleCurvaAlphaSlider();
        } else if (!document.getElementById('arq2-calle-alpha') && document.getElementById('arq2-calle-curva-row')) {
        const alphaWrap = document.createElement('div');
        alphaWrap.innerHTML = '<label>Transparencia <span id="arq2-calle-alpha-val">55%</span></label><input type="range" id="arq2-calle-alpha" min="0.15" max="1" step="0.05" value="0.55">';
        document.getElementById('arq2-calle-curva-row')?.appendChild(alphaWrap);
        arq2_bindCalleCurvaAlphaSlider();
    } else {
        arq2_bindCalleCurvaAlphaSlider();
    }
    arq2_syncCalleCurvaPanelUI();
}

function arq2_getSmoothParams(intensity) {
    const n = intensity == null ? arq2SmoothIntensity : intensity;
    if (n <= 0) return { enabled: false, segmentsPerCurve: 8, angleThreshold: 180, label: 'Apagado' };
    if (n <= 3) return { enabled: true, segmentsPerCurve: 6, angleThreshold: 150, label: 'Sutil' };
    if (n <= 7) return { enabled: true, segmentsPerCurve: 10, angleThreshold: 165, label: 'Natural' };
    return { enabled: true, segmentsPerCurve: 18, angleThreshold: 175, label: 'MÃƒÂ¡ximo' };
}

function arq2_calculateRealAreaM2(pts) {
    if (!window.GeometryEngine || !pts || pts.length < 3) return 0;
    const groundPts = pts.map(p => window.GeometryEngine.angularToGround(p[0], p[1]));
    return window.GeometryEngine.calculatePolygonAreaM2(groundPts);
}

function arq2_reprocessLineSmoothing(lineId, intensity) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line?.puntos?.length) return;
    line.puntos = arq2_sanitizePolylinePoints(arq2_adaptiveSmooth(line.puntos, null, intensity));
    line.suavizadoIntensidad = intensity;
    // Always re-register shared edges when smoothing changes to ensure borders align correctly
    arq2_registerSharedEdges(lineId);
    syncSVGElements();
    refreshAllHotspots(true);
    saveToLocal();
    arq2_setStatusText('Suavizado reprocesado (' + arq2_getSmoothParams(intensity).label + ') Ã¢Å“â€œ');
}

function arq2_showSmallShapeSmoothHint(lineId) {
    let hint = document.getElementById('arq2-small-shape-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'arq2-small-shape-hint';
        hint.className = 'arq2-small-shape-hint';
        document.getElementById('arq2-panel')?.appendChild(hint);
    }
    hint.innerHTML = 'Forma pequeÃƒÂ±a detectada Ã¢â‚¬â€ considera subir la intensidad de suavizado para un trazo mÃƒÂ¡s fino. <button type="button" id="arq2-apply-max-smooth">Aplicar MÃƒÂ¡ximo</button>';
    hint.style.display = 'block';
    const btn = document.getElementById('arq2-apply-max-smooth');
    if (btn) {
        btn.onclick = () => {
            arq2SmoothIntensity = 10;
            arq2_syncSmoothIntensityUI();
            arq2_reprocessLineSmoothing(lineId, 10);
            hint.style.display = 'none';
        };
    }
}

function arq2_syncSmoothIntensityUI() {
    const slider = document.getElementById('arq2-smooth-intensity');
    const valEl = document.getElementById('arq2-smooth-intensity-val');
    const params = arq2_getSmoothParams();
    if (slider) slider.value = arq2SmoothIntensity;
    if (valEl) valEl.textContent = params.label + ' (' + arq2SmoothIntensity + ')';
}

function arq2_ensureSmoothIntensityPanel() {
    const oldRow = document.getElementById('arq2-smooth-row');
    if (!oldRow || document.getElementById('arq2-smooth-intensity')) return;
    oldRow.innerHTML = '<label>Intensidad suavizado <span id="arq2-smooth-intensity-val">Natural (5)</span></label><input type="range" id="arq2-smooth-intensity" min="0" max="10" step="1" value="5">';
    document.getElementById('arq2-smooth-intensity')?.addEventListener('input', (e) => {
        arq2SmoothIntensity = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
        arq2SmoothCurves = arq2SmoothIntensity > 0;
        arq2_syncSmoothIntensityUI();
        arq2_updatePanelStep();
    });
    arq2_syncSmoothIntensityUI();
}

function arq2_adaptiveSmooth(points, segmentsPerCurve, intensityOverride) {
    const params = arq2_getSmoothParams(intensityOverride);
    if (!params.enabled || !points || points.length < 3) return points.map(p => [...p]);
    const segs = segmentsPerCurve || params.segmentsPerCurve;
    const angleThreshold = params.angleThreshold;
    const n = points.length;
    const isSmoothVtx = (i) => arq2_detectCornerAngle(points[(i - 1 + n) % n], points[i], points[(i + 1) % n]) > angleThreshold;
    const result = [];
    let i = 0;
    while (i < n) {
        if (!isSmoothVtx(i)) { result.push([...points[i]]); i++; continue; }
        let j = i;
        while (j < n && isSmoothVtx(j)) j++;
        if (j - i >= 3) {
            const smoothed = arq2_catmullRomOpen(points.slice(i, j), segs);
            if (result.length && smoothed.length) {
                const last = result[result.length - 1], first = smoothed[0];
                if (Math.hypot(last[0] - first[0], last[1] - first[1]) < 0.02) smoothed.shift();
            }
            result.push(...smoothed);
            i = j;
        } else { result.push([...points[i]]); i++; }
    }
    return result.length >= 3 ? result : points.map(p => [...p]);
}

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
            console.warn('[Fila Variable] DivisiÃƒÂ³n invÃƒÂ¡lida en t=' + cum[i], { tp, bp, ejeFrente, ejeFondo });
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
    if (arq2LinePoints.length < 4) { alert('Ã¢Å¡Â  Dibuja al menos 4 puntos para el contorno completo de la hilera.'); return; }
    const raw = arq2_sanitizePolylinePoints([...arq2LinePoints]);
    if (raw.length < 4) { alert('Ã¢Å¡Â  Contorno invÃƒÂ¡lido. Usa 4Ã¢â‚¬â€œ6 vÃƒÂ©rtices bien definidos.'); return; }
    arq2FilaVariableContorno = arq2SmoothCurves ? arq2_adaptiveSmooth(raw, 8) : raw;
    arq2FilaVariableContorno = arq2_sanitizePolylinePoints(arq2FilaVariableContorno);
    if (arq2FilaVariableContorno.length < 4) { alert('Ã¢Å¡Â  No se pudo generar la fila. Intenta con un contorno mÃƒÂ¡s simple (4-6 puntos) y vuelve a intentar.'); return; }
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

function arq2_getSnapPolylinePoints(line) {
    if (!line) return [];
    if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
        const pts = [];
        if (line.left?.length) pts.push(...line.left);
        if (line.right?.length) pts.push(...line.right);
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

function arq2_findNearestEdgeOrVertex(screenX, screenY, excludeLineId, radiusPx = 15) {
    if (document.getElementById('arq2-calle-no-snap')?.checked) return null;
    const proj = getPanoramaScreenProjector();
    if (!proj) return null;
    const sx = screenX - DOMCache.viewport.left, sy = screenY - DOMCache.viewport.top;
    // Use only the provided radius (no forced minimum) so snap isn't too aggressive in tight areas
    const effectiveRadius = Math.max(radiusPx, 14);
    let best = null, bestD = effectiveRadius;

    let isDraggingStreet = false;
    if (excludeLineId) {
        const exclLine = allDrawnLines.find(l => l.id === excludeLineId);
        if (exclLine && (exclLine.tipo === 'calle-curva-arq2' || exclLine.tipo === 'calle')) isDraggingStreet = true;
    }

    const tryPt = (pitch, yaw, meta) => {
        const sc = proj.toScreen(pitch, yaw);
        if (!sc) return;
        const d = Math.hypot(sc[0] - sx, sc[1] - sy);
        if (d < bestD) { bestD = d; best = { pitch, yaw, screenX: DOMCache.viewport.left + sc[0], screenY: DOMCache.viewport.top + sc[1], ...meta }; }
    };
    allDrawnLines.forEach(line => {
        if (line.id === excludeLineId || !arq2_isUniversalSnapTarget(line)) return;
        const hideStreets = arq2Tool === 'lote-libre' && document.getElementById('arq2-lote-libre-hide-streets')?.checked;
        if (hideStreets && (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview' || line.tipo === 'calle')) return;
        // When drawing or dragging a street, ONLY snap to other street edges - NOT to lote polygon vertices
        // (snapping to lot vertices causes the street path to jump/hook unexpectedly and overlaps half the street)
        const isDrawingStreet = arq2Tool === 'calle-curva-arq2' || isDraggingStreet;
        if (isDrawingStreet && line.tipo !== 'calle-curva-arq2' && line.tipo !== 'calle-curva-arq2-preview' && line.tipo !== 'calle') return;

        if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
            const polylines = [line.left || [], line.right || []];
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

function arq2_registerSharedEdges(newLineId) {
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

function arq2_trySplitParentLote(ptA, ptB) {
    const THRESH = 0.25; // max degrees distance from lot boundary to count as "on boundary"

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

    // Find the best parent lot (both endpoints must be close to its boundary)
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

    // If ptB is inside the lot (not on boundary), extend the line to the opposite edge
    if (_distToBoundary(ptB, poly) > THRESH * 0.5) {
        const dirX = ptB[0]-ptA[0], dirY = ptB[1]-ptA[1];
        const dirLen = Math.hypot(dirX, dirY);
        if (dirLen < 1e-6) return false;
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
        if (!bestLoc) return false;
        locB = bestLoc;
    }

    if (!locB) return false;
    if (locA.edgeIdx === locB.edgeIdx && Math.abs(locA.t - locB.t) < 0.05) return false;

    // Sort A before B in polygon traversal order
    const posA = locA.edgeIdx + locA.t, posB = locB.edgeIdx + locB.t;
    const [loc1, loc2] = posA < posB ? [locA, locB] : [locB, locA];
    const pt1 = loc1.snap, pt2 = loc2.snap;
    const edge1 = loc1.edgeIdx, edge2 = loc2.edgeIdx;

    // Build sub-polygon 1: pt1, poly[edge1+1..edge2], pt2
    const sub1 = [[...pt1]];
    for (let i = edge1+1; i <= edge2; i++) sub1.push([...poly[i % n]]);
    if (Math.hypot(pt2[0]-sub1[sub1.length-1][0], pt2[1]-sub1[sub1.length-1][1]) > 1e-5) sub1.push([...pt2]);

    // Build sub-polygon 2: pt2, poly[edge2+1..edge1+n], pt1
    const sub2 = [[...pt2]];
    for (let i = edge2+1; i <= edge1+n; i++) sub2.push([...poly[i % n]]);
    if (Math.hypot(pt1[0]-sub2[sub2.length-1][0], pt1[1]-sub2[sub2.length-1][1]) > 1e-5) sub2.push([...pt1]);

    if (sub1.length < 3 || sub2.length < 3) return false;

    const id1 = 'arq2_org_' + Date.now();
    const id2 = 'arq2_org_' + (Date.now() + 1);
    const entry1 = { id: id1, tipo: 'lote-organico', puntos: sub1, sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {} };
    const entry2 = { id: id2, tipo: 'lote-organico', puntos: sub2, sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {} };

    if (!arq2_applyAutoFill(entry1) || !arq2_applyAutoFill(entry2)) return false;

    // Replace parent lot with the two sub-lots
    const parentIdx = allDrawnLines.findIndex(l => l.id === bestLot.id);
    if (parentIdx >= 0) allDrawnLines.splice(parentIdx, 1, entry1, entry2);
    else allDrawnLines.push(entry1, entry2);

    // Register shared edges so the dividing line renders as dashed
    arq2_registerSharedEdges(id1);
    arq2_registerSharedEdges(id2);

    return true;
}

function arq2_snapVerticesToExisting(points) {
    if (!points || !points.length) return points;
    const proj = getPanoramaScreenProjector();
    return points.map(pt => {
        // Threshold: 0.15 degrees (3x more permissive than before)
        let best = null, bestD = 0.15;
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

function arq2_setCosturaStyleForLine(lineId, style) {
    const line = allDrawnLines.find(l => l.id === lineId);
    if (!line || !line.sharedSegs?.length) return;
    line.costuraStyle = style;
    line.costuraEstilo = style;
    line.sharedSegs.forEach(i => {
        const meta = line.sharedSegMeta?.[i];
        // Segments touching a street are always solid, others get the user-chosen style
        const finalStyle = meta?.isStreet ? 'solida' : style;
        line.sharedSegStyles[i] = finalStyle;
        // Mirror on the neighboring lot
        const other = meta ? allDrawnLines.find(l => l.id === meta.lineId) : null;
        if (other && other.sharedSegStyles && other.sharedSegs?.includes(meta.segIdx)) {
            other.sharedSegStyles[meta.segIdx] = finalStyle;
        }
    });
}

function arq2_selectCosturaLine(lineId) {
    arq2SelectedLineId = lineId;
    document.querySelectorAll('g.lote-organico[data-line-id], g.fila-variable-lote[data-line-id]').forEach(g => {
        g.classList.toggle('arq2-costura-selected', g.getAttribute('data-line-id') === lineId);
    });
    arq2_updatePanelStep();
}

function arq2_toggleSelectedCosturaStyle() {
    if (!arq2SelectedLineId) return;
    const line = allDrawnLines.find(l => l.id === arq2SelectedLineId);
    // Work for any costura lot even without sharedSegs
    if (!line || !(line.costuraEstilo || line.costuraStyle || line.sharedSegs?.length)) return;
    const cur = line.costuraEstilo || line.costuraStyle || line.sharedSegStyles?.[line.sharedSegs?.[0]] || 'punteada';
    const next = cur === 'punteada' ? 'solida' : 'punteada';
    // Update the lot's style properties directly
    line.costuraEstilo = next;
    line.costuraStyle = next;
    arq2_setCosturaStyleForLine(arq2SelectedLineId, next);
    syncSVGElements();
    updateSVGPaths();
    saveToLocal();
    arq2_updatePanelStep();
    arq2_setStatusText('Costura lote ' + (line.arq2Numero || line.franjaNumero || '') + ': ' + (next === 'punteada' ? 'punteada Ã¢Å“â€œ' : 'sÃƒÂ³lida Ã¢Å“â€œ'));
}

function arq2_clearDemoTimeouts() {
    arq2DemoTimers.forEach(t => clearTimeout(t));
    arq2DemoTimers = [];
}

function arq2_clearDemoTimers() {
    arq2_clearDemoTimeouts();
    if (arq2DemoLoopInterval) { clearInterval(arq2DemoLoopInterval); arq2DemoLoopInterval = null; }
}

function arq2_stopDemoAnimation() {
    arq2DemoActive = false;
    arq2_clearDemoTimers();
    const layer = document.getElementById('arq2-demo-layer');
    if (layer) layer.innerHTML = '';
}

function arq2_ensureDemoLayer() {
    const svg = document.getElementById('loteo-svg');
    if (!svg || document.getElementById('arq2-demo-layer')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const layer = document.createElementNS(ns, 'g');
    layer.id = 'arq2-demo-layer';
    layer.setAttribute('pointer-events', 'none');
    svg.appendChild(layer);
}

function arq2_getDemoPYPoints() {
    if (!visor360) return { contour: [], divs: [], lotCenters: [] };
    const pitch = visor360.getPitch(), yaw = visor360.getYaw();
    const dp = 3, spread = 3.5, depth = 7;
    const contour = [
        [pitch - dp, yaw - spread * 1.5],
        [pitch - dp, yaw + spread * 1.5],
        [pitch - dp - depth, yaw + spread * 1.2],
        [pitch - dp - depth, yaw - spread * 1.2],
    ];
    const weights = [5000, 5000, 5000, 5000];
    const axes = arq2_detectEjeYFondo(contour);
    if (!axes) return { contour, divs: [], lotCenters: [] };
    const divs = arq2_buildFilaInternalDivisions(axes.ejeFrente, axes.ejeFondo, weights);
    const lotCenters = arq2_computeFilaLotCentroids(axes.ejeFrente, axes.ejeFondo, weights).map(l => l.centroid);
    return { contour, divs, lotCenters };
}

function arq2_pyToScreen(py, getCam, cx, cySc, f) {
    const c = getCam(py[0], py[1]);
    if (c.z <= 0.0001) return null;
    return { x: cx + (c.x / c.z) * f, y: cySc - (c.y / c.z) * f };
}

function arq2_demoSchedule(fn, ms) {
    arq2DemoTimers.push(setTimeout(fn, ms));
}

function arq2_demoMakeLine(root, ns, p1, p2, cls, extraCls) {
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('class', 'arq2-demo-stroke ' + cls + (extraCls ? ' ' + extraCls : ''));
    line.setAttribute('data-py', p1[0] + ',' + p1[1]);
    line.setAttribute('data-py2', p2[0] + ',' + p2[1]);
    line.style.opacity = '0';
    root.appendChild(line);
    return line;
}

function arq2_demoMakeCircle(root, ns, py, r, cls) {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('class', 'arq2-demo-stroke ' + (cls || ''));
    c.setAttribute('data-py', py[0] + ',' + py[1]);
    c.setAttribute('r', r);
    c.style.opacity = '0';
    root.appendChild(c);
    return c;
}

function arq2_demoMakeText(root, ns, py, text, cls) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('class', 'arq2-demo-label ' + (cls || ''));
    t.setAttribute('data-py', py[0] + ',' + py[1]);
    t.setAttribute('text-anchor', 'middle');
    t.textContent = text;
    t.style.opacity = '0';
    root.appendChild(t);
    return t;
}

function arq2_demoMakeMidLabel(root, ns, p1, p2, text, cls) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('class', 'arq2-demo-label ' + (cls || ''));
    t.setAttribute('data-py-mid', p1[0] + ',' + p1[1] + '|' + p2[0] + ',' + p2[1]);
    t.setAttribute('text-anchor', 'middle');
    t.textContent = text;
    t.style.opacity = '0';
    root.appendChild(t);
    return t;
}

function arq2_demoReveal(el) {
    if (!el) return;
    el.style.opacity = '1';
    el.classList.add('is-visible');
}

function arq2_demoDrawLine(line, delayMs, durationMs) {
    arq2_demoSchedule(() => {
        if (!arq2DemoActive || !line) return;
        arq2_updateDemoLayer();
        const len = parseFloat(line.style.getPropertyValue('--draw-len')) || 100;
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        line.style.opacity = '1';
        line.classList.add('is-drawing');
        requestAnimationFrame(() => {
            line.style.transition = 'stroke-dashoffset ' + durationMs + 'ms linear';
            line.style.strokeDashoffset = '0';
        });
        arq2_demoSchedule(() => line.classList.add('is-drawn'), durationMs);
    }, delayMs);
}

function arq2_updateDemoLayer() {
    if (!arq2DemoActive || !visor360) return;
    const layer = document.getElementById('arq2-demo-layer');
    if (!layer || !layer.childNodes.length) return;
    const ctx = arq2_getCameraContext();
    if (!ctx) return;
    const { getCam, cx, cy_screen, f } = ctx;
    layer.querySelectorAll('[data-py]').forEach(el => {
        const parts = el.getAttribute('data-py').split(',').map(Number);
        const sc = arq2_pyToScreen(parts, getCam, cx, cy_screen, f);
        if (!sc) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = 'visible';
        if (el.tagName === 'circle') {
            el.setAttribute('cx', sc.x);
            el.setAttribute('cy', sc.y);
        } else if (el.tagName === 'line') {
            const p2 = el.getAttribute('data-py2');
            if (!p2) return;
            const parts2 = p2.split(',').map(Number);
            const sc2 = arq2_pyToScreen(parts2, getCam, cx, cy_screen, f);
            if (!sc2) { el.style.visibility = 'hidden'; return; }
            el.setAttribute('x1', sc.x);
            el.setAttribute('y1', sc.y);
            el.setAttribute('x2', sc2.x);
            el.setAttribute('y2', sc2.y);
            const len = Math.hypot(sc2.x - sc.x, sc2.y - sc.y);
            el.style.setProperty('--draw-len', len);
            if (el.classList.contains('arq2-demo-draw-line') && !el.classList.contains('is-drawn')) {
                el.style.strokeDasharray = len;
                if (!el.classList.contains('is-drawing')) el.style.strokeDashoffset = len;
            }
        } else if (el.tagName === 'text') {
            el.setAttribute('x', sc.x);
            el.setAttribute('y', sc.y);
        }
    });
    layer.querySelectorAll('[data-py-mid]').forEach(el => {
        const [p1s, p2s] = el.getAttribute('data-py-mid').split('|');
        const a = p1s.split(',').map(Number), b = p2s.split(',').map(Number);
        const sc1 = arq2_pyToScreen(a, getCam, cx, cy_screen, f), sc2 = arq2_pyToScreen(b, getCam, cx, cy_screen, f);
        if (!sc1 || !sc2) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = 'visible';
        el.setAttribute('x', (sc1.x + sc2.x) / 2);
        el.setAttribute('y', (sc1.y + sc2.y) / 2 - 14);
    });
}

function arq2_runDemoCycle() {
    if (!arq2DemoActive || !visor360) return;
    arq2_clearDemoTimeouts();
    arq2_ensureDemoLayer();
    const layer = document.getElementById('arq2-demo-layer');
    if (!layer) return;
    const ns = 'http://www.w3.org/2000/svg';
    layer.innerHTML = '';
    arq2DemoPY = arq2_getDemoPYPoints();
    const root = document.createElementNS(ns, 'g');
    root.classList.add('arq2-demo-root');
    layer.appendChild(root);
    const { contour, divs, lotCenters } = arq2DemoPY;
    const contourLines = [], divLines = [], lotNums = [];
    for (let i = 0; i < contour.length; i++) {
        contourLines.push(arq2_demoMakeLine(root, ns, contour[i], contour[(i + 1) % contour.length], 'arq2-demo-draw-line'));
    }
    divs.forEach(d => divLines.push(arq2_demoMakeLine(root, ns, d[0], d[1], 'arq2-demo-draw-line arq2-demo-div-line')));
    const pt0 = arq2_demoMakeCircle(root, ns, contour[0], 7, 'arq2-demo-point');
    const lblContour = arq2_demoMakeMidLabel(root, ns, contour[0], contour[1], 'CONTORNO Ã¢Å“â€œ (Enter)', 'arq2-demo-tag');
    const lblScale = arq2_demoMakeText(root, ns, lotCenters[1] || contour[0], 'Ã°Å¸â€œÂ Divisiones proporcionales al mÃ‚Â²', 'arq2-demo-tag arq2-demo-center-tag');
    lotCenters.forEach((c, i) => {
        lotNums.push(arq2_demoMakeCircle(root, ns, c, 10, 'arq2-demo-lot-circle'));
        lotNums.push(arq2_demoMakeText(root, ns, c, String(i + 1).padStart(2, '0'), 'arq2-demo-lot-num'));
    });
    arq2_updateDemoLayer();
    arq2_demoSchedule(() => arq2_demoReveal(pt0), 0);
    arq2_demoSchedule(() => pt0.classList.add('arq2-demo-pulse'), 0);
    contourLines.forEach((ln, i) => arq2_demoDrawLine(ln, 300 + i * 350, 380));
    arq2_demoSchedule(() => arq2_demoReveal(lblContour), 1200);
    divLines.forEach((ln, i) => arq2_demoDrawLine(ln, 2200 + i * 120, 320));
    lotNums.forEach((el, i) => arq2_demoSchedule(() => { arq2_demoReveal(el); el.classList.add('arq2-demo-pop'); }, 3000 + i * 120));
    arq2_demoSchedule(() => arq2_demoReveal(lblScale), 3600);
    arq2_demoSchedule(() => root.classList.add('arq2-demo-fadeout'), 4800);
}

function arq2_startDemoAnimation(forceReplay) {
    if (!isArquitecto2Active || arq2Tool !== 'fila-variable') return;
    if (arq2LinePoints.length > 0) return;
    if (arq2DemoActive && !forceReplay) return;
    arq2_stopDemoAnimation();
    arq2DemoActive = true;
    arq2_ensureDemoLayer();
    arq2_runDemoCycle();
    arq2DemoLoopInterval = setInterval(() => {
        if (arq2_shouldRunFilaDemo()) arq2_runDemoCycle();
        else arq2_stopDemoAnimation();
    }, 6000);
}

function arq2_shouldRunFilaDemo() {
    return isArquitecto2Active && arq2Tool === 'fila-variable' && arq2LinePoints.length === 0 && !document.getElementById('franja-lotes-modal')?.classList.contains('open');
}

function arq2_getNextLoteNumero() {
    let max = 0;
    allDrawnLines.forEach(l => {
        const n = parseInt(l.arq2Numero || l.franjaNumero || '0', 10);
        if (!isNaN(n) && n > max) max = n;
    });
    return String(max + 1).padStart(2, '0');
}

function arq2_applyAutoFill(entry) {
    // BUG FIX: Eliminado el prompt() nativo que bloquea el hilo en móviles y Chromium iframes.
    // Lote libre (Lápiz) y relleno-auto ahora asumen correlativo automático transparente.
    let numero = arq2_getNextLoteNumero();
    entry.arq2Numero = numero;
    entry.franjaNumero = numero;
    entry.loteStatus = 'disponible';
    return true;
}

function arq2_setStatusText(msg) {
    const el = document.getElementById('arq2-status');
    if (el) el.textContent = msg;
}

function arq2_clearDraft() {
    arq2LinePoints = [];
    arq2TempLineId = 'arq2_temp_' + Date.now();
    arq2CosturaSnap = null;
    arq2SelectedLineId = null;
    arq2FilaVariableContorno = null;
    arq2PendingFila = null;
    arq2FilaCalle = null;
    arq2Guideline = null;
    window.arq2VueloPoints = [];
    window.arq2VueloGhost = null;
    arq2_clearVisualFeedback();
    arq2_stopDemoAnimation();
    arq2_updateFilaCallePreview(); // clear preview SVG
    document.querySelectorAll('.arq2-costura-selected').forEach(g => g.classList.remove('arq2-costura-selected'));
    if (snapCursor) snapCursor.classList.remove('is-costura', 'active');
    arq2_updatePanelStep();
}

function arq2_updatePanelStep() {
    // ...
} // (Assuming it exists above and we are replacing correctly)



function arq2_setTool(tool) {
    arq2Tool = tool;
    arq2_clearDraft();
    arq2_ensurePanelExtras();
    document.querySelectorAll('.arq2-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.arq2Tool === tool));

    document.body.classList.toggle('eraser-mode-active', tool === 'eraser');
    document.body.classList.toggle('calle-mode-active', tool === 'calle-curva-arq2' || tool === 'calle');
    const hideStreetsRow = document.getElementById('arq2-lote-libre-hide-streets-row');
    if (hideStreetsRow) hideStreetsRow.style.display = (tool === 'lote-libre' || tool === 'fila-variable') ? '' : 'none';
    arq2_updatePanelStep();
    if (tool === 'fila-variable' && isArquitecto2Active) arq2_startDemoAnimation(false);
    if (tool === 'fila-calle') arq2_setupFilaCalleListeners();

    // Limpiar puntos de polígono y flags conflictivos para evitar bloqueos
    arq2LinePoints = [];
    window.__droneClickPending = false;
}

function arq2_toggleArquitecto2(force) {
    if (typeof force === 'boolean') isArquitecto2Active = force;
    else isArquitecto2Active = !isArquitecto2Active;
    document.body.classList.toggle('arq2-active', isArquitecto2Active);
    if (!isArquitecto2Active) {
        arq2_clearDraft();
        arq2_stopDemoAnimation();
        closeFranjaLotesModal();
        // Limpiar TODOS los estados de edición para vista previa limpia
        document.body.classList.remove('eraser-mode-active');
        document.body.classList.remove('calle-mode-active');
        refreshAllHotspots(true);
    } else {
        arq2_ensureFeedbackLayer();
        arq2_ensureDemoLayer();
        arq2_ensurePanelExtras();
        arq2_ensureSmoothIntensityPanel();
        arq2_setTool(arq2Tool);
        refreshAllHotspots(true);
    }
}

function arq2_buildNonSharedEdgePaths(pts, sharedSegs, isClosed, getCamFn, cx, cySc, f) {
    let d = '';
    const segN = isClosed ? pts.length : pts.length - 1;
    for (let i = 0; i < segN; i++) {
        if (sharedSegs && sharedSegs.includes(i)) continue;
        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
        const c1 = getCamFn(p1[0], p1[1]), c2 = getCamFn(p2[0], p2[1]);
        if (c1.z <= 0.0001 && c2.z <= 0.0001) continue;
        let s1, s2;
        if (c1.z > 0.0001) s1 = { x: cx + (c1.x / c1.z) * f, y: cySc - (c1.y / c1.z) * f };
        else { const t = c1.z / (c1.z - c2.z); s1 = { x: cx + ((c1.x + t * (c2.x - c1.x)) / 0.0001) * f, y: cySc - ((c1.y + t * (c2.y - c1.y)) / 0.0001) * f }; }
        if (c2.z > 0.0001) s2 = { x: cx + (c2.x / c2.z) * f, y: cySc - (c2.y / c2.z) * f };
        else { const t = c2.z / (c2.z - c1.z); s2 = { x: cx + ((c2.x + t * (c1.x - c2.x)) / 0.0001) * f, y: cySc - ((c2.y + t * (c1.y - c2.y)) / 0.0001) * f }; }
        const seg = `M ${s1.x},${s1.y} L ${s2.x},${s2.y} `;
        d += seg;
    }
    return d;
}

function arq2_buildSegmentPaths(pts, sharedSegs, isClosed, getCamFn, cx, cySc, f, costuraDefault) {
    return arq2_buildSharedEdgePaths(pts, sharedSegs, null, isClosed, getCamFn, cx, cySc, f, costuraDefault);
}

function arq2_finishLoteOrganico(rawPoints, useCostura) {
    const minPts = useCostura ? 2 : 3;
    if (!rawPoints || rawPoints.length < minPts) return;
    // Snap vertices to existing neighbor polygons for both costura and standard lote-libre
    // so they align perfectly without gaps or overlaps
    const snappedRaw = arq2_snapVerticesToExisting(rawPoints);
    const anchors = snappedRaw.map(p => [...p]);
    const smoothIntensity = arq2SmoothIntensity;
    let smoothed;

    // Special case: 2-point costura = dividing line Ã¢â‚¬â€ try to split parent lot first
    if (useCostura && snappedRaw.length === 2) {
        const splitOK = arq2_trySplitParentLote(snappedRaw[0], snappedRaw[1]);
        // Always save the dashed dividing line (visible separator on top of the two new lots)
        const id = 'arq2_org_' + Date.now();
        const costuraEstiloGuardado = arq2CosturaStyle || 'punteada';
        const entry = {
            id, tipo: 'lote-organico',
            puntos: snappedRaw.map(p => [...p]),
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
        arq2_setStatusText(splitOK ? 'Lote subdividido en 2 Ã¢Å“â€œ' : 'LÃƒÂ­nea divisoria guardada Ã¢Å“â€œ');
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
    const entry = { id, tipo: 'lote-organico', puntos: smoothed, sharedSegs: [], sharedSegStyles: {}, sharedSegMeta: {}, suavizadoIntensidad: smoothIntensity };
    if (useCostura) {
        entry.costuraStyle = costuraEstiloGuardado;
        entry.costuraEstilo = costuraEstiloGuardado;
    }
    if (!arq2_applyAutoFill(entry)) return;
    allDrawnLines.push(entry);
    // Register shared edges so adjacent lots (costura and standard lote-libre)
    // automatically find their shared boundaries and style them as single dashed lines.
    arq2_registerSharedEdges(id);
    const areaM2 = arq2_calculateRealAreaM2(smoothed);
    if (areaM2 > 0 && areaM2 < 15) arq2_showSmallShapeSmoothHint(id);
    arq2_clearDraft();
    refreshAllHotspots(true);
    saveToLocal();
    flashScreenSuccess();
    arq2_setStatusText('Lote ' + entry.arq2Numero + ' guardado Ã¢Å“â€œ');
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
                // Distance from click to segment s1Ã¢â€ â€™s2
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

function arq2_projectBorderInward(borderPts, depthFactor) {
    if (!borderPts || borderPts.length < 2) return null;
    // 1m = ~0.275 degrees
    const depthDeg = depthFactor * 0.275;
    const fondoPts = [];
    for (let i = 0; i < borderPts.length; i++) {
        const cur = borderPts[i];
        // Compute tangent direction along the border in PY space
        const prev = borderPts[Math.max(0, i-1)];
        const next = borderPts[Math.min(borderPts.length-1, i+1)];
        let tx = next[0] - prev[0], ty = next[1] - prev[1];
        const tlen = Math.hypot(tx, ty);
        if (tlen < 1e-6) { tx = 1; ty = 0; }
        else { tx /= tlen; ty /= tlen; }
        
        let nx = -ty, ny = tx;
        const pyProj1 = [parseFloat((cur[0] + nx * depthDeg).toFixed(4)), parseFloat((cur[1] + ny * depthDeg).toFixed(4))];
        const pyProj2 = [parseFloat((cur[0] - nx * depthDeg).toFixed(4)), parseFloat((cur[1] - ny * depthDeg).toFixed(4))];
        
        // Inward is the one INSIDE the user's drawn contour
        if (arq2PendingFila && arq2PendingFila.contorno) {
            const in1 = arq2_pointInPolygon(pyProj1, arq2PendingFila.contorno);
            const in2 = arq2_pointInPolygon(pyProj2, arq2PendingFila.contorno);
            if (in1) { fondoPts.push(pyProj1); continue; }
            if (in2) { fondoPts.push(pyProj2); continue; }
        }
        
        // Fallback: just use pyProj1 (this happens if contour is not set or both are outside)
        fondoPts.push(pyProj1);
    }
    if (fondoPts.length < 2) return null;
    // Ensure fondo goes in a consistent direction relative to the border
    // (it might be mirrored; the calling code handles orientation via arq2_validatePolylineDirection)
    return fondoPts;
}

function arq2_buildFilaCalleContorno(borderPts, fondoPts) {
    if (!borderPts || !fondoPts || borderPts.length < 2 || fondoPts.length < 2) return null;
    // Combine: go along border leftÃ¢â€ â€™right, then fondo rightÃ¢â€ â€™left to close
    const contorno = [...borderPts, ...[...fondoPts].reverse()];
    return arq2_sanitizePolylinePoints(contorno);
}

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

function arq2_commitFilaCalle(weights) {
    if (!arq2FilaCalle?.borderPts) {
        alert('Ã¢Å¡Â  Selecciona primero el borde de una calle.');
        return;
    }
    const contorno = arq2_computeFilaCalleContorno();
    if (!contorno || contorno.length < 4) {
        alert('Ã¢Å¡Â  No se pudo proyectar la profundidad. Ajusta la vista o elige otro borde.');
        return;
    }
    // Temporarily set arq2PendingFila so arq2_commitFilaVariable can work
    arq2PendingFila = { contorno };
    arq2_commitFilaVariable(weights);
    // arq2_commitFilaVariable calls arq2_clearDraft internally via arq2PendingFila = null
    arq2FilaCalle = null;
    arq2_updateFilaCallePreview();
}

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
                arq2_setStatusText('Ã¢Å¡Â  No se pudo proyectar el polÃƒÂ­gono. Ajusta la profundidad.');
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
            arq2_setStatusText('SelecciÃƒÂ³n cancelada Ã¢â‚¬â€ haz clic en el borde de una calle.');
        });
    }
}

function arq2_commitFilaVariable(weights) {

    if (!arq2PendingFila?.contorno || !weights?.length) return;
    const contorno = arq2_sanitizePolylinePoints(arq2PendingFila.contorno);
    if (contorno.length < 4) {
        alert('No se pudo generar la fila. Intenta con un contorno mÃƒÂ¡s simple (4-6 puntos) y vuelve a intentar.');
        return;
    }
    const axes = arq2_detectEjeYFondo(contorno);
    if (!axes) { alert('Ã¢Å¡Â  No se pudo detectar frente y fondo del contorno. Usa al menos 4 vÃƒÂ©rtices bien definidos.'); return; }
    const { ejeFrente, ejeFondo } = axes;
    const frontLen = getPolylineLength(ejeFrente), backLen = getPolylineLength(ejeFondo);
    if (frontLen < 1e-6 || backLen < 1e-6) {
        console.warn('[Fila Variable] Ejes con longitud cero', { ejeFrente, ejeFondo, contorno });
        alert('No se pudo generar la fila. Intenta con un contorno mÃƒÂ¡s simple (4-6 puntos) y vuelve a intentar.');
        return;
    }
    const divs = arq2_buildFilaInternalDivisions(ejeFrente, ejeFondo, weights);
    const lotCentroids = arq2_computeFilaLotCentroids(ejeFrente, ejeFondo, weights);
    if (contorno.length < 3 || !lotCentroids.length) {
        alert('No se pudo generar la fila. Intenta con un contorno mÃƒÂ¡s simple (4-6 puntos) y vuelve a intentar.');
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
    arq2_setStatusText('Hilera variable: ' + weights.length + ' lotes Ã¢â‚¬â€ un contorno + ' + divs.length + ' divisiones Ã¢Å“â€œ');
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

function arq2_setup() {
    document.getElementById('arq2-panel-close')?.addEventListener('click', () => arq2_toggleArquitecto2(false));
    document.querySelectorAll('.arq2-tool-btn').forEach(btn => btn.addEventListener('click', () => arq2_setTool(btn.dataset.arq2Tool)));
    
    if (typeof arq2_bindPinV2Buttons === 'function') arq2_bindPinV2Buttons();
    if (typeof arq2_togglePinV2UI === 'function') arq2_togglePinV2UI(false);


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

    // === ALT+A: activar / desactivar Panel Arquitecto 2.0 (KpranoKiller) ===
    if (!window.__arq2AltABound) {
        window.__arq2AltABound = true;
        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'a' || e.key === 'A') && !e.ctrlKey && !e.metaKey) {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                if (typeof arq2_toggleArquitecto2 === 'function') arq2_toggleArquitecto2();
            }
        });
    }
}


// Exposicion global para Ferrari y otros modulos
window.arq2_onPanoramaClick = arq2_onPanoramaClick;
window.arq2_saveVueloCinematico = arq2_saveVueloCinematico;
window.arq2_setTool = arq2_setTool;
