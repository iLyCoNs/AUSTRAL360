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
                        this.vertexMarkerGroup.visible = true;
                        const chk = document.getElementById('arq2-lote-libre-hide-streets');
                        const hide = chk ? chk.checked : false;
                        this.lotes.forEach(lote => {
                            if (lote.tipo === 'calle-curva' && lote.markerMeshes) {
                                lote.markerMeshes.forEach(m => m.visible = !hide);
                            }
                        });
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
        
        // Delegación de eventos global para botones de herramientas dinámicos (como Calle Curva)
        document.addEventListener('click', (e) => {
            const b = e.target.closest('.arq2-tool-btn');
            if (!b || !this.isActive) return;
            
            const tool = b.getAttribute('data-arq2-tool');
            let toolHandled = false;
            
            if (tool === 'eraser') {
                this.currentTool = 'eraser';
                toolHandled = true;
            } 
            else if (tool === 'lote-libre') {
                this.currentTool = 'draw';
                const row = document.getElementById('arq2-calle-curva-row');
                if (row) row.style.display = 'none';
                toolHandled = true;
            }
            else if (tool === 'calle-curva-arq2') {
                this.currentTool = 'calle-curva';
                const row = document.getElementById('arq2-calle-curva-row');
                if (row) row.style.display = 'flex';
                toolHandled = true;
            }
            else if (tool === 'smart-pin-v2') {
                this.currentTool = 'smart-pin';
                const row = document.getElementById('arq2-calle-curva-row');
                if (row) row.style.display = 'none';
                if (typeof window.abrirSubMenuPines === 'function') window.abrirSubMenuPines();
                toolHandled = true;
            }

            if (toolHandled) {
                document.querySelectorAll('.arq2-tool-btn').forEach(btn => btn.classList.remove('active'));
                b.classList.add('active');
                this.clearTemp();
            }
        });


        // Checkbox para ocultar nodos de arrastre
        const hideVerticesChk = document.getElementById('arq2-lote-libre-hide-streets');
        if (hideVerticesChk) {
            hideVerticesChk.addEventListener('change', (e) => {
                const hide = e.target.checked;
                this.lotes.forEach(lote => {
                    if (lote.tipo === 'calle-curva' && lote.markerMeshes) {
                        lote.markerMeshes.forEach(m => m.visible = !hide);
                    }
                });
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
                    
                    // Eventos asíncronos ahora son manejados por delegación de eventos.

                    this.startHologramLoop();
                    this.importAllDrawnLines();
                    this.importPuntosHorizonte();
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
            const basePos = intersects[0].object.position;
            const dragged = [];
            this.vertexMarkerGroup.children.forEach(m => {
                if (m.userData && m.userData.loteId) {
                    if (m.position.distanceTo(basePos) < 0.1) {
                        dragged.push(m.userData);
                    }
                }
            });
            return dragged.length > 0 ? dragged : null; // Retorna array de vértices enlazados
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

        document.addEventListener('keydown', (e) => {
            if (!this.isActive) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                if (this.currentTool === 'calle-curva') {
                    this.finishStreet();
                } else {
                    this.finishPolygon();
                }
            }
        });

        const bindSlider3D = (id, propName, globalVarName, formatFn) => {
            const slider = document.getElementById(id);
            if (!slider) return;
            slider.addEventListener('input', () => {
                const val = parseFloat(slider.value);
                window[globalVarName] = val;
                const valLabel = document.getElementById(id + '-val');
                if (valLabel) valLabel.textContent = formatFn(val);
                
                if (this.isActive && this.currentTool === 'calle-curva' && this.tempPoints.length >= 2) {
                    this.renderTempStreet([...this.tempPoints]);
                }
                
                let updatedAny = false;
                this.lotes.forEach(lote => {
                    if (lote.tipo === 'calle-curva') {
                        if (propName === 'ancho') lote.ancho = val;
                        else if (propName === 'curvatura') lote.curvatura = val;
                        else if (propName === 'alpha') lote.alpha = val;
                        
                        if (lote.points && lote.points.length >= 2) {
                            this.updateVertexPosition({ loteId: lote.id, index: 0 }, lote.points[0], null, true);
                            updatedAny = true;
                        }
                    }
                });
                if (updatedAny) this.syncToAllDrawnLines();
            });
        };
        
        bindSlider3D('arq2-calle-ancho', 'ancho', 'arq2CalleCurvaAncho', v => v + 'm');
        bindSlider3D('arq2-calle-curvatura', 'curvatura', 'draftCalleCurvaCurvatura', v => v);
        bindSlider3D('arq2-calle-alpha', 'alpha', 'draftCalleCurvaAlpha', v => Math.round(v * 100) + '%');

        container.addEventListener('pointerdown', (e) => {
            if (this.currentTool === 'lote' || this.currentTool === 'calle-curva') {
                const pt = this.getVectorFromEvent(e);
                if (pt) {
                    if (this.tempPoints.length === 0 || this.tempPoints[this.tempPoints.length - 1].distanceTo(pt) > 0.1) {
                        this.tempPoints.push(pt.clone());
                        this.renderTempStreet(this.tempPoints);
                    }
                }
            }
            if (!this.isActive) return;
            
            // Si estamos en modo Pin V2, insertar pin
            if (this.currentTool === 'smart-pin') {
                e.stopPropagation(); // Prevenir panning
                
                // Actualizar this.mouse antes del raycast
                const rect = container.getBoundingClientRect();
                this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
                
                this.raycaster.setFromCamera(this.mouse, window.visor360.getThreeCamera());
                const groundIntersection = this.raycaster.intersectObject(window.visor360.getThreeMesh())[0];
                if (groundIntersection) {
                    const pt = groundIntersection.point;
                    const r = pt.length();
                    const pitch = -Math.asin(pt.y / r) * 180 / Math.PI;
                    const yaw = -Math.atan2(pt.x, -pt.z) * 180 / Math.PI;
                    let tipoFinal = window.arq2PinSubTool || 'lote';
                    
                    const nuevoPin = { 
                        pitch: parseFloat(pitch.toFixed(3)), 
                        yaw: parseFloat(yaw.toFixed(3)), 
                        id: 'nuevo_' + Date.now(),
                        numero: '00',
                        tipo: tipoFinal, 
                        titulo: (tipoFinal === 'vista360°' || tipoFinal === 'casa360°') ? 'Vista' : '00', 
                        status: 'disponible',
                        cssClass: 'hotspot-lote custom-hotspot' 
                    };

                    if (typeof window.openPinEditor === 'function') {
                        window.openPinEditor(nuevoPin, true);
                        const modalEl = document.getElementById('pin-editor-modal');
                        if (modalEl) {
                            const observer = new MutationObserver((mutations) => {
                                mutations.forEach(m => {
                                    if (m.attributeName === 'class' && !modalEl.classList.contains('open')) {
                                        observer.disconnect();
                                        if (nuevoPin.id) {
                                            if (tipoFinal === 'horizonte' || tipoFinal === 'ruta') {
                                                if (window.PuntosHorizonte) window.PuntosHorizonte.push(nuevoPin);
                                            } else {
                                                if (window.BaseDatosLotes) window.BaseDatosLotes.push(nuevoPin);
                                            }
                                            try {
                                                nuevoPin.createTooltipArgs = nuevoPin;
                                                if (typeof window.generarSmartPin === 'function') nuevoPin.createTooltipFunc = window.generarSmartPin;
                                                window.visor360.addHotSpot(nuevoPin);
                                                if (typeof window.arq2_recalcAllPolygonStatuses === 'function') window.arq2_recalcAllPolygonStatuses();
                                                if (typeof window.saveToLocal === 'function') window.saveToLocal();
                                                if (typeof window.refreshAllHotspots === 'function') window.refreshAllHotspots();
                                            } catch(err) { console.warn('[PinV2] addHotSpot error:', err); }
                                        }
                                    }
                                });
                            });
                            observer.observe(modalEl, { attributes: true, attributeFilter: ['class'] });
                        }
                    } else {
                        console.warn('[Arq3] openPinEditor no encontrado.');
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
                        if(lote.streetLeftMesh) { lote.streetLeftMesh.geometry.dispose(); lote.streetLeftMesh.material.dispose(); this.group.remove(lote.streetLeftMesh); }
                        if(lote.streetRightMesh) { lote.streetRightMesh.geometry.dispose(); lote.streetRightMesh.material.dispose(); this.group.remove(lote.streetRightMesh); }
                        if(lote.streetCenterMesh) { lote.streetCenterMesh.geometry.dispose(); lote.streetCenterMesh.material.dispose(); this.group.remove(lote.streetCenterMesh); }
                        if(lote.markerMeshes) {
                            lote.markerMeshes.forEach(m => { m.geometry.dispose(); m.material.dispose(); this.vertexMarkerGroup.remove(m); });
                        }
                        const loteIdStr = lote.id;
                        this.lotes.splice(idx, 1);
                        if (typeof window.applyEraserDelete === 'function') {
                            window.applyEraserDelete(loteIdStr);
                            if (typeof window.syncSVGElements === 'function') window.syncSVGElements();
                            if (typeof window.updateSVGPaths === 'function') window.updateSVGPaths();
                        }
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
                let v3 = this.getVectorFromEvent(e);
                if (v3) {
                    if (Array.isArray(this.draggingInfo)) {
                        const renderer = window.visor360.getThreeRenderer();
                        const rect = renderer.domElement.getBoundingClientRect();
                        const screenX = e.clientX - rect.left;
                        const screenY = e.clientY - rect.top;
                        const snapped = this.getSnapToAnyVertex(screenX, screenY, this.draggingInfo);
                        if (snapped) v3 = snapped;
                        
                        this.draggingInfo.forEach(info => {
                            this.updateVertexPosition(info, v3, e, true);
                        });
                        this.updateCosturaEdges();
                    } else {
                        this.updateVertexPosition(this.draggingInfo, v3, e);
                    }
                }
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
                // DO NOT FINISH on double click!
                // Only cut when Enter is pressed.
            } else {
                this.finishPolygon();
            }
        }, { capture: true });
        
        container.addEventListener('contextmenu', (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            if (this.currentTool === 'calle-curva') {
                // DO NOT FINISH on right click!
                // Only cut when Enter is pressed.
            } else {
                this.finishPolygon();
            }
        });
    },

    getPitchYawFromVector: function(v) {
        const r = v.length();
        const pitch = -Math.asin(v.y / r) * (180 / Math.PI);
        const yaw = -Math.atan2(v.x, -v.z) * (180 / Math.PI);
        return [pitch, yaw];
    },

    projectTo2DPlane: function(pts) {
        if (pts.length < 3) return [];
        const center = new THREE.Vector3(0,0,0);
        pts.forEach(p => center.add(p));
        center.normalize();
        
        let up = new THREE.Vector3(0, 1, 0);
        if (Math.abs(center.y) > 0.99) up.set(1, 0, 0);
        
        const u = new THREE.Vector3().crossVectors(up, center).normalize();
        const v = new THREE.Vector3().crossVectors(center, u).normalize();
        
        return pts.map(p => new THREE.Vector2(p.dot(u), p.dot(v)));
    },

    buildNative3DStreet: function(pts, widthFactor, isClosed, curvaturaFactor) {
        if (pts.length < 2) return null;
        
        // 1. Create CatmullRomCurve3 with curvatura parameter
        let curvaturaVal = curvaturaFactor !== undefined ? curvaturaFactor : window.draftCalleCurvaCurvatura;
        if (curvaturaVal === undefined) curvaturaVal = 5;
        
        let curve;
        if (curvaturaVal === 0) {
            curve = new THREE.CatmullRomCurve3(pts, isClosed, 'catmullrom', 0); // Recta
        } else {
            curve = new THREE.CatmullRomCurve3(pts, isClosed, 'catmullrom', curvaturaVal / 10);
        }
        
        // Number of segments
        const divisions = Math.max(20, pts.length * 10);
        const smoothPts = curve.getPoints(divisions);
        
        const width = Math.max(1.0, (widthFactor || window.arq2CalleCurvaAncho || 5.5)) * 1.5; // Escala empírica

        const leftPts = [];
        const rightPts = [];
        
        for (let i = 0; i < smoothPts.length; i++) {
            const pt = smoothPts[i];
            
            // Tangent calculation
            let tangent;
            if (i === 0) {
                if (isClosed) tangent = new THREE.Vector3().subVectors(smoothPts[1], smoothPts[smoothPts.length - 2]).normalize();
                else tangent = new THREE.Vector3().subVectors(smoothPts[1], smoothPts[0]).normalize();
            } else if (i === smoothPts.length - 1) {
                if (isClosed) tangent = new THREE.Vector3().subVectors(smoothPts[1], smoothPts[smoothPts.length - 2]).normalize();
                else tangent = new THREE.Vector3().subVectors(smoothPts[i], smoothPts[i - 1]).normalize();
            } else {
                tangent = new THREE.Vector3().subVectors(smoothPts[i + 1], smoothPts[i - 1]).normalize();
            }
            
            // Sphere normal at this point is simply the normalized vector from origin
            const normal = pt.clone().normalize();
            
            // Binormal is perpendicular to tangent and normal, pointing "right"
            const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
            
            // Push left and right
            leftPts.push(pt.clone().add(binormal.clone().multiplyScalar(-width)));
            rightPts.push(pt.clone().add(binormal.clone().multiplyScalar(width)));
        }
        
        // Create Triangle Strip Fill
        const vertices = [];
        for (let i = 0; i < smoothPts.length - 1; i++) {
            const l1 = leftPts[i], r1 = rightPts[i];
            const l2 = leftPts[i+1], r2 = rightPts[i+1];
            
            // Triangle 1: l1, r1, l2
            vertices.push(l1.x, l1.y, l1.z, r1.x, r1.y, r1.z, l2.x, l2.y, l2.z);
            // Triangle 2: r1, r2, l2
            vertices.push(r1.x, r1.y, r1.z, r2.x, r2.y, r2.z, l2.x, l2.y, l2.z);
        }
        
        return {
            centerPts: smoothPts,
            leftPts: leftPts,
            rightPts: rightPts,
            fillVertices: vertices
        };
    },

    getSnapToAnyVertex: function(screenX, screenY, skipVertices = null, skipIndex = -1, threshold = 25) {
        if (!window.visor360) return null;
        const camera = window.visor360.getThreeCamera();
        const renderer = window.visor360.getThreeRenderer();
        const rect = renderer.domElement.getBoundingClientRect();
        
        let closestPt = null;
        let minDist = threshold;
        
        const checkPoints = (pts, isTemp, isEdge = false) => {
            if (!pts) return;
            const loteId = isTemp ? null : this.lotes.find(l=> l.points === pts || l.edgePoints === pts)?.id;
            pts.forEach((pt3d, idx) => {
                if (!isTemp && skipVertices && !isEdge) {
                    if (Array.isArray(skipVertices)) {
                        if (skipVertices.some(v => v.loteId === loteId && v.index === idx)) return;
                    } else if (skipVertices === loteId && skipIndex === idx) {
                        return; // compatibilidad anterior
                    }
                }
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
        
        this.lotes.forEach(lote => {
            checkPoints(lote.points, false);
            if (lote.edgePoints) checkPoints(lote.edgePoints, false, true);
        });
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
        
        // Agregar esfera visual temporal (60% mas pequeno)
        const markerGeo = new THREE.SphereGeometry(0.48, 16, 16); 
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        
        // Efecto Neon temporal
        const glowGeoTemp = new THREE.SphereGeometry(0.8, 16, 16);
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
            if (this.tempLineMesh.isGroup) {
                this.tempLineMesh.children.forEach(c => {
                    if(c.geometry) c.geometry.dispose();
                    if(c.material) c.material.dispose();
                });
            } else {
                if (this.tempLineMesh.geometry) this.tempLineMesh.geometry.dispose();
                if (this.tempLineMesh.material) this.tempLineMesh.material.dispose();
            }
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
            color: 0xffffff, // Blanca neon premium
            linewidth: 4, 
            depthTest: false, 
            transparent: true, 
            opacity: 0.9 
        });
        
        this.tempLineMesh = new THREE.Line(geo, mat);
        this.group.add(this.tempLineMesh);
    },

    renderTempStreet: function(renderPts) {
        const geoData = this.buildNative3DStreet(renderPts, undefined, false, window.draftCalleCurvaCurvatura);
        if (!geoData) return;

        if (this.tempLineMesh) {
            this.group.remove(this.tempLineMesh);
            if (this.tempLineMesh.isGroup) {
                this.tempLineMesh.children.forEach(c => {
                    if (c.geometry) c.geometry.dispose();
                    if (c.material) c.material.dispose();
                });
            } else {
                if (this.tempLineMesh.geometry) this.tempLineMesh.geometry.dispose();
                if (this.tempLineMesh.material) this.tempLineMesh.material.dispose();
            }
        }

        this.tempLineMesh = new THREE.Group();
        
        const lMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.8 });
        this.tempLineMesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.leftPts), lMat));
        this.tempLineMesh.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.rightPts), lMat));
        
        const cMat = new THREE.LineDashedMaterial({ color: 0xffdd00, linewidth: 4, dashSize: 8, gapSize: 8, depthTest: false, transparent: true, opacity: 0.8 });
        const cLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.centerPts), cMat);
        cLine.computeLineDistances();
        this.tempLineMesh.add(cLine);

        this.group.add(this.tempLineMesh);

        // Relleno temporal
        if (!this.tempFillMesh) {
            const fillMat = new THREE.MeshBasicMaterial({
                color: 0x94a3b8,
                transparent: true,
                opacity: window.draftCalleCurvaAlpha ?? 0.7,
                side: THREE.DoubleSide,
                depthTest: false
            });
            this.tempFillMesh = new THREE.Mesh(new THREE.BufferGeometry(), fillMat);
            this.group.add(this.tempFillMesh);
        }
        
        this.tempFillMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(geoData.fillVertices, 3));
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
            color: 0xffffff, // Blanca neón premium
            animStartTime: Date.now()
        };

        this.lotes.push(newLote);
        this.clearTemp();
        this.buildLoteMeshes(newLote);
        
        // Agregar los meshes a la escena
        this.group.add(newLote.lineMesh);
        if (newLote.fillMesh) this.group.add(newLote.fillMesh);
        if (newLote.markerMeshes) {
            newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
        }
        
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
        
        if (newLote.lineMesh) this.group.add(newLote.lineMesh);
        if (newLote.fillMesh) this.group.add(newLote.fillMesh);
        if (newLote.streetLeftMesh) this.group.add(newLote.streetLeftMesh);
        if (newLote.streetRightMesh) this.group.add(newLote.streetRightMesh);
        if (newLote.streetCenterMesh) this.group.add(newLote.streetCenterMesh);
        
        if (newLote.markerMeshes) {
            newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
        }
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
            if (this.tempLineMesh.isGroup) {
                this.tempLineMesh.children.forEach(c => {
                    if(c.geometry) c.geometry.dispose();
                    if(c.material) c.material.dispose();
                });
            } else {
                if(this.tempLineMesh.geometry) this.tempLineMesh.geometry.dispose();
                if(this.tempLineMesh.material) this.tempLineMesh.material.dispose();
            }
        }
        this.tempLineMesh = null;
        
        if (this.tempFillMesh) {
            this.group.remove(this.tempFillMesh);
            if(this.tempFillMesh.geometry) this.tempFillMesh.geometry.dispose();
            if(this.tempFillMesh.material) this.tempFillMesh.material.dispose();
        }
        this.tempFillMesh = null;
        
        // Limpiar etiquetas de vértices
        if (this.tempLabels) {
            this.tempLabels.forEach(lbl => {
                if(lbl && lbl.parentNode) lbl.parentNode.removeChild(lbl);
            });
            this.tempLabels = [];
        }
    },

    importFranjaLotes: function(gid) {
        if (!window.getFranjaChildLines) return;
        const franjaLotes = window.getFranjaChildLines(gid);
        
        franjaLotes.forEach((lote, index) => {
            const loteId = 'FRANJA_3D_' + Date.now() + '_' + index;
            // Convertir de pitch/yaw a vectores 3D nativos
            const v3Pts = lote.puntos.map(py => window.visor360.getVectorFromPitchYaw(py[0], py[1]));
            
            const newLote = {
                id: loteId,
                tipo: 'lote',
                points: v3Pts,
                color: window.arq3Colors[Math.floor(Math.random() * window.arq3Colors.length)],
                animStartTime: Date.now(),
                franjaGrupo: gid
            };

            this.lotes.push(newLote);
            this.buildLoteMeshes(newLote);
            
            if (newLote.lineMesh) this.group.add(newLote.lineMesh);
            if (newLote.fillMesh) this.group.add(newLote.fillMesh);
            if (newLote.markerMeshes) {
                newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
            }
        });

        // Limpiar el rastro 2D para evitar duplicados visuales
        if (window.allDrawnLines) {
            window.allDrawnLines = window.allDrawnLines.filter(l => l.franjaGrupo !== gid);
        }
        
        // Autocostura
        window.updateCosturaEdges();
    },

    buildLoteMeshes: function(lote) {
        const pts = [...lote.points];
        if (pts.length < 2) return;
        
        let vertices = [];
        let geo, mat;

        if (lote.tipo === 'calle-curva') {
            const geoData = this.buildNative3DStreet(pts, lote.ancho, false, lote.curvatura);
            if (geoData) {
                geo = new THREE.BufferGeometry().setFromPoints(geoData.centerPts);
                mat = new THREE.LineBasicMaterial({ visible: false }); // Ocultamos el borde gris feo
                
                const lMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3, depthTest: false, transparent: true, opacity: 0.8 });
                lote.streetLeftMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.leftPts), lMat);
                lote.streetRightMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.rightPts), lMat);
                
                const cMat = new THREE.LineDashedMaterial({ color: 0xffdd00, linewidth: 4, dashSize: 8, gapSize: 8, depthTest: false, transparent: true, opacity: 0.8 });
                lote.streetCenterMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(geoData.centerPts), cMat);
                lote.streetCenterMesh.computeLineDistances();

                lote.edgePoints = [...geoData.leftPts, ...geoData.rightPts];

                for (let i = 0; i < geoData.fillVertices.length; i++) vertices.push(geoData.fillVertices[i]);
            }
        } else {
            pts.push(pts[0].clone()); // cerrar loop
            geo = new THREE.BufferGeometry().setFromPoints(pts);
            mat = new THREE.LineBasicMaterial({ 
                color: 0xffffff, // Blanca neon premium para bordes
                linewidth: 3, 
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });
            const cleanPts = pts.slice(0, -1);
            const vec2D = this.projectTo2DPlane(cleanPts);
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
        
        // Marcadores de v?rtices (Nodos) (60% mas pequenos)
        lote.markerMeshes = [];
        const markerGeo = new THREE.SphereGeometry(0.56, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
        
        // Efecto glow premium
        const glowGeo = new THREE.SphereGeometry(1.04, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.4, 
            blending: THREE.AdditiveBlending,
            depthTest: false 
        });
        
        const chk = document.getElementById('arq2-lote-libre-hide-streets');
        const hideStreets = chk ? chk.checked : false;

        lote.points.forEach((p, index) => {
            const m = new THREE.Mesh(markerGeo, markerMat);
            const mGlow = new THREE.Mesh(glowGeo, glowMat);
            m.add(mGlow); // Anidar el brillo neón al marcador principal
            m.position.copy(p);
            m.userData = { loteId: lote.id, index: index };
            if (lote.tipo === 'calle-curva' && hideStreets) {
                m.visible = false;
            }
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
                linewidth: 3,
                dashSize: 10,
                gapSize: 6,
                depthTest: false,
                transparent: true,
                opacity: 1.0 // Neon brillante
            });
            const line = new THREE.Line(geo, mat);
            line.computeLineDistances();
            this.sharedEdgesGroup.add(line);
        });
    },

    updateVertexPosition: function(info, rawV3, e, skipSnap = false) {
        const lote = this.lotes.find(l => l.id === info.loteId);
        if (!lote) return;
        
        let v3 = rawV3;
        // Snap al arrastrar vértices
        if (!skipSnap && e && window.visor360) {
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
            const geoData = this.buildNative3DStreet(pts, lote.ancho, false, lote.curvatura);
            if (geoData) {
                if (lote.lineMesh) {
                    lote.lineMesh.geometry.dispose();
                    lote.lineMesh.geometry = new THREE.BufferGeometry().setFromPoints(geoData.centerPts);
                }
                
                if (lote.streetLeftMesh) {
                    lote.streetLeftMesh.geometry.dispose();
                    lote.streetLeftMesh.geometry = new THREE.BufferGeometry().setFromPoints(geoData.leftPts);
                }
                if (lote.streetRightMesh) {
                    lote.streetRightMesh.geometry.dispose();
                    lote.streetRightMesh.geometry = new THREE.BufferGeometry().setFromPoints(geoData.rightPts);
                }
                
                if (lote.streetCenterMesh) {
                    lote.streetCenterMesh.geometry.dispose();
                    lote.streetCenterMesh.geometry = new THREE.BufferGeometry().setFromPoints(geoData.centerPts);
                    lote.streetCenterMesh.computeLineDistances();
                }

                lote.edgePoints = [...geoData.leftPts, ...geoData.rightPts];

                for (let i = 0; i < geoData.fillVertices.length; i++) vertices.push(geoData.fillVertices[i]);
            }
        } else {
            pts.push(pts[0].clone()); // cerrar loop
            lote.lineMesh.geometry.dispose();
            lote.lineMesh.geometry = new THREE.BufferGeometry().setFromPoints(pts);
            
            // Actualizar relleno con triangulación correcta para cóncavos
            const cleanPts = lote.points; // lote.points ya no tiene el loop cerrado, pts sí
            const vec2D = this.projectTo2DPlane(cleanPts);
            const faces = THREE.ShapeUtils.triangulateShape(vec2D, []);
            faces.forEach(face => {
                const pA = cleanPts[face[0]];
                const pB = cleanPts[face[1]];
                const pC = cleanPts[face[2]];
                vertices.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pC.x, pC.y, pC.z);
            });
        }
        
        if (lote.fillMesh) {
            if (lote.fillMesh.geometry) lote.fillMesh.geometry.dispose();
            lote.fillMesh.geometry = new THREE.BufferGeometry();
            lote.fillMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            if (lote.tipo === 'calle-curva' && lote.alpha !== undefined && lote.fillMesh.material) {
                lote.fillMesh.material.opacity = lote.alpha;
            }
        }
        
        // Actualizar el mesh de la esfera (nodo) que estamos moviendo
        lote.markerMeshes[info.index].position.copy(v3);
        
        if (!skipSnap) this.updateCosturaEdges();
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
                        
                        if (lote.lineMesh) {
                            if (lote.tipo === 'lote-libre') lote.lineMesh.material.color.setHex(0xffffff);
                            else lote.lineMesh.material.color.copy(whiteColor).lerp(baseColor, ease);
                        }
                        if (lote.fillMesh) {
                            lote.fillMesh.material.color.copy(whiteColor).lerp(baseColor, ease);
                            lote.fillMesh.material.opacity = 0.6 - (0.3 * ease); // Pasa de 0.6 a 0.3
                        }
                    }
                } else {
                    // Finaliza la animación de forma segura
                    lote.animStartTime = null;
                    if (lote.lineMesh) {
                        if (lote.tipo === 'lote-libre') lote.lineMesh.material.color.setHex(0xffffff);
                        else lote.lineMesh.material.color.setHex(lote.color);
                    }
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
    },

    importPuntosHorizonte: function() {
        const hologui = document.getElementById('holographic-ui-engine');
        if (!hologui || !window.PuntosHorizonte) return;
        
        // Remove previously imported pins
        hologui.querySelectorAll('.ferrari-imported-pin').forEach(el => el.remove());
        
        window.PuntosHorizonte.forEach(punto => {
            const div = document.createElement('div');
            div.className = 'ferrari-imported-pin pnlm-hotspot-base'; // Use pnlm-hotspot-base to ensure styling compatibility if needed
            div.style.position = 'absolute';
            div.style.pointerEvents = 'auto'; // CRITICAL: make it clickable
            div.setAttribute('data-pitch', punto.pitch);
            div.setAttribute('data-yaw', punto.yaw);
            
            if (punto.tipo === 'ruta') {
                if (typeof window.generarMarcadorRuta === 'function') window.generarMarcadorRuta(div, punto);
            } else {
                if (typeof window.generarMarcadorHorizonte === 'function') window.generarMarcadorHorizonte(div, punto);
            }
            
            hologui.appendChild(div);
        });
    },

    importAllDrawnLines: function() {
        if (!window.allDrawnLines) return;

        window.allDrawnLines.forEach(line => {
            if (line.tipo !== 'calle-curva-arq2' && line.tipo !== 'calle' && line.tipo !== 'lote' && line.tipo !== 'calle-curva') return;
            if (this.lotes.find(l => l.id === line.id)) return;
            
            const ptsArray = line.ejeOriginal || line.puntos || [];
            if (ptsArray.length < 2) return;
            
            const v3Pts = ptsArray.map(py => window.visor360.getVectorFromPitchYaw(py[0], py[1]));
            
            const newLote = {
                id: line.id,
                tipo: (line.tipo === 'lote') ? 'lote' : 'calle-curva',
                points: v3Pts,
                color: line.color || (line.tipo === 'lote' ? 0xffffff : 0x94a3b8),
                ancho: line.calleCurvaAncho || line.ancho || 8,
                alpha: line.calleCurvaAlpha || line.alpha || 0.7,
                curvatura: line.calleCurvaCurvatura !== undefined ? line.calleCurvaCurvatura : 5
            };
            this.lotes.push(newLote);
            this.buildLoteMeshes(newLote);
            
            if (newLote.lineMesh) this.group.add(newLote.lineMesh);
            if (newLote.fillMesh) this.group.add(newLote.fillMesh);
            if (newLote.streetLeftMesh) this.group.add(newLote.streetLeftMesh);
            if (newLote.streetRightMesh) this.group.add(newLote.streetRightMesh);
            if (newLote.streetCenterMesh) this.group.add(newLote.streetCenterMesh);
            if (newLote.markerMeshes) newLote.markerMeshes.forEach(m => this.vertexMarkerGroup.add(m));
        });
    },

    syncToAllDrawnLines: function() {
        if (!window.allDrawnLines) window.allDrawnLines = [];
        this.lotes.forEach(l => {
            let existing = window.allDrawnLines.find(old => old.id === l.id);
            const pyPoints = l.points.map(pt => this.getPitchYawFromVector(pt));
            if (existing) {
                existing.puntos = pyPoints;
                if (l.tipo === 'calle-curva') existing.ejeOriginal = pyPoints;
                if (l.ancho !== undefined) existing.calleCurvaAncho = l.ancho;
                if (l.alpha !== undefined) existing.calleCurvaAlpha = l.alpha;
                if (l.curvatura !== undefined) existing.calleCurvaCurvatura = l.curvatura;
            } else {
                window.allDrawnLines.push({
                    id: l.id,
                    tipo: l.tipo === 'calle-curva' ? 'calle-curva-arq2' : l.tipo,
                    puntos: pyPoints,
                    ejeOriginal: l.tipo === 'calle-curva' ? pyPoints : undefined,
                    calleCurvaAncho: l.ancho || 8,
                    calleCurvaAlpha: l.alpha || 0.7,
                    calleCurvaCurvatura: l.curvatura !== undefined ? l.curvatura : 5
                });
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.arquitecto3D.init();
});
