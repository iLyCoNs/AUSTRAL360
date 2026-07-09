// ==========================================
// NODE EDITOR - FASE 3
// ==========================================
window.NodeEditor = {
    activeEntityId: null,
    hotspots: [],
    isDragging: false,
    dragIndex: -1,

    startEditing(entityId) {
        if (this.activeEntityId) this.stopEditing();
        
        // Buscar en StateManager
        const entity = window.StateManager.entidades.find(e => e.id === entityId);
        if (!entity) return;

        this.activeEntityId = entityId;
        window.arq2Tool = 'node-editor'; 
        
        let basePoints = [];
        if (entity.tipo === 'calle-curva-arq2') {
            basePoints = entity.ejeOriginal;
        } else {
            basePoints = entity.puntos; 
        }

        this.renderHotspots(basePoints);
        this.showEditorUI();
    },

    renderHotspots(points) {
        this.clearHotspots();
        points.forEach((pt, i) => {
            const hsId = 'node_edit_' + i;
            this.hotspots.push(hsId);
            window.visor360.addHotSpot({
                id: hsId,
                pitch: pt[0],
                yaw: pt[1],
                type: 'info',
                cssClass: 'node-edit-marker',
                createTooltipFunc: (el) => {
                    el.dataset.index = i;
                    el.addEventListener('pointerdown', (e) => this.onNodeDown(e, i));
                }
            });
        });
    },

    clearHotspots() {
        this.hotspots.forEach(id => {
            try { window.visor360.removeHotSpot(id); } catch(e){}
        });
        this.hotspots = [];
    },

    onNodeDown(e, index) {
        e.stopPropagation();
        this.isDragging = true;
        this.dragIndex = index;
        
        // Bloquear movimiento de cámara de Pannellum
        window.visor360.setPitchBounds([window.visor360.getPitch(), window.visor360.getPitch()]);
        window.visor360.setYawBounds([window.visor360.getYaw(), window.visor360.getYaw()]);
        
        const moveHandler = (ev) => this.onNodeMove(ev);
        const upHandler = (ev) => {
            this.isDragging = false;
            window.visor360.setPitchBounds([-90, 90]);
            window.visor360.setYawBounds([-180, 180]);
            document.removeEventListener('pointermove', moveHandler);
            document.removeEventListener('pointerup', upHandler);
            window.saveToLocal();
        };
        
        document.addEventListener('pointermove', moveHandler);
        document.addEventListener('pointerup', upHandler);
    },

    onNodeMove(e) {
        if (!this.isDragging || this.dragIndex === -1) return;
        const coords = window.visor360.mouseEventToCoords(e);
        if (!coords) return;
        
        const entity = window.StateManager.entidades.find(e => e.id === this.activeEntityId);
        if (!entity) return;

        let ptArray = (entity.tipo === 'calle-curva-arq2') ? entity.ejeOriginal : entity.puntos;
        ptArray[this.dragIndex] = [coords[0], coords[1]];

        // Regenerar la geometría derivada (Offset de calle, suavizado, etc.)
        if (entity.tipo === 'calle-curva-arq2' && window.arq2_buildCalleCurvaGeometry) {
            const geo = window.arq2_buildCalleCurvaGeometry(entity.ejeOriginal, entity.ancho, entity.calleCurvaAlpha, entity.calleRetorno);
            if (geo) Object.assign(entity, geo);
        }

        // Actualizar hotspot pos
        const hsId = 'node_edit_' + this.dragIndex;
        try {
            window.visor360.removeHotSpot(hsId);
            window.visor360.addHotSpot({
                id: hsId, pitch: coords[0], yaw: coords[1], type: 'info', cssClass: 'node-edit-marker',
                createTooltipFunc: (el) => {
                    el.dataset.index = this.dragIndex;
                    el.addEventListener('pointerdown', (ev) => this.onNodeDown(ev, this.dragIndex));
                }
            });
        } catch(err){}

        // Propagar cambios visuales (SVG / ThreeJS)
        window.StateManager.applySnapshot(window.StateManager.buildSnapshot());
    },

    stopEditing() {
        this.clearHotspots();
        this.activeEntityId = null;
        window.arq2Tool = 'lote-libre'; 
        this.hideEditorUI();
    },

    showEditorUI() {
        let ui = document.getElementById('node-editor-ui');
        if (!ui) {
            ui = document.createElement('div');
            ui.id = 'node-editor-ui';
            ui.className = 'node-editor-panel';
            ui.innerHTML = `
                <div style="font-weight:bold; margin-bottom:10px;">Modo Edición de Nodos</div>
                <div style="font-size:11px; margin-bottom:10px;">Arrastra los puntos blancos en la imagen para deformar la figura en tiempo real.</div>
                <button class="btn-save" onclick="window.NodeEditor.stopEditing()">Terminar Edición</button>
            `;
            document.body.appendChild(ui);
        }
        ui.style.display = 'block';
    },

    hideEditorUI() {
        const ui = document.getElementById('node-editor-ui');
        if (ui) ui.style.display = 'none';
    }
};

// Estilos dinámicos para los markers
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .node-edit-marker {
            width: 14px; height: 14px;
            background: white;
            border: 3px solid #3b82f6;
            border-radius: 50%;
            cursor: grab;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
            pointer-events: auto;
            z-index: 9999;
        }
        .node-edit-marker:active {
            cursor: grabbing;
            transform: translate(-50%, -50%) scale(1.2);
            background: #3b82f6;
            border-color: white;
        }
        .node-editor-panel {
            position: absolute;
            top: 80px; left: 50%;
            transform: translateX(-50%);
            background: rgba(15,23,42,0.9);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 10000;
            text-align: center;
            border: 1px solid #3b82f6;
            backdrop-filter: blur(5px);
        }
        /* CLASES PARA EL LAYER MANAGER */
        body.hide-layer-calles g[data-tipo="calle-curva-arq2"],
        body.hide-layer-calles g[data-tipo="calle"] {
            display: none !important;
        }
        body.hide-layer-lotes g[data-tipo="lote-libre"],
        body.hide-layer-lotes g[data-tipo="area-invisible"],
        body.hide-layer-lotes g.lote-organico {
            display: none !important;
        }
        body.hide-layer-pines .pnlm-hotspot-base {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
})();
