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
    arq2_setStatusText('Costura lote ' + (line.arq2Numero || line.franjaNumero || '') + ': ' + (next === 'punteada' ? 'punteada ✓' : 'sólida ✓'));
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
    const lblContour = arq2_demoMakeMidLabel(root, ns, contour[0], contour[1], 'CONTORNO ✓ (Enter)', 'arq2-demo-tag');
    const lblScale = arq2_demoMakeText(root, ns, lotCenters[1] || contour[0], '📐 Divisiones proporcionales al m²', 'arq2-demo-tag arq2-demo-center-tag');
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
    const autoNum = arq2Tool === 'relleno-auto';
    let numero = arq2_getNextLoteNumero();
    if (!autoNum) {
        const inp = prompt('Número de lote (Enter = correlativo):', numero);
        if (inp === null) return false;
        if (inp.trim()) numero = inp.trim().padStart(2, '0');
    }
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
    arq2_clearVisualFeedback();
    arq2_stopDemoAnimation();
    arq2_updateFilaCallePreview(); // clear preview SVG
    document.querySelectorAll('.arq2-costura-selected').forEach(g => g.classList.remove('arq2-costura-selected'));
    if (snapCursor) snapCursor.classList.remove('is-costura', 'active');
    arq2_updatePanelStep();
}
function arq2_setTool(tool) {
    // El botón Franja Lotes en el panel Arq2 activa el flujo clásico de franja lotes
    if (tool === 'franja-lotes') {
        if (typeof setDrawMode === 'function') {
            const btn = document.querySelector('[data-arq2-tool="franja-lotes"]');
            clearFranjaDraft && clearFranjaDraft();
            closeFranjaLotesModal && closeFranjaLotesModal();
            setDrawMode('franja', btn);
        }
        // Actualiza el botón activo visualmente
        document.querySelectorAll('.arq2-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.arq2Tool === tool));
        if (window.PinEngine) window.PinEngine.deactivate();
        return;
    }
    arq2Tool = tool;
    arq2_clearDraft();
    arq2_ensurePanelExtras();
    document.querySelectorAll('.arq2-tool-btn').forEach(b => b.classList.toggle('active', b.dataset.arq2Tool === tool));
    document.body.classList.toggle('calle-mode-active', tool === 'calle-curva-arq2' || tool === 'calle');
    document.body.classList.toggle('pin-v2-active', tool === 'smart-pin-v2');
    const hideStreetsRow = document.getElementById('arq2-lote-libre-hide-streets-row');
    if (hideStreetsRow) hideStreetsRow.style.display = (tool === 'lote-libre' || tool === 'fila-variable') ? '' : 'none';
    arq2_updatePanelStep();
    if (tool === 'fila-variable' && isArquitecto2Active) arq2_startDemoAnimation(false);
    if (tool === 'fila-calle') arq2_setupFilaCalleListeners();
    // Desactivar PinEngine si no es herramienta de pines
    if (tool !== 'smart-pin-v2' && window.PinEngine) window.PinEngine.deactivate();
}

function arq2_toggleArquitecto2(force) {
    if (typeof force === 'boolean') isArquitecto2Active = force;
    else isArquitecto2Active = !isArquitecto2Active;
    document.body.classList.toggle('arq2-active', isArquitecto2Active);
    
    const legend = document.getElementById('github-update-legend');
    
    if (!isArquitecto2Active) {
        arq2_clearDraft();
        arq2_stopDemoAnimation();
        closeFranjaLotesModal();
        // Limpiar TODOS los estados de edición para vista previa limpia
        document.body.classList.remove('eraser-mode-active');
        document.body.classList.remove('pin-v2-active');
        document.body.classList.remove('arq2-pin-active');
        document.body.classList.remove('calle-mode-active');
        window.arq2PinSubTool = null;
        if (window.PinEngine) window.PinEngine.deactivate();
        refreshAllHotspots(true);
        if (legend) legend.style.display = 'none';
    } else {
        arq2_ensureFeedbackLayer();
        arq2_ensureDemoLayer();
        arq2_ensurePanelExtras();
        arq2_ensureSmoothIntensityPanel();
        arq2_setTool(arq2Tool);
        refreshAllHotspots(true);
        
        if (legend) {
            legend.style.display = 'inline';
            if (!legend.dataset.loaded) {
                legend.textContent = 'Verificando GitHub...';
                fetch('https://api.github.com/repos/iLyCoNs/alercepatagon360/commits')
                    .then(r => r.json())
                    .then(data => {
                        if (data && data[0]) {
                            const d = new Date(data[0].commit.author.date);
                            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            let words = data[0].commit.message.split(/\s+/).slice(0, 5).join(' ');
                            if (data[0].commit.message.split(/\s+/).length > 5) words += '...';
                            legend.innerHTML = `| Act. ${time}: <i>${words}</i>`;
                            legend.dataset.loaded = 'true';
                        }
                    }).catch(e => { legend.style.display = 'none'; });
            }
        }
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