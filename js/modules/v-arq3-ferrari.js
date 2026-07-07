// js/modules/v-arq3-ferrari.js
// Motor de dibujo 100% nativo Three.js (Arquitecto 3.0)

window.arquitecto3D = {
    lotes: [], // array de { id, color, points, lineMesh, fillMesh, markerMeshes }
    isActive: false,
    currentTool: 'draw',
    tempPoints: [],
    tempLabels: [], // Elementos HTML de Vértice 1, 2...
    draggingInfo: null, // { loteId, index }
    
    // Objetos Three.js
    group: null,
    vertexMarkerGroup: null, // Para los nodos finales
    tempMarkerGroup: null,   // Para los nodos temporales al dibujar
    tempLineMesh: null,

    init: function() {
        console.log("Inicializando Arquitecto 3.0 (Motor Ferrari)...");
        const btn = document.getElementById('btn-arq3-mode');
        if (btn) {
            btn.addEventListener('click', () => {
                this.isActive = !this.isActive;
                btn.classList.toggle('active', this.isActive);
                if (this.isActive) {
                    btn.style.background = '#ef4444';
                    btn.style.color = '#fff';
                    // Desactivar herramientas viejas
                    if (typeof window.isArquitecto2Active !== 'undefined') window.isArquitecto2Active = false;
                    if (typeof window.isDevModeDrawActive !== 'undefined') window.isDevModeDrawActive = false;
                    document.body.style.cursor = 'crosshair';
                } else {
                    btn.style.background = '';
                    btn.style.color = '#ef4444';
                    document.body.style.cursor = '';
                    this.clearTemp();
                }
            });
        }
        
        // Inyectar grupos al encontrar el Motor Ferrari activo
        const checkFerrari = setInterval(() => {
            if (window.visor360 && window.visor360.getThreeScene) {
                const scene = window.visor360.getThreeScene();
                if (scene) {
                    this.group = new THREE.Group();
                    scene.add(this.group);
                    
                    this.vertexMarkerGroup = new THREE.Group();
                    scene.add(this.vertexMarkerGroup);

                    this.tempMarkerGroup = new THREE.Group();
                    scene.add(this.tempMarkerGroup);
                    
                    // Conectar botones de la barra de herramientas
                    document.querySelectorAll('.arq2-tool-btn').forEach(b => {
                        b.addEventListener('click', (ev) => {
                            if (!this.isActive) return;
                            const tool = b.getAttribute('data-arq2-tool');
                            if (tool === 'eraser') this.currentTool = 'eraser';
                            else if (tool === 'lote-libre') this.currentTool = 'draw';
                            
                            document.querySelectorAll('.arq2-tool-btn').forEach(btn => btn.classList.remove('active'));
                            b.classList.add('active');
                            this.clearTemp();
                        });
                    });

                    this.bindEvents();
                    clearInterval(checkFerrari);
                    console.log("Arquitecto 3.0 enlazado al Motor Ferrari.");
                }
            }
        }, 500);
    },

    getVectorFromEvent: function(e) {
        if (!window.visor360 || !window.visor360.getThreeRenderer) return null;
        const renderer = window.visor360.getThreeRenderer();
        const camera = window.visor360.getThreeCamera();
        const mesh = window.visor360.getThreeMesh();
        if (!renderer || !camera || !mesh) return null;

        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
        mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObject(mesh);
        if (intersects.length > 0) {
            return intersects[0].point;
        }
        return null;
    },

    getIntersectedVertex: function(e) {
        if (!window.visor360 || !window.visor360.getThreeRenderer || this.vertexMarkerGroup.children.length === 0) return null;
        const renderer = window.visor360.getThreeRenderer();
        const camera = window.visor360.getThreeCamera();
        
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
        mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        // Aumentamos el umbral para que sea más fácil agarrar el vértice
        raycaster.params.Points.threshold = 5; 
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(this.vertexMarkerGroup.children);
        if (intersects.length > 0) {
            return intersects[0].object.userData; // { loteId, index }
        }
        return null;
    },

    getIntersectedLote: function(e) {
        if (!window.visor360 || !window.visor360.getThreeRenderer || this.group.children.length === 0) return null;
        const renderer = window.visor360.getThreeRenderer();
        const camera = window.visor360.getThreeCamera();
        
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
        mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 10;
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(this.group.children);
        if (intersects.length > 0 && intersects[0].object.userData.loteId) {
            return intersects[0].object.userData; // { loteId }
        }
        return null;
    },

    bindEvents: function() {
        const container = document.getElementById('panorama-container');
        let startX, startY, startTime;

        container.addEventListener('pointerdown', (e) => {
            if (!this.isActive) return;
            
            // Si estamos en modo goma
            if (this.currentTool === 'eraser') {
                const loteInfo = this.getIntersectedLote(e);
                if (loteInfo) {
                    const idx = this.lotes.findIndex(l => l.id === loteInfo.loteId);
                    if (idx > -1) {
                        const lote = this.lotes[idx];
                        if(lote.lineMesh) { lote.lineMesh.geometry.dispose(); lote.lineMesh.material.dispose(); this.group.remove(lote.lineMesh); }
                        if(lote.fillMesh) { lote.fillMesh.geometry.dispose(); lote.fillMesh.material.dispose(); this.group.remove(lote.fillMesh); }
                        if(lote.markerMeshes) {
                            lote.markerMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); this.vertexMarkerGroup.remove(m); });
                        }
                        this.lotes.splice(idx, 1);
                    }
                }
                return;
            }

            // 1. Intentar agarrar un vértice para edición
            const vertexInfo = this.getIntersectedVertex(e);
            if (vertexInfo) {
                this.draggingInfo = vertexInfo;
                e.stopPropagation(); // Bloquea el arrastre de cámara de v-panorama
                document.body.style.cursor = 'grabbing';
                return;
            }

            // 2. Si no agarramos nada, preparamos un posible click para dibujar
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();
        }, { capture: true });

        container.addEventListener('pointerup', (e) => {
            if (!this.isActive) return;
            
            // Soltar vértice si estábamos arrastrando
            if (this.draggingInfo) {
                this.draggingInfo = null;
                document.body.style.cursor = 'crosshair';
                return;
            }

            const dt = Date.now() - startTime;
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            
            if (dt < 400 && dist < 10) {
                // Es un click rápido para añadir punto
                this.addPoint(e);
            }
        });
        
        container.addEventListener('pointermove', (e) => {
            if (!this.isActive) return;

            if (this.draggingInfo) {
                e.stopPropagation(); // Evitar arrastre de cámara
                const v3 = this.getVectorFromEvent(e);
                if (v3) this.updateVertexPosition(this.draggingInfo, v3);
                return;
            }

            // Previsualizar la línea al dibujar
            this.updatePreview(e);
        }, { capture: true });

        // Doble clic o clic derecho cierra el lote
        container.addEventListener('dblclick', (e) => {
            if (!this.isActive) return;
            e.stopPropagation();
            this.finishPolygon();
        }, { capture: true });
        
        container.addEventListener('contextmenu', (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            this.finishPolygon();
        });
    },

    addPoint: function(e) {
        // Lógica del "Imán" (Magnet) para cerrar el polígono
        const renderer = window.visor360.getThreeRenderer();
        const rect = renderer.domElement.getBoundingClientRect();
        if (this.tempPoints.length >= 3) {
            const mouse = new THREE.Vector2();
            mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
            mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
            
            const pt = this.tempPoints[0].clone();
            pt.project(window.visor360.getThreeCamera());
            
            const dx = (pt.x - mouse.x) * rect.width/2;
            const dy = (pt.y - mouse.y) * rect.height/2;
            
            // Si está cerca del origen (imán)
            if (Math.hypot(dx, dy) < 30) {
                this.finishPolygon();
                return;
            }
        }

        const v3 = this.getVectorFromEvent(e);
        if (!v3) return;
        
        this.tempPoints.push(v3);
        
        // Agregar esfera visual temporal
        const markerGeo = new THREE.SphereGeometry(3, 16, 16); 
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(v3);
        this.tempMarkerGroup.add(marker);
        
        // Añadir etiqueta de Vértice HTML
        const label = document.createElement('div');
        label.className = 'arq3-vertex-label';
        label.style.position = 'absolute';
        label.style.color = '#fff';
        label.style.background = 'rgba(0,0,0,0.5)';
        label.style.padding = '2px 6px';
        label.style.borderRadius = '4px';
        label.style.fontSize = '12px';
        label.style.pointerEvents = 'none';
        label.style.zIndex = '1000';
        label.style.fontWeight = 'bold';
        label.textContent = 'Vértice ' + this.tempPoints.length;
        document.getElementById('panorama-container').appendChild(label);
        this.tempLabels.push(label);

        this.renderTemp();
    },

    updatePreview: function(e) {
        if (this.tempPoints.length === 0) return;
        const v3 = this.getVectorFromEvent(e);
        if (!v3) return;
        this.renderTemp(v3);
    },

    renderTemp: function(ghostPoint = null) {
        if (this.tempLineMesh) {
            this.group.remove(this.tempLineMesh);
            this.tempLineMesh.geometry.dispose();
            this.tempLineMesh.material.dispose();
            this.tempLineMesh = null;
        }

        if (this.tempPoints.length === 0) return;

        const renderPts = [...this.tempPoints];
        if (ghostPoint) renderPts.push(ghostPoint);

        const geo = new THREE.BufferGeometry().setFromPoints(renderPts);
        const mat = new THREE.LineBasicMaterial({ 
            color: 0x22c55e, // Verde
            linewidth: 4, 
            depthTest: false, 
            transparent: true, 
            opacity: 0.9 
        });
        
        this.tempLineMesh = new THREE.Line(geo, mat);
        this.group.add(this.tempLineMesh);
    },

    finishPolygon: function() {
        if (this.tempPoints.length < 3) {
            this.clearTemp();
            return;
        }

        const loteId = 'LOTE_3D_' + Date.now();
        const finalPts = [...this.tempPoints];
        
        const newLote = {
            id: loteId,
            points: finalPts,
            color: 0x22c55e, // Verde
            animStartTime: Date.now() // Iniciar flash de animación
        };

        this.lotes.push(newLote);
        this.clearTemp();
        this.buildLoteMeshes(newLote);
        
        // Agregar los meshes a la escena
        this.group.add(newLote.lineMesh);
        this.group.add(newLote.fillMesh);
        newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
    },

    clearTemp: function() {
        this.tempPoints = [];
        // Limpiar el grupo de marcadores (esferas temporales)
        while(this.tempMarkerGroup.children.length > 0) { 
            const child = this.tempMarkerGroup.children[0];
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
            this.tempMarkerGroup.remove(child); 
        }
        
        if (this.tempLineMesh) {
            this.group.remove(this.tempLineMesh);
            this.tempLineMesh.geometry.dispose();
            this.tempLineMesh.material.dispose();
        }
        this.tempLineMesh = null;
        
        // Limpiar etiquetas de vértices
        if (this.tempLabels) {
            this.tempLabels.forEach(lbl => {
                if(lbl && lbl.parentNode) lbl.parentNode.removeChild(lbl);
            });
            this.tempLabels = [];
        }
    },

    buildLoteMeshes: function(lote) {
        const pts = [...lote.points];
        pts.push(pts[0].clone()); // cerrar loop

        // Línea
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ 
            color: lote.color, 
            linewidth: 3, 
            depthTest: false,
            transparent: true,
            opacity: 0.8
        });
        lote.lineMesh = new THREE.Line(geo, mat);
        lote.lineMesh.userData = { loteId: lote.id };

        // Relleno
        const vertices = [];
        const origin = pts[0];
        for (let i = 1; i < pts.length - 2; i++) {
            vertices.push(origin.x, origin.y, origin.z);
            vertices.push(pts[i].x, pts[i].y, pts[i].z);
            vertices.push(pts[i+1].x, pts[i+1].y, pts[i+1].z);
        }
        const fillGeo = new THREE.BufferGeometry();
        fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const fillMat = new THREE.MeshBasicMaterial({
            color: lote.color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            depthTest: false
        });
        lote.fillMesh = new THREE.Mesh(fillGeo, fillMat);
        lote.fillMesh.userData = { loteId: lote.id };
        
        // Nodos (Vértices) arrastrables
        lote.markerMeshes = [];
        const markerGeo = new THREE.SphereGeometry(4, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.8,
            depthTest: false 
        });
        
        lote.points.forEach((p, index) => {
            const m = new THREE.Mesh(markerGeo, markerMat);
            m.position.copy(p);
            m.userData = { loteId: lote.id, index: index };
            lote.markerMeshes.push(m);
        });
    },

    updateVertexPosition: function(info, v3) {
        const lote = this.lotes.find(l => l.id === info.loteId);
        if (!lote) return;
        
        // Actualizar el vector en memoria
        lote.points[info.index].copy(v3);
        
        // === ACTUALIZACIÓN RÁPIDA DE BUFFERS (CERO LAG) ===
        const pts = [...lote.points];
        pts.push(pts[0].clone());
        
        // Actualizar línea
        lote.lineMesh.geometry.setFromPoints(pts);
        
        // Actualizar relleno (triangulación fan-shape)
        const vertices = [];
        const origin = pts[0];
        for (let i = 1; i < pts.length - 2; i++) {
            vertices.push(origin.x, origin.y, origin.z);
            vertices.push(pts[i].x, pts[i].y, pts[i].z);
            vertices.push(pts[i+1].x, pts[i+1].y, pts[i+1].z);
        }
        lote.fillMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        lote.fillMesh.geometry.attributes.position.needsUpdate = true;
        
        // Actualizar el mesh de la esfera (nodo) que estamos moviendo
        lote.markerMeshes[info.index].position.copy(v3);
    },

    animate: function() {
        if (!this.isActive || this.lotes.length === 0) return;
        const now = Date.now();
        
        this.lotes.forEach(lote => {
            if (lote.animStartTime) {
                const elapsed = now - lote.animStartTime;
                
                if (elapsed < 1000) {
                    const progress = elapsed / 1000;
                    
                    // Flash inicial: Blanco brillante (primeros 200ms)
                    if (progress < 0.2) {
                        if (lote.lineMesh) lote.lineMesh.material.color.setHex(0xffffff);
                        if (lote.fillMesh) {
                            lote.fillMesh.material.color.setHex(0xffffff);
                            lote.fillMesh.material.opacity = 0.6;
                        }
                    } else {
                        // Fade out progresivo hacia el verde base
                        const ease = (progress - 0.2) / 0.8; 
                        const baseColor = new THREE.Color(lote.color);
                        const whiteColor = new THREE.Color(0xffffff);
                        
                        if (lote.lineMesh) lote.lineMesh.material.color.copy(whiteColor).lerp(baseColor, ease);
                        if (lote.fillMesh) {
                            lote.fillMesh.material.color.copy(whiteColor).lerp(baseColor, ease);
                            lote.fillMesh.material.opacity = 0.6 - (0.3 * ease); // Pasa de 0.6 a 0.3
                        }
                    }
                } else {
                    // Finaliza la animación de forma segura
                    lote.animStartTime = null;
                    if (lote.lineMesh) lote.lineMesh.material.color.setHex(lote.color);
                    if (lote.fillMesh) {
                        lote.fillMesh.material.color.setHex(lote.color);
                        lote.fillMesh.material.opacity = 0.3;
                    }
                }
            }
        });
        
        // Actualizar posiciones de las etiquetas 2D de Vértices temporales
        if (this.tempPoints.length > 0 && this.tempLabels.length === this.tempPoints.length) {
            const camera = window.visor360.getThreeCamera();
            const renderer = window.visor360.getThreeRenderer();
            const rect = renderer.domElement.getBoundingClientRect();
            
            this.tempPoints.forEach((pt3d, idx) => {
                const pt = pt3d.clone();
                pt.project(camera);
                
                // Si está detrás de la cámara
                if (pt.z > 1) {
                    this.tempLabels[idx].style.display = 'none';
                    return;
                }
                
                const screenX = (pt.x * 0.5 + 0.5) * rect.width;
                const screenY = (1 - (pt.y * 0.5 + 0.5)) * rect.height;
                
                this.tempLabels[idx].style.display = 'block';
                this.tempLabels[idx].style.left = (screenX + 10) + 'px';
                this.tempLabels[idx].style.top = (screenY - 10) + 'px';
                
                // Destellar el primer vértice (Imán) si hay >= 3 puntos
                if (idx === 0 && this.tempPoints.length >= 3) {
                    this.tempLabels[idx].style.background = 'rgba(6, 182, 212, 0.8)'; // Cian
                    this.tempLabels[idx].style.boxShadow = '0 0 10px #06b6d4';
                } else {
                    this.tempLabels[idx].style.background = 'rgba(0,0,0,0.5)';
                    this.tempLabels[idx].style.boxShadow = 'none';
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.arquitecto3D.init();
});
