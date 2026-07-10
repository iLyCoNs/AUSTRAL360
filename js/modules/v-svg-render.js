function syncSVGElements() {
    if(!isSvgRenderAllowed()) return; const svg = document.getElementById('loteo-svg'); if(!svg) return;
    let lBordes = document.getElementById('layer-calles-bordes'), lAsfalto = document.getElementById('layer-calles-asfalto'), lLotes = document.getElementById('layer-lotes'), lAristas = document.getElementById('layer-aristas');
    if(!lBordes) { svg.innerHTML = '<g id="layer-calles-bordes"></g><g id="layer-calles-asfalto"></g><g id="layer-calles-arq2"></g><g id="layer-lotes"></g><g id="layer-aristas"></g>'; lBordes = document.getElementById('layer-calles-bordes'); lAsfalto = document.getElementById('layer-calles-asfalto'); lLotes = document.getElementById('layer-lotes'); lAristas = document.getElementById('layer-aristas'); }
    let lCallesArq2 = document.getElementById('layer-calles-arq2');
    if (!lCallesArq2 && svg) { lCallesArq2 = document.createElementNS("http://www.w3.org/2000/svg", "g"); lCallesArq2.id = 'layer-calles-arq2'; svg.insertBefore(lCallesArq2, lLotes); }
    const currentLineIds = allDrawnLines.map(l => l.id);
    if (currentLinePoints.length > 0) currentLineIds.push(currentTempLineId);
    if (isArquitecto2Active && arq2LinePoints.length > 0) {
        currentLineIds.push(arq2TempLineId);
    }
    if (isLineaPinesActive && lineaPinesPoints.length > 0) currentLineIds.push(lineaPinesTempId);
    if (franjaPreviewQuad) currentLineIds.push('franja_preview_quad'); if (franjaCurvaFrente.length > 0) currentLineIds.push('franja_curva_preview_frente'); if (franjaCurvaPreviewStrip) currentLineIds.push('franja_curva_preview_strip'); franjaPreviewDivs.forEach(d => currentLineIds.push(d.id));
    Array.from(svg.querySelectorAll('[data-line-id]')).forEach(el => { if (!currentLineIds.includes(el.dataset.lineId)) el.remove(); });
    DOMCache.paths = {}; const allLinesData = [...allDrawnLines];
    if (currentLinePoints.length > 0) allLinesData.push({ id: currentTempLineId, tipo: currentLineType === 'franja_curva' ? 'franja-preview' : currentLineType, puntos: currentLinePoints });
    if (isArquitecto2Active && arq2LinePoints.length > 0) {
        if (arq2Tool === 'calle-curva-arq2') allLinesData.push(arq2_getCalleCurvaPreviewLineData());
        else allLinesData.push({ id: arq2TempLineId, tipo: 'lote-organico-preview', puntos: arq2LinePoints });
    }
    if (isLineaPinesActive && lineaPinesPoints.length > 0) allLinesData.push({ id: lineaPinesTempId, tipo: 'linea-pines-guia', puntos: lineaPinesPoints });
    if (franjaPreviewQuad) allLinesData.push({ id: 'franja_preview_quad', tipo: 'franja-preview', puntos: franjaPreviewQuad }); if (franjaCurvaFrente.length > 0) allLinesData.push({ id: 'franja_curva_preview_frente', tipo: 'franja-preview', puntos: franjaCurvaFrente }); if (franjaCurvaPreviewStrip) allLinesData.push({ id: 'franja_curva_preview_strip', tipo: 'franja-preview', puntos: franjaCurvaPreviewStrip }); franjaPreviewDivs.forEach(d => allLinesData.push(d));
    allLinesData.forEach(line => {
        const existingElements = svg.querySelectorAll(`[data-line-id="${line.id}"]`);
        if (existingElements.length === 0) {
            if (line.tipo === 'calle') {
                const pBorde = document.createElementNS("http://www.w3.org/2000/svg", "path"); pBorde.setAttribute("class", "linea-calle-borde"); pBorde.dataset.lineId = line.id; lBordes.appendChild(pBorde);
                const pAsfalto = document.createElementNS("http://www.w3.org/2000/svg", "path"); pAsfalto.setAttribute("class", "linea-calle-asfalto"); pAsfalto.dataset.lineId = line.id; bindSvgEraser(pAsfalto, line.id); lAsfalto.appendChild(pAsfalto); DOMCache.paths[line.id] = { base: [pBorde, pAsfalto] };
            } else if (line.tipo === 'divisoria' || line.tipo === 'borde-macro') {
                const gMacro = document.createElementNS("http://www.w3.org/2000/svg", "g"); gMacro.dataset.lineId = line.id; gMacro.dataset.tipo = line.tipo;
                const pMacro = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pMacro.setAttribute("class", line.tipo === 'divisoria' ? 'linea-divisoria' : 'linea-borde-macro');
                gMacro.appendChild(pMacro); bindSvgEraser(gMacro, line.id); bindSvgEraser(pMacro, line.id); lAristas.appendChild(gMacro); DOMCache.paths[line.id] = { base: [pMacro] };
            } else if (line.tipo === 'arista_solida' || line.tipo === 'arista_punteada') {
                const pEdge = document.createElementNS("http://www.w3.org/2000/svg", "path"); pEdge.dataset.lineId = line.id;
                pEdge.setAttribute("class", line.tipo === 'arista_solida' ? 'linea-mp-perimetro' : 'linea-mp-interna');
                lAristas.appendChild(pEdge); DOMCache.paths[line.id] = { base: [pEdge] };
            } else if (line.tipo === 'franja-grupo' || line.tipo === 'franja-curva-grupo') {
                const gGrp = document.createElementNS("http://www.w3.org/2000/svg", "g"); gGrp.dataset.lineId = line.id; gGrp.dataset.tipo = line.tipo;
                const pGrp = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pGrp.setAttribute("class", "linea-franja-grupo-outline");
                gGrp.appendChild(pGrp); bindSvgEraser(gGrp, line.id); bindSvgEraser(pGrp, line.id); lLotes.appendChild(gGrp); DOMCache.paths[line.id] = { base: [pGrp] };
            } else if (line.tipo === 'franja-preview' || line.tipo === 'franja-preview-div') {
                const gPrev = document.createElementNS("http://www.w3.org/2000/svg", "g"); gPrev.dataset.lineId = line.id; gPrev.dataset.tipo = line.tipo;
                const pPrev = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pPrev.setAttribute("class", line.tipo === 'franja-preview-div' ? 'linea-divisoria' : 'linea-franja-preview');
                gPrev.appendChild(pPrev); (line.tipo === 'franja-preview-div' ? lAristas : lLotes).appendChild(gPrev); DOMCache.paths[line.id] = { base: [pPrev] };
            } else if (line.tipo === 'linea-pines-guia') {
                const pGuide = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pGuide.setAttribute("class", "linea-pines-guia");
                pGuide.dataset.lineId = line.id;
                lAristas.appendChild(pGuide);
                DOMCache.paths[line.id] = { base: [pGuide] };
            } else if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
                const gCalle = document.createElementNS("http://www.w3.org/2000/svg", "g");
                gCalle.dataset.lineId = line.id;
                gCalle.dataset.tipo = line.tipo;
                gCalle.classList.add('calle-curva-arq2-grupo');
                const mkPath = (cls, edge) => {
                    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    p.setAttribute('class', cls);
                    if (edge) p.dataset.edgeRole = edge;
                    return p;
                };
                const pFill = mkPath('linea-calle-arq2-fill');
                const pLeft = mkPath('linea-calle-arq2-borde', 'left');
                const pRight = mkPath('linea-calle-arq2-borde', 'right');
                const pCapStart = mkPath('linea-calle-arq2-borde', 'cap-start');
                const pCapEnd = mkPath('linea-calle-arq2-borde', 'cap-end');
                const pCenter = mkPath('linea-calle-arq2-centro', 'center');
                gCalle.appendChild(pFill);
                gCalle.appendChild(pLeft);
                gCalle.appendChild(pRight);
                gCalle.appendChild(pCapStart);
                gCalle.appendChild(pCapEnd);
                gCalle.appendChild(pCenter);
                bindSvgEraser(gCalle, line.id);
                lCallesArq2.appendChild(gCalle);
                DOMCache.paths[line.id] = { gNode: gCalle, base: [pFill, pLeft, pRight, pCapStart, pCapEnd, pCenter] };
            } else if (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote') {
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                g.dataset.lineId = line.id;
                g.dataset.tipo = line.tipo;
                g.classList.add('lote-interactivo', line.tipo === 'lote-organico' ? 'lote-organico' : 'fila-variable-lote');
                g.style.isolation = 'isolate';
                g.style.mixBlendMode = 'normal';
                g.setAttribute('data-status', line.loteStatus || 'disponible');
                const pFill = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pFill.setAttribute("class", "linea-organico-fill");
                pFill.dataset.edgeRole = 'fill';
                const pPerimeter = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pPerimeter.setAttribute("class", "linea-organico-perimetro");
                pPerimeter.dataset.edgeRole = 'perimeter';
                const pDash = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pDash.setAttribute("class", "linea-punteada-costura");
                pDash.dataset.edgeRole = 'shared-punteada';
                const pSolidEdge = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pSolidEdge.setAttribute("class", "linea-solida-costura");
                pSolidEdge.dataset.edgeRole = 'shared-solida';
                g.appendChild(pFill);
                g.appendChild(pPerimeter);
                g.appendChild(pDash);
                g.appendChild(pSolidEdge);
                arq2_applyOrganicPathAttrs(pFill, 'fill');
                arq2_applyOrganicPathAttrs(pPerimeter, 'perimeter');
                arq2_applyCosturaEstiloToPath(pDash, 'punteada');
                arq2_applyCosturaEstiloToPath(pSolidEdge, 'solida');
                bindSvgEraser(g, line.id);
                lLotes.appendChild(g);
                DOMCache.paths[line.id] = { gNode: g, base: [pFill, pPerimeter, pDash, pSolidEdge] };
            } else if (line.tipo === 'lote-organico-preview') {
                const gPrev = document.createElementNS("http://www.w3.org/2000/svg", "g");
                gPrev.dataset.lineId = line.id;
                gPrev.dataset.tipo = line.tipo;
                const pPrev = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pPrev.setAttribute("class", "linea-franja-preview");
                arq2_applyOrganicPathAttrs(pPrev, 'preview');
                gPrev.appendChild(pPrev);
                lLotes.appendChild(gPrev);
                DOMCache.paths[line.id] = { base: [pPrev] };
            } else if (line.tipo === 'kprano-capsule') {
                const fObj = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
                fObj.dataset.lineId = line.id;
                fObj.dataset.tipo = line.tipo;
                fObj.setAttribute('width', '240');
                fObj.setAttribute('height', '240');
                fObj.style.overflow = 'visible';

                // BUG FIX: Usar createElement (HTML namespace) en lugar de innerHTML
                // para máxima compatibilidad cross-browser (Firefox, Safari, Chrome)
                const XHTML = 'http://www.w3.org/1999/xhtml';
                const mkEl = (tag, cls) => {
                    const el = document.createElementNS(XHTML, tag);
                    if (cls) el.setAttribute('class', cls);
                    return el;
                };

                // Ícono SVG: pin location monolineal
                const iconSvgNS = 'http://www.w3.org/2000/svg';
                const iconSvg = document.createElementNS(iconSvgNS, 'svg');
                iconSvg.setAttribute('viewBox', '0 0 24 24');
                iconSvg.setAttribute('fill', 'none');
                iconSvg.setAttribute('stroke', 'currentColor');
                iconSvg.setAttribute('stroke-width', '2');
                iconSvg.setAttribute('stroke-linecap', 'round');
                iconSvg.setAttribute('stroke-linejoin', 'round');
                const iconPath = document.createElementNS(iconSvgNS, 'path');
                iconPath.setAttribute('d', 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z');
                const iconCircle = document.createElementNS(iconSvgNS, 'circle');
                iconCircle.setAttribute('cx', '12');
                iconCircle.setAttribute('cy', '10');
                iconCircle.setAttribute('r', '3');
                iconSvg.appendChild(iconPath);
                iconSvg.appendChild(iconCircle);

                // Estructura DOM: container > [ring, content > [icon, text], anchor-line, anchor-dot]
                const container  = mkEl('div', 'kpk-capsule-container');
                const ring       = mkEl('div', 'kpk-ring-pulse');
                const content    = mkEl('div', 'kpk-content');
                const iconWrap   = mkEl('div', 'kpk-icon');
                const textEl     = mkEl('div', 'kpk-text');
                const anchorLine = mkEl('div', 'kpk-anchor-line');
                const anchorDot  = mkEl('div', 'kpk-anchor-dot');

                textEl.textContent = line.titulo || 'Punto 3D';
                iconWrap.appendChild(iconSvg);
                content.appendChild(iconWrap);
                content.appendChild(textEl);
                container.appendChild(ring);
                container.appendChild(content);
                container.appendChild(anchorLine);
                container.appendChild(anchorDot);
                fObj.appendChild(container);

                bindSvgEraser(fObj, line.id);

                fObj.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (window.isArquitecto2Active) return; // en modo diseño no abrir HUD
                    // Futuro: abrir panel info de cápsula
                });

                lLotes.appendChild(fObj);
                DOMCache.paths[line.id] = { base: [fObj], container, textEl };
            } else {
                const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.dataset.lineId = line.id; g.dataset.tipo = line.tipo; g.classList.add('lote-interactivo'); 
                const pBase = document.createElementNS("http://www.w3.org/2000/svg", "path"); 
                if (line.tipo === 'masterplan_fill') pBase.setAttribute("class", "linea-relleno-mp"); else if (line.tipo === 'neon') pBase.setAttribute("class", "linea-neon"); else if (line.tipo === 'punteada') pBase.setAttribute("class", "linea-punteada"); else if (line.tipo === 'cortar') pBase.setAttribute("class", "linea-corte"); else if (line.tipo === 'area-invisible') pBase.setAttribute("class", "linea-area-fill"); else pBase.setAttribute("class", "linea-solida");
                if (line.tipo === 'area-invisible' || line.tipo === 'lote-libre' || line.tipo === 'lote-organico' || line.tipo === 'franja-grupo') g.setAttribute('data-status', line.status || 'disponible');
                g.appendChild(pBase); bindSvgEraser(g, line.id); bindSvgEraser(pBase, line.id); g.addEventListener('touchstart', () => { g.classList.add('hovered'); }, {passive: true}); g.addEventListener('touchend', () => { setTimeout(() => g.classList.remove('hovered'), 1500); }, {passive: true}); 
                g.addEventListener('click', (e) => { if (window.showPremiumHUD && !window.isArquitecto2Active) window.showPremiumHUD(line.id, e); });
                lLotes.appendChild(g); DOMCache.paths[line.id] = { gNode: g, base: [pBase] };
            }
        } else {
            if (line.tipo === 'calle') {
                const bordeEl = svg.querySelector(`.linea-calle-borde[data-line-id="${line.id}"]`);
                const asfEl = svg.querySelector(`.linea-calle-asfalto[data-line-id="${line.id}"]`);
                if (bordeEl && bordeEl.parentNode !== lBordes) lBordes.appendChild(bordeEl);
                if (asfEl && asfEl.parentNode !== lAsfalto) lAsfalto.appendChild(asfEl);
                DOMCache.paths[line.id] = { base: [bordeEl, asfEl].filter(Boolean) };
            } else if (line.tipo === 'arista_solida' || line.tipo === 'arista_punteada' || line.tipo === 'linea-pines-guia') {
                const pEl = svg.querySelector(`path[data-line-id="${line.id}"]`);
                const target = lAristas;
                if (pEl && pEl.parentNode !== target) target.appendChild(pEl);
                if (pEl) DOMCache.paths[line.id] = { base: [pEl] };
            } else {
                const gNode = svg.querySelector(`g[data-line-id="${line.id}"]`);
                if (gNode) {
                    gNode.dataset.tipo = line.tipo;
                    const targetLayer = resolveSvgLayerForLine(line, { lBordes, lAsfalto, lLotes, lAristas });
                    if (targetLayer && gNode.parentNode !== targetLayer) targetLayer.appendChild(gNode);
                    const pBase = gNode.querySelector('path');
                    if (pBase) pBase.setAttribute('class', getPathClassForLine(line));
                    if (line.tipo === 'lote-organico' || line.tipo === 'fila-variable-lote') {
                        gNode.style.isolation = 'isolate';
                        gNode.style.mixBlendMode = 'normal';
                        arq2_ensureOrganicPathLayers(gNode, line);
                    } else if (line.tipo === 'calle-curva-arq2' || line.tipo === 'calle-curva-arq2-preview') {
                        const targetLayer = lCallesArq2 || resolveSvgLayerForLine(line, { lBordes, lAsfalto, lLotes, lAristas });
                        if (targetLayer && gNode.parentNode !== targetLayer) targetLayer.appendChild(gNode);
                        let paths = Array.from(gNode.querySelectorAll('path'));
                        while (paths.length < 6) {
                            const pExtra = document.createElementNS("http://www.w3.org/2000/svg", "path");
                            pExtra.setAttribute('class', paths.length === 0 ? 'linea-calle-arq2-fill' : (paths.length === 5 ? 'linea-calle-arq2-centro' : 'linea-calle-arq2-borde'));
                            if (paths.length === 5) pExtra.dataset.edgeRole = 'center';
                            gNode.appendChild(pExtra);
                            paths = Array.from(gNode.querySelectorAll('path'));
                        }
                    }
                    bindSvgEraser(gNode, line.id);
                    if (pBase) bindSvgEraser(pBase, line.id);
                    DOMCache.paths[line.id] = { gNode: gNode, base: Array.from(gNode.querySelectorAll('path:not(.kpk-guide-line)')) };
                }
            }
        }
    });
    ensureSvgLayerOrder(svg);
}

function updateSVGPaths() {
    if (!visor360 || !isSvgRenderAllowed()) return;
    // Refresh fila-calle preview when camera changes
    if (arq2Tool === 'fila-calle' && arq2FilaCalle?.borderPts) arq2_updateFilaCallePreview();
    const container = document.getElementById('panorama-container'); if(!container) return;
    const w = container.clientWidth, h = container.clientHeight, cp = visor360.getPitch() * Math.PI / 180, cy = visor360.getYaw() * Math.PI / 180, hfov = visor360.getHfov();
    const sin_cp = Math.sin(cp), cos_cp = Math.cos(cp), f = 0.5 * w / Math.tan(hfov * Math.PI / 360), cx = w / 2, cy_screen = h / 2;
    function getCam(pitch, yaw) { 

        const p = pitch * Math.PI / 180, y = yaw * Math.PI / 180, sin_p = Math.sin(p), cos_p = Math.cos(p); 
        let y_diff = y - cy; while (y_diff > Math.PI) y_diff -= 2 * Math.PI; while (y_diff < -Math.PI) y_diff += 2 * Math.PI; 
        const sin_yd = Math.sin(y_diff), cos_yd = Math.cos(y_diff); 
        return { x: cos_p * sin_yd, y: sin_p * cos_cp - cos_p * cos_yd * sin_cp, z: sin_p * sin_cp + cos_p * cos_yd * cos_cp }; 
    }
    Object.keys(DOMCache.paths).forEach(lineId => {
        const cacheObj = DOMCache.paths[lineId]; if (!cacheObj) return;
        let lineData = allDrawnLines.find(l => l.id === lineId);
        if (!lineData && lineId === currentTempLineId) lineData = { tipo: currentLineType, puntos: currentLinePoints, calleAncho: currentLineType === 'calle' ? draftCalleAncho : undefined, calleAlpha: currentLineType === 'calle' ? draftCalleAlpha : undefined, calleLabelScale: currentLineType === 'calle' ? draftCalleLabelScale : undefined, calleShowLabel: currentLineType === 'calle' ? draftCalleShowLabel : undefined };
        if (!lineData && lineId === lineaPinesTempId) lineData = { tipo: 'linea-pines-guia', puntos: lineaPinesPoints };
        if (!lineData && lineId === 'franja_preview_quad' && franjaPreviewQuad) lineData = { tipo: 'franja-preview', puntos: franjaPreviewQuad };
        if (!lineData && lineId === 'franja_curva_preview_frente' && franjaCurvaFrente.length >= 2) lineData = { tipo: 'franja-preview', puntos: franjaCurvaFrente };
        if (!lineData && lineId === 'franja_curva_preview_strip' && franjaCurvaPreviewStrip?.length >= 3) lineData = { tipo: 'franja-preview', puntos: franjaCurvaPreviewStrip };
        if (!lineData && lineId.startsWith('franja_preview_div_')) lineData = franjaPreviewDivs.find(d => d.id === lineId);
        if (!lineData && lineId === arq2TempLineId && arq2LinePoints.length > 0) {
            lineData = arq2Tool === 'calle-curva-arq2' ? arq2_getCalleCurvaPreviewLineData() : { tipo: 'lote-organico-preview', puntos: arq2LinePoints };
        }
        if (!lineData) return;
        let isClosed = shouldClosePolygonLine(lineId, lineData);
        if (cacheObj.gNode && lineData.tipo !== 'calle' && lineData.tipo !== 'calle-curva-arq2' && lineData.tipo !== 'calle-curva-arq2-preview' && lineData.tipo !== 'franja-grupo' && lineData.tipo !== 'franja-curva-grupo') { 
            if (lineData.puntos && lineData.puntos.length > 0) { 
                let polyStatus = lineData.loteStatus || 'disponible';
                if (cacheObj.gNode.getAttribute('data-status') !== polyStatus) {
                    cacheObj.gNode.setAttribute('data-status', polyStatus);
                }
            } 
        }
        if ((lineData.tipo === 'calle-curva-arq2' || lineData.tipo === 'calle-curva-arq2-preview') && cacheObj.base?.length >= 5) {
            const geoLine = lineData.tipo === 'calle-curva-arq2-preview' ? arq2_getCalleCurvaPreviewLineData() : lineData;
            if (!geoLine.left?.length || !geoLine.right?.length) return;
            
            // Set the dynamic color variable for CSS
            const finalColor = geoLine.calleColor || (typeof draftCalleCurvaColor !== 'undefined' ? draftCalleCurvaColor : '#5a5f69');
            cacheObj.gNode.style.setProperty('--calle-color', finalColor);
            // Aplicar inline fill-opacity para sortear limitacion CSS rgb
            arq2_applyCalleCurvaFillStyle(cacheObj.base[0], geoLine.calleCurvaAlpha);
            
            // Backward compat: compute ejeIsClosed if not stored
            if (geoLine.ejeIsClosed === undefined && geoLine.ejeOriginal) {
                geoLine.ejeIsClosed = arq2_isCalleEjeClosed(geoLine.ejeOriginal);
            }
            const projected = arq2_projectCalleCurvaPaths(geoLine, getCam, cx, cy_screen, f);
            if (!projected) return;
            cacheObj.base[0].setAttribute('d', projected.dFill || 'M -999 -999');
            
            // Render explicit border outline paths and caps for visual realism
            cacheObj.base[1].setAttribute('d', projected.dLeft || 'M -999 -999');
            cacheObj.base[2].setAttribute('d', projected.dRight || 'M -999 -999');
            if (cacheObj.base[3]) cacheObj.base[3].setAttribute('d', projected.capStart || 'M -999 -999');
            if (cacheObj.base[4]) cacheObj.base[4].setAttribute('d', projected.capEnd || 'M -999 -999');
            
            // Draw centerline (6th path in base)
            if (cacheObj.base[5] && geoLine.puntosSuavizados) {
                const dCenter = arq2_projectOpenPolylineD(geoLine.puntosSuavizados, getCam, cx, cy_screen, f);
                cacheObj.base[5].setAttribute('d', dCenter || 'M -999 -999');
            }
            
            arq2_applyCalleCurvaFillStyle(cacheObj.base[0], projected.calleCurvaAlpha ?? geoLine.calleCurvaAlpha);
            return;
        }

        if ((lineData.tipo === 'lote-organico' || lineData.tipo === 'fila-variable-lote') && cacheObj.base) {
            arq2_syncOrganicLotePaths(lineData, cacheObj, getCam, cx, cy_screen, f);
            return;
        }

        if (lineData.tipo === 'kprano-capsule' && cacheObj.base) {
            const fObj = cacheObj.base[0];
            const pt = lineData.puntos[0];
            const c = getCam(pt[0], pt[1]);
            if (c.z <= 0.0001) {
                fObj.style.display = 'none';
            } else {
                fObj.style.display = 'block';
                const px = cx + (c.x / c.z) * f;
                const py = cy_screen - (c.y / c.z) * f;
                // Centrar horizontalmente, anclar punto en la base (anchor-dot)
                fObj.setAttribute('x', px - 120);
                fObj.setAttribute('y', py - 220);
                // Sincronizar texto si fue editado
                if (cacheObj.textEl && cacheObj.textEl.textContent !== (lineData.titulo || 'Punto 3D')) {
                    cacheObj.textEl.textContent = lineData.titulo || 'Punto 3D';
                }
            }
            return;
        }

        let dBase = '';
        let pts = lineData.puntos;
        if (lineData.tipo === 'franja-curva-grupo') pts = [...lineData.frente, ...[...lineData.fondo].reverse()];
        let hasVisiblePoints = false;
        if (lineData.tipo === 'franja-curva-grupo' && document.body.classList.contains('auto-macro-active')) {
            if (cacheObj.base) cacheObj.base.forEach(path => path.setAttribute("d", 'M -999 -999'));
            return;
        }
        for (let i = 0; i < pts.length; i++) {
            let p1 = pts[i], p2 = pts[(i + 1) % pts.length];
            if (!isClosed && i === pts.length - 1) break;
            let c1 = getCam(p1[0], p1[1]), c2 = getCam(p2[0], p2[1]);
            let in1 = c1.z > 0.0001, in2 = c2.z > 0.0001; if (!in1 && !in2) continue; 
            let s1, s2;
            const W = cx * 2, H = cy_screen * 2;
            const padding = Math.max(W, H);
            const bounds = [-padding, -padding, W + padding, H + padding];
            
            if (in1) { s1 = { x: cx + (c1.x / c1.z) * f, y: cy_screen - (c1.y / c1.z) * f }; } 
            else { let t = (0.0001 - c1.z) / (c2.z - c1.z), ix = c1.x + t * (c2.x - c1.x), iy = c1.y + t * (c2.y - c1.y); s1 = { x: cx + (ix / 0.0001) * f, y: cy_screen - (iy / 0.0001) * f }; }
            
            if (in2) { s2 = { x: cx + (c2.x / c2.z) * f, y: cy_screen - (c2.y / c2.z) * f }; } 
            else { let t = (0.0001 - c2.z) / (c1.z - c2.z), ix = c2.x + t * (c1.x - c2.x), iy = c2.y + t * (c1.y - c2.y); s2 = { x: cx + (ix / 0.0001) * f, y: cy_screen - (iy / 0.0001) * f }; }
            
            if(isNaN(s1.x) || isNaN(s2.x)) continue; 
            
            const clipped = window.clipLine2D ? window.clipLine2D(s1.x, s1.y, s2.x, s2.y, bounds[0], bounds[1], bounds[2], bounds[3]) : { x1: s1.x, y1: s1.y, x2: s2.x, y2: s2.y };
            if (!clipped) continue;
            hasVisiblePoints = true;
            
            if (dBase === '') { dBase += `M ${clipped.x1},${clipped.y1} L ${clipped.x2},${clipped.y2} `; } 
            else { 
                const distSq = (clipped.x1 - s1.x)**2 + (clipped.y1 - s1.y)**2;
                if (distSq > 1 || !in1) dBase += `M ${clipped.x1},${clipped.y1} `; 
                dBase += `L ${clipped.x2},${clipped.y2} `; 
            }
        }
        if (!isClosed && (lineId === currentTempLineId || lineId === lineaPinesTempId || lineId === arq2TempLineId) && window.lastMouseX !== undefined) { 
            let mx = window.lastMouseX - DOMCache.viewport.left, my = window.lastMouseY - DOMCache.viewport.top; 
            if(dBase === '' && pts.length > 0) { 
                let c1 = getCam(pts[0][0], pts[0][1]); 
                if(c1.z > 0) {
                    dBase += `M ${cx + (c1.x / c1.z) * f},${cy_screen - (c1.y / c1.z) * f} `; 
                } else {
                    console.log(`[Antigravity Error] c1.z <= 0! pitch=${pts[0][0].toFixed(2)}, yaw=${pts[0][1].toFixed(2)}. cp=${visor360.getPitch().toFixed(2)}, cy=${visor360.getYaw().toFixed(2)}, c1.z=${c1.z.toFixed(2)}`);
                }
            } 
            if (dBase !== '') {
                dBase += `L ${mx},${my} `; 
                hasVisiblePoints = true; 
            }
        }
        if (isClosed && dBase.trim() !== '') dBase += ' Z';                 if (!hasVisiblePoints && isClosed) dBase = 'M -999 -999';
        if (cacheObj.base) {
            cacheObj.base.forEach(path => path.setAttribute("d", dBase.trim() !== '' ? dBase : 'M -999 -999'));
            if (lineData.tipo === 'calle') {
                const st = getCalleStyleForLine(lineData);
                applyCallePathStyles(cacheObj.base, st.ancho, st.alpha);
            }
        }
        
        // KPK Premium Vertices & Guide Line for Drawing Mode
        if ((lineId === currentTempLineId || lineId === arq2TempLineId) && (lineData.tipo === 'lote-libre' || lineData.tipo === 'lote-organico-preview')) {
            let parent = cacheObj.gNode || (cacheObj.base && cacheObj.base[0] ? cacheObj.base[0].parentNode : null);
            if (parent && pts && pts.length > 0) {
                try {
                    // Sincronizar numero de circulos
                    let circles = parent.querySelectorAll('.kpk-vertex');
                    while (circles.length < pts.length) {
                        let c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        c.setAttribute("class", "kpk-vertex");
                        // Bug 3: Fallback duro de radio nativo SVG porque WebKit/Safari ignoran "r" en CSS
                        c.setAttribute("r", "3.5");
                        parent.appendChild(c);
                        circles = parent.querySelectorAll('.kpk-vertex');
                    }
                    while (circles.length > pts.length) {
                        if (circles[circles.length - 1] && circles[circles.length - 1].parentNode) {
                            circles[circles.length - 1].remove();
                        }
                        circles = parent.querySelectorAll('.kpk-vertex');
                    }
                    // Actualizar posicion de los vertices
                    pts.forEach((pt, i) => {
                        let c = circles[i];
                        if (!c || !pt || pt.length < 2) return;
                        let cam = getCam(pt[0], pt[1]);
                        if (cam && cam.z > 0.0001) {
                            c.setAttribute("cx", String(cx + (cam.x / cam.z) * f));
                            c.setAttribute("cy", String(cy_screen - (cam.y / cam.z) * f));
                            c.style.display = 'block';
                            if (i === pts.length - 1) c.classList.add('kpk-vertex-active');
                            else c.classList.remove('kpk-vertex-active');
                        } else {
                            c.style.display = 'none';
                        }
                    });
                    
                    // Guia fantasma (dashed)
                    let guide = parent.querySelector('.kpk-guide-line');
                    if (!guide) {
                        guide = document.createElementNS("http://www.w3.org/2000/svg", "path");
                        guide.setAttribute("class", "kpk-guide-line");
                        parent.appendChild(guide);
                    }
                    let lastPt = pts[pts.length - 1];
                    if (lastPt && lastPt.length >= 2) {
                        let cLast = getCam(lastPt[0], lastPt[1]);
                        if (cLast && cLast.z > 0.0001 && window.lastMouseX !== undefined && !isClosed) {
                            let rect = container.getBoundingClientRect();
                            let mx = window.lastMouseX - rect.left;
                            let my = window.lastMouseY - rect.top;
                            let sx = cx + (cLast.x / cLast.z) * f;
                            let sy = cy_screen - (cLast.y / cLast.z) * f;
                            guide.setAttribute("d", `M ${sx},${sy} L ${mx},${my}`);
                            guide.style.display = 'block';
                        } else {
                            guide.style.display = 'none';
                        }
                    } else {
                        guide.style.display = 'none';
                    }
                } catch(e) { console.error('KPK SVG Render Error:', e); }
            }
        } else {
            // Cleanup si se guardó o canceló
            let parent = cacheObj.gNode || (cacheObj.base && cacheObj.base[0] ? cacheObj.base[0].parentNode : null);
            if (parent) {
                parent.querySelectorAll('.kpk-vertex, .kpk-guide-line').forEach(el => {
                    if (el && el.parentNode) el.remove();
                });
            }
        }
    });
    const guideEl = document.getElementById('arq2-guideline-svg');
    if (arq2Guideline && isArquitecto2Active && arq2LinePoints.length > 0 && svg) {
        const start = arq2Guideline.start;
        const end = [start[0] + arq2Guideline.dir[0] * 15, start[1] + arq2Guideline.dir[1] * 15];
        const sc1 = getCam(start[0], start[1]);
        const sc2 = getCam(end[0], end[1]);
        if (sc1 && sc2 && sc1.z > 0.0001 && sc2.z > 0.0001) {
            const sx1 = cx + (sc1.x / sc1.z) * f;
            const sy1 = cy_screen - (sc1.y / sc1.z) * f;
            const sx2 = cx + (sc2.x / sc2.z) * f;
            const sy2 = cy_screen - (sc2.y / sc2.z) * f;
            let gLine = document.getElementById('arq2-guideline-svg');
            if (!gLine) {
                gLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                gLine.id = 'arq2-guideline-svg';
                gLine.setAttribute('stroke', '#10b981');
                gLine.setAttribute('stroke-width', '2.5');
                gLine.setAttribute('stroke-dasharray', '6,6');
                gLine.setAttribute('pointer-events', 'none');
                svg.appendChild(gLine);
            }
            gLine.setAttribute('x1', String(sx1));
            gLine.setAttribute('y1', String(sy1));
            gLine.setAttribute('x2', String(sx2));
            gLine.setAttribute('y2', String(sy2));
            gLine.style.display = 'block';
        } else if (guideEl) {
            guideEl.style.display = 'none';
        }
    } else if (guideEl) {
        guideEl.style.display = 'none';
    }

    const layer2D = document.getElementById('fresia-2d-layer');
    if (layer2D && window.fresia2DVertices) {
        Array.from(layer2D.children).forEach(el => {
            const pitch = parseFloat(el.dataset.pitch);
            const yaw = parseFloat(el.dataset.yaw);
            if (isNaN(pitch) || isNaN(yaw)) return;
            const c = getCam(pitch, yaw);
            if (c.z > 0.0001) {
                const sx = cx + (c.x / c.z) * f;
                const sy = cy_screen - (c.y / c.z) * f;
                el.style.transform = `translate(calc(${sx}px - 50%), calc(${sy}px - 50%))`;
                el.style.display = '';
            } else {
                el.style.display = 'none';
            }
        });
    }

    arq2_updateDemoLayer();
}
