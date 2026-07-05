function arq2_getSmoothParams(intensity) {
    const n = intensity == null ? arq2SmoothIntensity : intensity;
    if (n <= 0) return { enabled: false, segmentsPerCurve: 8, angleThreshold: 180, label: 'Apagado' };
    if (n <= 3) return { enabled: true, segmentsPerCurve: 6, angleThreshold: 150, label: 'Sutil' };
    if (n <= 7) return { enabled: true, segmentsPerCurve: 10, angleThreshold: 165, label: 'Natural' };
    return { enabled: true, segmentsPerCurve: 18, angleThreshold: 175, label: 'Máximo' };
}
function arq2_estimatePolygonScreenAreaPx(pts) {
    const proj = getPanoramaScreenProjector();
    if (!proj || !pts || pts.length < 3) return Infinity;
    const sc = pts.map(p => proj.toScreen(p[0], p[1])).filter(Boolean);
    if (sc.length < 3) return Infinity;
    let area = 0;
    for (let i = 0; i < sc.length; i++) {
        const j = (i + 1) % sc.length;
        area += sc[i][0] * sc[j][1] - sc[j][0] * sc[i][1];
    }
    return Math.abs(area) / 2;
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
    arq2_setStatusText('Suavizado reprocesado (' + arq2_getSmoothParams(intensity).label + ') ✓');
}
function arq2_showSmallShapeSmoothHint(lineId) {
    let hint = document.getElementById('arq2-small-shape-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'arq2-small-shape-hint';
        hint.className = 'arq2-small-shape-hint';
        document.getElementById('arq2-panel')?.appendChild(hint);
    }
    hint.innerHTML = 'Forma pequeña detectada — considera subir la intensidad de suavizado para un trazo más fino. <button type="button" id="arq2-apply-max-smooth">Aplicar Máximo</button>';
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