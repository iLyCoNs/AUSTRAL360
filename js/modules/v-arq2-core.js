function arq2_getCameraContext() {
    const container = document.getElementById('panorama-container');
    if (!visor360 || !container) return null;
    const w = container.clientWidth, h = container.clientHeight;
    const cp = visor360.getPitch() * Math.PI / 180, cy = visor360.getYaw() * Math.PI / 180, hfov = visor360.getHfov();
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

function arq2_subdivideForProjection(pts, isClosed) {
    if (!pts || pts.length < 2) return pts;
    const subPts = [];
    for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        subPts.push(p1);
        if (!isClosed && i === pts.length - 1) break;
        const p2 = pts[(i + 1) % pts.length];
        let dp = Math.abs(p1[0] - p2[0]);
        let dy = Math.abs(p1[1] - p2[1]);
        if (dy > 180) dy = 360 - dy;
        const maxDist = Math.max(dp, dy);
        if (maxDist > 4) {
            const numSegments = Math.min(50, Math.ceil(maxDist / 4));
            const p1r = p1[0] * Math.PI / 180, y1r = p1[1] * Math.PI / 180;
            const p2r = p2[0] * Math.PI / 180, y2r = p2[1] * Math.PI / 180;
            const v1 = [Math.cos(p1r)*Math.sin(y1r), Math.sin(p1r), Math.cos(p1r)*Math.cos(y1r)];
            const v2 = [Math.cos(p2r)*Math.sin(y2r), Math.sin(p2r), Math.cos(p2r)*Math.cos(y2r)];
            const dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            if (angle > 0.01) {
                const sinOmega = Math.sin(angle);
                for (let j = 1; j < numSegments; j++) {
                    const t = j / numSegments;
                    const s1 = Math.sin((1 - t) * angle) / sinOmega;
                    const s2 = Math.sin(t * angle) / sinOmega;
                    const x = s1 * v1[0] + s2 * v2[0];
                    const y = s1 * v1[1] + s2 * v2[1];
                    const z = s1 * v1[2] + s2 * v2[2];
                    const r = Math.hypot(x, z);
                    const pitch = Math.atan2(y, r) * 180 / Math.PI;
                    const yaw = Math.atan2(x, z) * 180 / Math.PI;
                    subPts.push([pitch, yaw]);
                }
            }
        }
    }
    return subPts;
}

function arq2_projectPolylineD(pts, isClosed, getCamFn, cx, cySc, f) {
    if (!pts || pts.length < 2) return '';
    const subPts = arq2_subdivideForProjection(pts, isClosed);
    const NEAR = 0.0001;
    const W = cx * 2, H = cySc * 2;
    const padding = Math.max(W, H);
    const bounds = [-padding, -padding, W + padding, H + padding];
    
    let d = '', hasVisible = false;
    for (let i = 0; i < subPts.length; i++) {
        const p1 = subPts[i], p2 = subPts[(i + 1) % subPts.length];
        if (!isClosed && i === subPts.length - 1) break;
        
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
    if (isClosed && d.trim()) d += ' Z';
    return hasVisible ? d : '';
}
function arq2_getActiveDrawPoints() {
    return arq2LinePoints;
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
            costuraToggle.textContent = cur === 'punteada' ? 'Cambiar a sólida' : 'Cambiar a punteada';
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
            sem.textContent = 'Cruzando calle o límite, corrige el punto';
            sem.classList.add('arq2-sem-red');
        } else if (arq2CosturaSnap && isArquitecto2Active) {
            sem.textContent = 'Imán activo — puedes encadenar a forma existente';
            sem.classList.add('arq2-sem-yellow');
        } else {
            sem.textContent = 'Trazo limpio';
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
        el.textContent = 'Lote actual: ' + current + ' m² | Total hilera: ' + total + ' m²';
    } else {
        el.textContent = 'Vértices: ' + pts.length + (arq2Tool === 'fila-variable' ? ' (mín. 4)' : '');
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

    // === VÉRTICES IMAGINARIOS: Miter corner guides for calle-curva ===
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
        let mx = mock.clientX - DOMCache.viewport.left;
        let my = mock.clientY - DOMCache.viewport.top;
        if (arq2CosturaSnap) {
            mx = arq2CosturaSnap.screenX - DOMCache.viewport.left;
            my = arq2CosturaSnap.screenY - DOMCache.viewport.top;
        }
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
window.arq2_recalcAllPolygonStatuses = function() {
    if (!window.allDrawnLines || !window.BaseDatosLotes || typeof window.pointInPolygonPY !== 'function') return;
    
    const lotePins = window.BaseDatosLotes.filter(p => p.tipo === 'lote' && p.pitch != null && p.yaw != null);
    
    window.allDrawnLines.forEach(line => {
        if (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote' || line.tipo === 'area-invisible' || line.tipo === 'solida') {
            if (!line.puntos || line.puntos.length < 3) return;
            
            let foundPin = false;
            for (let i = 0; i < lotePins.length; i++) {
                const pin = lotePins[i];
                if (window.pointInPolygonPY(pin.pitch, pin.yaw, line.puntos)) {
                    line.loteStatus = pin.status || 'disponible';
                    foundPin = true;
                    break;
                }
            }
            if (!foundPin) {
                line.loteStatus = 'disponible';
            }
            
            const gNode = document.getElementById(line.id);
            if (gNode) {
                gNode.setAttribute('data-status', line.loteStatus);
            }
        }
    });
};
