function rebuildFranjaCurvaGroup(gid) {
    const grp = allDrawnLines.find(l => l.id === gid && l.tipo === 'franja-curva-grupo');
    if (!grp) return;
    const N = grp.franjaCount || 2;
    const splits = ensureFranjaSplits(grp);
    allDrawnLines = allDrawnLines.filter(l => l.franjaGrupo !== gid);
    const rails = getFranjaSplitRailPoints(grp);
    if (!rails) return;
    const { topPts, botPts } = rails;
    const draftPolys = [];
    for (let i = 0; i < N; i++) {
        const topSeg = extractPolylineSegment(grp.frente, splits[i], splits[i + 1]);
        const botSeg = extractPolylineSegment(grp.fondo, splits[i], splits[i + 1]).reverse();
        draftPolys.push({
            id: gid + '_' + i, tipo: 'solida', franjaGrupo: gid, franjaIdx: i,
            franjaNumero: String(i + 1).padStart(2, '0'),
            puntos: [...topSeg, ...botSeg]
        });
    }

    if (window.draggingFranjaDiv) {
        draftPolys.forEach((f) => { f.tipo = 'area-invisible'; });
        const fastEdges = [];
        for (let i = 1; i < N; i++) {
            fastEdges.push({
                id: gid + '_div_' + i, tipo: 'divisoria', franjaGrupo: gid, franjaIdx: i - 1,
                puntos: [topPts[i], botPts[i]]
            });
        }
        allDrawnLines.push(...draftPolys, ...fastEdges);
        return;
    }

    const { invisibleFills, macroLines } = buildAutoMacroFromLotes(draftPolys);
    let edges = injectFranjaInternalDivisorias(macroLines, gid, topPts, botPts, N);
    invisibleFills.forEach((f, i) => { f.franjaGrupo = gid; f.franjaIdx = i; f.franjaNumero = draftPolys[i].franjaNumero; f.id = gid + '_' + i; });
    edges.forEach(m => { m.franjaGrupo = gid; });
    allDrawnLines.push(...invisibleFills, ...edges);
    document.body.classList.add('auto-macro-active');
}

document.addEventListener("DOMContentLoaded", async () => {
    if (window.self !== window.top) document.body.classList.add('is-embedded');
    if (isTouchDevice()) { isWebGLSupported = true; viewerGpuReady = false; } else { isWebGLSupported = detectWebGL(); }
    const splashBar = document.getElementById('js-progress-bar'); if (splashBar) splashBar.style.width = '30%';
    await fetchMasterData(); if (splashBar) splashBar.style.width = '60%'; await fetchValorUFOnline(); initAutoMacroFromData();
    snapCursor = document.getElementById('snap-cursor'); ghostPin = document.getElementById('ghost-pin');
    const container = document.getElementById('panorama-container');
    const resizeObserver = new ResizeObserver(entries => { for (let entry of entries) { const rect = entry.target.getBoundingClientRect(); DOMCache.viewport.w = rect.width; DOMCache.viewport.h = rect.height; DOMCache.viewport.left = rect.left; DOMCache.viewport.top = rect.top; } if (visor360) { try { visor360.resize(); } catch(e){} if (viewerGpuReady) { const renderer = visor360.getRenderer(); if (renderer && typeof renderer.resize === 'function') renderer.resize(); } } if (typeof updateSVGPaths === 'function') { updateSVGPaths(); } });
    resizeObserver.observe(container); const initialRect = container.getBoundingClientRect(); DOMCache.viewport.w = initialRect.width; DOMCache.viewport.h = initialRect.height; DOMCache.viewport.left = initialRect.left; DOMCache.viewport.top = initialRect.top;
    // SVG #loteo-svg ya está declarado en el HTML como capa fija independiente.
    // NO recrearlo ni moverlo: hacerlo lo mete en el stacking context 3D de Pannellum y causa flotamiento permanente.
    if (!document.getElementById('loteo-svg')) { const svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svgEl.id = "loteo-svg"; }
    setupUI(); setupFilters(); renderSidebarList(BaseDatosLotes); setupPegmanEngine(); setupGesturalBackdoor();
    initPannellum(); runSplashScreen(); setupDevModes(); arq2_setup(); setupModalEditor(); setupInAppModal(); setupGlobalDelegation(); setupSunEngine(); setupNavPinTouchInteractions();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        document.documentElement.classList.add('is-admin-editor');
        document.body.classList.add('is-admin-editor');
        document.querySelector('.premium-header')?.style.setProperty('display','none'); document.querySelector('.premium-dock')?.style.setProperty('display','none'); document.getElementById('promo-banner-hud')?.style.setProperty('display','none'); document.getElementById('js-poi-trigger')?.style.setProperty('display','none');
        document.querySelectorAll('.export-ai').forEach(btn => { btn.innerText = "💾 GUARDAR EN NUBE"; btn.title = "Envía los trazos directamente a GitHub mediante el Panel"; });
        setTimeout(() => { togglePinsMode(true); window.parent.postMessage({ type: 'EDITOR_READY', vista: FRESIA_CFG.vista }, '*'); }, 3500);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window.self !== window.top) {
                e.preventDefault();
                e.stopPropagation();
                window.parent.postMessage({ type: 'ADMIN_CLOSE_FULLSCREEN' }, '*');
            }
        }, true);
    }
});

function setupGesturalBackdoor() {
    let backdoorTimer = null; let backdoorStartTouches = [];
    document.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { let sumY = 0; backdoorStartTouches = []; for(let i=0; i<2; i++) { sumY += e.touches[i].clientY; backdoorStartTouches.push(e.touches[i].clientY); } let avgY = sumY / 2; let isTop = avgY < (window.innerHeight * 0.4); let isBottom = avgY > (window.innerHeight * 0.6); if (isTop || isBottom) { backdoorTimer = setTimeout(() => { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); if (isTop) { toggleDrawMode(false); togglePinsMode(!isDevModePinsActive); } else if (isBottom) { togglePinsMode(false); toggleDrawMode(!isDevModeDrawActive); } backdoorTimer = null; }, 3000); } } else { clearTimeout(backdoorTimer); backdoorTimer = null; } }, {passive: true});
    document.addEventListener('touchmove', (e) => { if (backdoorTimer && e.touches.length === 2) { let moveDist = Math.abs(e.touches[0].clientY - backdoorStartTouches[0]); if (moveDist > 40) { clearTimeout(backdoorTimer); backdoorTimer = null; } } else { clearTimeout(backdoorTimer); backdoorTimer = null; } }, {passive: true});
    document.addEventListener('touchend', () => { clearTimeout(backdoorTimer); backdoorTimer = null; });
    document.addEventListener('touchcancel', () => { clearTimeout(backdoorTimer); backdoorTimer = null; });
}

function runSplashScreen() { setTimeout(() => { document.getElementById('js-progress-bar').style.width = '100%'; }, 100); setTimeout(() => { document.getElementById('splash-screen').classList.add('hidden'); }, 2500); }

function getHotspotsConfig() {
    const hotspots = []; const activeBtn = document.querySelector(".filter-btn.active"); const filtroStatus = activeBtn ? activeBtn.getAttribute("data-status") : "todos"; let favs = JSON.parse(localStorage.getItem('mp360_favs') || '[]');
    BaseDatosLotes.forEach((item, index) => { let uniqueId = item.id ? "lote_" + item.id : "lote_fallback_" + index; if (item.tipo === "lote") { if (filtroStatus === "todos" || item.status === filtroStatus || (filtroStatus === "favoritos" && favs.includes(item.id))) { hotspots.push({ "id": uniqueId, "pitch": item.pitch, "yaw": item.yaw, "createTooltipFunc": generarSmartPin, "createTooltipArgs": item }); } } else if (item.tipo === "vista360" && (filtroStatus === "todos" || filtroStatus === "favoritos")) { hotspots.push({ "id": uniqueId, "pitch": item.pitch, "yaw": item.yaw, "createTooltipFunc": generarPin360, "createTooltipArgs": item }); } else if (item.tipo === "casa360" && (filtroStatus === "todos" || filtroStatus === "favoritos")) { hotspots.push({ "id": uniqueId, "pitch": item.pitch, "yaw": item.yaw, "createTooltipFunc": generarMarcadorCasa360, "createTooltipArgs": item }); } });
    PuntosHorizonte.forEach((punto, index) => { 
        let uniqueId = punto.id ? "horiz_" + punto.id : "horiz_fallback_" + index; 
        if(punto.tipo === 'ruta') {
            hotspots.push({ "id": uniqueId, "pitch": punto.pitch, "yaw": punto.yaw, "createTooltipFunc": generarMarcadorRuta, "createTooltipArgs": punto });
        } else {
            hotspots.push({ "id": uniqueId, "pitch": punto.pitch, "yaw": punto.yaw, "createTooltipFunc": generarMarcadorHorizonte, "createTooltipArgs": punto }); 
        }
    });
    if (isSvgRenderAllowed()) {
        allDrawnLines.forEach(linea => {
            if (linea.tipo === 'calle' && linea.puntos.length >= 2) {
                const st = getCalleStyleForLine(linea);
                const mid = getCalleMidpointPY(linea.puntos);
                if (mid && st.showLabel) hotspots.push({ "id": "calle_lbl_" + linea.id, "pitch": mid[0], "yaw": mid[1], "createTooltipFunc": renderCalleServidumbreLabel, "createTooltipArgs": { lineId: linea.id, labelScale: st.labelScale } });
                if ((isDevModeDrawActive || isArquitecto2Active) && mid) hotspots.push({ "id": "calle_move_" + linea.id, "pitch": mid[0], "yaw": mid[1], "createTooltipFunc": renderCalleMoveHandle, "createTooltipArgs": { lineId: linea.id } });
            }
        });
    }
    if (isSvgRenderAllowed() && isDevModePinsActive && isLineaPinesActive) {
        lineaPinesPoints.forEach((coord, idx) => {
            hotspots.push({ "id": "linea_pins_pt_" + idx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: lineaPinesTempId, type: 'linea-pines-guia', isGuide: false, idx: idx, hsId: "linea_pins_pt_" + idx } });
        });
    }
    if(isSvgRenderAllowed() && (isDevModeDrawActive || isArquitecto2Active)) {
        allDrawnLines.forEach((linea) => {
            if (linea.tipo === 'franja-grupo' || linea.tipo === 'franja-curva-grupo') {
                if (linea.tipo === 'franja-grupo') {
                    linea.puntos.forEach((coord, pIdx) => {
                        hotspots.push({ "id": "vert_franja_corner_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: linea.tipo, isGuide: true, isFranjaCorner: true, idx: pIdx, hsId: "vert_franja_corner_" + linea.id + "_" + pIdx } });
                    });
                } else {
                    const nF = linea.frente.length - 1, nB = linea.fondo.length - 1;
                    linea.frente.forEach((coord, pIdx) => {
                        const isEnd = pIdx === 0 || pIdx === nF;
                        hotspots.push({ "id": "vert_fcurva_frente_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: linea.tipo, isGuide: true, isFranjaCorner: isEnd, isFranjaElastic: !isEnd, idx: pIdx, target: 'frente', hsId: "vert_fcurva_frente_" + linea.id + "_" + pIdx } });
                    });
                    linea.fondo.forEach((coord, pIdx) => {
                        const isEnd = pIdx === 0 || pIdx === nB;
                        hotspots.push({ "id": "vert_fcurva_fondo_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: linea.tipo, isGuide: true, isFranjaCorner: isEnd, isFranjaElastic: !isEnd, idx: pIdx, target: 'fondo', hsId: "vert_fcurva_fondo_" + linea.id + "_" + pIdx } });
                    });
                }
                const N = linea.franjaCount || 2;
                const splits = ensureFranjaSplits(linea);
                let built = null;
                if (linea.tipo === 'franja-grupo') {
                    built = buildFranjaPointsFromCorners(linea.puntos[0], linea.puntos[1], linea.puntos[2], linea.puntos[3], N, splits);
                } else {
                    built = { topPts: [], botPts: [] };
                    for (let i = 0; i <= N; i++) {
                        built.topPts.push(getPointAlongPolyline(linea.frente, splits[i]));
                        built.botPts.push(getPointAlongPolyline(linea.fondo, splits[i]));
                    }
                }
                if (built && linea.tipo === 'franja-grupo') {
                    for (let di = 1; di < N; di++) {
                        const cP = (built.topPts[di][0] + built.botPts[di][0]) / 2;
                        const cY = (built.topPts[di][1] + built.botPts[di][1]) / 2;
                        const proj = getPanoramaScreenProjector();
                        const stripRect = getFranjaGrupoScreenRects().find(r => r.gid === linea.id);
                        if (proj && stripRect) {
                            const sc = proj.toScreen(cP, cY);
                            if (!sc || sc[0] < stripRect.left - 20 || sc[0] > stripRect.right + 20 || sc[1] < stripRect.top - 20 || sc[1] > stripRect.bottom + 20) continue;
                        }
                        hotspots.push({ "id": "franja_div_" + linea.id + "_" + di, "pitch": cP, "yaw": cY, "createTooltipFunc": renderFranjaDivHandle, "createTooltipArgs": { gid: linea.id, splitIdx: di } });
                    }
                }
            } else if (linea.tipo === 'calle-curva-arq2') {
                if (linea.ejeOriginal) {
                    linea.ejeOriginal.forEach((coord, pIdx) => {
                        hotspots.push({ "id": "vert_calle_curva_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: 'calle-curva-arq2-vertex', isGuide: (isDevModeDrawActive || isArquitecto2Active), idx: pIdx, hsId: "vert_calle_curva_" + linea.id + "_" + pIdx } });
                    });
                }
            } else if (linea.tipo === 'calle') {
                linea.puntos.forEach((coord, pIdx) => {
                    hotspots.push({ "id": "vert_calle_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: 'calle', isGuide: (isDevModeDrawActive || isArquitecto2Active), idx: pIdx, hsId: "vert_calle_" + linea.id + "_" + pIdx } });
                });
            } else if (linea.tipo !== 'divisoria' && linea.tipo !== 'borde-macro' && !linea.franjaGrupo) {
                linea.puntos.forEach((coord, pIdx) => {
                    hotspots.push({ "id": "vert_base_" + linea.id + "_" + pIdx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: linea.id, type: linea.tipo, isGuide: (isDevModeDrawActive || isArquitecto2Active), idx: pIdx, hsId: "vert_base_" + linea.id + "_" + pIdx } });
                });
            }
            if (linea.tipo === 'area-invisible' && linea.franjaNumero && linea.puntos.length >= 3) {
                const parentStrip = getFranjaStripById(linea.franjaGrupo);
                if (parentStrip?.tipo === 'franja-curva-grupo') return;
                if (!isFranjaLotCentroidVisible(linea)) return;
                let cP = 0, cY = 0; linea.puntos.forEach(pt => { cP += pt[0]; cY += pt[1]; });
                cP /= linea.puntos.length; cY /= linea.puntos.length;
                hotspots.push({ "id": "franja_lbl_" + linea.id, "pitch": cP, "yaw": cY, "createTooltipFunc": renderFranjaLotLabel, "createTooltipArgs": { numero: linea.franjaNumero } });
            }
            if (linea.tipo === 'fila-variable-lote' && linea.arq2FilaLotes?.length) {
                linea.arq2FilaLotes.forEach((lot, li) => {
                    if (!lot?.centroid) return;
                    hotspots.push({ "id": "arq2_fila_lbl_" + linea.id + "_" + li, "pitch": lot.centroid[0], "yaw": lot.centroid[1], "createTooltipFunc": renderFranjaLotLabel, "createTooltipArgs": { numero: lot.numero } });
                });
            } else if (linea.tipo === 'lote-organico' && linea.franjaNumero && linea.puntos.length >= 3) {
                let cP = 0, cY = 0; linea.puntos.forEach(pt => { cP += pt[0]; cY += pt[1]; });
                cP /= linea.puntos.length; cY /= linea.puntos.length;
                hotspots.push({ "id": "arq2_lbl_" + linea.id, "pitch": cP, "yaw": cY, "createTooltipFunc": renderFranjaLotLabel, "createTooltipArgs": { numero: linea.franjaNumero } });
            }
        });
        currentLinePoints.forEach((coord, idx) => { hotspots.push({ "id": "temp_base_" + currentTempLineId + "_" + idx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: currentTempLineId, type: currentLineType, isGuide: (isDevModeDrawActive || isArquitecto2Active), idx: idx, hsId: "temp_base_" + currentTempLineId + "_" + idx } }); });
        if (isArquitecto2Active) {
            arq2LinePoints.forEach((coord, idx) => hotspots.push({ "id": "arq2_temp_" + idx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: arq2TempLineId, type: arq2Tool === 'fila-variable' ? 'lote-organico-preview' : 'lote-libre', isGuide: true, idx, hsId: "arq2_temp_" + idx } }));
        }
        if (currentLineType === 'franja_curva' && franjaCurvaFrente.length > 0) {
            franjaCurvaFrente.forEach((coord, idx) => {
                hotspots.push({ "id": "temp_fcurva_frente_" + idx, "pitch": coord[0], "yaw": coord[1], "createTooltipFunc": renderHiddenVertex, "createTooltipArgs": { lineId: 'franja_curva_preview_frente', type: 'franja-preview', isGuide: true, idx: idx, hsId: "temp_fcurva_frente_" + idx } });
            });
        }
        if (currentLineType === 'calle' && currentLinePoints.length >= 2 && draftCalleShowLabel) {
            const mid = getCalleMidpointPY(currentLinePoints);
            if (mid) hotspots.push({ "id": "calle_lbl_" + currentTempLineId, "pitch": mid[0], "yaw": mid[1], "createTooltipFunc": renderCalleServidumbreLabel, "createTooltipArgs": { lineId: currentTempLineId, isDraft: true, labelScale: draftCalleLabelScale } });
        }
    }
    return hotspots;
}
