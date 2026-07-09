// ==========================================
// STATE MANAGER - SINGLE SOURCE OF TRUTH
// ==========================================
window.StateManager = {
    // Convierte el estado fragmentado actual en un payload normalizado
    buildSnapshot() {
        this.normalizeTrazos();
        this.normalizePines();
        
        return {
            version: 2,
            timestamp: Date.now(),
            configProyecto: window.ConfigProyecto,
            origen: window.OrigenDrone,
            norte: window.NorteOffset,
            // Consolidamos entidades en un solo array
            entidades: [
                ...(window.allDrawnLines || []),
                ...(window.BaseDatosLotes || []),
                ...(window.PuntosHorizonte || [])
            ],
            // Compatibilidad legacy
            trazos: window.allDrawnLines || [],
            lotes: window.BaseDatosLotes || [],
            horizontes: window.PuntosHorizonte || []
        };
    },

    // Aplica un snapshot consolidado a las variables fragmentadas legacy
    applySnapshot(snapshot) {
        if (!snapshot || (!snapshot.entidades && !snapshot.trazos)) return false;
        
        window.ConfigProyecto = snapshot.configProyecto || window.ConfigProyecto;
        window.OrigenDrone = snapshot.origen || window.OrigenDrone;
        window.NorteOffset = snapshot.norte || 0;
        
        if (snapshot.version >= 2 && snapshot.entidades) {
            // Re-distribuir a las capas legacy (temporal hasta migrar render)
            window.allDrawnLines = snapshot.entidades.filter(e => 
                e.tipo.startsWith('calle') || e.tipo.startsWith('lote-') || e.tipo.startsWith('franja') || e.tipo === 'costura' || e.tipo === 'fila-variable-lote'
            );
            window.BaseDatosLotes = snapshot.entidades.filter(e => 
                ['lote', 'acceso', 'referencia', 'vista360', 'casa360', 'terreno'].includes(e.tipo)
            );
            window.PuntosHorizonte = snapshot.entidades.filter(e => 
                ['horizonte', 'ruta'].includes(e.tipo)
            );
        } else {
            // Compatibilidad V1
            window.BaseDatosLotes = snapshot.lotes || window.BaseDatosLotes;
            window.PuntosHorizonte = snapshot.horizontes || window.PuntosHorizonte;
            window.allDrawnLines = snapshot.trazos || window.allDrawnLines;
        }
        
        return true;
    },

    // Normalización de esquema para Trazos (Calles, Lotes)
    normalizeTrazos() {
        if (!window.allDrawnLines) return;
        window.allDrawnLines.forEach(t => {
            if (!t.id) t.id = 'trazo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            // Asegurar que la geometría guardada sea la final
            if (t.tipo === 'calle-curva-arq2' && !t.geometryVersion) {
                t.geometryVersion = 2; // Forzar flag
            }
        });
    },

    // Normalización de esquema para Pines
    normalizePines() {
        const pines = [...(window.BaseDatosLotes || []), ...(window.PuntosHorizonte || [])];
        pines.forEach(p => {
            if (!p.id) p.id = 'pin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        });
    },

    // Nueva persistencia Local unificada
    saveToLocal() {
        const snapshot = this.buildSnapshot();
        localStorage.setItem(window.FRESIA_CFG.autosaveKey, JSON.stringify(snapshot));
    },

    // Nueva carga Local unificada
    loadFromLocal() {
        const savedData = localStorage.getItem(window.FRESIA_CFG.autosaveKey);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                this.applySnapshot(parsed);
            } catch(e) {
                console.error("Error al cargar estado local", e);
            }
        }
    }
};

// Interceptar las funciones globales persistentes antiguas
window.saveToLocal = function() {
    window.StateManager.saveToLocal();
};

window.loadFromLocal = function() {
    window.StateManager.loadFromLocal();
};

window.buildCloudPayload = function() {
    const snapshot = window.StateManager.buildSnapshot();
    if (window.FRESIA_CFG && window.FRESIA_CFG.payloadIncludeVista) {
        snapshot.vista = window.FRESIA_CFG.vista;
    }
    return snapshot;
};
