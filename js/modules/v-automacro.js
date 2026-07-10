function autoMacroSnap(v) { return Math.round(v * 100) / 100; }
function autoMacroEdgeKey(p1, p2) {
    const a = `${autoMacroSnap(p1[0])},${autoMacroSnap(p1[1])}`, b = `${autoMacroSnap(p2[0])},${autoMacroSnap(p2[1])}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function mergeFuzzyAutoMacroEdges(edgeMap) {
    const keys = Array.from(edgeMap.keys());
    for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
            const e1 = edgeMap.get(keys[i]), e2 = edgeMap.get(keys[j]);
            if (!e1 || !e2) continue;
            const d11 = Math.hypot(e1.p1[0]-e2.p1[0], e1.p1[1]-e2.p1[1]);
            const d22 = Math.hypot(e1.p2[0]-e2.p2[0], e1.p2[1]-e2.p2[1]);
            const d12 = Math.hypot(e1.p1[0]-e2.p2[0], e1.p1[1]-e2.p2[1]);
            const d21 = Math.hypot(e1.p2[0]-e2.p1[0], e1.p2[1]-e2.p1[1]);
            const tol = 0.08;
            if ((d11 < tol && d22 < tol) || (d12 < tol && d21 < tol)) {
                e1.count += e2.count;
                e1.p1 = [(e1.p1[0]+e2.p1[0])/2, (e1.p1[1]+e2.p1[1])/2];
                e1.p2 = [(e1.p2[0]+e2.p2[0])/2, (e1.p2[1]+e2.p2[1])/2];
                edgeMap.delete(keys[j]);
            }
        }
    }
}
function buildAutoMacroFromLotes(lotes) {
    const edgeMap = new Map();
    lotes.forEach(l => {
        const pts = l.puntos;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            if (Math.hypot(p1[0]-p2[0], p1[1]-p2[1]) < 0.002) continue;
            const key = autoMacroEdgeKey(p1, p2);
            if (!edgeMap.has(key)) edgeMap.set(key, { p1: [...p1], p2: [...p2], count: 0 });
            edgeMap.get(key).count++;
        }
    });
    mergeFuzzyAutoMacroEdges(edgeMap);
    const macroLines = []; let idx = 0; const ts = Date.now();
    edgeMap.forEach(edge => {
        if (edge.count >= 2) macroLines.push({ id: 'div_auto_'+ts+'_'+idx++, tipo: 'divisoria', puntos: [edge.p1, edge.p2] });
        else macroLines.push({ id: 'brd_auto_'+ts+'_'+idx++, tipo: 'borde-macro', puntos: [edge.p1, edge.p2] });
    });
    const invisibleFills = lotes.map(l => ({ ...l, tipo: 'area-invisible' }));
    return { invisibleFills, macroLines };
}
function runAutoMacroTransform(explicitLotes) {
    migrateFranjaGroupsFromData();
    let lotes = explicitLotes || allDrawnLines.filter(l => isAutoMacroLotePoly(l) && l.tipo !== 'franja-grupo');
    if (!lotes.length) {
        const grupos = allDrawnLines.filter(l => l.tipo === 'franja-grupo');
        if (grupos.length) { grupos.forEach(g => rebuildFranjaGroup(g.id)); return true; }
        return false;
    }
    const grupoIds = new Set(lotes.map(l => l.franjaGrupo).filter(Boolean));
    const lotIds = new Set(lotes.map(l => l.id));
    const others = allDrawnLines.filter(l => {
        if (l.tipo === 'franja-grupo') return true;
        if (isMacroEdgeType(l.tipo)) {
            if (l.franjaGrupo && grupoIds.has(l.franjaGrupo)) return false;
            if (!explicitLotes && !l.franjaGrupo) return false;
            return true;
        }
        if (lotIds.has(l.id)) return false;
        if (l.franjaGrupo && grupoIds.has(l.franjaGrupo)) return false;
        if (isAutoMacroLotePoly(l) && l.tipo !== 'franja-grupo') return false;
        return true;
    });
    const { invisibleFills, macroLines } = buildAutoMacroFromLotes(lotes);
    invisibleFills.forEach(f => {
        const src = lotes.find(l => l.id === f.id) || lotes[invisibleFills.indexOf(f)];
        if (src?.franjaGrupo) { f.franjaGrupo = src.franjaGrupo; f.franjaIdx = src.franjaIdx; f.franjaNumero = src.franjaNumero; }
    });
    if (grupoIds.size === 1) macroLines.forEach(m => { m.franjaGrupo = [...grupoIds][0]; });
    allDrawnLines = [...others, ...invisibleFills, ...macroLines];
    purgeAllNonFranjaLoteTrazos();
    const orphanFills = allDrawnLines.filter(l => l.tipo === 'area-invisible' && !l.franjaGrupo);
    if (orphanFills.length >= 2) promoteClusterToFranja(orphanFills);
    else orphanFills.forEach((f, i) => { f.franjaNumero = String(i + 1).padStart(2, '0'); });
    document.body.classList.add('auto-macro-active');
    return true;
}
function finalizeAutoMacroSession() {
    purgeAllNonFranjaLoteTrazos();
    allDrawnLines.filter(l => l.tipo === 'franja-grupo').forEach(g => rebuildFranjaGroup(g.id));
    ensureFranjaIntegrity();
}
function isMasterplanAristaType(tipo) { return tipo === 'arista_solida' || tipo === 'arista_punteada'; }
function masterplanEdgeKey(p1, p2) {
    const a = `${p1[0].toFixed(2)},${p1[1].toFixed(2)}`, b = `${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}
function buildMasterplanAristas(fills) {
    const edgeMap = new Map();
    fills.forEach(poly => {
        const pts = poly.puntos;
        for (let i = 0; i < pts.length; i++) {
            const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            const key = masterplanEdgeKey(p1, p2);
            if (!edgeMap.has(key)) edgeMap.set(key, { p1: [...p1], p2: [...p2], count: 0 });
            edgeMap.get(key).count++;
        }
    });
    const aristas = []; let idx = 0;
    edgeMap.forEach(edge => {
        if (arq2_isEdgeSharedWithOrganicLote(edge.p1, edge.p2)) return;
        aristas.push({ id: 'arista_mp_' + Date.now() + '_' + (idx++), tipo: edge.count === 1 ? 'arista_solida' : 'arista_punteada', puntos: [edge.p1, edge.p2] });
    });
    return aristas;
}
function refreshMasterplanAristas() {
    if (!document.body.classList.contains('masterplan-premium-active')) return;
    const others = allDrawnLines.filter(l => !isMasterplanAristaType(l.tipo) && l.tipo !== 'masterplan_fill');
    const fills = allDrawnLines.filter(l => l.tipo === 'masterplan_fill');
    if (!fills.length) { document.body.classList.remove('masterplan-premium-active'); allDrawnLines = others; return; }
    allDrawnLines = [...others, ...fills, ...buildMasterplanAristas(fills)];
}
function initMasterplanPremiumFromData() {
    const fills = allDrawnLines.filter(l => l.tipo === 'masterplan_fill');
    if (!fills.length) return;
    document.body.classList.remove('auto-macro-active');
    document.body.classList.add('masterplan-premium-active');
    if (!allDrawnLines.some(l => isMasterplanAristaType(l.tipo))) refreshMasterplanAristas();
}
function initAutoMacroFromData() {
    migrateFranjaGroupsFromData();
    allDrawnLines.filter(l => l.tipo === 'franja-grupo').forEach(g => rebuildFranjaGroup(g.id));
    allDrawnLines.filter(l => l.tipo === 'franja-curva-grupo').forEach(g => rebuildFranjaCurvaGroup(g.id));
    const fills = allDrawnLines.filter(l => isAutoMacroLotePoly(l) && l.tipo !== 'franja-grupo');
    const hasMacroEdges = allDrawnLines.some(l => isMacroEdgeType(l.tipo));
    const isModern = fills.some(l => l.tipo === 'lote-organico' || l.tipo === 'fila-variable-lote');
    if (fills.length >= 2 && !hasMacroEdges && !isModern) { runAutoMacroTransform(fills); finalizeAutoMacroSession(); }
    else if (hasMacroEdges && fills.some(l => l.tipo === 'area-invisible' || l.tipo === 'masterplan_fill')) document.body.classList.add('auto-macro-active');
    else syncFranjaVisualsOnReady();
}
function clearFranjaDraft() {
    franjaCornerA = null; franjaPreviewQuad = null; franjaPreviewDivs = [];
    try { visor360?.removeHotSpot('franja_preview_a'); } catch(e) {}
}
function screenPointToPanorama(sx, sy) {
    if (!visor360) return null;
    const r = visor360.mouseEventToCoords({ clientX: sx, clientY: sy });
    return r ? [parseFloat(r[0].toFixed(3)), parseFloat(r[1].toFixed(3))] : null;
}
function getFranjaGrupoScreenRects() {
    const proj = getPanoramaScreenProjector();
    if (!proj) return [];
    return allDrawnLines.filter(l => l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo').map(g => {
        let TL, TR, BR, BL;
        if (g.tipo === 'franja-grupo') {
            [TL, TR, BR, BL] = g.puntos;
        } else {
            TL = g.frente[0]; TR = g.frente[g.frente.length - 1];
            BR = g.fondo[g.fondo.length - 1]; BL = g.fondo[0]; 
        }
        const tl = proj.toScreen(TL[0], TL[1]), tr = proj.toScreen(TR[0], TR[1]);
        const br = proj.toScreen(BR[0], BR[1]), bl = proj.toScreen(BL[0], BL[1]);
        if (!tl || !tr || !br || !bl) return null;
        return { gid: g.id, grp: g, tl, tr, br, bl,
            left: Math.min(tl[0], bl[0]), right: Math.max(tr[0], br[0]),
            top: Math.min(tl[1], tr[1]), bottom: Math.max(bl[1], br[1]) };
    }).filter(Boolean);
}
function rectsSameWidth(a, b, px) {
    return Math.abs(a.left - b.left) < px && Math.abs(a.right - b.right) < px;
}
function rectsSameHeight(a, b, px) {
    return Math.abs(a.top - b.top) < px && Math.abs(a.bottom - b.bottom) < px;
}
function isFranjaBoundLine(line) {
    return line && (line.tipo === 'franja-grupo' || line.tipo === 'franja-curva-grupo' || line.tipo === 'borde-macro' || line.tipo === 'area-invisible' || !!line.franjaGrupo);
}
function getCalleDynBasePx() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--stroke-dyn') || '2.5px';
    return Math.max(1.2, parseFloat(raw) || 2.5);
}
const CALLE_BORDER_FRANJA_RATIO = 0.48;
function getCalleBorderThinPx() {
    return Math.max(0.4, getCalleDynBasePx() * CALLE_BORDER_FRANJA_RATIO);
}
function getCalleHalfWidthPx(anchoFactor) {
    const sw = getCalleStrokeWidths(anchoFactor);
    const basePx = getCalleDynBasePx();
    
    // Mitad matemática del borde de la franja
    const lotBorderHalf = basePx * 0.5; 
    
    // FIX: Margen anti-derrame de sub-píxeles (mayor en móviles o iframes por el escalado)
    const isMobile = window.innerWidth <= 768 || document.body.classList.contains('is-embedded');
    const safetyMargin = isMobile ? (basePx * 1.5) : (basePx * 0.1); 
    
    return (sw.borde * 0.5) + lotBorderHalf + safetyMargin;
}
function getCalleStrokeWidths(anchoFactor) {
    const base = getCalleDynBasePx();
    const factor = anchoFactor || draftCalleAncho || 8;
    
    // FIX: Reducción del 35% del grosor general en dispositivos móviles o iframes
    const isMobile = window.innerWidth <= 768 || document.body.classList.contains('is-embedded');
    const scale = isMobile ? 0.65 : 1.0;
    
    // Aplicamos la escala al asfalto y a la línea blanca fina
    const asf = Math.max(4, base * factor * scale);
    const thin = getCalleBorderThinPx() * scale;
    
    return { asfalto: asf, borde: asf + thin * 2, thin };
}
function getCalleStyleForLine(line) {
    return {
        ancho: line?.calleAncho ?? draftCalleAncho ?? 8,
        alpha: line?.calleAlpha ?? draftCalleAlpha ?? 0,
        labelScale: line?.calleLabelScale ?? draftCalleLabelScale ?? 1,
        showLabel: line?.calleShowLabel !== undefined ? line.calleShowLabel : draftCalleShowLabel
    };
}
function applyCallePathStyles(paths, ancho, alpha) {
    if (!paths || !paths.length) return;
    const sw = getCalleStrokeWidths(ancho);
    const a = Math.max(0, Math.min(1, alpha ?? draftCalleAlpha ?? 0));
    const borde = paths.find(p => p.classList && p.classList.contains('linea-calle-borde')) || paths[0];
    const asf = paths.find(p => p.classList && p.classList.contains('linea-calle-asfalto')) || paths[1];
    if (borde) {
        borde.style.setProperty('stroke-width', sw.borde + 'px', 'important');
        borde.style.setProperty('stroke', 'rgba(255,255,255,0.94)', 'important');
        // FIX: Forzamos corte plano y esquinas rectas en el borde blanco
        borde.style.setProperty('stroke-linecap', 'butt', 'important');
        borde.style.setProperty('stroke-linejoin', 'miter', 'important');
        borde.style.setProperty('filter', 'drop-shadow(0 0 1px rgba(255,255,255,0.35))', 'important');
    }
    if (asf) {
        asf.style.setProperty('stroke-width', sw.asfalto + 'px', 'important');
        asf.style.setProperty('stroke', a <= 0.02 ? 'rgba(0,0,0,0)' : `rgba(30,35,45,${a})`, 'important');
        asf.style.setProperty('stroke-linecap', 'butt', 'important');
        asf.style.setProperty('stroke-linejoin', 'miter', 'important');
    }
}
function syncCallePanelUI() {
    const panel = document.getElementById('calle-tool-panel');
    if (!panel) return;
    const anchoEl = document.getElementById('calle-ui-ancho');
    const alphaEl = document.getElementById('calle-ui-alpha');
    const labelEl = document.getElementById('calle-ui-label');
    const showEl = document.getElementById('calle-ui-show-label');
    const snapEl = document.getElementById('calle-ui-snap-franja');
    if (anchoEl) anchoEl.value = draftCalleAncho;
    if (alphaEl) alphaEl.value = draftCalleAlpha;
    if (labelEl) labelEl.value = draftCalleLabelScale;
    if (showEl) showEl.checked = draftCalleShowLabel;
    if (snapEl) snapEl.checked = draftCalleSnapFranja;
    const anchoVal = document.getElementById('calle-ui-ancho-val');
    const alphaVal = document.getElementById('calle-ui-alpha-val');
    const labelVal = document.getElementById('calle-ui-label-val');
    if (anchoVal) anchoVal.textContent = draftCalleAncho.toFixed(1);
    if (alphaVal) alphaVal.textContent = Math.round(draftCalleAlpha * 100) + '%';
    if (labelVal) labelVal.textContent = draftCalleLabelScale.toFixed(1) + '×';
    const bar = document.getElementById('calle-width-preview-bar');
    if (bar) {
        const pct = Math.max(6, Math.min(100, ((draftCalleAncho - 2) / 26) * 100));
        bar.style.width = pct + '%';
        bar.style.opacity = String(draftCalleAlpha);
    }
    const finishBtn = document.getElementById('btn-calle-finish');
    const drawStatus = document.getElementById('calle-draw-status');
    const n = currentLinePoints.length;
    const canFinish = currentLineType === 'calle' && n >= 2;
    if (finishBtn) finishBtn.classList.toggle('is-ready', canFinish);
    if (drawStatus) {
        drawStatus.classList.toggle('is-ready', canFinish);
        drawStatus.textContent = canFinish
            ? `${n} puntos — listo para terminar`
            : (n === 1 ? '1 punto — falta al menos uno más' : 'Coloca al menos 2 puntos en el mapa');
    }
}
function finishCalleDrawing() {
    if (currentLineType !== 'calle' || currentLinePoints.length < 2) return false;
    anclarTrazoActivo();
    syncCallePanelUI();
    flashScreenSuccess();
    return true;
}
function openCalleToolPanel() {
    document.getElementById('calle-tool-panel')?.classList.add('open');
    document.body.classList.add('calle-mode-active');
    syncCallePanelUI();
}
function closeCalleToolPanel() {
    document.getElementById('calle-tool-panel')?.classList.remove('open');
    document.body.classList.remove('calle-mode-active');
    lastCalleTap = null;
}
function isNearFranjaCornerScreen(clientX, clientY, pxRadius) {
    const sx = clientX - DOMCache.viewport.left, sy = clientY - DOMCache.viewport.top;
    const r = pxRadius || 28;
    let near = false;
    getAllStripSnapTargets().forEach(rect => {
        [rect.tl, rect.tr, rect.br, rect.bl].forEach(c => {
            if (Math.hypot(sx - c[0], sy - c[1]) < r) near = true;
        });
    });
    return near;
}
function getCalleMidpointPY(puntos) {
    if (!puntos || puntos.length < 2) return null;
    let total = 0;
    const lens = [];
    for (let i = 0; i < puntos.length - 1; i++) {
        const d = Math.hypot(puntos[i + 1][0] - puntos[i][0], puntos[i + 1][1] - puntos[i][1]);
        lens.push(d);
        total += d;
    }
    if (total < 1e-6) return [puntos[0][0], puntos[0][1]];
    let target = total * 0.5, acc = 0;
    for (let i = 0; i < lens.length; i++) {
        if (acc + lens[i] >= target) {
            const t = (target - acc) / lens[i];
            return [puntos[i][0] + t * (puntos[i + 1][0] - puntos[i][0]), puntos[i][1] + t * (puntos[i + 1][1] - puntos[i][1])];
        }
        acc += lens[i];
    }
    return [puntos[puntos.length - 1][0], puntos[puntos.length - 1][1]];
}
function getPanoramaPointDepth(pitch, yaw, visor360) {
    if (!visor360) return 1;
    const camP = visor360.getPitch() * Math.PI / 180;
    const camYw = visor360.getYaw() * Math.PI / 180;
    const p = pitch * Math.PI / 180;
    const y = yaw * Math.PI / 180;
    let yd = y - camYw;
    while (yd > Math.PI) yd -= 2 * Math.PI;
    while (yd < -Math.PI) yd += 2 * Math.PI;
    const sp = Math.sin(p), cp = Math.cos(p);
    const sy = Math.sin(yd), cy = Math.cos(yd);
    const scp = Math.sin(camP), ccp = Math.cos(camP);
    return Math.max(0.08, sp * scp + cp * cy * ccp);
}
function computeCalleSnapOffsetPx(pitch, yaw, anchoFactor, visor360) {
    const halfW = getCalleHalfWidthPx(anchoFactor);
    if (!visor360) return halfW;
    const hfov = visor360.getHfov();
    const hfovRef = DEFAULT_HFOV || 125;
    // FOV más ancho → menos grados por píxel → el mismo halfW px “corta” en el terreno
    const fovScale = Math.tan(hfovRef * Math.PI / 360) / Math.tan(hfov * Math.PI / 360);
    const z = getPanoramaPointDepth(pitch, yaw, visor360);
    // Compensación oblicua: baja z = punto en zona comprimida del domo (típico costados largos en móvil)
    const obliquity = Math.min(2.6, 1 / z);
    const pitchCam = visor360.getPitch();
    const pitchScale = 1 + Math.min(Math.abs(pitch - pitchCam) / 75, 1) * 0.18;
    return halfW * fovScale * obliquity * pitchScale;
}
function pushPanoramaAlongScreenNormal(edgePY, nx, ny, offsetPx, proj) {
    const pSc = proj.toScreen(edgePY[0], edgePY[1]);
    if (!pSc || offsetPx <= 0) return edgePY;
    const len = Math.hypot(nx, ny) || 1;
    const ux = nx / len, uy = ny / len;
    let scale = 1;
    let best = null;
    for (let i = 0; i < 5; i++) {
        const tx = pSc[0] + ux * offsetPx * scale;
        const ty = pSc[1] + uy * offsetPx * scale;
        const py = proj.toPY(tx, ty);
        if (!py) break;
        const chk = proj.toScreen(py[0], py[1]);
        if (!chk) { best = py; break; }
        const actual = Math.hypot(chk[0] - pSc[0], chk[1] - pSc[1]);
        if (actual >= offsetPx * 0.97) return py;
        scale *= offsetPx / Math.max(actual, 0.001);
        best = py;
    }
    return best || edgePY;
}
function snapCalleToFranjaParallelEdge(clientX, clientY, anchoFactor) {
    const proj = getPanoramaScreenProjector();
    if (!proj || !visor360) return null;
    const sx = clientX - DOMCache.viewport.left;
    const sy = clientY - DOMCache.viewport.top;
    const SNAP_PX = 52;
    let best = null;
    getAllStripSnapTargets().forEach(r => {
        const cx = (r.tl[0] + r.tr[0] + r.br[0] + r.bl[0]) / 4;
        const cy = (r.tl[1] + r.tr[1] + r.br[1] + r.bl[1]) / 4;
        let edges;
        if (r.grp?.puntos?.length >= 4) {
            const [TL, TR, BR, BL] = r.grp.puntos;
            edges = [[TL, TR], [TR, BR], [BR, BL], [BL, TL]];
        } else {
            edges = [[r.tl, r.tr], [r.tr, r.br], [r.br, r.bl], [r.bl, r.tl]].map(([a, b]) => {
                const aPy = proj.toPY(a[0], a[1]);
                const bPy = proj.toPY(b[0], b[1]);
                return aPy && bPy ? [aPy, bPy] : null;
            }).filter(Boolean);
        }
        edges.forEach(([aPY, bPY]) => {
            const aSc = proj.toScreen(aPY[0], aPY[1]);
            const bSc = proj.toScreen(bPY[0], bPY[1]);
            if (!aSc || !bSc) return;
            const ax = aSc[0], ay = aSc[1], bx = bSc[0], by = bSc[1];
            const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
            if (len < 2) return;
            const mx = (ax + bx) / 2, my = (ay + by) / 2;
            let nx = -dy / len, ny = dx / len;
            if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
            let t = ((sx - ax) * dx + (sy - ay) * dy) / (len * len);
            t = Math.max(0, Math.min(1, t));
            const px = ax + t * dx, py = ay + t * dy;
            const dist = Math.hypot(sx - px, sy - py);
            if (dist > SNAP_PX) return;
            const edgePY = lerpPY(aPY, bPY, t);
            const offsetPx = computeCalleSnapOffsetPx(edgePY[0], edgePY[1], anchoFactor, visor360);
            const pushed = pushPanoramaAlongScreenNormal(edgePY, nx, ny, offsetPx, proj);
            if (pushed && (!best || dist < best.dist)) {
                best = {
                    dist,
                    pitch: parseFloat(pushed[0].toFixed(3)),
                    yaw: parseFloat(pushed[1].toFixed(3))
                };
            }
        });
    });
    return best;
}
function tryMergeCallesAtAnchor(newId) {
    const line = allDrawnLines.find(l => l.id === newId);
    if (!line || line.tipo !== 'calle' || line.puntos.length < 2) return false;
    const tol = SNAP_DISTANCE * 0.85;
    const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let i = 0; i < allDrawnLines.length; i++) {
        const other = allDrawnLines[i];
        if (other.tipo !== 'calle' || other.id === newId) continue;
        const s = line.puntos[0], e = line.puntos[line.puntos.length - 1];
        const os = other.puntos[0], oe = other.puntos[other.puntos.length - 1];
        const merge = (pts, anchoOther) => {
            line.puntos = pts;
            line.calleAncho = ((line.calleAncho || draftCalleAncho) + (anchoOther || 2.2)) / 2;
            allDrawnLines = allDrawnLines.filter(l => l.id !== other.id);
            return true;
        };
        if (d(e, os) < tol) return merge([...line.puntos, ...other.puntos.slice(1)], other.calleAncho);
        if (d(e, oe) < tol) return merge([...line.puntos, ...other.puntos.slice(0, -1).reverse()], other.calleAncho);
        if (d(s, oe) < tol) return merge([...other.puntos, ...line.puntos.slice(1)], other.calleAncho);
        if (d(s, os) < tol) return merge([...other.puntos.slice().reverse(), ...line.puntos.slice(1)], other.calleAncho);
    }
    return false;
}
function updateDrawModeSnap(mock, coords) {
    let foundSnap = false;
    snappedCoords = null;
    isSnapToClose = false;
    calleSnapIsFranjaEdge = false;
    let devEdgeSnap = null;
    if (!coords || !snapCursor) return;
    if (currentLineType === 'calle') {
        if (draftCalleSnapFranja && !isNearFranjaCornerScreen(mock.clientX, mock.clientY, 32)) {
            const edgeSnap = snapCalleToFranjaParallelEdge(mock.clientX, mock.clientY, draftCalleAncho);
            if (edgeSnap) {
                foundSnap = true;
                snappedCoords = [edgeSnap.pitch, edgeSnap.yaw];
                calleSnapIsFranjaEdge = true;
            }
        }
        if (!foundSnap && currentLinePoints.length > 0) {
            const last = currentLinePoints[currentLinePoints.length - 1];
            const d = Math.hypot(last[0] - coords[0], last[1] - coords[1]);
            if (d < SNAP_DISTANCE * 0.65) {
                foundSnap = true;
                snappedCoords = [...last];
                isSnapToClose = true;
            }
        }
    } else {
        if (isDevModeDrawActive && currentLineType !== 'cortar' && currentLineType !== 'eraser') {
            devEdgeSnap = arq2_findNearestEdgeOrVertex(mock.clientX, mock.clientY, currentTempLineId, 15);
            if (devEdgeSnap) {
                foundSnap = true;
                snappedCoords = [devEdgeSnap.pitch, devEdgeSnap.yaw];
            }
        }
        if (currentLinePoints.length >= 3 && currentLineType !== 'cortar' && currentLineType !== 'eraser' && currentLineType !== 'divisoria' && currentLineType !== 'franja') {
            const nearOrigin = isNearPolygonOriginPY(coords[0], coords[1], currentLinePoints[0]);
            if (nearOrigin && canTriggerPolygonAutoClose()) { foundSnap = true; snappedCoords = [...currentLinePoints[0]]; isSnapToClose = true; }
        }
        if (!foundSnap) {
            const allPts = [...currentLinePoints];
            allDrawnLines.forEach(l => {
                if (isFranjaBoundLine(l)) return;
                const snapPts = arq2_getSnapPolylinePoints(l);
                allPts.push(...(snapPts.length ? snapPts : (l.puntos || [])));
            });
            for (const pt of allPts) {
                const dist = Math.hypot(pt[0] - coords[0], pt[1] - coords[1]);
                if (dist < SNAP_DISTANCE) { foundSnap = true; snappedCoords = [...pt]; break; }
            }
        }
    }
    if (foundSnap) {
        const edgeSnapScreen = (isDevModeDrawActive && devEdgeSnap) ? devEdgeSnap : null;
        snapCursor.style.left = (edgeSnapScreen?.screenX ?? mock.clientX) + 'px';
        snapCursor.style.top = (edgeSnapScreen?.screenY ?? mock.clientY) + 'px';
        snapCursor.classList.add('active');
        snapCursor.classList.toggle('is-costura', !!edgeSnapScreen);
        snapCursor.classList.toggle('is-closing', isSnapToClose && currentLineType !== 'calle');
        snapCursor.classList.toggle('is-calle-finish', isSnapToClose && currentLineType === 'calle');
        snapCursor.classList.toggle('is-calle-edge', calleSnapIsFranjaEdge);
    } else {
        snapCursor.classList.remove('active', 'is-closing', 'is-calle-edge', 'is-calle-finish', 'is-costura');
    }
    updateCloseOriginHighlight(isSnapToClose && currentLineType !== 'calle');
}
function handleCalleDrawClick(mock) {
    const coords = visor360.mouseEventToCoords(mock);
    if (!coords) return;
    let p = coords[0], y = coords[1];
    if (draftCalleSnapFranja && snappedCoords && !isNearFranjaCornerScreen(mock.clientX, mock.clientY, 32)) {
        p = snappedCoords[0]; y = snappedCoords[1];
    }
    if (isSnapToClose && currentLinePoints.length >= 2) {
        finishCalleDrawing();
        lastCalleTap = null;
        return;
    }
    const now = Date.now();
    if (lastCalleTap && now - lastCalleTap.time < 450 && Math.hypot(mock.clientX - lastCalleTap.x, mock.clientY - lastCalleTap.y) < 28) {
        if (currentLinePoints.length >= 2) {
            finishCalleDrawing();
            lastCalleTap = null;
            return;
        }
    }
    lastCalleTap = { x: mock.clientX, y: mock.clientY, time: now, p, y };
    currentLinePoints.push([p, y]);
    const _hid = 'temp_base_pt_' + Date.now();
    visor360.addHotSpot({ pitch: p, yaw: y, id: _hid, createTooltipFunc: renderHiddenVertex, createTooltipArgs: { lineId: currentTempLineId, type: 'calle', isGuide: true, idx: currentLinePoints.length - 1, hsId: _hid } });
    syncSVGElements();
    updateSVGPaths();
    syncCallePanelUI();
    refreshAllHotspots(true);
}
function getAllStripSnapTargets() {
    const targets = getFranjaGrupoScreenRects();
    const orphanFills = allDrawnLines.filter(l => l.tipo === 'area-invisible' && !l.franjaGrupo);
    if (!orphanFills.length) return targets;
    const proj = getPanoramaScreenProjector();
    if (!proj) return targets;
    const sc = [];
    orphanFills.forEach(l => l.puntos.forEach(p => { const s = proj.toScreen(p[0], p[1]); if (s) sc.push(s); }));
    if (sc.length < 4) return targets;
    const left = Math.min(...sc.map(s => s[0])), right = Math.max(...sc.map(s => s[0]));
    const top = Math.min(...sc.map(s => s[1])), bottom = Math.max(...sc.map(s => s[1]));
    targets.push({
        gid: '__orphan_macro__', grp: null, orphan: true, fills: orphanFills,
        left, right, top, bottom,
        tl: [left, top], tr: [right, top], br: [right, bottom], bl: [left, bottom]
    });
    return targets;
}
function resolveOrphanToFranjaGid(target) {
    if (!target?.orphan || !target.fills?.length) return target?.gid || null;
    const orphanIds = new Set(target.fills.map(f => f.id));
    const linked = allDrawnLines.find(l => (l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo') &&
        allDrawnLines.some(c => c.franjaGrupo === l.id && orphanIds.has(c.id)));
    if (linked) return linked.id;
    promoteClusterToFranja([...target.fills]);
    return allDrawnLines.filter(l => l.tipo === 'franja-grupo' || l.tipo === 'franja-curva-grupo').slice(-1)[0]?.id || null;
}
function snapFranjaScreenRect(ax, ay, bx, by, opts) {
    const forceExtend = opts?.forceExtend === true;
    const SNAP = 52;
    let x1 = Math.min(ax, bx), x2 = Math.max(ax, bx), y1 = Math.min(ay, by), y2 = Math.max(ay, by);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const targets = getAllStripSnapTargets();
    if (!targets.length) return { x1, x2, y1, y2, gapFill: false, gapFillH: false };
    let gapFillH = false, leftGid = null, rightGid = null, leftTarget = null, rightTarget = null;
    const sortedRow = [...targets].sort((a, b) => a.left - b.left);
    const rowAligned = (strip) => rectsSameHeight({ top: y1, bottom: y2 }, strip, SNAP * 2.5)
        || (y1 <= strip.top + SNAP * 2 && y2 >= strip.bottom - SNAP * 2)
        || Math.abs(cy - (strip.top + strip.bottom) / 2) < (strip.bottom - strip.top) * 0.45;
    for (let i = 0; i < sortedRow.length - 1; i++) {
        const left = sortedRow[i], right = sortedRow[i + 1];
        if (left.gid === right.gid) continue;
        const gapW = right.left - left.right;
        if (gapW <= 3 || gapW >= 600) continue;
        if (!rectsSameHeight(left, right, SNAP * 2) || !rowAligned(left)) continue;
        const centerInGap = cx >= left.right - SNAP && cx <= right.left + SNAP;
        const crossesGap = x1 <= left.right + SNAP * 1.5 && x2 >= right.left - SNAP * 1.5;
        if (centerInGap || crossesGap) {
            y1 = left.top; y2 = left.bottom; x1 = left.right; x2 = right.left;
            gapFillH = true;
            leftTarget = left; rightTarget = right;
            leftGid = left.gid === '__orphan_macro__' ? null : left.gid;
            rightGid = right.gid === '__orphan_macro__' ? null : right.gid;
            break;
        }
    }
    if (!gapFillH) {
        for (const strip of sortedRow) {
            if (!rowAligned(strip)) continue;
            const drawsRight = x2 > strip.right + 2 && (x1 >= strip.right - SNAP * 3 || forceExtend);
            const centerOnStrip = cx >= strip.left && cx <= strip.right + 500;
            if (!drawsRight && !(forceExtend && centerOnStrip)) continue;
            const rawX2 = Math.max(x2, ax, bx);
            const lotN = strip.grp?.franjaCount || strip.fills?.length || 9;
            const lotW = (strip.right - strip.left) / Math.max(1, lotN);
            y1 = strip.top; y2 = strip.bottom; x1 = strip.right;
            x2 = rawX2 > x1 + 8 ? rawX2 : x1 + lotW * 1.4;
            gapFillH = true;
            leftTarget = strip;
            leftGid = strip.gid === '__orphan_macro__' ? null : strip.gid;
            break;
        }
    }
    let gapFill = false, upperGid = null, lowerGid = null, upper = null, lower = null;
    if (!gapFillH) {
        let bestCol = null, bestColD = SNAP * 5;
        targets.forEach(t => {
            const dc = Math.abs(cx - (t.left + t.right) / 2);
            if (dc < bestColD) { bestColD = dc; bestCol = t; }
        });
        if (bestCol && bestColD < SNAP * 3) { x1 = bestCol.left; x2 = bestCol.right; }
        const colTargets = targets.filter(t => rectsSameWidth({ left: x1, right: x2 }, t, SNAP * 2));
        const sortedCol = [...colTargets].sort((a, b) => a.top - b.top);
        for (let i = 0; i < sortedCol.length - 1; i++) {
            const u = sortedCol[i], l = sortedCol[i + 1];
            if (u.gid === l.gid) continue;
            const gapH = l.top - u.bottom;
            if (gapH <= 3 || gapH >= 600) continue;
            const centerInGap = cy >= u.bottom - SNAP && cy <= l.top + SNAP;
            const crossesGap = y1 <= u.bottom + SNAP * 1.5 && y2 >= l.top - SNAP * 1.5;
            if (centerInGap || crossesGap) {
                upper = u; lower = l;
                y1 = u.bottom; y2 = l.top; x1 = u.left; x2 = u.right;
                gapFill = true;
                upperGid = u.gid === '__orphan_macro__' ? null : u.gid;
                lowerGid = l.gid === '__orphan_macro__' ? null : l.gid;
                break;
            }
        }
        if (!gapFill) {
            colTargets.forEach(t => {
                if (t.bottom <= cy + SNAP * 1.5 && (!upper || t.bottom > upper.bottom)) upper = t;
                if (t.top >= cy - SNAP * 1.5 && (!lower || t.top < lower.top)) lower = t;
            });
        }
        if (!gapFill) {
            const near = (v, t) => Math.abs(v - t) < SNAP;
            const snapVal = (v, edges) => {
                let best = v, bd = SNAP;
                edges.forEach(e => { const d = Math.abs(v - e); if (d < bd) { bd = d; best = e; } });
                return best;
            };
            const allX = [], allY = [];
            colTargets.forEach(r => { allX.push(r.left, r.right); allY.push(r.top, r.bottom); });
            x1 = snapVal(x1, allX); x2 = snapVal(x2, allX); y1 = snapVal(y1, allY); y2 = snapVal(y2, allY);
            colTargets.forEach(r => {
                if (near(x1, r.left) && near(x2, r.right)) { x1 = r.left; x2 = r.right; }
                if (near(y1, r.bottom)) { y1 = r.bottom; if (r.gid !== '__orphan_macro__') upperGid = r.gid; }
                if (near(y2, r.top)) { y2 = r.top; if (r.gid !== '__orphan_macro__') lowerGid = r.gid; }
            });
        }
    }
    return { x1, x2, y1, y2, gapFill, gapFillH, upperGid, lowerGid, leftGid, rightGid, upperTarget: upper, lowerTarget: lower, leftTarget, rightTarget };
}
function buildFranjaScreenPointsSnapped(ax, ay, bx, by, N, opts, customSplits) {
    const s = snapFranjaScreenRect(ax, ay, bx, by, opts);
    if (s.gapFillH) {
        const tl = screenPointToPanorama(s.x1, s.y1), tr = screenPointToPanorama(s.x2, s.y1);
        const br = screenPointToPanorama(s.x2, s.y2), bl = screenPointToPanorama(s.x1, s.y2);
        if (!tl || !tr || !br || !bl) return null;
        return { topPts: [tl, tr], botPts: [bl, br], snap: s, extendQuad: [tl, tr, br, bl] };
    }
    const ts = getFranjaSplitTs(N, customSplits);
    const topPts = [], botPts = [];
    for (let i = 0; i <= N; i++) {
        const sx = s.x1 + (s.x2 - s.x1) * ts[i];
        const tp = screenPointToPanorama(sx, s.y1), bp = screenPointToPanorama(sx, s.y2);
        if (!tp || !bp) return null;
        topPts.push(tp); botPts.push(bp);
    }
    return { topPts, botPts, snap: s, splits: ts };
}
function edgeMatchesLine(p1, p2, q1, q2, tol) {
    const d11 = Math.hypot(p1[0]-q1[0], p1[1]-q1[1]), d22 = Math.hypot(p2[0]-q2[0], p2[1]-q2[1]);
    const d12 = Math.hypot(p1[0]-q2[0], p1[1]-q2[1]), d21 = Math.hypot(p2[0]-q1[0], p2[1]-q1[1]);
    return (d11 < tol && d22 < tol) || (d12 < tol && d21 < tol);
}
function getScreenOverlapY(a, b) {
    const top = Math.max(a.top, b.top), bottom = Math.min(a.bottom, b.bottom);
    return bottom - top >= 10 ? { top, bottom, height: bottom - top } : null;
}

function applyStitchToSharedEdge(gid1, gid2, p1, p2, i, j) {
    const tol = 0.18;
    allDrawnLines = allDrawnLines.filter(l => {
        if (!l.franjaGrupo || l.tipo !== 'borde-macro') return true;
        if (l.franjaGrupo !== gid1 && l.franjaGrupo !== gid2) return true;
        if (l.puntos.length < 2) return true;
        return !edgeMatchesLine(l.puntos[0], l.puntos[1], p1, p2, tol);
    });
    allDrawnLines = allDrawnLines.filter(l => {
        if (l.tipo !== 'divisoria' || l.puntos?.length < 2) return true;
        if (l.franjaGrupo !== gid1 && l.franjaGrupo !== gid2 && !l.franjaStitch) return true;
        return !edgeMatchesLine(l.puntos[0], l.puntos[1], p1, p2, tol);
    });
    const exists = allDrawnLines.some(l => l.tipo === 'divisoria' && l.puntos.length >= 2 &&
        edgeMatchesLine(l.puntos[0], l.puntos[1], p1, p2, tol));
    if (!exists) {
        allDrawnLines.push({
            id: 'div_stitch_' + Date.now() + '_' + i + '_' + j + Math.floor(Math.random()*100),
            tipo: 'divisoria', puntos: [p1.map(v => v), p2.map(v => v)],
            franjaGrupo: gid1, franjaStitch: gid2, franjaSeam: true
        });
    }
}

function ensureStitchedDivisorias() {
    const rects = getFranjaGrupoScreenRects();
    if (rects.length >= 2) {
        const SNAP = 48;
        const proj = getPanoramaScreenProjector();
        if (proj) {
            for (let i = 0; i < rects.length; i++) {
                for (let j = i + 1; j < rects.length; j++) {
                    const a = rects[i], b = rects[j];
                    const ovlX = getScreenOverlapX(a, b);
                    if (ovlX) {
                        let upper = null, lower = null, seamY = null;
                        if (Math.abs(a.bottom - b.top) < SNAP) { upper = a; lower = b; seamY = (a.bottom + b.top) * 0.5; }
                        else if (Math.abs(b.bottom - a.top) < SNAP) { upper = b; lower = a; seamY = (b.bottom + a.top) * 0.5; }
                        if (upper && lower && seamY !== null) {
                            const p1 = proj.toPY(ovlX.left, seamY), p2 = proj.toPY(ovlX.right, seamY);
                            if (p1 && p2) applyStitchToSharedEdge(upper.gid, lower.gid, p1, p2, i, j);
                        }
                    }
                }
            }
        }
    }
    
    // Pass 2: Exact matching borders across ANY two different franjas (Handles sides automatically)
    const tol = 0.35;
    const toDelete = new Set();
    const newDivs = [];
    const borders = allDrawnLines.filter(l => l.tipo === 'borde-macro' && l.franjaGrupo);
    
    for (let i = 0; i < borders.length; i++) {
        for (let j = i + 1; j < borders.length; j++) {
            const b1 = borders[i];
            const b2 = borders[j];
            if (b1.franjaGrupo === b2.franjaGrupo) continue;
            
            if (b1.puntos.length >= 2 && b2.puntos.length >= 2) {
                if (edgeMatchesLine(b1.puntos[0], b1.puntos[1], b2.puntos[0], b2.puntos[1], tol)) {
                    toDelete.add(b1.id);
                    toDelete.add(b2.id);
                    const exists = allDrawnLines.some(l => l.tipo === 'divisoria' && l.puntos.length >= 2 && edgeMatchesLine(l.puntos[0], l.puntos[1], b1.puntos[0], b1.puntos[1], tol));
                    if (!exists && !newDivs.some(d => edgeMatchesLine(d.puntos[0], d.puntos[1], b1.puntos[0], b1.puntos[1], tol))) {
                        newDivs.push({
                            id: 'div_stitch_exact_' + Date.now() + '_' + i + '_' + j,
                            tipo: 'divisoria', puntos: [b1.puntos[0].map(v => v), b1.puntos[1].map(v => v)],
                            franjaGrupo: b1.franjaGrupo, franjaStitch: b2.franjaGrupo, franjaSeam: true
                        });
                    }
                }
            }
        }
    }
    
    if (toDelete.size > 0) {
        allDrawnLines = allDrawnLines.filter(l => !toDelete.has(l.id));
        allDrawnLines.push(...newDivs);
    }
}
function mergeVerticalFranjaChain(gids) {
    const unique = [...new Set(gids.filter(Boolean))];
    if (unique.length < 2) return false;
    unique.forEach(id => normalizeFranjaStripToRect(id));
    const strips = unique.map(id => allDrawnLines.find(l => l.id === id && l.tipo === 'franja-grupo')).filter(Boolean);
    if (strips.length < 2) return false;
    const proj = getPanoramaScreenProjector();
    if (!proj) return false;
    const metas = strips.map(s => {
        const r = getFranjaGrupoScreenRects().find(x => x.gid === s.id);
        return { s, r, n: s.franjaCount || 1, h: r ? r.bottom - r.top : 1 };
    }).filter(m => m.r);
    if (metas.length < 2) return false;
    metas.sort((a, b) => a.r.top - b.r.top);
    const allSingle = metas.every(m => m.n === 1);
    const keep = metas[0].s;
    const totalH = metas.reduce((sum, m) => sum + m.h, 0);
    const splits = [0];
    let acc = 0;
    for (let i = 0; i < metas.length - 1; i++) {
        acc += metas[i].h;
        splits.push(acc / totalH);
    }
    splits.push(1);
    const topR = metas[0].r, botR = metas[metas.length - 1].r;
    const nTL = proj.toPY(topR.tl[0], topR.tl[1]), nTR = proj.toPY(topR.tr[0], topR.tr[1]);
    const nBR = proj.toPY(botR.br[0], botR.br[1]), nBL = proj.toPY(botR.bl[0], botR.bl[1]);
    if (!nTL || !nTR || !nBR || !nBL) return false;
    metas.slice(1).forEach(m => {
        allDrawnLines = allDrawnLines.filter(l => l.franjaGrupo !== m.s.id && l.id !== m.s.id);
    });
    keep.puntos = [nTL, nTR, nBR, nBL];
    keep.franjaCount = allSingle ? metas.length : metas.reduce((sum, m) => sum + m.n, 0);
    keep.franjaSplits = splits.length === keep.franjaCount + 1 ? splits : Array.from({ length: keep.franjaCount + 1 }, (_, i) => i / keep.franjaCount);
    rebuildFranjaGroup(keep.id);
    ensureStitchedDivisorias();
    return true;
}
function tryMergeVerticalHilera(triggerGid, snap) {
    let upperGid = snap?.upperGid, lowerGid = snap?.lowerGid;
    if (snap?.upperTarget?.orphan) upperGid = resolveOrphanToFranjaGid(snap.upperTarget) || upperGid;
    if (snap?.lowerTarget?.orphan) lowerGid = resolveOrphanToFranjaGid(snap.lowerTarget) || lowerGid;
    const rects = getFranjaGrupoScreenRects();
    const trigger = rects.find(r => r.gid === triggerGid);
    if (!trigger) return false;
    const chain = rects.filter(r => rectsSameWidth(r, trigger, 55)).sort((a, b) => a.top - b.top);
    if (chain.length < 2) return false;
    if (snap?.gapFill) {
        const ids = [upperGid, triggerGid, lowerGid].filter((id, i, arr) => id && arr.indexOf(id) === i);
        if (ids.length >= 2 && mergeVerticalFranjaChain(ids)) return true;
    }
    let touching = [chain[0].gid];
    for (let i = 1; i < chain.length; i++) {
        if (chain[i].top - chain[i - 1].bottom < 55) touching.push(chain[i].gid);
        else break;
    }
    for (let i = 0; i < chain.length; i++) {
        if (chain[i].gid === triggerGid) {
            const start = Math.max(0, i - 1), end = Math.min(chain.length, i + 2);
            const slice = chain.slice(start, end);
            if (slice.length >= 2 && slice.every((r, idx) => idx === 0 || r.top - slice[idx - 1].bottom < 80)) {
                return mergeVerticalFranjaChain(slice.map(r => r.gid));
            }
        }
    }
    return mergeVerticalFranjaChain(touching.length >= 2 ? touching : chain.map(r => r.gid));
}
function mergeFranjasHorizontal(keepGid, mergeGid, mergeOnLeft) {
    normalizeFranjaStripToRect(keepGid);
    normalizeFranjaStripToRect(mergeGid);
    const keep = allDrawnLines.find(l => l.id === keepGid && l.tipo === 'franja-grupo');
    const merge = allDrawnLines.find(l => l.id === mergeGid && l.tipo === 'franja-grupo');
    if (!keep || !merge) return false;
    const nK = keep.franjaCount || 1, nM = merge.franjaCount || 1;
    const [kTL, kTR, kBR, kBL] = keep.puntos, [mTL, mTR, mBR, mBL] = merge.puntos;
    if (mergeOnLeft) {
        keep.puntos = [mTL, kTR, kBR, mBL].map(p => [...p]);
        keep.franjaSplits = [...(merge.franjaSplits || ensureFranjaSplits(merge)), ...(keep.franjaSplits || ensureFranjaSplits(keep)).slice(1)];
    } else {
        keep.puntos = [kTL, mTR, mBR, kBL].map(p => [...p]);
        keep.franjaSplits = [...(keep.franjaSplits || ensureFranjaSplits(keep)), ...(merge.franjaSplits || ensureFranjaSplits(merge)).slice(1)];
    }
    const total = nK + nM;
    if (keep.franjaSplits.length !== total + 1) keep.franjaSplits = Array.from({ length: total + 1 }, (_, i) => i / total);
    keep.franjaCount = total;
    allDrawnLines = allDrawnLines.filter(l => l.franjaGrupo !== mergeGid && l.id !== mergeGid);
    rebuildFranjaGroup(keepGid);
    ensureStitchedDivisorias();
    return true;
}
function tryMergeFranjaHorizontal(newGid) {
    const newG = getFranjaStripById(newGid);
    if (!newG || newG.tipo === 'franja-curva-grupo') return false;
    const proj = getPanoramaScreenProjector();
    if (!proj) return false;
    const nr = getFranjaGrupoScreenRects().find(r => r.gid === newGid);
    if (!nr) return false;
    for (const or of getFranjaGrupoScreenRects()) {
        if (or.gid === newGid) continue;
        const sameHeight = Math.abs(nr.top - or.top) < 24 && Math.abs(nr.bottom - or.bottom) < 24;
        if (!sameHeight) continue;
        if (Math.abs(nr.right - or.left) < 24) {
            if (mergeFranjasHorizontal(or.gid, newGid, true)) return true;
        }
        if (Math.abs(nr.left - or.right) < 24) {
            if (mergeFranjasHorizontal(or.gid, newGid, false)) return true;
        }
    }
    return false;
}
function alignFranjaVerticalNeighbors(gid) {
    const grp = getFranjaStripById(gid);
    const proj = getPanoramaScreenProjector();
    if (!grp || !proj) return;
    const nr = getFranjaGrupoScreenRects().find(r => r.gid === gid);
    if (!nr) return;
    const rebuildStrip = () => {
        if (grp.tipo === 'franja-curva-grupo') rebuildFranjaCurvaGroup(gid);
        else rebuildFranjaGroup(gid);
    };
    getFranjaGrupoScreenRects().forEach(or => {
        if (or.gid === gid) return;
        const sameWidth = Math.abs(nr.left - or.left) < 24 && Math.abs(nr.right - or.right) < 24;
        if (!sameWidth) return;
        if (Math.abs(nr.top - or.bottom) < 24) {
            const nTL = proj.toPY(or.bl[0], or.bottom), nTR = proj.toPY(or.br[0], or.bottom);
            if (nTL && nTR) {
                if (grp.tipo === 'franja-curva-grupo') {
                    grp.frente[0] = nTL; grp.frente[grp.frente.length - 1] = nTR;
                } else {
                    grp.puntos[0] = nTL; grp.puntos[1] = nTR;
                }
                rebuildStrip();
            }
        } else if (Math.abs(nr.bottom - or.top) < 24) {
            const nBL = proj.toPY(or.tl[0], or.top), nBR = proj.toPY(or.tr[0], or.top);
            if (nBL && nBR) {
                if (grp.tipo === 'franja-curva-grupo') {
                    grp.fondo[0] = nBL; grp.fondo[grp.fondo.length - 1] = nBR;
                } else {
                    grp.puntos[2] = nBR; grp.puntos[3] = nBL;
                }
                rebuildStrip();
            }
        }
    });
}
function extendFranjaHorizontal(stripGid, snap) {
    const grp = allDrawnLines.find(l => l.id === stripGid && l.tipo === 'franja-grupo');
    const proj = getPanoramaScreenProjector();
    if (!grp || !proj || !snap?.gapFillH || snap.rightTarget) return false;
    const [TL, TR, BR, BL] = grp.puntos;
    const tlSc = proj.toScreen(TL[0], TL[1]), trSc = proj.toScreen(TR[0], TR[1]);
    if (!tlSc || !trSc) return false;
    const oldTopLen = Math.hypot(trSc[0] - tlSc[0], trSc[1] - tlSc[1]);
    const newTR = proj.toPY(snap.x2, snap.y1), newBR = proj.toPY(snap.x2, snap.y2);
    const newTRsc = newTR && proj.toScreen(newTR[0], newTR[1]);
    if (!newTR || !newBR || !newTRsc) return false;
    const newTopLen = Math.hypot(newTRsc[0] - tlSc[0], newTRsc[1] - tlSc[1]);
    if (newTopLen <= oldTopLen + 0.001) return false;
    const tSplit = Math.min(0.985, Math.max(0.015, oldTopLen / newTopLen));
    const splits = [...ensureFranjaSplits(grp)];
    splits[splits.length - 1] = tSplit;
    splits.push(1);
    grp.puntos = [TL.map(v => v), newTR.map(v => v), newBR.map(v => v), BL.map(v => v)];
    grp.franjaCount = (grp.franjaCount || splits.length - 2) + 1;
    grp.franjaSplits = splits;
    rebuildFranjaGroup(stripGid);
    return true;
}
function finalizeExtendFranja(snap) {
    if (!snap?.gapFillH) return null;
    let stripGid = snap.leftGid;
    if (snap.leftTarget?.orphan) stripGid = resolveOrphanToFranjaGid(snap.leftTarget) || stripGid;
    if (snap.rightTarget) {
        if (snap.rightTarget.orphan) resolveOrphanToFranjaGid(snap.rightTarget);
        const tl = screenPointToPanorama(snap.x1, snap.y1), tr = screenPointToPanorama(snap.x2, snap.y1);
        const br = screenPointToPanorama(snap.x2, snap.y2), bl = screenPointToPanorama(snap.x1, snap.y2);
        if (!tl || !tr || !br || !bl) return null;
        const gid = finalizeNewFranja([tl, tr], [bl, br], 1, snap);
        if (!gid || !stripGid) return gid;
        const newG = allDrawnLines.find(l => l.id === gid);
        if (newG && tryMergeFranjaHorizontal(newG.id)) return gid;
        if (mergeFranjasHorizontal(stripGid, gid, false)) return stripGid;
        straightenFranjaGroup(stripGid);
        return gid;
    }
    if (!stripGid) return null;
    if (extendFranjaHorizontal(stripGid, snap)) {
        ensureStitchedDivisorias();
        document.body.classList.add('auto-macro-active');
        return stripGid;
    }
    return null;
}
function finalizeNewFranja(topPts, botPts, N, snap, customSplits) {
    if (snap?.gapFill && snap.upperTarget?.orphan) snap.upperGid = resolveOrphanToFranjaGid(snap.upperTarget) || snap.upperGid;
    if (snap?.gapFill && snap.lowerTarget?.orphan) snap.lowerGid = resolveOrphanToFranjaGid(snap.lowerTarget) || snap.lowerGid;
    const gid = 'franja_' + Date.now();
    const corners = [topPts[0], topPts[N], botPts[N], botPts[0]].map(p => [...p]);
    const entry = { id: gid, tipo: 'franja-grupo', franjaCount: N, puntos: corners };
    if (customSplits && customSplits.length === N + 1) entry.franjaSplits = customSplits.map(v => v);
    allDrawnLines.push(entry);
    rebuildFranjaGroup(gid);
    if (!tryMergeFranjaHorizontal(gid)) {
        alignFranjaVerticalNeighbors(gid);
        tryMergeVerticalHilera(gid, snap);
    }
    ensureStitchedDivisorias();
    document.body.classList.add('auto-macro-active');
    return gid;
}
function buildFranjaScreenPoints(ax, ay, bx, by, N) {
    const r = buildFranjaScreenPointsSnapped(ax, ay, bx, by, Math.max(1, N));
    return r ? { topPts: r.topPts, botPts: r.botPts, snap: r.snap } : null;
}
function updateFranjaPreview(bx, by) {
    if (!franjaCornerA) { franjaPreviewQuad = null; franjaPreviewDivs = []; return; }
    const raw = buildFranjaScreenPointsSnapped(franjaCornerA.sx, franjaCornerA.sy, bx, by, Math.max(1, franjaDraftCount));
    if (!raw) { franjaPreviewQuad = null; franjaPreviewDivs = []; return; }
    if (raw.snap?.gapFillH && raw.extendQuad) {
        franjaPreviewQuad = raw.extendQuad;
        const midT = screenPointToPanorama(raw.snap.x1, raw.snap.y1);
        const midB = screenPointToPanorama(raw.snap.x1, raw.snap.y2);
        franjaPreviewDivs = midT && midB ? [{ id: 'franja_preview_stitch', tipo: 'franja-preview-div', puntos: [midT, midB] }] : [];
        return;
    }
    const N = raw.snap?.gapFill ? 1 : Math.max(1, franjaDraftCount);
    const built = buildFranjaScreenPointsSnapped(franjaCornerA.sx, franjaCornerA.sy, bx, by, N);
    if (!built) { franjaPreviewQuad = null; franjaPreviewDivs = []; return; }
    franjaPreviewQuad = [built.topPts[0], built.topPts[N], built.botPts[N], built.botPts[0]];
    franjaPreviewDivs = [];
    for (let i = 1; i < N; i++) {
        franjaPreviewDivs.push({ id: 'franja_preview_div_' + i, tipo: 'franja-preview-div', puntos: [built.topPts[i], built.botPts[i]] });
    }
}
function renderFranjaModalScalePreview() {
    const bar = document.getElementById('franja-modal-scale-preview');
    if (!bar) return;
    const weights = getFranjaModalWeights();
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    bar.innerHTML = '';
    weights.forEach((w, i) => {
        const seg = document.createElement('div');
        seg.className = 'franja-scale-seg';
        seg.style.flex = String(Math.max(0.001, w / total));
        seg.style.opacity = String(0.45 + (w / Math.max(...weights)) * 0.55);
        seg.textContent = String(i + 1).padStart(2, '0');
        bar.appendChild(seg);
    });
    
    // Live preview on the 3D map for the new Franja (Fila Variable)
    if (typeof window.arq2_updateFilaVariableLivePreview === 'function') {
        window.arq2_updateFilaVariableLivePreview(weights);
    }
}
function getFranjaModalWeights() {
    return [...document.querySelectorAll('#franja-modal-rows .franja-weight-input')].map(inp => parseFloat(inp.value.replace(',', '.')) || franjaDraftBaseM2);
}
function renderFranjaModalRows(n, prevWeights) {
    const rows = document.getElementById('franja-modal-rows');
    if (!rows) return;
    n = Math.max(1, Math.min(200, n));
    rows.innerHTML = '';
    for (let i = 0; i < n; i++) {
        const val = prevWeights?.[i] ?? (i === n - 1 && prevWeights?.length === n - 1 ? franjaDraftBaseM2 * 1.4 : franjaDraftBaseM2);
        const row = document.createElement('div');
        row.className = 'franja-weight-row';
        row.innerHTML = `<label>Lote ${String(i + 1).padStart(2, '0')}</label><input type="number" class="franja-weight-input" min="1" step="100" value="${Math.round(val)}"><span>m²</span>`;
        row.querySelector('input').addEventListener('input', renderFranjaModalScalePreview);
        rows.appendChild(row);
    }
    renderFranjaModalScalePreview();
}
function openFranjaLotesModal(defaultN, onConfirm) {
    const modal = document.getElementById('franja-lotes-modal');
    const countIn = document.getElementById('franja-modal-count');
    if (!modal || !countIn) return;
    countIn.value = defaultN;
    renderFranjaModalRows(defaultN);
    modal.dataset.onConfirm = '1';
    modal._franjaConfirm = onConfirm;
    const titleEl = modal.querySelector('h3');
    const hintEl = modal.querySelector('.franja-modal-hint');
    const confirmBtn = document.getElementById('franja-modal-confirm');
    if (arq2PendingFila?.contorno) {
        if (arq2Tool === 'fila-calle') {
            if (titleEl) titleEl.textContent = '🛣️ Fila sobre Calle — lotes y m²';
            if (hintEl) hintEl.textContent = 'Define cuántos lotes quieres paralelos a la calle y el m² de cada uno. Las divisiones internas serán perpendiculares al borde de la calle.';
        } else {
            if (titleEl) titleEl.textContent = '〰️ Fila Variable — lotes y m²';
            if (hintEl) hintEl.textContent = 'Indica cuántos lotes quieres dentro del contorno y el m² de cada uno. Las divisiones internas serán proporcionales al área.';
        }
        if (confirmBtn) confirmBtn.textContent = 'Generar hilera';
    } else {
        if (titleEl) titleEl.textContent = '🏘️ Franja de Lotes';
        if (hintEl) hintEl.textContent = 'Indica cuántos lotes y el tamaño de cada uno en m². El ancho en el mapa será proporcional (ej. 7000 m² = 40% más ancho que 5000 m²).';
        if (confirmBtn) confirmBtn.textContent = 'Crear franja';
    }
    modal.classList.add('open');
}
function closeFranjaLotesModal() {
    const modal = document.getElementById('franja-lotes-modal');
    if (modal) { modal.classList.remove('open'); modal._franjaConfirm = null; }
    if (arq2PendingFila?.contorno) { arq2PendingFila = null; arq2FilaVariableContorno = null; }
    franjaPendingCreate = null;
    franjaPreviewQuad = null;
    franjaPreviewDivs = [];
}
function commitFranjaFromModal() {
    const modal = document.getElementById('franja-lotes-modal');
    if (arq2PendingFila?.contorno) {
        const N = Math.max(1, Math.min(200, parseInt(document.getElementById('franja-modal-count')?.value, 10) || 4));
        const weights = getFranjaModalWeights();
        if (weights.length !== N) { alert('⚠️ Actualiza la lista para coincidir.'); return; }
        // If a custom callback is stored (fila-calle), use it; otherwise use default fila-variable commit
        const cb = modal?._franjaConfirm;
        
        // BUG FIX: closeFranjaLotesModal clears arq2PendingFila. We must preserve it for the commit.
        const savedContorno = [...arq2PendingFila.contorno];
        closeFranjaLotesModal();
        arq2PendingFila = { contorno: savedContorno };
        
        if (typeof cb === 'function') {
            cb(weights);
        } else {
            arq2_commitFilaVariable(weights);
        }
        return;
    }
    const pending = franjaPendingCreate;
    const cb = modal?._franjaConfirm;
    if (!pending || !cb) { closeFranjaLotesModal(); return; }
    const N = Math.max(1, Math.min(200, parseInt(document.getElementById('franja-modal-count')?.value, 10) || franjaDraftCount));
    const weights = getFranjaModalWeights();
    if (weights.length !== N) { alert('⚠️ Actualiza la lista para coincidir.'); return; }
    const splits = weightsToFranjaSplits(weights);
    
    franjaDraftCount = N; franjaDraftBaseM2 = Math.round(weights.reduce((a, b) => a + b, 0) / N);
    closeFranjaLotesModal();

    const finalBuilt = buildFranjaScreenPointsSnapped(pending.ax, pending.ay, pending.bx, pending.by, N, null, splits);
    if (!finalBuilt) { alert('⚠️ No se pudo proyectar la franja.'); refreshAllHotspots(); return; }

    if (pending.tipo === 'franja_curva') {
        const gid = 'franja_curva_' + Date.now();
        const ELASTIC_NODES = 7;
        const topPts = resamplePolylineToCount(finalBuilt.topPts, ELASTIC_NODES);
        const botPts = resamplePolylineToCount(finalBuilt.botPts, ELASTIC_NODES);
        allDrawnLines.push({ id: gid, tipo: 'franja-curva-grupo', franjaCount: N, frente: topPts, fondo: botPts, franjaSplits: splits });
        rebuildFranjaCurvaGroup(gid);
        weldFranjaCurvaToNeighbors(gid);
        ensureStitchedDivisorias();
        if (window.isArquitecto2Active && window.arq3Ferrari && typeof window.arq3Ferrari.importFranjaLotes === 'function') {
            window.arq3Ferrari.importFranjaLotes(gid);
        }
        refreshAllHotspots(); saveToLocal(); flashScreenSuccess();
        return;
    }

    const newGid = finalizeNewFranja(finalBuilt.topPts, finalBuilt.botPts, N, pending.snap, splits);
    if (window.isArquitecto2Active && window.arq3Ferrari && typeof window.arq3Ferrari.importFranjaLotes === 'function' && newGid) {
        window.arq3Ferrari.importFranjaLotes(newGid);
    }
    refreshAllHotspots(); saveToLocal(); flashScreenSuccess();
}

function refreshFranjaCurvaPreview() {
    if (currentLineType !== 'franja_curva') { franjaCurvaPreviewStrip = null; return; }
    if (franjaCurvaFase === 2 && franjaCurvaFrente.length >= 2 && currentLinePoints.length >= 2) {
        let fondo = [...currentLinePoints];
        const dDirect = Math.hypot(franjaCurvaFrente[0][0] - fondo[0][0], franjaCurvaFrente[0][1] - fondo[0][1]);
        const dCross = Math.hypot(franjaCurvaFrente[0][0] - fondo[fondo.length - 1][0], franjaCurvaFrente[0][1] - fondo[fondo.length - 1][1]);
        if (dCross < dDirect) fondo.reverse();
        franjaCurvaPreviewStrip = [...franjaCurvaFrente, ...fondo.slice().reverse()];
    } else {
        franjaCurvaPreviewStrip = null;
    }
}

// ========== MODO ARQUITECTO 2.0 (prefijo arq2_) ==========
const ARQ2_STEPS = [
    { tool: 'lote-libre', id: 'corners', text: 'Haz clic SOLO en las esquinas reales del terreno (5-8 clics máx). Evita clics en tramos rectos intermedios.' },
    { tool: 'lote-libre', id: 'curve', text: '¿Ves una curva natural (bosque, quebrada)? Haz varios clics seguidos ahí — se suavizarán solos. En bordes rectos, deja más espacio entre clics.' },
    { tool: 'lote-libre', id: 'close', text: 'Cierra acercándote al círculo blanco inicial, o presiona Enter.' },
    { tool: 'costura', id: 'corners', text: 'Coloca vértices en esquinas reales; el imán cian pegará a bordes vecinos al acercarte.' },
    { tool: 'costura', id: 'curve', text: 'En curvas naturales, varios clics seguidos se suavizan. Esquinas marcadas (<150°) quedan rectas.' },
    { tool: 'costura', id: 'close', text: 'Cierra el polígono; los bordes compartidos quedarán como divisoria punteada.' },
    { tool: 'relleno-auto', id: 'corners', text: 'Marca esquinas reales con pocos clics; al cerrar se numera y marca disponible solo.' },
    { tool: 'relleno-auto', id: 'curve', text: 'Curvas naturales: clics seguidos. Bordes rectos: un clic por esquina, sin puntos intermedios.' },
    { tool: 'relleno-auto', id: 'close', text: 'Enter o clic en el origen — numeración correlativa automática.' },
    { tool: 'fila-variable', id: 'contorno', text: 'Dibuja el contorno COMPLETO de la hilera (todo el terreno junto, como un solo lote grande). Cierra con Enter.' },
    { tool: 'fila-variable', id: 'modal', text: 'Indica cuántos lotes y sus m² en la ventana emergente.' },
    { tool: 'fila-variable', id: 'done', text: 'Listo — las divisiones internas se dibujan solas, proporcionales.' },
    { tool: 'calle-curva-arq2', id: 'finish', text: 'Enter para terminar — curvas suaves automáticas, terminaciones redondeadas.' },
    { tool: 'eraser', id: 'corners', text: 'Haz clic o mantén presionado sobre cualquier lote, calle o subdivisión para borrarlo.' },
    { tool: 'fila-calle', id: 'select', text: 'Haz clic sobre el borde INTERIOR de una calle para seleccionarlo como frente de los lotes.' },
    { tool: 'fila-calle', id: 'depth', text: 'Ajusta la profundidad con el slider y haz clic en «Definir Lotes».' },
    { tool: 'fila-calle', id: 'modal', text: 'Indica cuántos lotes y sus m² en la ventana — se generan alineados a la calle.' },
    { tool: 'kprano-capsule', id: 'corners', text: 'KpranoKiller: Haz clic en el cielo o terreno para anclar una cápsula espacial 3D.' },
    { tool: 'kprano-capsule', id: 'edit',    text: 'Las cápsulas se pegan perfectamente a la foto. Soporta HTML avanzado y Glassmorphism.' },
    { tool: 'smart-pin-v2', id: 'corners', text: 'Haz clic sobre cualquier lote libre o zona del terreno — se abrirá el editor premium para completar datos (número, precio, superficie, estado, video 360).' },
    { tool: 'smart-pin-v2', id: 'edit',    text: 'Doble clic sobre un pin existente para editar. Arrastra con el modo Pines (Ctrl+P) activo. Botones ✎/🗑 en hover para editar o eliminar.' }
];
function arq2_applyOrganicPathAttrs(pathEl, role) {
    if (!pathEl) return;
    // Lee el valor dinámico de --stroke-dyn para coincidir con el sistema premium de franja lote
    const dynPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stroke-dyn') || '2.5') || 2.5;
    if (role === 'solid') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.16)');
        pathEl.setAttribute('fill-opacity', '1');
        pathEl.setAttribute('stroke', 'rgba(255,255,255,0.94)');
        pathEl.setAttribute('stroke-width', dynPx * 0.48);
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.style.pointerEvents = 'auto';
        pathEl.style.mixBlendMode = 'normal';
        pathEl.style.filter = 'drop-shadow(0 0 1px rgba(255,255,255,0.35))';
    } else if (role === 'fill') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.16)');
        pathEl.setAttribute('fill-opacity', '1');
        pathEl.setAttribute('stroke', 'none');
        pathEl.style.setProperty('stroke', 'none', 'important');
        pathEl.style.pointerEvents = 'auto';
        pathEl.style.mixBlendMode = 'normal';
        pathEl.style.filter = '';
    } else if (role === 'dash') {
        // Divisoria punteada interna — estilo premium como franja (1.05px aprox)
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', 'rgba(255,255,255,0.78)');
        pathEl.setAttribute('stroke-width', dynPx * 0.42);
        pathEl.setAttribute('stroke-dasharray', '5,7');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
        pathEl.style.filter = '';
    } else if (role === 'shared-solid') {
        // Borde compartido sólido — estilo premium
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', 'rgba(255,255,255,0.94)');
        pathEl.setAttribute('stroke-width', dynPx * 0.42);
        pathEl.setAttribute('stroke-dasharray', 'none');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
        pathEl.style.filter = '';
    } else if (role === 'perimeter') {
        // Borde exterior — idéntico al borde premium de franja lote clásica
        pathEl.setAttribute('fill', 'none');
        pathEl.setAttribute('stroke', 'rgba(255,255,255,0.94)');
        pathEl.setAttribute('stroke-width', dynPx * 0.48);
        pathEl.setAttribute('stroke-dasharray', 'none');
        pathEl.setAttribute('stroke-linecap', 'round');
        pathEl.setAttribute('stroke-linejoin', 'round');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.mixBlendMode = 'normal';
        pathEl.style.filter = 'drop-shadow(0 0 1px rgba(255,255,255,0.35))';
    } else if (role === 'preview') {
        pathEl.setAttribute('fill', 'rgba(16,185,129,0.10)');
        pathEl.setAttribute('stroke', '#10b981');
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', '4 4');
        pathEl.style.pointerEvents = 'none';
        pathEl.style.filter = '';
    }
}