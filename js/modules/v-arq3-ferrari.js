// js/modules/v-arq3-ferrari.js
// Motor de dibujo 100% nativo Three.js (Arquitecto 3.0)

window.arquitecto3D = {
    lotes: [], // array de { id, color, points: [THREE.Vector3...] }
    isActive: false,
    tempPoints: [],
    
    // Objetos Three.js
    group: null,
    tempLineMesh: null,
    tempFillMesh: null,
    tempMarkerGroup: null,

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
        
        // Inyectar grupo al encontrar el Motor Ferrari activo
        const checkFerrari = setInterval(() => {
            if (window.visor360 && window.visor360.getThreeScene) {
                const scene = window.visor360.getThreeScene();
                if (scene) {
                    this.group = new THREE.Group();
                    scene.add(this.group);
                    
                    this.tempMarkerGroup = new THREE.Group();
                    scene.add(this.tempMarkerGroup);
                    
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

    bindEvents: function() {
        const container = document.getElementById('panorama-container');
        let startX, startY, startTime;

        container.addEventListener('pointerdown', (e) => {
            if (!this.isActive) return;
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();
        });

        container.addEventListener('pointerup', (e) => {
            if (!this.isActive) return;
            const dt = Date.now() - startTime;
            const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
            
            if (dt < 400 && dist < 10) {
                // Es un click
                this.addPoint(e);
            }
        });
        
        container.addEventListener('pointermove', (e) => {
            if (!this.isActive) return;
            this.updatePreview(e);
        });

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
        const v3 = this.getVectorFromEvent(e);
        if (!v3) return;
        
        this.tempPoints.push(v3);
        
        // Agregar esfera visual (marcador)
        const markerGeo = new THREE.SphereGeometry(2, 16, 16); // Radio ligeramente más grande para que se vea
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(v3);
        this.tempMarkerGroup.add(marker);

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
            color: 0xef4444, 
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
        
        // Crear polígono cerrado en la base de datos local
        this.lotes.push({
            id: loteId,
            points: finalPts,
            color: 0xffffff // Blanco por defecto
        });

        this.clearTemp();
        this.renderAllLotes();
    },

    clearTemp: function() {
        this.tempPoints = [];
        if (this.tempLineMesh) {
            this.group.remove(this.tempLineMesh);
            this.tempLineMesh.geometry.dispose();
            this.tempLineMesh.material.dispose();
            this.tempLineMesh = null;
        }
        
        // Limpiar esferas
        while(this.tempMarkerGroup.children.length > 0) {
            const child = this.tempMarkerGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.tempMarkerGroup.remove(child);
        }
    },

    renderAllLotes: function() {
        // Limpiar lotes consolidados excepto los estáticos que no son parte de los lotes guardados en arq3
        // Pero primero limpiamos solo los meshes creados por arq3
        while(this.group.children.length > 0) {
            const child = this.group.children[0];
            if (child === this.tempLineMesh) break;
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
            this.group.remove(child);
        }

        this.lotes.forEach(lote => {
            const pts = [...lote.points];
            pts.push(pts[0].clone()); // cerrar loop

            // Línea perimetral
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ 
                color: lote.color, 
                linewidth: 3, 
                depthTest: false,
                transparent: true,
                opacity: 0.8
            });
            const lineMesh = new THREE.Line(geo, mat);
            this.group.add(lineMesh);

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
                opacity: 0.2,
                side: THREE.DoubleSide,
                depthTest: false
            });
            const fillMesh = new THREE.Mesh(fillGeo, fillMat);
            this.group.add(fillMesh);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.arquitecto3D.init();
});
