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
                    if (this.vertexMarkerGroup) {
                        const chk = document.getElementById('arq2-lote-libre-hide-streets');
                        this.vertexMarkerGroup.visible = chk ? !chk.checked : true;
                    }
                } else {
                    btn.style.background = '';
                    btn.style.color = '#ef4444';
                    document.body.style.cursor = '';
                    if (this.vertexMarkerGroup) this.vertexMarkerGroup.visible = false;
                    this.clearTemp();
                }
            });
        }
        
        const btnCalleCurva = document.getElementById('arq2-tool-calle-curva');
        if (btnCalleCurva) {
            btnCalleCurva.addEventListener('click', () => {
                if (this.isActive) {
                    this.currentTool = 'calle-curva';
                    this.clearTemp();
                    const row = document.getElementById('arq2-calle-curva-row');
                    if (row) row.style.display = 'flex';
                }
            });
        }
        
        // El botón Lote Libre debe ocultar el panel de Calle
        const btnLote = document.querySelector('.arq2-tool-btn[data-arq2-tool="lote-libre"]');
        if (btnLote) {
            btnLote.addEventListener('click', () => {
                if (this.isActive) {
                    this.currentTool = 'draw';
                    this.clearTemp();
                    const row = document.getElementById('arq2-calle-curva-row');
                    if (row) row.style.display = 'none';
                }
            });
        }

        // El botón Pin V2
        const btnPin = document.querySelector('.arq2-tool-btn[data-arq2-tool="smart-pin-v2"]');
        if (btnPin) {
            btnPin.addEventListener('click', () => {
                if (this.isActive) {
                    this.currentTool = 'smart-pin';
                    this.clearTemp();
                    const row = document.getElementById('arq2-calle-curva-row');
                    if (row) row.style.display = 'none';
                    // Abrir el sub-menú de pines de Arq 2.0 si existe
                    if (typeof window.abrirSubMenuPines === 'function') {
                        window.abrirSubMenuPines();
                    }
                }
            });
        }

        // Checkbox para ocultar nodos de arrastre
        const hideVerticesChk = document.getElementById('arq2-lote-libre-hide-streets');
        if (hideVerticesChk) {
            hideVerticesChk.addEventListener('change', (e) => {
                if (this.vertexMarkerGroup) {
                    this.vertexMarkerGroup.visible = !e.target.checked;
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

                    this.startHologramLoop();
                    this.bindEvents();
                    console.log("Motor Ferrari Inicializado correctamente.");
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

    startHologramLoop: function() {
        if (this.hologramLoopActive) return;
        this.hologramLoopActive = true;
        const hologui = document.getElementById('holographic-ui-engine');
        
        const loop = () => {
            if (this.isActive && window.visor360 && hologui) {
                const camera = window.visor360.getThreeCamera();
                if (camera) {
                    const pins = hologui.querySelectorAll('[data-pitch][data-yaw]');
                    pins.forEach(pin => {
                        const pitch = parseFloat(pin.getAttribute('data-pitch'));
                        const yaw = parseFloat(pin.getAttribute('data-yaw'));
                        if (!isNaN(pitch) && !isNaN(yaw)) {
                            // Proyectar desde el motor 3D en lugar del motor 2D de Pannellum
                            const pos3D = window.visor360.getVectorFromPitchYaw(pitch, yaw);
                            pos3D.project(camera);
                            
                            if (pos3D.z > 1) { // Detrás de cámara
                                pin.style.display = 'none';
                            } else {
                                pin.style.display = '';
                                const x = (pos3D.x * .5 + .5) * window.innerWidth;
                                const y = (pos3D.y * -.5 + .5) * window.innerHeight;
                                pin.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
                            }
                        }
                    });
                }
            }
            requestAnimationFrame(loop);
        };
        loop();
    },

    bindEvents: function() {
        const container = document.getElementById('panorama-container');
        let startX, startY, startTime;

        container.addEventListener('pointerdown', (e) => {
            if (!this.isActive) return;
            
            // Si estamos en modo Pin V2, insertar pin
            if (this.currentTool === 'smart-pin') {
                e.stopPropagation(); // Prevenir panning
                this.raycaster.setFromCamera(this.mouse, window.visor360.getThreeCamera());
                const groundIntersection = this.raycaster.intersectObject(this.holographicSphere)[0];
                if (groundIntersection) {
                    const pt = groundIntersection.point;
                    const pitch = Math.asin(pt.y / pt.length()) * 180 / Math.PI;
                    const yaw = Math.atan2(pt.x, pt.z) * 180 / Math.PI;
                    
                    let tipoFinal = window.arq2PinSubTool || 'lote';
                    let tituloFinal = 'Lote 00';
                    
                    if (tipoFinal === 'horizonte') tituloFinal = prompt('📍 PIN HORIZONTE\nTítulo (ej: Volcán Osorno):');
                    else if (tipoFinal === 'ruta') tituloFinal = prompt('🚗 PIN RUTA\nTítulo (ej: Ruta V-30):');
                    else if (tipoFinal === 'vista360') tituloFinal = 'VISTA 360';
                    else if (tipoFinal === 'casa360') tituloFinal = 'CASA TOUR';
                    
                    if (tipoFinal !== 'lote' && tituloFinal === null) return; // Cancelado

                    let nuevoPin = {
                        pitch: parseFloat(pitch.toFixed(3)),
                        yaw: parseFloat(yaw.toFixed(3)),
                        id: 'draft_' + Date.now(),
                        numero: '',
                        tipo: tipoFinal,
                        status: 'disponible',
                        titulo: tituloFinal
                    };

                    if (typeof openPinEditor === 'function') {
                        openPinEditor(nuevoPin, true); // Modal nativo de Arq 2.0
                    }
                }
                return;
            }

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
                if (v3) this.updateVertexPosition(this.draggingInfo, v3, e);
                return;
            }

            // Previsualizar la línea al dibujar
            this.updatePreview(e);
        }, { capture: true });

        // Doble clic o clic derecho cierra el lote
        container.addEventListener('dblclick', (e) => {
            if (!this.isActive) return;
            e.stopPropagation();
            if (this.currentTool === 'calle-curva') {
                this.finishStreet();
            } else {
                this.finishPolygon();
            }
        }, { capture: true });
        
        container.addEventListener('contextmenu', (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            if (this.currentTool === 'calle-curva') {
                this.finishStreet();
            } else {
                this.finishPolygon();
            }
        });
    },

    getSnapToAnyVertex: function(screenX, screenY, skipLoteId = null, skipIndex = -1, threshold = 25) {
        if (!window.visor360) return null;
        const camera = window.visor360.getThreeCamera();
        const renderer = window.visor360.getThreeRenderer();
        const rect = renderer.domElement.getBoundingClientRect();
        
        let closestPt = null;
        let minDist = threshold;
        
        const checkPoints = (pts, isTemp) => {
            pts.forEach((pt3d, idx) => {
                if (!isTemp && skipLoteId && skipLoteId === this.lotes.find(l=>l.points === pts)?.id && skipIndex === idx) return;
                const pt = pt3d.clone();
                pt.project(camera);
                if (pt.z > 1) return;
                
                const sx = (pt.x * 0.5 + 0.5) * rect.width;
                const sy = (1 - (pt.y * 0.5 + 0.5)) * rect.height;
                const dist = Math.hypot(sx - screenX, sy - screenY);
                if (dist < minDist) {
                    minDist = dist;
                    closestPt = pt3d.clone();
                }
            });
        };
        
        this.lotes.forEach(lote => checkPoints(lote.points, false));
        if (this.tempPoints.length > 0) checkPoints(this.tempPoints, true);
        
        return closestPt;
    },

    addPoint: function(e) {
        // Lógica del "Imán" (Magnet) para cerrar el polígono
        const renderer = window.visor360.getThreeRenderer();
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ( (e.clientX - rect.left) / rect.width ) * 2 - 1;
        mouse.y = - ( (e.clientY - rect.top) / rect.height ) * 2 + 1;
        
        // Intentar imán global primero
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const snapped = this.getSnapToAnyVertex(screenX, screenY);
        
        if (snapped && this.tempPoints.length >= 3) {
            // Si el snap es con el primer punto del mismo polígono temporal, cerrar el lote
            const firstPt = this.tempPoints[0];
            if (snapped.distanceTo(firstPt) < 0.01) {
                this.finishPolygon();
                return;
            }
        }

        const v3 = snapped || this.getVectorFromEvent(e);
        if (!v3) return;
        
        this.tempPoints.push(v3);
        
        // Agregar esfera visual temporal
        const markerGeo = new THREE.SphereGeometry(3, 16, 16); 
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        
        // Efecto Neon temporal
        const glowGeoTemp = new THREE.SphereGeometry(5, 16, 16);
        const glowMatTemp = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false });
        const glowTemp = new THREE.Mesh(glowGeoTemp, glowMatTemp);
        marker.add(glowTemp);
        
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

        if (this.currentTool === 'calle-curva' && renderPts.length >= 2) {
            this.renderTempStreet(renderPts);
            return;
        }

        const geo = new THREE.BufferGeometry().setFromPoints(renderPts);
        const mat = new THREE.LineBasicMaterial({ 
            color: 0x10b981, // Verde
            linewidth: 4, 
            depthTest: false, 
            transparent: true, 
            opacity: 0.9 
        });
        
        this.tempLineMesh = new THREE.Line(geo, mat);
        this.group.add(this.tempLineMesh);
    },

    renderTempStreet: function(renderPts) {
        if (!window.arq2_buildCalleCurvaGeometry) return;
        
        const pyEje = renderPts.map(p => {
            const yaw = Math.atan2(p.x, p.z) * 180 / Math.PI;
            const pitch = Math.asin(p.y / p.length()) * 180 / Math.PI;
            return [pitch, yaw];
        });

        const geoData = window.arq2_buildCalleCurvaGeometry(
            pyEje, 
            window.arq2CalleCurvaAncho || 8, 
            window.draftCalleCurvaAlpha ?? 0.7, 
            window.arq2CalleRetorno || false
        );
        
        if (!geoData || !geoData.fillPoly) return;

        const streetPts = geoData.fillPoly.map(py => window.visor360.getVectorFromPitchYaw(py[0], py[1]));
        
        const geo = new THREE.BufferGeometry().setFromPoints(streetPts);
        const mat = new THREE.LineBasicMaterial({ 
            color: 0x94a3b8, // Gris calle
            linewidth: 3, 
            depthTest: false, 
            transparent: true, 
            opacity: 0.9 
        });
        
        this.tempLineMesh = new THREE.Line(geo, mat);
        this.group.add(this.tempLineMesh);

        // Relleno temporal
        if (!this.tempFillMesh) {
            const fillGeo = new THREE.BufferGeometry();
            const fillMat = new THREE.MeshBasicMaterial({
                color: 0x94a3b8,
                transparent: true,
                opacity: window.draftCalleCurvaAlpha ?? 0.7,
                side: THREE.DoubleSide,
                depthTest: false
            });
            this.tempFillMesh = new THREE.Mesh(fillGeo, fillMat);
            this.group.add(this.tempFillMesh);
        }
        
        const vertices = [];
        const vec2D = streetPts.map(p => new THREE.Vector2(Math.atan2(p.x, p.z), Math.asin(p.y / p.length())));
        const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
        faces.forEach(face => {
            const pA = streetPts[face[0]], pB = streetPts[face[1]], pC = streetPts[face[2]];
            vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
        });
        this.tempFillMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
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
            color: 0x10b981, // Verde original (Emerald #10b981)
            animStartTime: Date.now()
        };

        this.lotes.push(newLote);
        this.clearTemp();
        this.buildLoteMeshes(newLote);
        
        // Agregar los meshes a la escena
        this.group.add(newLote.lineMesh);
        // Generar etiquetas finales para cada vértice
        newLote.points.forEach((pt, i) => {
            this.createPermanentLabel(pt, i + 1, loteId);
        });
        
        window.updateCosturaEdges();
    },

    finishStreet: function() {
        if (this.tempPoints.length < 2) {
            this.clearTemp();
            return;
        }

        const loteId = 'CALLE_3D_' + Date.now();
        const finalEje = [...this.tempPoints];
        
        const newLote = {
            id: loteId,
            tipo: 'calle-curva',
            points: finalEje, // El eje actua como points para marcadores
            color: 0x94a3b8,
            animStartTime: Date.now()
        };

        this.lotes.push(newLote);
        this.clearTemp();
        this.buildLoteMeshes(newLote);
        
        this.group.add(newLote.lineMesh);
        this.group.add(newLote.fillMesh);
        newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
        
        newLote.points.forEach((pt, i) => {
            this.createPermanentLabel(pt, i + 1, loteId);
        });
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
        if (pts.length < 2) return;
        
        let vertices = [];
        let geo, mat;

        if (lote.tipo === 'calle-curva') {
            const pyEje = pts.map(p => [Math.asin(p.y / p.length()) * 180 / Math.PI, Math.atan2(p.x, p.z) * 180 / Math.PI]);
            const geoData = window.arq2_buildCalleCurvaGeometry(
                pyEje, 
                lote.ancho || window.arq2CalleCurvaAncho || 8, 
                lote.alpha ?? window.draftCalleCurvaAlpha ?? 0.7, 
                lote.retorno || window.arq2CalleRetorno || false
            );
            if (geoData && geoData.fillPoly) {
                const streetPts = geoData.fillPoly.map(py => window.visor360.getVectorFromPitchYaw(py[0], py[1]));
                geo = new THREE.BufferGeometry().setFromPoints(streetPts);
                mat = new THREE.LineBasicMaterial({ 
                    color: lote.color, 
                    linewidth: 3, 
                    depthTest: false,
                    transparent: true,
                    opacity: 0.8
                });
                const vec2D = streetPts.map(p => new THREE.Vector2(Math.atan2(p.x, p.z), Math.asin(p.y / p.length())));
                const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
                faces.forEach(face => {
                    const pA = streetPts[face[0]], pB = streetPts[face[1]], pC = streetPts[face[2]];
                    vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
                });
            }
        } else {
            pts.push(pts[0].clone()); // cerrar loop
            geo = new THREE.BufferGeometry().setFromPoints(pts);
            mat = new THREE.LineBasicMaterial({ 
                color: lote.color, 
                linewidth: 3, 
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });
            const cleanPts = pts.slice(0, -1);
            const vec2D = cleanPts.map(p => new THREE.Vector2(Math.atan2(p.x, p.z), Math.asin(p.y / p.length())));
            const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
            faces.forEach(face => {
                const pA = cleanPts[face[0]], pB = cleanPts[face[1]], pC = cleanPts[face[2]];
                vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
            });
        }

        if (!geo) return;

        lote.lineMesh = new THREE.Line(geo, mat);
        lote.lineMesh.userData = { loteId: lote.id };

        const fillGeo = new THREE.BufferGeometry();
        fillGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        const fillMat = new THREE.MeshBasicMaterial({
            color: lote.color,
            transparent: true,
            opacity: lote.tipo === 'calle-curva' ? (lote.alpha ?? 0.7) : 0.22,
            blending: lote.tipo === 'calle-curva' ? THREE.NormalBlending : THREE.AdditiveBlending, // Transparencia macOS premium
            side: THREE.DoubleSide,
            depthTest: false
        });
        lote.fillMesh = new THREE.Mesh(fillGeo, fillMat);
        lote.fillMesh.userData = { loteId: lote.id };
        
        // Nodos (Vértices) arrastrables con Neón Blanco Premium
        lote.markerMeshes = [];
        const markerGeo = new THREE.SphereGeometry(3.5, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            depthTest: false 
        });
        const glowGeo = new THREE.SphereGeometry(6.5, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.4, 
            blending: THREE.AdditiveBlending,
            depthTest: false 
        });
        
        lote.points.forEach((p, index) => {
            const m = new THREE.Mesh(markerGeo, markerMat);
            const mGlow = new THREE.Mesh(glowGeo, glowMat);
            m.add(mGlow); // Anidar el brillo neón al marcador principal
            m.position.copy(p);
            m.userData = { loteId: lote.id, index: index };
            lote.markerMeshes.push(m);
        });
    },

    updateCosturaEdges: function() {
        if (!this.sharedEdgesGroup) {
            this.sharedEdgesGroup = new THREE.Group();
            window.visor360.getThreeScene().add(this.sharedEdgesGroup);
        }
        
        while(this.sharedEdgesGroup.children.length > 0) {
            const child = this.sharedEdgesGroup.children[0];
            if(child.geometry) child.geometry.dispose();
            if(child.material) child.material.dispose();
            this.sharedEdgesGroup.remove(child);
        }
        
        const allSegments = [];
        this.lotes.forEach(lote => {
            const pts = lote.points;
            if(pts.length < 3) return;
            for (let i = 0; i < pts.length; i++) {
                let p1 = pts[i];
                let p2 = pts[(i+1) % pts.length];
                allSegments.push({ lId: lote.id, p1, p2 });
            }
        });
        
        const shared = [];
        for(let i = 0; i < allSegments.length; i++) {
            for(let j = i + 1; j < allSegments.length; j++) {
                const s1 = allSegments[i];
                const s2 = allSegments[j];
                if (s1.lId === s2.lId) continue;
                
                const d1 = s1.p1.distanceTo(s2.p1) < 5 && s1.p2.distanceTo(s2.p2) < 5;
                const d2 = s1.p1.distanceTo(s2.p2) < 5 && s1.p2.distanceTo(s2.p1) < 5;
                
                if (d1 || d2) {
                    shared.push(s1);
                }
            }
        }
        
        shared.forEach(s => {
            const bgGeo = new THREE.BufferGeometry().setFromPoints([s.p1, s.p2]);
            const bgMat = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 3, transparent: true, opacity: 0.6, depthTest: false });
            const bgLine = new THREE.Line(bgGeo, bgMat);
            this.sharedEdgesGroup.add(bgLine);

            const geo = new THREE.BufferGeometry().setFromPoints([s.p1, s.p2]);
            const mat = new THREE.LineDashedMaterial({
                color: 0xffffff,
                linewidth: 2,
                dashSize: 8,
                gapSize: 8,
                depthTest: false,
                transparent: true,
                opacity: 0.9
            });
            const line = new THREE.Line(geo, mat);
            line.computeLineDistances();
            this.sharedEdgesGroup.add(line);
        });
    },

    updateVertexPosition: function(info, rawV3, e) {
        const lote = this.lotes.find(l => l.id === info.loteId);
        if (!lote) return;
        
        let v3 = rawV3;
        // Snap al arrastrar vértices
        if (e && window.visor360) {
            const renderer = window.visor360.getThreeRenderer();
            const rect = renderer.domElement.getBoundingClientRect();
            const screenX = e.clientX - rect.left;
            const screenY = e.clientY - rect.top;
            const snapped = this.getSnapToAnyVertex(screenX, screenY, info.loteId, info.index);
            if (snapped) v3 = snapped;
        }

        lote.points[info.index].copy(v3);
        
        // === ACTUALIZACIÓN RÁPIDA DE BUFFERS (CERO LAG) ===
        const pts = [...lote.points];
        
        let vertices = [];
        if (lote.tipo === 'calle-curva') {
            const pyEje = pts.map(p => [Math.asin(p.y / p.length()) * 180 / Math.PI, Math.atan2(p.x, p.z) * 180 / Math.PI]);
            const geoData = window.arq2_buildCalleCurvaGeometry(
                pyEje, 
                lote.ancho || window.arq2CalleCurvaAncho || 8, 
                lote.alpha ?? window.draftCalleCurvaAlpha ?? 0.7, 
                lote.retorno || window.arq2CalleRetorno || false
            );
            if (geoData && geoData.fillPoly) {
                const streetPts = geoData.fillPoly.map(py => window.visor360.getVectorFromPitchYaw(py[0], py[1]));
                lote.lineMesh.geometry.setFromPoints(streetPts);
                const vec2D = streetPts.map(p => new THREE.Vector2(Math.atan2(p.x, p.z), Math.asin(p.y / p.length())));
                const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
                faces.forEach(face => {
                    const pA = streetPts[face[0]], pB = streetPts[face[1]], pC = streetPts[face[2]];
                    vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
                });
            }
        } else {
            pts.push(pts[0].clone()); // cerrar loop
            lote.lineMesh.geometry.setFromPoints(pts);
            
            // Actualizar relleno con triangulación correcta para cóncavos
            const cleanPts = lote.points.slice(0, -1);
            const vec2D = cleanPts.map(p => new THREE.Vector2(Math.atan2(p.x, p.z), Math.asin(p.y / p.length())));
            const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
            faces.forEach(face => {
                const pA = cleanPts[face[0]];
                const pB = cleanPts[face[1]];
                const pC = cleanPts[face[2]];
                vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
            });
        }
        
        lote.fillMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        lote.fillMesh.geometry.attributes.position.needsUpdate = true;
        
        // Actualizar el mesh de la esfera (nodo) que estamos moviendo
        lote.markerMeshes[info.index].position.copy(v3);
        
        this.updateCosturaEdges();
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
