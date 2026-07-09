// ==========================================
// PREMIUM HUD - FASE 4
// ==========================================

window.showPremiumHUD = function(entityId, event) {
    if (window.isArquitecto2Active || window.isDevModeDrawActive) return;

    // Buscar en StateManager
    const entity = window.StateManager.entidades.find(e => e.id === entityId);
    if (!entity) return;

    // Solo mostrar HUD para lotes vendibles o pines comerciales
    if (!['lote-libre', 'area-invisible', 'lote-organico', 'franja-grupo'].includes(entity.tipo)) {
        return; 
    }

    // Calcular Área Real
    let areaHtml = '';
    if (window.GeometryEngine && window.arq2_calculateRealAreaM2) {
        let pts = entity.puntos || entity.borderPts || [];
        if (pts.length > 2) {
            const m2 = window.arq2_calculateRealAreaM2(pts);
            if (m2 > 0) {
                // Formatear: si es mayor a 10,000, mostrar Hectáreas
                if (m2 >= 10000) {
                    areaHtml = `<span>${(m2 / 10000).toFixed(2)} ha</span>`;
                } else {
                    areaHtml = `<span>${Math.round(m2).toLocaleString('es-CL')} m²</span>`;
                }
            }
        }
    }

    const status = entity.status || 'disponible';
    let statusColor = '#10b981'; // verde
    let statusText = 'Disponible';
    
    if (status === 'reservado') {
        statusColor = '#f59e0b';
        statusText = 'Reservado';
    } else if (status === 'vendido') {
        statusColor = '#ef4444';
        statusText = 'Vendido';
    }

    const nombre = entity.nombre || entity.numero || 'Lote sin nombre';
    const precio = entity.precio ? `$${Number(entity.precio).toLocaleString('es-CL')}` : 'Consultar precio';

    let hud = document.getElementById('premium-hud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'premium-hud';
        document.body.appendChild(hud);
    }

    hud.innerHTML = `
        <div class="hud-header">
            <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${nombre}</h3>
            <button class="hud-close" onclick="document.getElementById('premium-hud').style.display='none'">✖</button>
        </div>
        <div class="hud-status" style="color: ${statusColor}; border-color: ${statusColor};">
            <span class="pulse" style="background-color: ${statusColor};"></span> ${statusText}
        </div>
        
        <div class="hud-details">
            ${areaHtml ? `<div class="hud-row"><span class="hud-label">Superficie</span><span class="hud-val">${areaHtml}</span></div>` : ''}
            ${status !== 'vendido' ? `<div class="hud-row"><span class="hud-label">Valor Estimado</span><span class="hud-val" style="font-size:16px; font-weight:bold;">${precio}</span></div>` : ''}
        </div>

        ${status !== 'vendido' ? `
        <div class="hud-action">
            <button class="btn-contact">Solicitar Información</button>
        </div>
        ` : ''}
    `;

    hud.style.display = 'flex';
};

// Estilos Glassmorphism del HUD
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        #premium-hud {
            display: none;
            flex-direction: column;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 320px;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 16px;
            padding: 20px;
            color: #fff;
            z-index: 10000;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            animation: hudFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes hudFadeIn {
            from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }

        .hud-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .hud-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.5);
            font-size: 16px;
            cursor: pointer;
            transition: color 0.2s;
        }
        .hud-close:hover { color: #fff; }

        .hud-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 20px;
            border: 1px solid;
            background: rgba(0,0,0,0.2);
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 20px;
            align-self: flex-start;
        }

        .pulse {
            width: 8px; height: 8px;
            border-radius: 50%;
            box-shadow: 0 0 0 0 rgba(255,255,255,0.4);
            animation: pulsing 2s infinite;
        }

        @keyframes pulsing {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(255,255,255,0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255,255,255,0); }
        }

        .hud-details {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-bottom: 24px;
        }

        .hud-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .hud-label {
            color: #94a3b8;
            font-size: 13px;
        }

        .hud-val {
            color: #f8fafc;
            font-size: 14px;
            font-weight: 500;
        }

        .hud-action {
            margin-top: auto;
        }

        .btn-contact {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.1s;
        }

        .btn-contact:hover { opacity: 0.9; }
        .btn-contact:active { transform: scale(0.98); }
    `;
    document.head.appendChild(style);
})();

window.exportarInventarioCSV = function() {
    const lotes = window.StateManager.entidades.filter(e => ['lote-libre', 'area-invisible', 'lote-organico', 'franja-grupo'].includes(e.tipo));
    if (lotes.length === 0) return alert('No hay lotes para exportar.');
    let csv = 'ID,Nombre/Numero,Estado,Area(m2),Precio,Tipo\n';
    lotes.forEach(l => {
        let area = 0;
        if (window.GeometryEngine && window.arq2_calculateRealAreaM2) {
            let pts = l.puntos || l.borderPts || [];
            if (pts.length > 2) area = Math.round(window.arq2_calculateRealAreaM2(pts) || 0);
        }
        const nombre = (l.nombre || l.numero || 'Sin nombre').replace(/,/g, '');
        const estado = l.status || 'disponible';
        const precio = l.precio || 0;
        csv += `${l.id},${nombre},${estado},${area},${precio},${l.tipo}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'inventario_lotes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
